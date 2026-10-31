"use strict";
/**
 * Book My Veg — Notification Dispatcher Service
 * Orchestrates template validation, idempotency guards, provider dispatch, and durable audit logs.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationDispatcherService = void 0;
const mbg_whatsapp_provider_1 = require("../infrastructure/providers/mbg-whatsapp.provider");
const notification_repository_1 = require("../infrastructure/repositories/notification.repository");
const template_validator_1 = require("../templates/template-validator");
const idempotency_policy_1 = require("../policies/idempotency.policy");
const logger_1 = __importDefault(require("../../../utils/logger"));
class NotificationDispatcherService {
    constructor(provider) {
        this.provider = provider || new mbg_whatsapp_provider_1.MbgWhatsAppProvider();
        this.repository = notification_repository_1.NotificationRepository.getInstance();
    }
    static getInstance(provider) {
        if (!NotificationDispatcherService.instance) {
            NotificationDispatcherService.instance = new NotificationDispatcherService(provider);
        }
        return NotificationDispatcherService.instance;
    }
    /**
     * Dispatches an outbound WhatsApp notification through the full policy and provider pipeline.
     */
    dispatch(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const lockKey = request.idempotencyKey || `msg:${request.recipientPhone}:${request.templateName}:${request.referenceId || "direct"}`;
            // 1. In-flight idempotency guard to prevent concurrent double-clicks
            const acquired = idempotency_policy_1.IdempotencyPolicy.acquireLock(lockKey);
            if (!acquired) {
                logger_1.default.warn(`[NotificationDispatcher] In-flight request detected for lockKey '${lockKey}'. Suppressing duplicate.`);
                return {
                    success: false,
                    status: "BLOCKED_BY_POLICY",
                    error: "A message dispatch to this recipient is currently in-progress. Please wait."
                };
            }
            try {
                // 2. Validate template and sanitize parameters (newline stripping, utility policy)
                const validation = template_validator_1.TemplateValidator.validateAndSanitize(request.templateName, request.variables);
                if (!validation.valid) {
                    logger_1.default.warn(`[NotificationDispatcher] Template validation rejected '${request.templateName}': ${validation.error}`);
                    const failResult = {
                        success: false,
                        status: validation.blocked ? "BLOCKED_BY_POLICY" : "FAILED",
                        blocked: validation.blocked,
                        error: validation.error
                    };
                    yield this.repository.recordDispatch(request, failResult);
                    return failResult;
                }
                // Update with sanitized variables
                const sanitizedRequest = Object.assign(Object.assign({}, request), { variables: validation.sanitizedVariables });
                // 3. Dispatch to external WhatsApp provider adapter
                const result = yield this.provider.sendTemplate(sanitizedRequest);
                // 4. Record durable audit log entry
                yield this.repository.recordDispatch(sanitizedRequest, result);
                return result;
            }
            catch (error) {
                logger_1.default.error(`[NotificationDispatcher] Unhandled exception during dispatch:`, error);
                const errResult = {
                    success: false,
                    status: "FAILED",
                    error: error.message || "Internal messaging dispatcher failure"
                };
                yield this.repository.recordDispatch(request, errResult);
                return errResult;
            }
            finally {
                // 5. Release in-flight lock
                idempotency_policy_1.IdempotencyPolicy.releaseLock(lockKey);
            }
        });
    }
    getProvider() {
        return this.provider;
    }
}
exports.NotificationDispatcherService = NotificationDispatcherService;
