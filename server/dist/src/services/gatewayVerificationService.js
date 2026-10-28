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
exports.verifyGatewayPayment = verifyGatewayPayment;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = require("crypto");
const prisma_1 = __importDefault(require("../config/prisma"));
const juspayService_1 = require("./juspayService");
const decimal_js_1 = __importDefault(require("decimal.js"));
const dueCalculationService_1 = require("./dueCalculationService");
const paymentVerificationPolicy_1 = require("./paymentVerificationPolicy");
/** Existing intents supported by this containment release: one pending ONLINE
 * payment on one exact order. Multi-bill and wallet intents require the durable
 * receipt/intent migration and are deliberately not inferred from contacts/IDs. */
function verifyGatewayPayment(reference, actorId, post) {
    return __awaiter(this, void 0, void 0, function* () {
        return (0, paymentVerificationPolicy_1.verifyAndPost)(reference, {
            loadIntent: (merchantReference) => __awaiter(this, void 0, void 0, function* () {
                const provider = process.env.PAYMENT_VERIFICATION_PROVIDER;
                if (provider !== "EASEBUZZ" && provider !== "JUSPAY") {
                    throw new paymentVerificationPolicy_1.VerificationRejected("Verification provider is not configured");
                }
                const matches = yield prisma_1.default.payment.findMany({
                    where: { OR: [
                            { transactionId: merchantReference, method: "ONLINE", status: "PENDING" },
                            { status: "SUCCESS", metadata: { path: ["merchantReference"], equals: merchantReference } }
                        ] },
                    include: { order: { include: { payments: true } } }, take: 2
                });
                let pending = matches.length === 1 ? matches[0] : null;
                if (!pending && matches.length === 0) {
                    const order = yield prisma_1.default.order.findUnique({ where: { id: merchantReference }, include: { payments: true } });
                    const online = (order === null || order === void 0 ? void 0 : order.payments.filter(p => p.method === "ONLINE" && p.status === "PENDING")) || [];
                    if (order && online.length === 1)
                        pending = Object.assign(Object.assign({}, online[0]), { order });
                }
                if (!pending)
                    return null;
                if (actorId && actorId !== pending.order.userId)
                    throw new paymentVerificationPolicy_1.VerificationRejected("Payment owner mismatch");
                if (pending.status === "SUCCESS") {
                    const evidence = pending.metadata;
                    if ((evidence === null || evidence === void 0 ? void 0 : evidence.verification) !== "AUTHENTICATED_PROVIDER_LOOKUP" || evidence.provider !== provider)
                        return null;
                    return { reference: merchantReference, orderId: pending.orderId, customerId: pending.order.userId,
                        amount: pending.amount.toFixed(2), currency: "INR", provider };
                }
                if (["CANCELLED", "FAILED", "RETURNED"].includes(pending.order.status) || pending.order.isPaid ||
                    ["COMPLETED", "PAID", "SETTLED"].includes(pending.order.paymentStatus))
                    return null;
                const remaining = new decimal_js_1.default(pending.order.totalAmount.toString()).minus((0, dueCalculationService_1.calculateOrderPaidAmountDecimal)(pending.order.payments));
                if (new decimal_js_1.default(pending.amount.toString()).greaterThan(remaining)) {
                    throw new paymentVerificationPolicy_1.VerificationRejected("Receipt requires excess-payment reconciliation");
                }
                return { reference: merchantReference, orderId: pending.orderId,
                    customerId: pending.order.userId, amount: pending.amount.toFixed(2), currency: "INR", provider };
            }),
            lookup: (intent) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                if (intent.provider === "JUSPAY") {
                    if (!process.env.JUSPAY_API_KEY || !process.env.JUSPAY_MERCHANT_ID)
                        throw new paymentVerificationPolicy_1.VerificationRejected("Gateway credentials unavailable");
                    return (0, juspayService_1.getJuspayOrderStatus)(intent.reference);
                }
                const key = process.env.EASEBUZZ_KEY || process.env.EASEBUZZ_MERCHANT_KEY;
                const salt = process.env.EASEBUZZ_SALT;
                const env = process.env.EASEBUZZ_ENV;
                if (!key || !salt || !["test", "prod", "production"].includes(env || ""))
                    throw new paymentVerificationPolicy_1.VerificationRejected("Gateway credentials unavailable");
                const host = env === "test" ? "https://testdashboard.easebuzz.in" : "https://dashboard.easebuzz.in";
                const hash = (0, crypto_1.createHash)("sha512").update(`${key}|${intent.reference}|${salt}`).digest("hex");
                const response = yield axios_1.default.post(`${host}/transaction/v2/retrieve`, new URLSearchParams({ key, txnid: intent.reference, hash }).toString(), {
                    headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 8000,
                    maxRedirects: 0
                });
                // Reject unknown envelopes; never use callback fields to fill gaps.
                const rows = (_a = response.data) === null || _a === void 0 ? void 0 : _a.msg;
                if (((_b = response.data) === null || _b === void 0 ? void 0 : _b.status) !== true || !Array.isArray(rows) || rows.length !== 1)
                    throw new paymentVerificationPolicy_1.VerificationRejected("Unsupported gateway response");
                return rows[0];
            }),
            post: (orderId, evidence) => __awaiter(this, void 0, void 0, function* () {
                return prisma_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                    // Cross-instance containment for all verified entrypoints. No legacy
                    // uniqueness constraints or historical mutations are introduced.
                    yield tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtextextended(${orderId}, 0))`;
                    yield tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtextextended(${evidence.txn_id}, 1))`;
                    const existing = yield tx.payment.findFirst({ where: { transactionId: evidence.txn_id, status: "SUCCESS" } });
                    if (existing) {
                        if (existing.orderId !== orderId || existing.amount.toFixed(2) !== evidence.amount)
                            throw new paymentVerificationPolicy_1.VerificationRejected("Previously posted receipt mismatch");
                        return { status: "ALREADY_PROCESSED" };
                    }
                    return post(orderId, evidence, tx);
                }), { timeout: 15000 });
            })
        });
    });
}
