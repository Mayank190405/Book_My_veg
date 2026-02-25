
import { Request, Response } from "express";
import { QRProcessingService } from "../services/qrProcessingService";
import logger from "../utils/logger";
import prisma from "../config/prisma";
import { Prisma } from "@prisma/client";

export const generateQr = async (req: Request, res: Response) => {
    const { orderId, amount, traceId } = req.body;

    try {
        // In a real scenario, we'd fetch merchant VPA from config/location settings
        const qrContent = QRProcessingService.generateUPIIntent({
            amount: new Prisma.Decimal(amount),
            vpa: process.env.MERCHANT_VPA || "merchant@upi",
            name: process.env.MERCHANT_NAME || "BMV Retail",
            transactionNote: `Payment for Order ${orderId}`,
            transactionId: traceId // TraceID used for idempotency
        });

        res.json({
            qrContent,
            traceId
        });
    } catch (error: any) {
        logger.error("QR Generation Error:", error);
        res.status(500).json({ message: "Error generating QR code" });
    }
};

/**
 * Mock Webhook Handler for UPI PSP.
 * In production, this would be an endpoint registered with the PSP.
 */
export const handleQrWebhook = async (req: Request, res: Response) => {
    const { transactionId, gatewayRef, amount, status, signature } = req.body;

    // Optional: Verify signature if using a real PSP
    // if (!QRProcessingService.verifySignature(JSON.stringify(req.body), signature, process.env.PSP_SECRET!)) {
    //     return res.status(403).json({ message: "Invalid Signature" });
    // }

    try {
        logger.info(`[QR Webhook] Received status ${status} for TX ${transactionId}`);

        const result = await QRProcessingService.processPaymentWebhook({
            transactionId,
            gatewayRef,
            amount: new Prisma.Decimal(amount),
            status: status.toUpperCase() === "SUCCESS" ? "SUCCESS" : "FAILED",
            metadata: req.body
        });

        res.json({ status: "OK", result });
    } catch (error: any) {
        logger.error("QR Webhook Processing Error:", error);
        res.status(500).json({ message: "Internal server error during webhook processing" });
    }
};
