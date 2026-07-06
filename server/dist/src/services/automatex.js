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
exports.getConversation = exports.sendOtpViaWhatsapp = void 0;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
const qs_1 = __importDefault(require("qs"));
dotenv_1.default.config();
const AUTOMATEX_API_URL = "https://automatexindia.com/api/v1/whatsapp/send/template";
const AUTOMATEX_API_TOKEN = process.env.AUTOMATEX_API_TOKEN;
const AUTOMATEX_PHONE_NUMBER_ID = process.env.AUTOMATEX_PHONE_NUMBER_ID;
const AUTOMATEX_TEMPLATE_ID = process.env.AUTOMATEX_TEMPLATE_ID;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF = 1000; // 1 second
const sendOtpViaWhatsapp = (phone, otp) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const data = {
        apiToken: AUTOMATEX_API_TOKEN,
        phone_number_id: AUTOMATEX_PHONE_NUMBER_ID,
        template_id: AUTOMATEX_TEMPLATE_ID,
        "templateVariable-1-1": otp,
        phone_number: phone.startsWith('+91') ? phone : (phone.startsWith('91') ? `+${phone}` : `+91${phone}`),
    };
    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`Sending OTP via Automatex (Attempt ${attempt}/${MAX_RETRIES}):`, Object.assign(Object.assign({}, data), { apiToken: '***' }));
            const response = yield axios_1.default.post(AUTOMATEX_API_URL, qs_1.default.stringify(data), {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'BMV-QuickCommerce-Server/1.0.0'
                }
            });
            console.log("Automatex Response:", response.data);
            return response.data;
        }
        catch (error) {
            lastError = error;
            const isNetworkError = ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED'].includes(error.code);
            if (isNetworkError && attempt < MAX_RETRIES) {
                const backoff = INITIAL_BACKOFF * Math.pow(2, attempt - 1);
                console.warn(`Automatex failed (${error.code}). Retrying in ${backoff}ms...`);
                yield new Promise(resolve => setTimeout(resolve, backoff));
                continue;
            }
            console.error("Error sending OTP via Automatex:", {
                code: error.code,
                message: error.message,
                response: (_a = error.response) === null || _a === void 0 ? void 0 : _a.data
            });
            break;
        }
    }
    throw new Error(`Failed to send OTP after ${MAX_RETRIES} attempts. Last error: ${lastError === null || lastError === void 0 ? void 0 : lastError.message}`);
});
exports.sendOtpViaWhatsapp = sendOtpViaWhatsapp;
const getConversation = (phone) => __awaiter(void 0, void 0, void 0, function* () {
    const phoneFormatted = phone.startsWith('+91') ? phone.slice(1) : (phone.startsWith('91') ? phone : `91${phone}`);
    try {
        const response = yield axios_1.default.get("https://automatexindia.com/api/v1/whatsapp/get/conversation", {
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
    }
    catch (error) {
        console.error("Error fetching Automatex conversation:", error.message);
        return null;
    }
});
exports.getConversation = getConversation;
