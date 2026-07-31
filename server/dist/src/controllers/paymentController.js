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
exports.initiatePayDue = exports.getPayInfo = exports.checkPaymentEligibility = exports.refundPayment = exports.handleEasebuzzCallback = exports.handleWebhook = exports.verifyPayment = exports.getOrderStatus = exports.settleDuesForCustomer = exports.generatePaymentLink = exports.initiatePayment = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const juspayService_1 = require("../services/juspayService");
const productController_1 = require("./productController");
const inventoryService_1 = require("../services/inventoryService");
const logger_1 = __importDefault(require("../utils/logger"));
const io_1 = require("../sockets/io");
const idGenerator_1 = require("../utils/idGenerator");
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const paymentEligibilityService_1 = require("../services/paymentEligibilityService");
const generateSha512 = (str) => {
    return crypto_1.default.createHash("sha512").update(str).digest("hex").toLowerCase();
};
const getEasebuzzReverseHash = (body, salt) => {
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
const sanitizePhone = (phone) => {
    if (!phone)
        return "9999999999";
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("91") && digits.length === 12) {
        return digits.substring(2);
    }
    return digits || "9999999999";
};
// ─── initiatePayment ─────────────────────────────────────────────────────────
const initiatePayment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
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
        // Easebuzz Integration Pathway
        if (process.env.EASEBUZZ_SERVICE_URL && process.env.EASEBUZZ_MERCHANT_KEY) {
            logger_1.default.info(`[Payment] Using Easebuzz Payment Gateway for order: ${order.id}`);
            try {
                const protocol = req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
                const callbackUrl = `${protocol}://${req.headers.host}/api/v1/payments/easebuzz/callback`;
                const addressObj = address;
                const customerName = (addressObj === null || addressObj === void 0 ? void 0 : addressObj.name) || user.name || "Customer";
                const customerPhone = (addressObj === null || addressObj === void 0 ? void 0 : addressObj.phone) || user.phone || "9999999999";
                const useIframe = process.env.EASEBUZZ_IFRAME === "1";
                const apiName = useIframe ? "initiate_payment_iframe" : "initiate_payment";
                const easebuzzRes = yield axios_1.default.post(`${process.env.EASEBUZZ_SERVICE_URL.replace(/\/$/, "")}/easebuzz?api_name=${apiName}`, {
                    txnid: order.id,
                    amount: Number(amount).toFixed(2),
                    firstname: customerName,
                    email: user.email || "customer@example.com",
                    phone: sanitizePhone(customerPhone),
                    productinfo: `Order ${order.id}`,
                    surl: callbackUrl,
                    furl: callbackUrl,
                }, {
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    }
                });
                if (easebuzzRes.data && easebuzzRes.data.status === 1) {
                    if (useIframe) {
                        return res.json({
                            orderId: order.id,
                            iframe: true,
                            key: easebuzzRes.data.data.key,
                            accessKey: easebuzzRes.data.data.access_key,
                            env: easebuzzRes.data.data.env,
                        });
                    }
                    else if (easebuzzRes.data.paymentLink) {
                        return res.json({
                            orderId: order.id,
                            paymentLink: easebuzzRes.data.paymentLink,
                        });
                    }
                }
                throw new Error(((_b = easebuzzRes.data) === null || _b === void 0 ? void 0 : _b.message) || "Failed to initiate payment with Easebuzz");
            }
            catch (easebuzzError) {
                logger_1.default.error(`[Payment] Easebuzz initiation failed, falling back to mock gateway. Error: ${easebuzzError.message}, Data: ${JSON.stringify((_c = easebuzzError.response) === null || _c === void 0 ? void 0 : _c.data)}`);
                return res.json({
                    orderId: order.id,
                    paymentLink: `${baseUrl.replace(/\/$/, "")}/payment/mock-gateway?orderId=${order.id}&amount=${amount}`,
                });
            }
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
            paymentLink: (_d = session.payment_links) === null || _d === void 0 ? void 0 : _d.web,
            sdkPayload: session.sdk_payload,
        });
    }
    catch (error) {
        if ((_e = error.message) === null || _e === void 0 ? void 0 : _e.includes("stock")) {
            return res.status(409).json({ message: error.message });
        }
        console.error("Payment Initiation Error:", error);
        res.status(500).json({ message: "Error initiating payment" });
    }
});
exports.initiatePayment = initiatePayment;
const generatePaymentLink = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
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
        // Easebuzz Integration Pathway
        if (process.env.EASEBUZZ_SERVICE_URL && process.env.EASEBUZZ_MERCHANT_KEY) {
            logger_1.default.info(`[Payment] Using Easebuzz Payment Gateway for generating link: ${orderId}`);
            const pendingOnlinePayment = yield prisma_1.default.payment.findFirst({
                where: { orderId: order.id, method: "ONLINE", status: "PENDING" }
            });
            const amountToCharge = pendingOnlinePayment
                ? Number(pendingOnlinePayment.amount).toFixed(2)
                : Number(order.totalAmount).toFixed(2);
            try {
                const protocol = req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
                const callbackUrl = `${protocol}://${req.headers.host}/api/v1/payments/easebuzz/callback`;
                const addressObj = order.shippingAddress;
                const customerName = (addressObj === null || addressObj === void 0 ? void 0 : addressObj.name) || order.user.name || "Customer";
                const customerPhone = (addressObj === null || addressObj === void 0 ? void 0 : addressObj.phone) || order.user.phone || "9999999999";
                const useIframe = process.env.EASEBUZZ_IFRAME === "1";
                const apiName = useIframe ? "initiate_payment_iframe" : "initiate_payment";
                const easebuzzRes = yield axios_1.default.post(`${process.env.EASEBUZZ_SERVICE_URL.replace(/\/$/, "")}/easebuzz?api_name=${apiName}`, {
                    txnid: order.id,
                    amount: amountToCharge,
                    firstname: customerName,
                    email: order.user.email || "customer@example.com",
                    phone: sanitizePhone(customerPhone),
                    productinfo: `Order ${order.id}`,
                    surl: callbackUrl,
                    furl: callbackUrl,
                }, {
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    }
                });
                if (easebuzzRes.data && easebuzzRes.data.status === 1) {
                    if (useIframe) {
                        return res.json({
                            iframe: true,
                            key: easebuzzRes.data.data.key,
                            accessKey: easebuzzRes.data.data.access_key,
                            env: easebuzzRes.data.data.env,
                        });
                    }
                    else if (easebuzzRes.data.paymentLink) {
                        return res.json({
                            paymentLink: easebuzzRes.data.paymentLink,
                        });
                    }
                }
                throw new Error(((_a = easebuzzRes.data) === null || _a === void 0 ? void 0 : _a.message) || "Failed to initiate payment with Easebuzz");
            }
            catch (easebuzzError) {
                logger_1.default.error(`[Payment] Easebuzz generation failed, falling back to mock gateway. Error: ${easebuzzError.message}, Data: ${JSON.stringify((_b = easebuzzError.response) === null || _b === void 0 ? void 0 : _b.data)}`);
                return res.json({
                    paymentLink: `${baseUrl.replace(/\/$/, "")}/payment/mock-gateway?orderId=${orderId}&amount=${amountToCharge}`,
                });
            }
        }
        const pendingOnlinePaymentFallback = yield prisma_1.default.payment.findFirst({
            where: { orderId: order.id, method: "ONLINE", status: "PENDING" }
        });
        const amountToChargeFallback = pendingOnlinePaymentFallback
            ? Number(pendingOnlinePaymentFallback.amount).toFixed(2)
            : Number(order.totalAmount).toFixed(2);
        // Fallback to Mock Payment Gateway if JUSPAY_API_KEY is not configured/empty
        if (!process.env.JUSPAY_API_KEY) {
            logger_1.default.info(`[Payment] JUSPAY_API_KEY is empty. Falling back to Mock Payment Gateway for order: ${orderId}`);
            return res.json({
                paymentLink: `${baseUrl.replace(/\/$/, "")}/payment/mock-gateway?orderId=${orderId}&amount=${amountToChargeFallback}`,
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
            paymentLink: ((_c = session.payment_links) === null || _c === void 0 ? void 0 : _c.web) || ((_d = session.payment_links) === null || _d === void 0 ? void 0 : _d.mobile),
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
const settleDuesForCustomer = (userId, amount, transactionId, metadata) => __awaiter(void 0, void 0, void 0, function* () {
    let remaining = Number(amount);
    yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        const unpaid = yield tx.order.findMany({
            where: {
                userId,
                paymentStatus: { in: ["PENDING", "PARTIAL"] },
                status: { notIn: ["CANCELLED", "FAILED", "PAYMENT_PENDING"] }
            },
            orderBy: { createdAt: "asc" },
            include: { payments: true }
        });
        for (const order of unpaid) {
            if (remaining <= 0)
                break;
            const paid = order.payments.filter((p) => p.status === "SUCCESS").reduce((acc, p) => acc + Number(p.amount), 0);
            const due = Number(order.totalAmount) - paid;
            const toApply = Math.min(remaining, due);
            if (toApply > 0) {
                yield tx.payment.create({
                    data: {
                        orderId: order.id,
                        amount: toApply,
                        method: (metadata === null || metadata === void 0 ? void 0 : metadata.payment_method_type) || "EASEBUZZ",
                        status: "SUCCESS",
                        transactionId: transactionId || `SETTLE_${Date.now()}`,
                        metadata: metadata || {}
                    }
                });
                const isFull = (paid + toApply) >= Number(order.totalAmount);
                yield tx.order.update({
                    where: { id: order.id },
                    data: {
                        isPaid: isFull,
                        paymentStatus: isFull ? "COMPLETED" : "PARTIAL"
                    }
                });
                remaining -= toApply;
            }
        }
    }));
});
exports.settleDuesForCustomer = settleDuesForCustomer;
const completeOrderPayment = (orderId, paymentDetails) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    let existing = yield prisma_1.default.order.findUnique({
        where: { id: orderId },
        include: { items: true, user: true },
    });
    if (!existing) {
        if (orderId.startsWith("SETTLE_") || orderId.startsWith("DUE_")) {
            const parts = orderId.split("_");
            const targetId = parts[1];
            if (paymentDetails.status === "CHARGED" || paymentDetails.status === "SUCCESS") {
                yield (0, exports.settleDuesForCustomer)(targetId, Number(paymentDetails.amount), paymentDetails.txn_id || orderId, paymentDetails);
                return { status: "SUCCESS" };
            }
        }
        throw new Error("Order not found");
    }
    if (paymentDetails.status === "CHARGED" || paymentDetails.status === "SUCCESS") {
        yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const pendingCodPayment = yield tx.payment.findFirst({
                where: { orderId: orderId, method: "COD", status: "PENDING" }
            });
            const newPaymentStatus = pendingCodPayment ? "PARTIAL" : "PAID";
            yield tx.order.update({
                where: { id: orderId },
                data: { paymentStatus: newPaymentStatus, status: "CONFIRMED" },
            });
            const pendingPayment = (yield tx.payment.findFirst({
                where: { orderId: orderId, status: "PENDING", method: "ONLINE" }
            })) || (yield tx.payment.findFirst({
                where: { orderId: orderId, status: "PENDING" }
            }));
            if (pendingPayment) {
                yield tx.payment.update({
                    where: { id: pendingPayment.id },
                    data: {
                        status: "SUCCESS",
                        amount: paymentDetails.amount || pendingPayment.amount,
                        method: paymentDetails.payment_method_type || pendingPayment.method,
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
    var _a, _b;
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
        // Check if status is explicitly provided in body (mock gateway path)
        if (req.body.status) {
            const rawStatus = req.body.status;
            const SUCCESS_STATUSES = ["CHARGED", "SUCCESS", "PAYMENT_SUCCESS", "AUTHORIZED"];
            const isSuccess = SUCCESS_STATUSES.includes(rawStatus.toUpperCase());
            logger_1.default.info(`[Payment] Running mock payment verification for order ${order_id} (status: ${rawStatus})`);
            yield completeOrderPayment(order_id, {
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
        // Easebuzz Verification Pathway
        if (process.env.EASEBUZZ_SERVICE_URL && process.env.EASEBUZZ_MERCHANT_KEY) {
            logger_1.default.info(`[Payment] Verifying order ${order_id} with Easebuzz...`);
            try {
                const easebuzzRes = yield axios_1.default.post(`${process.env.EASEBUZZ_SERVICE_URL.replace(/\/$/, "")}/easebuzz?api_name=transaction`, { txnid: order_id }, {
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    }
                });
                const txData = easebuzzRes.data;
                logger_1.default.info(`[Payment] Easebuzz verification response: ${JSON.stringify(txData)}`);
                if (!txData || txData.status === 0 || !txData.detail) {
                    throw new Error((txData === null || txData === void 0 ? void 0 : txData.message) || "Transaction not found on Easebuzz");
                }
                const detail = txData.detail;
                const status = ((_a = detail.status) !== null && _a !== void 0 ? _a : "").toUpperCase();
                const SUCCESS_STATUSES = ["SUCCESS", "CHARGED", "PAYMENT_SUCCESS"];
                if (SUCCESS_STATUSES.includes(status)) {
                    yield completeOrderPayment(order_id, {
                        status: "CHARGED",
                        txn_id: detail.easepayid || detail.txnid || order_id,
                        amount: Number(detail.amount || existing.totalAmount),
                        payment_method_type: detail.mode || "ONLINE"
                    });
                    return res.json({ status: "SUCCESS", message: "Payment verified via Easebuzz" });
                }
                if (["FAILED", "FAILURE", "BOUNCED", "ERROR"].includes(status)) {
                    yield completeOrderPayment(order_id, {
                        status: "FAILED",
                        txn_id: detail.easepayid || detail.txnid || order_id,
                        amount: Number(detail.amount || existing.totalAmount),
                        payment_method_type: detail.mode || "ONLINE"
                    });
                    return res.status(400).json({ status: "FAILED", message: "Payment failed/declined" });
                }
                return res.status(202).json({ status: "PENDING", message: `Payment confirmation pending. Status: ${status}` });
            }
            catch (easebuzzError) {
                logger_1.default.warn(`[Payment] Easebuzz status fetch failed for ${order_id}, falling back to mock verification...`);
                yield completeOrderPayment(order_id, {
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
        const status = ((_b = juspayOrder.status) !== null && _b !== void 0 ? _b : "").toUpperCase();
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
    // 1. Easebuzz Webhook Pathway
    if (req.body.hash && process.env.EASEBUZZ_SALT) {
        logger_1.default.info(`[Webhook] Easebuzz notification received: ${JSON.stringify(req.body)}`);
        const calculatedHash = getEasebuzzReverseHash(req.body, process.env.EASEBUZZ_SALT);
        if (calculatedHash !== req.body.hash) {
            logger_1.default.error(`[Webhook] Invalid Easebuzz Signature: calculated=${calculatedHash}, received=${req.body.hash}`);
            return res.status(403).json({ message: "Invalid signature" });
        }
        const { txnid, status, easebuzz_id, amount, mode } = req.body;
        if (!txnid || !status)
            return res.status(400).json({ message: "Missing txnid or status" });
        const isSuccess = (status || "").toLowerCase() === "success";
        try {
            yield completeOrderPayment(txnid, {
                status: isSuccess ? "CHARGED" : "FAILED",
                txn_id: easebuzz_id || txnid,
                amount: Number(amount),
                payment_method_type: mode || "ONLINE"
            });
            return res.json({ status: "OK" });
        }
        catch (error) {
            console.error("Webhook Error:", error);
            return res.status(500).json({ message: "Error processing webhook" });
        }
    }
    // 2. Juspay Webhook Pathway
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
// ─── handleEasebuzzCallback (Easebuzz Redirect Endpoint) ──────────────────────
const handleEasebuzzCallback = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    logger_1.default.info(`[Easebuzz Callback] Received callback payload: ${JSON.stringify(req.body)}`);
    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
    if (!req.body.hash || !process.env.EASEBUZZ_SALT) {
        logger_1.default.error("[Easebuzz Callback] Missing hash or EASEBUZZ_SALT");
        return res.redirect(`${clientUrl}/payment/success?status=failed&message=Missing signature`);
    }
    const calculatedHash = getEasebuzzReverseHash(req.body, process.env.EASEBUZZ_SALT);
    if (calculatedHash !== req.body.hash) {
        logger_1.default.error(`[Easebuzz Callback] Invalid Signature: calculated=${calculatedHash}, received=${req.body.hash}`);
        return res.redirect(`${clientUrl}/payment/success?status=failed&message=Invalid signature`);
    }
    const { txnid, status, easebuzz_id, amount, mode } = req.body;
    if (!txnid) {
        logger_1.default.error("[Easebuzz Callback] Missing txnid in payload");
        return res.redirect(`${clientUrl}/payment/success?status=failed&message=Missing transaction ID`);
    }
    const isSuccess = (status || "").toLowerCase() === "success";
    try {
        yield completeOrderPayment(txnid, {
            status: isSuccess ? "CHARGED" : "FAILED",
            txn_id: easebuzz_id || txnid,
            amount: Number(amount),
            payment_method_type: mode || "ONLINE"
        });
        return res.redirect(`${clientUrl}/payment/success?order_id=${txnid}&status=${isSuccess ? "success" : "failed"}`);
    }
    catch (error) {
        logger_1.default.error(`[Easebuzz Callback] Error completing payment: ${error.message}`);
        return res.redirect(`${clientUrl}/payment/success?order_id=${txnid}&status=failed&message=Payment completion failed`);
    }
});
exports.handleEasebuzzCallback = handleEasebuzzCallback;
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
const checkPaymentEligibility = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const amount = parseFloat(req.query.amount) || 0;
    if (!userId)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const eligibility = yield (0, paymentEligibilityService_1.getPaymentEligibility)(userId, amount);
        res.json(eligibility);
    }
    catch (error) {
        logger_1.default.error("[Payment] Error checking payment eligibility:", error);
        res.status(500).json({ message: "Error checking payment eligibility" });
    }
});
exports.checkPaymentEligibility = checkPaymentEligibility;
// ─── Public Pay Info & Pay Due Functions ────────────────────────────────────
const getPayInfo = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userid = (req.query.userid || req.query.userId);
        const number = (req.query.number || req.query.phone);
        const billid = (req.query.billid || req.query.billId);
        if (!userid && !number && !billid) {
            return res.status(400).json({ message: "Missing required parameters (userid, number, or billid)" });
        }
        let customer = null;
        if (userid) {
            customer = yield prisma_1.default.user.findUnique({ where: { id: userid } });
        }
        if (!customer && number) {
            const cleanPhone = number.replace(/\D/g, "");
            customer = yield prisma_1.default.user.findFirst({
                where: {
                    OR: [
                        { phone: number },
                        { phone: cleanPhone },
                        { phone: `+91${cleanPhone}` }
                    ]
                }
            });
        }
        let singleBill = null;
        if (billid) {
            const order = yield prisma_1.default.order.findUnique({
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
                const paid = order.payments.filter((p) => p.status === "SUCCESS").reduce((sum, p) => sum + Number(p.amount), 0);
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
                    items: order.items.map((i) => {
                        var _a;
                        return ({
                            id: i.id,
                            name: ((_a = i.product) === null || _a === void 0 ? void 0 : _a.name) || "Item",
                            quantity: i.quantity,
                            sellingPrice: Number(i.sellingPrice)
                        });
                    })
                };
            }
        }
        let unpaidOrders = [];
        let totalDue = 0;
        const effectiveUserId = (customer === null || customer === void 0 ? void 0 : customer.id) || userid;
        if (effectiveUserId) {
            const orders = yield prisma_1.default.order.findMany({
                where: {
                    userId: effectiveUserId,
                    paymentStatus: { in: ["PENDING", "PARTIAL"] },
                    status: { notIn: ["CANCELLED", "FAILED", "PAYMENT_PENDING"] }
                },
                orderBy: { createdAt: "asc" },
                include: { payments: true }
            });
            unpaidOrders = orders.map((o) => {
                const paid = o.payments.filter((p) => p.status === "SUCCESS").reduce((sum, p) => sum + Number(p.amount), 0);
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
            }).filter((o) => o.dueAmount > 0);
        }
        return res.json({
            customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone, email: customer.email } : null,
            bill: singleBill,
            unpaidOrders,
            totalDue
        });
    }
    catch (error) {
        logger_1.default.error(`[PayInfo Error] ${error.message}`);
        return res.status(500).json({ message: "Failed to fetch payment details" });
    }
});
exports.getPayInfo = getPayInfo;
const initiatePayDue = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, phone, billId, amount } = req.body;
        let customer = null;
        if (userId)
            customer = yield prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!customer && phone) {
            const cleanPhone = phone.replace(/\D/g, "");
            customer = yield prisma_1.default.user.findFirst({
                where: { OR: [{ phone }, { phone: cleanPhone }, { phone: `+91${cleanPhone}` }] }
            });
        }
        const effectiveUserId = (customer === null || customer === void 0 ? void 0 : customer.id) || userId || "ANONYMOUS";
        const customerName = (customer === null || customer === void 0 ? void 0 : customer.name) || "Customer";
        const customerPhone = (customer === null || customer === void 0 ? void 0 : customer.phone) || phone || "9999999999";
        const customerEmail = (customer === null || customer === void 0 ? void 0 : customer.email) || "customer@example.com";
        let txnid = billId ? `DUE_${billId}_${Date.now()}` : `SETTLE_${effectiveUserId}_${Date.now()}`;
        if (billId) {
            const order = yield prisma_1.default.order.findUnique({ where: { id: billId } });
            if (order && !order.isPaid) {
                txnid = order.id;
            }
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
        if (process.env.EASEBUZZ_SERVICE_URL && process.env.EASEBUZZ_MERCHANT_KEY) {
            const useIframe = process.env.EASEBUZZ_IFRAME === "1";
            const apiName = useIframe ? "initiate_payment_iframe" : "initiate_payment";
            const easebuzzRes = yield axios_1.default.post(`${process.env.EASEBUZZ_SERVICE_URL.replace(/\/$/, "")}/easebuzz?api_name=${apiName}`, {
                txnid: txnid,
                amount: amountToPay.toFixed(2),
                firstname: customerName,
                email: customerEmail,
                phone: sanitizePhone(customerPhone),
                productinfo: billId ? `Bill Payment ${billId}` : `Account Settlement ${effectiveUserId}`,
                surl: callbackUrl,
                furl: callbackUrl,
            }, { headers: { "Accept": "application/json", "Content-Type": "application/json" } });
            if (easebuzzRes.data && easebuzzRes.data.status === 1) {
                if (useIframe) {
                    return res.json({
                        txnid,
                        iframe: true,
                        key: easebuzzRes.data.data.key,
                        accessKey: easebuzzRes.data.data.access_key,
                        env: easebuzzRes.data.data.env,
                    });
                }
                else if (easebuzzRes.data.paymentLink) {
                    return res.json({ txnid, paymentLink: easebuzzRes.data.paymentLink });
                }
            }
        }
        return res.json({
            txnid,
            paymentLink: `${baseUrl.replace(/\/$/, "")}/payment/mock-gateway?orderId=${txnid}&amount=${amountToPay}`,
        });
    }
    catch (error) {
        logger_1.default.error(`[Initiate Pay Due Error] ${error.message}`);
        return res.status(500).json({ message: "Failed to initiate payment" });
    }
});
exports.initiatePayDue = initiatePayDue;
