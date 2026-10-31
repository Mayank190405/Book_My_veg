"use strict";
/**
 * Book My Veg — Universal Cooldown Policy
 * Strict 24-hour reminder cooldown enforcement across all channels and callers.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CooldownPolicy = void 0;
const notification_repository_1 = require("../infrastructure/repositories/notification.repository");
const notification_policies_1 = require("../domain/notification.policies");
class CooldownPolicy {
    static checkCustomerReminderCooldown(customerId_1) {
        return __awaiter(this, arguments, void 0, function* (customerId, cooldownMs = notification_policies_1.UNIVERSAL_REMINDER_COOLDOWN_MS) {
            const repo = notification_repository_1.NotificationRepository.getInstance();
            const check = yield repo.getRecentReminderAudit(customerId, cooldownMs);
            if (check.exists) {
                return {
                    allowed: false,
                    remainingMs: check.remainingCooldownMs,
                    lastSentAt: check.lastSentAt
                };
            }
            return { allowed: true };
        });
    }
}
exports.CooldownPolicy = CooldownPolicy;
