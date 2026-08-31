"use strict";
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
exports.sendRegistrationThankYouViaWhatsapp = exports.sendOrderStatusUpdateViaWhatsapp = exports.sendPaymentReceivedViaWhatsapp = exports.sendPaymentReminderViaWhatsapp = exports.sendInvoiceDueViaWhatsapp = exports.sendInvoicePaidViaWhatsapp = exports.sendFeedbackRequestViaWhatsapp = exports.sendTemplateViaChatHub = exports.sendOrderConfirmationViaWhatsapp = exports.getConversation = exports.getMyMetaTemplates = exports.sendFlowViaChatHub = exports.sendOtpViaWhatsapp = void 0;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const MBGCARD_API_URL = process.env.MBGCARD_API_URL || "https://chatbot.digitalmbg.com/v1/whatsapp/send_templet";
const MBGCARD_API_TOKEN = process.env.MBGCARD_API_TOKEN || "91edd77281c02b04c4bdfb36aa5e4978";
const MBGCARD_TEMPLATE_ID = process.env.MBGCARD_TEMPLATE_ID || "login";
const MBGCARD_OTP_FLOW_ID = process.env.MBGCARD_OTP_FLOW_ID || "flow_1782732506015";
const MBGCARD_SENDER_NUMBER = process.env.MBGCARD_SENDER_NUMBER || "917879431560";
const MBGCARD_CHAT_ID = process.env.MBGCARD_CHAT_ID || "1070587";
const MAX_RETRIES = 3;
const INITIAL_BACKOFF = 1000; // 1 second
const sendOtpViaWhatsapp = (phone, otp) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // Format recipient phone number: remove any non-digits, and prepend country code '91' if missing
    const cleanPhone = phone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;
    const payload = {
        templateName: MBGCARD_TEMPLATE_ID, // defaults to "login"
        senderId: formattedPhone,
        to: formattedPhone,
        variables: {
            header: [],
            body: [otp]
        }
    };
    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`Sending OTP via MBG Card Template API (Attempt ${attempt}/${MAX_RETRIES}):`, {
                url: MBGCARD_API_URL,
                templateName: payload.templateName,
                to: payload.to,
                variables: payload.variables
            });
            const response = yield axios_1.default.post(MBGCARD_API_URL, payload, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json',
                    'accept': '*/*',
                    'x-api-key': MBGCARD_API_TOKEN,
                    'User-Agent': 'BookMyVeg-Server/1.0'
                }
            });
            console.log("MBG Card OTP Response:", response.data);
            return response.data;
        }
        catch (error) {
            lastError = error;
            const isNetworkError = ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED'].includes(error.code);
            if (isNetworkError && attempt < MAX_RETRIES) {
                const backoff = INITIAL_BACKOFF * Math.pow(2, attempt - 1);
                console.warn(`MBG Card OTP failed (${error.code}). Retrying in ${backoff}ms...`);
                yield new Promise(resolve => setTimeout(resolve, backoff));
                continue;
            }
            console.error("Error sending OTP via MBG Card Template API:", {
                code: error.code,
                message: error.message,
                response: (_a = error.response) === null || _a === void 0 ? void 0 : _a.data
            });
            break;
        }
    }
    throw new Error(`Failed to send OTP via Template API after ${MAX_RETRIES} attempts. Last error: ${lastError === null || lastError === void 0 ? void 0 : lastError.message}`);
});
exports.sendOtpViaWhatsapp = sendOtpViaWhatsapp;
/**
 * Generic helper to send a flow via ChatHub.
 */
