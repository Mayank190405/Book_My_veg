"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const templateController_1 = require("../controllers/templateController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Templates discovery and configuration
router.get("/available", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN", "MANAGER", "POS_OPERATOR"]), templateController_1.getAvailableTemplates);
router.get("/configs", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN", "MANAGER", "POS_OPERATOR"]), templateController_1.getTemplateConfigs);
router.post("/configs", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), templateController_1.upsertTemplateConfig);
router.delete("/configs/:id", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), templateController_1.deleteTemplateConfig);
// Send custom template message
router.post("/send-custom", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN", "MANAGER", "POS_OPERATOR"]), templateController_1.sendCustomMessage);
exports.default = router;
