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

    const hashSequences = [
        `${key}|${txnid}|${salt}`,
        `${key}|${txnid}|${amountStr}|${emailStr}|${phoneStr}|${salt}`,
        `${key}|${merchantEmail}|${txnid}|${salt}`
    ];

    for (const seq of hashSequences) {
        const hash = generateSha512(seq);
        try {
            const response = await axios.post(
                `${baseUrl}/transaction/v2/retrieve`,
                new URLSearchParams({
                    key,
                    txnid,
                    ...(amountStr ? { amount: amountStr } : {}),
                    ...(emailStr ? { email: emailStr } : {}),
                    ...(phoneStr ? { phone: phoneStr } : {}),
                    hash
                }).toString(),
                {
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    timeout: 4000
                }
            );

            if (response.data && (response.data.status === true || response.data.status === "success")) {
                return response.data;
            }
        } catch (e: any) {
            // Silence expected 400 for non-existent transaction IDs
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

    const today = new Date();
    
    // Always default start date to earliest order in database or 2024-01-01 when forceFullHistory is true
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

    // 1. Collect all unpaid orders from the database till date
    const unpaidOrders = await prisma.order.findMany({
        where: {
            isPaid: false,
            paymentStatus: { in: ["PENDING", "PARTIAL"] },
            status: { notIn: ["CANCELLED", "FAILED"] }
        },
        select: {
            id: true,
            totalAmount: true,
            user: { select: { phone: true, email: true } }
        }
    });

    const unpaidTxnIds = new Set(unpaidOrders.map(o => o.id));
    logger.info(`[Easebuzz Sync] Querying all transactions till date (${startDate} to ${endDate}). Target unpaid orders count: ${unpaidTxnIds.size}`);

    // Try both hash sequences (with merchant_email and without) for Date Range Retrieve API
    const hashSeq1 = `${key}|${merchantEmail}|${startDate}|${endDate}|${salt}`;
    const hashSeq2 = `${key}|${startDate}|${endDate}|${salt}`;
    
    let activeHash = generateSha512(hashSeq1);
    let activeEmail = merchantEmail;

    let totalFetched = 0;
    let totalSettled = 0;
    let nextToken: string | null = null;
    let hasMore = true;
    let pageCount = 0;

    try {
        while (hasMore && pageCount < 50) {
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

            // Retry with secondary hash format if first attempt failed
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

                    // Resolve orderId from txnid
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

        // 2. Query remaining unpaid database orders via Single Retrieve API concurrently (max 50 orders per sync cycle)
        const remainingUnpaid = unpaidOrders.filter(o => unpaidTxnIds.has(o.id)).slice(0, 50);
        if (remainingUnpaid.length > 0) {
            logger.info(`[Easebuzz Sync] Parallel checking ${remainingUnpaid.length} remaining unpaid orders...`);
            
            const batchSize = 10;
            for (let i = 0; i < remainingUnpaid.length; i += batchSize) {
                const batch = remainingUnpaid.slice(i, i + batchSize);
                await Promise.all(batch.map(async (order) => {
                    const singleRes = await verifySingleEasebuzzTx(
                        order.id,
                        Number(order.totalAmount),
                        order.user?.email || undefined,
                        order.user?.phone || undefined
                    );

                    if (singleRes && (singleRes.status === true || singleRes.status === "success")) {
                        const txData = singleRes.msg || singleRes.data || singleRes;
                        const statusStr = (txData.status || "").toLowerCase();
                        if (statusStr === "success" || statusStr === "charged") {
                            const easepayid = txData.easepayid || txData.easebuzz_id || order.id;
                            const amount = Number(txData.amount || txData.net_debit_amount || order.totalAmount);
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
                            }
                        }
                    }
                }));
            }
        }

        // 3. Clean up any existing duplicate payment entries across orders
        const { cleanUpDuplicatePayments } = await import("../controllers/paymentController");
        await cleanUpDuplicatePayments();

        logger.info(`[Easebuzz Sync] Full sync complete till date! Total Fetched: ${totalFetched}, Total Settled: ${totalSettled}.`);
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
        logger.info("[Cron] Running 6-hour Easebuzz transaction sync job targeting unpaid transactions till date...");
        await syncEasebuzzTransactions(undefined, undefined, true);
    });

    logger.info("⏰ Easebuzz Transaction Sync Cron initialized (Targeting unpaid transactions till date every 6 hours)");

    // Initial sync 30 seconds after server startup
    setTimeout(() => {
        syncEasebuzzTransactions(undefined, undefined, true).catch(err => {
            logger.error(`[Easebuzz Initial Sync Error] ${err.message}`);
        });
    }, 30000);
};
