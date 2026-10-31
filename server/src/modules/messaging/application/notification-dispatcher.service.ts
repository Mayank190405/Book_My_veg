/**
 * Book My Veg — Notification Dispatcher Service
 * Orchestrates template validation, idempotency guards, provider dispatch, and durable audit logs.
 */

import { IWhatsAppProvider } from "../infrastructure/providers/whatsapp-provider.interface";
import { MbgWhatsAppProvider } from "../infrastructure/providers/mbg-whatsapp.provider";
import { NotificationRepository } from "../infrastructure/repositories/notification.repository";
import { TemplateValidator } from "../templates/template-validator";
import { IdempotencyPolicy } from "../policies/idempotency.policy";
import { OutboundMessageRequest, ProviderSendResult } from "../domain/notification.types";
import logger from "../../../utils/logger";

export class NotificationDispatcherService {
    private static instance: NotificationDispatcherService;
    private provider: IWhatsAppProvider;
    private repository: NotificationRepository;

    private constructor(provider?: IWhatsAppProvider) {
        this.provider = provider || new MbgWhatsAppProvider();
        this.repository = NotificationRepository.getInstance();
    }

    public static getInstance(provider?: IWhatsAppProvider): NotificationDispatcherService {
        if (!NotificationDispatcherService.instance) {
            NotificationDispatcherService.instance = new NotificationDispatcherService(provider);
        }
        return NotificationDispatcherService.instance;
    }

    /**
     * Dispatches an outbound WhatsApp notification through the full policy and provider pipeline.
     */
    public async dispatch(request: OutboundMessageRequest): Promise<ProviderSendResult> {
        const lockKey = request.idempotencyKey || `msg:${request.recipientPhone}:${request.templateName}:${request.referenceId || "direct"}`;

        // 1. In-flight idempotency guard to prevent concurrent double-clicks
        const acquired = IdempotencyPolicy.acquireLock(lockKey);
        if (!acquired) {
            logger.warn(`[NotificationDispatcher] In-flight request detected for lockKey '${lockKey}'. Suppressing duplicate.`);
            return {
                success: false,
                status: "BLOCKED_BY_POLICY",
                error: "A message dispatch to this recipient is currently in-progress. Please wait."
            };
        }

        try {
            // 2. Validate template and sanitize parameters (newline stripping, utility policy)
            const validation = TemplateValidator.validateAndSanitize(
                request.templateName,
                request.variables
            );

            if (!validation.valid) {
                logger.warn(`[NotificationDispatcher] Template validation rejected '${request.templateName}': ${validation.error}`);
                const failResult: ProviderSendResult = {
                    success: false,
                    status: validation.blocked ? "BLOCKED_BY_POLICY" : "FAILED",
                    blocked: validation.blocked,
                    error: validation.error
                };
                await this.repository.recordDispatch(request, failResult);
                return failResult;
            }

            // Update with sanitized variables
            const sanitizedRequest: OutboundMessageRequest = {
                ...request,
                variables: validation.sanitizedVariables
            };

            // 3. Dispatch to external WhatsApp provider adapter
            const result = await this.provider.sendTemplate(sanitizedRequest);

            // 4. Record durable audit log entry
            await this.repository.recordDispatch(sanitizedRequest, result);

            return result;
        } catch (error: any) {
            logger.error(`[NotificationDispatcher] Unhandled exception during dispatch:`, error);
            const errResult: ProviderSendResult = {
                success: false,
                status: "FAILED",
                error: error.message || "Internal messaging dispatcher failure"
            };
            await this.repository.recordDispatch(request, errResult);
            return errResult;
        } finally {
            // 5. Release in-flight lock
            IdempotencyPolicy.releaseLock(lockKey);
        }
    }

    public getProvider(): IWhatsAppProvider {
        return this.provider;
    }
}

