"use strict";
/**
 * Book My Veg — Template Validator
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateValidator = void 0;
const template_registry_1 = require("./template-registry");
const notification_policies_1 = require("../domain/notification.policies");
class TemplateValidator {
    /**
     * Validates and sanitizes variables for Meta WhatsApp Cloud API compliance.
     * Prevents newline-rejections (#100 Invalid parameter), enforces variable count,
     * and strictly blocks non-approved/rejected templates.
     */
    static validateAndSanitize(templateName, variables) {
        // 1. Check if template is explicitly rejected (e.g. 'onboarding')
        if (notification_policies_1.REJECTED_TEMPLATES.has(templateName)) {
            return {
                valid: false,
                blocked: true,
                error: `Template '${templateName}' is REJECTED by Meta and cannot be sent.`
            };
        }
        // 2. Strict Utility Policy enforcement
        if (notification_policies_1.STRICT_UTILITY_POLICY_ACTIVE && !notification_policies_1.APPROVED_UTILITY_TEMPLATES.has(templateName)) {
            return {
                valid: false,
                blocked: true,
                error: `Template '${templateName}' is blocked: strict utility policy permits only approved utility templates.`
            };
        }
        const registry = template_registry_1.TemplateRegistry.getInstance();
        const definition = registry.getTemplate(templateName);
        // Sanitize body variables (strip illegal newlines, trim, enforce strings)
        const rawBody = (variables === null || variables === void 0 ? void 0 : variables.body) || [];
        const sanitizedBody = rawBody.map((v) => {
            const str = String(v !== null && v !== void 0 ? v : "").trim();
            // Meta WhatsApp API rejects parameters containing newlines (\n or \r)
            return str.replace(/[\r\n]+/g, " ");
        });
        const rawHeader = (variables === null || variables === void 0 ? void 0 : variables.header) || [];
        const sanitizedHeader = rawHeader.map((v) => {
            const str = String(v !== null && v !== void 0 ? v : "").trim();
            return str.replace(/[\r\n]+/g, " ");
        });
        // If template is known in registry, verify variable count
        if (definition && definition.variableCount !== undefined) {
            if (sanitizedBody.length < definition.variableCount) {
                return {
                    valid: false,
                    error: `Template '${templateName}' requires ${definition.variableCount} body variables, but received ${sanitizedBody.length}.`
                };
            }
        }
        return {
            valid: true,
            sanitizedVariables: {
                header: sanitizedHeader,
                body: sanitizedBody
            }
        };
    }
    static sanitizeParameters(params) {
        return params.map(v => String(v !== null && v !== void 0 ? v : "").trim().replace(/[\r\n]+/g, " "));
    }
    static validate(templateName, variables) {
        return this.validateAndSanitize(templateName, variables);
    }
}
exports.TemplateValidator = TemplateValidator;
