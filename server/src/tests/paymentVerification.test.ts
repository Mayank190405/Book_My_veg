import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import * as policy from "../services/paymentVerificationPolicy";

const intent: policy.VerificationIntent = { reference: "ORDER_1", orderId: "ORDER_1", customerId: "CUSTOMER_1", amount: "100.00", currency: "INR", provider: "EASEBUZZ" };
const captured = { txnid: "ORDER_1", easepayid: "PROVIDER_1", amount: "100.00", currency: "INR", status: "success" };

test("an independently captured payment produces a bound posting proof", async () => {
    let calls = 0;
    await policy.verifyAndPost("ORDER_1", {
        loadIntent: async () => intent, lookup: async () => captured,
        post: async (id, evidence) => {
            calls++; assert.equal(id, intent.orderId); assert.equal(evidence.amount, "100.00");
            assert.equal(policy.isVerifiedPaymentEvidence(evidence), true);
            assert.equal(policy.isVerifiedPaymentEvidence({ ...evidence }), false);
        }
    });
    assert.equal(calls, 1);
});

for (const [label, change] of Object.entries({
    amount: { amount: "99.99" }, currency: { currency: "USD" }, reference: { txnid: "OTHER" },
    pending: { status: "pending" }, authorized: { status: "AUTHORIZED" }, missingId: { easepayid: "" },
    missingCurrency: { currency: undefined }, precision: { amount: "100.001" },
    negative: { amount: "-100" }, invalidAmount: { amount: "NaN" }
})) {
    test(`rejects ${label} without posting`, async () => {
        let posted = false;
        await assert.rejects(policy.verifyAndPost("ORDER_1", { loadIntent: async () => intent,
            lookup: async () => ({ ...captured, ...change }), post: async () => { posted = true; } }));
        assert.equal(posted, false);
    });
}

test("provider timeout never posts a receipt", async () => {
    let posts = 0;
    await assert.rejects(policy.verifyAndPost("ORDER_1", { loadIntent: async () => intent,
        lookup: async () => { throw new Error("timeout"); }, post: async () => { posts++; } }));
    assert.equal(posts, 0);
});
test("unknown/ambiguous merchant intent does not query or post", async () => {
    let lookups = 0;
    await assert.rejects(policy.verifyAndPost("ORDER_1", { loadIntent: async () => null,
        lookup: async () => { lookups++; }, post: async () => assert.fail("posted") }));
    assert.equal(lookups, 0);
});
test("Juspay capture must belong to the expected customer", () => {
    const expected = { ...intent, provider: "JUSPAY" as const };
    const result = { order_id: "ORDER_1", txn_id: "P1", customer_id: "OTHER", amount: "100", currency: "INR", status: "CHARGED" };
    assert.throws(() => policy.validateProviderEvidence(expected, result));
    assert.equal(policy.validateProviderEvidence(expected, { ...result, customer_id: intent.customerId }).txn_id, "P1");
});
test("auth comparisons reject absent credentials, objects and unequal values", () => {
    for (const value of [undefined, null, {}, "", "wrong"]) assert.equal(policy.constantTimeEqual(value, "secret"), false);
    assert.equal(policy.constantTimeEqual("secret", "secret"), true);
    assert.equal(policy.constantTimeEqual("", ""), false);
});

