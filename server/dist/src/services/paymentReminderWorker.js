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
    logger_1.default.info("[Payment Reminder Worker] Daemon initialized.");
    const runRemindersAndFeedbackCheck = () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        logger_1.default.info("[Payment Reminder Worker] Running background tasks (Dues & Feedback)...");
        try {
            const now = new Date();
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
            // ─── 2. DUES PAYMENT REMINDERS (7, 14, 21 DAYS UNPAID INVOICES) ───
            const unpaidOrders = yield prisma_1.default.order.findMany({
                where: {
                    isPaid: false,
                    paymentStatus: { notIn: ["COMPLETED", "PAID"] }
                },
                include: { user: true, payments: true }
            });
            for (const order of unpaidOrders) {
                const user = order.user;
                if (!user || !user.phone)
                    continue;
                const ageInMs = now.getTime() - new Date(order.createdAt).getTime();
                const ageInDays = ageInMs / ONE_DAY_MS;
                let shouldSend = false;
                let reminderType = "";
                if (ageInDays >= 7 && ageInDays < 8) {
                    shouldSend = true;
                    reminderType = "7-day";
                }
                else if (ageInDays >= 14 && ageInDays < 15) {
                    shouldSend = true;
                    reminderType = "14-day";
                }
                else if (ageInDays >= 21 && ageInDays < 22) {
                    shouldSend = true;
                    reminderType = "21-day";
                }
                if (shouldSend) {
                    const paid = order.payments.filter((p) => p.status === "SUCCESS").reduce((sum, p) => sum + Number(p.amount), 0);
                    const dueAmount = Math.max(0, Number(order.totalAmount) - paid);
                    if (dueAmount > 0) {
                        logger_1.default.info(`[Payment Reminder Worker] Dispatching ${reminderType} reminder to customer ${user.name} (${user.phone}) for order ${order.id}`);
                        yield (0, mbgcard_1.sendPaymentReminderViaWhatsapp)(user.phone, user.name || "Customer", dueAmount, order.id, user.id, order.id).catch((err) => {
                            logger_1.default.error(`[Payment Reminder Worker] Error sending to ${user.phone}: ${err.message}`);
                        });
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
