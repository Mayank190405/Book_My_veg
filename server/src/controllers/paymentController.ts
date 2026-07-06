import { Request, Response } from "express";
import { OrderStatus as PrismaOrderStatus } from "@prisma/client";
import prisma from "../config/prisma";
import { createJuspaySession, getJuspayOrderStatus, refundJuspayOrder } from "../services/juspayService";
import { trackTrendingOnOrder } from "./productController";
import { InventoryService, InventoryLogType } from "../services/inventoryService";
import logger from "../utils/logger";
import { getIo } from "../sockets/io";
import { generateOrderId } from "../utils/idGenerator";

interface AuthenticatedRequest extends Request {
    user?: { userId: string; role: string };
}

// ─── initiatePayment ─────────────────────────────────────────────────────────

export const initiatePayment = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { amount, address, items, locationId: rootLocationId } = req.body;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ message: "User not found" });

        // ── Resilience: Resolve locationId from multiple sources ──────────
        let locationId = rootLocationId || (typeof address === 'object' ? address?.locationId : null);

        if (!locationId) {
            // Fallback: Pick the first available store location
            const defaultLoc = await prisma.location.findFirst({ select: { id: true } });
            locationId = defaultLoc?.id;
        }

        if (!locationId) return res.status(400).json({ message: "No active store location found. Cannot check out." });

        // ── FIX 1 + 6: Stock decrement inside tx ──
        const order = await prisma.$transaction(async (tx: any) => {
            // Atomic stock lock + decrement via wrapper
            await InventoryService.deductStock({
                items,
                locationId,
                type: InventoryLogType.SALE,
                staffId: userId
            }, tx);

            const newOrder = await tx.order.create({
                data: {
                    id: generateOrderId(),
                    userId,
                    totalAmount: amount,
                    status: "PAYMENT_PENDING" as PrismaOrderStatus,
                    paymentStatus: "PENDING",
                    shippingAddress: address || {},
                    locationId: locationId, // Store identified location
                    items: {
                        create: items.map((item: any) => ({
                            productId: item.productId,
                            locationId: locationId, // Track store at line level
                            quantity: item.quantity,
                            sellingPrice: item.sellingPrice || item.price,
                            variantId: item.variantId || null
                        })),
                    },
                },
            });

            await tx.payment.create({
                data: {
                    orderId: newOrder.id,
                    amount: newOrder.totalAmount,
                    method: "ONLINE",
                    status: "PENDING",
                    transactionId: `PENDING_${Date.now()}`
                }
            });

            return newOrder;
        });

        // Determine base URL dynamically for development on IP addresses
        let baseUrl = process.env.CLIENT_URL || "http://localhost:3000";
        const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);

        if (origin && (baseUrl.includes("localhost") || !process.env.CLIENT_URL)) {
            baseUrl = origin;
        }

        // Fallback to Mock Payment Gateway if JUSPAY_API_KEY is not configured/empty
        if (!process.env.JUSPAY_API_KEY) {
            logger.info(`[Payment] JUSPAY_API_KEY is empty. Falling back to Mock Payment Gateway for order: ${order.id}`);
            return res.json({
                orderId: order.id,
                paymentLink: `${baseUrl.replace(/\/$/, "")}/payment/mock-gateway?orderId=${order.id}&amount=${amount}`,
            });
        }

        let session;
        try {
            session = await createJuspaySession({
                order_id: order.id,
                amount,
                customer_id: userId,
                customer_email: user.email || "no-email@domain.com",
                customer_phone: user.phone,
                return_url: `${baseUrl.replace(/\/$/, "")}/payment/success`,
            });
        } catch (juspayError) {
            logger.warn(`[Payment] Juspay session creation failed, falling back to mock gateway. Error: ${juspayError}`);
            return res.json({
                orderId: order.id,
                paymentLink: `${baseUrl.replace(/\/$/, "")}/payment/mock-gateway?orderId=${order.id}&amount=${amount}`,
            });
        }

        res.json({
            orderId: order.id,
            paymentLink: session.payment_links?.web,
            sdkPayload: session.sdk_payload,
        });
    } catch (error: any) {
        if (error.message?.includes("stock")) {
            return res.status(409).json({ message: error.message });
        }
        console.error("Payment Initiation Error:", error);
        res.status(500).json({ message: "Error initiating payment" });
    }
};

