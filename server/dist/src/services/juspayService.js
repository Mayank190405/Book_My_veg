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
exports.verifyJuspaySignature = exports.refundJuspayOrder = exports.getJuspayOrderStatus = exports.createJuspaySession = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
// Read from env — all values now come from .env
const JUSPAY_BASE_URL = process.env.JUSPAY_BASE_URL || "https://smartgateway.hdfcuat.bank.in";
const MERCHANT_ID = process.env.JUSPAY_MERCHANT_ID || "SG4270";
const CLIENT_ID = process.env.JUSPAY_CLIENT_ID || "hdfcmaster";
const RESPONSE_KEY = process.env.JUSPAY_RESPONSE_KEY || "";
// Juspay Basic Auth = Base64("API_KEY:") — note the trailing colon
const rawApiKey = process.env.JUSPAY_API_KEY || "";
const AUTH_HEADER = `Basic ${Buffer.from(`${rawApiKey}:`).toString("base64")}`;
const juspayApi = axios_1.default.create({
    baseURL: JUSPAY_BASE_URL,
    headers: {
        "Authorization": AUTH_HEADER,
        "x-merchantid": MERCHANT_ID,
        "Content-Type": "application/json",
        "version": "2023-06-30"
    }
});
const createJuspaySession = (params) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const response = yield juspayApi.post("/session", {
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
    }
    catch (error) {
        console.error("Juspay Session Error:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
        throw new Error("Failed to create payment session");
    }
});
exports.createJuspaySession = createJuspaySession;
const getJuspayOrderStatus = (orderId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const response = yield juspayApi.get(`/orders/${orderId}`);
        return response.data;
    }
    catch (error) {
        console.error("Juspay Status Error:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
        throw new Error("Failed to fetch order status");
    }
});
exports.getJuspayOrderStatus = getJuspayOrderStatus;
const refundJuspayOrder = (orderId, amount, uniqueRequestId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Refund API uses form-urlencoded
        const data = new URLSearchParams();
        data.append("unique_request_id", uniqueRequestId);
        data.append("amount", amount.toFixed(2));
        const response = yield juspayApi.post(`/orders/${orderId}/refunds`, data, {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        });
        return response.data;
    }
    catch (error) {
        console.error("Juspay Refund Error:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
        throw new Error("Failed to process refund");
    }
});
exports.refundJuspayOrder = refundJuspayOrder;
/**
 * Verify Juspay response signature using RESPONSE_KEY
 * Juspay signs the response body using HMAC-SHA256
 * @param responseBody - Raw response body string from Juspay
 * @param signature - Signature header from Juspay response
 */
const verifyJuspaySignature = (responseBody, signature) => {
    if (!RESPONSE_KEY) {
        console.warn("JUSPAY_RESPONSE_KEY not set — skipping signature verification");
        return true;
    }
    const expectedSig = crypto_1.default
        .createHmac("sha256", RESPONSE_KEY)
        .update(responseBody)
        .digest("base64");
    return expectedSig === signature;
};
exports.verifyJuspaySignature = verifyJuspaySignature;
