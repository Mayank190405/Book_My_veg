import { Router } from "express";
import {
    getAvailableTemplates,
    getTemplateConfigs,
    upsertTemplateConfig,
    deleteTemplateConfig,
    sendCustomMessage
} from "../controllers/templateController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

// Templates discovery and configuration
router.get("/available", authenticate, authorize(["ADMIN", "STORE_ADMIN", "MANAGER", "POS_OPERATOR"]), getAvailableTemplates);
router.get("/configs", authenticate, authorize(["ADMIN", "STORE_ADMIN", "MANAGER", "POS_OPERATOR"]), getTemplateConfigs);
router.post("/configs", authenticate, authorize(["ADMIN", "STORE_ADMIN"]), upsertTemplateConfig);
router.delete("/configs/:id", authenticate, authorize(["ADMIN", "STORE_ADMIN"]), deleteTemplateConfig);

// Send custom template message
router.post("/send-custom", authenticate, authorize(["ADMIN", "STORE_ADMIN", "MANAGER", "POS_OPERATOR"]), sendCustomMessage);

export default router;
