import axios from "axios";
import dotenv from "dotenv";
import qs from "qs";

dotenv.config();

const AUTOMATEX_API_URL = "https://automatexindia.com/api/v1/whatsapp/send/template";
const AUTOMATEX_API_TOKEN = process.env.AUTOMATEX_API_TOKEN;
const AUTOMATEX_PHONE_NUMBER_ID = process.env.AUTOMATEX_PHONE_NUMBER_ID;
const AUTOMATEX_TEMPLATE_ID = process.env.AUTOMATEX_TEMPLATE_ID;

const MAX_RETRIES = 3;
const INITIAL_BACKOFF = 1000; // 1 second

export const sendOtpViaWhatsapp = async (phone: string, otp: string) => {
    const data = {
        apiToken: AUTOMATEX_API_TOKEN,
        phone_number_id: AUTOMATEX_PHONE_NUMBER_ID,
        template_id: AUTOMATEX_TEMPLATE_ID,
        "templateVariable-1-1": otp,
        phone_number: phone.startsWith('+91') ? phone : (phone.startsWith('91') ? `+${phone}` : `+91${phone}`),
    };

    let lastError: any;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`Sending OTP via Automatex (Attempt ${attempt}/${MAX_RETRIES}):`, { ...data, apiToken: '***' });

            const response = await axios.post(AUTOMATEX_API_URL, qs.stringify(data), {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'BMV-QuickCommerce-Server/1.0.0'
                }
            });

            console.log("Automatex Response:", response.data);
            return response.data;
        } catch (error: any) {
            lastError = error;
            const isNetworkError = ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED'].includes(error.code);

            if (isNetworkError && attempt < MAX_RETRIES) {
                const backoff = INITIAL_BACKOFF * Math.pow(2, attempt - 1);
                console.warn(`Automatex failed (${error.code}). Retrying in ${backoff}ms...`);
                await new Promise(resolve => setTimeout(resolve, backoff));
                continue;
            }

            console.error("Error sending OTP via Automatex:", {
                code: error.code,
                message: error.message,
                response: error.response?.data
            });
            break;
        }
    }

    throw new Error(`Failed to send OTP after ${MAX_RETRIES} attempts. Last error: ${lastError?.message}`);
};

export const getConversation = async (phone: string) => {
    const phoneFormatted = phone.startsWith('+91') ? phone.slice(1) : (phone.startsWith('91') ? phone : `91${phone}`);

    try {
        const response = await axios.get("https://automatexindia.com/api/v1/whatsapp/get/conversation", {
            params: {
                apiToken: AUTOMATEX_API_TOKEN,
                phone_number_id: AUTOMATEX_PHONE_NUMBER_ID,
                phone_number: phoneFormatted,
                limit: 1,
                offset: 1
            },
            headers: {
                'User-Agent': 'BMV-QuickCommerce-Server/1.0.0'
            }
        });
        console.log("[Automatex] getConversation raw response:", JSON.stringify(response.data, null, 2));
        return response.data;
    } catch (error: any) {
        console.error("Error fetching Automatex conversation:", error.message);
        return null;
    }
};
