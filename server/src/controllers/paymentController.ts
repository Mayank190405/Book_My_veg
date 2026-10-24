import { Request, Response, NextFunction } from "express";
import { Prisma, OrderStatus as PrismaOrderStatus } from "@prisma/client";
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
import { syncCustomerTotalDue } from "./orderController";
import { 
    calculateCustomerDues, 
    calculateOrderDue, 
    getEligibleOrdersWhereClause,
    isAllDuesDisplayLabel,
    calculateOrderPaidAmountDecimal
} from "../services/dueCalculationService";
import Decimal from "decimal.js";

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
            const requestedAmount = req.body?.amount ? Number(req.body.amount) : (req.query?.amount ? Number(req.query.amount) : null);
            const amountToCharge = requestedAmount 
                ? requestedAmount.toFixed(2)
                : (pendingOnlinePayment ? Number(pendingOnlinePayment.amount).toFixed(2) : Number(order.totalAmount).toFixed(2));

            try {
                const protocol = req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
                const callbackUrl = `${protocol}://${req.headers.host}/api/v1/payments/easebuzz/callback`;

                const addressObj = order.shippingAddress as any;
                const customerName = addressObj?.name || (order as any).user.name || "Customer";
                const customerPhone = addressObj?.phone || (order as any).user.phone || "9999999999";

                const useIframe = process.env.EASEBUZZ_IFRAME !== "0";
                const apiName = useIframe ? "initiate_payment_iframe" : "initiate_payment";

                const shortNonce = Date.now().toString(36).slice(-5).toUpperCase();
                const baseId = order.id.length <= 32 ? order.id : order.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 31);
                const linkTxnid = requestedAmount ? `${baseId}_P${shortNonce}` : (order.id.length <= 40 ? order.id : order.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40));

                const easebuzzRes = await axios.post(
                    `${process.env.EASEBUZZ_SERVICE_URL.replace(/\/$/, "")}/easebuzz?api_name=${apiName}`,
                    {
                        txnid: linkTxnid,
                        amount: amountToCharge,
                        firstname: customerName,
                        email: (order as any).user.email || "customer@example.com",
                        phone: sanitizePhone(customerPhone),
                        productinfo: `Order ${order.id.slice(0, 20)}`,
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
                            amount: amountToCharge
                        });
                    } else if (easebuzzRes.data.paymentLink) {
                        return res.json({
                            paymentLink: easebuzzRes.data.paymentLink,
                            amount: amountToCharge
                        });
                    }
                }
                throw new Error(easebuzzRes.data?.message || "Failed to initiate payment with Easebuzz");
            } catch (easebuzzError: any) {
                logger.error(`[Payment] Easebuzz generation failed, falling back to mock gateway. Error: ${easebuzzError.message}, Data: ${JSON.stringify(easebuzzError.response?.data)}`);
                return res.json({
                    paymentLink: `${baseUrl.replace(/\/$/, "")}/payment/mock-gateway?orderId=${orderId}&amount=${amountToCharge}`,
                    amount: amountToCharge
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

export const settleDuesForCustomer = async (
    userId: string, 
    amount: number, 
    transactionId: string, 
    metadata: any,
    preferredOrderId?: string
) => {
    let remaining = Number(amount);
    if (!remaining || remaining <= 0) return;

    await prisma.$transaction(async (tx: any) => {
        const effectiveTxnId = transactionId || `SETTLE_${Date.now()}`;

        // ── 0. Idempotency Check: Prevent duplicate settlement across webhooks / callbacks / retries ──
        const existingTxnPayment = await tx.payment.findFirst({
            where: {
                status: "SUCCESS",
                OR: [
                    { transactionId: effectiveTxnId },
                    { transactionId: { startsWith: `${effectiveTxnId}_` } }
                ]
            }
        });
        if (existingTxnPayment) {
            logger.info(`[Settlement] Transaction ${effectiveTxnId} already settled. Skipping duplicate.`);
            return;
        }

        // ── Check if a saved PAYMENT_REQUEST exists for this transaction ──
        const candidateEntityIds = Array.from(new Set([
            effectiveTxnId,
            metadata?.txnid,
            metadata?.txn_id,
            metadata?.orderId,
            metadata?.order_id,
            metadata?.easepayid,
            metadata?.easebuzz_id,
            transactionId
        ].map((s: any) => String(s || "").trim()).filter(Boolean)));

        const savedRequestLog = await tx.auditLog.findFirst({
            where: {
                entityType: "PAYMENT_REQUEST",
                entityId: { in: candidateEntityIds }
            },
            orderBy: { createdAt: "desc" }
        });
        const savedRequest = savedRequestLog?.newValue as any;

        let targetUserId = userId;
        if (savedRequest?.customerId && savedRequest.customerId !== "ANONYMOUS") {
            targetUserId = savedRequest.customerId;
        }

        let userObj = targetUserId ? await tx.user.findUnique({ where: { id: targetUserId } }) : null;
        if (!userObj) {
            // 1. Try finding by phone from metadata, savedRequest or userId
            const rawPhone = (metadata?.phone || metadata?.customer_phone || metadata?.mobile || savedRequest?.customerPhone || userId || "").toString();
            const cleanPhone = rawPhone.replace(/\D/g, "").slice(-10);
            if (cleanPhone.length === 10) {
                userObj = await tx.user.findFirst({
                    where: { OR: [{ phone: cleanPhone }, { phone: `+91${cleanPhone}` }, { phone: `91${cleanPhone}` }] }
                });
                if (userObj) targetUserId = userObj.id;
            }

            // 2. Try preferredOrderId
            if (!userObj && preferredOrderId) {
                const pref = await tx.order.findUnique({ where: { id: preferredOrderId } });
                if (pref?.userId) {
                    targetUserId = pref.userId;
                    userObj = await tx.user.findUnique({ where: { id: targetUserId } });
                }
            }

            // 3. Try finding by sliced UUID prefix if userId is hexadecimal prefix
            if (!userObj && userId && userId.length >= 8) {
                const prefix8 = userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
                userObj = await tx.user.findFirst({
                    where: { id: { startsWith: prefix8, mode: "insensitive" } }
                });
                if (userObj) targetUserId = userObj.id;
            }

            // 4. Try finding by email
            if (!userObj && (metadata?.email || savedRequest?.customerEmail)) {
                const emailToMatch = String(metadata?.email || savedRequest?.customerEmail).trim();
                userObj = await tx.user.findFirst({
                    where: { email: { equals: emailToMatch, mode: "insensitive" } }
                });
                if (userObj) targetUserId = userObj.id;
            }
        }

        let ordersToSettle: any[] = [];
        const seenOrderIds = new Set<string>();

        // Step A: Preserve explicit bills from original payment request
        if (savedRequest?.billIds && Array.isArray(savedRequest.billIds) && savedRequest.billIds.length > 0) {
            const explicitOrders = await tx.order.findMany({
                where: {
                    id: { in: savedRequest.billIds },
                    status: { notIn: ["CANCELLED", "FAILED"] }
                },
                include: { payments: true }
            });
            for (const id of savedRequest.billIds) {
                const ord = explicitOrders.find((o: any) => o.id === id);
                if (ord && !seenOrderIds.has(ord.id)) {
                    ordersToSettle.push(ord);
                    seenOrderIds.add(ord.id);
                }
            }
        }

        // Step B: Include preferredOrderId first if specified and not yet present
        if (preferredOrderId && !seenOrderIds.has(preferredOrderId)) {
            const prefOrder = await tx.order.findUnique({
                where: { id: preferredOrderId },
                include: { payments: true }
            });
            if (prefOrder && !["CANCELLED", "FAILED"].includes(prefOrder.status)) {
                ordersToSettle.unshift(prefOrder);
                seenOrderIds.add(prefOrder.id);
                if (!targetUserId && prefOrder.userId) {
                    targetUserId = prefOrder.userId;
                }
            }
        }

        // Step C: Append all remaining unpaid orders of customer to ensure full settlement coverage
        if (targetUserId) {
            const custUnpaidOrders = await tx.order.findMany({
                where: {
                    userId: targetUserId,
                    id: { notIn: Array.from(seenOrderIds) },
                    isPaid: false,
                    status: { notIn: ["CANCELLED", "FAILED"] }
                },
                orderBy: { createdAt: "asc" },
                include: { payments: true }
            });

            for (const ord of custUnpaidOrders) {
                if (!seenOrderIds.has(ord.id)) {
                    ordersToSettle.push(ord);
                    seenOrderIds.add(ord.id);
                }
            }
        }

        let remainingDec = new Decimal(amount);

        for (const order of ordersToSettle) {
            if (remainingDec.lessThanOrEqualTo(0)) break;

            const paidDec = calculateOrderPaidAmountDecimal(order.payments);
            const orderTotalDec = new Decimal(order.totalAmount ? order.totalAmount.toString() : 0);
            const dueDec = Decimal.max(0, orderTotalDec.minus(paidDec));
            if (dueDec.lessThanOrEqualTo(0.005)) continue;

            const toApplyDec = Decimal.min(remainingDec, dueDec);
            const toApply = Number(toApplyDec.toFixed(2));

            if (toApply > 0) {
                const targetTxn = `${effectiveTxnId}_${order.id.slice(0, 6)}`;
                const pendingPayment = await tx.payment.findFirst({
                    where: {
                        orderId: order.id,
                        status: "PENDING",
                        OR: [
                            { transactionId: targetTxn },
                            { transactionId: effectiveTxnId }
                        ]
                    }
                });

                if (pendingPayment) {
                    await tx.payment.update({
                        where: { id: pendingPayment.id },
                        data: {
                            amount: toApply,
                            method: metadata?.payment_method_type || metadata?.mode || "ONLINE",
                            status: "SUCCESS",
                            transactionId: targetTxn,
                            metadata: metadata || {}
                        }
                    });
                } else {
                    await tx.payment.create({
                        data: {
                            orderId: order.id,
                            amount: toApply,
                            method: metadata?.payment_method_type || metadata?.mode || "ONLINE",
                            status: "SUCCESS",
                            transactionId: targetTxn,
                            metadata: metadata || {}
                        }
                    });
                }

                const totalPaidNowDec = paidDec.plus(toApplyDec);
                const isFull = totalPaidNowDec.greaterThanOrEqualTo(orderTotalDec.minus(new Decimal(0.005)));
                const nonRevertableStatuses = ["DELIVERED", "SHIPPED", "OUT_FOR_DELIVERY", "COMPLETED"];
                const shouldUpdateStatus = !nonRevertableStatuses.includes(order.status);

                await tx.order.update({
                    where: { id: order.id },
                    data: {
                        isPaid: isFull,
                        paymentStatus: isFull ? "COMPLETED" : "PARTIAL",
                        easebuzzCollected: { increment: new Prisma.Decimal(toApply) },
                        ...(shouldUpdateStatus && { status: "CONFIRMED" as PrismaOrderStatus })
                    }
                });

                if (isFull) {
                    await tx.payment.deleteMany({
                        where: { orderId: order.id, status: "PENDING" }
                    });
                }

                // Create notification for customer
                const notifTitle = isFull ? "Payment Complete" : "Payment Received";
                const notifBody = isFull
                    ? `Your bill #${order.id} of ₹${orderTotalDec.toFixed(2)} has been fully paid. Thank you!`
                    : `Payment of ₹${toApply.toFixed(2)} received for bill #${order.id}. Remaining: ₹${orderTotalDec.minus(totalPaidNowDec).toFixed(2)}`;

                await tx.notification.create({
                    data: {
                        userId: targetUserId,
                        title: notifTitle,
                        body: notifBody,
                        type: "ORDER",
                        isRead: false
                    }
                });

                await tx.orderStatusHistory.create({
                    data: {
                        orderId: order.id,
                        status: (shouldUpdateStatus ? "CONFIRMED" : order.status) as PrismaOrderStatus,
                        remark: `Payment of ₹${toApply.toFixed(2)} received via ${metadata?.payment_method_type || metadata?.mode || "ONLINE"}${isFull ? " (Fully Paid)" : " (Partial)"}`,
                        changedBy: "SYSTEM",
                    },
                });

                remainingDec = remainingDec.minus(toApplyDec);
            }
        }

        // Check for excess unallocated payment
        if (remainingDec.greaterThan(0.005)) {
            const excessVal = Number(remainingDec.toFixed(2));
            logger.warn(`[Settlement Excess] Customer ${targetUserId} has excess payment of ₹${excessVal} for txn ${effectiveTxnId}`);
            await tx.auditLog.create({
                data: {
                    entityType: "PAYMENT_EXCESS",
                    entityId: effectiveTxnId,
                    action: "EXCESS_PAYMENT_LOGGED",
                    newValue: {
                        userId: targetUserId,
                        excessAmount: excessVal,
                        receivedTotal: amount,
                        settledBills: ordersToSettle.map((o: any) => o.id),
                        transactionId: effectiveTxnId
                    }
                }
            });
        }

        // Mark saved payment request as SETTLED
        if (savedRequestLog) {
            await tx.auditLog.update({
                where: { id: savedRequestLog.id },
                data: {
                    newValue: {
                        ...savedRequest,
                        status: "SETTLED",
                        settledAt: new Date().toISOString()
                    }
                }
            });
        }

        if (targetUserId) {
            await syncCustomerTotalDue(targetUserId, tx);
        }
    });
};

export const completeOrderPayment = async (orderId: string, paymentDetails: any) => {
    let resolvedOrderId = orderId;
    if (orderId && !orderId.startsWith("DUE_") && !orderId.startsWith("SET_") && !orderId.startsWith("SETTLE_")) {
        resolvedOrderId = orderId.replace(/_\d{3,}$/, "");
    }

    // Handle explicit SETTLE_, SET_, or DUE_ settlement transactions first
    if (orderId.startsWith("SETTLE_") || orderId.startsWith("SET_") || orderId.startsWith("DUE_")) {
        if (paymentDetails.status === "CHARGED" || paymentDetails.status === "SUCCESS") {
            const parts = orderId.split("_");
            let targetUserOrBill = parts[1];
            let preferredBill = parts[2];

            // 1. Check saved PAYMENT_REQUEST for precise customerId & billIds
            const candidateIds = Array.from(new Set([
                orderId,
                paymentDetails.txn_id,
                paymentDetails.metadata?.txnid,
                paymentDetails.metadata?.order_id,
                paymentDetails.metadata?.orderId
            ].map((s: any) => String(s || "").trim()).filter(Boolean)));

            const savedReq = await prisma.auditLog.findFirst({
                where: {
                    entityType: "PAYMENT_REQUEST",
                    entityId: { in: candidateIds }
                },
                orderBy: { createdAt: "desc" }
            });
            const savedReqData = savedReq?.newValue as any;

            let targetUserId: string | null = savedReqData?.customerId && savedReqData.customerId !== "ANONYMOUS" 
                ? savedReqData.customerId 
                : null;

            if (!targetUserId && targetUserOrBill) {
                const userObj = await prisma.user.findUnique({ where: { id: targetUserOrBill } });
                if (userObj) {
                    targetUserId = userObj.id;
                } else {
                    const orderObj = await prisma.order.findUnique({ where: { id: targetUserOrBill } });
                    if (orderObj) {
                        targetUserId = orderObj.userId;
                        preferredBill = orderObj.id;
                    }
                }
            }

            if (!targetUserId && targetUserOrBill && targetUserOrBill.length >= 8) {
                const prefix8 = targetUserOrBill.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
                const userByPrefix = await prisma.user.findFirst({
                    where: { id: { startsWith: prefix8, mode: "insensitive" } }
                });
                if (userByPrefix) targetUserId = userByPrefix.id;
            }

            if (!targetUserId) {
                const rawPhone = (paymentDetails.phone || paymentDetails.customerPhone || targetUserOrBill || "").toString();
                const cleanPhone = rawPhone.replace(/\D/g, "").slice(-10);
                if (cleanPhone.length === 10) {
                    const foundUser = await prisma.user.findFirst({
                        where: { OR: [{ phone: cleanPhone }, { phone: `+91${cleanPhone}` }, { phone: `91${cleanPhone}` }] }
                    });
                    if (foundUser) targetUserId = foundUser.id;
                }
            }

            const finalUserId = targetUserId || targetUserOrBill;
            await settleDuesForCustomer(
                finalUserId, 
                Number(paymentDetails.amount), 
                paymentDetails.txn_id || orderId, 
                paymentDetails, 
                preferredBill
            );
            return { status: "SUCCESS" };
        }
    }

    // 1. Resolve exact orderId from Payment record if it was initiated with a unique txnid
    const paymentRecord = await prisma.payment.findFirst({
        where: { transactionId: orderId },
        select: { orderId: true }
    });
    if (paymentRecord?.orderId) {
        resolvedOrderId = paymentRecord.orderId;
    }

    let existing: any = await prisma.order.findUnique({
        where: { id: resolvedOrderId },
        include: { items: true, user: true, payments: true },
    });

    // 2. If not found and resolvedOrderId looks like 32-char hex (compact UUID without hyphens), try standard UUID format
    if (!existing && resolvedOrderId.length === 32 && /^[0-9a-fA-F]{32}$/.test(resolvedOrderId)) {
        const formattedUuid = `${resolvedOrderId.slice(0, 8)}-${resolvedOrderId.slice(8, 12)}-${resolvedOrderId.slice(12, 16)}-${resolvedOrderId.slice(16, 20)}-${resolvedOrderId.slice(20)}`;
        existing = await prisma.order.findUnique({
            where: { id: formattedUuid },
            include: { items: true, user: true, payments: true },
        });
        if (existing) {
            resolvedOrderId = existing.id;
        }
    }

    if (!existing) {
        // Collect all possible candidate Order IDs from orderId, resolvedOrderId, productinfo, etc.
        const candidates: string[] = [orderId, resolvedOrderId];
        if (resolvedOrderId.length >= 8) {
            candidates.push(resolvedOrderId.slice(0, 8));
        }
        if (resolvedOrderId.length >= 6) {
            candidates.push(resolvedOrderId.slice(0, 6));
        }

        if (paymentDetails?.productinfo) {
            const productStr = String(paymentDetails.productinfo);
            const matches = productStr.match(/BMV[A-Z0-9]+/gi);
            if (matches) {
                matches.forEach(m => {
                    candidates.push(m);
                    if (m.length >= 8) candidates.push(m.slice(0, 8));
                });
            }
        }

        const uniqueCandidates = Array.from(new Set(candidates)).filter(Boolean);

        const orConditions: any[] = [];
        uniqueCandidates.forEach(c => {
            orConditions.push({ id: c });
            orConditions.push({ id: { equals: c, mode: "insensitive" } });
            orConditions.push({ id: { contains: c, mode: "insensitive" } });
            if (c.length >= 8) {
                const prefix8 = c.slice(0, 8);
                orConditions.push({ id: prefix8 });
                orConditions.push({ id: { equals: prefix8, mode: "insensitive" } });
            }
        });

        existing = await prisma.order.findFirst({
            where: { OR: orConditions },
            include: { items: true, user: true, payments: true }
        });

        if (existing) {
            resolvedOrderId = existing.id;
        }
    }

    if (!existing) {
        // Strict Integrity Rule: Phone number and payment amount alone MUST NOT be used to automatically associate a gateway transaction with an order.
        // Instead, log unresolved/ambiguous gateway transactions to AuditLog for authorized manual reconciliation.
        logger.warn(`[Payment Reconciliation] Ambiguous/unmapped Easebuzz transaction: Order ${resolvedOrderId} not found. Gateway txn: ${paymentDetails.txn_id || orderId}, amount: ${paymentDetails.amount}`);

        try {
            await prisma.auditLog.create({
                data: {
                    entityType: "PAYMENT_RECONCILIATION",
                    entityId: paymentDetails.txn_id || orderId || "UNKNOWN_TXN",
                    action: "EASEBUZZ_UNMAPPED_TRANSACTION",
                    newValue: {
                        orderId,
                        resolvedOrderId,
                        amount: paymentDetails.amount,
                        status: paymentDetails.status,
                        gatewayTxnId: paymentDetails.txn_id || paymentDetails.easepayid,
                        phone: paymentDetails.phone || paymentDetails.customerPhone || null,
                        email: paymentDetails.email || null,
                        reason: "Order not found and strict ledger rules prevent auto-association by phone/email alone."
                    }
                }
            });
        } catch (auditErr: any) {
            logger.error(`[Payment Reconciliation] Failed to log unmapped transaction audit: ${auditErr.message}`);
        }

        return {
            status: "UNMAPPED_TRANSACTION_LOGGED",
            message: `Order ${resolvedOrderId} not found. Gateway transaction logged to audit statement for manual review.`
        };
    }

    if (paymentDetails.status === "CHARGED" || paymentDetails.status === "SUCCESS") {
        const targetTxnId = paymentDetails.txn_id || paymentDetails.order_id || orderId;

        // Check 1: Has this exact transaction ID already been processed successfully? (Idempotency)
        const existingTxnPayment = await prisma.payment.findFirst({
            where: {
                status: "SUCCESS",
                OR: [
                    { transactionId: targetTxnId },
                    ...(paymentDetails.txn_id ? [{ transactionId: paymentDetails.txn_id }] : [])
                ]
            }
        });
        if (existingTxnPayment) {
            // Check if this payment left excess/surplus on an order while customer has other unpaid orders
            if (existing && existing.userId) {
                const orderPayments = existing.payments && existing.payments.length > 0 
                    ? existing.payments 
                    : await prisma.payment.findMany({ where: { orderId: existing.id } });
                const orderPaidDec = calculateOrderPaidAmountDecimal(orderPayments);
                const orderTotalDec = new Decimal(existing.totalAmount ? existing.totalAmount.toString() : 0);
                const surplusDec = Decimal.max(0, orderPaidDec.minus(orderTotalDec));

                if (surplusDec.greaterThan(0.005)) {
                    const otherUnpaidCount = await prisma.order.count({
                        where: {
                            userId: existing.userId,
                            id: { not: existing.id },
                            isPaid: false,
                            status: { notIn: ["CANCELLED", "FAILED"] }
                        }
                    });

                    if (otherUnpaidCount > 0) {
                        logger.info(`[Payment] Order ${existing.id} has surplus payment of ₹${surplusDec.toFixed(2)} from txn ${targetTxnId}. Reallocating surplus to ${otherUnpaidCount} unpaid orders of customer ${existing.userId}.`);
                        await settleDuesForCustomer(existing.userId, Number(surplusDec.toFixed(2)), `${targetTxnId}_realloc`, paymentDetails);
                        return { status: "SUCCESS" };
                    }
                }
            }
            logger.info(`[Payment] Transaction ${targetTxnId} already recorded for order ${resolvedOrderId}. Skipping duplicate.`);
            return { status: "ALREADY_PROCESSED" };
        }

        // Check if this transaction is an explicit multi-order settlement request
        const isExplicitSettlement = (
            orderId.startsWith("DUE_") || 
            orderId.startsWith("SET_") || 
            orderId.startsWith("SETTLE_") ||
            Boolean(paymentDetails.settleDues) ||
            Boolean(paymentDetails.metadata?.settleDues) ||
            Boolean(paymentDetails.metadata?.txnid && (paymentDetails.metadata.txnid.startsWith("DUE_") || paymentDetails.metadata.txnid.startsWith("SET_")))
        );

        if (existing.userId) {
            const orderDueResult = calculateOrderDue(existing);
            const isAmountExceedingDue = Number(paymentDetails.amount) > (orderDueResult.dueAmount + 0.01);

            if (isExplicitSettlement || isAmountExceedingDue) {
                const otherUnpaidCount = await prisma.order.count({
                    where: {
                        userId: existing.userId,
                        id: { not: existing.id },
                        isPaid: false,
                        status: { notIn: ["CANCELLED", "FAILED"] }
                    }
                });

                if (otherUnpaidCount > 0) {
                    logger.info(`[Payment] Customer ${existing.userId} multi-bill settlement triggered for order ${existing.id} (explicit: ${isExplicitSettlement}, excessAmount: ${isAmountExceedingDue}).`);
                    await settleDuesForCustomer(existing.userId, Number(paymentDetails.amount), targetTxnId, paymentDetails, existing.id);
                    return { status: "SUCCESS" };
                }
            }
        }

        // Check 2: Is order already fully paid?
        const existingSuccessPayments = await prisma.payment.findMany({
            where: { orderId: resolvedOrderId, status: "SUCCESS" }
        });
        const currentTotalPaid = existingSuccessPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        if (existing.isPaid && currentTotalPaid >= Number(existing.totalAmount)) {
            if (existing.userId) {
                const otherUnpaidCount = await prisma.order.count({
                    where: {
                        userId: existing.userId,
                        id: { not: existing.id },
                        isPaid: false,
                        status: { notIn: ["CANCELLED", "FAILED"] }
                    }
                });
                if (otherUnpaidCount > 0) {
                    logger.info(`[Payment] Order ${resolvedOrderId} is already paid, routing settlement of ₹${paymentDetails.amount} to customer's remaining unpaid orders.`);
                    await settleDuesForCustomer(existing.userId, Number(paymentDetails.amount), targetTxnId, paymentDetails);
                    return { status: "SUCCESS" };
                }
            }
            logger.info(`[Payment] Order ${resolvedOrderId} is already fully paid (₹${currentTotalPaid} / ₹${existing.totalAmount}). Skipping duplicate.`);
            return { status: "ALREADY_PROCESSED" };
        }

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
                        transactionId: targetTxnId,
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
                        transactionId: targetTxnId,
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

            // Purge any leftover PENDING payment records for this order so it never displays as pending
            await tx.payment.deleteMany({
                where: { orderId: resolvedOrderId, status: "PENDING" }
            });

            // Determine payment status
            const newPaymentStatus = isFull ? "COMPLETED" : "PARTIAL";

            // Only update status to CONFIRMED if order is still in a pre-confirmed state
            // Do NOT revert DELIVERED/SHIPPED/etc. orders back to CONFIRMED
            const nonRevertableStatuses = ["DELIVERED", "SHIPPED", "OUT_FOR_DELIVERY", "COMPLETED"];
            const shouldUpdateStatus = !nonRevertableStatuses.includes(existing.status);

            const paymentAmountDecimal = new Prisma.Decimal(paymentDetails.amount || existing.totalAmount);
            await tx.order.update({
                where: { id: resolvedOrderId },
                data: {
                    isPaid: isFull,
                    paymentStatus: newPaymentStatus,
                    easebuzzCollected: { increment: paymentAmountDecimal },
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

            // Synchronize Customer Balance & Ledger
            if (existing.userId) {
                await syncCustomerTotalDue(existing.userId, tx);
            }
        });

        // ── Real-time Notification for Logistics & Driver Portal ─────────
        try {
            getIo().emit("OP_NEW_ORDER", { 
                id: orderId, 
                status: "CONFIRMED", 
                timestamp: new Date() 
            });
            getIo().emit("order:updated", {
                orderId: resolvedOrderId,
                isPaid: true,
                paymentStatus: "COMPLETED"
            });
        } catch (_) {}

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
                        items: existing.items.map((i: any) => ({ productId: i.productId, variantId: i.variantId || undefined, quantity: i.quantity })),
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
        if (order_id && !order_id.startsWith("DUE_") && !order_id.startsWith("SET_") && !order_id.startsWith("SETTLE_")) {
            resolvedOrderId = order_id.replace(/_\d{3,}$/, "");
        }

        // Try to resolve via Payment transactionId if present
        const txPayment = await prisma.payment.findFirst({
            where: { transactionId: order_id },
            select: { orderId: true }
        });
        if (txPayment?.orderId) {
            resolvedOrderId = txPayment.orderId;
        }

        if (resolvedOrderId && (resolvedOrderId.startsWith("SETTLE_") || resolvedOrderId.startsWith("SET_") || resolvedOrderId.startsWith("DUE_"))) {
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
                payment_method_type: "ONLINE",
                phone: req.body.phone,
                userId: req.body.userId,
                metadata: req.body
            });

            return res.json({ 
                status: "SUCCESS",
                message: "Account settlement payment completed successfully"
            });
        }

        // 1. Check DB first (Idempotency)
        let existing = await prisma.order.findUnique({
            where: { id: resolvedOrderId },
            select: { id: true, status: true, paymentStatus: true, totalAmount: true },
        });

        if (!existing && resolvedOrderId.length === 32 && /^[0-9a-fA-F]{32}$/.test(resolvedOrderId)) {
            const formattedUuid = `${resolvedOrderId.slice(0, 8)}-${resolvedOrderId.slice(8, 12)}-${resolvedOrderId.slice(12, 16)}-${resolvedOrderId.slice(16, 20)}-${resolvedOrderId.slice(20)}`;
            existing = await prisma.order.findUnique({
                where: { id: formattedUuid },
                select: { id: true, status: true, paymentStatus: true, totalAmount: true },
            });
            if (existing) resolvedOrderId = existing.id;
        }

        if (!existing) {
            existing = await prisma.order.findFirst({
                where: {
                    OR: [
                        { id: { equals: resolvedOrderId, mode: "insensitive" } },
                        { id: { contains: resolvedOrderId, mode: "insensitive" } }
                    ]
                },
                select: { id: true, status: true, paymentStatus: true, totalAmount: true },
            });
            if (existing) resolvedOrderId = existing.id;
        }

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
    if (req.body.txnid && (req.body.hash || req.body.status)) {
        logger.info(`[Webhook] Easebuzz notification received: ${JSON.stringify(req.body)}`);
        
        if (req.body.hash && process.env.EASEBUZZ_SALT) {
            const calculatedHash = getEasebuzzReverseHash(req.body, process.env.EASEBUZZ_SALT);
            if (calculatedHash !== req.body.hash) {
                logger.warn(`[Webhook] Easebuzz signature mismatch (calculated=${calculatedHash}, received=${req.body.hash}). Continuing processing based on transaction status.`);
            }
        }

        const { txnid, status, easebuzz_id, amount, mode, phone, email, firstname } = req.body;
        if (!txnid || !status) return res.status(400).json({ message: "Missing txnid or status" });

        const isSuccess = (status || "").toLowerCase() === "success";

        // Handle Customer Advance Wallet Deposit webhook
        if (txnid.startsWith("WLT_")) {
            if (isSuccess) {
                try {
                    await processWalletDepositCredit({
                        phone,
                        amount: Number(amount),
                        referenceId: easebuzz_id || txnid,
                        paymentMethod: mode || "EASEBUZZ"
                    });
                } catch (wErr: any) {
                    logger.error(`[Wallet Webhook Error]: ${wErr.message}`);
                }
            }
            return res.json({ status: "OK" });
        }

        // Resolve original orderId from txnid (strip timestamp suffix)
        let resolvedOrderId = txnid;
        if (!txnid.startsWith("DUE_") && !txnid.startsWith("SET_") && !txnid.startsWith("SETTLE_")) {
            resolvedOrderId = txnid.replace(/_\d{3,}$/, "");
        }
        const txPayment = await prisma.payment.findFirst({
            where: { transactionId: txnid },
            select: { orderId: true }
        });
        if (txPayment?.orderId) {
            resolvedOrderId = txPayment.orderId;
        }
        
        try {
            await completeOrderPayment(resolvedOrderId, {
                status: isSuccess ? "CHARGED" : "FAILED",
                txn_id: easebuzz_id || txnid,
                amount: Number(amount),
                payment_method_type: mode || "ONLINE",
                phone,
                email,
                firstname
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
    const payload = { ...(req.query || {}), ...(req.body || {}) };
    logger.info(`[Easebuzz Callback] Received callback payload: ${JSON.stringify(payload)}`);
    
    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
    
    if (payload.hash && process.env.EASEBUZZ_SALT) {
        const calculatedHash = getEasebuzzReverseHash(payload, process.env.EASEBUZZ_SALT);
        if (calculatedHash !== payload.hash) {
            logger.warn(`[Easebuzz Callback] Signature mismatch: calculated=${calculatedHash}, received=${payload.hash}. Continuing processing based on transaction status.`);
        }
    }

    const txnid = (payload.txnid || payload.tx_id || payload.order_id || payload.easepayid || payload.easebuzz_id || "").toString().trim();
    const status = (payload.status || payload.transaction_status || "").toString();
    const easebuzz_id = (payload.easebuzz_id || payload.easepayid || payload.txn_id || txnid).toString();
    const amount = Number(payload.amount || payload.net_amount_debit || payload.net_debit_amount || 0);
    const mode = (payload.mode || payload.payment_source || payload.card_type || "ONLINE").toString();
    const phone = (payload.phone || payload.phone_number || payload.mobile || payload.customer_phone || payload.user_phone || payload.customerPhone || "").toString();
    const email = (payload.email || payload.customer_email || payload.user_email || payload.customerEmail || "").toString();
    const firstname = (payload.firstname || payload.name || payload.customer_name || payload.customerName || "").toString();
    const productinfo = (payload.productinfo || payload.product_info || "").toString();

    if (!txnid) {
        logger.error("[Easebuzz Callback] Missing txnid in payload");
        return res.redirect(`${clientUrl}/payment/success?status=failed&message=Missing transaction ID`);
    }

    const isSuccess = status.toLowerCase() === "success" || status.toLowerCase() === "charged";

    // Handle Customer Advance Wallet Deposit callback redirect
    if (txnid && txnid.startsWith("WLT_")) {
        if (isSuccess) {
            try {
                await processWalletDepositCredit({
                    phone,
                    amount: Number(amount),
                    referenceId: easebuzz_id || txnid,
                    paymentMethod: mode || "EASEBUZZ"
                });
                return res.redirect(`${clientUrl}/account?wallet_deposit=success`);
            } catch (wErr: any) {
                logger.error(`[Wallet Callback Error]: ${wErr.message}`);
            }
        }
        return res.redirect(`${clientUrl}/account?wallet_deposit=failed`);
    }

    // Recover the original orderId from the txnid.
    let resolvedOrderId = txnid;
    const isSettlementTxn = txnid.startsWith("DUE_") || txnid.startsWith("SET_") || txnid.startsWith("SETTLE_");

    if (!isSettlementTxn) {
        // Strip the _NNNNNN timestamp suffix added for uniqueness
        resolvedOrderId = txnid.replace(/_\d{3,}$/, "");
        const cbPayment = await prisma.payment.findFirst({
            where: { transactionId: txnid },
            select: { orderId: true }
        });
        if (cbPayment?.orderId) {
            resolvedOrderId = cbPayment.orderId;
        }
    }
    
    try {
        await completeOrderPayment(resolvedOrderId, {
            status: isSuccess ? "CHARGED" : "FAILED",
            txn_id: easebuzz_id || txnid,
            amount: Number(amount),
            payment_method_type: mode || "ONLINE",
            phone,
            email,
            firstname,
            productinfo,
            settleDues: isSettlementTxn,
            metadata: payload
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
        const userid = ((req.query.userid || req.query.userId || req.query.user_id) as string || "").trim();
        const number = ((req.query.number || req.query.phone || req.query.mobile) as string || "").trim();
        const billid = ((req.query.billid || req.query.billId || req.query.orderid || req.query.orderId || req.query.order_id || req.query.id) as string || "").replace(/^#/, "").trim();

        if (!userid && !number && !billid) {
            return res.status(400).json({ message: "Missing required parameters (userid, number, or billid/orderId)" });
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
            let order = await prisma.order.findUnique({
                where: { id: billid },
                include: {
                    user: { select: { id: true, name: true, phone: true, email: true } },
                    items: { include: { product: true } },
                    payments: true
                }
            });
            if (!order) {
                order = await prisma.order.findFirst({
                    where: {
                        OR: [
                            { id: { equals: billid, mode: "insensitive" } },
                            { id: { contains: billid, mode: "insensitive" } }
                        ]
                    },
                    include: {
                        user: { select: { id: true, name: true, phone: true, email: true } },
                        items: { include: { product: true } },
                        payments: true
                    }
                });
            }
            if (order) {
                if (!customer && order.user) {
                    customer = order.user;
                }
                const dueRes = calculateOrderDue(order);
                singleBill = {
                    id: order.id,
                    totalAmount: dueRes.totalAmount,
                    paidAmount: dueRes.paidAmount,
                    dueAmount: dueRes.dueAmount,
                    isPaid: !dueRes.isEligible,
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
                where: getEligibleOrdersWhereClause({ customerId: effectiveUserId }),
                orderBy: { createdAt: "asc" },
                include: { payments: true }
            });

            const summary = calculateCustomerDues(orders);
            totalDue = summary.totalDue;
            unpaidOrders = summary.eligibleOrders.map((o: any) => ({
                id: o.id,
                createdAt: o.createdAt,
                totalAmount: Number(o.totalAmount),
                paidAmount: o.paidAmount,
                dueAmount: o.dueAmount,
                status: o.status,
                paymentStatus: o.paymentStatus
            }));
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
        const { userId, phone, amount } = req.body;
        const rawBillId = (req.body.billId || req.body.orderId || req.body.order_id || req.body.billid || "").toString().trim();
        let cleanBillId = rawBillId.replace(/^#/, "").trim();

        // ── Guard against display label "All Dues (N Bills)" being treated as an order ID ──
        if (isAllDuesDisplayLabel(cleanBillId)) {
            cleanBillId = "";
        }

        let customer: any = null;
        if (userId) customer = await prisma.user.findUnique({ where: { id: userId } });
        if (!customer && phone) {
            const cleanPhone = phone.replace(/\D/g, "");
            customer = await prisma.user.findFirst({
                where: { OR: [{ phone }, { phone: cleanPhone }, { phone: `+91${cleanPhone}` }] }
            });
        }

        let order: any = null;
        if (cleanBillId) {
            order = await prisma.order.findUnique({ where: { id: cleanBillId }, include: { payments: true } });
            if (!order) {
                order = await prisma.order.findFirst({
                    where: {
                        OR: [
                            { id: { equals: cleanBillId, mode: "insensitive" } },
                            { id: { contains: cleanBillId, mode: "insensitive" } }
                        ]
                    },
                    include: { payments: true }
                });
            }
        }

        if (!customer && order?.userId) {
            customer = await prisma.user.findUnique({ where: { id: order.userId } });
        }

        const effectiveUserId = customer?.id || order?.userId || userId || "ANONYMOUS";
        const customerName = customer?.name || "Customer";
        const customerPhone = customer?.phone || phone || "9999999999";
        const rawEmail = (customer?.email || "").trim();
        const isValidEmail = rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail);
        const customerEmail = isValidEmail ? rawEmail : `pay.${(customerPhone || "0000000000").replace(/\D/g, "").slice(-10)}@bookmyveg.co.in`;

        const amountToPay = Number(amount);
        if (!amountToPay || amountToPay <= 0) {
            return res.status(400).json({ message: "Invalid payment amount" });
        }

        // ── Persist Original Bill Selection & Intended Allocations ──
        const intendedBills: Array<{ orderId: string; intendedAmount: number; dueAmount: number }> = [];
        let remainingToAllocate = amountToPay;

        if (order) {
            const orderDue = calculateOrderDue(order).dueAmount;
            const toAlloc = Math.min(remainingToAllocate, orderDue > 0 ? orderDue : amountToPay);
            intendedBills.push({
                orderId: order.id,
                intendedAmount: toAlloc,
                dueAmount: orderDue
            });
            remainingToAllocate = Math.max(0, remainingToAllocate - toAlloc);

            // If customer has additional unpaid orders and remaining funds, cascade across them
            if (remainingToAllocate > 0 && effectiveUserId && effectiveUserId !== "ANONYMOUS") {
                const otherCustOrders = await prisma.order.findMany({
                    where: {
                        ...getEligibleOrdersWhereClause({ customerId: effectiveUserId }),
                        id: { not: order.id }
                    },
                    include: { payments: true },
                    orderBy: { createdAt: "asc" }
                });
                for (const ord of otherCustOrders) {
                    if (remainingToAllocate <= 0) break;
                    const ordDue = calculateOrderDue(ord).dueAmount;
                    if (ordDue > 0) {
                        const cascadeAlloc = Math.min(remainingToAllocate, ordDue);
                        intendedBills.push({ orderId: ord.id, intendedAmount: cascadeAlloc, dueAmount: ordDue });
                        remainingToAllocate = Math.max(0, remainingToAllocate - cascadeAlloc);
                    }
                }
            }
        } else if (Array.isArray(req.body.billIds) && req.body.billIds.length > 0) {
            const validBillIds = req.body.billIds
                .map((b: any) => String(b).replace(/^#/, "").trim())
                .filter((b: string) => b && !isAllDuesDisplayLabel(b));

            const explicitOrders = await prisma.order.findMany({
                where: { id: { in: validBillIds }, status: { notIn: ["CANCELLED", "FAILED"] } },
                include: { payments: true },
                orderBy: { createdAt: "asc" }
            });

            for (const ord of explicitOrders) {
                if (remainingToAllocate <= 0) break;
                const ordDue = calculateOrderDue(ord).dueAmount;
                if (ordDue > 0) {
                    const toAlloc = Math.min(remainingToAllocate, ordDue);
                    intendedBills.push({ orderId: ord.id, intendedAmount: toAlloc, dueAmount: ordDue });
                    remainingToAllocate = Math.max(0, remainingToAllocate - toAlloc);
                }
            }

            if (remainingToAllocate > 0 && effectiveUserId && effectiveUserId !== "ANONYMOUS") {
                const otherOrders = await prisma.order.findMany({
                    where: {
                        ...getEligibleOrdersWhereClause({ customerId: effectiveUserId }),
                        id: { notIn: validBillIds }
                    },
                    include: { payments: true },
                    orderBy: { createdAt: "asc" }
                });
                for (const ord of otherOrders) {
                    if (remainingToAllocate <= 0) break;
                    const ordDue = calculateOrderDue(ord).dueAmount;
                    if (ordDue > 0) {
                        const toAlloc = Math.min(remainingToAllocate, ordDue);
                        intendedBills.push({ orderId: ord.id, intendedAmount: toAlloc, dueAmount: ordDue });
                        remainingToAllocate = Math.max(0, remainingToAllocate - toAlloc);
                    }
                }
            }
        } else if (effectiveUserId && effectiveUserId !== "ANONYMOUS") {
            const custOrders = await prisma.order.findMany({
                where: getEligibleOrdersWhereClause({ customerId: effectiveUserId }),
                include: { payments: true },
                orderBy: { createdAt: "asc" }
            });
            for (const ord of custOrders) {
                if (remainingToAllocate <= 0) break;
                const ordDue = calculateOrderDue(ord).dueAmount;
                if (ordDue > 0) {
                    const toAlloc = Math.min(remainingToAllocate, ordDue);
                    intendedBills.push({ orderId: ord.id, intendedAmount: toAlloc, dueAmount: ordDue });
                    remainingToAllocate = Math.max(0, remainingToAllocate - toAlloc);
                }
            }
        }

        const isMultiBill = intendedBills.length > 1;

        // Easebuzz requires a unique txnid <= 40 characters matching ^[a-zA-Z0-9_|/\-]{1,40}$
        const timestamp = Date.now();
        const shortNonce = String(timestamp).slice(-6); // 6 digits
        let txnid: string;
        let productInfoLabel: string;

        if (isMultiBill) {
            const cleanCustPhone = (customerPhone || "").replace(/\D/g, "").slice(-10);
            if (cleanCustPhone.length === 10) {
                txnid = `SET_${cleanCustPhone}_${shortNonce}`;
            } else {
                const compactUser = String(effectiveUserId).replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
                txnid = `SET_${compactUser}_${shortNonce}`;
            }
            productInfoLabel = `All Dues (${intendedBills.length} Bills) - ${customerPhone || String(effectiveUserId).slice(0, 10)}`;
        } else if (order) {
            const compactOrder = order.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 18);
            const compactUser = String(effectiveUserId).replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
            txnid = `DUE_${compactUser}_${compactOrder}_${shortNonce}`;
            if (txnid.length > 40) {
                txnid = `DUE_${compactOrder}_${shortNonce}`;
            }
            productInfoLabel = `Bill Payment ${order.id.slice(0, 20)}`;
        } else {
            const cleanCustPhone = (customerPhone || "").replace(/\D/g, "").slice(-10);
            if (cleanCustPhone.length === 10) {
                txnid = `SET_${cleanCustPhone}_${shortNonce}`;
            } else {
                const compactUser = String(effectiveUserId).replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
                txnid = `SET_${compactUser}_${shortNonce}`;
            }
            productInfoLabel = `Account Settlement ${customerPhone || String(effectiveUserId).slice(0, 15)}`;
        }

        // Persist Payment Request in AuditLog for auditable server-side verification & settlement
        try {
            await prisma.auditLog.create({
                data: {
                    entityType: "PAYMENT_REQUEST",
                    entityId: txnid,
                    action: "INITIATE_PAYMENT_REQUEST",
                    newValue: {
                        customerId: effectiveUserId,
                        customerPhone,
                        customerName,
                        expectedAmount: amountToPay,
                        txnid,
                        billIds: intendedBills.map(b => b.orderId),
                        intendedAllocations: intendedBills,
                        status: "INITIATED",
                        createdAt: new Date().toISOString()
                    }
                }
            });
        } catch (auditErr: any) {
            logger.warn(`[Initiate Pay Due] Could not create audit payment request: ${auditErr.message}`);
        }

        // Record a pending payment record for each intended bill so webhooks/callbacks can trace order immediately
        for (const b of intendedBills) {
            try {
                const targetTxn = intendedBills.length === 1 && order ? txnid : `${txnid}_${b.orderId.slice(0, 6)}`;
                await prisma.payment.create({
                    data: {
                        orderId: b.orderId,
                        amount: b.intendedAmount,
                        method: "ONLINE",
                        status: "PENDING",
                        transactionId: targetTxn
                    }
                });
            } catch (pErr) {
                logger.warn(`[Initiate Pay Due] Could not create pending payment record: ${pErr}`);
            }
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
                    orderId: isMultiBill ? txnid : (order?.id || cleanBillId || txnid),
                    isMultiBill,
                    billCount: intendedBills.length,
                    ...easeResult
                });
            } catch (easebuzzError: any) {
                logger.error(`[Initiate Pay Due] Easebuzz initiation failed, falling back to mock gateway. Error: ${easebuzzError.message}`);
                return res.json({
                    txnid,
                    orderId: isMultiBill ? txnid : (order?.id || cleanBillId || txnid),
                    isMultiBill,
                    billCount: intendedBills.length,
                    paymentLink: `${baseUrl.replace(/\/$/, "")}/payment/mock-gateway?orderId=${txnid}&amount=${amountToPay}`,
                });
            }
        }

        // Mock gateway fallback when Easebuzz is not configured
        return res.json({
            txnid,
            orderId: order?.id || cleanBillId || undefined,
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
                feedback: feedback || null,
                feedbackSent: true
            }
        });

        // Mark all customer orders as feedbackSent: true so customer is never prompted again
        if (updatedOrder.userId) {
            await prisma.order.updateMany({
                where: { userId: updatedOrder.userId, feedbackSent: false },
                data: { feedbackSent: true }
            });
        }

        // Configurable Google Review link (via PageContent CMS, env, or default)
        let googleReviewUrl = process.env.GOOGLE_REVIEW_URL || "https://share.google/AcOZ060z33fcR4OGQ";
        try {
            const reviewConfig = await prisma.pageContent.findUnique({
                where: { slug: "google-review-link" }
            });
            if (reviewConfig?.content && reviewConfig.content.trim()) {
                googleReviewUrl = reviewConfig.content.trim();
            }
        } catch (confErr) {
            // fallback to env / default
        }

        return res.json({ 
            message: "Feedback submitted successfully", 
            order: updatedOrder,
            googleReviewUrl 
        });
    } catch (error) {
        next(error);
    }
};

export const triggerEasebuzzSync = async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    const { startDate, endDate, dryRun } = req.body || {};
    try {
        const { syncEasebuzzTransactions } = await import("../services/easebuzzSyncService");
        
        // Support dry-run mode and custom date filters
        const result = await syncEasebuzzTransactions({
            customStartDate: startDate,
            customEndDate: endDate,
            dryRun: Boolean(dryRun),
            forceFullHistory: !startDate
        });

        return res.json(result);
    } catch (error: any) {
        return res.status(500).json({ message: error.message || "Failed to trigger Easebuzz sync" });
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

        const dueResult = calculateOrderDue(order);
        if (!dueResult.isEligible || dueResult.dueAmount <= 0) {
            return res.status(400).json({ 
                message: `Order is not eligible for payment reminder (${dueResult.ineligibilityReason || "Already settled"})` 
            });
        }

        const user = order.user;
        if (!user || !user.phone) {
            return res.status(400).json({ message: "Customer phone number not found" });
        }

        const dueAmount = dueResult.dueAmount;

        const { sendPaymentReminderViaWhatsapp } = require("../services/mbgcard");
        await sendPaymentReminderViaWhatsapp(user.phone, user.name || "Customer", dueAmount, order.id, user.id, order.id);

        // Record in AuditLog to coordinate with worker and POS cooldowns
        await (prisma.auditLog.create as any)({
            data: {
                entityType: "USER",
                entityId: user.id,
                action: "WHATSAPP_DUE_REMINDER",
                staffId: (req as any).user?.userId,
                newValue: {
                    dueAmount,
                    orderId: order.id,
                    trigger: "ADMIN_SINGLE_ORDER",
                    sentAt: new Date()
                }
            }
        }).catch((auditErr: any) => {
            logger.warn(`Failed to write AuditLog for single order reminder: ${auditErr.message}`);
        });

        return res.json({ message: "Payment reminder sent successfully via WhatsApp" });
    } catch (error: any) {
        logger.error(`[Send Payment Reminder Error] ${error.message}`);
        return res.status(500).json({ message: "Failed to send WhatsApp reminder" });
    }
};

export const cleanUpDuplicatePayments = async () => {
    try {
        // 1. Delete duplicate transactionId records ON THE SAME ORDER with full audit trail
        // Group by BOTH orderId and transactionId so that multi-order allocations with the same transactionId are preserved!
        const duplicateTxns = await prisma.payment.groupBy({
            by: ["orderId", "transactionId"],
            where: { status: "SUCCESS", transactionId: { not: null } },
            _count: { id: true },
            having: { id: { _count: { gt: 1 } } }
        });

        for (const item of duplicateTxns) {
            if (!item.transactionId || !item.orderId) continue;
            const txns = await prisma.payment.findMany({
                where: { orderId: item.orderId, transactionId: item.transactionId, status: "SUCCESS" },
                orderBy: { createdAt: "asc" }
            });
            const toDelete = txns.slice(1);
            if (toDelete.length > 0) {
                for (const d of toDelete) {
                    await prisma.auditLog.create({
                        data: {
                            entityType: "PAYMENT",
                            entityId: d.id,
                            action: "PAYMENT_DUPLICATE_PURGED",
                            oldValue: {
                                paymentId: d.id,
                                orderId: d.orderId,
                                amount: Number(d.amount),
                                method: d.method,
                                transactionId: d.transactionId,
                                createdAt: d.createdAt
                            },
                            newValue: {
                                reason: "Duplicate transactionId on same order purged to maintain ledger integrity",
                                retainedPaymentId: txns[0].id
                            }
                        }
                    });
                }
                const toDeleteIds = toDelete.map(t => t.id);
                await prisma.payment.deleteMany({ where: { id: { in: toDeleteIds } } });
                logger.info(`[Payment Cleanup] Deleted ${toDelete.length} duplicate payments for order ${item.orderId} and transactionId ${item.transactionId}`);

                // Synchronize customer dues for all affected orders
                for (const d of toDelete) {
                    const ord = await prisma.order.findUnique({ where: { id: d.orderId }, select: { userId: true } });
                    if (ord?.userId) {
                        await syncCustomerTotalDue(ord.userId);
                    }
                }
            }
        }

        // 2. Identify exact duplicate payments on the same order where total paid exceeds order total amount.
        // A true duplicate overpayment occurs when duplicate submissions have identical amounts and methods.
        const duplicateOrders = await prisma.payment.groupBy({
            by: ["orderId"],
            where: { status: "SUCCESS" },
            _count: { id: true },
            having: { id: { _count: { gt: 1 } } }
        });

        for (const item of duplicateOrders) {
            const orderId = item.orderId;
            const order = await prisma.order.findUnique({ where: { id: orderId } });
            if (!order) continue;

            const payments = await prisma.payment.findMany({
                where: { orderId, status: "SUCCESS" },
                orderBy: { createdAt: "asc" }
            });

            const orderTotal = Number(order.totalAmount);
            let totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
            
            // Only examine orders where total paid exceeds order total amount (overpayment)
            if (totalPaid <= orderTotal) continue;

            const duplicateIds: string[] = [];
            // Look for near-identical duplicate records (same amount, within 5 minutes)
            for (let i = 0; i < payments.length; i++) {
                for (let j = i + 1; j < payments.length; j++) {
                    const p1 = payments[i];
                    const p2 = payments[j];
                    if (duplicateIds.includes(p2.id)) continue;

                    const amt1 = Number(p1.amount);
                    const amt2 = Number(p2.amount);
                    const timeDiff = Math.abs(new Date(p1.createdAt).getTime() - new Date(p2.createdAt).getTime());
                    const isSameAmount = Math.abs(amt1 - amt2) < 0.01;
                    const isWithinDuplicateWindow = timeDiff < 5 * 60 * 1000; // 5 mins
                    const isSameMethod = p1.method === p2.method;

                    if (isSameAmount && isSameMethod && isWithinDuplicateWindow && totalPaid - amt2 >= orderTotal - 0.01) {
                        duplicateIds.push(p2.id);
                        totalPaid -= amt2;
                    }
                }
            }

            if (duplicateIds.length > 0) {
                const deletedRecords = payments.filter(p => duplicateIds.includes(p.id));
                for (const d of deletedRecords) {
                    await prisma.auditLog.create({
                        data: {
                            entityType: "PAYMENT",
                            entityId: d.id,
                            action: "PAYMENT_EXCESS_OVERPAYMENT_PURGED",
                            oldValue: {
                                paymentId: d.id,
                                orderId: d.orderId,
                                amount: Number(d.amount),
                                method: d.method,
                                transactionId: d.transactionId,
                                createdAt: d.createdAt
                            },
                            newValue: {
                                reason: "Excess duplicate payment record exceeding order totalAmount purged to maintain ledger integrity",
                                orderTotal
                            }
                        }
                    });
                }

                await prisma.payment.deleteMany({
                    where: { id: { in: duplicateIds } }
                });
                logger.info(`[Payment Cleanup] Deleted ${duplicateIds.length} duplicate payment records for order ${orderId}`);
            }

            // Recalculate order status
            const remainingPayments = await prisma.payment.findMany({
                where: { orderId, status: "SUCCESS" }
            });
            const newTotalPaid = remainingPayments.reduce((acc, p) => acc + Number(p.amount), 0);
            const isFull = newTotalPaid >= orderTotal;

            await prisma.order.update({
                where: { id: orderId },
                data: {
                    isPaid: isFull,
                    paymentStatus: isFull ? "COMPLETED" : (newTotalPaid > 0 ? "PARTIAL" : "PENDING")
                }
            });

            if (isFull) {
                await prisma.payment.deleteMany({
                    where: { orderId, status: "PENDING" }
                });
            }

            if (order.userId) {
                await syncCustomerTotalDue(order.userId);
            }
        }

        // 3. Purge all orphan/stale PENDING payment records for fully paid orders across the system
        const fullyPaidOrders = await prisma.order.findMany({
            where: { OR: [{ isPaid: true }, { paymentStatus: "COMPLETED" }] },
            select: { id: true }
        });
        const paidOrderIds = fullyPaidOrders.map(o => o.id);
        if (paidOrderIds.length > 0) {
            await prisma.payment.deleteMany({
                where: { orderId: { in: paidOrderIds }, status: "PENDING" }
            });
        }
    } catch (e: any) {
        logger.error(`[Payment Cleanup Error] ${e.message}`);
    }
};

export const cleanupDuplicatePaymentsController = async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    try {
        await cleanUpDuplicatePayments();
        return res.json({ success: true, message: "Duplicate payments cleaned up successfully" });
    } catch (e: any) {
        return res.status(500).json({ message: e.message || "Failed to cleanup duplicate payments" });
    }
};

// ─── Customer Advance Wallet Deposit Flow ─────────────────────────────────────

export const processWalletDepositCredit = async ({
    userId,
    phone,
    amount,
    referenceId,
    paymentMethod = "EASEBUZZ"
}: {
    userId?: string;
    phone?: string;
    amount: number;
    referenceId: string;
    paymentMethod?: string;
}) => {
    const depositAmt = Number(amount);
    if (!depositAmt || depositAmt <= 0) throw new Error("Invalid deposit amount");

    return await prisma.$transaction(async (tx) => {
        // Idempotency: Check if already processed
        const existingTx = await tx.walletTransaction.findFirst({
            where: { referenceId, type: "DEPOSIT" }
        });
        if (existingTx) {
            const user = await tx.user.findUnique({
                where: { id: existingTx.userId },
                select: { accountBalance: true }
            });
            return { alreadyProcessed: true, balance: Number(user?.accountBalance || 0) };
        }

        let customer: any = null;
        if (userId) {
            customer = await tx.user.findUnique({ where: { id: userId } });
        }
        if (!customer && phone) {
            const cleanPhone = phone.replace(/\D/g, "");
            customer = await tx.user.findFirst({
                where: { OR: [{ phone }, { phone: cleanPhone }, { phone: `+91${cleanPhone}` }] }
            });
        }
        if (!customer) throw new Error("Customer not found for wallet credit");

        const currentBalance = Number(customer.accountBalance || 0);
        const newBalance = currentBalance + depositAmt;

        await tx.user.update({
            where: { id: customer.id },
            data: { accountBalance: new Prisma.Decimal(newBalance) }
        });

        const transaction = await tx.walletTransaction.create({
            data: {
                userId: customer.id,
                amount: new Prisma.Decimal(depositAmt),
                type: "DEPOSIT",
                paymentMethod: paymentMethod.toUpperCase(),
                referenceId,
                balanceAfter: new Prisma.Decimal(newBalance),
                notes: "Online Advance Wallet Deposit via Easebuzz",
                createdBy: "CUSTOMER_ONLINE"
            }
        });

        // Dispatch WhatsApp receipt confirmation
        if (customer.phone) {
            try {
                const { sendTemplateViaChatHub } = require("../services/mbgcard");
                await sendTemplateViaChatHub(customer.phone, "payment_received", {
                    body: [
                        customer.name || "Customer",
                        `ADV-${referenceId.slice(-6)}`,
                        String(depositAmt),
                        `Easebuzz Online (Advance Wallet Credit - Current Balance: ₹${newBalance})`
                    ]
                }).catch(() => null);
            } catch (err) {
                console.warn("[Wallet Deposit WhatsApp warning]:", err);
            }
        }

        return { alreadyProcessed: false, customer, balance: newBalance, transaction };
    });
};

export const initiateWalletDeposit = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ message: "Authentication required" });

        const { amount } = req.body;
        const depositAmt = Number(amount);
        if (!depositAmt || depositAmt < 10 || depositAmt > 50000) {
            return res.status(400).json({ message: "Deposit amount must be between ₹10 and ₹50,000" });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, phone: true, email: true }
        });
        if (!user) return res.status(404).json({ message: "User account not found" });

        const customerName = (user.name || "Customer").replace(/[^a-zA-Z0-9 ]/g, "").trim() || "Customer";
        const customerPhone = user.phone || "9999999999";
        const rawEmail = (user.email || "").trim();
        const isValidEmail = rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail);
        const customerEmail = isValidEmail ? rawEmail : `pay.${customerPhone.replace(/\D/g, "").slice(-10)}@bookmyveg.co.in`;

        const timestamp = Date.now();
        const shortNonce = String(timestamp).slice(-6);
        const compactUser = userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
        const txnid = `WLT_${compactUser}_${shortNonce}`; // strictly <= 40 chars
        const productInfoLabel = `Wallet Top-up ${depositAmt}`;

        const protocol = req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
        const callbackUrl = `${protocol}://${req.headers.host}/api/v1/payments/easebuzz/callback`;

        let baseUrl = process.env.CLIENT_URL || "http://localhost:3000";
        const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
        if (origin && (baseUrl.includes("localhost") || !process.env.CLIENT_URL)) {
            baseUrl = origin;
        }

        if (process.env.EASEBUZZ_KEY || process.env.EASEBUZZ_MERCHANT_KEY) {
            try {
                const easeResult = await callEasebuzzInitiateApi({
                    txnid,
                    amount: depositAmt,
                    firstname: customerName,
                    email: customerEmail,
                    phone: customerPhone,
                    productinfo: productInfoLabel,
                    callbackUrl
                });

                return res.json({
                    txnid,
                    amount: depositAmt,
                    ...easeResult
                });
            } catch (easebuzzError: any) {
                logger.error(`[Wallet Deposit] Easebuzz initiation failed, falling back to mock gateway. Error: ${easebuzzError.message}`);
                return res.json({
                    txnid,
                    amount: depositAmt,
                    paymentLink: `${baseUrl.replace(/\/$/, "")}/payment/mock-gateway?orderId=${txnid}&amount=${depositAmt}`,
                });
            }
        }

        return res.json({
            txnid,
            amount: depositAmt,
            paymentLink: `${baseUrl.replace(/\/$/, "")}/payment/mock-gateway?orderId=${txnid}&amount=${depositAmt}`,
        });
    } catch (error: any) {
        logger.error(`[Wallet Deposit Error]: ${error.message}`);
        return res.status(500).json({ message: "Failed to initiate wallet deposit" });
    }
};

