/**
 * Book My Veg — Template Validator
 */

import { TemplateRegistry } from "./template-registry";
import { APPROVED_UTILITY_TEMPLATES, REJECTED_TEMPLATES, STRICT_UTILITY_POLICY_ACTIVE } from "../domain/notification.policies";

export interface ValidationResult {
    valid: boolean;
    sanitizedVariables?: {
        header?: string[];
        body?: string[];
    };
    error?: string;
    blocked?: boolean;
}

export class TemplateValidator {
    /**
     * Validates and sanitizes variables for Meta WhatsApp Cloud API compliance.
     * Prevents newline-rejections (#100 Invalid parameter), enforces variable count,
     * and strictly blocks non-approved/rejected templates.
     */
    public static validateAndSanitize(
        templateName: string,
        variables?: { header?: string[]; body?: string[] }
    ): ValidationResult {
        // 1. Check if template is explicitly rejected (e.g. 'onboarding')
        if (REJECTED_TEMPLATES.has(templateName)) {
            return {
                valid: false,
                blocked: true,
                error: `Template '${templateName}' is REJECTED by Meta and cannot be sent.`
            };
        }

        // 2. Strict Utility Policy enforcement
        if (STRICT_UTILITY_POLICY_ACTIVE && !APPROVED_UTILITY_TEMPLATES.has(templateName)) {
            return {
                valid: false,
                blocked: true,
                error: `Template '${templateName}' is blocked: strict utility policy permits only approved utility templates.`
            };
        }

        const registry = TemplateRegistry.getInstance();
        const definition = registry.getTemplate(templateName);

        // Sanitize body variables (strip illegal newlines, trim, enforce strings)
        const rawBody = variables?.body || [];
        const sanitizedBody: string[] = rawBody.map((v) => {
            const str = String(v ?? "").trim();
            // Meta WhatsApp API rejects parameters containing newlines (\n or \r)
            return str.replace(/[\r\n]+/g, " ");
        });

        const rawHeader = variables?.header || [];
        const sanitizedHeader: string[] = rawHeader.map((v) => {
            const str = String(v ?? "").trim();
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

    public static sanitizeParameters(params: (string | number)[]): string[] {
        return params.map(v => String(v ?? "").trim().replace(/[\r\n]+/g, " "));
    }

    public static validate(
        templateName: string,
        variables?: { header?: string[]; body?: string[] }
    ): ValidationResult {
        return this.validateAndSanitize(templateName, variables);
    }
}

