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

export const REMINDER_CLAIM_LEASE_MS = 15 * 60 * 1000; // 15 minutes lease

export interface ReminderClaimOptions {
    cooldownMs: number;
    leaseMs?: number;
    totalDue: number;
    orderCount: number;
    invoiceLabel: string;
    trigger?: string;
}

export interface ReminderClaimResult {
    claimed: boolean;
    reason?: "COOLDOWN_ACTIVE" | "ACTIVE_CLAIM_IN_PROGRESS" | "DB_ERROR";
    claimId?: string;
}

/**
 * Database-backed atomic claim to prevent duplicate WhatsApp reminders across
 * concurrent worker runs and multi-replica server instances.
 */
export const claimCustomerReminder = async (
    customerId: string,
    options: ReminderClaimOptions
): Promise<ReminderClaimResult> => {
    const leaseMs = options.leaseMs || REMINDER_CLAIM_LEASE_MS;
    const now = new Date();

    try {
        return await prisma.$transaction(async (tx) => {
            // In PostgreSQL, row lock the User record to serialize concurrent replica workers
            try {
                await (tx as any).$queryRaw`SELECT id FROM "User" WHERE id = ${customerId} FOR UPDATE`;
            } catch (_) {
                // Non-blocking fallback if $queryRaw FOR UPDATE is unsupported (e.g. SQLite / mock tests)
            }

            // 1. Check completed reminders within the cooldown window
            const recentReminder = await (tx.auditLog.findFirst as any)({
                where: {
                    entityType: "USER",
                    entityId: customerId,
                    action: "WHATSAPP_DUE_REMINDER",
                    createdAt: { gte: new Date(now.getTime() - options.cooldownMs) }
                },
                orderBy: { createdAt: "desc" }
            });

            if (recentReminder) {
                return { claimed: false, reason: "COOLDOWN_ACTIVE" };
            }

            // 2. Check active claims within the lease window
            const recentClaim = await (tx.auditLog.findFirst as any)({
                where: {
                    entityType: "USER",
                    entityId: customerId,
                    action: "WHATSAPP_DUE_REMINDER_CLAIM",
                    createdAt: { gte: new Date(now.getTime() - leaseMs) }
                },
                orderBy: { createdAt: "desc" }
            });

            if (recentClaim) {
                const claimData = recentClaim.newValue as any;
                // If claim is still in progress (CLAIMED) within the lease window, block concurrent claim
                if (claimData?.status === "CLAIMED") {
                    return { claimed: false, reason: "ACTIVE_CLAIM_IN_PROGRESS" };
                }
            }

            // 3. Also check if a claim was already completed within the cooldown
            const completedClaim = await (tx.auditLog.findFirst as any)({
                where: {
                    entityType: "USER",
                    entityId: customerId,
                    action: "WHATSAPP_DUE_REMINDER_CLAIM",
                    createdAt: { gte: new Date(now.getTime() - options.cooldownMs) }
                },
                orderBy: { createdAt: "desc" }
            });

            if (completedClaim) {
                const val = completedClaim.newValue as any;
                if (val?.status === "COMPLETED") {
                    return { claimed: false, reason: "COOLDOWN_ACTIVE" };
                }
            }

            // 4. Atomically create the CLAIM record BEFORE attempting WhatsApp dispatch
            const claim = await (tx.auditLog.create as any)({
                data: {
                    entityType: "USER",
                    entityId: customerId,
                    action: "WHATSAPP_DUE_REMINDER_CLAIM",
                    newValue: {
                        status: "CLAIMED",
                        trigger: options.trigger || "AUTOMATIC_WORKER",
                        totalDue: options.totalDue,
                        orderCount: options.orderCount,
                        invoiceLabel: options.invoiceLabel,
                        claimedAt: now,
                        leaseExpiresAt: new Date(now.getTime() + leaseMs)
                    }
                }
            });

            return { claimed: true, claimId: claim.id };
        });
    } catch (e: any) {
        logger.error(`[claimCustomerReminder] Error claiming reminder for customer ${customerId}:`, e);
        return { claimed: false, reason: "DB_ERROR" };
    }
};

/**
 * Finalizes an atomic reminder claim: records provider acceptance and message ID
 * upon success, or marks the claim as FAILED to release the lease on failure.
 */
