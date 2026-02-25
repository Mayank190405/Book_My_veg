
import { Router } from "express";
import { generateQr, handleQrWebhook } from "../controllers/qrController";
import { authenticate } from "../middleware/auth";

const router = Router();

/**
 * @route   POST /api/v1/qr/generate
 * @desc    Generate a UPI QR intent for POS
 * @access  Protected (Staff/Admin)
 */
router.post("/generate", authenticate, generateQr);

/**
 * @route   POST /api/v1/qr/webhook
 * @desc    Simulated Webhook for UPI Payment Confirmation
 * @access  Public (Gateway)
 */
router.post("/webhook", handleQrWebhook);

export default router;
