import { Router } from "express";
import { getPayInfo, initiatePayDue, publicCustomerOnboard } from "../controllers/paymentController";

const router = Router();

// Public routes for customer bill payment and dues settlement
router.get("/pay-info", getPayInfo);
router.post("/pay-due", initiatePayDue);
router.post("/onboard", publicCustomerOnboard);

export default router;
