import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { NotificationService, TemplateService } from "../modules/messaging";

/**
 * Endpoint to trigger an arbitrary ChatHub flow for a contact.
 * POST /api/v1/chathub/send-flow
 */
export const sendFlowHandler = async (req: AuthRequest, res: Response) => {
    try {
        const { phone, flowId, name, customFields } = req.body;

        if (!phone || !flowId) {
            return res.status(400).json({
                success: false,
                message: "Phone and flowId are required"
            });
        }

        const result = await NotificationService.getInstance().sendChatHubFlow(
            phone,
            flowId,
            name,
            customFields,
            req.user?.userId
        );

        return res.status(200).json({
            success: result.success,
            message: result.success ? "Flow triggered successfully" : (result.error || "Failed to trigger flow"),
            data: result
        });
    } catch (error: any) {
        console.error("sendFlowHandler error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to send flow via ChatHub",
            error: error.message || error
        });
    }
};

/**
 * Endpoint to trigger an arbitrary ChatHub template message.
 * POST /api/v1/chathub/send-template
 */
export const sendTemplateHandler = async (req: AuthRequest, res: Response) => {
    try {
        const { phone, templateName, variables, dynamicMedia } = req.body;

        if (!phone || !templateName) {
            return res.status(400).json({
                success: false,
                message: "Phone and templateName are required"
            });
        }

        const result = await TemplateService.getInstance().sendCustomTemplate({
            phone,
            templateName,
            variables,
            dynamicMedia,
            actorId: req.user?.userId,
            triggerSource: "CHATHUB_API"
        });

        return res.status(result.success ? 200 : 400).json({
            success: result.success,
            message: result.success ? "Template message triggered successfully" : (result.error || "Failed to dispatch template"),
            data: result
        });
    } catch (error: any) {
        console.error("sendTemplateHandler error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to send template via ChatHub",
            error: error.message || error
        });
    }
};
