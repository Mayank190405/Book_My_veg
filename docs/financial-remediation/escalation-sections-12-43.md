# Controlled remediation scope — Sections 12–43

Source: requesting user's complete Sections 12–43 supplied in this conversation on 28 October 2026. This document normalizes that directive into controlled requirements without adding implementation authorization. Sections 1–11 remain governed by the earlier escalation. The following requirements are normative; completion requires evidence and human decisions, not this document's existence.

## Environment access directive

Approved production/staging access methods, environment owners, evidence store, authorized runtime collectors and independent recovery reviewer are not yet identified or verified. Infrastructure/operations must supply named owners, approved read-only procedures/roles/commands, audit logging, access windows and escalation contacts; staging credentials through the secrets manager; a restricted evidence store with retention/encryption/permissions and immutable references; and a restore target/source/operator/reviewer/procedure with authorization.

Do not assume AWS or VPS is production. Do not put credentials, database dumps, raw financial records or signed evidence links in Git. Until approved access exists, only documentation, static inspection, local baseline capture and other approved non-mutating activities may continue. Runtime verification must wait. Financial data changes, migrations, deployment and irreversible operations require separate explicit approvals.

## 12. Correct partial COD

For a ₹1,000 bill with ₹100 advance and ₹900 COD: independently verify/record the advance, retain ₹900 obligation and PARTIALLY_PAID state, and record the remainder only on actual collection. Delivery must not mark paid; legitimate receipt allocations must cover payable value. Test partial/failed advance, delivery without cash, actual COD collection, duplicate collection and delayed callbacks.

## 13. Manual paid/unpaid controls

Do not fabricate receipts or overwrite successful history. Replace direct status toggles with controlled authorized adjustments requiring actor, reason, evidence reference, timestamp, audit and appropriate approval. Use reversals/corrections rather than converting SUCCESS to PENDING.

## 14. Canonical wallet ledger

One service handles deposits, spending, refunds and adjustments with atomic updates, complete history, durable idempotency and concurrency protection. Stored balances reconcile with signed entries.

## 15. Wallet deposit verification

Independent provider verification must match original deposit intent, customer, amount, currency, reference and status. Prevent replay and concurrent credits; client success is insufficient.

## 16. Wallet spending

Every wallet path debits actual available funds through the same atomic service; reject insufficient balance. Cover checkout, bill collection and account settlement; do not post full payments against insufficient funds.

## 17. Wallet history

Use complete ledger and authoritative balance for accounting, not latest 20 rows. Paginate display independently of balance calculations.

## 18. ₹1,629.55 discrepancy

Reconcile customer dues ₹2,056.77 versus Audit Ledger ₹3,686.32 order by order. Examine charges, receipts, flags, cancellations/refunds, wallet allocations, cleanup history, provider evidence and scope filters. Neither amount is independently verified. Do not change balances merely to make views agree.

## 19. Canonical receivables

One projection serves customer/POS/driver dues, invoices, public pay, Audit Ledger, reports, settlements and reminders. Distinguish charges, verified receipts, allocations, refunds/reversals, unapplied credits, outstanding receivables and administrative assertions needing reconciliation.

## 20. Financial scope

Apply consistent customer/location/channel/date/status rules; out-of-scope payments must not incorrectly reduce balances. Define filtered-statement opening and closing balances.

## 21. Provider-aware refunds

Refund through original provider using verified Easebuzz/Juspay contracts; support full/partial refunds, status verification, idempotency and correct direction. Refunds are not new positive collections.

## 22. Cancellation accounting

Define unpaid, partial and paid cancellations; coordinate inventory with refunds/reversals, preserving refund-pending/failed states.

## 23. Preserve history

Retain financial evidence, references and attempts on failure, timeout, abandonment and cancellation. Delayed success remains traceable.

## 24. Replace unsafe duplicate removal

Retire heuristic deletion. Use detection, provider verification, read-only preview, proposed correction, authorization and audited reversal/correction. Similar amounts/timestamps do not prove duplicates.

## 25. Independent reconciliation

Compare independent order/gateway/cash/wallet/refund/allocation evidence. Paid flags cannot validate themselves; explicitly report unsupported paid states.

## 26. Secure reconciliation operations

Strictly validate requests, separate preview/commit, require authorization and explicit correction approval. Reject ambiguous strings such as "false" in boolean fields.

## 27. Easebuzz synchronization