// Execute real controller code with all imports stubbed. No Prisma initialization,
// Redis, HTTP, application startup, provider requests or notifications occur.
function controller(env: Record<string, string> = {}) {
    const source = readFileSync(path.join(__dirname, "../controllers/paymentController.ts"), "utf8");
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
    const exports: any = {};
    const counters = { database: 0, gateway: 0 };
    const database = new Proxy({}, { get: (_target, key) => {
        if (key === "__esModule") return false;
        counters.database++; throw new Error("Unexpected database access");
    } });
    const mocks: Record<string, unknown> = {
        crypto: { createHash },
        "decimal.js": Decimal,
        "../services/dueCalculationService": { calculateOrderPaidAmountDecimal: (payments: any[]) => payments.reduce(
            (sum, p) => p.status === "SUCCESS" && p.method !== "CREDIT" ? sum.plus(p.amount) : sum, new Decimal(0)) },
        "@prisma/client": { Prisma: { Decimal } },
        "./orderController": { syncCustomerTotalDue: async () => 0 },
        "../services/paymentVerificationPolicy": policy,
        "../services/gatewayVerificationService": { verifyGatewayPayment: async () => { counters.gateway++; throw new Error("timeout"); } },
        "../config/prisma": database,
        "../utils/logger": { warn() {}, info() {}, error() {} }
    };
    vm.runInNewContext(code, { exports, require: (id: string) => mocks[id] || {},
        process: { env }, Buffer, URL, console: { log() {}, warn() {}, error() {} } });
    return { api: exports, counters };
}
function response() {
    return { code: 200, body: null as any, status(code: number) { this.code = code; return this; },
        json(body: any) { this.body = body; return this; } };
}
test("client SUCCESS and arbitrary amount cannot bypass provider verification", async () => {
    const { api, counters } = controller(); const res = response();
    await api.verifyPayment({ body: { order_id: "ORDER_1", status: "SUCCESS", amount: 1, txn_id: "FORGED" } }, res);
    assert.equal(res.code, 202); assert.equal(res.body.status, "VERIFICATION_UNKNOWN");
    assert.equal(counters.gateway, 1); assert.equal(counters.database, 0);
});
test("client failure cannot purge payment history", async () => {
    const { api, counters } = controller(); const res = response();
    await api.verifyPayment({ body: { order_id: "ORDER_1", status: "FAILED" } }, res);
    assert.equal(res.code, 202); assert.equal(counters.database, 0);
});
test("unsigned Easebuzz and unconfigured Juspay webhooks fail closed", async () => {
    const { api, counters } = controller();
    for (const body of [{ txnid: "ORDER_1", status: "success" }, { order_id: "ORDER_1", status: "CHARGED" }]) {
        const res = response(); await api.handleWebhook({ body, headers: {} }, res); assert.equal(res.code, 403);
    }
    assert.equal(counters.gateway, 0); assert.equal(counters.database, 0);
});
test("unsigned browser callback cannot post or redirect to success", async () => {
    const { api, counters } = controller(); const res = response();
    await api.handleEasebuzzCallback({ query: { txnid: "ORDER_1", status: "success" }, body: {} }, res);
    assert.equal(res.code, 403); assert.equal(counters.gateway, 0);
});
test("incorrect configured Easebuzz signature is rejected before gateway lookup", async () => {
    const { api, counters } = controller({ EASEBUZZ_KEY: "test-key", EASEBUZZ_SALT: "test-salt" });
    const res = response();
    await api.handleWebhook({ body: { txnid: "ORDER_1", key: "test-key", hash: "wrong", status: "success" }, headers: {} }, res);
    assert.equal(res.code, 403); assert.equal(counters.gateway, 0);
});
test("valid Easebuzz signature still cannot bypass authenticated provider lookup", async () => {
    const { api, counters } = controller({ EASEBUZZ_KEY: "test-key", EASEBUZZ_SALT: "test-salt" });
    const body = { txnid: "ORDER_1", key: "test-key", amount: "100.00", status: "success", hash: "" };
    body.hash = createHash("sha512").update(["test-salt", "success", ...Array(10).fill(""), "", "", "", "100.00", "ORDER_1", "test-key"].join("|")).digest("hex");
    const res = response(); await api.handleWebhook({ body, headers: {} }, res);
    assert.equal(res.code, 503); assert.equal(counters.gateway, 1); assert.equal(counters.database, 0);
});
test("Juspay Basic authentication is mandatory but not proof of captured money", async () => {
    const { api, counters } = controller({ JUSPAY_WEBHOOK_USERNAME: "test-user", JUSPAY_WEBHOOK_PASSWORD: "test-password" });
    const bad = response(); await api.handleWebhook({ body: { order_id: "ORDER_1" }, headers: { authorization: "Basic wrong" } }, bad);
    assert.equal(bad.code, 403); assert.equal(counters.gateway, 0);
    const res = response();
    await api.handleWebhook({ body: { order_id: "ORDER_1", status: "CHARGED" }, headers: { authorization: `Basic ${Buffer.from("test-user:test-password").toString("base64")}` } }, res);
    assert.equal(res.code, 503); assert.equal(counters.gateway, 1);
});
test("wallet initiation/verification is closed until durable intents exist", async () => {
    const { api, counters } = controller();
    for (const method of ["initiateWalletDeposit", "verifyWalletDeposit"]) {
        const res = response(); await api[method]({ user: { userId: "CUSTOMER_1" }, body: { amount: 100, status: "SUCCESS" } }, res);
        assert.equal(res.code, 503);
    }
    await assert.rejects(api.processWalletDepositCredit({ amount: 100 }));
    assert.equal(counters.database, 0);
});
test("legacy completion rejects a forged proof before touching the database", async () => {
    const { api, counters } = controller();
    await assert.rejects(api.completeOrderPayment("ORDER_1", { status: "CHARGED", amount: 100 }));
    assert.equal(counters.database, 0);
});