const sendFlowViaChatHub = (phone, flowId, name, customFields) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const cleanPhone = phone.replace(/\D/g, "");
    const formattedPhone = `+${cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`}`;
    const actions = [];
    if (customFields) {
        for (const [key, value] of Object.entries(customFields)) {
            actions.push({
                action: "set_field_value",
                field_name: key,
                value: value
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
    const url = process.env.MBGCARD_FLOW_URL || "https://chatbot.digitalmbg.com/v1/contacts/send_flow";
    try {
        console.log(`[ChatHub Flow] Sending flow ${flowId} to ${formattedPhone} with custom fields:`, customFields);
        if (!MBGCARD_API_TOKEN) {
            console.log(`[ChatHub Flow] Mock flow sent to ${formattedPhone} (no token configured).`);
            return { success: true, mock: true };
        }
        const response = yield axios_1.default.post(url, payload, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': MBGCARD_API_TOKEN,
                'User-Agent': 'BookMyVeg-Server/1.0'
            }
        });
        console.log("[ChatHub Flow] Response:", response.data);
        return response.data;
    }
    catch (error) {
        console.error("Error sending flow via ChatHub:", {
            message: error.message,
            response: (_a = error.response) === null || _a === void 0 ? void 0 : _a.data
        });
        throw error;
    }
});
exports.sendFlowViaChatHub = sendFlowViaChatHub;
/**
 * Fetch approved WhatsApp templates from MBG Card.
 */
const getMyMetaTemplates = () => __awaiter(void 0, void 0, void 0, function* () {
    const url = process.env.MBGCARD_TEMPLATES_URL || "https://chatbot.digitalmbg.com/v1/whatsapp/get_my_meta_templets";
    try {
        console.log(`Fetching Meta templates from MBG Card (${url})...`);
        const response = yield axios_1.default.get(url, {
            headers: {
                'accept': 'application/json',
                'Content-Type': 'application/json',
                'x-api-key': MBGCARD_API_TOKEN,
                'User-Agent': 'BookMyVeg-Server/1.0'
            },
            timeout: 8000
        });
        return response.data;
    }
    catch (error) {
        console.warn("MBG Card Meta templates fetch notice:", error.message);
        return { success: false, data: [] };
    }
});
exports.getMyMetaTemplates = getMyMetaTemplates;
/**
 * Fallback conversation query. Left in place for backward compatibility, returns null as MBG Card has no conversation endpoint.
 */
const getConversation = (phone) => __awaiter(void 0, void 0, void 0, function* () {
    console.warn("[MBG Card] getConversation is deprecated and not supported by the MBG Card API.");
    return null;
});
exports.getConversation = getConversation;
const sendOrderConfirmationViaWhatsapp = (phone, customerName, orderId, amount) => __awaiter(void 0, void 0, void 0, function* () {
    return (0, exports.sendTemplateViaChatHub)(phone, "order_confirmation", {
        body: [customerName, orderId, String(amount)]
    });
});
exports.sendOrderConfirmationViaWhatsapp = sendOrderConfirmationViaWhatsapp;
/**
 * Generic helper to send a WhatsApp template via ChatHub.
 */
const sendTemplateViaChatHub = (phone, templateName, variables, dynamicMedia) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const cleanPhone = phone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;
    const payload = {
        templateName,
        senderId: formattedPhone,
        to: formattedPhone,
        variables: {
            header: (variables === null || variables === void 0 ? void 0 : variables.header) || [],
            body: (variables === null || variables === void 0 ? void 0 : variables.body) || []
        },
        dynamicMedia
    };
    const url = MBGCARD_API_URL;
    try {
        console.log(`[ChatHub Template] Sending template ${templateName} to ${formattedPhone} via ${url}`);
        const response = yield axios_1.default.post(url, payload, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'accept': '*/*',
                'x-api-key': MBGCARD_API_TOKEN,
                'User-Agent': 'BookMyVeg-Server/1.0'
            }
        });
        console.log("[ChatHub Template] Response:", response.data);
        return response.data;
    }
    catch (error) {
        console.error("Error sending template via ChatHub:", {
            message: error.message,
            response: (_a = error.response) === null || _a === void 0 ? void 0 : _a.data
        });
        throw error;
    }
});
exports.sendTemplateViaChatHub = sendTemplateViaChatHub;
const sendFeedbackRequestViaWhatsapp = (phone, customerName, orderId) => __awaiter(void 0, void 0, void 0, function* () {
    const origin = process.env.CLIENT_URL || "https://bookmyveg.co.in";
    const feedbackLink = `${origin}/feedback?orderId=${orderId}`;
    return (0, exports.sendTemplateViaChatHub)(phone, "feedback_request", {
        body: [customerName, feedbackLink]
    });
});
exports.sendFeedbackRequestViaWhatsapp = sendFeedbackRequestViaWhatsapp;
const sendInvoicePaidViaWhatsapp = (phone, customerName, invoiceNo, totalAmount, paymentMode, orderId) => __awaiter(void 0, void 0, void 0, function* () {
    const origin = process.env.CLIENT_URL || "https://bookmyveg.co.in";
    const invoicePdfLink = `${origin}/invoice/${orderId}`;
    return (0, exports.sendTemplateViaChatHub)(phone, "bill_created", {
        body: [customerName, invoiceNo, String(totalAmount), paymentMode, invoicePdfLink]
    });
});
exports.sendInvoicePaidViaWhatsapp = sendInvoicePaidViaWhatsapp;
const sendInvoiceDueViaWhatsapp = (phone, customerName, invoiceNo, totalAmount, paymentMode, dueAmount, userId, orderId) => __awaiter(void 0, void 0, void 0, function* () {
    const origin = process.env.CLIENT_URL || "https://bookmyveg.co.in";
    const invoicePdfLink = `${origin}/invoice/${orderId}`;
    const publicPayLink = `${origin}/pay?userid=${userId}&number=${phone}&billid=${orderId}&amount=${dueAmount}&lockAmount=true`;
    return (0, exports.sendTemplateViaChatHub)(phone, "bill_created_due", {
        body: [customerName, invoiceNo, String(totalAmount), String(dueAmount), invoicePdfLink, publicPayLink]
    });
});
exports.sendInvoiceDueViaWhatsapp = sendInvoiceDueViaWhatsapp;
const sendPaymentReminderViaWhatsapp = (phone, customerName, dueAmount, invoiceNo, userId, orderId) => __awaiter(void 0, void 0, void 0, function* () {
    const origin = process.env.CLIENT_URL || "https://bookmyveg.co.in";
    const publicPayLink = `${origin}/pay?userid=${userId}&number=${phone}&billid=${orderId}&amount=${dueAmount}&lockAmount=true`;
    return (0, exports.sendTemplateViaChatHub)(phone, "due_payment_reminder", {
        body: [customerName, String(dueAmount), invoiceNo, publicPayLink]
    });
});
exports.sendPaymentReminderViaWhatsapp = sendPaymentReminderViaWhatsapp;
const sendPaymentReceivedViaWhatsapp = (phone, customerName, invoiceNo, paidAmount, paymentMode) => __awaiter(void 0, void 0, void 0, function* () {
    return (0, exports.sendTemplateViaChatHub)(phone, "payment_received", {
        body: [customerName, invoiceNo, String(paidAmount), paymentMode]
    });
});
exports.sendPaymentReceivedViaWhatsapp = sendPaymentReceivedViaWhatsapp;
const sendOrderStatusUpdateViaWhatsapp = (phone, customerName, orderId, statusName) => __awaiter(void 0, void 0, void 0, function* () {
    return (0, exports.sendTemplateViaChatHub)(phone, "order_status_update", {
        body: [statusName, orderId, customerName]
    });
});
exports.sendOrderStatusUpdateViaWhatsapp = sendOrderStatusUpdateViaWhatsapp;
const sendRegistrationThankYouViaWhatsapp = (phone, customerName) => __awaiter(void 0, void 0, void 0, function* () {
    return (0, exports.sendTemplateViaChatHub)(phone, "registration_thank_you", {
        body: [customerName]
    });
});
exports.sendRegistrationThankYouViaWhatsapp = sendRegistrationThankYouViaWhatsapp;
