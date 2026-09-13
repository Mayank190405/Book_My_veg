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
exports.sendRegistrationThankYouViaWhatsapp = exports.sendInactiveCustomerReminderViaWhatsapp = exports.sendBillCancelledViaWhatsapp = exports.sendOrderStatusUpdateViaWhatsapp = exports.sendPaymentReceivedViaWhatsapp = exports.sendPaymentReminderViaWhatsapp = exports.sendInvoiceDueViaWhatsapp = exports.sendInvoicePaidViaWhatsapp = exports.sendFeedbackRequestViaWhatsapp = exports.sendTemplateViaChatHub = exports.sendOrderConfirmationViaWhatsapp = exports.APPROVED_UTILITY_TEMPLATES = exports.getConversation = exports.getMyMetaTemplates = exports.sendFlowViaChatHub = exports.sendOtpViaWhatsapp = void 0;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const MBGCARD_API_URL = process.env.MBGCARD_API_URL || "https://chatbotbe.digitalmbg.com/api/whatsapp/send_meta_templet";
const MBGCARD_API_TOKEN = process.env.MBGCARD_API_TOKEN || "4a20fc02acefc015777b88b49d279ffa";
const MBGCARD_TEMPLATES_URL = process.env.MBGCARD_TEMPLATES_URL || "https://chatbotbe.digitalmbg.com/api/whatsapp/get_my_meta_templets";
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
        to: formattedPhone,
        variables: {
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
    const url = process.env.MBGCARD_TEMPLATES_URL || "https://chatbotbe.digitalmbg.com/api/whatsapp/get_my_meta_templets";
    try {
        console.log(`Fetching Meta templates from MBG Card (${url})...`);
        const response = yield axios_1.default.get(url, {
            headers: {
                'accept': 'application/json',
                'Content-Type': 'application/json',
                'x-api-key': MBGCARD_API_TOKEN,
                'User-Agent': 'BookMyVeg-Server/1.0'
            },
            timeout: 10000
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
exports.APPROVED_UTILITY_TEMPLATES = new Set([
    "bill_created", // UTILITY: Invoice Generated (Paid, Due, Cancelled)
    "payment_due_reminder", // UTILITY: Bill Due Reminder
    "feedback_request_support_", // UTILITY: Feedback on Recent Purchase
    "order_management_4", // UTILITY: Order Placed & Processing
    "order_update_notification", // UTILITY: Produce Out for Delivery
    "login" // AUTHENTICATION: OTP verification
]);
const sendOrderConfirmationViaWhatsapp = (phone, customerName, orderId, _amount) => __awaiter(void 0, void 0, void 0, function* () {
    // Uses approved UTILITY template: order_management_4
    return (0, exports.sendTemplateViaChatHub)(phone, "order_management_4", {
        body: [customerName, orderId]
    });
});
exports.sendOrderConfirmationViaWhatsapp = sendOrderConfirmationViaWhatsapp;
/**
 * Generic helper to send a WhatsApp template via ChatHub.
 * Strictly enforces UTILITY-only templates.
 */
const sendTemplateViaChatHub = (phone, templateName, variables, dynamicMedia) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // ── STRICT UTILITY MESSAGE POLICY ENFORCEMENT ──────────────────
    if (!exports.APPROVED_UTILITY_TEMPLATES.has(templateName)) {
        console.warn(`[MBG WhatsApp Template] BLOCKED non-utility template '${templateName}'. Strict utility policy is active.`);
        return {
            success: false,
            blocked: true,
            message: `Template '${templateName}' was blocked because only approved UTILITY templates are permitted.`
        };
    }
    const cleanPhone = phone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : (cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`);
    const payload = {
        templateName,
        to: formattedPhone,
        variables: {
            body: (variables === null || variables === void 0 ? void 0 : variables.body) || []
        }
    };
    if ((variables === null || variables === void 0 ? void 0 : variables.header) && variables.header.length > 0) {
        payload.variables.header = variables.header;
    }
    if (dynamicMedia) {
        payload.dynamicMedia = dynamicMedia;
    }
    const url = process.env.MBGCARD_API_URL || "https://chatbotbe.digitalmbg.com/api/whatsapp/send_meta_templet";
    try {
        console.log(`[MBG WhatsApp Utility Template] Sending ${templateName} (UTILITY) to ${formattedPhone} via ${url}`);
        const response = yield axios_1.default.post(url, payload, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'accept': '*/*',
                'x-api-key': MBGCARD_API_TOKEN,
                'User-Agent': 'BookMyVeg-Server/1.0'
            }
        });
        console.log("[MBG WhatsApp Template] Response:", response.data);
        return response.data;
    }
    catch (error) {
        console.error("Error sending utility template via ChatHub:", {
            message: error.message,
            response: (_a = error.response) === null || _a === void 0 ? void 0 : _a.data
        });
        throw error;
    }
});
exports.sendTemplateViaChatHub = sendTemplateViaChatHub;
/**
 * Post-order feedback request via UTILITY template 'feedback_request_support_'.
 */
const sendFeedbackRequestViaWhatsapp = (phone, customerName, _orderId) => __awaiter(void 0, void 0, void 0, function* () {
    return (0, exports.sendTemplateViaChatHub)(phone, "feedback_request_support_", {
        body: [customerName]
    });
});
exports.sendFeedbackRequestViaWhatsapp = sendFeedbackRequestViaWhatsapp;
/**
 * Invoice created (Paid) via UTILITY template 'bill_created'.
 */
const sendInvoicePaidViaWhatsapp = (phone, customerName, invoiceNo, totalAmount, paymentMode, orderId) => __awaiter(void 0, void 0, void 0, function* () {
    const origin = process.env.CLIENT_URL || "https://bookmyveg.co.in";
    const invoicePdfLink = `${origin}/invoice/${orderId}`;
    return (0, exports.sendTemplateViaChatHub)(phone, "bill_created", {
        body: [customerName, invoiceNo, String(totalAmount), paymentMode, invoicePdfLink]
    });
});
exports.sendInvoicePaidViaWhatsapp = sendInvoicePaidViaWhatsapp;
/**
 * Invoice created (Due / Partial) via UTILITY template 'bill_created'.
 */
const sendInvoiceDueViaWhatsapp = (phone, customerName, invoiceNo, totalAmount, paymentMode, dueAmount, _userId, orderId) => __awaiter(void 0, void 0, void 0, function* () {
    const origin = process.env.CLIENT_URL || "https://bookmyveg.co.in";
    const invoicePdfLink = `${origin}/invoice/${orderId}`;
    return (0, exports.sendTemplateViaChatHub)(phone, "bill_created", {
        body: [customerName, invoiceNo, String(totalAmount), `DUE: ₹${dueAmount} (${paymentMode})`, invoicePdfLink]
    });
});
exports.sendInvoiceDueViaWhatsapp = sendInvoiceDueViaWhatsapp;
/**
 * Payment due reminder via approved UTILITY template 'payment_due_reminder'.
 */
const sendPaymentReminderViaWhatsapp = (phone, customerName, dueAmount, invoiceNo, _userId, _orderId) => __awaiter(void 0, void 0, void 0, function* () {
    return (0, exports.sendTemplateViaChatHub)(phone, "payment_due_reminder", {
        body: [customerName, invoiceNo, `₹${dueAmount}`, "Immediate"]
    });
});
exports.sendPaymentReminderViaWhatsapp = sendPaymentReminderViaWhatsapp;
/**
 * Payment received confirmation via approved UTILITY template 'bill_created'.
 */
const sendPaymentReceivedViaWhatsapp = (phone, customerName, invoiceNo, paidAmount, paymentMode) => __awaiter(void 0, void 0, void 0, function* () {
    const origin = process.env.CLIENT_URL || "https://bookmyveg.co.in";
    const invoicePdfLink = `${origin}/invoice/${invoiceNo}`;
    return (0, exports.sendTemplateViaChatHub)(phone, "bill_created", {
        body: [customerName, invoiceNo, String(paidAmount), `${paymentMode} (Paid)`, invoicePdfLink]
    });
});
exports.sendPaymentReceivedViaWhatsapp = sendPaymentReceivedViaWhatsapp;
/**
 * Order status update via UTILITY templates.
 */
const sendOrderStatusUpdateViaWhatsapp = (phone, customerName, orderId, statusName) => __awaiter(void 0, void 0, void 0, function* () {
    if (statusName === "OUT_FOR_DELIVERY" || statusName === "SHIPPED") {
        return (0, exports.sendTemplateViaChatHub)(phone, "order_update_notification", {
            body: [customerName]
        });
    }
    return (0, exports.sendTemplateViaChatHub)(phone, "order_management_4", {
        body: [customerName, orderId]
    });
});
exports.sendOrderStatusUpdateViaWhatsapp = sendOrderStatusUpdateViaWhatsapp;
/**
 * Bill / Order cancelled notification via approved UTILITY template 'bill_created'.
 */
const sendBillCancelledViaWhatsapp = (phone, customerName, orderId, reason) => __awaiter(void 0, void 0, void 0, function* () {
    const origin = process.env.CLIENT_URL || "https://bookmyveg.co.in";
    const invoicePdfLink = `${origin}/invoice/${orderId}`;
    const cancelDesc = reason ? `CANCELLED (${reason})` : "CANCELLED";
    return (0, exports.sendTemplateViaChatHub)(phone, "bill_created", {
        body: [customerName, orderId, "0", cancelDesc, invoicePdfLink]
    });
});
exports.sendBillCancelledViaWhatsapp = sendBillCancelledViaWhatsapp;
/**
 * Inactivity reminder - marketing templates blocked by strict utility policy.
 */
const sendInactiveCustomerReminderViaWhatsapp = (_phone, _customerName) => __awaiter(void 0, void 0, void 0, function* () {
    console.warn("[MBG WhatsApp] Inactivity reminder skipped: strict utility message policy forbids marketing broadcasts.");
    return {
        success: false,
        skipped: true,
        message: "Marketing broadcasts are disabled under strict utility-only policy."
    };
});
exports.sendInactiveCustomerReminderViaWhatsapp = sendInactiveCustomerReminderViaWhatsapp;
/**
 * Registration welcome - marketing templates blocked by strict utility policy.
 */
const sendRegistrationThankYouViaWhatsapp = (_phone, _customerName) => __awaiter(void 0, void 0, void 0, function* () {
    console.warn("[MBG WhatsApp] Registration welcome skipped: strict utility message policy forbids marketing broadcasts.");
    return {
        success: false,
        skipped: true,
        message: "Marketing welcome messages are disabled under strict utility-only policy."
    };
});
exports.sendRegistrationThankYouViaWhatsapp = sendRegistrationThankYouViaWhatsapp;
