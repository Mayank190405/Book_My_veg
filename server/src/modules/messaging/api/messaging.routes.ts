/**
 * Book My Veg — Messaging Routes
 */

import { Router } from "express";
import { MessagingController } from "./messaging.controller";
import { authenticate, authorize } from "../../../middleware/auth";
import { validate } from "../../../middleware/validate";
import {
    sendChatHubFlowSchema,
    sendCustomTemplateSchema,
    sendDueRemindersSchema,
    sendSingleOrderReminderSchema
} from "./messaging.schemas";

const router = Router();

// 1. Payment Reminder Endpoints (Authorized only)
router.post(
    "/reminders/due",
    authenticate,
    authorize(["ADMIN", "SUPER_ADMIN", "STORE_ADMIN", "POS_OPERATOR"]),
    validate(sendDueRemindersSchema),
    MessagingController.sendDueReminders
);

router.post(
    "/reminders/single-order",
    authenticate,
    authorize(["ADMIN", "SUPER_ADMIN", "STORE_ADMIN", "POS_OPERATOR"]),
    validate(sendSingleOrderReminderSchema),
    MessagingController.sendSingleOrderReminder
);

// 2. Template Endpoints
router.get(
    "/templates",
    authenticate,
    authorize(["ADMIN", "SUPER_ADMIN", "STORE_ADMIN", "MANAGER", "POS_OPERATOR"]),
    MessagingController.getTemplates
);

router.post(
    "/templates/send-custom",
    authenticate,
    authorize(["ADMIN", "SUPER_ADMIN", "STORE_ADMIN"]),
    validate(sendCustomTemplateSchema),
    MessagingController.sendCustomTemplate
);

// 3. Flow Endpoints
router.post(
    "/chathub/send-flow",
    authenticate,
    authorize(["ADMIN", "SUPER_ADMIN"]),
    validate(sendChatHubFlowSchema),
    MessagingController.sendChatHubFlow
);

export default router;

