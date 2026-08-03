import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const MBGCARD_API_URL = process.env.MBGCARD_API_URL || "https://chatbot.digitalmbg.com/v1/whatsapp/send_meta_templet";
const MBGCARD_API_TOKEN = process.env.MBGCARD_API_TOKEN || "91edd77281c02b04c4bdfb36aa5e4978";
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
        to: formattedPhone,                 // "to" field as required by send_meta_templet
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
                    'x-api-key': MBGCARD_API_TOKEN
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

    const url = "https://chatbot.digitalmbg.com/v1/contacts/send_flow";

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
                'x-api-key': MBGCARD_API_TOKEN
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
    try {
        console.log("Fetching Meta templates from MBG Card...");
        const response = await axios.get("https://chatbot.digitalmbg.com/v1/whatsapp/get_my_meta_templets", {
            headers: {
                'accept': 'application/json',
                'x-api-key': MBGCARD_API_TOKEN
            }
        });
        return response.data;
    } catch (error: any) {
        console.error("Error fetching MBG Card Meta templates:", {
            code: error.code,
            message: error.message,
            response: error.response?.data
        });
        throw error;
    }
};

/**
 * Fallback conversation query. Left in place for backward compatibility, returns null as MBG Card has no conversation endpoint.
 */
export const getConversation = async (phone: string): Promise<any> => {
    console.warn("[MBG Card] getConversation is deprecated and not supported by the MBG Card API.");
    return null;
};

export const sendOrderConfirmationViaWhatsapp = async (phone: string, customerName: string, orderId: string, amount: number) => {
    return sendTemplateViaChatHub(phone, "order_confirmation", {
        body: [customerName, orderId, String(amount)]
    });
};

/**
 * Generic helper to send a WhatsApp template via ChatHub.
 */
export const sendTemplateViaChatHub = async (
    phone: string,
    templateName: string,
    variables?: { header?: string[]; body?: string[] },
    dynamicMedia?: string
) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;

    const payload = {
        templateName,
        to: formattedPhone,
        variables: {
            body: variables?.body || []
        },
        dynamicMedia
    };

    const url = "https://chatbot.digitalmbg.com/v1/whatsapp/send_meta_templet";

    try {
        console.log(`[ChatHub Template] Sending template ${templateName} to ${formattedPhone}`);

        const response = await axios.post(url, payload, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'accept': '*/*',
                'x-api-key': MBGCARD_API_TOKEN
            }
        });

        console.log("[ChatHub Template] Response:", response.data);
        return response.data;
    } catch (error: any) {
        console.error("Error sending template via ChatHub:", {
            message: error.message,
            response: error.response?.data
        });
        throw error;
    }
};

export const sendFeedbackRequestViaWhatsapp = async (phone: string, customerName: string, orderId: string) => {
    const origin = process.env.CLIENT_URL || "https://bookmyveg.co.in";
    const feedbackLink = `${origin}/feedback?orderId=${orderId}`;
    return sendTemplateViaChatHub(phone, "feedback_request", {
        body: [customerName, feedbackLink]
    });
};

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

export const sendInvoiceDueViaWhatsapp = async (
    phone: string,
    customerName: string,
    invoiceNo: string,
    totalAmount: number,
    paymentMode: string,
    dueAmount: number,
    userId: string,
    orderId: string
) => {
    const origin = process.env.CLIENT_URL || "https://bookmyveg.co.in";
    const invoicePdfLink = `${origin}/invoice/${orderId}`;
    const publicPayLink = `${origin}/pay?userid=${userId}&number=${phone}&billid=${orderId}`;
    return sendTemplateViaChatHub(phone, "bill_created_due", {
        body: [customerName, invoiceNo, String(totalAmount), String(dueAmount), invoicePdfLink, publicPayLink]
    });
};

export const sendPaymentReminderViaWhatsapp = async (
    phone: string,
    customerName: string,
    dueAmount: number,
    invoiceNo: string,
    userId: string,
    orderId: string
) => {
    const origin = process.env.CLIENT_URL || "https://bookmyveg.co.in";
    const publicPayLink = `${origin}/pay?userid=${userId}&number=${phone}&billid=${orderId}`;
    return sendTemplateViaChatHub(phone, "due_payment_reminder", {
        body: [customerName, String(dueAmount), invoiceNo, publicPayLink]
    });
};

export const sendPaymentReceivedViaWhatsapp = async (
    phone: string,
    customerName: string,
    invoiceNo: string,
    paidAmount: number,
    paymentMode: string
) => {
    return sendTemplateViaChatHub(phone, "payment_received", {
        body: [customerName, invoiceNo, String(paidAmount), paymentMode]
    });
};

export const sendOrderStatusUpdateViaWhatsapp = async (
    phone: string,
    customerName: string,
    orderId: string,
    statusName: string
) => {
    return sendTemplateViaChatHub(phone, "order_status_update", {
        body: [statusName, orderId, customerName]
    });
};

export const sendRegistrationThankYouViaWhatsapp = async (
    phone: string,
    customerName: string
) => {
    return sendTemplateViaChatHub(phone, "registration_thank_you", {
        body: [customerName]
    });
};
