import cron from "node-cron";
import axios from "axios";
import crypto from "crypto";
import logger from "../utils/logger";
import prisma from "../config/prisma";
import { completeOrderPayment } from "../controllers/paymentController";

const generateSha512 = (str: string) => {
    return crypto.createHash("sha512").update(str).digest("hex").toLowerCase();
};

const formatDate = (date: Date): string => {
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
export const verifySingleEasebuzzTx = async (txnid: string, amount?: number, email?: string, phone?: string) => {
    const key = process.env.EASEBUZZ_KEY || process.env.EASEBUZZ_MERCHANT_KEY;
    const salt = process.env.EASEBUZZ_SALT;
    const env = process.env.EASEBUZZ_ENV || process.env.ENV || "test";

    if (!key || !salt) return null;

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
        const response = await axios.post(
            `${baseUrl}/transaction/v2.1/retrieve`,
            new URLSearchParams({
                key,
                txnid,
                hash: primaryHash
            }).toString(),
            {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                timeout: 5000
            }
        );

        if (response.data && response.data.status === true) {
            const txData = Array.isArray(response.data.msg) ? response.data.msg[0] : response.data.msg;
            if (txData) {
                return { status: true, msg: txData };
            }
        }
    } catch (e: any) {
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
            const response = await axios.post(
                `${baseUrl}/transaction/v2.1/retrieve`,
                new URLSearchParams({
                    key,
                    txnid,
                    hash
                }).toString(),
                {
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    timeout: 5000
                }
            );

            if (response.data && response.data.status === true) {
                const txData = Array.isArray(response.data.msg) ? response.data.msg[0] : response.data.msg;
                if (txData) {
                    return { status: true, msg: txData };
                }
            }
        } catch (e: any) {
            // Ignore non-existent txnid errors
        }
    }

    return null;
};