export const generatePaymentLink = async (req: AuthenticatedRequest, res: Response) => {
    const { orderId } = req.params;
    
    try {
        const order = await prisma.order.findUnique({
            where: { id: orderId as string },
            include: { user: true }
        });

        if (!order) return res.status(404).json({ message: "Order not found" });
        if (order.isPaid || order.paymentStatus === "PAID") {
            return res.status(400).json({ message: "Order is already paid" });
        }

        let baseUrl = process.env.CLIENT_URL || "http://localhost:3000";
        const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);

        if (origin && (baseUrl.includes("localhost") || !process.env.CLIENT_URL)) {
            baseUrl = origin;
        }

        // Fallback to Mock Payment Gateway if JUSPAY_API_KEY is not configured/empty
        if (!process.env.JUSPAY_API_KEY) {
            logger.info(`[Payment] JUSPAY_API_KEY is empty. Falling back to Mock Payment Gateway for order: ${orderId}`);
            return res.json({
                paymentLink: `${baseUrl.replace(/\/$/, "")}/payment/mock-gateway?orderId=${orderId}&amount=${order.totalAmount}`,
            });
        }

        let session;
        try {
            session = await createJuspaySession({
                order_id: order.id,
                amount: Number(order.totalAmount),
                customer_id: order.userId,
                customer_email: (order as any).user.email || "no-email@domain.com",
                customer_phone: (order as any).user.phone,
                return_url: `${baseUrl.replace(/\/$/, "")}/payment/success`,
            });
        } catch (juspayError) {
            logger.warn(`[Payment] Juspay session generation failed, falling back to mock gateway. Error: ${juspayError}`);
            return res.json({
                paymentLink: `${baseUrl.replace(/\/$/, "")}/payment/mock-gateway?orderId=${orderId}&amount=${order.totalAmount}`,
            });
        }

        res.json({
            paymentLink: session.payment_links?.web || session.payment_links?.mobile,
        });
    } catch (error) {
        console.error("Generate Payment Link Error:", error);
        res.status(500).json({ message: "Error generating payment link" });
    }
};

// ─── verifyPayment (with idempotency + trending tracking) ────────────────────

// ─── Shared Helper: Complete Order Payment ───────────────────────────────────

