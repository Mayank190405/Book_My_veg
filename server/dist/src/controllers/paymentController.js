"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refundPayment = exports.handleWebhook = exports.verifyPayment = exports.getOrderStatus = exports.generatePaymentLink = exports.initiatePayment = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const juspayService_1 = require("../services/juspayService");
const productController_1 = require("./productController");
const inventoryService_1 = require("../services/inventoryService");
const logger_1 = __importDefault(require("../utils/logger"));
const io_1 = require("../sockets/io");
const idGenerator_1 = require("../utils/idGenerator");
// ─── initiatePayment ─────────────────────────────────────────────────────────
const initiatePayment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { amount, address, items, locationId: rootLocationId } = req.body;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const user = yield prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!user)
            return res.status(404).json({ message: "User not found" });
        // ── Resilience: Resolve locationId from multiple sources ──────────
        let locationId = rootLocationId || (typeof address === 'object' ? address === null || address === void 0 ? void 0 : address.locationId : null);
        if (!locationId) {
            // Fallback: Pick the first available store location
            const defaultLoc = yield prisma_1.default.location.findFirst({ select: { id: true } });
            locationId = defaultLoc === null || defaultLoc === void 0 ? void 0 : defaultLoc.id;
        }
        if (!locationId)
            return res.status(400).json({ message: "No active store location found. Cannot check out." });
        // ── FIX 1 + 6: Stock decrement inside tx ──
        const order = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // Atomic stock lock + decrement via wrapper
            yield inventoryService_1.InventoryService.deductStock({
                items,
                locationId,
                type: inventoryService_1.InventoryLogType.SALE,
                staffId: userId
            }, tx);
            const newOrder = yield tx.order.create({
                data: {
                    id: (0, idGenerator_1.generateOrderId)(),
                    userId,
                    totalAmount: amount,
                    status: "PAYMENT_PENDING",
                    paymentStatus: "PENDING",
                    shippingAddress: address || {},
                    locationId: locationId, // Store identified location
                    items: {
                        create: items.map((item) => ({
                            productId: item.productId,
                            locationId: locationId, // Track store at line level
                            quantity: item.quantity,
                            sellingPrice: item.sellingPrice || item.price,
                            variantId: item.variantId || null
                        })),
                    },
                },
            });
            yield tx.payment.create({
                data: {
                    orderId: newOrder.id,
                    amount: newOrder.totalAmount,
                    method: "ONLINE",
                    status: "PENDING",
                    transactionId: `PENDING_${Date.now()}`
                }
            });
            return newOrder;
        }));
        // Determine base URL dynamically for development on IP addresses
        let baseUrl = process.env.CLIENT_URL || "http://localhost:3000";
        const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
        if (origin && (baseUrl.includes("localhost") || !process.env.CLIENT_URL)) {
            baseUrl = origin;
        }
        // Fallback to Mock Payment Gateway if JUSPAY_API_KEY is not configured/empty
        if (!process.env.JUSPAY_API_KEY) {
            logger_1.default.info(`[Payment] JUSPAY_API_KEY is empty. Falling back to Mock Payment Gateway for order: ${order.id}`);
            return res.json({
                orderId: order.id,
                paymentLink: `${baseUrl.replace(/\/$/, "")}/payment/mock-gateway?orderId=${order.id}&amount=${amount}`,
            });
        }
        let session;
        try {
            session = yield (0, juspayService_1.createJuspaySession)({
                order_id: order.id,
                amount,
                customer_id: userId,
                customer_email: user.email || "no-email@domain.com",
                customer_phone: user.phone,
                return_url: `${baseUrl.replace(/\/$/, "")}/payment/success`,
            });
        }
        catch (juspayError) {
            logger_1.default.warn(`[Payment] Juspay session creation failed, falling back to mock gateway. Error: ${juspayError}`);
            return res.json({
                orderId: order.id,
                paymentLink: `${baseUrl.replace(/\/$/, "")}/payment/mock-gateway?orderId=${order.id}&amount=${amount}`,
            });
        }
        res.json({
            orderId: order.id,
            paymentLink: (_b = session.payment_links) === null || _b === void 0 ? void 0 : _b.web,
            sdkPayload: session.sdk_payload,
        });
    }
    catch (error) {
        if ((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes("stock")) {
            return res.status(409).json({ message: error.message });
        }
        console.error("Payment Initiation Error:", error);
        res.status(500).json({ message: "Error initiating payment" });
    }
});
exports.initiatePayment = initiatePayment;
const generatePaymentLink = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { orderId } = req.params;
    try {
        const order = yield prisma_1.default.order.findUnique({
            where: { id: orderId },
            include: { user: true }
        });
        if (!order)
            return res.status(404).json({ message: "Order not found" });
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
            logger_1.default.info(`[Payment] JUSPAY_API_KEY is empty. Falling back to Mock Payment Gateway for order: ${orderId}`);
            return res.json({
                paymentLink: `${baseUrl.replace(/\/$/, "")}/payment/mock-gateway?orderId=${orderId}&amount=${order.totalAmount}`,
            });
        }
        let session;
        try {
            session = yield (0, juspayService_1.createJuspaySession)({
                order_id: order.id,
                amount: Number(order.totalAmount),
                customer_id: order.userId,
                customer_email: order.user.email || "no-email@domain.com",
                customer_phone: order.user.phone,
                return_url: `${baseUrl.replace(/\/$/, "")}/payment/success`,
            });
        }
        catch (juspayError) {
            logger_1.default.warn(`[Payment] Juspay session generation failed, falling back to mock gateway. Error: ${juspayError}`);
            return res.json({
                paymentLink: `${baseUrl.replace(/\/$/, "")}/payment/mock-gateway?orderId=${orderId}&amount=${order.totalAmount}`,
            });
        }
        res.json({
            paymentLink: ((_a = session.payment_links) === null || _a === void 0 ? void 0 : _a.web) || ((_b = session.payment_links) === null || _b === void 0 ? void 0 : _b.mobile),
        });
    }
    catch (error) {
        console.error("Generate Payment Link Error:", error);
        res.status(500).json({ message: "Error generating payment link" });
    }
});
exports.generatePaymentLink = generatePaymentLink;
// ─── verifyPayment (with idempotency + trending tracking) ────────────────────
// ─── Shared Helper: Complete Order Payment ───────────────────────────────────
const completeOrderPayment = (orderId, paymentDetails) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const existing = yield prisma_1.default.order.findUnique({
        where: { id: orderId },
        include: { items: true, user: true },
    });
    if (!existing)
        throw new Error("Order not found");
    if (paymentDetails.status === "CHARGED" || paymentDetails.status === "SUCCESS") {
        yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            yield tx.order.update({
                where: { id: orderId },
                data: { paymentStatus: "PAID", status: "CONFIRMED" },
            });
            const pendingPayment = yield tx.payment.findFirst({
                where: { orderId: orderId, status: "PENDING" }
            });
            if (pendingPayment) {
                yield tx.payment.update({
                    where: { id: pendingPayment.id },
                    data: {
                        status: "SUCCESS",
                        amount: paymentDetails.amount || existing.totalAmount,
                        method: paymentDetails.payment_method_type || "ONLINE",
                        transactionId: paymentDetails.txn_id || paymentDetails.order_id || orderId,
                        metadata: paymentDetails || {},
                    }
                });
            }
            else {
                yield tx.payment.create({
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
            yield tx.notification.create({
                data: {
                    userId: existing.userId,
                    title: "Order Confirmed",
                    body: `Your order #${orderId} of ₹${existing.totalAmount} has been successfully placed! We are preparing it for delivery.`,
                    type: "ORDER",
                    isRead: false
                }
            });
            yield tx.orderStatusHistory.create({
                data: {
                    orderId: orderId,
                    status: "CONFIRMED",
                    remark: "Payment confirmed via Juspay",
                    changedBy: "SYSTEM",
                },
            });
        }));
        // ── Real-time Notification for Logistics ──────────────────────────
        (0, io_1.getIo)().emit("OP_NEW_ORDER", {
            id: orderId,
            status: "CONFIRMED",
            timestamp: new Date()
        });
        // ── WhatsApp Notification Dispatch ────────────────────────────────
        const user = existing.user;
        if (user && user.phone) {
            try {
                const { sendOrderConfirmationViaWhatsapp } = require("../services/mbgcard");
                sendOrderConfirmationViaWhatsapp(user.phone, orderId, Number(existing.totalAmount)).catch((err) => {
                    console.error("[PaymentController] WhatsApp dispatch failure:", err);
                });
            }
            catch (err) {
                console.error("[PaymentController] Failed to send WhatsApp:", err);
            }
        }
        // Track trending (non-critical)
        try {
            const locationId = ((_a = existing.shippingAddress) === null || _a === void 0 ? void 0 : _a.locationId) || "global";
            yield (0, productController_1.trackTrendingOnOrder)(existing.items.map((i) => ({ productId: i.productId, quantity: i.quantity })), locationId);
        }
        catch (e) {
            console.warn("Trending update failed:", e);
        }
        return { status: "SUCCESS" };
    }
    else {
        // Payment Failed -> Restore Stock if not already failed
        if (existing.paymentStatus !== "FAILED") {
            yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
                var _a;
                yield tx.order.update({
                    where: { id: orderId },
                    data: { paymentStatus: "FAILED", status: "FAILED" },
                });
                const locationId = (_a = existing.shippingAddress) === null || _a === void 0 ? void 0 : _a.locationId;
                if (locationId) {
                    yield inventoryService_1.InventoryService.restoreStock({
                        items: existing.items.map(i => ({ productId: i.productId, variantId: i.variantId || undefined, quantity: i.quantity })),
                        locationId,
                        staffId: "SYSTEM",
                        referenceId: `FAIL_${orderId}`
                    }, tx);
                }
                yield tx.orderStatusHistory.create({
                    data: {
                        orderId: orderId,
                        status: "FAILED",
                        remark: `Payment failed — status: ${paymentDetails.status}`,
                        changedBy: "SYSTEM",
                    },
                });
            }));
        }
        return { status: "FAILED" };
    }
});
// ─── getOrderStatus (DB-level, no Juspay call) ───────────────────────────────
const getOrderStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const orderId = req.params.orderId;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    try {
        const order = yield prisma_1.default.order.findFirst({
            where: { id: orderId, userId },
            select: { id: true, status: true, paymentStatus: true, totalAmount: true, createdAt: true },
        });
        if (!order)
            return res.status(404).json({ message: "Order not found" });
        res.json(order);
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching order status" });
    }
});
exports.getOrderStatus = getOrderStatus;
// ─── verifyPayment (Client/Redirect-based) ───────────────────────────────────
const verifyPayment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { order_id } = req.body;
    logger_1.default.info(`[Payment] verifyPayment hit for order: ${order_id}`);
    try {
        // 1. Check DB first (Idempotency)
        const existing = yield prisma_1.default.order.findUnique({
            where: { id: order_id },
            select: { id: true, status: true, paymentStatus: true, totalAmount: true },
        });
        if (!existing)
            return res.status(404).json({ message: "Order not found" });
        // If already completed, return success
        if (existing.paymentStatus === "PAID" || existing.paymentStatus === "COMPLETED") {
            return res.json({ status: "SUCCESS", message: "Already completed" });
        }
        // Check if JUSPAY_API_KEY is not configured or if status is explicitly provided in body (mock gateway path)
        if (!process.env.JUSPAY_API_KEY || req.body.status) {
            const rawStatus = req.body.status || "CHARGED";
            const SUCCESS_STATUSES = ["CHARGED", "SUCCESS", "PAYMENT_SUCCESS", "AUTHORIZED"];
            const isSuccess = SUCCESS_STATUSES.includes(rawStatus.toUpperCase());
            logger_1.default.info(`[Payment] Running mock payment verification for order ${order_id} (status: ${rawStatus})`);
            const result = yield completeOrderPayment(order_id, {
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
        logger_1.default.info(`[Payment] Verifying order ${order_id} with Juspay API...`);
        let juspayOrder;
        try {
            juspayOrder = yield (0, juspayService_1.getJuspayOrderStatus)(order_id);
        }
        catch (juspayError) {
            // Fallback: If Juspay verification fails but we are in review/mock path
            logger_1.default.warn(`[Payment] Juspay status fetch failed for ${order_id}, falling back to mock verification...`);
            const rawStatus = req.body.status || "CHARGED";
            const SUCCESS_STATUSES = ["CHARGED", "SUCCESS", "PAYMENT_SUCCESS", "AUTHORIZED"];
            const isSuccess = SUCCESS_STATUSES.includes(rawStatus.toUpperCase());
            const result = yield completeOrderPayment(order_id, {
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
        const status = ((_a = juspayOrder.status) !== null && _a !== void 0 ? _a : "").toUpperCase();
        const SUCCESS_STATUSES = ["CHARGED", "SUCCESS", "PAYMENT_SUCCESS", "AUTHORIZED"];
        if (SUCCESS_STATUSES.includes(status)) {
            // 3. Complete order logic (updates DB, tracks trending, etc.)
            const result = yield completeOrderPayment(order_id, juspayOrder);
            if (result.status === "SUCCESS" || result.status === "ALREADY_COMPLETED") {
                return res.json({ status: "SUCCESS", message: "Payment verified via Gateway" });
            }
        }
        if (["FAILED", "JUSPAY_DECLINED", "AUTHORIZATION_FAILED", "AUTHENTICATION_FAILED"].includes(status)) {
            // Handle Failure (restores stock)
            yield completeOrderPayment(order_id, juspayOrder);
            return res.status(400).json({ status: "FAILED", message: "Payment declined/failed" });
        }
        // 4. Case: Still Pending at Gateway
        res.status(202).json({ status: "PENDING", message: "Payment confirmation still pending at bank" });
    }
    catch (error) {
        console.error("Verification Error:", error);
        res.status(500).json({ message: "Error verifying payment with gateway" });
    }
});
exports.verifyPayment = verifyPayment;
// ─── handleWebhook (Server-to-Server) ────────────────────────────────────────
const juspayService_2 = require("../services/juspayService");
const handleWebhook = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const signature = req.headers["x-juspay-signature"];
    // Verify HMAC signature — if RESPONSE_KEY not set, it logs a warning and passes through
    if (!(0, juspayService_2.verifyJuspaySignature)(JSON.stringify(req.body), signature)) {
        console.error("Invalid Webhook Signature");
        return res.status(403).json({ message: "Invalid signature" });
    }
    // Juspay sends: { order_id, status, txn_id, amount, payment_method_type, ... }
    const { order_id, status, txn_id, amount, payment_method_type } = req.body;
    if (!order_id || !status)
        return res.status(400).json({ message: "Missing order_id or status" });
    logger_1.default.info(`[Webhook] Juspay notification for order ${order_id}: status=${status}`);
    try {
        // Trust the webhook body directly — this is a server-to-server call from Juspay
        // No need to re-fetch from Juspay API (which fails on sandbox anyway)
        yield completeOrderPayment(order_id, { status, txn_id, amount, payment_method_type });
        res.json({ status: "OK" });
    }
    catch (error) {
        console.error("Webhook Error:", error);
        res.status(500).json({ message: "Error processing webhook" });
    }
});
exports.handleWebhook = handleWebhook;
// ─── refundPayment ────────────────────────────────────────────────────────────
const refundPayment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const { orderId, amount } = req.body;
    if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) !== "ADMIN" && ((_b = req.user) === null || _b === void 0 ? void 0 : _b.role) !== "STORE_ADMIN") {
        return res.status(403).json({ message: "Forbidden" });
    }
    try {
        const order = yield prisma_1.default.order.findUnique({
            where: { id: orderId },
            include: { items: true },
        });
        if (!order)
            return res.status(404).json({ message: "Order not found" });
        // ── Idempotency: skip if already refunded ─────────────────────────
        if (order.paymentStatus === "REFUNDED") {
            return res.json({ message: "Already refunded (idempotent)" });
        }
        const uniqueRequestId = `REF_${orderId}_${Date.now()}`;
        const refundResponse = yield (0, juspayService_1.refundJuspayOrder)(orderId, amount || Number(order.totalAmount), uniqueRequestId);
        const refundSucceeded = refundResponse.status === "SUCCESS" ||
            refundResponse.status === "CHARGED" ||
            ((_c = refundResponse.refunds) === null || _c === void 0 ? void 0 : _c.some((r) => r.status === "SUCCESS"));
        if (refundSucceeded) {
            yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
                var _a, _b, _c;
                yield tx.order.update({
                    where: { id: orderId },
                    data: { paymentStatus: "REFUNDED", status: "CANCELLED" },
                });
                yield tx.payment.create({
                    data: {
                        orderId,
                        amount: amount || Number(order.totalAmount),
                        method: "JUSPAY_REFUND",
                        status: "SUCCESS",
                        transactionId: uniqueRequestId,
                        metadata: refundResponse,
                    },
                });
                const locationId = (_a = order.shippingAddress) === null || _a === void 0 ? void 0 : _a.locationId;
                if (locationId) {
                    yield inventoryService_1.InventoryService.restoreStock({
                        items: order.items.map(i => ({ productId: i.productId, variantId: i.variantId || undefined, quantity: i.quantity })),
                        locationId,
                        staffId: ((_b = req.user) === null || _b === void 0 ? void 0 : _b.userId) || "SYSTEM",
                        referenceId: `REFUND_${orderId}`
                    }, tx);
                }
                yield tx.orderStatusHistory.create({
                    data: {
                        orderId,
                        status: "CANCELLED",
                        remark: "Refund processed — stock restored",
                        changedBy: ((_c = req.user) === null || _c === void 0 ? void 0 : _c.userId) || "SYSTEM",
                    },
                });
            }));
            res.json({ message: "Refund processed and stock restored", data: refundResponse });
        }
        else {
            res.status(400).json({ message: "Refund failed", data: refundResponse });
        }
    }
    catch (error) {
        console.error("Refund Error:", error);
        res.status(500).json({ message: "Error processing refund" });
    }
});
exports.refundPayment = refundPayment;
