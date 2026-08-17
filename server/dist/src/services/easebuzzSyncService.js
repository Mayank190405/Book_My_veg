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
exports.startEasebuzzSyncCron = exports.syncEasebuzzTransactions = void 0;
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
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(today.getDate() - 3);
    const startDate = customStartDate || formatDate(threeDaysAgo);
    const endDate = customEndDate || formatDate(today);
    const baseUrl = env === "prod" || env === "production"
        ? "https://dashboard.easebuzz.in"
        : "https://testdashboard.easebuzz.in";
    // Reverse Hash sequence for retrieve/date API: key|merchant_email|start_date|end_date|salt
    const hashSequence = `${key}|${merchantEmail}|${startDate}|${endDate}|${salt}`;
    const hash = generateSha512(hashSequence);
    logger_1.default.info(`[Easebuzz Sync] Starting transaction sync from ${startDate} to ${endDate}...`);
    let totalFetched = 0;
    let totalSettled = 0;
    let nextToken = null;
    let hasMore = true;
    let pageCount = 0;
    try {
        while (hasMore && pageCount < 20) {
            pageCount++;
            const payload = {
                key,
                hash,
                merchant_email: merchantEmail,
                date_range: {
                    start_date: startDate,
                    end_date: endDate
                }
            };
            if (nextToken) {
                payload.next = nextToken;
            }
            const response = yield axios_1.default.post(`${baseUrl}/transaction/v2/retrieve/date`, payload, {
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                timeout: 15000
            });
            const resData = response.data;
            if (!resData || resData.status !== true || !Array.isArray(resData.data)) {
                logger_1.default.warn(`[Easebuzz Sync] Retrieve API returned unexpected format: ${JSON.stringify(resData)}`);
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
        logger_1.default.info(`[Easebuzz Sync] Sync complete! Fetched: ${totalFetched}, Settled: ${totalSettled}.`);
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
