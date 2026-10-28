# Verification containment — first code batch

Authorization: on 28 October 2026 the requesting user explicitly authorized local financial code changes, isolated tests and a push to a separate codex/ branch despite pending readiness. This supersedes the earlier source-implementation hold only. It does not approve production deployment, executing schema changes, live transactions, provider sync, messaging or historical corrections. Operational readiness remains NOT READY.

## Behavior changed

Frontend verification, Easebuzz callback and webhook, and Juspay webhook now converge on one authenticated provider-lookup adapter. Client status, amount, phone and transaction IDs cannot serve as financial proof. Provider timeout or mismatched/unrecognized evidence cannot create a successful receipt or purge an order through these handlers.

Supported intent scope is deliberately narrow: one exact order or exact stored pending ONLINE transaction reference, one pending online obligation, explicit provider configuration, and matching captured amount/currency/customer identity. Paid/cancelled/failed/returned orders, ambiguity, excess money and unknown intents require reconciliation. Existing paid flags do not return synthetic gateway success. Lookup evidence has an in-process unforgeable identity checked by the legacy completion boundary. Verified posts acquire PostgreSQL transaction-scoped advisory locks on order and provider reference, check existing receipt identity, and return an existing posting on a match. This is containment, not a new durable receipt/allocation schema.

Easebuzz requests require the configured merchant key and valid response hash before a fresh lookup. Juspay webhook authentication uses configured Basic credentials rather than the removed assumed JSON HMAC contract. A valid webhook credential/signature alone never posts money. Only captured success is accepted, not AUTHORIZED. Amounts are compared as exact minor units; missing currency/reference/provider ID or excess precision is rejected. Unknown Easebuzz response envelopes are rejected rather than guessed.

Online wallet initiation/verification and its old credit helper are closed until durable deposit intents exist. Live Easebuzz synchronization is disabled, including startup/cron activation; explicit dry-run is still available. Legacy pending-payment cleanup after an online advance was removed from the single-order completion path to retain COD obligations/attempt evidence.

## Compatibility and configuration

This is a review branch and must not be deployed as a complete remediation. `PAYMENT_VERIFICATION_PROVIDER` must explicitly be EASEBUZZ or JUSPAY; there is no automatic provider guess. Juspay webhooks need separately configured `JUSPAY_WEBHOOK_USERNAME` and `JUSPAY_WEBHOOK_PASSWORD`. No actual credential values or production configuration are changed here.

Frontend verify returns HTTP 202 / VERIFICATION_UNKNOWN when independent confirmation is unavailable. Unauthenticated/mismatched callback credentials return 403. Authenticated but unverifiable callbacks/webhooks return 503. Wallet APIs return 503, and live synchronization refuses execution. Multi-bill/settlement references and wallet flows without exact durable intents are not supported by this batch. Some generated timestamp references are not currently persisted; they fail closed and require the later intent migration. No client should treat 202 as payment success.

The Easebuzz lookup adapter requires a successful single-row `msg` response including explicit INR currency. Provider sandbox validation of this envelope/currency field remains outstanding; a different contract will be rejected, not silently coerced. Juspay requires an exact customer_id and CHARGED result. Additional-charge/alternative callback formats not covered by the known reverse-hash sequence will fail closed pending verified contract fixtures.

Official contracts consulted: [Juspay webhook authentication](https://www.juspay.io/in/docs/hyper-checkout/web/base-sdk-integration/webhooks), [Juspay order status](https://www.juspay.io/in/docs/api-reference/docs/express-checkout/order-status-api), [Easebuzz maintained transaction helper](https://github.com/easebuzz/paywitheasebuzz-php-lib/blob/master/easebuzz-lib/transaction.php). Provider configuration and sandbox interoperability have not been certified.

## Validation

`tsx --test src/tests/paymentVerification.test.ts`: 30 isolated tests passed. The suite tests policy matching and real transpiled controller handlers with every database/gateway/messaging/application import stubbed; no services or real transactions are started. Tests cover forged client success/failure, amount/currency/reference mismatch, invalid precision, missing provider ID/currency, noncaptured status, provider timeout, missing intent, Juspay customer mismatch, missing/invalid webhook auth, valid webhook auth followed by failed lookup, disabled wallet flow, forged internal completion proof, full/partial posting, COD preservation, replay and ambiguous obligations.

`tsc --noEmit --pretty false`: passed. TypeScript compilation to a temporary output directory also passed. Changed runtime JavaScript is regenerated from the same source because the repository starts committed dist files. The existing dependency installation is reused without changing lockfiles or running lifecycle scripts.

Not executed: real PostgreSQL advisory-lock/concurrency/restart tests, provider sandbox calls, database migrations, production access, app startup, notifications, reconciliation, deployment or historical corrections. Unit tests do not establish end-to-end financial correctness.

## Remaining remediation

The full Sections 12–43 directive is not complete. Durable intent/event/receipt/allocation models, deposit recovery, atomic POS/driver/wallet workflows, split-tender multiplication, unsupported delivery/manual paid flags, immutable reversals/refunds, report parity, historical ₹1,629.55 reconciliation, cache correction, complete audit evidence and messaging consolidation still require implementation and their relevant approvals/evidence. Direct staff financial writers and legacy scripts have not all migrated to this gate. Financial code still has known defects; do not describe this batch as production-ready or merge it without the remaining review/testing.

The original dirty checkout and its ongoing messaging/client edits were not copied into this isolated branch. This branch starts at local committed readiness-pack baseline ffac93d and contains only this batch; integration with those parallel changes requires later review.
