"use strict";
/**
 * Book My Veg — Messaging Controller
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingController = void 0;
const reminder_service_1 = require("../application/reminder.service");
const template_service_1 = require("../application/template.service");
const notification_service_1 = require("../application/notification.service");
class MessagingController {
    /**
     * POST /api/v1/messaging/reminders/due
     * Dispatches payment reminders for POS/Admin with strict 24h cooldown and atomic claim.
     */
    static sendDueReminders(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const { customerIds, locationId } = req.body;
                const actorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
                const scopedLocationId = locationId || ((_b = req.user) === null || _b === void 0 ? void 0 : _b.locationId);
                const service = reminder_service_1.ReminderService.getInstance();
                const summary = yield service.sendDueReminders({
                    customerIds,
                    locationId: scopedLocationId,
                    actorId,
                    triggerSource: "POS_MANUAL"
                });
                return res.json({
                    success: true,
                    message: `Payment reminders processed: ${summary.sentCount} sent, ${summary.skippedCount} skipped (cooldown active), ${summary.failedCount} failed.`,
                    summary
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * POST /api/v1/messaging/reminders/single-order
     * Dispatches payment reminder for a single order with strict 24h cooldown and atomic claim.
     */
    static sendSingleOrderReminder(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const { orderId, locationId } = req.body;
                const actorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
                const service = reminder_service_1.ReminderService.getInstance();
                const result = yield service.sendSingleOrderReminder(orderId, actorId, locationId || ((_b = req.user) === null || _b === void 0 ? void 0 : _b.locationId));
                if (result.success) {
                    return res.json({
                        success: true,
                        message: "Payment reminder sent successfully via WhatsApp."
                    });
                }
                if (result.status === "SKIPPED_COOLDOWN") {
                    return res.status(429).json({
                        success: false,
                        message: result.error || "Customer already received a payment reminder within the last 24 hours."
                    });
                }
                return res.status(400).json({
                    success: false,
                    message: result.error || "Failed to send payment reminder."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * GET /api/v1/messaging/templates
     * Retrieves live Meta templates synchronized with provider.
     */
    static getTemplates(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const service = template_service_1.TemplateService.getInstance();
                const templates = yield service.syncAndGetTemplates();
                return res.json({ success: true, templates });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * POST /api/v1/messaging/templates/send-custom
     * Dispatches custom template message with validation and durable audit record.
     */
    static sendCustomTemplate(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { phone, templateName, variables, dynamicMedia } = req.body;
                const actorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
                const service = template_service_1.TemplateService.getInstance();
                const result = yield service.sendCustomTemplate({
                    phone,
                    templateName,
                    variables,
                    dynamicMedia,
                    actorId,
                    triggerSource: "ADMIN_CUSTOM"
                });
                if (result.success) {
                    return res.json({
                        success: true,
                        message: `Template '${templateName}' dispatched successfully to ${phone}.`,
                        result
                    });
                }
                return res.status(400).json({
                    success: false,
                    message: result.error || "Failed to dispatch template message."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    /**
     * POST /api/v1/messaging/chathub/send-flow
     */
    static sendChatHubFlow(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { phone, flowId, name, customFields } = req.body;
                const actorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
                const service = notification_service_1.NotificationService.getInstance();
                const result = yield service.sendChatHubFlow(phone, flowId, name, customFields, actorId);
                if (result.success) {
                    return res.json({
                        success: true,
                        message: "Flow dispatched successfully.",
                        result
                    });
                }
                return res.status(400).json({
                    success: false,
                    message: result.error || "Failed to trigger flow."
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.MessagingController = MessagingController;
