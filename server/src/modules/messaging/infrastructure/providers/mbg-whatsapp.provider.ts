/**
 * Book My Veg — MBG Card / DigitalMBG WhatsApp Provider Adapter
 */

import axios from "axios";
import { IWhatsAppProvider } from "./whatsapp-provider.interface";
import { OutboundMessageRequest, ProviderSendResult, TemplateDefinition } from "../../domain/notification.types";
import logger from "../../../../utils/logger";

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const DEFAULT_MBGCARD_API_TOKEN = "d423777128fdc8a29bef4fb719f3d3c9";

export class MbgWhatsAppProvider implements IWhatsAppProvider {
    private readonly apiUrl: string;
    private readonly templatesUrl: string;
    private readonly flowUrl: string;
    private readonly apiToken: string;

    constructor() {
        this.apiUrl = process.env.MBGCARD_API_URL || "https://chatbotbe.digitalmbg.com/api/whatsapp/send_meta_templet";
        this.templatesUrl = process.env.MBGCARD_TEMPLATES_URL || "https://chatbotbe.digitalmbg.com/api/whatsapp/get_my_meta_templets";
        this.flowUrl = process.env.MBGCARD_FLOW_URL || "https://chatbot.digitalmbg.com/v1/contacts/send_flow";
        this.apiToken = process.env.MBGCARD_API_TOKEN || DEFAULT_MBGCARD_API_TOKEN;
    }

    /**
     * Formats phone number into standard 91XXXXXXXXXX format for Meta WhatsApp API.
     */
    public formatPhone(rawPhone: string): string {
        const clean = rawPhone.replace(/\D/g, "");
        if (clean.length === 10) {
            return `91${clean}`;
        }
        if (clean.startsWith("91")) {
            return clean;
        }
        return `91${clean}`;
    }