Add distributed execution control, durable idempotency, verified responses, safe pagination, execution reporting and failure alerts. Prevent overlap across replicas and remove automatic destructive cleanup.

## 28. Exact payment mapping

Use exact durable intent/provider references. Substring/prefix/contact matching cannot authorize posting; queue unmatched transactions for reconciliation.

## 29. Monetary arithmetic

Use Decimal-safe or minor-unit arithmetic with explicit consistent rounding for prices, quantities, taxes, discounts, delivery, allocations and refunds.

## 30. Server pricing

Server validates products/variants/quantities/discounts/payable total and rejects manipulated client totals. Authorized POS overrides require complete audit.

## 31. Financial reports

Standardize sales, receipts, POS, shift/cash, gateway settlement, wallet history and customer statements. Distinguish order, collection, refund and settlement dates.

## 32. Derived caches

User.totalDue and similar values are derived caches. Canonical receivables are authoritative; detect/report divergence and never silently return zero on calculation failure.

## 33. Centralized messaging

Migrate due reminders to ReminderService with consistent cooldown, concurrency, templates, dispatch status and audit. Automatic dues reminders remain disabled until separately approved.

## 34. Reminder amounts

Use canonical receivables; record customer, included orders, scope, amount, template, actor, time and provider outcome. Failed attempts are not successful deliveries.

## 35. Financial access control

Review authentication, authorization, ownership, location isolation, validation, rate limiting and replay defenses, especially public payment/invoice/dues/wallet/payment-link APIs.

## 36. Financial audit

Record operation identity, actor, customer/order, amount/currency, before/after state, reason/time, provider evidence reference and outcome. Protect history from ordinary deletion.

## 37. Legacy retirement

After replacement is tested, remove/disable independent posting paths, conflicting calculators, mock-success fallbacks, direct wallet mutation, heuristic deletion, legacy reminders and redundant synchronization. Maintain old-to-new function inventory.

## 38. Historical correction control

Inventory anomalies, preserve original evidence, quantify customer impact and prepare explicit correction proposals. Historical adjustments require separate authorization.

## 39. Financial invariants

Tests prove one receipt once; allocations within available receipts; wallet spend within funds; refunds cannot increase collections; delivery creates no receipts; paid status has legitimate settlement support; identical-scope views reconcile; failed verification never becomes success.

## 40. Regression suite

Use isolated databases and approved sandboxes. Cover split cash/online, partial COD, duplicate/concurrent callbacks, callbacks versus sync, wallet replay/concurrent spend/insufficient funds, multi-order settlement/excess, full/partial refunds, paid cancellation, delayed success, legitimate equal receipts, invalid signatures, manipulated amounts, unsupported paid flags, filtered reports, old-order collections, reminder consistency and restart during sync.

## 41. Implementation order

Stage A: readiness/containment with separately approved emergency action where needed. B: evidence-based historical reconciliation including ₹1,629.55. C: canonical verified receipts/idempotency/allocations/wallet/receivables/refunds. D: migrate checkout/POS/driver/public pay/callback/sync entrypoints. E: reporting/messaging unification. F: tested legacy retirement. G: separately approved migration, release, checkpoints, monitoring and recovery.

## 42. Mandatory deliverables

Verified readiness pack; immutable source/deployment baseline; complete defect-to-fix matrix; financial architecture diagram; database migration/recovery plan; historical reconciliation report; code change inventory; API compatibility report; automated test results; Easebuzz/Juspay sandbox evidence; financial invariant validation; security review; messaging integration report; production release runbook; remaining risks/approval register. Documentation scaffolding is not delivery of the operational/test artifacts.

## 43. Final acceptance

No fabricated payment success; verified wallet deposits or explicitly authorized documented adjustments; no duplicate receipts from repeated events; exact split tenders; reconciled wallet; accurate partial COD; no delivery-fabricated settlement; correctly directed refunds; destructive cleanup retired; consistent receivables/reports; evidence-backed ₹1,629.55 explanation; concurrency-safe sync; canonical reminder amounts; safe legacy retirement; required tests pass; separate deployment/historical approvals recorded.

## Final release gate

Independently verify production build/deployment, actual database/migrations, runtime workers, successful independent restore, staging isolation, approved access, named owners, restricted evidence storage, full scope and approval of exact baseline/operations. Scope is now documented, but does not satisfy any operational gate or release authorization.
