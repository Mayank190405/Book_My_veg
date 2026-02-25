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
exports.sendOtpViaWhatsapp = void 0;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const AUTOMATEX_API_URL = "https://automatexindia.com/api/v1/whatsapp/send/template";
const AUTOMATEX_API_TOKEN = process.env.AUTOMATEX_API_TOKEN;
const AUTOMATEX_PHONE_NUMBER_ID = process.env.AUTOMATEX_PHONE_NUMBER_ID;
const AUTOMATEX_TEMPLATE_ID = process.env.AUTOMATEX_TEMPLATE_ID;
const sendOtpViaWhatsapp = (phone, otp) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = {
            apiToken: AUTOMATEX_API_TOKEN,
            phone_number_id: AUTOMATEX_PHONE_NUMBER_ID,
            template_id: AUTOMATEX_TEMPLATE_ID,
            "templateVariable-1-1": otp,
            phone_number: phone,
        };
        console.log("Sending OTP via Automatex:", data);
        const response = yield axios_1.default.post(AUTOMATEX_API_URL, data);
        console.log("Automatex Response:", response.data);
        return response.data;
    }
    catch (error) {
        console.error("Error sending OTP via Automatex:", error);
        throw new Error("Failed to send OTP");
    }
});
exports.sendOtpViaWhatsapp = sendOtpViaWhatsapp;
