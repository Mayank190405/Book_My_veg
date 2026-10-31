/**
 * Book My Veg — Messaging Controller
 */

import { Request, Response, NextFunction } from "express";
import { ReminderService } from "../application/reminder.service";
import { TemplateService } from "../application/template.service";
import { NotificationService } from "../application/notification.service";
import { AuthRequest } from "../../../middleware/auth";
import logger from "../../../utils/logger";

export class MessagingController {
    /**
     * POST /api/v1/messaging/reminders/due
     * Dispatches payment reminders for POS/Admin with strict 24h cooldown and atomic claim.
     */
    public static async sendDueReminders(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { customerIds, locationId } = req.body;
            const actorId = req.user?.userId;
            const scopedLocationId = locationId || req.user?.locationId;

            const service = ReminderService.getInstance();
            const summary = await service.sendDueReminders({
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
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/v1/messaging/reminders/single-order
     * Dispatches payment reminder for a single order with strict 24h cooldown and atomic claim.
     */
    public static async sendSingleOrderReminder(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { orderId, locationId } = req.body;
            const actorId = req.user?.userId;

            const service = ReminderService.getInstance();
            const result = await service.sendSingleOrderReminder(
                orderId,
                actorId,
                locationId || req.user?.locationId
            );

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
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/v1/messaging/templates
     * Retrieves live Meta templates synchronized with provider.
     */
    public static async getTemplates(req: Request, res: Response, next: NextFunction) {
        try {
            const service = TemplateService.getInstance();
            const templates = await service.syncAndGetTemplates();
            return res.json({ success: true, templates });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/v1/messaging/templates/send-custom
     * Dispatches custom template message with validation and durable audit record.
     */
    public static async sendCustomTemplate(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { phone, templateName, variables, dynamicMedia } = req.body;
            const actorId = req.user?.userId;

            const service = TemplateService.getInstance();
            const result = await service.sendCustomTemplate({
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
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/v1/messaging/chathub/send-flow
     */
    public static async sendChatHubFlow(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { phone, flowId, name, customFields } = req.body;
            const actorId = req.user?.userId;

            const service = NotificationService.getInstance();
            const result = await service.sendChatHubFlow(phone, flowId, name, customFields, actorId);

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
        } catch (error) {
            next(error);
        }
    }
}

