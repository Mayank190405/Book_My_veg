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
    const hashSequences = [
        `${key}|${txnid}|${salt}`,
        `${key}|${txnid}|${amountStr}|${emailStr}|${phoneStr}|${salt}`,
        `${key}|${merchantEmail}|${txnid}|${salt}`
    ];
    for (const seq of hashSequences) {
        const hash = generateSha512(seq);
        try {
            const response = yield axios_1.default.post(`${baseUrl}/transaction/v2/retrieve`, new URLSearchParams(Object.assign(Object.assign(Object.assign(Object.assign({ key,
                txnid }, (amountStr ? { amount: amountStr } : {})), (emailStr ? { email: emailStr } : {})), (phoneStr ? { phone: phoneStr } : {})), { hash })).toString(), {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                timeout: 5000
            });
            if (response.data && (response.data.status === true || response.data.status === "success")) {
                return response.data;
            }
        }
        catch (e) {
            // Silently ignore 400/404 if txnid does not exist on gateway
        }
    }
    return null;
});
exports.verifySingleEasebuzzTx = verifySingleEasebuzzTx;
const syncEasebuzzTransactions = (customStartDate, customEndDate) => __awaiter(void 0, void 0, void 0, function* () {
    const key = process.env.EASEBUZZ_KEY || process.env.EASEBUZZ_MERCHANT_KEY;
    const salt = process.env.EASEBUZZ_SALT;
    const env = process.env.EASEBUZZ_ENV || process.env.ENV || "test";
    const merchantEmail = process.env.EASEBUZZ_MERCHANT_EMAIL || process.env.MERCHANT_EMAIL || "";
    if (!key || !salt) {
        logger_1.default.warn("[Easebuzz Sync] Skipping sync — EASEBUZZ_KEY or EASEBUZZ_SALT not configured.");
        return { success: false, message: "Easebuzz credentials missing" };
    }
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const startDate = customStartDate || formatDate(thirtyDaysAgo);
    const endDate = customEndDate || formatDate(today);
    const baseUrl = env === "prod" || env === "production"
        ? "https://dashboard.easebuzz.in"
        : "https://testdashboard.easebuzz.in";
    // Try both hash sequences (with merchant_email and without) for Date Range Retrieve API
    const hashSeq1 = `${key}|${merchantEmail}|${startDate}|${endDate}|${salt}`;
    const hashSeq2 = `${key}|${startDate}|${endDate}|${salt}`;
    let activeHash = generateSha512(hashSeq1);
    let activeEmail = merchantEmail;
    logger_1.default.info(`[Easebuzz Sync] Starting fast transaction sync (from ${startDate} to ${endDate})...`);
    let totalFetched = 0;
    let totalSettled = 0;
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
            // Retry with secondary hash format if first attempt failed
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
            if (!resData || resData.status !== true || !Array.isArray(resData.data)) {
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
                    // Resolve orderId from txnid
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
        // Clean up any existing duplicate payment entries across orders
        const { cleanUpDuplicatePayments } = yield Promise.resolve().then(() => __importStar(require("../controllers/paymentController")));
        yield cleanUpDuplicatePayments();
        logger_1.default.info(`[Easebuzz Sync] Fast sync complete! Total Fetched: ${totalFetched}, Total Settled: ${totalSettled}.`);
        return {
            success: true,
            totalFetched,
            totalSettled,
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
        logger_1.default.info("[Cron] Running 6-hour Easebuzz transaction sync job...");
        yield (0, exports.syncEasebuzzTransactions)();
    }));
    logger_1.default.info("⏰ Easebuzz Transaction Sync Cron initialized (Runs every 6 hours)");
    // Initial sync 30 seconds after server startup
    setTimeout(() => {
        (0, exports.syncEasebuzzTransactions)().catch(err => {
            logger_1.default.error(`[Easebuzz Initial Sync Error] ${err.message}`);
        });
    }, 30000);
};
exports.startEasebuzzSyncCron = startEasebuzzSyncCron;