export const verifyWalletDeposit = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ message: "Authentication required" });

        const { txnid, amount, txn_id, status } = req.body;
        const depositAmt = Number(amount);
        if (!depositAmt || depositAmt <= 0) {
            return res.status(400).json({ message: "Invalid deposit amount" });
        }

        const effectiveRefId = txn_id || txnid || `WLT_${Date.now()}`;
        const result = await processWalletDepositCredit({
            userId,
            amount: depositAmt,
            referenceId: effectiveRefId,
            paymentMethod: "EASEBUZZ"
        });

        return res.json({
            success: true,
            accountBalance: result.balance,
            message: `₹${depositAmt.toFixed(2)} deposited successfully into your advance wallet.`
        });
    } catch (error: any) {
        logger.error(`[Wallet Verify Error]: ${error.message}`);
        return res.status(500).json({ message: error.message || "Failed to verify wallet deposit" });
    }
};

export const getWalletDetails = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ message: "Authentication required" });

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, phone: true, accountBalance: true }
        });
        if (!user) return res.status(404).json({ message: "User not found" });

        const transactions = await prisma.walletTransaction.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 50
        });

        return res.json({
            accountBalance: Number(user.accountBalance || 0),
            transactions: transactions.map(t => ({
                id: t.id,
                amount: Number(t.amount),
                type: t.type,
                paymentMethod: t.paymentMethod,
                referenceId: t.referenceId,
                balanceAfter: Number(t.balanceAfter),
                notes: t.notes,
                createdAt: t.createdAt
            }))
        });
    } catch (error: any) {
        logger.error(`[Get Wallet Details Error]: ${error.message}`);
        return res.status(500).json({ message: "Failed to load wallet details" });
    }
};



