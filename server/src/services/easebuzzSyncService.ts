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

export interface EasebuzzVerifyResult {
    success: boolean;
    txnid: string;
    gatewayStatus: string | null;
    error: string | null;
    txData: any | null;
}

/**
 * Easebuzz v2.1 Single Retrieve API Query
 * Endpoint: POST /transaction/v2.1/retrieve
 * Body: key, txnid, hash (sha512(key|txnid|salt))
 */
export const verifySingleEasebuzzTx = async (txnid: string): Promise<EasebuzzVerifyResult> => {
    const key = process.env.EASEBUZZ_KEY || process.env.EASEBUZZ_MERCHANT_KEY;
    const salt = process.env.EASEBUZZ_SALT;
    const env = process.env.EASEBUZZ_ENV || process.env.ENV || "test";

    if (!key || !salt) {
        logger.error(`[Easebuzz Sync Error] Missing EASEBUZZ_KEY or EASEBUZZ_SALT credentials for txnid: ${txnid}`);
        return { success: false, txnid, gatewayStatus: null, error: "Credentials missing", txData: null };
    }

    const baseUrl = env === "prod" || env === "production"
        ? "https://dashboard.easebuzz.in"
        : "https://testdashboard.easebuzz.in";

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
                timeout: 8000
            }
        );

        const resData = response.data;
        if (resData && resData.status === true) {
            const txData = Array.isArray(resData.msg) ? resData.msg[0] : resData.msg;
            const gatewayStatus = (txData?.status || "unknown").toLowerCase();
            return {
                success: true,
                txnid,
                gatewayStatus,
                error: null,
                txData
            };
        } else {
            const errorMsg = resData?.reason || resData?.error_desc || resData?.msg || "Transaction not found on gateway";
            logger.warn(`[Easebuzz Single Tx API Warning] Txn ID: ${txnid} -> Response: ${JSON.stringify(resData)}`);
            return {
                success: false,
                txnid,
                gatewayStatus: null,
                error: String(errorMsg),
                txData: null
            };
        }
    } catch (apiError: any) {
        const errorDetail = apiError.response?.data || apiError.message;
        logger.error(`[Easebuzz Single Tx API Error] Txn ID: ${txnid} -> HTTP Error: ${JSON.stringify(errorDetail)}`);
        return {
            success: false,
            txnid,
            gatewayStatus: null,
            error: String(apiError.message || errorDetail),
            txData: null
        };
    }
};

