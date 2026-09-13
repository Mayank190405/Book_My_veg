import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const MBGCARD_API_URL = process.env.MBGCARD_API_URL || "https://chatbotbe.digitalmbg.com/api/whatsapp/send_meta_templet";
const MBGCARD_API_TOKEN = process.env.MBGCARD_API_TOKEN || "4a20fc02acefc015777b88b49d279ffa";
const MBGCARD_TEMPLATES_URL = process.env.MBGCARD_TEMPLATES_URL || "https://chatbotbe.digitalmbg.com/api/whatsapp/get_my_meta_templets";
const MBGCARD_TEMPLATE_ID = process.env.MBGCARD_TEMPLATE_ID || "login";
const MBGCARD_OTP_FLOW_ID = process.env.MBGCARD_OTP_FLOW_ID || "flow_1782732506015";
const MBGCARD_SENDER_NUMBER = process.env.MBGCARD_SENDER_NUMBER || "917879431560";
const MBGCARD_CHAT_ID = process.env.MBGCARD_CHAT_ID || "1070587";

const MAX_RETRIES = 3;
const INITIAL_BACKOFF = 1000; // 1 second

export const sendOtpViaWhatsapp = async (phone: string, otp: string) => {
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

    let lastError: any;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`Sending OTP via MBG Card Template API (Attempt ${attempt}/${MAX_RETRIES}):`, {
                url: MBGCARD_API_URL,
                templateName: payload.templateName,
                to: payload.to,
                variables: payload.variables
            });

            const response = await axios.post(MBGCARD_API_URL, payload, {
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
        } catch (error: any) {
            lastError = error;
            const isNetworkError = ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED'].includes(error.code);

            if (isNetworkError && attempt < MAX_RETRIES) {
                const backoff = INITIAL_BACKOFF * Math.pow(2, attempt - 1);
                console.warn(`MBG Card OTP failed (${error.code}). Retrying in ${backoff}ms...`);
                await new Promise(resolve => setTimeout(resolve, backoff));
                continue;
            }

            console.error("Error sending OTP via MBG Card Template API:", {
                code: error.code,
                message: error.message,
                response: error.response?.data
            });
            break;
        }
    }

    throw new Error(`Failed to send OTP via Template API after ${MAX_RETRIES} attempts. Last error: ${lastError?.message}`);
};

/**
 * Generic helper to send a flow via ChatHub.
 */
