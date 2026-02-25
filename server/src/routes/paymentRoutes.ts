import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { initiatePayment, verifyPayment, refundPayment, handleWebhook, getOrderStatus } from "../controllers/paymentController";

const router = Router();

// Webhook (No auth, validated by signature) - Must be before auth middleware if using router.use
router.post("/webhook", handleWebhook);

router.use(authenticate);

router.post("/initiate", initiatePayment);
router.post("/verify", verifyPayment);
router.get("/order-status/:orderId", getOrderStatus);
router.post("/refund", refundPayment);

export default router;
