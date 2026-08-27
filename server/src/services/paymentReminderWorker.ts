import prisma from "../config/prisma";
import logger from "../utils/logger";
import { sendTemplateViaChatHub, sendFeedbackRequestViaWhatsapp } from "./mbgcard";

const ONE_HOUR_MS = 60 * 60 * 1000;
const THREE_HOURS_MS = 3 * ONE_HOUR_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

export const startPaymentReminderWorker = () => {
    logger.info("[Payment & Retention Reminder Worker] Daemon initialized.");

    const runRemindersAndFeedbackCheck = async () => {
        logger.info("[Payment & Retention Worker] Running background tasks (Dues, Inactivity & Feedback)...");
        try {
            const now = new Date();
            const origin = process.env.CLIENT_URL || "https://bookmyveg.co.in";

            // Load active template configurations
            const [dueConfig, inactiveConfig] = await Promise.all([
                prisma.whatsAppTemplateConfig.findFirst({
                    where: { event: "PAYMENT_REMINDER", isActive: true }
                }),
                prisma.whatsAppTemplateConfig.findFirst({
                    where: { event: "CUSTOMER_INACTIVE", isActive: true }
                })
            ]);

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

            // ─── 2. DUES PAYMENT REMINDERS (With Locked Payment Link) ───
            const unpaidOrders = await prisma.order.findMany({
                where: {
                    isPaid: false,
                    paymentStatus: { in: ["PENDING", "PARTIAL"] },
                    status: { notIn: ["CANCELLED", "FAILED"] }
                },
                include: { user: true, payments: true, location: true }
            });

            // Target duration from config or default (7 days)
            const dueDurationValue = dueConfig?.triggerDurationValue || 7;
            const dueDurationUnit = dueConfig?.triggerDurationUnit || "DAYS";
            const dueIntervalMs = dueDurationUnit === "HOURS" ? dueDurationValue * ONE_HOUR_MS : dueDurationValue * ONE_DAY_MS;

            for (const order of unpaidOrders) {
                const user = order.user;
                if (!user || !user.phone) continue;

                const ageInMs = now.getTime() - new Date(order.createdAt).getTime();
                const dueIntervalCycles = Math.floor(ageInMs / dueIntervalMs);

                // Send when order crosses 1x, 2x, 3x duration cycle within a 2-hour window
                const remainderMs = ageInMs % dueIntervalMs;
                const isCycleTrigger = dueIntervalCycles >= 1 && remainderMs < (2 * ONE_HOUR_MS);

                if (isCycleTrigger) {
                    const paid = order.payments.filter((p: any) => p.status === "SUCCESS" || !p.status).reduce((sum: number, p: any) => sum + Number(p.amount), 0);
                    const dueAmount = Math.max(0, Number(order.totalAmount) - paid);

                    if (dueAmount > 0) {
                        const templateName = dueConfig?.templateId || "due_payment_reminder";
                        const lockedPayLink = `${origin}/pay?userid=${user.id}&number=${user.phone}&billid=${order.id}&lockAmount=true`;

                        logger.info(`[Payment Reminder Worker] Dispatching due reminder to customer ${user.name} (${user.phone}) for order ${order.id} (Due: ₹${dueAmount})`);
                        await sendTemplateViaChatHub(user.phone, templateName, {
                            body: [
                                user.name || "Customer",
                                String(dueAmount),
                                order.id,
                                lockedPayLink
                            ]
                        }).catch((err: any) => {
                            logger.error(`[Payment Reminder Worker] Error sending to ${user.phone}: ${err.message}`);
                        });
                    }
                }
            }

            // ─── 3. 7-DAY (OR CONFIGURABLE) INACTIVITY REMINDERS ───
            const inactiveDurationValue = inactiveConfig?.triggerDurationValue || 7;
            const inactiveDurationUnit = inactiveConfig?.triggerDurationUnit || "DAYS";
            const inactiveIntervalMs = inactiveDurationUnit === "HOURS" ? inactiveDurationValue * ONE_HOUR_MS : inactiveDurationValue * ONE_DAY_MS;
            const inactivityThresholdDate = new Date(now.getTime() - inactiveIntervalMs);

            // Find users who have orders, but whose latest order is older than threshold
            const customersWithHistory = await prisma.user.findMany({
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
                if (!customer.phone) continue;
                const lastOrder = customer.orders[0];
                if (!lastOrder) continue;

                const lastOrderDate = new Date(lastOrder.createdAt);
                const inactiveMs = now.getTime() - lastOrderDate.getTime();
                const daysInactive = Math.floor(inactiveMs / ONE_DAY_MS);

                // Check if customer just crossed the inactivity threshold today (within 2 hours window)
                if (inactiveMs >= inactiveIntervalMs && (inactiveMs - inactiveIntervalMs) < (2 * ONE_HOUR_MS)) {
                    const templateName = inactiveConfig?.templateId || "customer_inactive_reminder";
                    const storeLink = `${origin}`;
                    const storeName = "Book My Veg";

                    logger.info(`[Retention Worker] Dispatching ${daysInactive}-day inactivity reminder to customer ${customer.name} (${customer.phone})`);
                    await sendTemplateViaChatHub(customer.phone, templateName, {
                        body: [
                            customer.name || "Valued Customer",
                            storeName,
                            String(daysInactive),
                            storeLink
                        ]
                    }).catch((err: any) => {
                        logger.error(`[Retention Worker] Inactivity send failure for ${customer.phone}: ${err.message}`);
                    });
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
