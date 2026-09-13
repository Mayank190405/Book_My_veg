"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startPaymentReminderWorker = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const logger_1 = __importDefault(require("../utils/logger"));
const mbgcard_1 = require("./mbgcard");
const ONE_HOUR_MS = 60 * 60 * 1000;
const THREE_HOURS_MS = 3 * ONE_HOUR_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const FOUR_DAYS_MS = 4 * ONE_DAY_MS;
const startPaymentReminderWorker = () => {
    logger_1.default.info("[Payment & Retention Reminder Worker] Daemon initialized.");
    const runRemindersAndFeedbackCheck = () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        logger_1.default.info("[Payment & Retention Worker] Running background tasks (Dues, Inactivity & Feedback)...");
        try {
            const now = new Date();
            const origin = process.env.CLIENT_URL || "https://bookmyveg.co.in";
            // Load active template configurations
            const [dueConfig, inactiveConfig] = yield Promise.all([
                prisma_1.default.whatsAppTemplateConfig.findFirst({
                    where: { event: "PAYMENT_REMINDER", isActive: true }
                }),
                prisma_1.default.whatsAppTemplateConfig.findFirst({
                    where: { event: "CUSTOMER_INACTIVE", isActive: true }
                })
            ]);
            // ─── 1. DELAYED FEEDBACK REQUESTS (3 HOURS POST ORDER / DELIVERY) ───
            // Checks online DELIVERED orders and POS CONFIRMED retail orders
            const eligibleOrders = yield prisma_1.default.order.findMany({
                where: {
                    feedbackSent: false,
                    OR: [
                        { status: "DELIVERED" },
                        { channel: "POS", status: "CONFIRMED" }
                    ]
                },
                include: {
                    user: true,
                    statusHistory: {
                        orderBy: { createdAt: "desc" },
                        take: 1
                    }
                },
                take: 100
            });
            for (const order of eligibleOrders) {
                const user = order.user;
                if (!user || !user.phone)
                    continue;
                const statusHistoryItem = (_a = order.statusHistory) === null || _a === void 0 ? void 0 : _a[0];
                const completedAt = statusHistoryItem ? new Date(statusHistoryItem.createdAt) : new Date(order.updatedAt || order.createdAt);
                const elapsedMs = now.getTime() - completedAt.getTime();
                if (elapsedMs >= THREE_HOURS_MS) {
                    logger_1.default.info(`[Feedback Worker] Dispatching 3-hour post-order feedback request to ${user.name} (${user.phone}) for order ${order.id}`);
                    try {
                        yield (0, mbgcard_1.sendFeedbackRequestViaWhatsapp)(user.phone, user.name || "Customer", order.id);
                        yield prisma_1.default.order.update({
                            where: { id: order.id },
                            data: { feedbackSent: true }
                        });
                    }
                    catch (err) {
                        logger_1.default.error(`[Feedback Worker] Failed to send feedback request to ${user.phone}: ${err.message}`);
                    }
                }
            }
            // ─── 2. AUTOMATIC DUES PAYMENT REMINDERS (With Locked Payment Link) ───
            const unpaidOrders = yield prisma_1.default.order.findMany({
                where: {
                    isPaid: false,
                    paymentStatus: { in: ["PENDING", "PARTIAL"] },
                    status: { notIn: ["CANCELLED", "FAILED"] }
                },
                include: { user: true, payments: true, location: true },
                take: 100
            });
            // Target duration from config or default (7 days)
            const dueDurationValue = (dueConfig === null || dueConfig === void 0 ? void 0 : dueConfig.triggerDurationValue) || 7;
            const dueDurationUnit = (dueConfig === null || dueConfig === void 0 ? void 0 : dueConfig.triggerDurationUnit) || "DAYS";
            const dueIntervalMs = dueDurationUnit === "HOURS" ? dueDurationValue * ONE_HOUR_MS : dueDurationValue * ONE_DAY_MS;
            for (const order of unpaidOrders) {
                const user = order.user;
                if (!user || !user.phone)
                    continue;
                const ageInMs = now.getTime() - new Date(order.createdAt).getTime();
                const dueIntervalCycles = Math.floor(ageInMs / dueIntervalMs);
                // Send when order crosses 1x, 2x, 3x duration cycle within a 2-hour window
                const remainderMs = ageInMs % dueIntervalMs;
                const isCycleTrigger = dueIntervalCycles >= 1 && remainderMs < (2 * ONE_HOUR_MS);
                if (isCycleTrigger) {
                    const paid = order.payments.filter((p) => p.status === "SUCCESS" || p.status === "COMPLETED" || p.status === "PAID" || !p.status).reduce((sum, p) => sum + Number(p.amount), 0);
                    const dueAmount = Math.max(0, Number(order.totalAmount) - paid);
                    if (dueAmount > 0) {
                        logger_1.default.info(`[Payment Reminder Worker] Dispatching automatic due reminder to customer ${user.name} (${user.phone}) for order ${order.id} (Due: ₹${dueAmount})`);
                        yield (0, mbgcard_1.sendPaymentReminderViaWhatsapp)(user.phone, user.name || "Customer", dueAmount, order.id, user.id, order.id).catch((err) => {
                            logger_1.default.error(`[Payment Reminder Worker] Error sending automatic reminder to ${user.phone}: ${err.message}`);
                        });
                    }
                }
            }
            // ─── 3. 4-DAY INACTIVITY REMINDER (TEMPLATE: fresh_order) ───
            // Triggers when customer has not visited/ordered in 4 days
            const inactiveDurationValue = (inactiveConfig === null || inactiveConfig === void 0 ? void 0 : inactiveConfig.triggerDurationValue) || 4;
            const inactiveDurationUnit = (inactiveConfig === null || inactiveConfig === void 0 ? void 0 : inactiveConfig.triggerDurationUnit) || "DAYS";
            const inactiveIntervalMs = inactiveDurationUnit === "HOURS"
                ? inactiveDurationValue * ONE_HOUR_MS
                : (inactiveDurationValue === 4 ? FOUR_DAYS_MS : inactiveDurationValue * ONE_DAY_MS);
            // Find customers who have past orders, whose latest order is older than 4 days
            const customersWithHistory = yield prisma_1.default.user.findMany({
                where: {
                    role: "USER",
                    isActive: true,
                    orders: { some: { status: { notIn: ["CANCELLED", "FAILED"] } } }
                },
                select: {
                    id: true,
                    name: true,
                    phone: true,
                    orders: {
                        where: { status: { notIn: ["CANCELLED", "FAILED"] } },
                        orderBy: { createdAt: "desc" },
                        take: 1,
                        select: { createdAt: true }
                    }
                },
                take: 100
            });
            for (const customer of customersWithHistory) {
                if (!customer.phone)
                    continue;
                const lastOrder = customer.orders[0];
                if (!lastOrder)
                    continue;
                const lastOrderDate = new Date(lastOrder.createdAt);
                const inactiveMs = now.getTime() - lastOrderDate.getTime();
                const daysInactive = Math.floor(inactiveMs / ONE_DAY_MS);
                // If customer has been inactive for >= 4 days
                if (inactiveMs >= inactiveIntervalMs) {
                    // Check if an inactivity reminder has already been sent for this cycle (since latest order)
                    const existingReminderAudit = yield prisma_1.default.auditLog.findFirst({
                        where: {
                            entityType: "USER",
                            entityId: customer.id,
                            action: "WHATSAPP_4DAY_INACTIVE_REMINDER",
                            createdAt: { gte: lastOrderDate }
                        }
                    });
                    if (existingReminderAudit) {
                        continue; // Already sent since their last visit
                    }
                    const templateName = (inactiveConfig === null || inactiveConfig === void 0 ? void 0 : inactiveConfig.templateId) || "fresh_order";
                    logger_1.default.info(`[Retention Worker] Dispatching 4-day inactivity reminder (${templateName}) to customer ${customer.name} (${customer.phone}) - inactive for ${daysInactive} days`);
                    try {
                        yield (0, mbgcard_1.sendTemplateViaChatHub)(customer.phone, templateName, {
                            body: [origin]
                        });
                        // Record audit log to ensure message is only sent once per inactivity cycle
                        yield prisma_1.default.auditLog.create({
                            data: {
                                entityType: "USER",
                                entityId: customer.id,
                                action: "WHATSAPP_4DAY_INACTIVE_REMINDER",
                                newValue: { daysInactive, template: templateName, sentAt: now }
                            }
                        });
                    }
                    catch (err) {
                        logger_1.default.error(`[Retention Worker] Inactivity send failure for ${customer.phone}: ${err.message}`);
                    }
                }
            }
        }
        catch (error) {
            logger_1.default.error("[Payment Reminder Worker] Background check error:", error);
        }
    });
    // Run first check after 15 seconds, and then check every hour
    setTimeout(runRemindersAndFeedbackCheck, 15000);
    setInterval(runRemindersAndFeedbackCheck, ONE_HOUR_MS);
};
exports.startPaymentReminderWorker = startPaymentReminderWorker;
