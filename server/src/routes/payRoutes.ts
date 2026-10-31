import { Router } from "express";
import { getPayInfo, initiatePayDue, publicCustomerOnboard, saveOrderFeedback, sendPaymentReminderController, verifyPayment } from "../controllers/paymentController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

// Public routes for customer bill payment and dues settlement
router.get("/pay-info", getPayInfo);
router.post("/pay-due", initiatePayDue);
router.post("/verify", verifyPayment);
router.post("/onboard", publicCustomerOnboard);
router.post("/order-feedback", saveOrderFeedback);

// Payment reminder - Authenticated staff only
router.post("/send-reminder", authenticate, authorize(["ADMIN", "SUPER_ADMIN", "STORE_ADMIN", "POS_OPERATOR"]), sendPaymentReminderController);

export default router;
