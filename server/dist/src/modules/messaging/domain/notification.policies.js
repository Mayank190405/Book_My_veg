"use strict";
/**
 * Book My Veg — Notification Domain Policies
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTOMATED_DUES_REMINDERS_ENABLED = exports.STRICT_UTILITY_POLICY_ACTIVE = exports.REJECTED_TEMPLATES = exports.APPROVED_UTILITY_TEMPLATES = exports.REMINDER_CLAIM_LEASE_MS = exports.UNIVERSAL_REMINDER_COOLDOWN_MS = void 0;
exports.UNIVERSAL_REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000; // Strict 24 hours
exports.REMINDER_CLAIM_LEASE_MS = 15 * 60 * 1000; // 15 minutes lease
exports.APPROVED_UTILITY_TEMPLATES = new Set([
    "bill_created", // UTILITY: Invoice Generated (Paid, Due, Cancelled)
    "payment_due_reminder", // UTILITY: Bill Due Reminder
    "feedback_request_support_", // UTILITY: Feedback on Recent Purchase
    "order_management_4", // UTILITY: Order Placed & Processing
    "order_update_notification", // UTILITY: Produce Out for Delivery
    "login" // AUTHENTICATION: OTP verification
]);
exports.REJECTED_TEMPLATES = new Set([
    "onboarding" // REJECTED by Meta (Incorrect category) - must never be sent
]);
exports.STRICT_UTILITY_POLICY_ACTIVE = true;
exports.AUTOMATED_DUES_REMINDERS_ENABLED = false;
