import { z } from "zod";

export const sendOtpSchema = z.object({
    body: z.object({
        phone: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits"),
    }),
});

export const verifyOtpSchema = z.object({
    body: z.object({
        phone: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits"),
        otp: z.string().length(6, "OTP must be 6 digits"),
    }),
});

export const updateProfileSchema = z.object({
    body: z.object({
        name: z.string().min(2, "Name must be at least 2 characters").optional(),
        email: z.string().email("Invalid email address").optional(),
    }),
});

export const whatsappCheckSchema = z.object({
    body: z.object({
        phone: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits"),
        token: z.string().min(10, "Token missing"),
    }),
});
