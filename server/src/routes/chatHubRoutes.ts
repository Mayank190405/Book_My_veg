import { Router } from "express";
import { sendFlowHandler, sendTemplateHandler } from "../controllers/chatHubController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

// Expose the send-flow endpoint for ADMIN and STORE_ADMIN roles
router.post("/send-flow", authenticate, authorize(["ADMIN", "STORE_ADMIN"]), sendFlowHandler);

// Expose the send-template endpoint for ADMIN and STORE_ADMIN roles
router.post("/send-template", authenticate, authorize(["ADMIN", "STORE_ADMIN"]), sendTemplateHandler);

export default router;
