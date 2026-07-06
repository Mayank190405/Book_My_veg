"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chatHubController_1 = require("../controllers/chatHubController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Expose the send-flow endpoint for ADMIN and STORE_ADMIN roles
router.post("/send-flow", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), chatHubController_1.sendFlowHandler);
// Expose the send-template endpoint for ADMIN and STORE_ADMIN roles
router.post("/send-template", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "STORE_ADMIN"]), chatHubController_1.sendTemplateHandler);
exports.default = router;
