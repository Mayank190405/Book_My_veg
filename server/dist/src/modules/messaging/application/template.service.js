"use strict";
/**
 * Book My Veg — Template Management & Custom Dispatch Service
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
exports.TemplateService = void 0;
const template_registry_1 = require("../templates/template-registry");
const notification_dispatcher_service_1 = require("./notification-dispatcher.service");
const recipient_service_1 = require("./recipient.service");
class TemplateService {
    constructor() {
        this.registry = template_registry_1.TemplateRegistry.getInstance();
        this.dispatcher = notification_dispatcher_service_1.NotificationDispatcherService.getInstance();
    }
    static getInstance() {
        if (!TemplateService.instance) {
            TemplateService.instance = new TemplateService();
        }
        return TemplateService.instance;
    }
    /**
     * Synchronizes live templates from provider into registry and returns complete catalog.
     */
    syncAndGetTemplates() {
        return __awaiter(this, void 0, void 0, function* () {
            const provider = this.dispatcher.getProvider();
            try {
                const live = yield provider.fetchTemplates();
                for (const tpl of live) {
                    this.registry.registerOrUpdateTemplate(tpl);
                }
            }
            catch (_) {
                // Non-blocking: fallback to static verified templates in registry
            }
            return this.registry.getAllTemplates();
        });
    }
    /**
     * Dispatches a custom template message with strict parameter validation and durable audit logging.
     */
    sendCustomTemplate(options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const { phone, templateName, dynamicMedia, actorId, triggerSource = "ADMIN_CUSTOM" } = options;
            const cleanPhone = recipient_service_1.RecipientService.sanitizePhone(phone);
            // Normalize variables structure
            let structuredVars = {};
            if (Array.isArray(options.variables)) {
                structuredVars = { body: options.variables.map(v => String(v !== null && v !== void 0 ? v : "")) };
            }
            else if (options.variables) {
                structuredVars = {
                    header: ((_a = options.variables.header) === null || _a === void 0 ? void 0 : _a.map(v => String(v !== null && v !== void 0 ? v : ""))) || [],
                    body: ((_b = options.variables.body) === null || _b === void 0 ? void 0 : _b.map(v => String(v !== null && v !== void 0 ? v : ""))) || []
                };
            }
            return yield this.dispatcher.dispatch({
                notificationType: "CUSTOM_TEMPLATE",
                channel: "WHATSAPP",
                recipientPhone: cleanPhone,
                templateName,
                variables: structuredVars,
                dynamicMedia,
                triggerSource,
                actorId
            });
        });
    }
}
exports.TemplateService = TemplateService;