export const syncEasebuzzTransactions = async (customStartDate?: string, customEndDate?: string, forceFullHistory: boolean = true) => {
    const key = process.env.EASEBUZZ_KEY || process.env.EASEBUZZ_MERCHANT_KEY;
    const salt = process.env.EASEBUZZ_SALT;
    const env = process.env.EASEBUZZ_ENV || process.env.ENV || "test";
    const merchantEmail = process.env.EASEBUZZ_MERCHANT_EMAIL || process.env.MERCHANT_EMAIL || "";

    if (!key || !salt) {
        logger.warn("[Easebuzz Sync] Skipping sync — EASEBUZZ_KEY or EASEBUZZ_SALT not configured.");
        return { success: false, message: "Easebuzz credentials missing" };
    }

    // 1. PRIMARY QUERY ENGINE: Easebuzz v2.1 Retrieve API for all unpaid database orders
    const unpaidOrders = await prisma.order.findMany({
        where: {
            isPaid: false,
            status: { notIn: ["CANCELLED", "FAILED"] }
        },
        select: {
            id: true,
            totalAmount: true,
            user: { select: { phone: true, email: true } }
        }
    });

    logger.info(`[Easebuzz Sync] PRIMARY QUERY: Reconciling ${unpaidOrders.length} unpaid database orders via Easebuzz v2.1 API...`);

    let totalSettled = 0;
    let totalFetched = 0;
    const unpaidTxnIds = new Set(unpaidOrders.map(o => o.id));

    // Process unpaid orders concurrently via Easebuzz v2.1 retrieve API (batch size 10)
    const batchSize = 10;
    for (let i = 0; i < unpaidOrders.length; i += batchSize) {
        const batch = unpaidOrders.slice(i, i + batchSize);
        await Promise.all(batch.map(async (order) => {
            const txCandidates = [
                order.id,
                `${order.id}OKBBJYE`
            ];

            for (const candidateTxnId of txCandidates) {
                const singleRes = await verifySingleEasebuzzTx(
                    candidateTxnId,
                    Number(order.totalAmount),
                    order.user?.email || undefined,
                    order.user?.phone || undefined
                );

                if (singleRes && singleRes.status === true && singleRes.msg) {
                    const txData = Array.isArray(singleRes.msg) ? singleRes.msg[0] : singleRes.msg;
                    totalFetched++;

                    const statusStr = (txData.status || "").toLowerCase();
                    if (statusStr === "success" || statusStr === "charged") {
                        const easepayid = txData.easepayid || txData.easebuzz_id || candidateTxnId;
                        const amount = Number(txData.amount || txData.net_amount_debit || order.totalAmount);
                        const result = await completeOrderPayment(order.id, {
                            status: "CHARGED",
                            txn_id: easepayid,
                            amount,
                            payment_method_type: "ONLINE",
                            phone: txData.phone || order.user?.phone,
                            email: txData.email || order.user?.email,
                            firstname: txData.firstname,
                            productinfo: txData.productinfo,
                            metadata: txData
                        });
                        if (result?.status === "SUCCESS") {
                            totalSettled++;
                            unpaidTxnIds.delete(order.id);
                            break;
                        }
                    }
                }
            }
        }));
    }

    // 2. SECONDARY QUERY: Date Range Retrieve API for bulk historical transaction reconciliation
    const today = new Date();
    let defaultStartDate = new Date(2024, 0, 1);
    if (forceFullHistory) {
        const earliestOrder = await prisma.order.findFirst({
            orderBy: { createdAt: "asc" },
            select: { createdAt: true }
        });
        if (earliestOrder?.createdAt) {
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

    let nextToken: string | null = null;
    let hasMore = true;
    let pageCount = 0;

    try {
        while (hasMore && pageCount < 30) {
            pageCount++;
            const payload: any = {
                key,
                hash: activeHash,
                ...(activeEmail ? { merchant_email: activeEmail } : {}),
                date_range: {
                    start_date: startDate,
                    end_date: endDate
                }
            };

            if (nextToken) {
                payload.next = nextToken;
            }

            let response = await axios.post(
                `${baseUrl}/transaction/v2/retrieve/date`,
                payload,
                {
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    },
                    timeout: 10000
                }
            ).catch(() => null);

            if (!response || !response.data || response.data.status !== true) {
                activeHash = generateSha512(hashSeq2);
                payload.hash = activeHash;
                delete payload.merchant_email;

                response = await axios.post(
                    `${baseUrl}/transaction/v2/retrieve/date`,
                    payload,
                    {
                        headers: {
                            "Accept": "application/json",
                            "Content-Type": "application/json"
                        },
                        timeout: 10000
                    }
                ).catch(() => null);
            }

            const resData = response?.data;
            if (!resData || resData.status !== true || !Array.isArray(resData.data)) {
                break;
            }

            const txList: any[] = resData.data;
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
                        const result = await completeOrderPayment(resolvedOrderId, {
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

                        if (result?.status === "SUCCESS") {
                            totalSettled++;
                            unpaidTxnIds.delete(resolvedOrderId);
                        }
                    } catch (txErr: any) {
                        logger.error(`[Easebuzz Sync] Error settling txnid ${tx.txnid}: ${txErr.message}`);
                    }
                }
            }

            if (resData.next && resData.next !== nextToken) {
                nextToken = resData.next;
            } else {
                hasMore = false;
            }
        }

        // 3. Clean up any existing duplicate payment entries across orders
        const { cleanUpDuplicatePayments } = await import("../controllers/paymentController");
        await cleanUpDuplicatePayments();

        logger.info(`[Easebuzz Sync] Sync complete! Total Fetched: ${totalFetched}, Total Settled: ${totalSettled}.`);
        return {
            success: true,
            totalFetched,
            totalSettled,
            unpaidOrdersChecked: unpaidOrders.length,
            startDate,
            endDate
        };
    } catch (error: any) {
        logger.error(`[Easebuzz Sync Error] ${error.message}`);
        return { success: false, error: error.message };
    }
};

export const startEasebuzzSyncCron = () => {
    // Schedule cron every 6 hours: 00:00, 06:00, 12:00, 18:00
    cron.schedule("0 */6 * * *", async () => {
        logger.info("[Cron] Running 6-hour Easebuzz v2.1 transaction sync job...");
        await syncEasebuzzTransactions(undefined, undefined, true);
    });

    logger.info("⏰ Easebuzz Transaction Sync Cron initialized (Primary: Easebuzz v2.1 API)");

    // Initial sync 30 seconds after server startup
    setTimeout(() => {
        syncEasebuzzTransactions(undefined, undefined, true).catch(err => {
            logger.error(`[Easebuzz Initial Sync Error] ${err.message}`);
        });
    }, 30000);
};
