"use strict";
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
exports.sendTemplateHandler = exports.sendFlowHandler = void 0;
const messaging_1 = require("../modules/messaging");
/**
 * Endpoint to trigger an arbitrary ChatHub flow for a contact.
 * POST /api/v1/chathub/send-flow
 */
const sendFlowHandler = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { phone, flowId, name, customFields } = req.body;
        if (!phone || !flowId) {
            return res.status(400).json({
                success: false,
                message: "Phone and flowId are required"
            });
        }
        const result = yield messaging_1.NotificationService.getInstance().sendChatHubFlow(phone, flowId, name, customFields, (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId);
        return res.status(200).json({
            success: result.success,
            message: result.success ? "Flow triggered successfully" : (result.error || "Failed to trigger flow"),
            data: result
        });
    }
    catch (error) {
        console.error("sendFlowHandler error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to send flow via ChatHub",
            error: error.message || error
        });
    }
});
exports.sendFlowHandler = sendFlowHandler;
/**
 * Endpoint to trigger an arbitrary ChatHub template message.
 * POST /api/v1/chathub/send-template
 */
const sendTemplateHandler = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { phone, templateName, variables, dynamicMedia } = req.body;
        if (!phone || !templateName) {
            return res.status(400).json({
                success: false,
                message: "Phone and templateName are required"
            });
        }
        const result = yield messaging_1.TemplateService.getInstance().sendCustomTemplate({
            phone,
            templateName,
            variables,
            dynamicMedia,
            actorId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId,
            triggerSource: "CHATHUB_API"
        });
        return res.status(result.success ? 200 : 400).json({
            success: result.success,
            message: result.success ? "Template message triggered successfully" : (result.error || "Failed to dispatch template"),
            data: result
        });
    }
    catch (error) {
        console.error("sendTemplateHandler error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to send template via ChatHub",
            error: error.message || error
        });
    }
});
exports.sendTemplateHandler = sendTemplateHandler;
