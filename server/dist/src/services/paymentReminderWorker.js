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
            // ─── 1. DELAYED FEEDBACK REQUESTS (3 HOURS POST-DELIVERY) ───
            const deliveredOrders = yield prisma_1.default.order.findMany({
                where: {
                    status: "DELIVERED",
                    feedbackSent: false
                },
                include: { user: true, statusHistory: { where: { status: "DELIVERED" }, orderBy: { createdAt: "desc" }, take: 1 } }
            });
            for (const order of deliveredOrders) {
                const user = order.user;
                if (!user || !user.phone)
                    continue;
                const deliveredHistory = (_a = order.statusHistory) === null || _a === void 0 ? void 0 : _a[0];
                const deliveredAt = deliveredHistory ? new Date(deliveredHistory.createdAt) : new Date(order.updatedAt);
                const elapsedMs = now.getTime() - deliveredAt.getTime();
                if (elapsedMs >= THREE_HOURS_MS) {
                    logger_1.default.info(`[Feedback Worker] Dispatching 3-hour feedback request to ${user.name} (${user.phone}) for order ${order.id}`);
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
            // ─── 2. DUES PAYMENT REMINDERS (With Locked Payment Link) ───
            const unpaidOrders = yield prisma_1.default.order.findMany({
                where: {
                    isPaid: false,
                    paymentStatus: { in: ["PENDING", "PARTIAL"] },
                    status: { notIn: ["CANCELLED", "FAILED"] }
                },
                include: { user: true, payments: true, location: true }
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
                    const paid = order.payments.filter((p) => p.status === "SUCCESS" || !p.status).reduce((sum, p) => sum + Number(p.amount), 0);
                    const dueAmount = Math.max(0, Number(order.totalAmount) - paid);
                    if (dueAmount > 0) {
                        const templateName = (dueConfig === null || dueConfig === void 0 ? void 0 : dueConfig.templateId) || "due_payment_reminder";
                        const lockedPayLink = `${origin}/pay?userid=${user.id}&number=${user.phone}&billid=${order.id}&lockAmount=true`;
                        logger_1.default.info(`[Payment Reminder Worker] Dispatching due reminder to customer ${user.name} (${user.phone}) for order ${order.id} (Due: ₹${dueAmount})`);
                        yield (0, mbgcard_1.sendTemplateViaChatHub)(user.phone, templateName, {
                            body: [
                                user.name || "Customer",
                                String(dueAmount),
                                order.id,
                                lockedPayLink
                            ]
                        }).catch((err) => {
                            logger_1.default.error(`[Payment Reminder Worker] Error sending to ${user.phone}: ${err.message}`);
                        });
                    }
                }
            }
            // ─── 3. 7-DAY (OR CONFIGURABLE) INACTIVITY REMINDERS ───
            const inactiveDurationValue = (inactiveConfig === null || inactiveConfig === void 0 ? void 0 : inactiveConfig.triggerDurationValue) || 7;
            const inactiveDurationUnit = (inactiveConfig === null || inactiveConfig === void 0 ? void 0 : inactiveConfig.triggerDurationUnit) || "DAYS";
            const inactiveIntervalMs = inactiveDurationUnit === "HOURS" ? inactiveDurationValue * ONE_HOUR_MS : inactiveDurationValue * ONE_DAY_MS;
            const inactivityThresholdDate = new Date(now.getTime() - inactiveIntervalMs);
            // Find users who have orders, but whose latest order is older than threshold
            const customersWithHistory = yield prisma_1.default.user.findMany({
                where: {
                    role: "USER",
                    isActive: true,
                    orders: { some: {} }
                },
                select: {
                    id: true,
                    name: true,
                    phone: true,
                    orders: {
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
                // Check if customer just crossed the inactivity threshold today (within 2 hours window)
                if (inactiveMs >= inactiveIntervalMs && (inactiveMs - inactiveIntervalMs) < (2 * ONE_HOUR_MS)) {
                    const templateName = (inactiveConfig === null || inactiveConfig === void 0 ? void 0 : inactiveConfig.templateId) || "customer_inactive_reminder";
                    const storeLink = `${origin}`;
                    const storeName = "Book My Veg";
                    logger_1.default.info(`[Retention Worker] Dispatching ${daysInactive}-day inactivity reminder to customer ${customer.name} (${customer.phone})`);
                    yield (0, mbgcard_1.sendTemplateViaChatHub)(customer.phone, templateName, {
                        body: [
                            customer.name || "Valued Customer",
                            storeName,
                            String(daysInactive),
                            storeLink
                        ]
                    }).catch((err) => {
                        logger_1.default.error(`[Retention Worker] Inactivity send failure for ${customer.phone}: ${err.message}`);
                    });
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