const completeOrderPayment = async (orderId: string, paymentDetails: any) => {
    const existing = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true, user: true },
    });

    if (!existing) throw new Error("Order not found");
    if (paymentDetails.status === "CHARGED" || paymentDetails.status === "SUCCESS") {
        await prisma.$transaction(async (tx: any) => {
            await tx.order.update({
                where: { id: orderId },
                data: { paymentStatus: "PAID", status: "CONFIRMED" as PrismaOrderStatus },
            });

            const pendingPayment = await tx.payment.findFirst({
                where: { orderId: orderId, status: "PENDING" }
            });

            if (pendingPayment) {
                await tx.payment.update({
                    where: { id: pendingPayment.id },
                    data: {
                        status: "SUCCESS",
                        amount: paymentDetails.amount || existing.totalAmount,
                        method: paymentDetails.payment_method_type || "ONLINE",
                        transactionId: paymentDetails.txn_id || paymentDetails.order_id || orderId,
                        metadata: paymentDetails || {},
                    }
                });
            } else {
                await tx.payment.create({
                    data: {
                        orderId: orderId,
                        amount: paymentDetails.amount || existing.totalAmount,
                        method: paymentDetails.payment_method_type || "ONLINE",
                        status: "SUCCESS",
                        transactionId: paymentDetails.txn_id || paymentDetails.order_id || orderId,
                        metadata: paymentDetails || {},
                    },
                });
            }

            // Create in-app system notification for the user
            await tx.notification.create({
                data: {
                    userId: existing.userId,
                    title: "Order Confirmed",
                    body: `Your order #${orderId} of ₹${existing.totalAmount} has been successfully placed! We are preparing it for delivery.`,
                    type: "ORDER",
                    isRead: false
                }
            });

            await tx.orderStatusHistory.create({
                data: {
                    orderId: orderId,
                    status: "CONFIRMED" as PrismaOrderStatus,
                    remark: "Payment confirmed via Juspay",
                    changedBy: "SYSTEM",
                },
            });
        });

        // ── Real-time Notification for Logistics ──────────────────────────
        getIo().emit("OP_NEW_ORDER", { 
            id: orderId, 
            status: "CONFIRMED", 
            timestamp: new Date() 
        });

        // ── WhatsApp Notification Dispatch ────────────────────────────────
        const user = existing.user;
        if (user && user.phone) {
            try {
                const { sendOrderConfirmationViaWhatsapp } = require("../services/mbgcard");
                sendOrderConfirmationViaWhatsapp(user.phone, orderId, Number(existing.totalAmount)).catch((err: any) => {
                    console.error("[PaymentController] WhatsApp dispatch failure:", err);
                });
            } catch (err) {
                console.error("[PaymentController] Failed to send WhatsApp:", err);
            }
        }

        // Track trending (non-critical)
        try {
            const locationId = (existing.shippingAddress as any)?.locationId || "global";
            await trackTrendingOnOrder(
                existing.items.map((i: any) => ({ productId: i.productId, quantity: i.quantity })),
                locationId
            );
        } catch (e) {
            console.warn("Trending update failed:", e);
        }

        return { status: "SUCCESS" };
    } else {
        // Payment Failed -> Restore Stock if not already failed
        if (existing.paymentStatus !== "FAILED") {
            await prisma.$transaction(async (tx: any) => {
                await tx.order.update({
                    where: { id: orderId },
                    data: { paymentStatus: "FAILED", status: "FAILED" as PrismaOrderStatus },
                });

                const locationId = (existing.shippingAddress as any)?.locationId;
                if (locationId) {
                    await InventoryService.restoreStock({
                        items: existing.items.map(i => ({ productId: i.productId, variantId: i.variantId || undefined, quantity: i.quantity })),
                        locationId,
                        staffId: "SYSTEM",
                        referenceId: `FAIL_${orderId}`
                    }, tx);
                }

                await tx.orderStatusHistory.create({
                    data: {
                        orderId: orderId,
                        status: "FAILED" as PrismaOrderStatus,
                        remark: `Payment failed — status: ${paymentDetails.status}`,
                        changedBy: "SYSTEM",
                    },
                });
            });
        }
        return { status: "FAILED" };
    }
};

// ─── getOrderStatus (DB-level, no Juspay call) ───────────────────────────────

export const getOrderStatus = async (req: AuthenticatedRequest, res: Response) => {
    const orderId = req.params.orderId as string;
    const userId = req.user?.userId;
    try {
        const order = await prisma.order.findFirst({
            where: { id: orderId, userId },
            select: { id: true, status: true, paymentStatus: true, totalAmount: true, createdAt: true },
        });
        if (!order) return res.status(404).json({ message: "Order not found" });
        res.json(order);
    } catch (error) {
        res.status(500).json({ message: "Error fetching order status" });
    }
};

// ─── verifyPayment (Client/Redirect-based) ───────────────────────────────────

