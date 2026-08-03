import prisma from "../config/prisma";
import logger from "../utils/logger";
import { sendPaymentReminderViaWhatsapp, sendFeedbackRequestViaWhatsapp } from "./mbgcard";

const ONE_HOUR_MS = 60 * 60 * 1000;
const THREE_HOURS_MS = 3 * ONE_HOUR_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

export const startPaymentReminderWorker = () => {
    logger.info("[Payment Reminder Worker] Daemon initialized.");

    const runRemindersAndFeedbackCheck = async () => {
        logger.info("[Payment Reminder Worker] Running background tasks (Dues & Feedback)...");
        try {
            const now = new Date();

            // ─── 1. DELAYED FEEDBACK REQUESTS (3 HOURS POST-DELIVERY) ───
            const deliveredOrders = await prisma.order.findMany({
                where: {
                    status: "DELIVERED",
                    feedbackSent: false
                },
                include: { user: true, statusHistory: { where: { status: "DELIVERED" }, orderBy: { createdAt: "desc" }, take: 1 } }
            });

            for (const order of deliveredOrders) {
                const user = order.user;
                if (!user || !user.phone) continue;

                const deliveredHistory = order.statusHistory?.[0];
                const deliveredAt = deliveredHistory ? new Date(deliveredHistory.createdAt) : new Date(order.updatedAt);
                const elapsedMs = now.getTime() - deliveredAt.getTime();

                if (elapsedMs >= THREE_HOURS_MS) {
                    logger.info(`[Feedback Worker] Dispatching 3-hour feedback request to ${user.name} (${user.phone}) for order ${order.id}`);
                    try {
                        await sendFeedbackRequestViaWhatsapp(user.phone, user.name || "Customer", order.id);
                        
                        await prisma.order.update({
                            where: { id: order.id },
                            data: { feedbackSent: true }
                        });
                    } catch (err: any) {
                        logger.error(`[Feedback Worker] Failed to send feedback request to ${user.phone}: ${err.message}`);
                    }
                }
            }

            // ─── 2. DUES PAYMENT REMINDERS (7, 14, 21 DAYS UNPAID INVOICES) ───
            const unpaidOrders = await prisma.order.findMany({
                where: {
                    isPaid: false,
                    paymentStatus: { notIn: ["COMPLETED", "PAID"] }
                },
                include: { user: true, payments: true }
            });

            for (const order of unpaidOrders) {
                const user = order.user;
                if (!user || !user.phone) continue;

                const ageInMs = now.getTime() - new Date(order.createdAt).getTime();
                const ageInDays = ageInMs / ONE_DAY_MS;

                let shouldSend = false;
                let reminderType = "";

                if (ageInDays >= 7 && ageInDays < 8) {
                    shouldSend = true;
                    reminderType = "7-day";
                } else if (ageInDays >= 14 && ageInDays < 15) {
                    shouldSend = true;
                    reminderType = "14-day";
                } else if (ageInDays >= 21 && ageInDays < 22) {
                    shouldSend = true;
                    reminderType = "21-day";
                }

                if (shouldSend) {
                    const paid = order.payments.filter((p: any) => p.status === "SUCCESS").reduce((sum: number, p: any) => sum + Number(p.amount), 0);
                    const dueAmount = Math.max(0, Number(order.totalAmount) - paid);

                    if (dueAmount > 0) {
                        logger.info(`[Payment Reminder Worker] Dispatching ${reminderType} reminder to customer ${user.name} (${user.phone}) for order ${order.id}`);
                        await sendPaymentReminderViaWhatsapp(user.phone, user.name || "Customer", dueAmount, order.id, user.id, order.id).catch((err: any) => {
                            logger.error(`[Payment Reminder Worker] Error sending to ${user.phone}: ${err.message}`);
                        });
                    }
                }
            }
        } catch (error) {
            logger.error("[Payment Reminder Worker] Background check error:", error);
        }
    };

    // Run first check after 15 seconds, and then check every hour
    setTimeout(runRemindersAndFeedbackCheck, 15000);
    setInterval(runRemindersAndFeedbackCheck, ONE_HOUR_MS);
};
