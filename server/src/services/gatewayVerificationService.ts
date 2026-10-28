import axios from "axios";
import { createHash } from "crypto";
import prisma from "../config/prisma";
import { getJuspayOrderStatus } from "./juspayService";
import Decimal from "decimal.js";
import { calculateOrderPaidAmountDecimal } from "./dueCalculationService";
import { VerificationIntent, VerificationRejected, verifyAndPost } from "./paymentVerificationPolicy";

/** Existing intents supported by this containment release: one pending ONLINE
 * payment on one exact order. Multi-bill and wallet intents require the durable
 * receipt/intent migration and are deliberately not inferred from contacts/IDs. */
export async function verifyGatewayPayment(reference: unknown, actorId: string | undefined,
    post: (orderId: string, evidence: any, tx?: any) => Promise<any>) {
    return verifyAndPost(reference, {
        loadIntent: async (merchantReference) => {
            const provider = process.env.PAYMENT_VERIFICATION_PROVIDER;
            if (provider !== "EASEBUZZ" && provider !== "JUSPAY") {
                throw new VerificationRejected("Verification provider is not configured");
            }
            const matches = await prisma.payment.findMany({
                where: { OR: [
                    { transactionId: merchantReference, method: "ONLINE", status: "PENDING" },
                    { status: "SUCCESS", metadata: { path: ["merchantReference"], equals: merchantReference } }
                ] },
                include: { order: { include: { payments: true } } }, take: 2
            });
            let pending = matches.length === 1 ? matches[0] : null;
            if (!pending && matches.length === 0) {
                const order = await prisma.order.findUnique({ where: { id: merchantReference }, include: { payments: true } });
                const online = order?.payments.filter(p => p.method === "ONLINE" && p.status === "PENDING") || [];
                if (order && online.length === 1) pending = { ...online[0], order };
            }
            if (!pending) return null;
            if (actorId && actorId !== pending.order.userId) throw new VerificationRejected("Payment owner mismatch");
            if (pending.status === "SUCCESS") {
                const evidence = pending.metadata as any;
                if (evidence?.verification !== "AUTHENTICATED_PROVIDER_LOOKUP" || evidence.provider !== provider) return null;
                return { reference: merchantReference, orderId: pending.orderId, customerId: pending.order.userId,
                    amount: pending.amount.toFixed(2), currency: "INR", provider };
            }
            if (["CANCELLED", "FAILED", "RETURNED"].includes(pending.order.status) || pending.order.isPaid ||
                ["COMPLETED", "PAID", "SETTLED"].includes(pending.order.paymentStatus)) return null;
            const remaining = new Decimal(pending.order.totalAmount.toString()).minus(calculateOrderPaidAmountDecimal(pending.order.payments));
            if (new Decimal(pending.amount.toString()).greaterThan(remaining)) {
                throw new VerificationRejected("Receipt requires excess-payment reconciliation");
            }
            return { reference: merchantReference, orderId: pending.orderId,
                customerId: pending.order.userId, amount: pending.amount.toFixed(2), currency: "INR", provider };
        },
        lookup: async (intent: VerificationIntent) => {
            if (intent.provider === "JUSPAY") {
                if (!process.env.JUSPAY_API_KEY || !process.env.JUSPAY_MERCHANT_ID) throw new VerificationRejected("Gateway credentials unavailable");
                return getJuspayOrderStatus(intent.reference);
            }
            const key = process.env.EASEBUZZ_KEY || process.env.EASEBUZZ_MERCHANT_KEY;
            const salt = process.env.EASEBUZZ_SALT;
            const env = process.env.EASEBUZZ_ENV;
            if (!key || !salt || !["test", "prod", "production"].includes(env || "")) throw new VerificationRejected("Gateway credentials unavailable");
            const host = env === "test" ? "https://testdashboard.easebuzz.in" : "https://dashboard.easebuzz.in";
            const hash = createHash("sha512").update(`${key}|${intent.reference}|${salt}`).digest("hex");
            const response = await axios.post(`${host}/transaction/v2/retrieve`, new URLSearchParams({ key, txnid: intent.reference, hash }).toString(), {
                headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 8000,
                maxRedirects: 0
            });
            // Reject unknown envelopes; never use callback fields to fill gaps.
            const rows = response.data?.msg;
            if (response.data?.status !== true || !Array.isArray(rows) || rows.length !== 1) throw new VerificationRejected("Unsupported gateway response");
            return rows[0];
        },
        post: async (orderId, evidence) => prisma.$transaction(async (tx) => {
            // Cross-instance containment for all verified entrypoints. No legacy
            // uniqueness constraints or historical mutations are introduced.
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${orderId}, 0))`;
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${evidence.txn_id}, 1))`;
            const existing = await tx.payment.findFirst({ where: { transactionId: evidence.txn_id, status: "SUCCESS" } });
            if (existing) {
                if (existing.orderId !== orderId || existing.amount.toFixed(2) !== evidence.amount) throw new VerificationRejected("Previously posted receipt mismatch");
                return { status: "ALREADY_PROCESSED" };
            }
            return post(orderId, evidence, tx);
        }, { timeout: 15000 })
    });
}
