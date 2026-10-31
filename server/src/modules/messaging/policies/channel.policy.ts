/**
 * Book My Veg — Channel & Utility Policy
 */

import { APPROVED_UTILITY_TEMPLATES, REJECTED_TEMPLATES, STRICT_UTILITY_POLICY_ACTIVE } from "../domain/notification.policies";

export class ChannelPolicy {
    public static isTemplatePermitted(templateName: string): { permitted: boolean; reason?: string } {
        if (REJECTED_TEMPLATES.has(templateName)) {
            return {
                permitted: false,
                reason: `Template '${templateName}' is rejected by Meta and cannot be dispatched.`
            };
        }

        if (STRICT_UTILITY_POLICY_ACTIVE && !APPROVED_UTILITY_TEMPLATES.has(templateName)) {
            return {
                permitted: false,
                reason: `Template '${templateName}' blocked: strict utility policy requires Meta-approved utility templates.`
            };
        }

        return { permitted: true };
    }
}

