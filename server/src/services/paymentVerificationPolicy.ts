import { createHash, timingSafeEqual } from "crypto";

export type Provider = "EASEBUZZ" | "JUSPAY";
export interface VerificationIntent {
    reference: string;
    orderId: string;
    customerId: string;
    amount: string;
    currency: "INR";
    provider: Provider;
}

export class VerificationRejected extends Error {}
const verifiedEvidence = new WeakSet<object>();
export const isVerifiedPaymentEvidence = (value: unknown): boolean =>
    typeof value === "object" && value !== null && verifiedEvidence.has(value);

// Require exact minor units. Never round an untrusted amount into a match.
export function minorUnits(value: unknown): bigint {
    if (typeof value !== "string" && typeof value !== "number") {
        throw new VerificationRejected("Invalid payment amount");
    }
    const match = /^(0|[1-9]\d{0,7})(?:\.(\d{1,2}))?$/.exec(String(value));
    if (!match) throw new VerificationRejected("Invalid payment amount");
    const amount = BigInt(match[1]) * BigInt(100) + BigInt((match[2] || "").padEnd(2, "0"));
    if (amount <= BigInt(0)) throw new VerificationRejected("Invalid payment amount");
    return amount;
}

export function constantTimeEqual(a: unknown, b: unknown): boolean {
    if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
    const left = createHash("sha256").update(a).digest();
    const right = createHash("sha256").update(b).digest();
    return timingSafeEqual(left, right);
}

/** Only call with the result of an authenticated provider lookup, never a callback body. */
export function validateProviderEvidence(intent: VerificationIntent, evidence: any) {
    if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
        throw new VerificationRejected("Provider evidence unavailable");
    }
    const reference = intent.provider === "EASEBUZZ" ? evidence.txnid : evidence.order_id;
    const providerId = intent.provider === "EASEBUZZ" ? evidence.easepayid : evidence.txn_id;
    const captured = intent.provider === "EASEBUZZ" ? evidence.status === "success" : evidence.status === "CHARGED";
    if (!captured) throw new VerificationRejected("Payment is not captured");
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

export interface VerificationDependencies {
    loadIntent(reference: string): Promise<VerificationIntent | null>;
    lookup(intent: VerificationIntent): Promise<unknown>;
    post(orderId: string, evidence: ReturnType<typeof validateProviderEvidence>): Promise<unknown>;
}

/** Frontend/callback status, amount, phone and provider IDs are deliberately unused. */
export async function verifyAndPost(reference: unknown, dependencies: VerificationDependencies) {
    if (typeof reference !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(reference)) {
        throw new VerificationRejected("Invalid merchant reference");
    }
    const intent = await dependencies.loadIntent(reference);
    if (!intent || intent.reference !== reference) throw new VerificationRejected("Exact payment intent required");
    const providerEvidence = await dependencies.lookup(intent);
    const verified = validateProviderEvidence(intent, providerEvidence);
    return dependencies.post(intent.orderId, verified);
}