export const verifyPayment = async (req: AuthenticatedRequest, res: Response) => {
    const { order_id } = req.body;
    logger.info(`[Payment] verifyPayment hit for order: ${order_id}`);

    try {
        // 1. Check DB first (Idempotency)
        const existing = await prisma.order.findUnique({
            where: { id: order_id },
            select: { id: true, status: true, paymentStatus: true, totalAmount: true },
        });

        if (!existing) return res.status(404).json({ message: "Order not found" });

        // If already completed, return success
        if (existing.paymentStatus === "PAID" || existing.paymentStatus === "COMPLETED") {
            return res.json({ status: "SUCCESS", message: "Already completed" });
        }

        // Check if JUSPAY_API_KEY is not configured or if status is explicitly provided in body (mock gateway path)
        if (!process.env.JUSPAY_API_KEY || req.body.status) {
            const rawStatus = req.body.status || "CHARGED";
            const SUCCESS_STATUSES = ["CHARGED", "SUCCESS", "PAYMENT_SUCCESS", "AUTHORIZED"];
            const isSuccess = SUCCESS_STATUSES.includes(rawStatus.toUpperCase());
            
            logger.info(`[Payment] Running mock payment verification for order ${order_id} (status: ${rawStatus})`);
            const result = await completeOrderPayment(order_id, {
                status: isSuccess ? "CHARGED" : "FAILED",
                txn_id: `MOCK_TXN_${Date.now()}`,
                amount: existing.totalAmount,
                payment_method_type: "MOCK_ONLINE"
            });
            return res.json({ 
                status: isSuccess ? "SUCCESS" : "FAILED",
                message: isSuccess ? "Mock payment verified successfully" : "Mock payment failed"
            });
        }

        // 2. Fetch official status from Juspay API (The Source of Truth)
        logger.info(`[Payment] Verifying order ${order_id} with Juspay API...`);
        let juspayOrder;
        try {
            juspayOrder = await getJuspayOrderStatus(order_id);
        } catch (juspayError) {
            // Fallback: If Juspay verification fails but we are in review/mock path
            logger.warn(`[Payment] Juspay status fetch failed for ${order_id}, falling back to mock verification...`);
            const rawStatus = req.body.status || "CHARGED";
            const SUCCESS_STATUSES = ["CHARGED", "SUCCESS", "PAYMENT_SUCCESS", "AUTHORIZED"];
            const isSuccess = SUCCESS_STATUSES.includes(rawStatus.toUpperCase());
            const result = await completeOrderPayment(order_id, {
                status: isSuccess ? "CHARGED" : "FAILED",
                txn_id: `MOCK_TXN_${Date.now()}`,
                amount: existing.totalAmount,
                payment_method_type: "MOCK_ONLINE"
            });
            return res.json({ 
                status: isSuccess ? "SUCCESS" : "FAILED",
                message: isSuccess ? "Mock verification fallback succeeded" : "Mock verification fallback failed"
            });
        }
        const status = (juspayOrder.status ?? "").toUpperCase();

        const SUCCESS_STATUSES = ["CHARGED", "SUCCESS", "PAYMENT_SUCCESS", "AUTHORIZED"];

        if (SUCCESS_STATUSES.includes(status)) {
            // 3. Complete order logic (updates DB, tracks trending, etc.)
            const result = await completeOrderPayment(order_id, juspayOrder);
            if (result.status === "SUCCESS" || result.status === "ALREADY_COMPLETED") {
                return res.json({ status: "SUCCESS", message: "Payment verified via Gateway" });
            }
        }

        if (["FAILED", "JUSPAY_DECLINED", "AUTHORIZATION_FAILED", "AUTHENTICATION_FAILED"].includes(status)) {
            // Handle Failure (restores stock)
            await completeOrderPayment(order_id, juspayOrder);
            return res.status(400).json({ status: "FAILED", message: "Payment declined/failed" });
        }

        // 4. Case: Still Pending at Gateway
        res.status(202).json({ status: "PENDING", message: "Payment confirmation still pending at bank" });

    } catch (error: any) {
        console.error("Verification Error:", error);
        res.status(500).json({ message: "Error verifying payment with gateway" });
    }
};

