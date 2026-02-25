import { Router } from "express";
import { sendOtp, verifyOtpAndLogin, refreshToken, logout, getMe, checkWhatsappStatus, whatsappWebhook } from "../controllers/authController";
import { authenticate } from "../middleware/auth";
import { rateLimiter } from "../middleware/rateLimiter";
import { validate } from "../middleware/validate";
import { sendOtpSchema, verifyOtpSchema, whatsappCheckSchema } from "../schemas/authSchemas";

const router = Router();

router.post("/send-otp", rateLimiter, validate(sendOtpSchema), sendOtp);
router.post("/verify-otp", validate(verifyOtpSchema), verifyOtpAndLogin);
router.post("/whatsapp-check", validate(whatsappCheckSchema), checkWhatsappStatus);
router.post("/whatsapp-webhook", whatsappWebhook);
router.post("/refresh", refreshToken);
router.post("/logout", logout);
router.get("/me", authenticate, getMe);

export default router;
