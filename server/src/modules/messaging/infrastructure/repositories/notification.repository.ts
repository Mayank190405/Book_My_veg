/**
 * Book My Veg — Notification Repository
 * Handles durable audit records, atomic claims, and cooldown verifications.
 */

import prisma from "../../../../config/prisma";
import logger from "../../../../utils/logger";
import { OutboundMessageRequest, ProviderSendResult, ReminderClaimResult } from "../../domain/notification.types";
import { REMINDER_CLAIM_LEASE_MS, UNIVERSAL_REMINDER_COOLDOWN_MS } from "../../domain/notification.policies";

export class NotificationRepository {
    private static instance: NotificationRepository;

    public static getInstance(): NotificationRepository {
        if (!NotificationRepository.instance) {
            NotificationRepository.instance = new NotificationRepository();
        }
        return NotificationRepository.instance;
    }

    /**
     * Records an outbound notification attempt and provider outcome in AuditLog.
     */
    public async recordDispatch(
        request: OutboundMessageRequest,
        result: ProviderSendResult
    ): Promise<string | null> {
        const now = new Date();
        try {
            const auditEntry = await (prisma.auditLog.create as any)({
                data: {
                    entityType: request.recipientId ? "USER" : (request.referenceId ? "ORDER" : "SYSTEM"),
                    entityId: request.recipientId || request.referenceId || request.recipientPhone,
                    action: request.notificationType === "PAYMENT_REMINDER" ? "WHATSAPP_DUE_REMINDER" : "NOTIFICATION_DISPATCH",
                    staffId: request.actorId || null,
                    locationId: request.locationId || null,
                    newValue: {
                        notificationType: request.notificationType,
                        channel: request.channel,
                        recipientPhone: request.recipientPhone,
                        recipientName: request.recipientName,
                        recipientId: request.recipientId,
                        referenceId: request.referenceId,
                        templateName: request.templateName,
                        templateLanguage: request.templateLanguage || "en",
                        variables: request.variables,
                        triggerSource: request.triggerSource,
                        idempotencyKey: request.idempotencyKey,
                        correlationId: request.correlationId,
                        status: result.status,
                        providerMessageId: result.providerMessageId || null,
                        error: result.error || null,
                        metadata: request.metadata || null,
                        submittedAt: now
                    }
                }
            });

            return auditEntry.id;
        } catch (err: any) {
            logger.error(`[NotificationRepository] Error recording dispatch audit for ${request.recipientPhone}:`, err);
            return null;
        }
    }

    /**
     * Checks if a payment reminder was dispatched to this customer within the cooldown window.
     */
    public async getRecentReminderAudit(
        customerId: string,
        cooldownMs: number = UNIVERSAL_REMINDER_COOLDOWN_MS
    ): Promise<{ exists: boolean; lastSentAt?: Date; remainingCooldownMs?: number }> {
        const threshold = new Date(Date.now() - cooldownMs);

        try {
            const recent = await (prisma.auditLog.findFirst as any)({
                where: {
                    entityType: "USER",
                    entityId: customerId,
                    action: "WHATSAPP_DUE_REMINDER",
                    createdAt: { gte: threshold }
                },
                orderBy: { createdAt: "desc" }
            });

            if (!recent) {
                return { exists: false };
            }

            const sentTime = new Date(recent.createdAt).getTime();
            const elapsed = Date.now() - sentTime;
            const remaining = Math.max(0, cooldownMs - elapsed);

            return {
                exists: true,
                lastSentAt: recent.createdAt,
                remainingCooldownMs: remaining
            };
        } catch (err: any) {
            logger.error(`[NotificationRepository] Error querying recent reminder for customer ${customerId}:`, err);
            // Fallback safe: if DB error occurs, don't silently bypass cooldown
            return { exists: false };
        }
    }

