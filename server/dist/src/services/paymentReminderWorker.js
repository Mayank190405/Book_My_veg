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
const dueCalculationService_1 = require("./dueCalculationService");
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
            // Strictly sent ONLY ONCE per customer across their entire lifetime (never on every order)
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
                orderBy: { createdAt: "asc" },
                take: 100
            });
            const processedUserIdsInBatch = new Set();
            for (const order of eligibleOrders) {
                const user = order.user;
                if (!user || !user.phone) {
                    yield prisma_1.default.order.update({
                        where: { id: order.id },
                        data: { feedbackSent: true }
                    });
                    continue;
                }
                // If this user was already processed in this batch, mark order and skip
                if (processedUserIdsInBatch.has(user.id)) {
                    yield prisma_1.default.order.update({
                        where: { id: order.id },
                        data: { feedbackSent: true }
                    });
                    continue;
                }
                // Strictly enforce: ONCE PER CUSTOMER LIFETIME
                // Check if this customer has ever received a feedback message or already provided a rating/feedback
                const existingFeedbackRecord = yield prisma_1.default.order.findFirst({
                    where: {
                        userId: user.id,
                        OR: [
                            { feedbackSent: true },
                            { rating: { not: null } },
                            { feedback: { not: null } }
                        ]
                    }
                });
                if (existingFeedbackRecord) {
                    processedUserIdsInBatch.add(user.id);
                    // Mark all pending orders for this user as feedbackSent: true so they are never queried again
                    yield prisma_1.default.order.updateMany({
                        where: { userId: user.id, feedbackSent: false },
                        data: { feedbackSent: true }
                    });
                    logger_1.default.info(`[Feedback Worker] Customer ${user.phone} (${user.name || "Customer"}) already received a feedback prompt or reviewed order ${existingFeedbackRecord.id}. Skipping order ${order.id}.`);
                    continue;
                }
                const statusHistoryItem = (_a = order.statusHistory) === null || _a === void 0 ? void 0 : _a[0];
                const completedAt = statusHistoryItem ? new Date(statusHistoryItem.createdAt) : new Date(order.updatedAt || order.createdAt);
                const elapsedMs = now.getTime() - completedAt.getTime();
                if (elapsedMs >= THREE_HOURS_MS) {
                    logger_1.default.info(`[Feedback Worker] Dispatching ONE-TIME 3-hour post-order feedback request to ${user.name} (${user.phone}) for first-time order ${order.id}`);
                    try {
                        yield (0, mbgcard_1.sendFeedbackRequestViaWhatsapp)(user.phone, user.name || "Customer", order.id);
                        processedUserIdsInBatch.add(user.id);
                        // Mark ALL orders of this customer as feedbackSent: true to guarantee they are never messaged again
                        yield prisma_1.default.order.updateMany({
                            where: { userId: user.id },
                            data: { feedbackSent: true }
                        });
                    }
                    catch (err) {
                        logger_1.default.error(`[Feedback Worker] Failed to send feedback request to ${user.phone}: ${err.message}`);
                    }
                }
            }
            // ─── 2. AUTOMATIC DUES PAYMENT REMINDERS (With Locked Payment Link) ───
            // Target duration from config or default (7 days)
            const dueDurationValue = (dueConfig === null || dueConfig === void 0 ? void 0 : dueConfig.triggerDurationValue) || 7;
            const dueDurationUnit = (dueConfig === null || dueConfig === void 0 ? void 0 : dueConfig.triggerDurationUnit) || "DAYS";
            const dueIntervalMs = dueDurationUnit === "HOURS" ? dueDurationValue * ONE_HOUR_MS : dueDurationValue * ONE_DAY_MS;
            // Restrict automatic reminders to daytime (10:00 AM to 8:00 PM IST) to avoid disturbed night-time messages
            const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
            const istHour = istTime.getUTCHours();
            const isBusinessHours = istHour >= 10 && istHour < 20;
            if (isBusinessHours) {
                // Process all active customers with dues using deterministic cursor-based pagination
                // Eliminates arbitrary query limits (e.g. take: 200) and ensures complete coverage
                yield (0, dueCalculationService_1.processCustomersWithDuesInBatches)({
                    batchSize: 100,
                    handler: (_a) => __awaiter(void 0, [_a], void 0, function* ({ customer, summary }) {
                        if (!customer.phone || summary.eligibleOrdersCount === 0 || summary.totalDue <= 0) {
                            return;
                        }
                        // Check oldest unpaid order age: only trigger if the customer has dues older than dueIntervalMs
                        const oldestOrder = summary.eligibleOrders[summary.eligibleOrders.length - 1];
                        const oldestAgeMs = now.getTime() - new Date(oldestOrder.createdAt || now).getTime();
                        if (oldestAgeMs < dueIntervalMs) {
                            return;
                        }
                        // Check if a reminder was already sent to this customer recently (AuditLog cooldown)
                        const lastReminderAudit = yield prisma_1.default.auditLog.findFirst({
                            where: {
                                entityType: "USER",
                                entityId: customer.id,
                                action: "WHATSAPP_DUE_REMINDER"
                            },
                            orderBy: { createdAt: "desc" }
                        });
                        if (lastReminderAudit) {
                            const timeSinceLastReminder = now.getTime() - new Date(lastReminderAudit.createdAt).getTime();
                            // Cooldown: at least dueIntervalMs, with minimum 24 hours to prevent multiple messages on the same day
                            const cooldownMs = Math.max(dueIntervalMs, ONE_DAY_MS);
                            if (timeSinceLastReminder < cooldownMs) {
                                return; // Cooldown active, skip customer
                            }
                        }
                        const orderCount = summary.eligibleOrdersCount;
                        const latestOrder = summary.eligibleOrders[0];
                        const invoiceLabel = orderCount > 1
                            ? `All Dues (${orderCount} Bills)`
                            : latestOrder.id;
                        logger_1.default.info(`[Payment Reminder Worker] Dispatching automatic due reminder to customer ${customer.name} (${customer.phone}) - Total Due: ₹${summary.totalDueFormatted} [${invoiceLabel}]`);
                        try {
                            yield (0, mbgcard_1.sendPaymentReminderViaWhatsapp)(customer.phone, customer.name || "Customer", summary.totalDue, invoiceLabel, customer.id, latestOrder.id);
                            // Record AuditLog to prevent duplicate reminders within cooldown
                            yield prisma_1.default.auditLog.create({
                                data: {
                                    entityType: "USER",
                                    entityId: customer.id,
                                    action: "WHATSAPP_DUE_REMINDER",
                                    newValue: {
                                        totalDue: summary.totalDue,
                                        orderCount,
                                        invoiceLabel,
                                        trigger: "AUTOMATIC_WORKER",
                                        sentAt: now
                                    }
                                }
                            });
                        }
                        catch (err) {
                            logger_1.default.error(`[Payment Reminder Worker] Error sending automatic reminder to ${customer.phone}: ${err.message}`);
                        }
                    })
                });
            }
            else {
                logger_1.default.info(`[Payment Reminder Worker] Outside business hours (${istHour}:00 IST). Skipping automated dues reminder check.`);
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
                    if (!mbgcard_1.APPROVED_UTILITY_TEMPLATES.has(templateName)) {
                        logger_1.default.info(`[Retention Worker] Inactivity reminder skipped for ${customer.phone}: template '${templateName}' is non-utility. Strict utility policy active.`);
                        continue;
                    }
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
