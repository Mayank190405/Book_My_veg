/**
 * Book My Veg — Messaging Authorization Policy
 */

export const ALLOWED_REMINDER_ROLES = new Set(["ADMIN", "SUPER_ADMIN", "STORE_ADMIN", "POS_OPERATOR"]);
export const ALLOWED_CUSTOM_TEMPLATE_ROLES = new Set(["ADMIN", "SUPER_ADMIN", "STORE_ADMIN"]);
export const ALLOWED_FLOW_ROLES = new Set(["ADMIN", "SUPER_ADMIN"]);

export class AuthorizationPolicy {
    public static canSendPaymentReminder(role?: string): boolean {
        return !!role && ALLOWED_REMINDER_ROLES.has(role);
    }

    public static canSendCustomTemplate(role?: string): boolean {
        return !!role && ALLOWED_CUSTOM_TEMPLATE_ROLES.has(role);
    }

    public static canSendChatHubFlow(role?: string): boolean {
        return !!role && ALLOWED_FLOW_ROLES.has(role);
    }

    public static isAuthorized(role: string | undefined, action: string): boolean {
        switch (action) {
            case "SEND_PAYMENT_REMINDER":
                return this.canSendPaymentReminder(role);
            case "SEND_CUSTOM_TEMPLATE":
                return this.canSendCustomTemplate(role);
            case "SEND_FLOW":
                return this.canSendChatHubFlow(role);
            default:
                return false;
        }
    }
}

