"use strict";
/**
 * Book My Veg — Channel & Utility Policy
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelPolicy = void 0;
const notification_policies_1 = require("../domain/notification.policies");
class ChannelPolicy {
    static isTemplatePermitted(templateName) {
        if (notification_policies_1.REJECTED_TEMPLATES.has(templateName)) {
            return {
                permitted: false,
                reason: `Template '${templateName}' is rejected by Meta and cannot be dispatched.`
            };
        }
        if (notification_policies_1.STRICT_UTILITY_POLICY_ACTIVE && !notification_policies_1.APPROVED_UTILITY_TEMPLATES.has(templateName)) {
            return {
                permitted: false,
                reason: `Template '${templateName}' blocked: strict utility policy requires Meta-approved utility templates.`
            };
        }
        return { permitted: true };
    }
}
exports.ChannelPolicy = ChannelPolicy;
