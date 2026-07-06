"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappCheckSchema = exports.updateProfileSchema = exports.verifyOtpSchema = exports.sendOtpSchema = void 0;
const zod_1 = require("zod");
exports.sendOtpSchema = zod_1.z.object({
    body: zod_1.z.object({
        phone: zod_1.z.string().regex(/^\d{10}$/, "Phone number must be 10 digits"),
    }),
});
exports.verifyOtpSchema = zod_1.z.object({
    body: zod_1.z.object({
        phone: zod_1.z.string().regex(/^\d{10}$/, "Phone number must be 10 digits"),
        otp: zod_1.z.string().length(6, "OTP must be 6 digits"),
    }),
});
exports.updateProfileSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(2, "Name must be at least 2 characters").optional(),
        email: zod_1.z.string().email("Invalid email address").optional(),
    }),
});
exports.whatsappCheckSchema = zod_1.z.object({
    body: zod_1.z.object({
        phone: zod_1.z.string().regex(/^\d{10}$/, "Phone number must be 10 digits"),
        token: zod_1.z.string().min(10, "Token missing"),
    }),
});
