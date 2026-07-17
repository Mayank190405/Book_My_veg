import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { initiatePayment, verifyPayment, refundPayment, handleWebhook, getOrderStatus, generatePaymentLink, handleEasebuzzCallback } from "../controllers/paymentController";

const router = Router();

// Webhook (No auth, validated by signature) - Must be before auth middleware if using router.use
router.post("/webhook", handleWebhook);
router.post("/easebuzz/callback", handleEasebuzzCallback);

router.use(authenticate);

router.post("/initiate", initiatePayment);
router.post("/:orderId/generate-link", generatePaymentLink);
router.post("/verify", verifyPayment);
router.get("/order-status/:orderId", getOrderStatus);

// Admin
router.post("/refund", authorize(["ADMIN", "STORE_ADMIN"]), refundPayment);

export default router;
