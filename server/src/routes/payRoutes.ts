import { Router } from "express";
import { getPayInfo, initiatePayDue, publicCustomerOnboard, saveOrderFeedback, sendPaymentReminderController, verifyPayment } from "../controllers/paymentController";

const router = Router();

// Public routes for customer bill payment and dues settlement
router.get("/pay-info", getPayInfo);
router.post("/pay-due", initiatePayDue);
router.post("/verify", verifyPayment);
router.post("/onboard", publicCustomerOnboard);
router.post("/order-feedback", saveOrderFeedback);
router.post("/send-reminder", sendPaymentReminderController);

export default router;
