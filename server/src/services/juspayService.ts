import axios from "axios";

// Read from env — all values now come from .env
const JUSPAY_BASE_URL = process.env.JUSPAY_BASE_URL || "https://smartgateway.hdfcuat.bank.in";
const MERCHANT_ID = process.env.JUSPAY_MERCHANT_ID || "SG4270";
const CLIENT_ID = process.env.JUSPAY_CLIENT_ID || "hdfcmaster";

// Juspay Basic Auth = Base64("API_KEY:") — note the trailing colon
const rawApiKey = process.env.JUSPAY_API_KEY || "";
const AUTH_HEADER = `Basic ${Buffer.from(`${rawApiKey}:`).toString("base64")}`;

const juspayApi = axios.create({
    baseURL: JUSPAY_BASE_URL,
    timeout: 8000,
    maxRedirects: 0,
    headers: {
        "Authorization": AUTH_HEADER,
        "x-merchantid": MERCHANT_ID,
        "Content-Type": "application/json",
        "version": "2023-06-30"
    }
});

interface CreateSessionParams {
    order_id: string;
    amount: number;
    customer_id: string;
    customer_email: string;
    customer_phone: string;
    return_url: string;
    first_name?: string;
    last_name?: string;
}

export const createJuspaySession = async (params: CreateSessionParams) => {
    try {
        const response = await juspayApi.post("/session", {
            order_id: params.order_id,
            amount: params.amount.toFixed(2), // Juspay expects string like "10.00"
            customer_id: params.customer_id,
            customer_email: params.customer_email,
            customer_phone: params.customer_phone,
            payment_page_client_id: CLIENT_ID,
            action: "paymentPage",
            currency: "INR",
            return_url: params.return_url,
            description: "Order Payment",
            first_name: params.first_name || "Customer",
            last_name: params.last_name || ""
        });
        return response.data;
    } catch (error: any) {
        console.error("Juspay Session Error:", error.response?.data || error.message);
        throw new Error("Failed to create payment session");
    }
};
export const getJuspayOrderStatus = async (orderId: string) => {
    try {
        const response = await juspayApi.get(`/orders/${orderId}`);
        return response.data;
    } catch (error: any) {
        console.error("Juspay Status Error:", error.response?.data || error.message);
        throw new Error("Failed to fetch order status");
    }
};

export const refundJuspayOrder = async (orderId: string, amount: number, uniqueRequestId: string) => {
    try {
        // Refund API uses form-urlencoded
        const data = new URLSearchParams();
        data.append("unique_request_id", uniqueRequestId);
        data.append("amount", amount.toFixed(2));

        const response = await juspayApi.post(`/orders/${orderId}/refunds`, data, {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        });
        return response.data;
    } catch (error: any) {
        console.error("Juspay Refund Error:", error.response?.data || error.message);
        throw new Error("Failed to process refund");
    }
};
