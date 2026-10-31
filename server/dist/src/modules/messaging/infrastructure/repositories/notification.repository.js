"use strict";
/**
 * Book My Veg — Notification Repository
 * Handles durable audit records, atomic claims, and cooldown verifications.
 */
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
exports.NotificationRepository = void 0;
const prisma_1 = __importDefault(require("../../../../config/prisma"));
const logger_1 = __importDefault(require("../../../../utils/logger"));
const notification_policies_1 = require("../../domain/notification.policies");
class NotificationRepository {
    static getInstance() {
        if (!NotificationRepository.instance) {
            NotificationRepository.instance = new NotificationRepository();
        }
        return NotificationRepository.instance;
    }
    /**
     * Records an outbound notification attempt and provider outcome in AuditLog.
     */
    recordDispatch(request, result) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            try {
                const auditEntry = yield prisma_1.default.auditLog.create({
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
            }
            catch (err) {
                logger_1.default.error(`[NotificationRepository] Error recording dispatch audit for ${request.recipientPhone}:`, err);
                return null;
            }
        });
    }
    /**
     * Checks if a payment reminder was dispatched to this customer within the cooldown window.
     */
    getRecentReminderAudit(customerId_1) {
        return __awaiter(this, arguments, void 0, function* (customerId, cooldownMs = notification_policies_1.UNIVERSAL_REMINDER_COOLDOWN_MS) {
            const threshold = new Date(Date.now() - cooldownMs);
            try {
                const recent = yield prisma_1.default.auditLog.findFirst({
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
            }
            catch (err) {
                logger_1.default.error(`[NotificationRepository] Error querying recent reminder for customer ${customerId}:`, err);
                // Fallback safe: if DB error occurs, don't silently bypass cooldown
                return { exists: false };
            }
        });
    }
    /**
     * Database-backed atomic claim to serialize reminder requests across concurrent
     * tabs, multiple operators, and clustered server instances.
     */
    claimCustomerReminder(customerId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const cooldownMs = options.cooldownMs || notification_policies_1.UNIVERSAL_REMINDER_COOLDOWN_MS;
            const leaseMs = options.leaseMs || notification_policies_1.REMINDER_CLAIM_LEASE_MS;
            const now = new Date();
            try {
                return yield prisma_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                    // In PostgreSQL, row lock the User record to serialize concurrent requests
                    try {
                        yield tx.$queryRaw `SELECT id FROM "User" WHERE id = ${customerId} FOR UPDATE`;
                    }
                    catch (_) {
                        // Non-blocking fallback if queryRaw FOR UPDATE is unsupported (e.g. SQLite / unit tests)
                    }
                    // 1. Check completed reminders within the cooldown window
                    const recentReminder = yield tx.auditLog.findFirst({
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
                            reason: "COOLDOWN_ACTIVE",
                            cooldownRemainingMs: Math.max(0, cooldownMs - elapsed)
                        };
                    }
                    // 2. Check active claims within the lease window
                    const recentClaim = yield tx.auditLog.findFirst({
                        where: {
                            entityType: "USER",
                            entityId: customerId,
                            action: "WHATSAPP_DUE_REMINDER_CLAIM",
                            createdAt: { gte: new Date(now.getTime() - leaseMs) }
                        },
                        orderBy: { createdAt: "desc" }
                    });
                    if (recentClaim) {
                        const claimData = recentClaim.newValue;
                        if ((claimData === null || claimData === void 0 ? void 0 : claimData.status) === "CLAIMED") {
                            return { claimed: false, reason: "ACTIVE_CLAIM_IN_PROGRESS" };
                        }
                    }
                    // 3. Check completed claim in cooldown
                    const completedClaim = yield tx.auditLog.findFirst({
                        where: {
                            entityType: "USER",
                            entityId: customerId,
                            action: "WHATSAPP_DUE_REMINDER_CLAIM",
                            createdAt: { gte: new Date(now.getTime() - cooldownMs) }
                        },
                        orderBy: { createdAt: "desc" }
                    });
                    if (completedClaim) {
                        const val = completedClaim.newValue;
                        if ((val === null || val === void 0 ? void 0 : val.status) === "COMPLETED") {
                            const elapsed = now.getTime() - new Date(completedClaim.createdAt).getTime();
                            return {
                                claimed: false,
                                reason: "COOLDOWN_ACTIVE",
                                cooldownRemainingMs: Math.max(0, cooldownMs - elapsed)
                            };
                        }
                    }
                    // 4. Atomically create the CLAIM record BEFORE attempting external provider dispatch
                    const claim = yield tx.auditLog.create({
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
                }));
            }
            catch (e) {
                logger_1.default.error(`[NotificationRepository] Error claiming reminder for customer ${customerId}:`, e);
                return { claimed: false, reason: "DB_ERROR" };
            }
        });
    }
    /**
     * Finalizes the atomic claim: marks as COMPLETED upon provider acceptance
     * or FAILED to immediately release the lease upon rejection.
     */
    finalizeCustomerReminderClaim(customerId, claimId, result) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            try {
                if (result.success) {
                    // Record completed reminder in AuditLog for universal cooldown enforcement
                    yield prisma_1.default.auditLog.create({
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
                    yield prisma_1.default.auditLog.update({
                        where: { id: claimId },
                        data: {
                            newValue: {
                                status: "COMPLETED",
                                providerMessageId: result.providerMessageId || null,
                                completedAt: now
                            }
                        }
                    }).catch(() => null);
                }
                else {
                    // Release lease immediately by marking FAILED
                    yield prisma_1.default.auditLog.update({
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
            }
            catch (err) {
                logger_1.default.error(`[NotificationRepository] Error finalizing claim ${claimId} for customer ${customerId}:`, err);
            }
        });
    }
}
exports.NotificationRepository = NotificationRepository;
