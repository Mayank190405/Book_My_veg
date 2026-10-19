import prisma from "../config/prisma";
import logger from "../utils/logger";
import { 
    sendTemplateViaChatHub, 
    sendFeedbackRequestViaWhatsapp, 
    sendPaymentReminderViaWhatsapp,
    APPROVED_UTILITY_TEMPLATES 
} from "./mbgcard";
import { processCustomersWithDuesInBatches } from "./dueCalculationService";

const ONE_HOUR_MS = 60 * 60 * 1000;
const THREE_HOURS_MS = 3 * ONE_HOUR_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const FOUR_DAYS_MS = 4 * ONE_DAY_MS;

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

            // ─── 1. DELAYED FEEDBACK REQUESTS (3 HOURS POST ORDER / DELIVERY) ───
            // Strictly sent ONLY ONCE per customer across their entire lifetime (never on every order)
            const eligibleOrders: any[] = await (prisma.order.findMany as any)({
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

            const processedUserIdsInBatch = new Set<string>();

            for (const order of eligibleOrders) {
                const user = order.user;
                if (!user || !user.phone) {
                    await prisma.order.update({
                        where: { id: order.id },
                        data: { feedbackSent: true }
                    });
                    continue;
                }

                // If this user was already processed in this batch, mark order and skip
                if (processedUserIdsInBatch.has(user.id)) {
                    await prisma.order.update({
                        where: { id: order.id },
                        data: { feedbackSent: true }
                    });
                    continue;
                }

                // Strictly enforce: ONCE PER CUSTOMER LIFETIME
                // Check if this customer has ever received a feedback message or already provided a rating/feedback
                const existingFeedbackRecord = await prisma.order.findFirst({
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
                    await prisma.order.updateMany({
                        where: { userId: user.id, feedbackSent: false },
                        data: { feedbackSent: true }
                    });
                    logger.info(`[Feedback Worker] Customer ${user.phone} (${user.name || "Customer"}) already received a feedback prompt or reviewed order ${existingFeedbackRecord.id}. Skipping order ${order.id}.`);
                    continue;
                }

                const statusHistoryItem = order.statusHistory?.[0];
                const completedAt = statusHistoryItem ? new Date(statusHistoryItem.createdAt) : new Date(order.updatedAt || order.createdAt);
                const elapsedMs = now.getTime() - completedAt.getTime();

                if (elapsedMs >= THREE_HOURS_MS) {
                    logger.info(`[Feedback Worker] Dispatching ONE-TIME 3-hour post-order feedback request to ${user.name} (${user.phone}) for first-time order ${order.id}`);
                    try {
                        await sendFeedbackRequestViaWhatsapp(user.phone, user.name || "Customer", order.id);
                        processedUserIdsInBatch.add(user.id);
                        
                        // Mark ALL orders of this customer as feedbackSent: true to guarantee they are never messaged again
                        await prisma.order.updateMany({
                            where: { userId: user.id },
                            data: { feedbackSent: true }
                        });
                    } catch (err: any) {
                        logger.error(`[Feedback Worker] Failed to send feedback request to ${user.phone}: ${err.message}`);
                    }
                }
            }

            // ─── 2. AUTOMATIC DUES PAYMENT REMINDERS (With Locked Payment Link) ───
            // Target duration from config or default (7 days)
            const dueDurationValue = dueConfig?.triggerDurationValue || 7;
            const dueDurationUnit = dueConfig?.triggerDurationUnit || "DAYS";
            const dueIntervalMs = dueDurationUnit === "HOURS" ? dueDurationValue * ONE_HOUR_MS : dueDurationValue * ONE_DAY_MS;

            // Restrict automatic reminders to daytime (10:00 AM to 8:00 PM IST) to avoid disturbed night-time messages
            const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
            const istHour = istTime.getUTCHours();
            const isBusinessHours = istHour >= 10 && istHour < 20;

            if (isBusinessHours) {
                // Process all active customers with dues using deterministic cursor-based pagination
                // Eliminates arbitrary query limits (e.g. take: 200) and ensures complete coverage
                await processCustomersWithDuesInBatches({
                    batchSize: 100,
                    handler: async ({ customer, summary }) => {
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
                        const lastReminderAudit = await (prisma.auditLog.findFirst as any)({
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

                        logger.info(`[Payment Reminder Worker] Dispatching automatic due reminder to customer ${customer.name} (${customer.phone}) - Total Due: ₹${summary.totalDueFormatted} [${invoiceLabel}]`);

                        try {
                            await sendPaymentReminderViaWhatsapp(
                                customer.phone,
                                customer.name || "Customer",
                                summary.totalDue,
                                invoiceLabel,
                                customer.id,
                                latestOrder.id
                            );

                            // Record AuditLog to prevent duplicate reminders within cooldown
                            await (prisma.auditLog.create as any)({
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
                        } catch (err: any) {
                            logger.error(`[Payment Reminder Worker] Error sending automatic reminder to ${customer.phone}: ${err.message}`);
                        }
                    }
                });
            } else {
                logger.info(`[Payment Reminder Worker] Outside business hours (${istHour}:00 IST). Skipping automated dues reminder check.`);
            }

            // ─── 3. 4-DAY INACTIVITY REMINDER (TEMPLATE: fresh_order) ───
            // Triggers when customer has not visited/ordered in 4 days
            const inactiveDurationValue = inactiveConfig?.triggerDurationValue || 4;
            const inactiveDurationUnit = inactiveConfig?.triggerDurationUnit || "DAYS";
            const inactiveIntervalMs = inactiveDurationUnit === "HOURS" 
                ? inactiveDurationValue * ONE_HOUR_MS 
                : (inactiveDurationValue === 4 ? FOUR_DAYS_MS : inactiveDurationValue * ONE_DAY_MS);

            // Find customers who have past orders, whose latest order is older than 4 days
            const customersWithHistory = await prisma.user.findMany({
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
                if (!customer.phone) continue;
                const lastOrder = customer.orders[0];
                if (!lastOrder) continue;

                const lastOrderDate = new Date(lastOrder.createdAt);
                const inactiveMs = now.getTime() - lastOrderDate.getTime();
                const daysInactive = Math.floor(inactiveMs / ONE_DAY_MS);

                // If customer has been inactive for >= 4 days
                if (inactiveMs >= inactiveIntervalMs) {
                    // Check if an inactivity reminder has already been sent for this cycle (since latest order)
                    const existingReminderAudit = await (prisma.auditLog.findFirst as any)({
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

                    const templateName = inactiveConfig?.templateId || "fresh_order";
                    if (!APPROVED_UTILITY_TEMPLATES.has(templateName)) {
                        logger.info(`[Retention Worker] Inactivity reminder skipped for ${customer.phone}: template '${templateName}' is non-utility. Strict utility policy active.`);
                        continue;
                    }

                    logger.info(`[Retention Worker] Dispatching 4-day inactivity reminder (${templateName}) to customer ${customer.name} (${customer.phone}) - inactive for ${daysInactive} days`);

                    try {
                        await sendTemplateViaChatHub(customer.phone, templateName, {
                            body: [origin]
                        });

                        // Record audit log to ensure message is only sent once per inactivity cycle
                        await (prisma.auditLog.create as any)({
                            data: {
                                entityType: "USER",
                                entityId: customer.id,
                                action: "WHATSAPP_4DAY_INACTIVE_REMINDER",
                                newValue: { daysInactive, template: templateName, sentAt: now }
                            }
                        });
                    } catch (err: any) {
                        logger.error(`[Retention Worker] Inactivity send failure for ${customer.phone}: ${err.message}`);
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