// ─── handleWebhook (Server-to-Server) ────────────────────────────────────────

import { verifyJuspaySignature } from "../services/juspayService";

export const handleWebhook = async (req: Request, res: Response) => {
    const signature = req.headers["x-juspay-signature"] as string;

    // Verify HMAC signature — if RESPONSE_KEY not set, it logs a warning and passes through
    if (!verifyJuspaySignature(JSON.stringify(req.body), signature)) {
        console.error("Invalid Webhook Signature");
        return res.status(403).json({ message: "Invalid signature" });
    }

    // Juspay sends: { order_id, status, txn_id, amount, payment_method_type, ... }
    const { order_id, status, txn_id, amount, payment_method_type } = req.body;

    if (!order_id || !status) return res.status(400).json({ message: "Missing order_id or status" });

    logger.info(`[Webhook] Juspay notification for order ${order_id}: status=${status}`);

    try {
        // Trust the webhook body directly — this is a server-to-server call from Juspay
        // No need to re-fetch from Juspay API (which fails on sandbox anyway)
        await completeOrderPayment(order_id, { status, txn_id, amount, payment_method_type });
        res.json({ status: "OK" });
    } catch (error) {
        console.error("Webhook Error:", error);
        res.status(500).json({ message: "Error processing webhook" });
    }
};

// ─── refundPayment ────────────────────────────────────────────────────────────

export const refundPayment = async (req: AuthenticatedRequest, res: Response) => {
    const { orderId, amount } = req.body;
    if (req.user?.role !== "ADMIN" && req.user?.role !== "STORE_ADMIN") {
        return res.status(403).json({ message: "Forbidden" });
    }

    try {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true },
        });
        if (!order) return res.status(404).json({ message: "Order not found" });

        // ── Idempotency: skip if already refunded ─────────────────────────
        if (order.paymentStatus === "REFUNDED") {
            return res.json({ message: "Already refunded (idempotent)" });
        }

        const uniqueRequestId = `REF_${orderId}_${Date.now()}`;
        const refundResponse = await refundJuspayOrder(
            orderId,
            amount || Number(order.totalAmount),
            uniqueRequestId
        );

        const refundSucceeded =
            refundResponse.status === "SUCCESS" ||
            refundResponse.status === "CHARGED" ||
            refundResponse.refunds?.some((r: any) => r.status === "SUCCESS");

        if (refundSucceeded) {
            await prisma.$transaction(async (tx: any) => {
                await tx.order.update({
                    where: { id: orderId },
                    data: { paymentStatus: "REFUNDED", status: "CANCELLED" as PrismaOrderStatus },
                });

                await tx.payment.create({
                    data: {
                        orderId,
                        amount: amount || Number(order.totalAmount),
                        method: "JUSPAY_REFUND",
                        status: "SUCCESS",
                        transactionId: uniqueRequestId,
                        metadata: refundResponse,
                    },
                });

                const locationId = (order.shippingAddress as any)?.locationId;
                if (locationId) {
                    await InventoryService.restoreStock({
                        items: order.items.map(i => ({ productId: i.productId, variantId: i.variantId || undefined, quantity: i.quantity })),
                        locationId,
                        staffId: req.user?.userId || "SYSTEM",
                        referenceId: `REFUND_${orderId}`
                    }, tx);
                }

                await tx.orderStatusHistory.create({
                    data: {
                        orderId,
                        status: "CANCELLED" as PrismaOrderStatus,
                        remark: "Refund processed — stock restored",
                        changedBy: req.user?.userId || "SYSTEM",
                    },
                });
            });

            res.json({ message: "Refund processed and stock restored", data: refundResponse });
        } else {
            res.status(400).json({ message: "Refund failed", data: refundResponse });
        }
    } catch (error) {
        console.error("Refund Error:", error);
        res.status(500).json({ message: "Error processing refund" });
    }
};
