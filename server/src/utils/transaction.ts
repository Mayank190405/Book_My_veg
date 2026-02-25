import prisma from "../config/prisma";
import logger from "./logger";
import { appConfig } from "../config/appConfig";

const MAX_RETRIES = appConfig.orders.transactionRetryLimit;

/**
 * Retries a transaction function if it fails with a serialization error (code 40001).
 * Uses exponential backoff.
 */
export async function withTransactionRetry<T>(
    fn: (tx: any) => Promise<T>,
    isolationLevel: "Serializable" | "ReadCommitted" = "Serializable"
): Promise<T> {
    let attempt = 0;
    while (attempt < MAX_RETRIES) {
        try {
            return await prisma.$transaction(fn, { isolationLevel });
        } catch (error: any) {
            // Check for serialization failure (Postgres code 40001) or deadlock (40P01)
            // Prisma code P2034 is "Transaction failed due to a write conflict or a deadlock."
            const isRetryable =
                error.code === "P2034" ||
                (error.meta && error.meta.code === "40001") ||
                error.message.includes("deadlock") ||
                error.message.includes("could not serialize access");

            if (isRetryable && attempt < MAX_RETRIES - 1) {
                attempt++;
                const delay = Math.pow(2, attempt) * 100; // 200ms, 400ms, 800ms
                logger.warn(`Transaction conflict. Retrying... (Attempt ${attempt}/${MAX_RETRIES})`);
                await new Promise((res) => setTimeout(res, delay));
                continue;
            }
            throw error;
        }
    }
    throw new Error("Transaction failed after max retries");
}
