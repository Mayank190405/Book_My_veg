/**
 * Book My Veg — Universal Cooldown Policy
 * Strict 24-hour reminder cooldown enforcement across all channels and callers.
 */

import { NotificationRepository } from "../infrastructure/repositories/notification.repository";
import { UNIVERSAL_REMINDER_COOLDOWN_MS } from "../domain/notification.policies";

export class CooldownPolicy {
    public static async checkCustomerReminderCooldown(
        customerId: string,
        cooldownMs: number = UNIVERSAL_REMINDER_COOLDOWN_MS
    ): Promise<{ allowed: boolean; remainingMs?: number; lastSentAt?: Date }> {
        const repo = NotificationRepository.getInstance();
        const check = await repo.getRecentReminderAudit(customerId, cooldownMs);

        if (check.exists) {
            return {
                allowed: false,
                remainingMs: check.remainingCooldownMs,
                lastSentAt: check.lastSentAt
            };
        }

        return { allowed: true };
    }
}

