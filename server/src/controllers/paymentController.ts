import { Request, Response, NextFunction } from "express";
import { OrderStatus as PrismaOrderStatus } from "@prisma/client";
import prisma from "../config/prisma";
import { createJuspaySession, getJuspayOrderStatus, refundJuspayOrder } from "../services/juspayService";
import { trackTrendingOnOrder } from "./productController";
import { InventoryService, InventoryLogType } from "../services/inventoryService";
import logger from "../utils/logger";
import { getIo } from "../sockets/io";
import { generateOrderId } from "../utils/idGenerator";
import axios from "axios";
import crypto from "crypto";
import { getPaymentEligibility } from "../services/paymentEligibilityService";

const generateSha512 = (str: string) => {
    return crypto.createHash("sha512").update(str).digest("hex").toLowerCase();
};

const getEasebuzzReverseHash = (body: any, salt: string) => {
    const hashSequence = [
        salt,
        body.status || '',
        body.udf10 || '',
        body.udf9 || '',
        body.udf8 || '',
        body.udf7 || '',
        body.udf6 || '',
        body.udf5 || '',
        body.udf4 || '',
        body.udf3 || '',
        body.udf2 || '',
        body.udf1 || '',
        body.email || '',
        body.firstname || '',
        body.productinfo || '',
        body.amount || '',
        body.txnid || '',
        body.key || ''
    ].join('|');
    return generateSha512(hashSequence);
};

const sanitizePhone = (phone: string | null | undefined): string => {
    if (!phone) return "9999999999";
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("91") && digits.length === 12) {
        return digits.substring(2);
    }
    return digits || "9999999999";
};

interface AuthenticatedRequest extends Request {
    user?: { userId: string; role: string };
}

interface EasebuzzInitiateParams {
    txnid: string;
    amount: number;
    firstname: string;
    email: string;
    phone: string;
    productinfo: string;
    callbackUrl: string;
}

