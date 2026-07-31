import { Router } from "express";
import { getPayInfo, initiatePayDue } from "../controllers/paymentController";

const router = Router();

// Public routes for customer bill payment and dues settlement
router.get("/pay-info", getPayInfo);
router.post("/pay-due", initiatePayDue);

export default router;
