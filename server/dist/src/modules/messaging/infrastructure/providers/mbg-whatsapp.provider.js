"use strict";
/**
 * Book My Veg — MBG Card / DigitalMBG WhatsApp Provider Adapter
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MbgWhatsAppProvider = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = __importDefault(require("../../../../utils/logger"));
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
class MbgWhatsAppProvider {
    constructor() {
        this.apiUrl = process.env.MBGCARD_API_URL || "https://chatbotbe.digitalmbg.com/api/whatsapp/send_meta_templet";
        this.templatesUrl = process.env.MBGCARD_TEMPLATES_URL || "https://chatbotbe.digitalmbg.com/api/whatsapp/get_my_meta_templets";
        this.flowUrl = process.env.MBGCARD_FLOW_URL || "https://chatbot.digitalmbg.com/v1/contacts/send_flow";
        this.apiToken = process.env.MBGCARD_API_TOKEN || "";
        if (!this.apiToken && process.env.NODE_ENV === "production") {
            logger_1.default.error("[MbgWhatsAppProvider] MBGCARD_API_TOKEN is not configured in environment!");
        }
    }
    /**
     * Formats phone number into standard 91XXXXXXXXXX format for Meta WhatsApp API.
     */
    formatPhone(rawPhone) {
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
    sendTemplate(request) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            const formattedPhone = this.formatPhone(request.recipientPhone);
            const payload = {
                templateName: request.templateName,
                to: formattedPhone,
                variables: {
                    body: ((_a = request.variables) === null || _a === void 0 ? void 0 : _a.body) || []
                }
            };
            if (((_b = request.variables) === null || _b === void 0 ? void 0 : _b.header) && request.variables.header.length > 0) {
                payload.variables.header = request.variables.header;
            }
            if (request.dynamicMedia) {
                payload.dynamicMedia = request.dynamicMedia;
            }
            // Sandbox / Test fallback if no token
            if (!this.apiToken) {
                logger_1.default.warn(`[MbgWhatsAppProvider] Mock dispatch for ${request.templateName} to ${formattedPhone} (No token configured).`);
                return {
                    success: true,
                    status: "ACCEPTED_BY_PROVIDER",
                    providerMessageId: `mock-msg-${Date.now()}`,
                    rawResponse: { mock: true }
                };
            }
            let lastError;
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                try {
                    logger_1.default.info(`[MbgWhatsAppProvider] Submitting template '${request.templateName}' to ${formattedPhone} (Attempt ${attempt}/${MAX_RETRIES})`);
                    const response = yield axios_1.default.post(this.apiUrl, payload, {
                        timeout: 10000,
                        headers: {
                            "Content-Type": "application/json",
                            "accept": "*/*",
                            "x-api-key": this.apiToken,
                            "User-Agent": "BookMyVeg-MessagingService/2.0"
                        }
                    });
                    const data = response.data;
                    const messageId = (data === null || data === void 0 ? void 0 : data.messageId) || (data === null || data === void 0 ? void 0 : data.id) || ((_c = data === null || data === void 0 ? void 0 : data.data) === null || _c === void 0 ? void 0 : _c.messageId) || null;
                    logger_1.default.info(`[MbgWhatsAppProvider] Template '${request.templateName}' accepted by provider for ${formattedPhone}. MessageId: ${messageId}`);
                    return {
                        success: true,
                        status: "ACCEPTED_BY_PROVIDER",
                        providerMessageId: messageId,
                        rawResponse: data
                    };
                }
                catch (error) {
                    lastError = error;
                    const statusCode = (_d = error.response) === null || _d === void 0 ? void 0 : _d.status;
                    const isNetworkError = ["ECONNRESET", "ETIMEDOUT", "ECONNABORTED"].includes(error.code);
                    // Do not retry client validation errors (4xx)
                    if (statusCode && statusCode >= 400 && statusCode < 500) {
                        logger_1.default.error(`[MbgWhatsAppProvider] Client error (${statusCode}) sending template '${request.templateName}':`, ((_e = error.response) === null || _e === void 0 ? void 0 : _e.data) || error.message);
                        return {
                            success: false,
                            status: "FAILED",
                            error: ((_g = (_f = error.response) === null || _f === void 0 ? void 0 : _f.data) === null || _g === void 0 ? void 0 : _g.message) || error.message,
                            rawResponse: (_h = error.response) === null || _h === void 0 ? void 0 : _h.data
                        };
                    }
                    // Retry on transient network errors
                    if (isNetworkError && attempt < MAX_RETRIES) {
                        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
                        logger_1.default.warn(`[MbgWhatsAppProvider] Network error (${error.code}). Retrying in ${backoff}ms...`);
                        yield new Promise((resolve) => setTimeout(resolve, backoff));
                        continue;
                    }
                    break;
                }
            }
            const errDetail = ((_j = lastError === null || lastError === void 0 ? void 0 : lastError.response) === null || _j === void 0 ? void 0 : _j.data) || (lastError === null || lastError === void 0 ? void 0 : lastError.message) || "Unknown provider error";
            logger_1.default.error(`[MbgWhatsAppProvider] Final failure sending template '${request.templateName}' to ${formattedPhone}:`, errDetail);
            return {
                success: false,
                status: "FAILED",
                error: String((lastError === null || lastError === void 0 ? void 0 : lastError.message) || errDetail),
                rawResponse: (_k = lastError === null || lastError === void 0 ? void 0 : lastError.response) === null || _k === void 0 ? void 0 : _k.data
            };
        });
    }
    /**
     * Fetches live approved templates from the MBG Card / Meta Cloud API.
     */
    fetchTemplates() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.apiToken) {
                return [];
            }
            try {
                const response = yield axios_1.default.get(this.templatesUrl, {
                    headers: {
                        "accept": "application/json",
                        "Content-Type": "application/json",
                        "x-api-key": this.apiToken,
                        "User-Agent": "BookMyVeg-MessagingService/2.0"
                    },
                    timeout: 10000
                });
                const data = response.data;
                const rawList = Array.isArray(data)
                    ? data
                    : ((data === null || data === void 0 ? void 0 : data.data) && Array.isArray(data.data) ? data.data : ((data === null || data === void 0 ? void 0 : data.templates) || []));
                return rawList.map((t) => {
                    var _a, _b, _c, _d;
                    const bodyComp = (_a = t.components) === null || _a === void 0 ? void 0 : _a.find((c) => c.type === "BODY");
                    const headerComp = (_b = t.components) === null || _b === void 0 ? void 0 : _b.find((c) => c.type === "HEADER");
                    const bodyText = (bodyComp === null || bodyComp === void 0 ? void 0 : bodyComp.text) || t.body || t.content || "";
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
                        headerText: (headerComp === null || headerComp === void 0 ? void 0 : headerComp.text) || null,
                        buttons: ((_d = (_c = t.components) === null || _c === void 0 ? void 0 : _c.find((c) => c.type === "BUTTONS")) === null || _d === void 0 ? void 0 : _d.buttons) || [],
                        raw: t
                    };
                });
            }
            catch (error) {
                logger_1.default.warn(`[MbgWhatsAppProvider] Failed to fetch live templates: ${error.message}`);
                return [];
            }
        });
    }
    /**
     * Dispatches an interactive chatbot flow via ChatHub.
     */
    sendFlow(phone, flowId, name, customFields) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const cleanPhone = phone.replace(/\D/g, "");
            const formattedPhone = `+${cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`}`;
            const actions = [];
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
                logger_1.default.info(`[MbgWhatsAppProvider] Mock flow dispatched to ${formattedPhone} (No token).`);
                return {
                    success: true,
                    status: "ACCEPTED_BY_PROVIDER",
                    providerMessageId: `mock-flow-${Date.now()}`
                };
            }
            try {
                const response = yield axios_1.default.post(this.flowUrl, payload, {
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
                    providerMessageId: ((_a = response.data) === null || _a === void 0 ? void 0 : _a.messageId) || null,
                    rawResponse: response.data
                };
            }
            catch (error) {
                logger_1.default.error("[MbgWhatsAppProvider] Flow dispatch error:", ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
                return {
                    success: false,
                    status: "FAILED",
                    error: error.message,
                    rawResponse: (_c = error.response) === null || _c === void 0 ? void 0 : _c.data
                };
            }
        });
    }
}
exports.MbgWhatsAppProvider = MbgWhatsAppProvider;