export const syncEasebuzzTransactions = async (customStartDate?: string, customEndDate?: string, forceFullHistory: boolean = true) => {
    const key = process.env.EASEBUZZ_KEY || process.env.EASEBUZZ_MERCHANT_KEY;
    const salt = process.env.EASEBUZZ_SALT;
    const env = process.env.EASEBUZZ_ENV || process.env.ENV || "test";
    const merchantEmail = process.env.EASEBUZZ_MERCHANT_EMAIL || process.env.MERCHANT_EMAIL || "";

    if (!key || !salt) {
        logger.error("[Easebuzz Sync] Skipping sync — EASEBUZZ_KEY or EASEBUZZ_SALT not configured.");
        return { success: false, message: "Easebuzz credentials missing" };
    }

    logger.info("[Easebuzz Sync] Starting payment reconciliation...");

    let totalFetched = 0;
    let totalSettled = 0;
    let totalFailed = 0;
    let totalKeptPending = 0;

    // 1. Fetch all pending/unpaid orders from database
    const unpaidOrders = await prisma.order.findMany({
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

    logger.info(`[Easebuzz Sync] Found ${unpaidOrders.length} pending/unpaid orders to verify.`);

    const resolvedOrderIds = new Set<string>();

    // 2. Verify each pending order against exact Easebuzz txnid
    const batchSize = 10;
    for (let i = 0; i < unpaidOrders.length; i += batchSize) {
        const batch = unpaidOrders.slice(i, i + batchSize);
        await Promise.all(batch.map(async (order) => {
            // Determine exact transaction IDs associated with this order
            const exactTxnIds: string[] = [];
            if (order.channel !== "POS") {
                exactTxnIds.push(order.id);
            }
            
            // Check payments table for any exact online transaction IDs stored during payment creation
            order.payments.forEach((p: any) => {
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
                const verifyResult = await verifySingleEasebuzzTx(txnid);

                if (verifyResult.success && verifyResult.gatewayStatus) {
                    const status = verifyResult.gatewayStatus;
                    const txData = verifyResult.txData;

                    if (status === "success" || status === "charged") {
                        const easepayid = txData?.easepayid || txData?.easebuzz_id || txnid;
                        const amount = Number(txData?.amount || txData?.net_amount_debit || order.totalAmount);
                        
                        const updateResult = await completeOrderPayment(order.id, {
                            status: "CHARGED",
                            txn_id: easepayid,
                            amount,
                            payment_method_type: "ONLINE",
                            phone: txData?.phone || order.user?.phone,
                            email: txData?.email || order.user?.email,
                            firstname: txData?.firstname,
                            productinfo: txData?.productinfo,
                            metadata: txData
                        });

                        totalSettled++;
                        resolvedOrderIds.add(order.id);
                        logger.info(`[Easebuzz Sync] Order ID: ${order.id} -> Easebuzz txnid: ${txnid} -> Gateway Status: SUCCESS/CHARGED -> DB Result: PAID/CHARGED`);
                        break;

                    } else if (status === "failed" || status === "dropped" || status === "usercancelled" || status === "user_cancelled") {
                        totalFailed++;
                        await prisma.payment.updateMany({
                            where: { orderId: order.id, status: "PENDING" },
                            data: { status: "FAILED", metadata: txData || {} }
                        });
                        logger.info(`[Easebuzz Sync] Order ID: ${order.id} -> Easebuzz txnid: ${txnid} -> Gateway Status: ${status.toUpperCase()} -> DB Result: FAILED`);
                        break;

                    } else {
                        totalKeptPending++;
                        logger.info(`[Easebuzz Sync] Order ID: ${order.id} -> Easebuzz txnid: ${txnid} -> Gateway Status: ${status.toUpperCase()} -> DB Result: Kept PENDING per gateway status`);
                    }
                } else {
                    logger.info(`[Easebuzz Sync] Order ID: ${order.id} -> Easebuzz txnid: ${txnid} -> Gateway Response: ${verifyResult.error || "Not found on gateway"} -> DB Result: Kept PENDING`);
                }
            }
        }));
    }

    // 3. Date-Range Retrieve API (/transaction/v2/retrieve/date) for bulk historical pagination
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

    logger.info(`[Easebuzz Sync] Running bulk date-range pagination sync from ${startDate} to ${endDate}...`);

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
                    timeout: 12000
                }
            ).catch((err: any) => {
                logger.error(`[Easebuzz Date Retrieve Error] Page ${pageCount}: ${err.message}`);
                return null;
            });

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
                        timeout: 12000
                    }
                ).catch((err: any) => {
                    logger.error(`[Easebuzz Date Retrieve Secondary Error] Page ${pageCount}: ${err.message}`);
                    return null;
                });
            }

            const resData = response?.data;
            if (!resData || resData.status !== true || !Array.isArray(resData.data) || resData.data.length === 0) {
                break;
            }

            const txList: any[] = resData.data;
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
                                logger.info(`[Easebuzz Date Sync] Order ID: ${resolvedOrderId} -> Easebuzz txnid: ${tx.txnid} -> Gateway Status: SUCCESS -> DB Result: PAID/CHARGED`);
                            }
                        } else if (isFailed) {
                            await prisma.payment.updateMany({
                                where: {
                                    OR: [
                                        { orderId: resolvedOrderId },
                                        { transactionId: tx.txnid }
                                    ],
                                    status: "PENDING"
                                },
                                data: { status: "FAILED", metadata: tx }
                            });
                            logger.info(`[Easebuzz Date Sync] Order ID: ${resolvedOrderId} -> Easebuzz txnid: ${tx.txnid} -> Gateway Status: ${statusStr.toUpperCase()} -> DB Result: FAILED`);
                        }
                    } catch (txErr: any) {
                        logger.error(`[Easebuzz Date Sync] Error settling txnid ${tx.txnid}: ${txErr.message}`);
                    }
                }
            }

            if (resData.next && resData.next !== nextToken) {
                nextToken = resData.next;
            } else {
                hasMore = false;
            }
        }

        // 4. Clean up any existing duplicate payment entries across orders
        const { cleanUpDuplicatePayments } = await import("../controllers/paymentController");
        await cleanUpDuplicatePayments();

        logger.info(`[Easebuzz Sync Summary] Total Pending Verified: ${unpaidOrders.length}, Settled: ${totalSettled}, Failed: ${totalFailed}, Kept Pending: ${totalKeptPending}, Total Bulk Fetched: ${totalFetched}.`);
        
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
    } catch (error: any) {
        logger.error(`[Easebuzz Sync Exception] ${error.message}`);
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
