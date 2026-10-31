/**
 * Book My Veg — WhatsApp Provider Interface
 */

import { OutboundMessageRequest, ProviderSendResult, TemplateDefinition } from "../../domain/notification.types";

export interface IWhatsAppProvider {
    sendTemplate(request: OutboundMessageRequest): Promise<ProviderSendResult>;
    fetchTemplates(): Promise<TemplateDefinition[]>;
    sendFlow?(
        phone: string,
        flowId: string,
        name?: string,
        customFields?: Record<string, string>
    ): Promise<ProviderSendResult>;
}

