/**
 * Book My Veg — Template Management & Custom Dispatch Service
 */

import { TemplateRegistry } from "../templates/template-registry";
import { NotificationDispatcherService } from "./notification-dispatcher.service";
import { ProviderSendResult, TemplateDefinition } from "../domain/notification.types";
import { RecipientService } from "./recipient.service";

export class TemplateService {
    private static instance: TemplateService;
    private registry: TemplateRegistry;
    private dispatcher: NotificationDispatcherService;

    private constructor() {
        this.registry = TemplateRegistry.getInstance();
        this.dispatcher = NotificationDispatcherService.getInstance();
    }

    public static getInstance(): TemplateService {
        if (!TemplateService.instance) {
            TemplateService.instance = new TemplateService();
        }
        return TemplateService.instance;
    }

    /**
     * Synchronizes live templates from provider into registry and returns complete catalog.
     */
    public async syncAndGetTemplates(): Promise<TemplateDefinition[]> {
        const provider = this.dispatcher.getProvider();
        try {
            const live = await provider.fetchTemplates();
            for (const tpl of live) {
                this.registry.registerOrUpdateTemplate(tpl);
            }
        } catch (_) {
            // Non-blocking: fallback to static verified templates in registry
        }
        return this.registry.getAllTemplates();
    }

    /**
     * Dispatches a custom template message with strict parameter validation and durable audit logging.
     */
    public async sendCustomTemplate(options: {
        phone: string;
        templateName: string;
        variables?: { header?: string[]; body?: string[] } | string[];
        dynamicMedia?: string;
        actorId?: string;
        triggerSource?: string;
    }): Promise<ProviderSendResult> {
        const { phone, templateName, dynamicMedia, actorId, triggerSource = "ADMIN_CUSTOM" } = options;
        const cleanPhone = RecipientService.sanitizePhone(phone);

        // Normalize variables structure
        let structuredVars: { header?: string[]; body?: string[] } = {};
        if (Array.isArray(options.variables)) {
            structuredVars = { body: options.variables.map(v => String(v ?? "")) };
        } else if (options.variables) {
            structuredVars = {
                header: options.variables.header?.map(v => String(v ?? "")) || [],
                body: options.variables.body?.map(v => String(v ?? "")) || []
            };
        }

        return await this.dispatcher.dispatch({
            notificationType: "CUSTOM_TEMPLATE",
            channel: "WHATSAPP",
            recipientPhone: cleanPhone,
            templateName,
            variables: structuredVars,
            dynamicMedia,
            triggerSource,
            actorId
        });
    }
}

