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
Object.defineProperty(exports, "__esModule", { value: true });
exports.isVerifiedPaymentEvidence = exports.VerificationRejected = void 0;
exports.minorUnits = minorUnits;
exports.constantTimeEqual = constantTimeEqual;
exports.validateProviderEvidence = validateProviderEvidence;
exports.verifyAndPost = verifyAndPost;
const crypto_1 = require("crypto");
class VerificationRejected extends Error {
}
exports.VerificationRejected = VerificationRejected;
const verifiedEvidence = new WeakSet();
const isVerifiedPaymentEvidence = (value) => typeof value === "object" && value !== null && verifiedEvidence.has(value);
exports.isVerifiedPaymentEvidence = isVerifiedPaymentEvidence;
// Require exact minor units. Never round an untrusted amount into a match.
function minorUnits(value) {
    if (typeof value !== "string" && typeof value !== "number") {
        throw new VerificationRejected("Invalid payment amount");
    }
    const match = /^(0|[1-9]\d{0,7})(?:\.(\d{1,2}))?$/.exec(String(value));
    if (!match)
        throw new VerificationRejected("Invalid payment amount");
    const amount = BigInt(match[1]) * BigInt(100) + BigInt((match[2] || "").padEnd(2, "0"));
    if (amount <= BigInt(0))
        throw new VerificationRejected("Invalid payment amount");
    return amount;
}
function constantTimeEqual(a, b) {
    if (typeof a !== "string" || typeof b !== "string" || !a || !b)
        return false;
    const left = (0, crypto_1.createHash)("sha256").update(a).digest();
    const right = (0, crypto_1.createHash)("sha256").update(b).digest();
    return (0, crypto_1.timingSafeEqual)(left, right);
}
/** Only call with the result of an authenticated provider lookup, never a callback body. */
function validateProviderEvidence(intent, evidence) {
    if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
        throw new VerificationRejected("Provider evidence unavailable");
    }
    const reference = intent.provider === "EASEBUZZ" ? evidence.txnid : evidence.order_id;
    const providerId = intent.provider === "EASEBUZZ" ? evidence.easepayid : evidence.txn_id;
    const captured = intent.provider === "EASEBUZZ" ? evidence.status === "success" : evidence.status === "CHARGED";
    if (!captured)
        throw new VerificationRejected("Payment is not captured");
    if (reference !== intent.reference || typeof providerId !== "string" || !providerId.trim()) {
        throw new VerificationRejected("Provider identity mismatch");
    }
    if (evidence.currency !== intent.currency || minorUnits(evidence.amount) !== minorUnits(intent.amount)) {
        throw new VerificationRejected("Provider amount or currency mismatch");
    }
    // Juspay returns the customer ID on the authenticated order. Easebuzz's
    // transaction is bound through the exact locally stored merchant reference.
    if (intent.provider === "JUSPAY" && evidence.customer_id !== intent.customerId) {
        throw new VerificationRejected("Provider customer mismatch");
    }
    const result = Object.freeze({ orderId: intent.orderId, status: "CHARGED", txn_id: providerId,
        amount: intent.amount, payment_method_type: intent.provider, metadata: {
            verification: "AUTHENTICATED_PROVIDER_LOOKUP", merchantReference: intent.reference,
            provider: intent.provider, currency: intent.currency
        } });
    verifiedEvidence.add(result);
    return result;
}
/** Frontend/callback status, amount, phone and provider IDs are deliberately unused. */
function verifyAndPost(reference, dependencies) {
    return __awaiter(this, void 0, void 0, function* () {
        if (typeof reference !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(reference)) {
            throw new VerificationRejected("Invalid merchant reference");
        }
        const intent = yield dependencies.loadIntent(reference);
        if (!intent || intent.reference !== reference)
            throw new VerificationRejected("Exact payment intent required");
        const providerEvidence = yield dependencies.lookup(intent);
        const verified = validateProviderEvidence(intent, providerEvidence);
        return dependencies.post(intent.orderId, verified);
    });
}
