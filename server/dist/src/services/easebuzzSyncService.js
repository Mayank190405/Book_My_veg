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
 * Main Easebuzz v2.1 Single Retrieve API Query
 * Endpoint: POST /transaction/v2.1/retrieve
 * Body: key, txnid, hash (sha512(key|txnid|salt))
 */
const verifySingleEasebuzzTx = (txnid, amount, email, phone) => __awaiter(void 0, void 0, void 0, function* () {
    const key = process.env.EASEBUZZ_KEY || process.env.EASEBUZZ_MERCHANT_KEY;
    const salt = process.env.EASEBUZZ_SALT;
    const env = process.env.EASEBUZZ_ENV || process.env.ENV || "test";
    if (!key || !salt)
        return null;
    const baseUrl = env === "prod" || env === "production"
        ? "https://dashboard.easebuzz.in"
        : "https://testdashboard.easebuzz.in";
    const amountStr = amount ? Number(amount).toFixed(2) : "";
    const emailStr = email || "";
    const phoneStr = phone || "";
    const merchantEmail = process.env.EASEBUZZ_MERCHANT_EMAIL || process.env.MERCHANT_EMAIL || "";
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
            timeout: 5000
        });
        if (response.data && response.data.status === true) {
            const txData = Array.isArray(response.data.msg) ? response.data.msg[0] : response.data.msg;
            if (txData) {
                return { status: true, msg: txData };
            }
        }
    }
    catch (e) {
        // Fallthrough to alternative hash sequence if primary hash sequence differs
    }
    // Secondary hash fallback
    const hashSequences = [
        `${key}|${txnid}|${amountStr}|${emailStr}|${phoneStr}|${salt}`,
        `${key}|${merchantEmail}|${txnid}|${salt}`
    ];
    for (const seq of hashSequences) {
        const hash = generateSha512(seq);
        try {
            const response = yield axios_1.default.post(`${baseUrl}/transaction/v2.1/retrieve`, new URLSearchParams({
                key,
                txnid,
                hash
            }).toString(), {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                timeout: 5000
            });
            if (response.data && response.data.status === true) {
                const txData = Array.isArray(response.data.msg) ? response.data.msg[0] : response.data.msg;
                if (txData) {
                    return { status: true, msg: txData };
                }
            }
        }
        catch (e) {
            // Ignore non-existent txnid errors
        }
    }
    return null;
});
exports.verifySingleEasebuzzTx = verifySingleEasebuzzTx;
const syncEasebuzzTransactions = (customStartDate_1, customEndDate_1, ...args_1) => __awaiter(void 0, [customStartDate_1, customEndDate_1, ...args_1], void 0, function* (customStartDate, customEndDate, forceFullHistory = true) {
    const key = process.env.EASEBUZZ_KEY || process.env.EASEBUZZ_MERCHANT_KEY;
    const salt = process.env.EASEBUZZ_SALT;
    const env = process.env.EASEBUZZ_ENV || process.env.ENV || "test";
    const merchantEmail = process.env.EASEBUZZ_MERCHANT_EMAIL || process.env.MERCHANT_EMAIL || "";
    if (!key || !salt) {
        logger_1.default.warn("[Easebuzz Sync] Skipping sync — EASEBUZZ_KEY or EASEBUZZ_SALT not configured.");
        return { success: false, message: "Easebuzz credentials missing" };
    }
    // 1. PRIMARY QUERY ENGINE: Easebuzz v2.1 Retrieve API for recent unpaid database orders (max 30 per cycle)
    const unpaidOrders = yield prisma_1.default.order.findMany({
        where: {
            isPaid: false,
            status: { notIn: ["CANCELLED", "FAILED"] }
        },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
            id: true,
            totalAmount: true,
            user: { select: { phone: true, email: true } }
        }
    });
    logger_1.default.info(`[Easebuzz Sync] PRIMARY QUERY: Reconciling ${unpaidOrders.length} unpaid database orders via Easebuzz v2.1 API...`);
    let totalSettled = 0;
    let totalFetched = 0;
    const unpaidTxnIds = new Set(unpaidOrders.map(o => o.id));
    // Process unpaid orders concurrently via Easebuzz v2.1 retrieve API (batch size 10)
    const batchSize = 10;
    for (let i = 0; i < unpaidOrders.length; i += batchSize) {
        const batch = unpaidOrders.slice(i, i + batchSize);
        yield Promise.all(batch.map((order) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const txCandidates = [
                order.id,
                `${order.id}OKBBJYE`
            ];
            for (const candidateTxnId of txCandidates) {
                const singleRes = yield (0, exports.verifySingleEasebuzzTx)(candidateTxnId, Number(order.totalAmount), ((_a = order.user) === null || _a === void 0 ? void 0 : _a.email) || undefined, ((_b = order.user) === null || _b === void 0 ? void 0 : _b.phone) || undefined);
                if (singleRes && singleRes.status === true && singleRes.msg) {
                    const txData = Array.isArray(singleRes.msg) ? singleRes.msg[0] : singleRes.msg;
                    totalFetched++;
                    const statusStr = (txData.status || "").toLowerCase();
                    if (statusStr === "success" || statusStr === "charged") {
                        const easepayid = txData.easepayid || txData.easebuzz_id || candidateTxnId;
                        const amount = Number(txData.amount || txData.net_amount_debit || order.totalAmount);
                        const result = yield (0, paymentController_1.completeOrderPayment)(order.id, {
                            status: "CHARGED",
                            txn_id: easepayid,
                            amount,
                            payment_method_type: "ONLINE",
                            phone: txData.phone || ((_c = order.user) === null || _c === void 0 ? void 0 : _c.phone),
                            email: txData.email || ((_d = order.user) === null || _d === void 0 ? void 0 : _d.email),
                            firstname: txData.firstname,
                            productinfo: txData.productinfo,
                            metadata: txData
                        });
                        if ((result === null || result === void 0 ? void 0 : result.status) === "SUCCESS") {
                            totalSettled++;
                            unpaidTxnIds.delete(order.id);
                            break;
                        }
                    }
                }
            }
        })));
    }
    // 2. SECONDARY QUERY: Date Range Retrieve API for bulk historical transaction reconciliation
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
    let nextToken = null;
    let hasMore = true;
    let pageCount = 0;
    try {
        while (hasMore && pageCount < 30) {
            pageCount++;
            const payload = Object.assign(Object.assign({ key, hash: activeHash }, (activeEmail ? { merchant_email: activeEmail } : {})), { date_range: {
                    start_date: startDate,
                    end_date: endDate
                } });
            if (nextToken) {
                payload.next = nextToken;
            }
            let response = yield axios_1.default.post(`${baseUrl}/transaction/v2/retrieve/date`, payload, {
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                timeout: 10000
            }).catch(() => null);
            if (!response || !response.data || response.data.status !== true) {
                activeHash = generateSha512(hashSeq2);
                payload.hash = activeHash;
                delete payload.merchant_email;
                response = yield axios_1.default.post(`${baseUrl}/transaction/v2/retrieve/date`, payload, {
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    },
                    timeout: 10000
                }).catch(() => null);
            }
            const resData = response === null || response === void 0 ? void 0 : response.data;
            if (!resData || resData.status !== true || !Array.isArray(resData.data) || resData.data.length === 0) {
                break;
            }
            const txList = resData.data;
            totalFetched += txList.length;
            for (const tx of txList) {
                const statusStr = (tx.status || "").toLowerCase();
                const isSuccess = statusStr === "success" || statusStr === "charged";
                if (isSuccess && tx.txnid) {
                    const easepayid = tx.easepayid || tx.easebuzz_id || tx.txnid;
                    const amount = Number(tx.net_debit_amount || tx.total_debit_amount || tx.amount || 0);
                    let resolvedOrderId = tx.txnid;
                    if (!tx.txnid.startsWith("DUE_") && !tx.txnid.startsWith("SETTLE_")) {
                        resolvedOrderId = tx.txnid.replace(/_\d{3,}$/, "");
                    }
                    try {
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
                            unpaidTxnIds.delete(resolvedOrderId);
                        }
                    }
                    catch (txErr) {
                        logger_1.default.error(`[Easebuzz Sync] Error settling txnid ${tx.txnid}: ${txErr.message}`);
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
        // 3. Clean up any existing duplicate payment entries across orders
        const { cleanUpDuplicatePayments } = yield Promise.resolve().then(() => __importStar(require("../controllers/paymentController")));
        yield cleanUpDuplicatePayments();
        logger_1.default.info(`[Easebuzz Sync] Sync complete! Total Fetched: ${totalFetched}, Total Settled: ${totalSettled}.`);
        return {
            success: true,
            totalFetched,
            totalSettled,
            unpaidOrdersChecked: unpaidOrders.length,
            startDate,
            endDate
        };
    }
    catch (error) {
        logger_1.default.error(`[Easebuzz Sync Error] ${error.message}`);
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