export const sendFlowViaChatHub = async (
    phone: string,
    flowId: string,
    name?: string,
    customFields?: Record<string, string>
) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const formattedPhone = `+${cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`}`;

    const actions: any[] = [];
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

        const response = await axios.post(url, payload, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': MBGCARD_API_TOKEN,
                'User-Agent': 'BookMyVeg-Server/1.0'
            }
        });

        console.log("[ChatHub Flow] Response:", response.data);
        return response.data;
    } catch (error: any) {
        console.error("Error sending flow via ChatHub:", {
            message: error.message,
            response: error.response?.data
        });
        throw error;
    }
};

/**
 * Fetch approved WhatsApp templates from MBG Card.
 */
export const getMyMetaTemplates = async () => {
    const url = process.env.MBGCARD_TEMPLATES_URL || "https://chatbotbe.digitalmbg.com/api/whatsapp/get_my_meta_templets";
    try {
        console.log(`Fetching Meta templates from MBG Card (${url})...`);
        const response = await axios.get(url, {
            headers: {
                'accept': 'application/json',
                'Content-Type': 'application/json',
                'x-api-key': MBGCARD_API_TOKEN,
                'User-Agent': 'BookMyVeg-Server/1.0'
            },
            timeout: 10000
        });
        return response.data;
    } catch (error: any) {
        console.warn("MBG Card Meta templates fetch notice:", error.message);
        return { success: false, data: [] };
    }
};

/**
 * Fallback conversation query. Left in place for backward compatibility, returns null as MBG Card has no conversation endpoint.
 */
export const getConversation = async (phone: string): Promise<any> => {
    console.warn("[MBG Card] getConversation is deprecated and not supported by the MBG Card API.");
    return null;
};

export const APPROVED_UTILITY_TEMPLATES = new Set([
    "bill_created",              // UTILITY: Invoice Generated (Paid, Due, Cancelled)
    "payment_due_reminder",     // UTILITY: Bill Due Reminder
    "feedback_request_support_", // UTILITY: Feedback on Recent Purchase
    "order_management_4",       // UTILITY: Order Placed & Processing
    "order_update_notification",// UTILITY: Produce Out for Delivery
    "login"                     // AUTHENTICATION: OTP verification
]);

export const sendOrderConfirmationViaWhatsapp = async (phone: string, customerName: string, orderId: string, _amount?: number) => {
    // Uses approved UTILITY template: order_management_4
    return sendTemplateViaChatHub(phone, "order_management_4", {
        body: [customerName, orderId]
    });
};

/**
 * Generic helper to send a WhatsApp template via ChatHub.
 * Strictly enforces UTILITY-only templates.
 */
export const sendTemplateViaChatHub = async (
    phone: string,
    templateName: string,
    variables?: { header?: string[]; body?: string[] },
    dynamicMedia?: string
) => {
    // ── STRICT UTILITY MESSAGE POLICY ENFORCEMENT ──────────────────
    if (!APPROVED_UTILITY_TEMPLATES.has(templateName)) {
        console.warn(`[MBG WhatsApp Template] BLOCKED non-utility template '${templateName}'. Strict utility policy is active.`);
        return {
            success: false,
            blocked: true,
            message: `Template '${templateName}' was blocked because only approved UTILITY templates are permitted.`
        };
    }

    const cleanPhone = phone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : (cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`);

    const payload: any = {
        templateName,
        to: formattedPhone,
        variables: {
            body: variables?.body || []
        }
    };
    if (variables?.header && variables.header.length > 0) {
        payload.variables.header = variables.header;
    }
    if (dynamicMedia) {
        payload.dynamicMedia = dynamicMedia;
    }

    const url = process.env.MBGCARD_API_URL || "https://chatbotbe.digitalmbg.com/api/whatsapp/send_meta_templet";

    try {
        console.log(`[MBG WhatsApp Utility Template] Sending ${templateName} (UTILITY) to ${formattedPhone} via ${url}`);

        const response = await axios.post(url, payload, {
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
    } catch (error: any) {
        console.error("Error sending utility template via ChatHub:", {
            message: error.message,
            response: error.response?.data
        });
        throw error;
    }
};

/**
 * Post-order feedback request via UTILITY template 'feedback_request_support_'.
 */
export const sendFeedbackRequestViaWhatsapp = async (phone: string, customerName: string, _orderId?: string) => {
    return sendTemplateViaChatHub(phone, "feedback_request_support_", {
        body: [customerName]
    });
};

/**
 * Invoice created (Paid) via UTILITY template 'bill_created'.
 */
export const sendInvoicePaidViaWhatsapp = async (
    phone: string,
    customerName: string,
    invoiceNo: string,
    totalAmount: number,
    paymentMode: string,
    orderId: string
) => {
    const origin = process.env.CLIENT_URL || "https://bookmyveg.co.in";
    const invoicePdfLink = `${origin}/invoice/${orderId}`;
    return sendTemplateViaChatHub(phone, "bill_created", {
        body: [customerName, invoiceNo, String(totalAmount), paymentMode, invoicePdfLink]
    });
};

/**
 * Invoice created (Due / Partial) via UTILITY template 'bill_created'.
 */
export const sendInvoiceDueViaWhatsapp = async (
    phone: string,
    customerName: string,
    invoiceNo: string,
    totalAmount: number,
    paymentMode: string,
    dueAmount: number,
    _userId: string,
    orderId: string
) => {
    const origin = process.env.CLIENT_URL || "https://bookmyveg.co.in";
    const invoicePdfLink = `${origin}/invoice/${orderId}`;
    return sendTemplateViaChatHub(phone, "bill_created", {
        body: [customerName, invoiceNo, String(totalAmount), `DUE: ₹${dueAmount} (${paymentMode})`, invoicePdfLink]
    });
};

/**
 * Payment due reminder via approved UTILITY template 'payment_due_reminder'.
 */
export const sendPaymentReminderViaWhatsapp = async (
    phone: string,
    customerName: string,
    dueAmount: number,
    invoiceNo: string,
    _userId?: string,
    _orderId?: string
) => {
    return sendTemplateViaChatHub(phone, "payment_due_reminder", {
        body: [customerName, invoiceNo, `₹${dueAmount}`, "Immediate"]
    });
};

/**
 * Payment received confirmation via approved UTILITY template 'bill_created'.
 */
export const sendPaymentReceivedViaWhatsapp = async (
    phone: string,
    customerName: string,
    invoiceNo: string,
    paidAmount: number,
    paymentMode: string
) => {
    const origin = process.env.CLIENT_URL || "https://bookmyveg.co.in";
    const invoicePdfLink = `${origin}/invoice/${invoiceNo}`;
    return sendTemplateViaChatHub(phone, "bill_created", {
        body: [customerName, invoiceNo, String(paidAmount), `${paymentMode} (Paid)`, invoicePdfLink]
    });
};

/**
 * Order status update via UTILITY templates.
 */
export const sendOrderStatusUpdateViaWhatsapp = async (
    phone: string,
    customerName: string,
    orderId: string,
    statusName: string
) => {
    if (statusName === "OUT_FOR_DELIVERY" || statusName === "SHIPPED") {
        return sendTemplateViaChatHub(phone, "order_update_notification", {
            body: [customerName]
        });
    }
    return sendTemplateViaChatHub(phone, "order_management_4", {
        body: [customerName, orderId]
    });
};

/**
 * Bill / Order cancelled notification via approved UTILITY template 'bill_created'.
 */
export const sendBillCancelledViaWhatsapp = async (
    phone: string,
    customerName: string,
    orderId: string,
    reason?: string
) => {
    const origin = process.env.CLIENT_URL || "https://bookmyveg.co.in";
    const invoicePdfLink = `${origin}/invoice/${orderId}`;
    const cancelDesc = reason ? `CANCELLED (${reason})` : "CANCELLED";
    return sendTemplateViaChatHub(phone, "bill_created", {
        body: [customerName, orderId, "0", cancelDesc, invoicePdfLink]
    });
};

/**
 * Inactivity reminder - marketing templates blocked by strict utility policy.
 */
export const sendInactiveCustomerReminderViaWhatsapp = async (
    _phone: string,
    _customerName?: string
) => {
    console.warn("[MBG WhatsApp] Inactivity reminder skipped: strict utility message policy forbids marketing broadcasts.");
    return {
        success: false,
        skipped: true,
        message: "Marketing broadcasts are disabled under strict utility-only policy."
    };
};

/**
 * Registration welcome - marketing templates blocked by strict utility policy.
 */
export const sendRegistrationThankYouViaWhatsapp = async (
    _phone: string,
    _customerName: string
) => {
    console.warn("[MBG WhatsApp] Registration welcome skipped: strict utility message policy forbids marketing broadcasts.");
    return {
        success: false,
        skipped: true,
        message: "Marketing welcome messages are disabled under strict utility-only policy."
    };
};
