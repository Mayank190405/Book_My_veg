/**
 * Book My Veg — Notification Domain Policies
 */

export const UNIVERSAL_REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000; // Strict 24 hours
export const REMINDER_CLAIM_LEASE_MS = 15 * 60 * 1000; // 15 minutes lease

export const APPROVED_UTILITY_TEMPLATES = new Set<string>([
    "bill_created",              // UTILITY: Invoice Generated (Paid, Due, Cancelled)
    "payment_due_reminder",     // UTILITY: Bill Due Reminder
    "feedback_request_support_", // UTILITY: Feedback on Recent Purchase
    "order_management_4",       // UTILITY: Order Placed & Processing
    "order_update_notification",// UTILITY: Produce Out for Delivery
    "login"                     // AUTHENTICATION: OTP verification
]);

export const REJECTED_TEMPLATES = new Set<string>([
    "onboarding" // REJECTED by Meta (Incorrect category) - must never be sent
]);

export const STRICT_UTILITY_POLICY_ACTIVE = true;
export const AUTOMATED_DUES_REMINDERS_ENABLED = false;

