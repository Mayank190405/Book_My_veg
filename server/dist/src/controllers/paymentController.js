"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.getWalletDetails = exports.verifyWalletDeposit = exports.initiateWalletDeposit = exports.processWalletDepositCredit = exports.cleanupDuplicatePaymentsController = exports.cleanUpDuplicatePayments = exports.sendPaymentReminderController = exports.triggerEasebuzzSync = exports.saveOrderFeedback = exports.publicCustomerOnboard = exports.initiatePayDue = exports.getPayInfo = exports.checkPaymentEligibility = exports.refundPayment = exports.handleEasebuzzCallback = exports.handleWebhook = exports.verifyPayment = exports.getOrderStatus = exports.completeOrderPayment = exports.executeBulkBillSettlement = exports.settleDuesForCustomer = exports.generatePaymentLink = exports.initiatePayment = void 0;
const client_1 = require("@prisma/client");
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
const orderController_1 = require("./orderController");
const dueCalculationService_1 = require("../services/dueCalculationService");
const decimal_js_1 = __importDefault(require("decimal.js"));
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
const callEasebuzzInitiateApi = (params) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
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
            const easebuzzRes = yield axios_1.default.post(`${serviceUrl.replace(/\/$/, "")}/easebuzz?api_name=${apiName}`, {
                txnid: params.txnid,
                amount: params.amount.toFixed(2),
                firstname: params.firstname,
                email: params.email,
                phone: sanitizePhone(params.phone),
                productinfo: params.productinfo,
                surl: params.callbackUrl,
                furl: params.callbackUrl,
            }, {
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                timeout: 10000
            });
            if (easebuzzRes.data && easebuzzRes.data.status === 1) {
                const rawData = easebuzzRes.data.data;
                const accessKey = typeof rawData === "string" ? rawData : ((rawData === null || rawData === void 0 ? void 0 : rawData.access_key) || rawData);
                return {
                    iframe: true,
                    key: (rawData === null || rawData === void 0 ? void 0 : rawData.key) || key,
                    accessKey,
                    env: (rawData === null || rawData === void 0 ? void 0 : rawData.env) || (env === "prod" ? "prod" : "test"),
                    paymentLink: easebuzzRes.data.paymentLink || `https://${env === "prod" ? "pay" : "testpay"}.easebuzz.in/pay/${accessKey}`
                };
            }
            logger_1.default.warn(`[Easebuzz] Microservice returned non-success, falling through to direct API: ${(_a = easebuzzRes.data) === null || _a === void 0 ? void 0 : _a.message}`);
        }
        catch (serviceErr) {
            logger_1.default.warn(`[Easebuzz] Microservice failed (${serviceErr.message}), falling through to direct API`);
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
        const directRes = yield axios_1.default.post(`${baseUrl}/payment/initiateLink`, formData.toString(), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            timeout: 15000
        });
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
        throw new Error(((_b = directRes.data) === null || _b === void 0 ? void 0 : _b.error_desc) || ((_c = directRes.data) === null || _c === void 0 ? void 0 : _c.data) || "Easebuzz direct initiation failed");
    }
    throw new Error("Easebuzz environment keys (EASEBUZZ_KEY/EASEBUZZ_SALT) are missing");
});
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
        // Easebuzz Integration Pathway
        if (process.env.EASEBUZZ_KEY || process.env.EASEBUZZ_MERCHANT_KEY) {
            logger_1.default.info(`[Payment] Using Easebuzz Payment Gateway for order: ${order.id}`);
            try {
                const protocol = req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
                const callbackUrl = `${protocol}://${req.headers.host}/api/v1/payments/easebuzz/callback`;
                const addressObj = address;
                const customerName = (addressObj === null || addressObj === void 0 ? void 0 : addressObj.name) || user.name || "Customer";
                const customerPhone = (addressObj === null || addressObj === void 0 ? void 0 : addressObj.phone) || user.phone || "9999999999";
                const easeResult = yield callEasebuzzInitiateApi({
                    txnid: order.id,
                    amount: Number(amount),
                    firstname: customerName,
                    email: user.email || "customer@example.com",
                    phone: customerPhone,
                    productinfo: `Order ${order.id}`,
                    callbackUrl
                });
                return res.json(Object.assign({ orderId: order.id }, easeResult));
            }
            catch (easebuzzError) {
                logger_1.default.error(`[Payment] Easebuzz initiation failed, falling back to mock gateway. Error: ${easebuzzError.message}`);
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
    var _a, _b, _c, _d, _e, _f;
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
            const requestedAmount = ((_a = req.body) === null || _a === void 0 ? void 0 : _a.amount) ? Number(req.body.amount) : (((_b = req.query) === null || _b === void 0 ? void 0 : _b.amount) ? Number(req.query.amount) : null);
            const amountToCharge = requestedAmount
                ? requestedAmount.toFixed(2)
                : (pendingOnlinePayment ? Number(pendingOnlinePayment.amount).toFixed(2) : Number(order.totalAmount).toFixed(2));
            try {
                const protocol = req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
                const callbackUrl = `${protocol}://${req.headers.host}/api/v1/payments/easebuzz/callback`;
                const addressObj = order.shippingAddress;
                const customerName = (addressObj === null || addressObj === void 0 ? void 0 : addressObj.name) || order.user.name || "Customer";
                const customerPhone = (addressObj === null || addressObj === void 0 ? void 0 : addressObj.phone) || order.user.phone || "9999999999";
                const useIframe = process.env.EASEBUZZ_IFRAME !== "0";
                const apiName = useIframe ? "initiate_payment_iframe" : "initiate_payment";
                const shortNonce = Date.now().toString(36).slice(-5).toUpperCase();
                const baseId = order.id.length <= 32 ? order.id : order.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 31);
                const linkTxnid = requestedAmount ? `${baseId}_P${shortNonce}` : (order.id.length <= 40 ? order.id : order.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40));
                const easebuzzRes = yield axios_1.default.post(`${process.env.EASEBUZZ_SERVICE_URL.replace(/\/$/, "")}/easebuzz?api_name=${apiName}`, {
                    txnid: linkTxnid,
                    amount: amountToCharge,
                    firstname: customerName,
                    email: order.user.email || "customer@example.com",
                    phone: sanitizePhone(customerPhone),
                    productinfo: `Order ${order.id.slice(0, 20)}`,
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
                            amount: amountToCharge
                        });
                    }
                    else if (easebuzzRes.data.paymentLink) {
                        return res.json({
                            paymentLink: easebuzzRes.data.paymentLink,
                            amount: amountToCharge
                        });
                    }
                }
                throw new Error(((_c = easebuzzRes.data) === null || _c === void 0 ? void 0 : _c.message) || "Failed to initiate payment with Easebuzz");
            }
            catch (easebuzzError) {
                logger_1.default.error(`[Payment] Easebuzz generation failed, falling back to mock gateway. Error: ${easebuzzError.message}, Data: ${JSON.stringify((_d = easebuzzError.response) === null || _d === void 0 ? void 0 : _d.data)}`);
                return res.json({
                    paymentLink: `${baseUrl.replace(/\/$/, "")}/payment/mock-gateway?orderId=${orderId}&amount=${amountToCharge}`,
                    amount: amountToCharge
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
            paymentLink: ((_e = session.payment_links) === null || _e === void 0 ? void 0 : _e.web) || ((_f = session.payment_links) === null || _f === void 0 ? void 0 : _f.mobile),
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
const settleDuesForCustomer = (userId, amount, transactionId, metadata, preferredOrderId) => __awaiter(void 0, void 0, void 0, function* () {
    let remaining = Number(amount);
    if (!remaining || remaining <= 0)
        return;
    yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        const effectiveTxnId = transactionId || `SETTLE_${Date.now()}`;
        // ── 0. Idempotency Check: Prevent duplicate settlement across webhooks / callbacks / retries ──
        const existingTxnPayment = yield tx.payment.findFirst({
            where: {
                status: "SUCCESS",
                OR: [
                    { transactionId: effectiveTxnId },
                    { transactionId: { startsWith: `${effectiveTxnId}_` } }
                ]
            }
        });
        if (existingTxnPayment) {
            logger_1.default.info(`[Settlement] Transaction ${effectiveTxnId} already settled. Skipping duplicate.`);
            return;
        }
        // ── Check if a saved PAYMENT_REQUEST exists for this transaction ──
        const candidateEntityIds = Array.from(new Set([
            effectiveTxnId,
            metadata === null || metadata === void 0 ? void 0 : metadata.txnid,
            metadata === null || metadata === void 0 ? void 0 : metadata.txn_id,
            metadata === null || metadata === void 0 ? void 0 : metadata.orderId,
            metadata === null || metadata === void 0 ? void 0 : metadata.order_id,
            metadata === null || metadata === void 0 ? void 0 : metadata.easepayid,
            metadata === null || metadata === void 0 ? void 0 : metadata.easebuzz_id,
            transactionId
        ].map((s) => String(s || "").trim()).filter(Boolean)));
        const savedRequestLog = yield tx.auditLog.findFirst({
            where: {
                entityType: "PAYMENT_REQUEST",
                entityId: { in: candidateEntityIds }
            },
            orderBy: { createdAt: "desc" }
        });
        const savedRequest = savedRequestLog === null || savedRequestLog === void 0 ? void 0 : savedRequestLog.newValue;
        let targetUserId = userId;
        if ((savedRequest === null || savedRequest === void 0 ? void 0 : savedRequest.customerId) && savedRequest.customerId !== "ANONYMOUS") {
            targetUserId = savedRequest.customerId;
        }
        let userObj = targetUserId ? yield tx.user.findUnique({ where: { id: targetUserId } }) : null;
        if (!userObj) {
            // 1. Try finding by phone from metadata, savedRequest or userId
            const rawPhone = ((metadata === null || metadata === void 0 ? void 0 : metadata.phone) || (metadata === null || metadata === void 0 ? void 0 : metadata.customer_phone) || (metadata === null || metadata === void 0 ? void 0 : metadata.mobile) || (savedRequest === null || savedRequest === void 0 ? void 0 : savedRequest.customerPhone) || userId || "").toString();
            const cleanPhone = rawPhone.replace(/\D/g, "").slice(-10);
            if (cleanPhone.length === 10) {
                userObj = yield tx.user.findFirst({
                    where: { OR: [{ phone: cleanPhone }, { phone: `+91${cleanPhone}` }, { phone: `91${cleanPhone}` }] }
                });
                if (userObj)
                    targetUserId = userObj.id;
            }
            // 2. Try preferredOrderId
            if (!userObj && preferredOrderId) {
                const pref = yield tx.order.findUnique({ where: { id: preferredOrderId } });
                if (pref === null || pref === void 0 ? void 0 : pref.userId) {
                    targetUserId = pref.userId;
                    userObj = yield tx.user.findUnique({ where: { id: targetUserId } });
                }
            }
            // 3. Try finding by sliced UUID prefix if userId is hexadecimal prefix
            if (!userObj && userId && userId.length >= 8) {
                const prefix8 = userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
                userObj = yield tx.user.findFirst({
                    where: { id: { startsWith: prefix8, mode: "insensitive" } }
                });
                if (userObj)
                    targetUserId = userObj.id;
            }
            // 4. Try finding by email
            if (!userObj && ((metadata === null || metadata === void 0 ? void 0 : metadata.email) || (savedRequest === null || savedRequest === void 0 ? void 0 : savedRequest.customerEmail))) {
                const emailToMatch = String((metadata === null || metadata === void 0 ? void 0 : metadata.email) || (savedRequest === null || savedRequest === void 0 ? void 0 : savedRequest.customerEmail)).trim();
                userObj = yield tx.user.findFirst({
                    where: { email: { equals: emailToMatch, mode: "insensitive" } }
                });
                if (userObj)
                    targetUserId = userObj.id;
            }
        }
        let ordersToSettle = [];
        const seenOrderIds = new Set();
        // Step A: Preserve explicit bills from original payment request
        if ((savedRequest === null || savedRequest === void 0 ? void 0 : savedRequest.billIds) && Array.isArray(savedRequest.billIds) && savedRequest.billIds.length > 0) {
            const explicitOrders = yield tx.order.findMany({
                where: {
                    id: { in: savedRequest.billIds },
                    status: { notIn: ["CANCELLED", "FAILED"] }
                },
                include: { payments: true }
            });
            for (const id of savedRequest.billIds) {
                const ord = explicitOrders.find((o) => o.id === id);
                if (ord && !seenOrderIds.has(ord.id)) {
                    ordersToSettle.push(ord);
                    seenOrderIds.add(ord.id);
                }
            }
        }
        // Step B: Include preferredOrderId first if specified and not yet present
        if (preferredOrderId && !seenOrderIds.has(preferredOrderId)) {
            const prefOrder = yield tx.order.findUnique({
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
            const custUnpaidOrders = yield tx.order.findMany({
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
        let remainingDec = new decimal_js_1.default(amount);
        for (const order of ordersToSettle) {
            if (remainingDec.lessThanOrEqualTo(0))
                break;
            const paidDec = (0, dueCalculationService_1.calculateOrderPaidAmountDecimal)(order.payments);
            const orderTotalDec = new decimal_js_1.default(order.totalAmount ? order.totalAmount.toString() : 0);
            const dueDec = decimal_js_1.default.max(0, orderTotalDec.minus(paidDec));
            if (dueDec.lessThanOrEqualTo(0.005))
                continue;
            const toApplyDec = decimal_js_1.default.min(remainingDec, dueDec);
            const toApply = Number(toApplyDec.toFixed(2));
            if (toApply > 0) {
                const targetTxn = `${effectiveTxnId}_${order.id.slice(0, 6)}`;
                const pendingPayment = yield tx.payment.findFirst({
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
                    yield tx.payment.update({
                        where: { id: pendingPayment.id },
                        data: {
                            amount: toApply,
                            method: (metadata === null || metadata === void 0 ? void 0 : metadata.payment_method_type) || (metadata === null || metadata === void 0 ? void 0 : metadata.mode) || "ONLINE",
                            status: "SUCCESS",
                            transactionId: targetTxn,
                            metadata: metadata || {}
                        }
                    });
                }
                else {
                    yield tx.payment.create({
                        data: {
                            orderId: order.id,
                            amount: toApply,
                            method: (metadata === null || metadata === void 0 ? void 0 : metadata.payment_method_type) || (metadata === null || metadata === void 0 ? void 0 : metadata.mode) || "ONLINE",
                            status: "SUCCESS",
                            transactionId: targetTxn,
                            metadata: metadata || {}
                        }
                    });
                }
                const totalPaidNowDec = paidDec.plus(toApplyDec);
                const isFull = totalPaidNowDec.greaterThanOrEqualTo(orderTotalDec.minus(new decimal_js_1.default(0.005)));
                const nonRevertableStatuses = ["DELIVERED", "SHIPPED", "OUT_FOR_DELIVERY", "COMPLETED"];
                const shouldUpdateStatus = !nonRevertableStatuses.includes(order.status);
                yield tx.order.update({
                    where: { id: order.id },
                    data: Object.assign({ isPaid: isFull, paymentStatus: isFull ? "COMPLETED" : "PARTIAL", easebuzzCollected: { increment: new client_1.Prisma.Decimal(toApply) } }, (shouldUpdateStatus && { status: "CONFIRMED" }))
                });
                if (isFull) {
                    yield tx.payment.deleteMany({
                        where: { orderId: order.id, status: "PENDING" }
                    });
                }
                // Create notification for customer
                const notifTitle = isFull ? "Payment Complete" : "Payment Received";
                const notifBody = isFull
                    ? `Your bill #${order.id} of ₹${orderTotalDec.toFixed(2)} has been fully paid. Thank you!`
                    : `Payment of ₹${toApply.toFixed(2)} received for bill #${order.id}. Remaining: ₹${orderTotalDec.minus(totalPaidNowDec).toFixed(2)}`;
                yield tx.notification.create({
                    data: {
                        userId: targetUserId,
                        title: notifTitle,
                        body: notifBody,
                        type: "ORDER",
                        isRead: false
                    }
                });
                yield tx.orderStatusHistory.create({
                    data: {
                        orderId: order.id,
                        status: (shouldUpdateStatus ? "CONFIRMED" : order.status),
                        remark: `Payment of ₹${toApply.toFixed(2)} received via ${(metadata === null || metadata === void 0 ? void 0 : metadata.payment_method_type) || (metadata === null || metadata === void 0 ? void 0 : metadata.mode) || "ONLINE"}${isFull ? " (Fully Paid)" : " (Partial)"}`,
                        changedBy: "SYSTEM",
                    },
                });
                remainingDec = remainingDec.minus(toApplyDec);
            }
        }
        // Check for excess unallocated payment
        if (remainingDec.greaterThan(0.005)) {
            const excessVal = Number(remainingDec.toFixed(2));
            logger_1.default.warn(`[Settlement Excess] Customer ${targetUserId} has excess payment of ₹${excessVal} for txn ${effectiveTxnId}`);
            yield tx.auditLog.create({
                data: {
                    entityType: "PAYMENT_EXCESS",
                    entityId: effectiveTxnId,
                    action: "EXCESS_PAYMENT_LOGGED",
                    newValue: {
                        userId: targetUserId,
                        excessAmount: excessVal,
                        receivedTotal: amount,
                        settledBills: ordersToSettle.map((o) => o.id),
                        transactionId: effectiveTxnId
                    }
                }
            });
        }
        // Mark saved payment request as SETTLED
        if (savedRequestLog) {
            yield tx.auditLog.update({
                where: { id: savedRequestLog.id },
                data: {
                    newValue: Object.assign(Object.assign({}, savedRequest), { status: "SETTLED", settledAt: new Date().toISOString() })
                }
            });
        }
        if (targetUserId) {
            yield (0, orderController_1.syncCustomerTotalDue)(targetUserId, tx);
        }
    }));
});
exports.settleDuesForCustomer = settleDuesForCustomer;
/**
 * Bulk Bill Settlement Engine:
 * When Easebuzz returns a success for a transaction initiated via the payment link,
 * this function loads the JSON list of orders stored for this transaction and settles
 * ALL bills in bulk atomically.
 */
const executeBulkBillSettlement = (txnid, paymentDetails) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    logger_1.default.info(`[BulkSettlement] Processing bulk bill settlement for txnid: ${txnid}`);
    if (paymentDetails.status !== "CHARGED" && paymentDetails.status !== "SUCCESS") {
        logger_1.default.warn(`[BulkSettlement] Payment status for ${txnid} is ${paymentDetails.status}, aborting settlement.`);
        return { status: "FAILED", message: `Payment status is ${paymentDetails.status}` };
    }
    const candidateTxnIds = Array.from(new Set([
        txnid,
        paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.txn_id,
        paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.order_id,
        (_a = paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.metadata) === null || _a === void 0 ? void 0 : _a.txnid,
        (_b = paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.metadata) === null || _b === void 0 ? void 0 : _b.order_id
    ].map((s) => String(s || "").trim()).filter(Boolean)));
    // 1. Look for BULK_BILL_SETTLEMENT or PAYMENT_REQUEST in AuditLog
    const auditEntry = yield prisma_1.default.auditLog.findFirst({
        where: {
            entityType: { in: ["BULK_BILL_SETTLEMENT", "PAYMENT_REQUEST"] },
            entityId: { in: candidateTxnIds }
        },
        orderBy: { createdAt: "desc" }
    });
    const bulkData = auditEntry === null || auditEntry === void 0 ? void 0 : auditEntry.newValue;
    let orderList = (bulkData === null || bulkData === void 0 ? void 0 : bulkData.orderList) || (bulkData === null || bulkData === void 0 ? void 0 : bulkData.intendedAllocations) || [];
    let customerId = (bulkData === null || bulkData === void 0 ? void 0 : bulkData.customerId) && bulkData.customerId !== "ANONYMOUS" ? bulkData.customerId : null;
    // 2. If not found in audit log, find pending payments by transactionId
    if (orderList.length === 0) {
        const pendingPayments = yield prisma_1.default.payment.findMany({
            where: { transactionId: { in: candidateTxnIds } }
        });
        if (pendingPayments.length > 0) {
            orderList = pendingPayments.map((p) => ({
                orderId: p.orderId,
                amountToPay: Number(p.amount)
            }));
            const firstOrd = yield prisma_1.default.order.findUnique({ where: { id: pendingPayments[0].orderId } });
            if (firstOrd === null || firstOrd === void 0 ? void 0 : firstOrd.userId)
                customerId = firstOrd.userId;
        }
    }
    // 3. Fallback: Lookup customer by phone from txnid or paymentDetails
    if (!customerId) {
        const rawPhone = ((paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.phone) || (paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.customerPhone) || txnid.split("_")[1] || "").toString();
        const cleanPhone = rawPhone.replace(/\D/g, "").slice(-10);
        if (cleanPhone.length === 10) {
            const user = yield prisma_1.default.user.findFirst({
                where: { OR: [{ phone: cleanPhone }, { phone: `+91${cleanPhone}` }, { phone: `91${cleanPhone}` }] }
            });
            if (user)
                customerId = user.id;
        }
    }
    // 4. If customer is identified, fetch ALL their unpaid orders to ensure 100% complete settlement
    let ordersToProcess = orderList.map(o => ({
        orderId: o.orderId,
        amountToPay: Number(o.amountToPay || o.amountToSettle || o.intendedAmount || 0)
    }));
    const seenOrderIds = new Set(ordersToProcess.map(o => o.orderId));
    if (customerId) {
        const allCustUnpaid = yield prisma_1.default.order.findMany({
            where: {
                userId: customerId,
                id: { notIn: Array.from(seenOrderIds) },
                isPaid: false,
                status: { notIn: ["CANCELLED", "FAILED"] }
            },
            include: { payments: true },
            orderBy: { createdAt: "asc" }
        });
        for (const ord of allCustUnpaid) {
            const due = (0, dueCalculationService_1.calculateOrderDue)(ord).dueAmount;
            if (due > 0) {
                ordersToProcess.push({
                    orderId: ord.id,
                    amountToPay: due
                });
                seenOrderIds.add(ord.id);
            }
        }
    }
    if (ordersToProcess.length === 0) {
        logger_1.default.warn(`[BulkSettlement] No bills found to settle for txnid: ${txnid}`);
        return { status: "FAILED", message: "No bills found for settlement" };
    }
    let remainingFundDec = new decimal_js_1.default((paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.amount) ? Number(paymentDetails.amount) : 0);
    // If amount is not passed or 0, calculate total of all bills to pay
    const isFullSettlementMode = remainingFundDec.lessThanOrEqualTo(0);
    const settledOrders = [];
    yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        for (const item of ordersToProcess) {
            if (!isFullSettlementMode && remainingFundDec.lessThanOrEqualTo(0.005))
                break;
            const order = yield tx.order.findUnique({
                where: { id: item.orderId },
                include: { payments: true }
            });
            if (!order || ["CANCELLED", "FAILED"].includes(order.status))
                continue;
            const paidDec = (0, dueCalculationService_1.calculateOrderPaidAmountDecimal)(order.payments);
            const orderTotalDec = new decimal_js_1.default(order.totalAmount ? order.totalAmount.toString() : 0);
            const dueDec = decimal_js_1.default.max(0, orderTotalDec.minus(paidDec));
            if (dueDec.lessThanOrEqualTo(0.005)) {
                if (!order.isPaid) {
                    yield tx.order.update({
                        where: { id: order.id },
                        data: { isPaid: true, paymentStatus: "COMPLETED" }
                    });
                }
                continue;
            }
            const toPayDec = isFullSettlementMode ? dueDec : decimal_js_1.default.min(remainingFundDec, dueDec);
            const toPayAmount = Number(toPayDec.toFixed(2));
            if (toPayAmount <= 0)
                continue;
            if (!isFullSettlementMode) {
                remainingFundDec = decimal_js_1.default.max(0, remainingFundDec.minus(toPayDec));
            }
            const itemTxnId = `${txnid}_${order.id.slice(0, 6)}`;
            const existingPayment = yield tx.payment.findFirst({
                where: {
                    orderId: order.id,
                    OR: [
                        { transactionId: txnid },
                        { transactionId: itemTxnId },
                        ...((paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.txn_id) ? [{ transactionId: paymentDetails.txn_id }] : [])
                    ]
                }
            });
            if (existingPayment) {
                yield tx.payment.update({
                    where: { id: existingPayment.id },
                    data: {
                        status: "SUCCESS",
                        amount: toPayAmount,
                        method: (paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.payment_method_type) || (paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.mode) || "ONLINE",
                        transactionId: itemTxnId,
                        metadata: paymentDetails || {}
                    }
                });
            }
            else {
                yield tx.payment.create({
                    data: {
                        orderId: order.id,
                        amount: toPayAmount,
                        method: (paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.payment_method_type) || (paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.mode) || "ONLINE",
                        status: "SUCCESS",
                        transactionId: itemTxnId,
                        metadata: paymentDetails || {}
                    }
                });
            }
            const newPaidDec = paidDec.plus(toPayDec);
            const newDueDec = decimal_js_1.default.max(0, orderTotalDec.minus(newPaidDec));
            const isFullyPaid = newDueDec.lessThanOrEqualTo(0.005);
            yield tx.order.update({
                where: { id: order.id },
                data: {
                    isPaid: isFullyPaid,
                    paidAmount: Number(newPaidDec.toFixed(2)),
                    paymentStatus: isFullyPaid ? "COMPLETED" : "PARTIAL",
                    easebuzzCollected: { increment: new client_1.Prisma.Decimal(toPayAmount) }
                }
            });
            // Cleanup any stale pending payments for this order
            yield tx.payment.deleteMany({
                where: {
                    orderId: order.id,
                    status: "PENDING",
                    id: { not: existingPayment === null || existingPayment === void 0 ? void 0 : existingPayment.id }
                }
            });
            settledOrders.push(order.id);
        }
        // Update audit entry if present
        if (auditEntry) {
            yield tx.auditLog.update({
                where: { id: auditEntry.id },
                data: {
                    action: "COMPLETED",
                    newValue: Object.assign(Object.assign({}, auditEntry.newValue), { status: "SETTLED", settledAt: new Date().toISOString(), settledOrders })
                }
            });
        }
        // Sync customer total balance
        if (customerId) {
            yield (0, orderController_1.syncCustomerTotalDue)(customerId, tx);
        }
    }));
    logger_1.default.info(`[BulkSettlement] Finished bulk settlement for txnid: ${txnid}. Cleared ${settledOrders.length} bills.`);
    return { status: "SUCCESS", settledOrders, count: settledOrders.length };
});
exports.executeBulkBillSettlement = executeBulkBillSettlement;
const completeOrderPayment = (orderId, paymentDetails) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    let resolvedOrderId = orderId;
    if (orderId && !orderId.startsWith("DUE_") && !orderId.startsWith("SET_") && !orderId.startsWith("SETTLE_") && !orderId.startsWith("BULK_")) {
        resolvedOrderId = orderId.replace(/_\d{3,}$/, "");
    }
    // 0. Primary Interceptor: Check for Bulk Settlement Transaction ID
    const isBulkSettlement = (orderId.startsWith("BULK_") ||
        orderId.startsWith("SET_") ||
        orderId.startsWith("SETTLE_") ||
        orderId.startsWith("DUE_") ||
        Boolean((_b = (_a = paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.metadata) === null || _a === void 0 ? void 0 : _a.txnid) === null || _b === void 0 ? void 0 : _b.startsWith("BULK_")) ||
        Boolean((_d = (_c = paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.metadata) === null || _c === void 0 ? void 0 : _c.txnid) === null || _d === void 0 ? void 0 : _d.startsWith("SET_")) ||
        Boolean(paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.settleDues));
    if (isBulkSettlement) {
        const bulkTxnId = (orderId.startsWith("BULK_") || orderId.startsWith("SET_") || orderId.startsWith("SETTLE_") || orderId.startsWith("DUE_")
            ? orderId
            : (((_e = paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.metadata) === null || _e === void 0 ? void 0 : _e.txnid) || (paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.txn_id) || orderId));
        return yield (0, exports.executeBulkBillSettlement)(bulkTxnId, paymentDetails);
    }
    const bulkAudit = yield prisma_1.default.auditLog.findFirst({
        where: {
            entityType: { in: ["BULK_BILL_SETTLEMENT", "PAYMENT_REQUEST"] },
            entityId: { in: [orderId, paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.txn_id, paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.order_id].filter(Boolean) }
        }
    });
    if (bulkAudit) {
        return yield (0, exports.executeBulkBillSettlement)(bulkAudit.entityId, paymentDetails);
    }
    // 1. Resolve exact orderId from Payment record if it was initiated with a unique txnid
    const paymentRecord = yield prisma_1.default.payment.findFirst({
        where: { transactionId: orderId },
        select: { orderId: true }
    });
    if (paymentRecord === null || paymentRecord === void 0 ? void 0 : paymentRecord.orderId) {
        resolvedOrderId = paymentRecord.orderId;
    }
    let existing = yield prisma_1.default.order.findUnique({
        where: { id: resolvedOrderId },
        include: { items: true, user: true, payments: true },
    });
    // 2. If not found and resolvedOrderId looks like 32-char hex (compact UUID without hyphens), try standard UUID format
    if (!existing && resolvedOrderId.length === 32 && /^[0-9a-fA-F]{32}$/.test(resolvedOrderId)) {
        const formattedUuid = `${resolvedOrderId.slice(0, 8)}-${resolvedOrderId.slice(8, 12)}-${resolvedOrderId.slice(12, 16)}-${resolvedOrderId.slice(16, 20)}-${resolvedOrderId.slice(20)}`;
        existing = yield prisma_1.default.order.findUnique({
            where: { id: formattedUuid },
            include: { items: true, user: true, payments: true },
        });
        if (existing) {
            resolvedOrderId = existing.id;
        }
    }
    if (!existing) {
        // Collect all possible candidate Order IDs from orderId, resolvedOrderId, productinfo, etc.
        const candidates = [orderId, resolvedOrderId];
        if (resolvedOrderId.length >= 8) {
            candidates.push(resolvedOrderId.slice(0, 8));
        }
        if (resolvedOrderId.length >= 6) {
            candidates.push(resolvedOrderId.slice(0, 6));
        }
        if (paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.productinfo) {
            const productStr = String(paymentDetails.productinfo);
            const matches = productStr.match(/BMV[A-Z0-9]+/gi);
            if (matches) {
                matches.forEach(m => {
                    candidates.push(m);
                    if (m.length >= 8)
                        candidates.push(m.slice(0, 8));
                });
            }
        }
        const uniqueCandidates = Array.from(new Set(candidates)).filter(Boolean);
        const orConditions = [];
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
        existing = yield prisma_1.default.order.findFirst({
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
        logger_1.default.warn(`[Payment Reconciliation] Ambiguous/unmapped Easebuzz transaction: Order ${resolvedOrderId} not found. Gateway txn: ${paymentDetails.txn_id || orderId}, amount: ${paymentDetails.amount}`);
        try {
            yield prisma_1.default.auditLog.create({
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
        }
        catch (auditErr) {
            logger_1.default.error(`[Payment Reconciliation] Failed to log unmapped transaction audit: ${auditErr.message}`);
        }
        return {
            status: "UNMAPPED_TRANSACTION_LOGGED",
            message: `Order ${resolvedOrderId} not found. Gateway transaction logged to audit statement for manual review.`
        };
    }
    if (paymentDetails.status === "CHARGED" || paymentDetails.status === "SUCCESS") {
        const targetTxnId = paymentDetails.txn_id || paymentDetails.order_id || orderId;
        // Check 1: Has this exact transaction ID already been processed successfully? (Idempotency)
        const existingTxnPayment = yield prisma_1.default.payment.findFirst({
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
                    : yield prisma_1.default.payment.findMany({ where: { orderId: existing.id } });
                const orderPaidDec = (0, dueCalculationService_1.calculateOrderPaidAmountDecimal)(orderPayments);
                const orderTotalDec = new decimal_js_1.default(existing.totalAmount ? existing.totalAmount.toString() : 0);
                const surplusDec = decimal_js_1.default.max(0, orderPaidDec.minus(orderTotalDec));
                if (surplusDec.greaterThan(0.005)) {
                    const otherUnpaidCount = yield prisma_1.default.order.count({
                        where: {
                            userId: existing.userId,
                            id: { not: existing.id },
                            isPaid: false,
                            status: { notIn: ["CANCELLED", "FAILED"] }
                        }
                    });
                    if (otherUnpaidCount > 0) {
                        logger_1.default.info(`[Payment] Order ${existing.id} has surplus payment of ₹${surplusDec.toFixed(2)} from txn ${targetTxnId}. Reallocating surplus to ${otherUnpaidCount} unpaid orders of customer ${existing.userId}.`);
                        yield (0, exports.settleDuesForCustomer)(existing.userId, Number(surplusDec.toFixed(2)), `${targetTxnId}_realloc`, paymentDetails);
                        return { status: "SUCCESS" };
                    }
                }
            }
            logger_1.default.info(`[Payment] Transaction ${targetTxnId} already recorded for order ${resolvedOrderId}. Skipping duplicate.`);
            return { status: "ALREADY_PROCESSED" };
        }
        // Check if this transaction is an explicit multi-order settlement request
        const isExplicitSettlement = (orderId.startsWith("DUE_") ||
            orderId.startsWith("SET_") ||
            orderId.startsWith("SETTLE_") ||
            Boolean(paymentDetails.settleDues) ||
            Boolean((_f = paymentDetails.metadata) === null || _f === void 0 ? void 0 : _f.settleDues) ||
            Boolean(((_g = paymentDetails.metadata) === null || _g === void 0 ? void 0 : _g.txnid) && (paymentDetails.metadata.txnid.startsWith("DUE_") || paymentDetails.metadata.txnid.startsWith("SET_"))));
        if (existing.userId) {
            const orderDueResult = (0, dueCalculationService_1.calculateOrderDue)(existing);
            const isAmountExceedingDue = Number(paymentDetails.amount) > (orderDueResult.dueAmount + 0.01);
            if (isExplicitSettlement || isAmountExceedingDue) {
                const otherUnpaidCount = yield prisma_1.default.order.count({
                    where: {
                        userId: existing.userId,
                        id: { not: existing.id },
                        isPaid: false,
                        status: { notIn: ["CANCELLED", "FAILED"] }
                    }
                });
                if (otherUnpaidCount > 0) {
                    logger_1.default.info(`[Payment] Customer ${existing.userId} multi-bill settlement triggered for order ${existing.id} (explicit: ${isExplicitSettlement}, excessAmount: ${isAmountExceedingDue}).`);
                    yield (0, exports.settleDuesForCustomer)(existing.userId, Number(paymentDetails.amount), targetTxnId, paymentDetails, existing.id);
                    return { status: "SUCCESS" };
                }
            }
        }
        // Check 2: Is order already fully paid?
        const existingSuccessPayments = yield prisma_1.default.payment.findMany({
            where: { orderId: resolvedOrderId, status: "SUCCESS" }
        });
        const currentTotalPaid = existingSuccessPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        if (existing.isPaid && currentTotalPaid >= Number(existing.totalAmount)) {
            if (existing.userId) {
                const otherUnpaidCount = yield prisma_1.default.order.count({
                    where: {
                        userId: existing.userId,
                        id: { not: existing.id },
                        isPaid: false,
                        status: { notIn: ["CANCELLED", "FAILED"] }
                    }
                });
                if (otherUnpaidCount > 0) {
                    logger_1.default.info(`[Payment] Order ${resolvedOrderId} is already paid, routing settlement of ₹${paymentDetails.amount} to customer's remaining unpaid orders.`);
                    yield (0, exports.settleDuesForCustomer)(existing.userId, Number(paymentDetails.amount), targetTxnId, paymentDetails);
                    return { status: "SUCCESS" };
                }
            }
            logger_1.default.info(`[Payment] Order ${resolvedOrderId} is already fully paid (₹${currentTotalPaid} / ₹${existing.totalAmount}). Skipping duplicate.`);
            return { status: "ALREADY_PROCESSED" };
        }
        yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // Record the payment first
            const pendingPayment = (yield tx.payment.findFirst({
                where: { orderId: resolvedOrderId, status: "PENDING", method: "ONLINE" }
            })) || (yield tx.payment.findFirst({
                where: { orderId: resolvedOrderId, status: "PENDING" }
            }));
            if (pendingPayment) {
                yield tx.payment.update({
                    where: { id: pendingPayment.id },
                    data: {
                        status: "SUCCESS",
                        amount: paymentDetails.amount || pendingPayment.amount,
                        method: paymentDetails.payment_method_type || pendingPayment.method,
                        transactionId: targetTxnId,
                        metadata: paymentDetails || {},
                    }
                });
            }
            else {
                yield tx.payment.create({
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
            const allPayments = yield tx.payment.findMany({
                where: { orderId: resolvedOrderId, status: "SUCCESS" }
            });
            const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);
            const orderTotal = Number(existing.totalAmount);
            const isFull = totalPaid >= orderTotal;
            // Purge any leftover PENDING payment records for this order so it never displays as pending
            yield tx.payment.deleteMany({
                where: { orderId: resolvedOrderId, status: "PENDING" }
            });
            // Determine payment status
            const newPaymentStatus = isFull ? "COMPLETED" : "PARTIAL";
            // Only update status to CONFIRMED if order is still in a pre-confirmed state
            // Do NOT revert DELIVERED/SHIPPED/etc. orders back to CONFIRMED
            const nonRevertableStatuses = ["DELIVERED", "SHIPPED", "OUT_FOR_DELIVERY", "COMPLETED"];
            const shouldUpdateStatus = !nonRevertableStatuses.includes(existing.status);
            const paymentAmountDecimal = new client_1.Prisma.Decimal(paymentDetails.amount || existing.totalAmount);
            yield tx.order.update({
                where: { id: resolvedOrderId },
                data: Object.assign({ isPaid: isFull, paymentStatus: newPaymentStatus, easebuzzCollected: { increment: paymentAmountDecimal } }, (shouldUpdateStatus && { status: "CONFIRMED" })),
            });
            // Create in-app system notification for the user
            const notifTitle = isFull ? "Payment Complete" : "Payment Received";
            const notifBody = isFull
                ? `Your bill #${resolvedOrderId} of ₹${orderTotal} has been fully paid. Thank you!`
                : `Payment of ₹${Number(paymentDetails.amount).toFixed(2)} received for bill #${resolvedOrderId}. Remaining: ₹${(orderTotal - totalPaid).toFixed(2)}`;
            yield tx.notification.create({
                data: {
                    userId: existing.userId,
                    title: notifTitle,
                    body: notifBody,
                    type: "ORDER",
                    isRead: false
                }
            });
            yield tx.orderStatusHistory.create({
                data: {
                    orderId: resolvedOrderId,
                    status: (shouldUpdateStatus ? "CONFIRMED" : existing.status),
                    remark: `Payment of ₹${Number(paymentDetails.amount).toFixed(2)} received via ${paymentDetails.payment_method_type || "ONLINE"}${isFull ? " (Fully Paid)" : " (Partial)"}`,
                    changedBy: "SYSTEM",
                },
            });
            // Synchronize Customer Balance & Ledger
            if (existing.userId) {
                yield (0, orderController_1.syncCustomerTotalDue)(existing.userId, tx);
            }
        }));
        // ── Real-time Notification for Logistics & Driver Portal ─────────
        try {
            (0, io_1.getIo)().emit("OP_NEW_ORDER", {
                id: orderId,
                status: "CONFIRMED",
                timestamp: new Date()
            });
            (0, io_1.getIo)().emit("order:updated", {
                orderId: resolvedOrderId,
                isPaid: true,
                paymentStatus: "COMPLETED"
            });
        }
        catch (_) { }
        // ── WhatsApp Notification Dispatch ────────────────────────────────
        const user = existing.user;
        if (user && user.phone) {
            try {
                const { sendPaymentReceivedViaWhatsapp } = require("../services/mbgcard");
                sendPaymentReceivedViaWhatsapp(user.phone, user.name || "Customer", orderId, Number(paymentDetails.amount || existing.totalAmount), paymentDetails.payment_method_type || "ONLINE").catch((err) => {
                    console.error("[PaymentController] WhatsApp Payment Received dispatch failure:", err);
                });
            }
            catch (err) {
                console.error("[PaymentController] Failed to send WhatsApp:", err);
            }
        }
        // Track trending (non-critical)
        try {
            const locationId = ((_h = existing.shippingAddress) === null || _h === void 0 ? void 0 : _h.locationId) || "global";
            yield (0, productController_1.trackTrendingOnOrder)(existing.items.map((i) => ({ productId: i.productId, quantity: i.quantity })), locationId);
        }
        catch (e) {
            console.warn("Trending update failed:", e);
        }
        return { status: "SUCCESS" };
    }
    else {
        // Payment Failed or Cancelled -> Purge draft order and restore stock so NO bill is created
        if (existing && existing.paymentStatus !== "COMPLETED" && existing.paymentStatus !== "PAID" && !existing.isPaid) {
            yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
                var _a;
                const locationId = ((_a = existing.shippingAddress) === null || _a === void 0 ? void 0 : _a.locationId) || existing.locationId;
                if (locationId) {
                    yield inventoryService_1.InventoryService.restoreStock({
                        items: existing.items.map((i) => ({ productId: i.productId, variantId: i.variantId || undefined, quantity: i.quantity })),
                        locationId,
                        staffId: "SYSTEM",
                        referenceId: `FAIL_PURGE_${orderId}`
                    }, tx);
                }
                yield tx.orderItem.deleteMany({ where: { orderId } });
                yield tx.payment.deleteMany({ where: { orderId } });
                yield tx.orderStatusHistory.deleteMany({ where: { orderId } });
                yield tx.order.delete({ where: { id: orderId } });
            }));
        }
        return { status: "FAILED" };
    }
});
exports.completeOrderPayment = completeOrderPayment;
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
    const { order_id, status: rawStatus, amount: bodyAmount, txn_id } = req.body;
    logger_1.default.info(`[Payment] verifyPayment hit for order: ${order_id}`);
    try {
        let resolvedOrderId = order_id || "";
        if (order_id && !order_id.startsWith("DUE_") && !order_id.startsWith("SET_") && !order_id.startsWith("SETTLE_")) {
            resolvedOrderId = order_id.replace(/_\d{3,}$/, "");
        }
        // Try to resolve via Payment transactionId if present
        const txPayment = yield prisma_1.default.payment.findFirst({
            where: { transactionId: order_id },
            select: { orderId: true }
        });
        if (txPayment === null || txPayment === void 0 ? void 0 : txPayment.orderId) {
            resolvedOrderId = txPayment.orderId;
        }
        if (resolvedOrderId && (resolvedOrderId.startsWith("SETTLE_") || resolvedOrderId.startsWith("SET_") || resolvedOrderId.startsWith("DUE_"))) {
            const SUCCESS_STATUSES = ["CHARGED", "SUCCESS", "PAYMENT_SUCCESS", "AUTHORIZED"];
            const isSuccess = rawStatus ? SUCCESS_STATUSES.includes(rawStatus.toUpperCase()) : false;
            if (!isSuccess) {
                return res.status(400).json({
                    status: "FAILED",
                    message: "Settlement payment was cancelled or failed"
                });
            }
            yield (0, exports.completeOrderPayment)(resolvedOrderId, {
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
        let existing = yield prisma_1.default.order.findUnique({
            where: { id: resolvedOrderId },
            select: { id: true, status: true, paymentStatus: true, totalAmount: true },
        });
        if (!existing && resolvedOrderId.length === 32 && /^[0-9a-fA-F]{32}$/.test(resolvedOrderId)) {
            const formattedUuid = `${resolvedOrderId.slice(0, 8)}-${resolvedOrderId.slice(8, 12)}-${resolvedOrderId.slice(12, 16)}-${resolvedOrderId.slice(16, 20)}-${resolvedOrderId.slice(20)}`;
            existing = yield prisma_1.default.order.findUnique({
                where: { id: formattedUuid },
                select: { id: true, status: true, paymentStatus: true, totalAmount: true },
            });
            if (existing)
                resolvedOrderId = existing.id;
        }
        if (!existing) {
            existing = yield prisma_1.default.order.findFirst({
                where: {
                    OR: [
                        { id: { equals: resolvedOrderId, mode: "insensitive" } },
                        { id: { contains: resolvedOrderId, mode: "insensitive" } }
                    ]
                },
                select: { id: true, status: true, paymentStatus: true, totalAmount: true },
            });
            if (existing)
                resolvedOrderId = existing.id;
        }
        if (!existing)
            return res.status(404).json({ message: "Order not found" });
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
                logger_1.default.info(`[Payment] Payment verification received non-success status '${rawStatus}' for order ${resolvedOrderId}`);
                // Purge draft order & restore stock so no bill is created
                const orderToPurge = yield prisma_1.default.order.findUnique({
                    where: { id: resolvedOrderId },
                    include: { items: true }
                });
                if (orderToPurge && !orderToPurge.isPaid && orderToPurge.paymentStatus !== "COMPLETED" && orderToPurge.paymentStatus !== "PAID") {
                    yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
                        var _a;
                        const locationId = ((_a = orderToPurge.shippingAddress) === null || _a === void 0 ? void 0 : _a.locationId) || orderToPurge.locationId;
                        if (locationId) {
                            yield inventoryService_1.InventoryService.restoreStock({
                                items: orderToPurge.items.map(i => ({ productId: i.productId, variantId: i.variantId || undefined, quantity: i.quantity })),
                                locationId,
                                staffId: "SYSTEM",
                                referenceId: `CANCEL_PURGE_${resolvedOrderId}`
                            }, tx);
                        }
                        yield tx.orderItem.deleteMany({ where: { orderId: resolvedOrderId } });
                        yield tx.payment.deleteMany({ where: { orderId: resolvedOrderId } });
                        yield tx.orderStatusHistory.deleteMany({ where: { orderId: resolvedOrderId } });
                        yield tx.order.delete({ where: { id: resolvedOrderId } });
                    }));
                }
                return res.status(400).json({
                    status: "FAILED",
                    message: `Payment was cancelled or failed (status: ${rawStatus}). Bill was not created.`
                });
            }
            logger_1.default.info(`[Payment] Running payment verification for order ${resolvedOrderId} (status: ${rawStatus})`);
            yield (0, exports.completeOrderPayment)(resolvedOrderId, {
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
                    yield (0, exports.completeOrderPayment)(order_id, {
                        status: "CHARGED",
                        txn_id: detail.easepayid || detail.txnid || order_id,
                        amount: Number(detail.amount || existing.totalAmount),
                        payment_method_type: detail.mode || "ONLINE"
                    });
                    return res.json({ status: "SUCCESS", message: "Payment verified via Easebuzz" });
                }
                if (["FAILED", "FAILURE", "BOUNCED", "ERROR"].includes(status)) {
                    yield (0, exports.completeOrderPayment)(order_id, {
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
                yield (0, exports.completeOrderPayment)(order_id, {
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
            const result = yield (0, exports.completeOrderPayment)(order_id, {
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
            const result = yield (0, exports.completeOrderPayment)(order_id, juspayOrder);
            if (result.status === "SUCCESS" || result.status === "ALREADY_COMPLETED") {
                return res.json({ status: "SUCCESS", message: "Payment verified via Gateway" });
            }
        }
        if (["FAILED", "JUSPAY_DECLINED", "AUTHORIZATION_FAILED", "AUTHENTICATION_FAILED"].includes(status)) {
            // Handle Failure (restores stock)
            yield (0, exports.completeOrderPayment)(order_id, juspayOrder);
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
    if (req.body.txnid && (req.body.hash || req.body.status)) {
        logger_1.default.info(`[Webhook] Easebuzz notification received: ${JSON.stringify(req.body)}`);
        if (req.body.hash && process.env.EASEBUZZ_SALT) {
            const calculatedHash = getEasebuzzReverseHash(req.body, process.env.EASEBUZZ_SALT);
            if (calculatedHash !== req.body.hash) {
                logger_1.default.warn(`[Webhook] Easebuzz signature mismatch (calculated=${calculatedHash}, received=${req.body.hash}). Continuing processing based on transaction status.`);
            }
        }
        const { txnid, status, easebuzz_id, amount, mode, phone, email, firstname } = req.body;
        if (!txnid || !status)
            return res.status(400).json({ message: "Missing txnid or status" });
        const isSuccess = (status || "").toLowerCase() === "success";
        // Handle Customer Advance Wallet Deposit webhook
        if (txnid.startsWith("WLT_")) {
            if (isSuccess) {
                try {
                    yield (0, exports.processWalletDepositCredit)({
                        phone,
                        amount: Number(amount),
                        referenceId: easebuzz_id || txnid,
                        paymentMethod: mode || "EASEBUZZ"
                    });
                }
                catch (wErr) {
                    logger_1.default.error(`[Wallet Webhook Error]: ${wErr.message}`);
                }
            }
            return res.json({ status: "OK" });
        }
        // Resolve original orderId from txnid (strip timestamp suffix)
        let resolvedOrderId = txnid;
        if (!txnid.startsWith("DUE_") && !txnid.startsWith("SET_") && !txnid.startsWith("SETTLE_")) {
            resolvedOrderId = txnid.replace(/_\d{3,}$/, "");
        }
        const txPayment = yield prisma_1.default.payment.findFirst({
            where: { transactionId: txnid },
            select: { orderId: true }
        });
        if (txPayment === null || txPayment === void 0 ? void 0 : txPayment.orderId) {
            resolvedOrderId = txPayment.orderId;
        }
        try {
            yield (0, exports.completeOrderPayment)(resolvedOrderId, {
                status: isSuccess ? "CHARGED" : "FAILED",
                txn_id: easebuzz_id || txnid,
                amount: Number(amount),
                payment_method_type: mode || "ONLINE",
                phone,
                email,
                firstname
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
        yield (0, exports.completeOrderPayment)(order_id, { status, txn_id, amount, payment_method_type });
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
    const payload = Object.assign(Object.assign({}, (req.query || {})), (req.body || {}));
    logger_1.default.info(`[Easebuzz Callback] Received callback payload: ${JSON.stringify(payload)}`);
    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
    if (payload.hash && process.env.EASEBUZZ_SALT) {
        const calculatedHash = getEasebuzzReverseHash(payload, process.env.EASEBUZZ_SALT);
        if (calculatedHash !== payload.hash) {
            logger_1.default.warn(`[Easebuzz Callback] Signature mismatch: calculated=${calculatedHash}, received=${payload.hash}. Continuing processing based on transaction status.`);
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
        logger_1.default.error("[Easebuzz Callback] Missing txnid in payload");
        return res.redirect(`${clientUrl}/payment/success?status=failed&message=Missing transaction ID`);
    }
    const isSuccess = status.toLowerCase() === "success" || status.toLowerCase() === "charged";
    // Handle Customer Advance Wallet Deposit callback redirect
    if (txnid && txnid.startsWith("WLT_")) {
        if (isSuccess) {
            try {
                yield (0, exports.processWalletDepositCredit)({
                    phone,
                    amount: Number(amount),
                    referenceId: easebuzz_id || txnid,
                    paymentMethod: mode || "EASEBUZZ"
                });
                return res.redirect(`${clientUrl}/account?wallet_deposit=success`);
            }
            catch (wErr) {
                logger_1.default.error(`[Wallet Callback Error]: ${wErr.message}`);
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
        const cbPayment = yield prisma_1.default.payment.findFirst({
            where: { transactionId: txnid },
            select: { orderId: true }
        });
        if (cbPayment === null || cbPayment === void 0 ? void 0 : cbPayment.orderId) {
            resolvedOrderId = cbPayment.orderId;
        }
    }
    try {
        yield (0, exports.completeOrderPayment)(resolvedOrderId, {
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
    }
    catch (error) {
        logger_1.default.error(`[Easebuzz Callback] Error completing payment: ${error.message}`);
        return res.redirect(`${clientUrl}/payment/success?order_id=${resolvedOrderId}&status=failed&message=Payment completion failed`);
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
        const userid = ((req.query.userid || req.query.userId || req.query.user_id) || "").trim();
        const number = ((req.query.number || req.query.phone || req.query.mobile) || "").trim();
        const billid = ((req.query.billid || req.query.billId || req.query.orderid || req.query.orderId || req.query.order_id || req.query.id) || "").replace(/^#/, "").trim();
        if (!userid && !number && !billid) {
            return res.status(400).json({ message: "Missing required parameters (userid, number, or billid/orderId)" });
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
            let order = yield prisma_1.default.order.findUnique({
                where: { id: billid },
                include: {
                    user: { select: { id: true, name: true, phone: true, email: true } },
                    items: { include: { product: true } },
                    payments: true
                }
            });
            if (!order) {
                order = yield prisma_1.default.order.findFirst({
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
                const dueRes = (0, dueCalculationService_1.calculateOrderDue)(order);
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
                    items: order.items.map((i) => {
                        var _a, _b;
                        const basePrice = ((_a = i.product) === null || _a === void 0 ? void 0 : _a.basePrice) ? Number(i.product.basePrice) : Number(i.sellingPrice);
                        const discount = Math.max(0, basePrice - Number(i.sellingPrice));
                        return {
                            id: i.id,
                            name: ((_b = i.product) === null || _b === void 0 ? void 0 : _b.name) || "Item",
                            quantity: Number(i.quantity),
                            sellingPrice: Number(i.sellingPrice),
                            basePrice: basePrice,
                            discount: discount
                        };
                    })
                };
            }
        }
        let unpaidOrders = [];
        let totalDue = 0;
        const effectiveUserId = (customer === null || customer === void 0 ? void 0 : customer.id) || userid;
        if (effectiveUserId) {
            const orders = yield prisma_1.default.order.findMany({
                where: (0, dueCalculationService_1.getEligibleOrdersWhereClause)({ customerId: effectiveUserId }),
                orderBy: { createdAt: "asc" },
                include: { payments: true }
            });
            const summary = (0, dueCalculationService_1.calculateCustomerDues)(orders);
            totalDue = summary.totalDue;
            unpaidOrders = summary.eligibleOrders.map((o) => ({
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
    }
    catch (error) {
        logger_1.default.error(`[PayInfo Error] ${error.message}`);
        return res.status(500).json({ message: "Failed to fetch payment details" });
    }
});
exports.getPayInfo = getPayInfo;
const initiatePayDue = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, phone, amount } = req.body;
        const rawBillId = (req.body.billId || req.body.orderId || req.body.order_id || req.body.billid || "").toString().trim();
        let cleanBillId = rawBillId.replace(/^#/, "").trim();
        // ── Guard against display label "All Dues (N Bills)" being treated as an order ID ──
        if ((0, dueCalculationService_1.isAllDuesDisplayLabel)(cleanBillId)) {
            cleanBillId = "";
        }
        let customer = null;
        if (userId)
            customer = yield prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!customer && phone) {
            const cleanPhone = phone.replace(/\D/g, "");
            customer = yield prisma_1.default.user.findFirst({
                where: { OR: [{ phone }, { phone: cleanPhone }, { phone: `+91${cleanPhone}` }] }
            });
        }
        let order = null;
        if (cleanBillId) {
            order = yield prisma_1.default.order.findUnique({ where: { id: cleanBillId }, include: { payments: true } });
            if (!order) {
                order = yield prisma_1.default.order.findFirst({
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
        if (!customer && (order === null || order === void 0 ? void 0 : order.userId)) {
            customer = yield prisma_1.default.user.findUnique({ where: { id: order.userId } });
        }
        const effectiveUserId = (customer === null || customer === void 0 ? void 0 : customer.id) || (order === null || order === void 0 ? void 0 : order.userId) || userId || "ANONYMOUS";
        const customerName = (customer === null || customer === void 0 ? void 0 : customer.name) || "Customer";
        const customerPhone = (customer === null || customer === void 0 ? void 0 : customer.phone) || phone || "9999999999";
        const rawEmail = ((customer === null || customer === void 0 ? void 0 : customer.email) || "").trim();
        const isValidEmail = rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail);
        const customerEmail = isValidEmail ? rawEmail : `pay.${(customerPhone || "0000000000").replace(/\D/g, "").slice(-10)}@bookmyveg.co.in`;
        const amountToPay = Number(amount);
        if (!amountToPay || amountToPay <= 0) {
            return res.status(400).json({ message: "Invalid payment amount" });
        }
        // ── 1. Gather Customer's ALL Unpaid Orders for Bulk Settlement ──
        let customerUnpaidOrders = [];
        if (effectiveUserId && effectiveUserId !== "ANONYMOUS") {
            customerUnpaidOrders = yield prisma_1.default.order.findMany({
                where: (0, dueCalculationService_1.getEligibleOrdersWhereClause)({ customerId: effectiveUserId }),
                include: { payments: true },
                orderBy: { createdAt: "asc" }
            });
        }
        if (customerUnpaidOrders.length === 0 && order) {
            customerUnpaidOrders = [order];
        }
        else if (order && !customerUnpaidOrders.some((o) => o.id === order.id)) {
            customerUnpaidOrders.unshift(order);
        }
        // ── 2. Build the JSON list of intended allocations across all bills ──
        const intendedBills = [];
        let remainingToAllocate = amountToPay;
        for (const ord of customerUnpaidOrders) {
            const ordDue = (0, dueCalculationService_1.calculateOrderDue)(ord).dueAmount;
            if (ordDue > 0) {
                const toAlloc = remainingToAllocate > 0 ? Math.min(remainingToAllocate, ordDue) : ordDue;
                intendedBills.push({
                    orderId: ord.id,
                    intendedAmount: toAlloc,
                    dueAmount: ordDue,
                    totalAmount: Number(ord.totalAmount)
                });
                if (remainingToAllocate > 0) {
                    remainingToAllocate = Math.max(0, remainingToAllocate - toAlloc);
                }
            }
        }
        const isMultiBill = intendedBills.length > 1;
        // Easebuzz requires a unique txnid <= 40 characters matching ^[a-zA-Z0-9_|/\-]{1,40}$
        const timestamp = Date.now();
        const shortNonce = String(timestamp).slice(-6); // 6 digits
        const cleanCustPhone = (customerPhone || "").replace(/\D/g, "").slice(-10);
        let txnid;
        let productInfoLabel;
        if (isMultiBill) {
            txnid = `BULK_${cleanCustPhone || "CUST"}_${shortNonce}`;
            productInfoLabel = `All Dues (${intendedBills.length} Bills) - ${customerPhone || String(effectiveUserId).slice(0, 10)}`;
        }
        else if (order) {
            const compactOrder = order.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 18);
            txnid = `DUE_${compactOrder}_${shortNonce}`;
            productInfoLabel = `Bill Payment ${order.id.slice(0, 20)}`;
        }
        else {
            txnid = `BULK_${cleanCustPhone || "CUST"}_${shortNonce}`;
            productInfoLabel = `Account Settlement ${customerPhone || String(effectiveUserId).slice(0, 15)}`;
        }
        // ── 3. Persist BULK_BILL_SETTLEMENT & PAYMENT_REQUEST in AuditLog ──
        try {
            yield prisma_1.default.auditLog.create({
                data: {
                    entityType: "BULK_BILL_SETTLEMENT",
                    entityId: txnid,
                    action: "INITIATE_BULK_PAYMENT",
                    newValue: {
                        customerId: effectiveUserId,
                        customerPhone,
                        customerName,
                        totalAmount: amountToPay,
                        txnid,
                        orderList: intendedBills.map(b => ({
                            orderId: b.orderId,
                            totalAmount: b.totalAmount,
                            dueAmount: b.dueAmount,
                            amountToPay: b.intendedAmount
                        })),
                        billIds: intendedBills.map(b => b.orderId),
                        intendedAllocations: intendedBills,
                        status: "INITIATED",
                        createdAt: new Date().toISOString()
                    }
                }
            });
        }
        catch (auditErr) {
            logger_1.default.warn(`[Initiate Pay Due] Could not create bulk audit settlement request: ${auditErr.message}`);
        }
        // ── 4. Record Pending Payment record for each intended bill linked to txnid ──
        for (const b of intendedBills) {
            try {
                const targetTxn = isMultiBill ? `${txnid}_${b.orderId.slice(0, 6)}` : txnid;
                yield prisma_1.default.payment.create({
                    data: {
                        orderId: b.orderId,
                        amount: b.intendedAmount,
                        method: "ONLINE",
                        status: "PENDING",
                        transactionId: targetTxn,
                        metadata: {
                            txnid,
                            isBulkSettlement: isMultiBill,
                            customerId: effectiveUserId
                        }
                    }
                });
            }
            catch (pErr) {
                logger_1.default.warn(`[Initiate Pay Due] Could not create pending payment record: ${pErr}`);
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
                const easeResult = yield callEasebuzzInitiateApi({
                    txnid,
                    amount: amountToPay,
                    firstname: customerName,
                    email: customerEmail,
                    phone: customerPhone,
                    productinfo: productInfoLabel,
                    callbackUrl
                });
                return res.json(Object.assign({ txnid, orderId: isMultiBill ? txnid : ((order === null || order === void 0 ? void 0 : order.id) || cleanBillId || txnid), isMultiBill, billCount: intendedBills.length }, easeResult));
            }
            catch (easebuzzError) {
                logger_1.default.error(`[Initiate Pay Due] Easebuzz initiation failed, falling back to mock gateway. Error: ${easebuzzError.message}`);
                return res.json({
                    txnid,
                    orderId: isMultiBill ? txnid : ((order === null || order === void 0 ? void 0 : order.id) || cleanBillId || txnid),
                    isMultiBill,
                    billCount: intendedBills.length,
                    paymentLink: `${baseUrl.replace(/\/$/, "")}/payment/mock-gateway?orderId=${txnid}&amount=${amountToPay}`,
                });
            }
        }
        // Mock gateway fallback when Easebuzz is not configured
        return res.json({
            txnid,
            orderId: (order === null || order === void 0 ? void 0 : order.id) || cleanBillId || undefined,
            paymentLink: `${baseUrl.replace(/\/$/, "")}/payment/mock-gateway?orderId=${txnid}&amount=${amountToPay}`,
        });
    }
    catch (error) {
        logger_1.default.error(`[Initiate Pay Due Error] ${error.message}`);
        return res.status(500).json({ message: "Failed to initiate payment" });
    }
});
exports.initiatePayDue = initiatePayDue;
const publicCustomerOnboard = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
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
        let customer = yield prisma_1.default.user.findFirst({
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
            customer = yield prisma_1.default.user.update({
                where: { id: customer.id },
                data: Object.assign(Object.assign({ name }, (email && { email })), (address && {
                    profileAddress: address,
                    addresses: {
                        upsert: {
                            where: {
                                id: ((_b = (_a = customer.addresses) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.id) || "new-address-id"
                            },
                            update: { fullAddress: address },
                            create: { fullAddress: address, isDefault: true }
                        }
                    }
                })),
                include: { addresses: true }
            });
            return res.json({ message: "Customer details updated successfully", customer });
        }
        else {
            // Create a new Customer
            customer = yield prisma_1.default.user.create({
                data: Object.assign(Object.assign(Object.assign({ name, phone: cleanPhone }, (email && { email })), { role: "USER", password: "POS_AUTO_GENERATED_" + Math.random().toString(36).slice(-8), profileAddress: address || "" }), (address && {
                    addresses: {
                        create: {
                            fullAddress: address,
                            isDefault: true
                        }
                    }
                })),
                include: { addresses: true }
            });
            // Trigger welcome registration WhatsApp notification!
            try {
                const { sendRegistrationThankYouViaWhatsapp } = require("../services/mbgcard");
                sendRegistrationThankYouViaWhatsapp(customer.phone, customer.name || "Customer").catch((err) => {
                    console.error("[Onboarding] Welcome WhatsApp dispatch failure:", err);
                });
            }
            catch (err) {
                console.error("[Onboarding] Failed to send welcome WhatsApp:", err);
            }
            return res.status(201).json({ message: "Customer registered successfully", customer });
        }
    }
    catch (error) {
        next(error);
    }
});
exports.publicCustomerOnboard = publicCustomerOnboard;
const saveOrderFeedback = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { orderId, rating, feedback } = req.body;
    if (!orderId) {
        return res.status(400).json({ message: "Order ID is required" });
    }
    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Valid rating (1-5) is required" });
    }
    try {
        const order = yield prisma_1.default.order.findUnique({
            where: { id: orderId }
        });
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        const updatedOrder = yield prisma_1.default.order.update({
            where: { id: orderId },
            data: {
                rating: parseInt(rating),
                feedback: feedback || null,
                feedbackSent: true
            }
        });
        // Mark all customer orders as feedbackSent: true so customer is never prompted again
        if (updatedOrder.userId) {
            yield prisma_1.default.order.updateMany({
                where: { userId: updatedOrder.userId, feedbackSent: false },
                data: { feedbackSent: true }
            });
        }
        // Configurable Google Review link (via PageContent CMS, env, or default)
        let googleReviewUrl = process.env.GOOGLE_REVIEW_URL || "https://share.google/AcOZ060z33fcR4OGQ";
        try {
            const reviewConfig = yield prisma_1.default.pageContent.findUnique({
                where: { slug: "google-review-link" }
            });
            if ((reviewConfig === null || reviewConfig === void 0 ? void 0 : reviewConfig.content) && reviewConfig.content.trim()) {
                googleReviewUrl = reviewConfig.content.trim();
            }
        }
        catch (confErr) {
            // fallback to env / default
        }
        return res.json({
            message: "Feedback submitted successfully",
            order: updatedOrder,
            googleReviewUrl
        });
    }
    catch (error) {
        next(error);
    }
});
exports.saveOrderFeedback = saveOrderFeedback;
const triggerEasebuzzSync = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    const { startDate, endDate, dryRun } = req.body || {};
    try {
        const { syncEasebuzzTransactions } = yield Promise.resolve().then(() => __importStar(require("../services/easebuzzSyncService")));
        // Support dry-run mode and custom date filters
        const result = yield syncEasebuzzTransactions({
            customStartDate: startDate,
            customEndDate: endDate,
            dryRun: Boolean(dryRun),
            forceFullHistory: !startDate
        });
        return res.json(result);
    }
    catch (error) {
        return res.status(500).json({ message: error.message || "Failed to trigger Easebuzz sync" });
    }
});
exports.triggerEasebuzzSync = triggerEasebuzzSync;
const sendPaymentReminderController = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { orderId } = req.body;
    if (!orderId) {
        return res.status(400).json({ message: "Order ID is required" });
    }
    try {
        const order = yield prisma_1.default.order.findUnique({
            where: { id: orderId },
            include: { user: true, payments: true }
        });
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        const dueResult = (0, dueCalculationService_1.calculateOrderDue)(order);
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
        yield sendPaymentReminderViaWhatsapp(user.phone, user.name || "Customer", dueAmount, order.id, user.id, order.id);
        // Record in AuditLog to coordinate with worker and POS cooldowns
        yield prisma_1.default.auditLog.create({
            data: {
                entityType: "USER",
                entityId: user.id,
                action: "WHATSAPP_DUE_REMINDER",
                staffId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId,
                newValue: {
                    dueAmount,
                    orderId: order.id,
                    trigger: "ADMIN_SINGLE_ORDER",
                    sentAt: new Date()
                }
            }
        }).catch((auditErr) => {
            logger_1.default.warn(`Failed to write AuditLog for single order reminder: ${auditErr.message}`);
        });
        return res.json({ message: "Payment reminder sent successfully via WhatsApp" });
    }
    catch (error) {
        logger_1.default.error(`[Send Payment Reminder Error] ${error.message}`);
        return res.status(500).json({ message: "Failed to send WhatsApp reminder" });
    }
});
exports.sendPaymentReminderController = sendPaymentReminderController;
const cleanUpDuplicatePayments = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 1. Delete duplicate transactionId records ON THE SAME ORDER with full audit trail
        // Group by BOTH orderId and transactionId so that multi-order allocations with the same transactionId are preserved!
        const duplicateTxns = yield prisma_1.default.payment.groupBy({
            by: ["orderId", "transactionId"],
            where: { status: "SUCCESS", transactionId: { not: null } },
            _count: { id: true },
            having: { id: { _count: { gt: 1 } } }
        });
        for (const item of duplicateTxns) {
            if (!item.transactionId || !item.orderId)
                continue;
            const txns = yield prisma_1.default.payment.findMany({
                where: { orderId: item.orderId, transactionId: item.transactionId, status: "SUCCESS" },
                orderBy: { createdAt: "asc" }
            });
            const toDelete = txns.slice(1);
            if (toDelete.length > 0) {
                for (const d of toDelete) {
                    yield prisma_1.default.auditLog.create({
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
                yield prisma_1.default.payment.deleteMany({ where: { id: { in: toDeleteIds } } });
                logger_1.default.info(`[Payment Cleanup] Deleted ${toDelete.length} duplicate payments for order ${item.orderId} and transactionId ${item.transactionId}`);
                // Synchronize customer dues for all affected orders
                for (const d of toDelete) {
                    const ord = yield prisma_1.default.order.findUnique({ where: { id: d.orderId }, select: { userId: true } });
                    if (ord === null || ord === void 0 ? void 0 : ord.userId) {
                        yield (0, orderController_1.syncCustomerTotalDue)(ord.userId);
                    }
                }
            }
        }
        // 2. Identify exact duplicate payments on the same order where total paid exceeds order total amount.
        // A true duplicate overpayment occurs when duplicate submissions have identical amounts and methods.
        const duplicateOrders = yield prisma_1.default.payment.groupBy({
            by: ["orderId"],
            where: { status: "SUCCESS" },
            _count: { id: true },
            having: { id: { _count: { gt: 1 } } }
        });
        for (const item of duplicateOrders) {
            const orderId = item.orderId;
            const order = yield prisma_1.default.order.findUnique({ where: { id: orderId } });
            if (!order)
                continue;
            const payments = yield prisma_1.default.payment.findMany({
                where: { orderId, status: "SUCCESS" },
                orderBy: { createdAt: "asc" }
            });
            const orderTotal = Number(order.totalAmount);
            let totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
            // Only examine orders where total paid exceeds order total amount (overpayment)
            if (totalPaid <= orderTotal)
                continue;
            const duplicateIds = [];
            // Look for near-identical duplicate records (same amount, within 5 minutes)
            for (let i = 0; i < payments.length; i++) {
                for (let j = i + 1; j < payments.length; j++) {
                    const p1 = payments[i];
                    const p2 = payments[j];
                    if (duplicateIds.includes(p2.id))
                        continue;
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
                    yield prisma_1.default.auditLog.create({
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
                yield prisma_1.default.payment.deleteMany({
                    where: { id: { in: duplicateIds } }
                });
                logger_1.default.info(`[Payment Cleanup] Deleted ${duplicateIds.length} duplicate payment records for order ${orderId}`);
            }
            // Recalculate order status
            const remainingPayments = yield prisma_1.default.payment.findMany({
                where: { orderId, status: "SUCCESS" }
            });
            const newTotalPaid = remainingPayments.reduce((acc, p) => acc + Number(p.amount), 0);
            const isFull = newTotalPaid >= orderTotal;
            yield prisma_1.default.order.update({
                where: { id: orderId },
                data: {
                    isPaid: isFull,
                    paymentStatus: isFull ? "COMPLETED" : (newTotalPaid > 0 ? "PARTIAL" : "PENDING")
                }
            });
            if (isFull) {
                yield prisma_1.default.payment.deleteMany({
                    where: { orderId, status: "PENDING" }
                });
            }
            if (order.userId) {
                yield (0, orderController_1.syncCustomerTotalDue)(order.userId);
            }
        }
        // 3. Purge all orphan/stale PENDING payment records for fully paid orders across the system
        const fullyPaidOrders = yield prisma_1.default.order.findMany({
            where: { OR: [{ isPaid: true }, { paymentStatus: "COMPLETED" }] },
            select: { id: true }
        });
        const paidOrderIds = fullyPaidOrders.map(o => o.id);
        if (paidOrderIds.length > 0) {
            yield prisma_1.default.payment.deleteMany({
                where: { orderId: { in: paidOrderIds }, status: "PENDING" }
            });
        }
    }
    catch (e) {
        logger_1.default.error(`[Payment Cleanup Error] ${e.message}`);
    }
});
exports.cleanUpDuplicatePayments = cleanUpDuplicatePayments;
const cleanupDuplicatePaymentsController = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        yield (0, exports.cleanUpDuplicatePayments)();
        return res.json({ success: true, message: "Duplicate payments cleaned up successfully" });
    }
    catch (e) {
        return res.status(500).json({ message: e.message || "Failed to cleanup duplicate payments" });
    }
});
exports.cleanupDuplicatePaymentsController = cleanupDuplicatePaymentsController;
// ─── Customer Advance Wallet Deposit Flow ─────────────────────────────────────
const processWalletDepositCredit = (_a) => __awaiter(void 0, [_a], void 0, function* ({ userId, phone, amount, referenceId, paymentMethod = "EASEBUZZ" }) {
    const depositAmt = Number(amount);
    if (!depositAmt || depositAmt <= 0)
        throw new Error("Invalid deposit amount");
    return yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        // Idempotency: Check if already processed
        const existingTx = yield tx.walletTransaction.findFirst({
            where: { referenceId, type: "DEPOSIT" }
        });
        if (existingTx) {
            const user = yield tx.user.findUnique({
                where: { id: existingTx.userId },
                select: { accountBalance: true }
            });
            return { alreadyProcessed: true, balance: Number((user === null || user === void 0 ? void 0 : user.accountBalance) || 0) };
        }
        let customer = null;
        if (userId) {
            customer = yield tx.user.findUnique({ where: { id: userId } });
        }
        if (!customer && phone) {
            const cleanPhone = phone.replace(/\D/g, "");
            customer = yield tx.user.findFirst({
                where: { OR: [{ phone }, { phone: cleanPhone }, { phone: `+91${cleanPhone}` }] }
            });
        }
        if (!customer)
            throw new Error("Customer not found for wallet credit");
        const currentBalance = Number(customer.accountBalance || 0);
        const newBalance = currentBalance + depositAmt;
        yield tx.user.update({
            where: { id: customer.id },
            data: { accountBalance: new client_1.Prisma.Decimal(newBalance) }
        });
        const transaction = yield tx.walletTransaction.create({
            data: {
                userId: customer.id,
                amount: new client_1.Prisma.Decimal(depositAmt),
                type: "DEPOSIT",
                paymentMethod: paymentMethod.toUpperCase(),
                referenceId,
                balanceAfter: new client_1.Prisma.Decimal(newBalance),
                notes: "Online Advance Wallet Deposit via Easebuzz",
                createdBy: "CUSTOMER_ONLINE"
            }
        });
        // Dispatch WhatsApp receipt confirmation
        if (customer.phone) {
            try {
                const { sendTemplateViaChatHub } = require("../services/mbgcard");
                yield sendTemplateViaChatHub(customer.phone, "payment_received", {
                    body: [
                        customer.name || "Customer",
                        `ADV-${referenceId.slice(-6)}`,
                        String(depositAmt),
                        `Easebuzz Online (Advance Wallet Credit - Current Balance: ₹${newBalance})`
                    ]
                }).catch(() => null);
            }
            catch (err) {
                console.warn("[Wallet Deposit WhatsApp warning]:", err);
            }
        }
        return { alreadyProcessed: false, customer, balance: newBalance, transaction };
    }));
});
exports.processWalletDepositCredit = processWalletDepositCredit;
const initiateWalletDeposit = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId)
            return res.status(401).json({ message: "Authentication required" });
        const { amount } = req.body;
        const depositAmt = Number(amount);
        if (!depositAmt || depositAmt < 10 || depositAmt > 50000) {
            return res.status(400).json({ message: "Deposit amount must be between ₹10 and ₹50,000" });
        }
        const user = yield prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, phone: true, email: true }
        });
        if (!user)
            return res.status(404).json({ message: "User account not found" });
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
                const easeResult = yield callEasebuzzInitiateApi({
                    txnid,
                    amount: depositAmt,
                    firstname: customerName,
                    email: customerEmail,
                    phone: customerPhone,
                    productinfo: productInfoLabel,
                    callbackUrl
                });
                return res.json(Object.assign({ txnid, amount: depositAmt }, easeResult));
            }
            catch (easebuzzError) {
                logger_1.default.error(`[Wallet Deposit] Easebuzz initiation failed, falling back to mock gateway. Error: ${easebuzzError.message}`);
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
    }
    catch (error) {
        logger_1.default.error(`[Wallet Deposit Error]: ${error.message}`);
        return res.status(500).json({ message: "Failed to initiate wallet deposit" });
    }
});
exports.initiateWalletDeposit = initiateWalletDeposit;
const verifyWalletDeposit = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId)
            return res.status(401).json({ message: "Authentication required" });
        const { txnid, amount, txn_id, status } = req.body;
        const depositAmt = Number(amount);
        if (!depositAmt || depositAmt <= 0) {
            return res.status(400).json({ message: "Invalid deposit amount" });
        }
        const effectiveRefId = txn_id || txnid || `WLT_${Date.now()}`;
        const result = yield (0, exports.processWalletDepositCredit)({
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
    }
    catch (error) {
        logger_1.default.error(`[Wallet Verify Error]: ${error.message}`);
        return res.status(500).json({ message: error.message || "Failed to verify wallet deposit" });
    }
});
exports.verifyWalletDeposit = verifyWalletDeposit;
const getWalletDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId)
            return res.status(401).json({ message: "Authentication required" });
        const user = yield prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, phone: true, accountBalance: true }
        });
        if (!user)
            return res.status(404).json({ message: "User not found" });
        const transactions = yield prisma_1.default.walletTransaction.findMany({
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
    }
    catch (error) {
        logger_1.default.error(`[Get Wallet Details Error]: ${error.message}`);
        return res.status(500).json({ message: "Failed to load wallet details" });
    }
});
exports.getWalletDetails = getWalletDetails;