    /**
     * Submits a WhatsApp template message to the MBG Card / Meta Cloud API proxy.
     */
    public async sendTemplate(request: OutboundMessageRequest): Promise<ProviderSendResult> {
        const formattedPhone = this.formatPhone(request.recipientPhone);

        const payload: any = {
            templateName: request.templateName,
            to: formattedPhone,
            variables: {
                body: request.variables?.body || []
            }
        };

        if (request.variables?.header && request.variables.header.length > 0) {
            payload.variables.header = request.variables.header;
        }

        if (request.dynamicMedia) {
            payload.dynamicMedia = request.dynamicMedia;
        }

        // Failsafe if token is missing
        if (!this.apiToken) {
            logger.error(`[MbgWhatsAppProvider] Missing MBGCARD_API_TOKEN. Cannot dispatch '${request.templateName}' to ${formattedPhone}.`);
            return {
                success: false,
                status: "FAILED",
                error: "MBGCARD_API_TOKEN is not configured"
            };
        }

        let lastError: any;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                logger.info(`[MbgWhatsAppProvider] Submitting template '${request.templateName}' to ${formattedPhone} (Attempt ${attempt}/${MAX_RETRIES})`);

                const response = await axios.post(this.apiUrl, payload, {
                    timeout: 10000,
                    headers: {
                        "Content-Type": "application/json",
                        "accept": "*/*",
                        "x-api-key": this.apiToken,
                        "User-Agent": "BookMyVeg-MessagingService/2.0"
                    }
                });

                const data = response.data;
                const messageId = data?.messageId || data?.id || data?.data?.messageId || null;

                logger.info(`[MbgWhatsAppProvider] Template '${request.templateName}' accepted by provider for ${formattedPhone}. MessageId: ${messageId}`);

                return {
                    success: true,
                    status: "ACCEPTED_BY_PROVIDER",
                    providerMessageId: messageId,
                    rawResponse: data
                };
            } catch (error: any) {
                lastError = error;
                const statusCode = error.response?.status;
                const isNetworkError = ["ECONNRESET", "ETIMEDOUT", "ECONNABORTED"].includes(error.code);

                // Do not retry client validation errors (4xx)
                if (statusCode && statusCode >= 400 && statusCode < 500) {
                    logger.error(`[MbgWhatsAppProvider] Client error (${statusCode}) sending template '${request.templateName}':`, error.response?.data || error.message);
                    return {
                        success: false,
                        status: "FAILED",
                        error: error.response?.data?.message || error.message,
                        rawResponse: error.response?.data
                    };
                }

                // Retry on transient network errors
                if (isNetworkError && attempt < MAX_RETRIES) {
                    const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
                    logger.warn(`[MbgWhatsAppProvider] Network error (${error.code}). Retrying in ${backoff}ms...`);
                    await new Promise((resolve) => setTimeout(resolve, backoff));
                    continue;
                }

                break;
            }
        }

        const errDetail = lastError?.response?.data || lastError?.message || "Unknown provider error";
        logger.error(`[MbgWhatsAppProvider] Final failure sending template '${request.templateName}' to ${formattedPhone}:`, errDetail);

        return {
            success: false,
            status: "FAILED",
            error: String(lastError?.message || errDetail),
            rawResponse: lastError?.response?.data
        };
    }

    /**
     * Fetches live approved templates from the MBG Card / Meta Cloud API.
     */
    public async fetchTemplates(): Promise<TemplateDefinition[]> {
        if (!this.apiToken) {
            return [];
        }

        try {
            const response = await axios.get(this.templatesUrl, {
                headers: {
                    "accept": "application/json",
                    "Content-Type": "application/json",
                    "x-api-key": this.apiToken,
                    "User-Agent": "BookMyVeg-MessagingService/2.0"
                },
                timeout: 10000
            });

            const data = response.data;
            const rawList: any[] = Array.isArray(data)
                ? data
                : (data?.data && Array.isArray(data.data) ? data.data : (data?.templates || []));

            return rawList.map((t: any) => {
                const bodyComp = t.components?.find((c: any) => c.type === "BODY");
                const headerComp = t.components?.find((c: any) => c.type === "HEADER");
                const bodyText = bodyComp?.text || t.body || t.content || "";
                const matches = bodyText.match(/{{\d+}}/g);
                const variableCount = matches ? matches.length : 0;

                return {
                    id: String(t.id),
                    name: t.name || t.templateName,
                    status: t.status || "APPROVED",
                    category: t.category || "UTILITY",
                    language: t.language || "en",
                    variableCount,
                    bodyText,
                    headerText: headerComp?.text || null,
                    buttons: t.components?.find((c: any) => c.type === "BUTTONS")?.buttons || [],
                    raw: t
                };
            });
        } catch (error: any) {
            logger.warn(`[MbgWhatsAppProvider] Failed to fetch live templates: ${error.message}`);
            return [];
        }
    }

    /**
     * Dispatches an interactive chatbot flow via ChatHub.
     */
    public async sendFlow(
        phone: string,
        flowId: string,
        name?: string,
        customFields?: Record<string, string>
    ): Promise<ProviderSendResult> {
        const cleanPhone = phone.replace(/\D/g, "");
        const formattedPhone = `+${cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`}`;

        const actions: any[] = [];
        if (customFields) {
            for (const [key, value] of Object.entries(customFields)) {
                actions.push({
                    action: "set_field_value",
                    field_name: key,
                    value: String(value)
                });
            }
        }
        actions.push({
            action: "send_flow",
            flow_id: flowId
        });

        const payload = {
            senderId: formattedPhone,
            name: name || "Customer",
            actions
        };

        if (!this.apiToken) {
            logger.error(`[MbgWhatsAppProvider] Missing MBGCARD_API_TOKEN. Cannot dispatch flow to ${formattedPhone}.`);
            return {
                success: false,
                status: "FAILED",
                error: "MBGCARD_API_TOKEN is not configured"
            };
        }

        try {
            const response = await axios.post(this.flowUrl, payload, {
                timeout: 10000,
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": this.apiToken,
                    "User-Agent": "BookMyVeg-MessagingService/2.0"
                }
            });

            return {
                success: true,
                status: "ACCEPTED_BY_PROVIDER",
                providerMessageId: response.data?.messageId || null,
                rawResponse: response.data
            };
        } catch (error: any) {
            logger.error("[MbgWhatsAppProvider] Flow dispatch error:", error.response?.data || error.message);
            return {
                success: false,
                status: "FAILED",
                error: error.message,
                rawResponse: error.response?.data
            };
        }
    }
}