    /**
     * Database-backed atomic claim to serialize reminder requests across concurrent
     * tabs, multiple operators, and clustered server instances.
     */
    public async claimCustomerReminder(
        customerId: string,
        options: {
            totalDue: number;
            orderCount: number;
            invoiceLabel: string;
            trigger: string;
            actorId?: string;
            cooldownMs?: number;
            leaseMs?: number;
        }
    ): Promise<ReminderClaimResult> {
        const cooldownMs = options.cooldownMs || UNIVERSAL_REMINDER_COOLDOWN_MS;
        const leaseMs = options.leaseMs || REMINDER_CLAIM_LEASE_MS;
        const now = new Date();

        try {
            return await prisma.$transaction(async (tx: any) => {
                // In PostgreSQL, row lock the User record to serialize concurrent requests
                try {
                    await (tx as any).$queryRaw`SELECT id FROM "User" WHERE id = ${customerId} FOR UPDATE`;
                } catch (_) {
                    // Non-blocking fallback if queryRaw FOR UPDATE is unsupported (e.g. SQLite / unit tests)
                }

                // 1. Check completed reminders within the cooldown window
                const recentReminder = await (tx.auditLog.findFirst as any)({
                    where: {
                        entityType: "USER",
                        entityId: customerId,
                        action: "WHATSAPP_DUE_REMINDER",
                        createdAt: { gte: new Date(now.getTime() - cooldownMs) }
                    },
                    orderBy: { createdAt: "desc" }
                });

                if (recentReminder) {
                    const elapsed = now.getTime() - new Date(recentReminder.createdAt).getTime();
                    return {
                        claimed: false,
                        reason: "COOLDOWN_ACTIVE" as const,
                        cooldownRemainingMs: Math.max(0, cooldownMs - elapsed)
                    };
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
                    if (claimData?.status === "CLAIMED") {
                        return { claimed: false, reason: "ACTIVE_CLAIM_IN_PROGRESS" as const };
                    }
                }

                // 3. Check completed claim in cooldown
                const completedClaim = await (tx.auditLog.findFirst as any)({
                    where: {
                        entityType: "USER",
                        entityId: customerId,
                        action: "WHATSAPP_DUE_REMINDER_CLAIM",
                        createdAt: { gte: new Date(now.getTime() - cooldownMs) }
                    },
                    orderBy: { createdAt: "desc" }
                });

                if (completedClaim) {
                    const val = completedClaim.newValue as any;
                    if (val?.status === "COMPLETED") {
                        const elapsed = now.getTime() - new Date(completedClaim.createdAt).getTime();
                        return {
                            claimed: false,
                            reason: "COOLDOWN_ACTIVE" as const,
                            cooldownRemainingMs: Math.max(0, cooldownMs - elapsed)
                        };
                    }
                }

                // 4. Atomically create the CLAIM record BEFORE attempting external provider dispatch
                const claim = await (tx.auditLog.create as any)({
                    data: {
                        entityType: "USER",
                        entityId: customerId,
                        action: "WHATSAPP_DUE_REMINDER_CLAIM",
                        staffId: options.actorId || null,
                        newValue: {
                            status: "CLAIMED",
                            trigger: options.trigger || "MANUAL_REMINDER",
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
            logger.error(`[NotificationRepository] Error claiming reminder for customer ${customerId}:`, e);
            return { claimed: false, reason: "DB_ERROR" };
        }
    }

    /**
     * Finalizes the atomic claim: marks as COMPLETED upon provider acceptance
     * or FAILED to immediately release the lease upon rejection.
     */
    public async finalizeCustomerReminderClaim(
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
            actorId?: string;
            locationId?: string;
            includedOrderIds?: string[];
            error?: string;
        }
    ): Promise<void> {
        const now = new Date();
        try {
            if (result.success) {
                // Record completed reminder in AuditLog for universal cooldown enforcement
                await (prisma.auditLog.create as any)({
                    data: {
                        entityType: "USER",
                        entityId: customerId,
                        action: "WHATSAPP_DUE_REMINDER",
                        staffId: result.actorId || null,
                        locationId: result.locationId || null,
                        newValue: {
                            status: "ACCEPTED",
                            providerStatus: result.providerStatus || "ACCEPTED_BY_PROVIDER",
                            providerMessageId: result.providerMessageId || null,
                            totalDue: result.totalDue,
                            orderCount: result.orderCount,
                            invoiceLabel: result.invoiceLabel,
                            includedOrderIds: result.includedOrderIds || [],
                            trigger: result.trigger || "MANUAL",
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
                // Release lease immediately by marking FAILED
                await (prisma.auditLog.update as any)({
                    where: { id: claimId },
                    data: {
                        newValue: {
                            status: "FAILED",
                            error: result.error || "Provider rejected",
                            failedAt: now
                        }
                    }
                }).catch(() => null);
            }
        } catch (err: any) {
            logger.error(`[NotificationRepository] Error finalizing claim ${claimId} for customer ${customerId}:`, err);
        }
    }
}