export const finalizeCustomerReminderClaim = async (
    customerId: string,
    claimId: string,
    result: {
        success: boolean;
        providerStatus?: string;
        providerMessageId?: string | null;
        totalDue: number;
        orderCount: number;
        invoiceLabel: string;
        trigger?: string;
        error?: string;
    }
) => {
    const now = new Date();
    try {
        if (result.success) {
            // Record completed reminder in AuditLog for cooldown enforcement
            await (prisma.auditLog.create as any)({
                data: {
                    entityType: "USER",
                    entityId: customerId,
                    action: "WHATSAPP_DUE_REMINDER",
                    newValue: {
                        status: "ACCEPTED",
                        providerStatus: result.providerStatus || "ACCEPTED_BY_PROVIDER",
                        providerMessageId: result.providerMessageId || null,
                        totalDue: result.totalDue,
                        orderCount: result.orderCount,
                        invoiceLabel: result.invoiceLabel,
                        trigger: result.trigger || "AUTOMATIC_WORKER",
                        claimId,
                        sentAt: now
                    }
                }
            });

            // Mark claim record as COMPLETED
            await (prisma.auditLog.update as any)({
                where: { id: claimId },
                data: {
                    newValue: {
                        status: "COMPLETED",
                        providerMessageId: result.providerMessageId || null,
                        completedAt: now
                    }
                }
            }).catch(() => null);
        } else {
            // Update claim record as FAILED so lease is immediately released
            await (prisma.auditLog.update as any)({
                where: { id: claimId },
                data: {
                    newValue: {
                        status: "FAILED",
                        error: result.error || "Provider rejected or network failed",
                        failedAt: now
                    }
                }
            }).catch(() => null);
        }
    } catch (err: any) {
        logger.error(`[finalizeCustomerReminderClaim] Error finalizing claim ${claimId} for customer ${customerId}:`, err);
    }
};

let isReminderWorkerRunning = false;

export const getIsReminderWorkerRunning = () => isReminderWorkerRunning;

export const startPaymentReminderWorker = () => {
    logger.info("[Payment & Retention Reminder Worker] Daemon initialized.");

    const runRemindersAndFeedbackCheck = async () => {
        if (isReminderWorkerRunning) {
            logger.warn("[Payment Reminder Worker] Previous worker cycle still executing. Skipping overlapping run to prevent duplicates.");
            return;
        }

        isReminderWorkerRunning = true;
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

                        // Cooldown: at least dueIntervalMs, with minimum 24 hours to prevent multiple messages on the same day
                        const cooldownMs = Math.max(dueIntervalMs, ONE_DAY_MS);
                        const orderCount = summary.eligibleOrdersCount;
                        const latestOrder = summary.eligibleOrders[0];
                        const invoiceLabel = orderCount > 1 
                            ? `All Dues (${orderCount} Bills)` 
                            : latestOrder.id;

                        // ─── ATOMIC DATABASE CLAIM (MULTI-REPLICA IDEMPOTENCY) ───────────────
                        // Atomically claims customer in database BEFORE WhatsApp dispatch
                        const claimResult = await claimCustomerReminder(customer.id, {
                            cooldownMs,
                            totalDue: summary.totalDue,
                            orderCount,
                            invoiceLabel,
                            trigger: "AUTOMATIC_WORKER"
                        });

                        if (!claimResult.claimed || !claimResult.claimId) {
                            logger.info(`[Payment Reminder Worker] Skipping customer ${customer.name || customer.id} (${customer.phone}): ${claimResult.reason}`);
                            return;
                        }

                        logger.info(`[Payment Reminder Worker] Claim acquired (${claimResult.claimId}). Dispatching due reminder to ${customer.name} (${customer.phone}) - Total Due: ₹${summary.totalDueFormatted} [${invoiceLabel}]`);

                        // ─── DISPATCH REMINDER & FINALIZE CLAIM ──────────────────────────────
                        try {
                            const sendResult: any = await sendPaymentReminderViaWhatsapp(
                                customer.phone,
                                customer.name || "Customer",
                                summary.totalDue,
                                invoiceLabel,
                                customer.id,
                                latestOrder.id
                            );

                            const providerMessageId = sendResult?.messageId || sendResult?.id || sendResult?.message_id || null;
                            const isAccepted = sendResult?.dispatchStatus === "ACCEPTED_BY_PROVIDER" || sendResult?.success !== false;

                            await finalizeCustomerReminderClaim(customer.id, claimResult.claimId, {
                                success: isAccepted,
                                providerStatus: sendResult?.dispatchStatus || "ACCEPTED_BY_PROVIDER",
                                providerMessageId,
                                totalDue: summary.totalDue,
                                orderCount,
                                invoiceLabel,
                                trigger: "AUTOMATIC_WORKER"
                            });
                        } catch (err: any) {
                            logger.error(`[Payment Reminder Worker] Error sending automatic reminder to ${customer.phone}: ${err.message}`);
                            await finalizeCustomerReminderClaim(customer.id, claimResult.claimId, {
                                success: false,
                                error: err.message,
                                totalDue: summary.totalDue,
                                orderCount,
                                invoiceLabel,
                                trigger: "AUTOMATIC_WORKER"
                            });
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
        } finally {
            isReminderWorkerRunning = false;
        }
    };

    // Run first check after 15 seconds, and then check every hour
    setTimeout(runRemindersAndFeedbackCheck, 15000);
    setInterval(runRemindersAndFeedbackCheck, ONE_HOUR_MS);
};
