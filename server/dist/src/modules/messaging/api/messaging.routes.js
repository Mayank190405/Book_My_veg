"use strict";
/**
 * Book My Veg — Messaging Routes
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const messaging_controller_1 = require("./messaging.controller");
const auth_1 = require("../../../middleware/auth");
const validate_1 = require("../../../middleware/validate");
const messaging_schemas_1 = require("./messaging.schemas");
const router = (0, express_1.Router)();
// 1. Payment Reminder Endpoints (Authorized only)
router.post("/reminders/due", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "SUPER_ADMIN", "STORE_ADMIN", "POS_OPERATOR"]), (0, validate_1.validate)(messaging_schemas_1.sendDueRemindersSchema), messaging_controller_1.MessagingController.sendDueReminders);
router.post("/reminders/single-order", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "SUPER_ADMIN", "STORE_ADMIN", "POS_OPERATOR"]), (0, validate_1.validate)(messaging_schemas_1.sendSingleOrderReminderSchema), messaging_controller_1.MessagingController.sendSingleOrderReminder);
// 2. Template Endpoints
router.get("/templates", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "SUPER_ADMIN", "STORE_ADMIN", "MANAGER", "POS_OPERATOR"]), messaging_controller_1.MessagingController.getTemplates);
router.post("/templates/send-custom", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "SUPER_ADMIN", "STORE_ADMIN"]), (0, validate_1.validate)(messaging_schemas_1.sendCustomTemplateSchema), messaging_controller_1.MessagingController.sendCustomTemplate);
// 3. Flow Endpoints
router.post("/chathub/send-flow", auth_1.authenticate, (0, auth_1.authorize)(["ADMIN", "SUPER_ADMIN"]), (0, validate_1.validate)(messaging_schemas_1.sendChatHubFlowSchema), messaging_controller_1.MessagingController.sendChatHubFlow);
exports.default = router;
