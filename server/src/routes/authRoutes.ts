import { Router } from "express";
import { sendOtp, verifyOtpAndLogin, loginWithPassword, refreshToken, logout, getMe, checkWhatsappStatus, whatsappWebhook, getWhatsappTemplates } from "../controllers/authController";
import { authenticate } from "../middleware/auth";
import { rateLimiter } from "../middleware/rateLimiter";
import { validate } from "../middleware/validate";
import { sendOtpSchema, verifyOtpSchema, whatsappCheckSchema } from "../schemas/authSchemas";

const router = Router();

router.post("/send-otp", rateLimiter(), validate(sendOtpSchema), sendOtp);
router.post("/verify-otp", rateLimiter(), validate(verifyOtpSchema), verifyOtpAndLogin);
router.post("/login", rateLimiter(), loginWithPassword);
router.post("/whatsapp-check", rateLimiter(), validate(whatsappCheckSchema), checkWhatsappStatus);
router.post("/whatsapp-webhook", whatsappWebhook);
router.get("/whatsapp-templates", getWhatsappTemplates);
router.post("/refresh", refreshToken);
router.post("/logout", logout);
router.get("/me", authenticate, getMe);

export default router;
