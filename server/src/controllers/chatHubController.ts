import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { sendFlowViaChatHub, sendTemplateViaChatHub } from "../services/mbgcard";

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

        const result = await sendFlowViaChatHub(phone, flowId, name, customFields);

        return res.status(200).json({
            success: true,
            message: "Flow triggered successfully",
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

        const result = await sendTemplateViaChatHub(phone, templateName, variables, dynamicMedia);

        return res.status(200).json({
            success: true,
            message: "Template message triggered successfully",
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