const callEasebuzzInitiateApi = async (params: EasebuzzInitiateParams) => {
    const key = process.env.EASEBUZZ_KEY || process.env.EASEBUZZ_MERCHANT_KEY;
    const salt = process.env.EASEBUZZ_SALT;
    const env = process.env.EASEBUZZ_ENV || process.env.ENV || "test";
    const serviceUrl = process.env.EASEBUZZ_SERVICE_URL;
    const useIframe = process.env.EASEBUZZ_IFRAME !== "0"; // Default to true for Easebuzz iframe popup modal

    if (!key) {
        throw new Error("Easebuzz Key / Merchant Key not configured in environment variables");
    }

    if (serviceUrl) {
        try {
            const apiName = "initiate_payment_iframe";
            const easebuzzRes = await axios.post(
                `${serviceUrl.replace(/\/$/, "")}/easebuzz?api_name=${apiName}`,
                {
                    txnid: params.txnid,
                    amount: params.amount.toFixed(2),
                    firstname: params.firstname,
                    email: params.email,
                    phone: sanitizePhone(params.phone),
                    productinfo: params.productinfo,
                    surl: params.callbackUrl,
                    furl: params.callbackUrl,
                },
                {
                    headers: { "Accept": "application/json", "Content-Type": "application/json" },
                    timeout: 10000
                }
            );

            if (easebuzzRes.data && easebuzzRes.data.status === 1) {
                const rawData = easebuzzRes.data.data;
                const accessKey = typeof rawData === "string" ? rawData : (rawData?.access_key || rawData);
                return {
                    iframe: true,
                    key: rawData?.key || key,
                    accessKey,
                    env: rawData?.env || (env === "prod" ? "prod" : "test"),
                    paymentLink: easebuzzRes.data.paymentLink || `https://${env === "prod" ? "pay" : "testpay"}.easebuzz.in/pay/${accessKey}`
                };
            }
            logger.warn(`[Easebuzz] Microservice returned non-success, falling through to direct API: ${easebuzzRes.data?.message}`);
        } catch (serviceErr: any) {
            logger.warn(`[Easebuzz] Microservice failed (${serviceErr.message}), falling through to direct API`);
        }
    }

    if (key && salt) {
        const amountStr = params.amount.toFixed(2);
        const productInfo = (params.productinfo || "Bill Payment").replace(/[^a-zA-Z0-9 ]/g, "").trim() || "Bill Payment";
        const firstname = (params.firstname || "Customer").replace(/[^a-zA-Z0-9 ]/g, "").trim() || "Customer";
        const email = params.email;
        const phone = sanitizePhone(params.phone);
        const surl = params.callbackUrl;
        const furl = params.callbackUrl;

        const hashSequence = `${key}|${params.txnid}|${amountStr}|${productInfo}|${firstname}|${email}|||||||||||${salt}`;
        const hash = generateSha512(hashSequence);
        const baseUrl = env === "prod" ? "https://pay.easebuzz.in" : "https://testpay.easebuzz.in";

        const formData = new URLSearchParams({
            key,
            txnid: params.txnid,
            amount: amountStr,
            productinfo: productInfo,
            firstname,
            email,
            phone,
            surl,
            furl,
            hash
        });

        const directRes = await axios.post(
            `${baseUrl}/payment/initiateLink`,
            formData.toString(),
            {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                timeout: 15000
            }
        );

        if (directRes.data && directRes.data.status === 1 && directRes.data.data) {
            const accessKey = directRes.data.data;
            return {
                iframe: true,
                key,
                accessKey,
                env: env === "prod" ? "prod" : "test",
                paymentLink: `${baseUrl}/pay/${accessKey}`
            };
        }
        throw new Error(directRes.data?.error_desc || directRes.data?.data || "Easebuzz direct initiation failed");
    }

    throw new Error("Easebuzz environment keys (EASEBUZZ_KEY/EASEBUZZ_SALT) are missing");
};

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

        // Easebuzz Integration Pathway
        if (process.env.EASEBUZZ_KEY || process.env.EASEBUZZ_MERCHANT_KEY) {
    logger.info(`[Payment] Using Easebuzz Payment Gateway for order: ${order.id}`);
    try {
        const protocol = req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
        const callbackUrl = `${protocol}://${req.headers.host}/api/v1/payments/easebuzz/callback`;

        const addressObj = address as any;
        const customerName = addressObj?.name || user.name || "Customer";
        const customerPhone = addressObj?.phone || user.phone || "9999999999";

        const easeResult = await callEasebuzzInitiateApi({
            txnid: order.id,
            amount: Number(amount),
            firstname: customerName,
            email: user.email || "customer@example.com",
            phone: customerPhone,
            productinfo: `Order ${order.id}`,
            callbackUrl
        });

        return res.json({
            orderId: order.id,
            ...easeResult
        });
    } catch (easebuzzError: any) {
        logger.error(`[Payment] Easebuzz initiation failed, falling back to mock gateway. Error: ${easebuzzError.message}`);
        return res.json({
            orderId: order.id,
            paymentLink: `${baseUrl.replace(/\/$/, "")}/payment/mock-gateway?orderId=${order.id}&amount=${amount}`,
        });
    }
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

        // Easebuzz Integration Pathway
        if (process.env.EASEBUZZ_SERVICE_URL && process.env.EASEBUZZ_MERCHANT_KEY) {
            logger.info(`[Payment] Using Easebuzz Payment Gateway for generating link: ${orderId}`);
            
            const pendingOnlinePayment = await prisma.payment.findFirst({
                where: { orderId: order.id, method: "ONLINE", status: "PENDING" }
            });
            const amountToCharge = pendingOnlinePayment 
                ? Number(pendingOnlinePayment.amount).toFixed(2)
                : Number(order.totalAmount).toFixed(2);

            try {
                const protocol = req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
                const callbackUrl = `${protocol}://${req.headers.host}/api/v1/payments/easebuzz/callback`;

                const addressObj = order.shippingAddress as any;
                const customerName = addressObj?.name || (order as any).user.name || "Customer";
                const customerPhone = addressObj?.phone || (order as any).user.phone || "9999999999";

                const useIframe = process.env.EASEBUZZ_IFRAME === "1";
                const apiName = useIframe ? "initiate_payment_iframe" : "initiate_payment";

                const easebuzzRes = await axios.post(
                    `${process.env.EASEBUZZ_SERVICE_URL.replace(/\/$/, "")}/easebuzz?api_name=${apiName}`,
                    {
                        txnid: order.id,
                        amount: amountToCharge,
                        firstname: customerName,
                        email: (order as any).user.email || "customer@example.com",
                        phone: sanitizePhone(customerPhone),
                        productinfo: `Order ${order.id}`,
                        surl: callbackUrl,
                        furl: callbackUrl,
                    },
                    {
                        headers: {
                            "Accept": "application/json",
                            "Content-Type": "application/json"
                        }
                    }
                );

                if (easebuzzRes.data && easebuzzRes.data.status === 1) {
                    if (useIframe) {
                        return res.json({
                            iframe: true,
                            key: easebuzzRes.data.data.key,
                            accessKey: easebuzzRes.data.data.access_key,
                            env: easebuzzRes.data.data.env,
                        });
                    } else if (easebuzzRes.data.paymentLink) {
                        return res.json({
                            paymentLink: easebuzzRes.data.paymentLink,
                        });
                    }
                }
                throw new Error(easebuzzRes.data?.message || "Failed to initiate payment with Easebuzz");
            } catch (easebuzzError: any) {
                logger.error(`[Payment] Easebuzz generation failed, falling back to mock gateway. Error: ${easebuzzError.message}, Data: ${JSON.stringify(easebuzzError.response?.data)}`);
                return res.json({
                    paymentLink: `${baseUrl.replace(/\/$/, "")}/payment/mock-gateway?orderId=${orderId}&amount=${amountToCharge}`,
                });
            }
        }

        const pendingOnlinePaymentFallback = await prisma.payment.findFirst({
            where: { orderId: order.id, method: "ONLINE", status: "PENDING" }
        });
        const amountToChargeFallback = pendingOnlinePaymentFallback 
            ? Number(pendingOnlinePaymentFallback.amount).toFixed(2)
            : Number(order.totalAmount).toFixed(2);

        // Fallback to Mock Payment Gateway if JUSPAY_API_KEY is not configured/empty
        if (!process.env.JUSPAY_API_KEY) {
            logger.info(`[Payment] JUSPAY_API_KEY is empty. Falling back to Mock Payment Gateway for order: ${orderId}`);
            return res.json({
                paymentLink: `${baseUrl.replace(/\/$/, "")}/payment/mock-gateway?orderId=${orderId}&amount=${amountToChargeFallback}`,
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

export const settleDuesForCustomer = async (userId: string, amount: number, transactionId: string, metadata: any) => {
    let remaining = Number(amount);
    if (!remaining || remaining <= 0) return;

    await prisma.$transaction(async (tx: any) => {
        let targetUserId = userId;
        const userExists = await tx.user.findUnique({ where: { id: userId } });
        if (!userExists) {
            const cleanPhone = userId.replace(/\D/g, "");
            const foundUser = await tx.user.findFirst({
                where: { OR: [{ phone: userId }, { phone: cleanPhone }, { phone: `+91${cleanPhone}` }] }
            });
            if (foundUser) targetUserId = foundUser.id;
        }

        const unpaid = await tx.order.findMany({
            where: {
                userId: targetUserId,
                paymentStatus: { in: ["PENDING", "PARTIAL"] },
                status: { notIn: ["CANCELLED", "FAILED", "PAYMENT_PENDING"] }
            },
            orderBy: { createdAt: "asc" },
            include: { payments: true }
        });

        const effectiveTxnId = transactionId || `SETTLE_${Date.now()}`;

        for (const order of unpaid) {
            if (remaining <= 0) break;
            const paid = order.payments.filter((p: any) => p.status === "SUCCESS").reduce((acc: number, p: any) => acc + Number(p.amount), 0);
            const due = Number(order.totalAmount) - paid;
            const toApply = Math.min(remaining, due);

            if (toApply > 0) {
                await tx.payment.create({
                    data: {
                        orderId: order.id,
                        amount: toApply,
                        method: metadata?.payment_method_type || "EASEBUZZ",
                        status: "SUCCESS",
                        transactionId: `${effectiveTxnId}_${order.id.slice(0, 6)}`,
                        metadata: metadata || {}
                    }
                });

                const totalPaidNow = paid + toApply;
                const isFull = totalPaidNow >= Number(order.totalAmount);
                await tx.order.update({
                    where: { id: order.id },
                    data: {
                        isPaid: isFull,
                        paymentStatus: isFull ? "COMPLETED" : "PARTIAL"
                    }
                });
                remaining -= toApply;
            }
        }
    });
};

const completeOrderPayment = async (orderId: string, paymentDetails: any) => {
    let resolvedOrderId = orderId;
    if (orderId && !orderId.startsWith("DUE_") && !orderId.startsWith("SETTLE_")) {
        resolvedOrderId = orderId.replace(/_\d{3,}$/, "");
    }

    let existing = await prisma.order.findUnique({
        where: { id: resolvedOrderId },
        include: { items: true, user: true },
    });

    if (!existing) {
        if (orderId.startsWith("SETTLE_")) {
            const parts = orderId.split("_");
            const targetId = parts[1];
            if (paymentDetails.status === "CHARGED" || paymentDetails.status === "SUCCESS") {
                await settleDuesForCustomer(targetId, Number(paymentDetails.amount), paymentDetails.txn_id || orderId, paymentDetails);
                return { status: "SUCCESS" };
            }
        } else if (orderId.startsWith("DUE_")) {
            const parts = orderId.split("_");
            const targetId = parts[1];
            if (paymentDetails.status === "CHARGED" || paymentDetails.status === "SUCCESS") {
                // Check if targetId is an order ID directly
                const targetOrder = await prisma.order.findUnique({ where: { id: targetId }, include: { items: true, user: true } });
                if (targetOrder) {
                    resolvedOrderId = targetId;
                    existing = targetOrder;
                } else {
                    await settleDuesForCustomer(targetId, Number(paymentDetails.amount), paymentDetails.txn_id || orderId, paymentDetails);
                    return { status: "SUCCESS" };
                }
            }
        }
        if (!existing) {
            throw new Error("Order not found");
        }
    }
    if (paymentDetails.status === "CHARGED" || paymentDetails.status === "SUCCESS") {
        await prisma.$transaction(async (tx: any) => {
            // Record the payment first
            const pendingPayment = await tx.payment.findFirst({
                where: { orderId: resolvedOrderId, status: "PENDING", method: "ONLINE" }
            }) || await tx.payment.findFirst({
                where: { orderId: resolvedOrderId, status: "PENDING" }
            });

            if (pendingPayment) {
                await tx.payment.update({
                    where: { id: pendingPayment.id },
                    data: {
                        status: "SUCCESS",
                        amount: paymentDetails.amount || pendingPayment.amount,
                        method: paymentDetails.payment_method_type || pendingPayment.method,
                        transactionId: paymentDetails.txn_id || paymentDetails.order_id || orderId,
                        metadata: paymentDetails || {},
                    }
                });
            } else {
                await tx.payment.create({
                    data: {
                        orderId: resolvedOrderId,
                        amount: paymentDetails.amount || existing.totalAmount,
                        method: paymentDetails.payment_method_type || "ONLINE",
                        status: "SUCCESS",
                        transactionId: paymentDetails.txn_id || paymentDetails.order_id || orderId,
                        metadata: paymentDetails || {},
                    },
                });
            }

            // Now recalculate total paid from ALL successful payments
            const allPayments = await tx.payment.findMany({
                where: { orderId: resolvedOrderId, status: "SUCCESS" }
            });
            const totalPaid = allPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
            const orderTotal = Number(existing.totalAmount);
            const isFull = totalPaid >= orderTotal;

            // Determine payment status
            const newPaymentStatus = isFull ? "COMPLETED" : "PARTIAL";

            // Only update status to CONFIRMED if order is still in a pre-confirmed state
            // Do NOT revert DELIVERED/SHIPPED/etc. orders back to CONFIRMED
            const nonRevertableStatuses = ["DELIVERED", "SHIPPED", "OUT_FOR_DELIVERY", "COMPLETED"];
            const shouldUpdateStatus = !nonRevertableStatuses.includes(existing.status);

            await tx.order.update({
                where: { id: resolvedOrderId },
                data: {
                    isPaid: isFull,
                    paymentStatus: newPaymentStatus,
                    ...(shouldUpdateStatus && { status: "CONFIRMED" as PrismaOrderStatus }),
                },
            });

            // Create in-app system notification for the user
            const notifTitle = isFull ? "Payment Complete" : "Payment Received";
            const notifBody = isFull
                ? `Your bill #${resolvedOrderId} of ₹${orderTotal} has been fully paid. Thank you!`
                : `Payment of ₹${Number(paymentDetails.amount).toFixed(2)} received for bill #${resolvedOrderId}. Remaining: ₹${(orderTotal - totalPaid).toFixed(2)}`;

            await tx.notification.create({
                data: {
                    userId: existing.userId,
                    title: notifTitle,
                    body: notifBody,
                    type: "ORDER",
                    isRead: false
                }
            });

            await tx.orderStatusHistory.create({
                data: {
                    orderId: resolvedOrderId,
                    status: (shouldUpdateStatus ? "CONFIRMED" : existing.status) as PrismaOrderStatus,
                    remark: `Payment of ₹${Number(paymentDetails.amount).toFixed(2)} received via ${paymentDetails.payment_method_type || "ONLINE"}${isFull ? " (Fully Paid)" : " (Partial)"}`,
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
                const { sendPaymentReceivedViaWhatsapp } = require("../services/mbgcard");
                sendPaymentReceivedViaWhatsapp(
                    user.phone, 
                    user.name || "Customer", 
                    orderId, 
                    Number(paymentDetails.amount || existing.totalAmount), 
                    paymentDetails.payment_method_type || "ONLINE"
                ).catch((err: any) => {
                    console.error("[PaymentController] WhatsApp Payment Received dispatch failure:", err);
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
        // Payment Failed or Cancelled -> Purge draft order and restore stock so NO bill is created
        if (existing && existing.paymentStatus !== "COMPLETED" && existing.paymentStatus !== "PAID" && !existing.isPaid) {
            await prisma.$transaction(async (tx: any) => {
                const locationId = (existing.shippingAddress as any)?.locationId || existing.locationId;
                if (locationId) {
                    await InventoryService.restoreStock({
                        items: existing.items.map(i => ({ productId: i.productId, variantId: i.variantId || undefined, quantity: i.quantity })),
                        locationId,
                        staffId: "SYSTEM",
                        referenceId: `FAIL_PURGE_${orderId}`
                    }, tx);
                }

                await tx.orderItem.deleteMany({ where: { orderId } });
                await tx.payment.deleteMany({ where: { orderId } });
                await tx.orderStatusHistory.deleteMany({ where: { orderId } });
                await tx.order.delete({ where: { id: orderId } });
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
    const { order_id, status: rawStatus, amount: bodyAmount, txn_id } = req.body;
    logger.info(`[Payment] verifyPayment hit for order: ${order_id}`);

    try {
        let resolvedOrderId = order_id || "";
        if (order_id && !order_id.startsWith("DUE_") && !order_id.startsWith("SETTLE_")) {
            resolvedOrderId = order_id.replace(/_\d{3,}$/, "");
        }

        if (resolvedOrderId && (resolvedOrderId.startsWith("SETTLE_") || resolvedOrderId.startsWith("DUE_"))) {
            const SUCCESS_STATUSES = ["CHARGED", "SUCCESS", "PAYMENT_SUCCESS", "AUTHORIZED"];
            const isSuccess = rawStatus ? SUCCESS_STATUSES.includes((rawStatus as string).toUpperCase()) : false;

            if (!isSuccess) {
                return res.status(400).json({
                    status: "FAILED",
                    message: "Settlement payment was cancelled or failed"
                });
            }

            await completeOrderPayment(resolvedOrderId, {
                status: "CHARGED",
                txn_id: txn_id || `TXN_${Date.now()}`,
                amount: Number(bodyAmount || 0),
                payment_method_type: "ONLINE"
            });

            return res.json({ 
                status: "SUCCESS",
                message: "Account settlement payment completed successfully"
            });
        }

        // 1. Check DB first (Idempotency)
        const existing = await prisma.order.findUnique({
            where: { id: resolvedOrderId },
            select: { id: true, status: true, paymentStatus: true, totalAmount: true },
        });

        if (!existing) return res.status(404).json({ message: "Order not found" });

        // If already completed, return success
        if (existing.paymentStatus === "PAID" || existing.paymentStatus === "COMPLETED") {
            return res.json({ status: "SUCCESS", message: "Already completed" });
        }

        // Check if status is explicitly provided in body
        if (req.body.status) {
            const rawStatus = req.body.status;
            const SUCCESS_STATUSES = ["CHARGED", "SUCCESS", "PAYMENT_SUCCESS", "AUTHORIZED"];
            const isSuccess = SUCCESS_STATUSES.includes(rawStatus.toUpperCase());
            
            if (!isSuccess) {
                logger.info(`[Payment] Payment verification received non-success status '${rawStatus}' for order ${resolvedOrderId}`);
                
                // Purge draft order & restore stock so no bill is created
                const orderToPurge = await prisma.order.findUnique({
                    where: { id: resolvedOrderId },
                    include: { items: true }
                });

                if (orderToPurge && !orderToPurge.isPaid && orderToPurge.paymentStatus !== "COMPLETED" && orderToPurge.paymentStatus !== "PAID") {
                    await prisma.$transaction(async (tx: any) => {
                        const locationId = (orderToPurge.shippingAddress as any)?.locationId || orderToPurge.locationId;
                        if (locationId) {
                            await InventoryService.restoreStock({
                                items: orderToPurge.items.map(i => ({ productId: i.productId, variantId: i.variantId || undefined, quantity: i.quantity })),
                                locationId,
                                staffId: "SYSTEM",
                                referenceId: `CANCEL_PURGE_${resolvedOrderId}`
                            }, tx);
                        }

                        await tx.orderItem.deleteMany({ where: { orderId: resolvedOrderId } });
                        await tx.payment.deleteMany({ where: { orderId: resolvedOrderId } });
                        await tx.orderStatusHistory.deleteMany({ where: { orderId: resolvedOrderId } });
                        await tx.order.delete({ where: { id: resolvedOrderId } });
                    });
                }

                return res.status(400).json({ 
                    status: "FAILED",
                    message: `Payment was cancelled or failed (status: ${rawStatus}). Bill was not created.`
                });
            }

            logger.info(`[Payment] Running payment verification for order ${resolvedOrderId} (status: ${rawStatus})`);
            await completeOrderPayment(resolvedOrderId, {
                status: "CHARGED",
                txn_id: txn_id || `TXN_${Date.now()}`,
                amount: Number(bodyAmount || existing.totalAmount),
                payment_method_type: "ONLINE"
            });
            return res.json({ 
                status: "SUCCESS",
                message: "Payment verified successfully"
            });
        }

        // Easebuzz Verification Pathway
        if (process.env.EASEBUZZ_SERVICE_URL && process.env.EASEBUZZ_MERCHANT_KEY) {
            logger.info(`[Payment] Verifying order ${order_id} with Easebuzz...`);
            try {
                const easebuzzRes = await axios.post(
                    `${process.env.EASEBUZZ_SERVICE_URL.replace(/\/$/, "")}/easebuzz?api_name=transaction`,
                    { txnid: order_id },
                    {
                        headers: {
                            "Accept": "application/json",
                            "Content-Type": "application/json"
                        }
                    }
                );

                const txData = easebuzzRes.data;
                logger.info(`[Payment] Easebuzz verification response: ${JSON.stringify(txData)}`);

                if (!txData || txData.status === 0 || !txData.detail) {
                    throw new Error(txData?.message || "Transaction not found on Easebuzz");
                }

                const detail = txData.detail;
                const status = (detail.status ?? "").toUpperCase();

                const SUCCESS_STATUSES = ["SUCCESS", "CHARGED", "PAYMENT_SUCCESS"];

                if (SUCCESS_STATUSES.includes(status)) {
                    await completeOrderPayment(order_id, {
                        status: "CHARGED",
                        txn_id: detail.easepayid || detail.txnid || order_id,
                        amount: Number(detail.amount || existing.totalAmount),
                        payment_method_type: detail.mode || "ONLINE"
                    });
                    return res.json({ status: "SUCCESS", message: "Payment verified via Easebuzz" });
                }

                if (["FAILED", "FAILURE", "BOUNCED", "ERROR"].includes(status)) {
                    await completeOrderPayment(order_id, {
                        status: "FAILED",
                        txn_id: detail.easepayid || detail.txnid || order_id,
                        amount: Number(detail.amount || existing.totalAmount),
                        payment_method_type: detail.mode || "ONLINE"
                    });
                    return res.status(400).json({ status: "FAILED", message: "Payment failed/declined" });
                }

                return res.status(202).json({ status: "PENDING", message: `Payment confirmation pending. Status: ${status}` });

            } catch (easebuzzError: any) {
                logger.warn(`[Payment] Easebuzz status fetch failed for ${order_id}, falling back to mock verification...`);
                await completeOrderPayment(order_id, {
                    status: "CHARGED",
                    txn_id: `MOCK_TXN_${Date.now()}`,
                    amount: existing.totalAmount,
                    payment_method_type: "MOCK_ONLINE"
                });
                return res.json({ 
                    status: "SUCCESS",
                    message: "Mock verification fallback succeeded"
                });
            }
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
    // 1. Easebuzz Webhook Pathway
    if (req.body.hash && process.env.EASEBUZZ_SALT) {
        logger.info(`[Webhook] Easebuzz notification received: ${JSON.stringify(req.body)}`);
        const calculatedHash = getEasebuzzReverseHash(req.body, process.env.EASEBUZZ_SALT);
        if (calculatedHash !== req.body.hash) {
            logger.error(`[Webhook] Invalid Easebuzz Signature: calculated=${calculatedHash}, received=${req.body.hash}`);
            return res.status(403).json({ message: "Invalid signature" });
        }

        const { txnid, status, easebuzz_id, amount, mode } = req.body;
        if (!txnid || !status) return res.status(400).json({ message: "Missing txnid or status" });

        const isSuccess = (status || "").toLowerCase() === "success";

        // Resolve original orderId from txnid (strip timestamp suffix)
        let resolvedOrderId = txnid;
        if (!txnid.startsWith("DUE_") && !txnid.startsWith("SETTLE_")) {
            resolvedOrderId = txnid.replace(/_\d{3,}$/, "");
        }
        
        try {
            await completeOrderPayment(resolvedOrderId, {
                status: isSuccess ? "CHARGED" : "FAILED",
                txn_id: easebuzz_id || txnid,
                amount: Number(amount),
                payment_method_type: mode || "ONLINE"
            });
            return res.json({ status: "OK" });
        } catch (error) {
            console.error("Webhook Error:", error);
            return res.status(500).json({ message: "Error processing webhook" });
        }
    }

    // 2. Juspay Webhook Pathway
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

// ─── handleEasebuzzCallback (Easebuzz Redirect Endpoint) ──────────────────────

export const handleEasebuzzCallback = async (req: Request, res: Response) => {
    logger.info(`[Easebuzz Callback] Received callback payload: ${JSON.stringify(req.body)}`);
    
    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
    
    if (!req.body.hash || !process.env.EASEBUZZ_SALT) {
        logger.error("[Easebuzz Callback] Missing hash or EASEBUZZ_SALT");
        return res.redirect(`${clientUrl}/payment/success?status=failed&message=Missing signature`);
    }

    const calculatedHash = getEasebuzzReverseHash(req.body, process.env.EASEBUZZ_SALT);
    if (calculatedHash !== req.body.hash) {
        logger.error(`[Easebuzz Callback] Invalid Signature: calculated=${calculatedHash}, received=${req.body.hash}`);
        return res.redirect(`${clientUrl}/payment/success?status=failed&message=Invalid signature`);
    }

    const { txnid, status, easebuzz_id, amount, mode } = req.body;
    if (!txnid) {
        logger.error("[Easebuzz Callback] Missing txnid in payload");
        return res.redirect(`${clientUrl}/payment/success?status=failed&message=Missing transaction ID`);
    }

    const isSuccess = (status || "").toLowerCase() === "success";

    // Recover the original orderId from the txnid.
    // txnid formats:
    //   "BMVXXXXXXXXXX_123456"  → order id is "BMVXXXXXXXXXX"
    //   "DUE_BILLID_1234567890" → handled by completeOrderPayment's DUE_ branch
    //   "SETTLE_USERID_1234567890" → handled by completeOrderPayment's SETTLE_ branch
    //   "BMVXXXXXXXXXX" (legacy, no suffix)
    let resolvedOrderId = txnid;
    if (!txnid.startsWith("DUE_") && !txnid.startsWith("SETTLE_")) {
        // Strip the _NNNNNN timestamp suffix added for uniqueness
        resolvedOrderId = txnid.replace(/_\d{3,}$/, "");
    }
    
    try {
        await completeOrderPayment(resolvedOrderId, {
            status: isSuccess ? "CHARGED" : "FAILED",
            txn_id: easebuzz_id || txnid,
            amount: Number(amount),
            payment_method_type: mode || "ONLINE"
        });
        
        return res.redirect(`${clientUrl}/payment/success?order_id=${resolvedOrderId}&status=${isSuccess ? "success" : "failed"}`);
    } catch (error: any) {
        logger.error(`[Easebuzz Callback] Error completing payment: ${error.message}`);
        return res.redirect(`${clientUrl}/payment/success?order_id=${resolvedOrderId}&status=failed&message=Payment completion failed`);
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

export const checkPaymentEligibility = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const amount = parseFloat(req.query.amount as string) || 0;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
        const eligibility = await getPaymentEligibility(userId, amount);
        res.json(eligibility);
    } catch (error) {
        logger.error("[Payment] Error checking payment eligibility:", error);
        res.status(500).json({ message: "Error checking payment eligibility" });
    }
};

// ─── Public Pay Info & Pay Due Functions ────────────────────────────────────

export const getPayInfo = async (req: Request, res: Response) => {
    try {
        const userid = (req.query.userid || req.query.userId) as string;
        const number = (req.query.number || req.query.phone) as string;
        const billid = (req.query.billid || req.query.billId) as string;

        if (!userid && !number && !billid) {
            return res.status(400).json({ message: "Missing required parameters (userid, number, or billid)" });
        }

        let customer: any = null;
        if (userid) {
            customer = await prisma.user.findUnique({ where: { id: userid } });
        }
        if (!customer && number) {
            const cleanPhone = number.replace(/\D/g, "");
            customer = await prisma.user.findFirst({
                where: {
                    OR: [
                        { phone: number },
                        { phone: cleanPhone },
                        { phone: `+91${cleanPhone}` }
                    ]
                }
            });
        }

        let singleBill: any = null;
        if (billid) {
            const order = await prisma.order.findUnique({
                where: { id: billid },
                include: {
                    user: { select: { id: true, name: true, phone: true, email: true } },
                    items: { include: { product: true } },
                    payments: true
                }
            });
            if (order) {
                if (!customer && order.user) {
                    customer = order.user;
                }
                const paid = order.payments.filter((p: any) => p.status === "SUCCESS").reduce((sum: number, p: any) => sum + Number(p.amount), 0);
                const dueAmount = Math.max(0, Number(order.totalAmount) - paid);
                singleBill = {
                    id: order.id,
                    totalAmount: Number(order.totalAmount),
                    paidAmount: paid,
                    dueAmount: dueAmount,
                    isPaid: order.isPaid || order.paymentStatus === "COMPLETED" || order.paymentStatus === "PAID",
                    paymentStatus: order.paymentStatus,
                    status: order.status,
                    createdAt: order.createdAt,
                    user: order.user ? {
                        id: order.user.id,
                        name: order.user.name,
                        phone: order.user.phone,
                        email: order.user.email
                    } : null,
                    items: order.items.map((i: any) => {
                        const basePrice = i.product?.basePrice ? Number(i.product.basePrice) : Number(i.sellingPrice);
                        const discount = Math.max(0, basePrice - Number(i.sellingPrice));
                        return {
                            id: i.id,
                            name: i.product?.name || "Item",
                            quantity: Number(i.quantity),
                            sellingPrice: Number(i.sellingPrice),
                            basePrice: basePrice,
                            discount: discount
                        };
                    })
                };
            }
        }

        let unpaidOrders: any[] = [];
        let totalDue = 0;

        const effectiveUserId = customer?.id || userid;
        if (effectiveUserId) {
            const orders = await prisma.order.findMany({
                where: {
                    userId: effectiveUserId,
                    paymentStatus: { in: ["PENDING", "PARTIAL"] },
                    status: { notIn: ["CANCELLED", "FAILED", "PAYMENT_PENDING"] }
                },
                orderBy: { createdAt: "asc" },
                include: { payments: true }
            });

            unpaidOrders = orders.map((o: any) => {
                const paid = o.payments.filter((p: any) => p.status === "SUCCESS").reduce((sum: number, p: any) => sum + Number(p.amount), 0);
                const due = Math.max(0, Number(o.totalAmount) - paid);
                totalDue += due;
                return {
                    id: o.id,
                    createdAt: o.createdAt,
                    totalAmount: Number(o.totalAmount),
                    paidAmount: paid,
                    dueAmount: due,
                    status: o.status,
                    paymentStatus: o.paymentStatus
                };
            }).filter((o: any) => o.dueAmount > 0);
        }

        return res.json({
            customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone, email: customer.email } : null,
            bill: singleBill,
            unpaidOrders,
            totalDue
        });
    } catch (error: any) {
        logger.error(`[PayInfo Error] ${error.message}`);
        return res.status(500).json({ message: "Failed to fetch payment details" });
    }
};

export const initiatePayDue = async (req: Request, res: Response) => {
    try {
        const { userId, phone, billId, amount } = req.body;

        let customer: any = null;
        if (userId) customer = await prisma.user.findUnique({ where: { id: userId } });
        if (!customer && phone) {
            const cleanPhone = phone.replace(/\D/g, "");
            customer = await prisma.user.findFirst({
                where: { OR: [{ phone }, { phone: cleanPhone }, { phone: `+91${cleanPhone}` }] }
            });
        }

        const effectiveUserId = customer?.id || userId || "ANONYMOUS";
        const customerName = customer?.name || "Customer";
        const customerPhone = customer?.phone || phone || "9999999999";
        const rawEmail = (customer?.email || "").trim();
        const isValidEmail = rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail);
        const customerEmail = isValidEmail ? rawEmail : `pay.${(customerPhone || "0000000000").replace(/\D/g, "").slice(-10)}@bookmyveg.co.in`;

        // Easebuzz requires a unique txnid for every initiation attempt.
        // Always generate a unique one — never reuse order.id directly since it may
        // have been consumed by a previous (possibly failed) Easebuzz transaction.
        const timestamp = Date.now();
        let txnid: string;
        let productInfoLabel: string;

        if (billId) {
            const order = await prisma.order.findUnique({ where: { id: billId } });
            if (order && !order.isPaid) {
                // Unique txnid referencing the order, with a short suffix to avoid collisions
                txnid = `${order.id}_${String(timestamp).slice(-6)}`;
                productInfoLabel = `Bill Payment ${order.id}`;
            } else {
                txnid = `DUE_${billId}_${timestamp}`;
                productInfoLabel = `Bill Payment ${billId}`;
            }
        } else {
            txnid = `SETTLE_${effectiveUserId}_${timestamp}`;
            productInfoLabel = `Account Settlement ${effectiveUserId}`;
        }

        const amountToPay = Number(amount);
        if (!amountToPay || amountToPay <= 0) {
            return res.status(400).json({ message: "Invalid payment amount" });
        }

        const protocol = req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
        const callbackUrl = `${protocol}://${req.headers.host}/api/v1/payments/easebuzz/callback`;

        let baseUrl = process.env.CLIENT_URL || "http://localhost:3000";
        const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
        if (origin && (baseUrl.includes("localhost") || !process.env.CLIENT_URL)) {
            baseUrl = origin;
        }

        if (protocol === "https" || (origin && origin.startsWith("https:"))) {
            baseUrl = baseUrl.replace(/^http:/, "https:");
        }

        if (process.env.EASEBUZZ_KEY || process.env.EASEBUZZ_MERCHANT_KEY) {
            try {
                const easeResult = await callEasebuzzInitiateApi({
                    txnid,
                    amount: amountToPay,
                    firstname: customerName,
                    email: customerEmail,
                    phone: customerPhone,
                    productinfo: productInfoLabel,
                    callbackUrl
                });

                return res.json({
                    txnid,
                    ...easeResult
                });
            } catch (easebuzzError: any) {
                logger.error(`[Initiate Pay Due] Easebuzz initiation failed, falling back to mock gateway. Error: ${easebuzzError.message}`);
                return res.json({
                    txnid,
                    paymentLink: `${baseUrl.replace(/\/$/, "")}/payment/mock-gateway?orderId=${txnid}&amount=${amountToPay}`,
                });
            }
        }

        // Mock gateway fallback when Easebuzz is not configured
        return res.json({
            txnid,
            paymentLink: `${baseUrl.replace(/\/$/, "")}/payment/mock-gateway?orderId=${txnid}&amount=${amountToPay}`,
        });
    } catch (error: any) {
        logger.error(`[Initiate Pay Due Error] ${error.message}`);
        return res.status(500).json({ message: "Failed to initiate payment" });
    }
};

export const publicCustomerOnboard = async (req: Request, res: Response, next: NextFunction) => {
    const { name, phone, email, address } = req.body;

    if (!name || !phone) {
        return res.status(400).json({ message: "Name and Phone Number are required" });
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
        return res.status(400).json({ message: "Invalid phone number. Must be exactly 10 digits." });
    }

    try {
        // Search lookup to avoid duplicate phone crashes
        let customer = await prisma.user.findFirst({
            where: {
                OR: [
                    { phone: cleanPhone },
                    { phone: `+91${cleanPhone}` },
                    { phone: `91${cleanPhone}` }
                ]
            },
            include: { addresses: true }
        });

        if (customer) {
            // Update existing customer details
            customer = await prisma.user.update({
                where: { id: customer.id },
                data: {
                    name,
                    ...(email && { email }),
                    ...(address && {
                        profileAddress: address,
                        addresses: {
                            upsert: {
                                where: {
                                    id: customer.addresses?.[0]?.id || "new-address-id"
                                },
                                update: { fullAddress: address },
                                create: { fullAddress: address, isDefault: true }
                            }
                        }
                    })
                },
                include: { addresses: true }
            });
            return res.json({ message: "Customer details updated successfully", customer });
        } else {
            // Create a new Customer
            customer = await prisma.user.create({
                data: {
                    name,
                    phone: cleanPhone,
                    ...(email && { email }),
                    role: "USER",
                    password: "POS_AUTO_GENERATED_" + Math.random().toString(36).slice(-8),
                    profileAddress: address || "",
                    ...(address && {
                        addresses: {
                            create: {
                                fullAddress: address,
                                isDefault: true
                            }
                        }
                    })
                },
                include: { addresses: true }
            });

            // Trigger welcome registration WhatsApp notification!
            try {
                const { sendRegistrationThankYouViaWhatsapp } = require("../services/mbgcard");
                sendRegistrationThankYouViaWhatsapp(customer.phone, customer.name || "Customer").catch((err: any) => {
                    console.error("[Onboarding] Welcome WhatsApp dispatch failure:", err);
                });
            } catch (err) {
                console.error("[Onboarding] Failed to send welcome WhatsApp:", err);
            }

            return res.status(201).json({ message: "Customer registered successfully", customer });
        }
    } catch (error) {
        next(error);
    }
};

export const saveOrderFeedback = async (req: Request, res: Response, next: NextFunction) => {
    const { orderId, rating, feedback } = req.body;

    if (!orderId) {
        return res.status(400).json({ message: "Order ID is required" });
    }

    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Valid rating (1-5) is required" });
    }

    try {
        const order = await prisma.order.findUnique({
            where: { id: orderId }
        });

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        const updatedOrder = await prisma.order.update({
            where: { id: orderId },
            data: {
                rating: parseInt(rating),
                feedback: feedback || null
            }
        });

        return res.json({ message: "Feedback submitted successfully", order: updatedOrder });
    } catch (error) {
        next(error);
    }
};

export const sendPaymentReminderController = async (req: Request, res: Response, next: NextFunction) => {
    const { orderId } = req.body;

    if (!orderId) {
        return res.status(400).json({ message: "Order ID is required" });
    }

    try {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { user: true, payments: true }
        });

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        if (order.isPaid || order.paymentStatus === "COMPLETED" || order.paymentStatus === "PAID") {
            return res.status(400).json({ message: "Order is already fully paid" });
        }

        const user = order.user;
        if (!user || !user.phone) {
            return res.status(400).json({ message: "Customer phone number not found" });
        }

        const paid = order.payments.filter((p: any) => p.status === "SUCCESS").reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        const dueAmount = Math.max(0, Number(order.totalAmount) - paid);

        const { sendPaymentReminderViaWhatsapp } = require("../services/mbgcard");
        await sendPaymentReminderViaWhatsapp(user.phone, user.name || "Customer", dueAmount, order.id, user.id, order.id);

        return res.json({ message: "Payment reminder sent successfully via WhatsApp" });
    } catch (error: any) {
        logger.error(`[Send Payment Reminder Error] ${error.message}`);
        return res.status(500).json({ message: "Failed to send WhatsApp reminder" });
    }
};