function postingTransaction(overrides: any = {}) {
    const writes: any[] = [];
    const order = { id: "ORDER_1", userId: "CUSTOMER_1", totalAmount: new Decimal(1000),
        status: "CONFIRMED", isPaid: false, paymentStatus: "PENDING", payments: [
            { id: "ADVANCE", method: "ONLINE", status: "PENDING", amount: new Decimal(100) },
            { id: "COD", method: "COD", status: "PENDING", amount: new Decimal(900) }
        ], ...overrides };
    const tx = {
        order: { findUnique: async () => order, update: async (x: any) => { writes.push(["order", x]); } },
        payment: { findFirst: async () => null as any, update: async (x: any) => { writes.push(["payment", x]); },
            deleteMany: async () => assert.fail("Must preserve remaining obligations") },
        orderStatusHistory: { create: async (x: any) => { writes.push(["history", x]); } },
        auditLog: { create: async (x: any) => { writes.push(["audit", x]); } }
    };
    return { tx, writes, order };
}
test("verified advance posts once and preserves pending COD and partial status", async () => {
    const { api, counters } = controller(); const { tx, writes } = postingTransaction();
    const evidence = policy.validateProviderEvidence(intent, captured);
    const result = await api.completeOrderPayment("ORDER_1", evidence, tx);
    assert.equal(result.paymentStatus, "PARTIAL"); assert.equal(result.isPaid, false);
    const payments = writes.filter(x => x[0] === "payment");
    assert.equal(payments.length, 1); assert.equal(payments[0][1].where.id, "ADVANCE");
    assert.equal(payments[0][1].data.amount, "100.00");
    assert.equal(writes.filter(x => x[0] === "audit").length, 1);
    assert.equal(counters.database, 0);
});
test("verified full payment derives fully paid state", async () => {
    const { api } = controller(); const { tx } = postingTransaction({ totalAmount: new Decimal(100) });
    const result = await api.completeOrderPayment("ORDER_1", policy.validateProviderEvidence(intent, captured), tx);
    assert.equal(result.isPaid, true); assert.equal(result.paymentStatus, "COMPLETED");
});
test("verified posting replay returns existing receipt without writes", async () => {
    const { api } = controller(); const { tx, writes } = postingTransaction();
    tx.payment.findFirst = async () => ({ orderId: "ORDER_1", amount: new Decimal(100) });
    const result = await api.completeOrderPayment("ORDER_1", policy.validateProviderEvidence(intent, captured), tx);
    assert.equal(result.status, "ALREADY_PROCESSED"); assert.equal(writes.length, 0);
});
test("existing provider receipt cannot be reused on another order", async () => {
    const { api } = controller(); const { tx, writes } = postingTransaction();
    tx.payment.findFirst = async () => ({ orderId: "OTHER", amount: new Decimal(100) });
    await assert.rejects(api.completeOrderPayment("ORDER_1", policy.validateProviderEvidence(intent, captured), tx));
    assert.equal(writes.length, 0);
});
test("excess receipts and unsupported paid flags require reconciliation without writes", async () => {
    for (const overrides of [{ totalAmount: new Decimal(50) }, { isPaid: true }, { status: "CANCELLED" }]) {
        const { api } = controller(); const { tx, writes } = postingTransaction(overrides);
        await assert.rejects(api.completeOrderPayment("ORDER_1", policy.validateProviderEvidence(intent, captured), tx), policy.VerificationRejected);
        assert.equal(writes.length, 0);
    }
});
test("ambiguous pending obligations cannot be selected by arbitrary first match", async () => {
    const { api } = controller(); const sample = postingTransaction();
    sample.order.payments.push({ ...sample.order.payments[0], id: "ANOTHER_ADVANCE" });
    await assert.rejects(api.completeOrderPayment("ORDER_1", policy.validateProviderEvidence(intent, captured), sample.tx), policy.VerificationRejected);
    assert.equal(sample.writes.length, 0);
});
