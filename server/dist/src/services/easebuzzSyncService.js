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
exports.startEasebuzzSyncCron = exports.syncEasebuzzTransactions = exports.verifySingleEasebuzzTx = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = __importDefault(require("../utils/logger"));
const prisma_1 = __importDefault(require("../config/prisma"));
const paymentController_1 = require("../controllers/paymentController");
const generateSha512 = (str) => {
    return crypto_1.default.createHash("sha512").update(str).digest("hex").toLowerCase();
};
const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
};
/**
 * Easebuzz v2.1 Single Retrieve API Query
 * Endpoint: POST /transaction/v2.1/retrieve
 * Body: key, txnid, hash (sha512(key|txnid|salt))
 */
const verifySingleEasebuzzTx = (txnid) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const key = process.env.EASEBUZZ_KEY || process.env.EASEBUZZ_MERCHANT_KEY;
    const salt = process.env.EASEBUZZ_SALT;
    const env = process.env.EASEBUZZ_ENV || process.env.ENV || "test";
    if (!key || !salt) {
        logger_1.default.error(`[Easebuzz Sync Error] Missing EASEBUZZ_KEY or EASEBUZZ_SALT credentials for txnid: ${txnid}`);
        return { success: false, txnid, gatewayStatus: null, error: "Credentials missing", txData: null };
    }
    const baseUrl = env === "prod" || env === "production"
        ? "https://dashboard.easebuzz.in"
        : "https://testdashboard.easebuzz.in";
    // Primary Hash sequence per Easebuzz v2.1 Spec: sha512(key|txnid|salt)
    const primaryHashSeq = `${key}|${txnid}|${salt}`;
    const primaryHash = generateSha512(primaryHashSeq);
    try {
        const response = yield axios_1.default.post(`${baseUrl}/transaction/v2.1/retrieve`, new URLSearchParams({
            key,
            txnid,
            hash: primaryHash
        }).toString(), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            timeout: 8000
        });
        const resData = response.data;
        if (resData && resData.status === true) {
            const txData = Array.isArray(resData.msg) ? resData.msg[0] : resData.msg;
            const gatewayStatus = ((txData === null || txData === void 0 ? void 0 : txData.status) || "unknown").toLowerCase();
            return {
                success: true,
                txnid,
                gatewayStatus,
                error: null,
                txData
            };
        }
        else {
            const errorMsg = (resData === null || resData === void 0 ? void 0 : resData.reason) || (resData === null || resData === void 0 ? void 0 : resData.error_desc) || (resData === null || resData === void 0 ? void 0 : resData.msg) || "Transaction not found on gateway";
            logger_1.default.warn(`[Easebuzz Single Tx API Warning] Txn ID: ${txnid} -> Response: ${JSON.stringify(resData)}`);
            return {
                success: false,
                txnid,
                gatewayStatus: null,
                error: String(errorMsg),
                txData: null
            };
        }
    }
    catch (apiError) {
        const errorDetail = ((_a = apiError.response) === null || _a === void 0 ? void 0 : _a.data) || apiError.message;
        logger_1.default.error(`[Easebuzz Single Tx API Error] Txn ID: ${txnid} -> HTTP Error: ${JSON.stringify(errorDetail)}`);
        return {
            success: false,
            txnid,
            gatewayStatus: null,
            error: String(apiError.message || errorDetail),
            txData: null
        };
    }
});
exports.verifySingleEasebuzzTx = verifySingleEasebuzzTx;
const syncEasebuzzTransactions = (customStartDate_1, customEndDate_1, ...args_1) => __awaiter(void 0, [customStartDate_1, customEndDate_1, ...args_1], void 0, function* (customStartDate, customEndDate, forceFullHistory = true) {
    const key = process.env.EASEBUZZ_KEY || process.env.EASEBUZZ_MERCHANT_KEY;
    const salt = process.env.EASEBUZZ_SALT;
    const env = process.env.EASEBUZZ_ENV || process.env.ENV || "test";
    const merchantEmail = process.env.EASEBUZZ_MERCHANT_EMAIL || process.env.MERCHANT_EMAIL || "";
    if (!key || !salt) {
        logger_1.default.error("[Easebuzz Sync] Skipping sync — EASEBUZZ_KEY or EASEBUZZ_SALT not configured.");
        return { success: false, message: "Easebuzz credentials missing" };
    }
    logger_1.default.info("[Easebuzz Sync] Starting payment reconciliation...");
    let totalFetched = 0;
    let totalSettled = 0;
    let totalFailed = 0;
    let totalKeptPending = 0;
    // 1. Fetch all pending/unpaid orders from database
    const unpaidOrders = yield prisma_1.default.order.findMany({
        where: {
            OR: [
                { isPaid: false },
                { paymentStatus: { in: ["PENDING", "PARTIAL", "UNPAID", "PAYMENT_PENDING"] } },
                { status: "PAYMENT_PENDING" }
            ],
            status: { notIn: ["CANCELLED", "FAILED"] }
        },
        include: {
            payments: true,
            user: { select: { phone: true, email: true } }
        },
        orderBy: { createdAt: "desc" }
    });
    logger_1.default.info(`[Easebuzz Sync] Found ${unpaidOrders.length} pending/unpaid orders to verify.`);
    const resolvedOrderIds = new Set();
    // 2. Verify each pending order against exact Easebuzz txnid
    const batchSize = 10;
    for (let i = 0; i < unpaidOrders.length; i += batchSize) {
        const batch = unpaidOrders.slice(i, i + batchSize);
        yield Promise.all(batch.map((order) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b;
            // Determine exact transaction IDs associated with this order
            const exactTxnIds = [];
            if (order.channel !== "POS") {
                exactTxnIds.push(order.id);
            }
            // Check payments table for any exact online transaction IDs stored during payment creation
            order.payments.forEach((p) => {
                if (p.transactionId &&
                    !p.transactionId.startsWith("PENDING_") &&
                    !p.transactionId.startsWith("DUE_COLLECT_") &&
                    !p.transactionId.startsWith("SETTLE_") &&
                    !p.transactionId.startsWith("POS_")) {
                    exactTxnIds.push(p.transactionId);
                }
            });
            const uniqueTxnIds = Array.from(new Set(exactTxnIds));
            for (const txnid of uniqueTxnIds) {
                const verifyResult = yield (0, exports.verifySingleEasebuzzTx)(txnid);
                if (verifyResult.success && verifyResult.gatewayStatus) {
                    const status = verifyResult.gatewayStatus;
                    const txData = verifyResult.txData;
                    if (status === "success" || status === "charged") {
                        const easepayid = (txData === null || txData === void 0 ? void 0 : txData.easepayid) || (txData === null || txData === void 0 ? void 0 : txData.easebuzz_id) || txnid;
                        const amount = Number((txData === null || txData === void 0 ? void 0 : txData.amount) || (txData === null || txData === void 0 ? void 0 : txData.net_amount_debit) || order.totalAmount);
                        const updateResult = yield (0, paymentController_1.completeOrderPayment)(order.id, {
                            status: "CHARGED",
                            txn_id: easepayid,
                            amount,
                            payment_method_type: "ONLINE",
                            phone: (txData === null || txData === void 0 ? void 0 : txData.phone) || ((_a = order.user) === null || _a === void 0 ? void 0 : _a.phone),
                            email: (txData === null || txData === void 0 ? void 0 : txData.email) || ((_b = order.user) === null || _b === void 0 ? void 0 : _b.email),
                            firstname: txData === null || txData === void 0 ? void 0 : txData.firstname,
                            productinfo: txData === null || txData === void 0 ? void 0 : txData.productinfo,
                            metadata: txData
                        });
                        totalSettled++;
                        resolvedOrderIds.add(order.id);
                        logger_1.default.info(`[Easebuzz Sync] Order ID: ${order.id} -> Easebuzz txnid: ${txnid} -> Gateway Status: SUCCESS/CHARGED -> DB Result: PAID/CHARGED`);
                        break;
                    }
                    else if (status === "failed" || status === "dropped" || status === "usercancelled" || status === "user_cancelled") {
                        totalFailed++;
                        yield prisma_1.default.payment.updateMany({
                            where: { orderId: order.id, status: "PENDING" },
                            data: { status: "FAILED", metadata: txData || {} }
                        });
                        logger_1.default.info(`[Easebuzz Sync] Order ID: ${order.id} -> Easebuzz txnid: ${txnid} -> Gateway Status: ${status.toUpperCase()} -> DB Result: FAILED`);
                        break;
                    }
                    else {
                        totalKeptPending++;
                        logger_1.default.info(`[Easebuzz Sync] Order ID: ${order.id} -> Easebuzz txnid: ${txnid} -> Gateway Status: ${status.toUpperCase()} -> DB Result: Kept PENDING per gateway status`);
                    }
                }
                else {
                    logger_1.default.info(`[Easebuzz Sync] Order ID: ${order.id} -> Easebuzz txnid: ${txnid} -> Gateway Response: ${verifyResult.error || "Not found on gateway"} -> DB Result: Kept PENDING`);
                }
            }
        })));
    }
    // 3. Date-Range Retrieve API (/transaction/v2/retrieve/date) for bulk historical pagination
    const today = new Date();
    let defaultStartDate = new Date(2024, 0, 1);
    if (forceFullHistory) {
        const earliestOrder = yield prisma_1.default.order.findFirst({
            orderBy: { createdAt: "asc" },
            select: { createdAt: true }
        });
        if (earliestOrder === null || earliestOrder === void 0 ? void 0 : earliestOrder.createdAt) {
            defaultStartDate = earliestOrder.createdAt;
        }
    }
    const startDate = (forceFullHistory || !customStartDate) ? formatDate(defaultStartDate) : customStartDate;
    const endDate = customEndDate || formatDate(today);
    const baseUrl = env === "prod" || env === "production"
        ? "https://dashboard.easebuzz.in"
        : "https://testdashboard.easebuzz.in";
    const hashSeq1 = `${key}|${merchantEmail}|${startDate}|${endDate}|${salt}`;
    const hashSeq2 = `${key}|${startDate}|${endDate}|${salt}`;
    let activeHash = generateSha512(hashSeq1);
    let activeEmail = merchantEmail;
    // Determine initial working hash sequence on Page 1
    const testPayload = Object.assign(Object.assign({ key, hash: activeHash }, (activeEmail ? { merchant_email: activeEmail } : {})), { date_range: { start_date: startDate, end_date: endDate } });
    const initialRes = yield axios_1.default.post(`${baseUrl}/transaction/v2/retrieve/date`, testPayload, {
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        timeout: 10000
    }).catch(() => null);
    if (!(initialRes === null || initialRes === void 0 ? void 0 : initialRes.data) || initialRes.data.status !== true) {
        activeHash = generateSha512(hashSeq2);
        activeEmail = undefined;
        logger_1.default.info(`[Easebuzz Date Sync] Switching to secondary hash sequence (without merchant_email)...`);
    }
    let nextToken = null;
    let hasMore = true;
    let pageCount = 0;
    logger_1.default.info(`[Easebuzz Sync] Running bulk date-range pagination sync from ${startDate} to ${endDate}...`);
    try {
        while (hasMore && pageCount < 100) {
            pageCount++;
            const payload = Object.assign(Object.assign({ key, hash: activeHash }, (activeEmail ? { merchant_email: activeEmail } : {})), { date_range: {
                    start_date: startDate,
                    end_date: endDate
                } });
            if (nextToken) {
                payload.next = nextToken;
            }
            const response = yield axios_1.default.post(`${baseUrl}/transaction/v2/retrieve/date`, payload, {
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                timeout: 15000
            }).catch((err) => {
                logger_1.default.error(`[Easebuzz Date Retrieve Error] Page ${pageCount}: ${err.message}`);
                return null;
            });
            const resData = response === null || response === void 0 ? void 0 : response.data;
            if (!resData || resData.status !== true || !Array.isArray(resData.data) || resData.data.length === 0) {
                break;
            }
            const txList = resData.data;
            totalFetched += txList.length;
            for (const tx of txList) {
                const statusStr = (tx.status || "").toLowerCase();
                const isSuccess = statusStr === "success" || statusStr === "charged";
                const isFailed = statusStr === "failed" || statusStr === "usercancelled" || statusStr === "dropped" || statusStr === "user_cancelled";
                if (tx.txnid) {
                    const easepayid = tx.easepayid || tx.easebuzz_id || tx.txnid;
                    const amount = Number(tx.net_debit_amount || tx.total_debit_amount || tx.amount || 0);
                    let resolvedOrderId = tx.txnid;
                    if (!tx.txnid.startsWith("DUE_") && !tx.txnid.startsWith("SETTLE_")) {
                        resolvedOrderId = tx.txnid.replace(/_\d{3,}$/, "");
                    }
                    // Extract order ID candidate from productinfo if present (e.g. "Bill Payment BMV9IO3QM3C3F8T")
                    if (tx.productinfo) {
                        const productMatch = String(tx.productinfo).match(/BMV[A-Z0-9]+/i);
                        if (productMatch && productMatch[0].length >= 8) {
                            resolvedOrderId = productMatch[0].slice(0, 8);
                        }
                    }
                    try {
                        if (isSuccess) {
                            const result = yield (0, paymentController_1.completeOrderPayment)(resolvedOrderId, {
                                status: "CHARGED",
                                txn_id: easepayid,
                                amount,
                                payment_method_type: "ONLINE",
                                phone: tx.phone,
                                email: tx.email,
                                firstname: tx.firstname,
                                productinfo: tx.productinfo,
                                metadata: tx
                            });
                            if ((result === null || result === void 0 ? void 0 : result.status) === "SUCCESS") {
                                totalSettled++;
                                logger_1.default.info(`[Easebuzz Date Sync] Order ID: ${resolvedOrderId} -> Easebuzz txnid: ${tx.txnid} -> Gateway Status: SUCCESS -> DB Result: PAID/CHARGED`);
                            }
                        }
                        else if (isFailed) {
                            yield prisma_1.default.payment.updateMany({
                                where: {
                                    OR: [
                                        { orderId: resolvedOrderId },
                                        { transactionId: tx.txnid }
                                    ],
                                    status: "PENDING"
                                },
                                data: { status: "FAILED", metadata: tx }
                            });
                            logger_1.default.info(`[Easebuzz Date Sync] Order ID: ${resolvedOrderId} -> Easebuzz txnid: ${tx.txnid} -> Gateway Status: ${statusStr.toUpperCase()} -> DB Result: FAILED`);
                        }
                    }
                    catch (txErr) {
                        logger_1.default.error(`[Easebuzz Date Sync] Error settling txnid ${tx.txnid}: ${txErr.message}`);
                    }
                }
            }
            if (resData.next && resData.next !== nextToken) {
                nextToken = resData.next;
            }
            else {
                hasMore = false;
            }
        }
        // 4. Clean up any existing duplicate payment entries across orders
        const { cleanUpDuplicatePayments } = yield Promise.resolve().then(() => __importStar(require("../controllers/paymentController")));
        yield cleanUpDuplicatePayments();
        logger_1.default.info(`[Easebuzz Sync Summary] Total Pending Verified: ${unpaidOrders.length}, Settled: ${totalSettled}, Failed: ${totalFailed}, Kept Pending: ${totalKeptPending}, Total Bulk Fetched: ${totalFetched}.`);
        return {
            success: true,
            totalUnpaidVerified: unpaidOrders.length,
            totalSettled,
            totalFailed,
            totalKeptPending,
            totalFetched,
            startDate,
            endDate
        };
    }
    catch (error) {
        logger_1.default.error(`[Easebuzz Sync Exception] ${error.message}`);
        return { success: false, error: error.message };
    }
});
exports.syncEasebuzzTransactions = syncEasebuzzTransactions;
const startEasebuzzSyncCron = () => {
    // Schedule cron every 6 hours: 00:00, 06:00, 12:00, 18:00
    node_cron_1.default.schedule("0 */6 * * *", () => __awaiter(void 0, void 0, void 0, function* () {
        logger_1.default.info("[Cron] Running 6-hour Easebuzz v2.1 transaction sync job...");
        yield (0, exports.syncEasebuzzTransactions)(undefined, undefined, true);
    }));
    logger_1.default.info("⏰ Easebuzz Transaction Sync Cron initialized (Primary: Easebuzz v2.1 API)");
    // Initial sync 30 seconds after server startup
    setTimeout(() => {
        (0, exports.syncEasebuzzTransactions)(undefined, undefined, true).catch(err => {
            logger_1.default.error(`[Easebuzz Initial Sync Error] ${err.message}`);
        });
    }, 30000);
};
exports.startEasebuzzSyncCron = startEasebuzzSyncCron;
