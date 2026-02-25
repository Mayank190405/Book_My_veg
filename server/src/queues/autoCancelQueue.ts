/**
 * Auto-Cancel Queue
 * Schedules order cancellation + inventory restore after 12 minutes
 * if payment is still PENDING (i.e. user abandoned the payment flow).
 *
 * Usage: call scheduleOrderAutoCancel(orderId) immediately after creating
 * a PAYMENT_PENDING order.
 */

import Bull from "bull";
import { OrderStatus } from "@prisma/client";
import prisma from "../config/prisma";
import logger from "../utils/logger";
import { InventoryService } from "../services/inventoryService";

// ── Queue definition ──────────────────────────────────────────────────────────
export const autoCancelQueue = new Bull("order-auto-cancel", {
    redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: Number(process.env.REDIS_PORT) || 6379,
    },
});

const AUTO_CANCEL_DELAY_MS = 12 * 60 * 1000; // 12 minutes

// ── Schedule ──────────────────────────────────────────────────────────────────
export async function scheduleOrderAutoCancel(orderId: string): Promise<void> {
    await autoCancelQueue.add(
        { orderId },
        {
            delay: AUTO_CANCEL_DELAY_MS,
            attempts: 3,
            backoff: { type: "fixed", delay: 5000 },
            jobId: `auto-cancel:${orderId}`, // deduplicate retries
            removeOnComplete: true,
            removeOnFail: false,
        }
    );
    logger.info("Auto-cancel scheduled", { orderId, delayMs: AUTO_CANCEL_DELAY_MS });
}

// ── Worker ────────────────────────────────────────────────────────────────────
autoCancelQueue.process(async (job) => {
    const { orderId } = job.data as { orderId: string };

    logger.info("Auto-cancel job triggered", { orderId });

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
    });

    if (!order) {
        logger.warn("Auto-cancel: order not found", { orderId });
        return;
    }

    // Only cancel if still unpaid
    if (order.paymentStatus !== "PENDING") {
        logger.info("Auto-cancel skipped — already paid/failed", {
            orderId,
            paymentStatus: order.paymentStatus,
        });
        return;
    }

    await prisma.$transaction(async (tx: any) => {
        // Mark order FAILED
        await tx.order.update({
            where: { id: orderId },
            data: {
                status: "FAILED" as OrderStatus,
                paymentStatus: "FAILED",
            },
        });

        // Record status history
        await tx.orderStatusHistory.create({
            data: {
                orderId,
                status: "FAILED" as OrderStatus,
                remark: "Auto-cancelled: payment not received within 12 minutes",
                changedBy: "SYSTEM",
            },
        });

        // Restore inventory via locked wrapper
        const locationId = (order.shippingAddress as any)?.locationId;
        if (locationId) {
            await InventoryService.restoreStock({
                items: order.items.map(i => ({ productId: i.productId, variantId: i.variantId || undefined, quantity: i.quantity })),
                locationId,
                staffId: "SYSTEM",
                referenceId: `AUTO_CANCEL_${orderId}`
            }, tx);
        }
    });

    logger.info("Auto-cancel complete — stock restored", {
        orderId,
        itemCount: order.items.length,
    });
});

// ── Queue-level error logging ─────────────────────────────────────────────────
autoCancelQueue.on("failed", (job: any, err: any) => {
    logger.error("Auto-cancel job failed", { jobId: job.id, orderId: job.data.orderId, err: err.message });
});

autoCancelQueue.on("error", (err: any) => {
    logger.error("Auto-cancel queue error", { err: err.message });
});
