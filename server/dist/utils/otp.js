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
exports.verifyOtp = exports.storeOtp = exports.generateOtp = void 0;
const redis_1 = __importDefault(require("../config/redis"));
const OTP_EXPIRY = 600; // 10 minutes
const MAX_ATTEMPTS = 5;
const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};
exports.generateOtp = generateOtp;
const storeOtp = (phone, otp) => __awaiter(void 0, void 0, void 0, function* () {
    const key = `otp:${phone}`;
    const attemptsKey = `otp_attempts:${phone}`;
    // Check attempts
    const attempts = yield redis_1.default.get(attemptsKey);
    if (attempts && parseInt(attempts) >= MAX_ATTEMPTS) {
        throw new Error("Too many OTP attempts. Please try again later.");
    }
    // Increment attempts
    yield redis_1.default.incr(attemptsKey);
    yield redis_1.default.expire(attemptsKey, 3600); // 1 hour expiry for attempts
    // Store OTP
    yield redis_1.default.setEx(key, OTP_EXPIRY, otp);
});
exports.storeOtp = storeOtp;
const verifyOtp = (phone, otp) => __awaiter(void 0, void 0, void 0, function* () {
    const key = `otp:${phone}`;
    const storedOtp = yield redis_1.default.get(key);
    if (!storedOtp) {
        return false;
    }
    if (storedOtp !== otp) {
        return false;
    }
    // Clear OTP after successful verification
    yield redis_1.default.del(key);
    yield redis_1.default.del(`otp_attempts:${phone}`);
    return true;
});
exports.verifyOtp = verifyOtp;
