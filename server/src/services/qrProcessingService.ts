
import { Prisma, OrderStatus } from "@prisma/client";
import prisma from "../config/prisma";
import { StateMachineService } from "./stateMachineService";
import crypto from "crypto";

export interface QRData {
    amount: number | Prisma.Decimal;
    vpa: string; // Merchant VPA
    name: string; // Merchant Name
    transactionNote: string;
    transactionId: string; // TraceID for idempotency
}

export class QRProcessingService {
    /**
     * Generates a UPI intent URL/String for QR generation.
     * Note: In a real production environment, this would integrate with a UPI PSP (PhonePe, GPay, etc.)
     */
    static generateUPIIntent(data: QRData): string {
        const amount = new Prisma.Decimal(data.amount).toFixed(2);
        // Standard UPI Deep Link Format
        return `upi://pay?pa=${data.vpa}&pn=${encodeURIComponent(data.name)}&tr=${data.transactionId}&tn=${encodeURIComponent(data.transactionNote)}&am=${amount}&cu=INR`;
    }

    /**
     * Handles an incoming payment notification/webhook.
     * MUST be idempotent.
     *
     * NOTE: Uses sequential atomic operations instead of interactive transactions,
     * because Prisma driver adapters (PrismaPg) do not support interactive ($transaction fn) transactions.
     */
    static async processPaymentWebhook(params: {
        transactionId: string; // Corresponding to 'tr' in UPI intent
        gatewayRef: string;    // Gateway-provided reference (e.g., UTR)
        amount: number | Prisma.Decimal;
        status: "SUCCESS" | "FAILED";
        metadata?: any;
    }) {
        try {
            // 1. Idempotency Check: Look for existing payment record
            const existingPayment = await prisma.payment.findFirst({
                where: { transactionId: params.transactionId }
            });

            if (existingPayment) {
                console.log(`[QR] Transaction ${params.transactionId} already processed.`);
                return { status: "ALREADY_PROCESSED", payment: existingPayment };
            }

            if (params.status === "SUCCESS") {
                // 2. Fetch the corresponding journal entry linked to this transactionId
                const journal = await prisma.journalEntry.findUnique({
                    where: { transactionId: params.transactionId }
                });

                if (!journal) {
                    throw new Error(`Critical: Payment received for unknown transaction ${params.transactionId}`);
                }

                const orderId = (journal.reference || "").replace("ORDER_", "");

                // 3. Confirm Order via StateMachine (runs its own transaction internally)
                await StateMachineService.transitionOrder({
                    orderId,
                    newState: OrderStatus.CONFIRMED,
                    remark: `UPI Payment Received (Ref: ${params.gatewayRef})`
                });

                // 4. Record Payment
                const payment = await prisma.payment.create({
                    data: {
                        orderId,
                        amount: new Prisma.Decimal(params.amount),
                        method: "UPI_QR",
                        status: "SUCCESS",
                        transactionId: params.transactionId,
                        metadata: {
                            gatewayRef: params.gatewayRef,
                            ...(params.metadata || {})
                        }
                    }
                });

                return { status: "SUCCESS", payment };
            } else {
                // Handle Failure (optional logic to release inventory holds if applicable)
                return { status: "FAILED" };
            }
        } catch (error: any) {
            console.error("[QRProcessingService] Webhook Error:", error.message || error);
            throw error;
        }
    }

    /**
     * Utility to verify payload signatures if coming from a real PSP.
     */
    static verifySignature(payload: string, signature: string, secret: string): boolean {
        const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
        return expected === signature;
    }
}
