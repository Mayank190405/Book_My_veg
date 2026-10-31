"use strict";
/**
 * Book My Veg — Messaging Authorization Policy
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthorizationPolicy = exports.ALLOWED_FLOW_ROLES = exports.ALLOWED_CUSTOM_TEMPLATE_ROLES = exports.ALLOWED_REMINDER_ROLES = void 0;
exports.ALLOWED_REMINDER_ROLES = new Set(["ADMIN", "SUPER_ADMIN", "STORE_ADMIN", "POS_OPERATOR"]);
exports.ALLOWED_CUSTOM_TEMPLATE_ROLES = new Set(["ADMIN", "SUPER_ADMIN", "STORE_ADMIN"]);
exports.ALLOWED_FLOW_ROLES = new Set(["ADMIN", "SUPER_ADMIN"]);
class AuthorizationPolicy {
    static canSendPaymentReminder(role) {
        return !!role && exports.ALLOWED_REMINDER_ROLES.has(role);
    }
    static canSendCustomTemplate(role) {
        return !!role && exports.ALLOWED_CUSTOM_TEMPLATE_ROLES.has(role);
    }
    static canSendChatHubFlow(role) {
        return !!role && exports.ALLOWED_FLOW_ROLES.has(role);
    }
    static isAuthorized(role, action) {
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
exports.AuthorizationPolicy = AuthorizationPolicy;
