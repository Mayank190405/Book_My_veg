# WhatsApp payment reminder investigation — 1 November 2026

> Update: authenticated five-customer provider evidence and a matching deleted hourly worker are documented in [the hourly investigation addendum](hourly-reminders-provider-findings-2026-11-01.md). The original report below reflects the earlier current-checkout-only review.

## Finding and investigation boundary

**Incident origin remains unproven.** This checkout contains verified paths that can submit arbitrary payment reminder amounts repeatedly, an unaudited ChatHub flow path, and post-submission audit failure windows. None establishes which component submitted the reported ₹3,807.20 / nine-bill messages. The number of affected customers and the reason for the one-hour interval remain unknown.

Reviewed checkout: `/Users/kradsagency/Book_My_veg`, HEAD `7515f939dda5d7063405916a0b946757899ce61b`. Investigation is read-only with respect to application code, production, configuration, and financial records. Only this report and offline investigation evidence were added. The pre-existing modification to `client/public/sw.js` was left untouched.

The 6-bill / ₹8,961.25 database result, 14:21:05 UTC accepted audit, two later messages, and earlier production log searches are **supplied incident evidence**, not independently revalidated during this review. No live production database or provider history was queried.

The repository deployment scripts reference `bmv-prod-key-final.pem`; that file is absent at the referenced workspace location. `/app/dist` is not present locally. No production shell, AWS inventory, provider dashboard session, or outbound-history export was available to this investigation. Consequently, runtime process/cron inventories and production source-to-build identity cannot be asserted from this checkout. Existing `docs/financial-remediation/production-identity.json` and `active-workers.json` also mark their inventories UNVERIFIED; they are not production proof.

## 1. Canonical calculation and complete discovered reminder call graph

All HTTP paths below have `/api/v1` as prefix. Route registration: `server/src/index.ts:137`, `:142`, `:147`, and messaging module mounting elsewhere in that file. The following are the discovered paths capable of selecting `payment_due_reminder`; external flow contents are unavailable.

### Canonical manual reminders

- POS UI `client/src/app/pos/page.tsx:159` → `POST /pos/send-whatsapp-reminders` (`server/src/routes/posRoutes.ts:41`) → `sendPOSWhatsappDueReminders` (`server/src/controllers/posController.ts:1604`) → `ReminderService.sendDueReminders` (`server/src/modules/messaging/application/reminder.service.ts:58`). UI supplies customer IDs, not the reminder amount.
- `POST /messaging/reminders/due` (`server/src/modules/messaging/api/messaging.routes.ts:19`) → `MessagingController.sendDueReminders` (`messaging.controller.ts:17`) → same canonical service.
- POS individual bill action `client/src/app/pos/page.tsx:4443` → `POST /pay/send-reminder` (`server/src/routes/payRoutes.ts:15`) → `sendPaymentReminderController` (`server/src/controllers/paymentController.ts:2308`) → `sendSingleOrderReminder` (`reminder.service.ts:231`).
- `POST /messaging/reminders/single-order` (`messaging.routes.ts:27`) → `MessagingController.sendSingleOrderReminder` (`messaging.controller.ts:45`) → same single-order service.
- Legacy `sendPaymentReminderViaWhatsapp` (`server/src/services/mbgcard.ts:162`) ignores supplied `_totalDue` and `_invoiceLabel`, requires `latestOrderId`, and delegates to `sendSingleOrderReminder`. No other source caller of this legacy reminder wrapper was found.

Shared chain:

```text
Trigger/controller
 → eligible Order query including payments [reminder.service.ts:62]
 → calculateCustomerDues(entry.orders) [87]
 → totalDue + eligibleOrdersCount + All Dues label [94–101]
 → DB User row lock + audit-backed claim [notification.repository.ts:127–215]
 → mapPaymentReminder [template-mapper.ts:145–163]
 → NotificationDispatcherService.dispatch [notification-dispatcher.service.ts:34]
 → template validation [49–65]
 → MbgWhatsAppProvider.sendTemplate / HTTP POST [mbg-whatsapp.provider.ts:44–136]
 → recordDispatch [dispatcher:77; repository:24–63]
 → finalizeCustomerReminderClaim [reminder:169; repository:227–296]
```

`sendSingleOrderReminder` first checks the selected order, then delegates to **all eligible customer dues in the selected location**, not just that invoice (`reminder.service.ts:252–275`). This is intentional in the current code and can change a single-bill UI action into an aggregate reminder; it does not establish the nine-bill discrepancy.

### Custom templates — three HTTP surfaces, two frontend callers

```text
POS custom-message UI [client/src/app/pos/page.tsx:578–588]
Admin template UI [client/src/app/admin/templates/page.tsx:255–266]
 → POST /templates/send-custom
 → templateController.sendCustomMessage [server/src/controllers/templateController.ts:296–315]

POST /messaging/templates/send-custom
 → MessagingController.sendCustomTemplate [messaging.controller.ts:98–111]

POST /chathub/send-template
 → chatHubController.sendTemplateHandler [server/src/controllers/chatHubController.ts:47–65]

Legacy sendTemplateViaChatHub [server/src/services/mbgcard.ts:36–49]
 → TemplateService.sendCustomTemplate [template.service.ts:46–77]
 → dispatcher validation + process-local lock
 → provider POST
 → SYSTEM / NOTIFICATION_DISPATCH audit (if persistence succeeds)
```

No additional source callers of `sendTemplateViaChatHub` were found. The third HTTP surface `/templates/send-custom` is especially relevant because it is actually used by both frontend screens. Its authorized roles include ADMIN, STORE_ADMIN, MANAGER, and POS_OPERATOR (`server/src/routes/templateRoutes.ts:20`). This is broader than the messaging-module custom route.

### ChatHub flows — bypass dispatcher entirely

```text
POST /chathub/send-flow [server/src/routes/chatHubRoutes.ts:8]
 → chatHubController.sendFlowHandler [chatHubController.ts:9–26]
POST /messaging/chathub/send-flow [messaging.routes.ts:52–57]
 → MessagingController.sendChatHubFlow [messaging.controller.ts:133–139]
Legacy sendFlowViaChatHub [server/src/services/mbgcard.ts:26–33]
 → NotificationService.sendChatHubFlow [notification.service.ts:252–279]
 → dispatcher.getProvider().sendFlow(...) [271]
 → contact field updates + send_flow action [mbg-whatsapp.provider.ts:201–219]
 → HTTP POST to flow endpoint [232–239]
 → returns result; NO dispatch audit or reminder claim
```

Caller-supplied `customFields` are written before the external flow is triggered. The flow's template selection, variable bindings, schedules, and subsequent sends are external. This code can trigger a flow without a local WhatsApp audit; it does **not prove any configured flow sends payment reminders**.

### Other notifications, scripts, queues, and Easebuzz

The only production mapper explicitly selecting `payment_due_reminder` is `TemplateMapper.mapPaymentReminder`; its only non-test source caller is the canonical reminder service. Other business event methods map other templates (bill creation, payment received, order status, OTP, feedback, vendor purchase orders). Their presence is not evidence of an alternate payment-due calculation.

`server/src/modules/messaging/domain/notification.policies.ts:22` sets `AUTOMATED_DUES_REMINDERS_ENABLED = false`; no active source reminder scheduler was found. This constant does not disable generic custom sends or external provider schedules.

`server/src/scripts/verifyStagingMessaging.ts:101–116` can explicitly send a test OTP with `--execute` and `--phone`; it does not map the disputed reminder. It shares a fallback provider credential, so the file name alone does not establish environment isolation. It was not executed.

`server/src/services/easebuzzSyncService.ts:477–491` schedules transaction sync every six hours and once 30 seconds after startup. Its HTTP calls are gateway transaction retrieval, not MBG reminder sending. No reminder-service or WhatsApp sender call was found there. Its timezone is not specified in `cron.schedule`, so UTC behavior requires runtime timezone evidence. The 18:00 UTC job is not causally linked by source evidence.

The separate gateway kit **does** expose an opt-in WhatsApp operation: `paywitheasebuzz-nodejs-lib/Easebuzz_NodeJS_kit/easebuzz-lib/easy_collect.js:53–71` adds `{ type: 'whatsapp', template: 'Default whatsapp template' }` when `params.op_whatsapp === 'on'` and submits Easy Collect creation. It does not name `payment_due_reminder` or calculate the disputed nine-bill aggregate. Gateway campaign/request records are needed to determine usage; this is distinct from the six-hour sync.

The source queue consumers `server/src/queues/autoCancelQueue.ts` and `slaMonitorQueue.ts` were checked; no direct payment reminder/MBG send path was found. Repository CI workflows are deployment-on-push workflows, not scheduled reminder workflows. External CI schedules are not inventoried.

## 2. Confirmed code defects and risks, with evidence

### F1 — caller controls financial reminder variables; no shared cooldown

Locations: `template.service.ts:54–77`, `templateController.ts:296–315`, `messaging.controller.ts:98–111`, `chatHubController.ts:47–65`, relative to the full paths above.

Relevant code:

```ts
structuredVars = { body: options.variables.map(v => String(v ?? "")) };
return await this.dispatcher.dispatch({
    notificationType: "CUSTOM_TEMPLATE", recipientPhone: cleanPhone,
    templateName, variables: structuredVars, /* ... */
});
```

There is no customer lookup, order/payment query, bill-count calculation, ownership check, or `claimCustomerReminder` here. The validator permits `payment_due_reminder` as an approved utility template and checks minimum parameter count and sanitization (`server/src/modules/messaging/templates/template-validator.ts:37–78`), not the truth of financial values. A supplied `All Dues (9 Bills)` and `₹3807.20` therefore reach the provider unchanged.

Both frontend custom-message screens transmit user-editable variables. POS defaults to template name `due_payment_reminder` (`client/src/app/pos/page.tsx:204`), which differs from the approved `payment_due_reminder`; the template name is editable (`:3371`). Its initial example values include `500` (`:3068`), not the disputed amount. Admin template variables can initialize from provider examples (`client/src/app/admin/templates/page.tsx:250–252`). There is no evidence those examples contained the incident values.

Offline probe: two sequential calls through the actual TemplateService, dispatcher, validator, and provider code both submitted the supplied nine-bill / ₹3807.20 variables. Network and database were mocked. This proves capability, not historical execution.

### F2 — custom deduplication is transient and process-local

Locations: `notification-dispatcher.service.ts:35–38,89–91`; `server/src/modules/messaging/policies/idempotency.policy.ts:7–8,14–33`.

```ts
private static activeKeys = new Map<string, number>();
private static readonly DEFAULT_LOCK_TTL_MS = 15000;
// dispatcher finally:
IdempotencyPolicy.releaseLock(lockKey);
```

Sequential sends are allowed immediately after completion. Different processes do not share the map; restarts erase it. A 15-second TTL may expire while provider retries still run (three 10-second requests plus 1/2-second backoff). It cannot enforce a one-day customer cooldown. No scheduler here specifies a one-hour repeat; that cadence remains unexplained.

### F3 — successful submission can have no dispatch audit

Locations: `notification-dispatcher.service.ts:73–79`; `notification.repository.ts:30–62`.

```ts
const result = await this.provider.sendTemplate(sanitizedRequest);
await this.repository.recordDispatch(sanitizedRequest, result);
return result;
// repository catch:
logger.error(/* ... */);
return null;
```

A process crash between POST and audit, or failed database insertion, loses the durable result while the provider may already have accepted the message. The null return is ignored. Custom sends have no pre-send database claim, so there may be no database evidence at all. Canonical sends create a claim first; on that path a committed pre-send claim should normally exist even if the subsequent dispatch audit is missing. Audit absence alone cannot identify the sender.

Offline probe: an audit insertion exception after mocked acceptance still returned success and produced no additional persisted audit.

Custom messages use `CUSTOM_TEMPLATE`, no recipient ID/reference ID, so successful audits are **entityType SYSTEM**, entityId phone, action **NOTIFICATION_DISPATCH**, with variables and template in `newValue` (`notification.repository.ts:32–54`). A customer-ID-only or WHATSAPP_DUE_REMINDER-only search misses them. The supplied global custom-audit search is stronger evidence, but its exact filters and database target must be preserved.

### F4 — virtual store identity can break custom audit insertion after sending

Locations: `server/src/middleware/auth.ts:29–33,44`; `server/prisma/schema.prisma:610–620`; `notification.repository.ts:35`; `templateController.ts:313`; `chatHubController.ts:63`; `messaging.controller.ts:109`.

```ts
// supported authentication identity:
if (decoded.userId.startsWith("STORE_")) { /* verify Location */ }
// messaging audit:
staffId: request.actorId || null
// schema:
staff User? @relation(fields: [staffId], references: [id])
```

Controllers forward the virtual `STORE_<location>` ID into a User foreign key. If there is no User with that ID, insertion fails **after provider submission** on custom sends, and F3 hides the error from the caller. Generic model audits already normalize virtual IDs to null (`server/src/config/prisma.ts:67–68`); messaging audits do not. On canonical paths the same invalid actor would instead fail the pre-send claim and block sending. Incident relevance requires the actual session identity and FK error logs; this is not a confirmed incident attribution. No live FK failure was induced.

### F5 — ChatHub flow path has no local outbound audit or reminder protections

Locations: `notification.service.ts:252–279`; `mbg-whatsapp.provider.ts:192–255`.

```ts
const provider = this.dispatcher.getProvider();
return await provider.sendFlow(cleanPhone, flowId, name, customFields);
```

Despite the method comment promising a full audit, it does not call `dispatch` or `recordDispatch`; actorId is accepted but unused. There is no authoritative dues calculation, reminder claim, customer/store resolution, durable idempotency, or local flow audit. Offline probe confirmed a flow submission and zero new audit records. Only provider flow configuration/history can establish whether this path produced the reported reminder and what fields it used.

### F6 — standalone cooldown lookup fails open; canonical claim does not

Locations: `notification.repository.ts:99–102`; `server/src/modules/messaging/policies/cooldown.policy.ts:14–26`; `notification.repository.ts:217–219`.

```ts
// lookup query failure:
return { exists: false };
// policy on no audit:
return { allowed: true };
// canonical claim transaction failure:
return { claimed: false, reason: "DB_ERROR" };
```

The lookup's “Fallback safe” comment contradicts its behavior. However, no application caller of `CooldownPolicy` was found; canonical reminders use the claim transaction, which fails closed. Do not attribute the incident to this unused policy without a runtime caller. Offline probe confirms the standalone policy permits sending after a simulated query error.

### F7 — retry ambiguity and provider response classification

Locations: `mbg-whatsapp.provider.ts:47–53,75–98,100–121`.

```ts
await axios.post(this.apiUrl, payload, { timeout: 10000, headers: { /* no idempotency key */ } });
// any resolved response:
return { success: true, status: "ACCEPTED_BY_PROVIDER", /* ... */ };
// ambiguous network error:
if (isNetworkError && attempt < MAX_RETRIES) { /* backoff, repeat POST */ }
```

A timeout/reset can occur after acceptance. Repeating the POST without provider-supported idempotency can create multiple provider messages. The local request idempotency key is not forwarded in this payload or headers. Provider records are needed to know whether MBG deduplicated anything. Offline probe confirms three requests after two simulated ambiguous timeouts, with 1/2-second backoff. This code's retry cadence is seconds, not one hour, and does not explain the observed interval on its own.

Every resolved HTTP response is labeled accepted without checking a business-level `success:false` or required receipt. Offline probe confirms an HTTP 200 rejection body becomes success. Whether MBG uses that response shape in production is unverified. This can cause false acceptance and cooldown, not independently explain an incorrect amount.

### F8 — canonical audit/claim lifecycle has reliability and classification gaps

Locations: `notification.repository.ts:136–152,246–295`; `reminder.service.ts:103–110,168–181`.

The recent-reminder query filters action/time but not accepted status. Dispatcher validation failures and provider rejections are also recorded with action `WHATSAPP_DUE_REMINDER`, so a failed attempt can suppress later legitimate sends for 24 hours. The integration-test simulator does not model all these real writes.

Finalization performs audit creation and claim update as separate writes. Audit creation failures are logged and swallowed; claim update errors are swallowed by `.catch(() => null)`. A crash after acceptance and before both durable results can leave only a CLAIMED record. After its 15-minute lease expires, a new canonical claim can be issued if no reminder audit/completed claim exists. This is a possible duplicate window, not evidence of a one-hour timer. A dispatcher audit that succeeded would still suppress the next canonical send.

Successful canonical sends normally produce **two WHATSAPP_DUE_REMINDER audit rows** (dispatcher and finalizer). Count provider message IDs/attempt identities, not audit rows, when assessing customer impact.

### F9 — POS loses actor attribution; scoping must account for Prisma context

Locations: `server/src/controllers/posController.ts:1608–1618`; `reminder.service.ts:15–20,59`; `server/src/config/prisma.ts:46–55`; `messaging.controller.ts:19–27,47–54`.

```ts
// POS supplies:
triggeredBy: req.user?.userId
// service reads:
const { customerIds, locationId, actorId, triggerSource = "POS_MANUAL" } = options;
```

`triggeredBy` is ignored, losing staff attribution; dynamic require avoids a typed mismatch. It does not change amount or count.

Canonical queries support customer and location filters. Authenticated HTTP operations also receive Prisma context isolation for Order reads when the context has locationId and role is not SUPER_ADMIN; this **overwrites** the query's locationId. Therefore caller-supplied location does not by itself prove cross-store access. Service/script calls lacking that context rely on passed scope. Custom template and flow paths accept arbitrary phone numbers and never resolve customer/store ownership. Cooldown is keyed by customer ID globally, not normalized recipient phone; multiple customer records sharing a phone may each pass canonical claims. This is a structural risk requiring duplicate-phone data evidence before attributing it to this customer.

### F10 — shared fallback credential and multiple deployment candidates

Locations: `mbg-whatsapp.provider.ts:12,20–24`; `server/src/scripts/verifyStagingMessaging.ts:30–32`; `.github/workflows/deploy.yml:3–5,35–40`; `.github/workflows/deploy-aws-prod.yml:3–8`; `ecosystem.config.js:19–20`.

Provider and staging verifier share a hardcoded fallback API credential; its value is intentionally omitted here. Missing environment configuration can therefore use the same provider account from another environment. This is evidence of possible shared identity, not evidence another environment sent these messages.

Both AWS/Docker and VPS/PM2 deployment workflows trigger on main pushes. PM2's configured server entrypoint is `dist/index.js`; npm starts `dist/src/index.js`. The former file is absent in this local checkout. Historical stale output or another PM2 deployment must be inventoried rather than inferred. Compose variants configure the older `/v1/whatsapp/send_templet` endpoint, whereas the adapter defaults to `/api/whatsapp/send_meta_templet`; runtime overrides determine the actual contract. The bundled `mbg card.json` describes the former endpoint with `senderId`, while this adapter submits `to`. Verify actual URL and accepted payload in provider records before proposing a contract change.

## 3. Calculation review and the disputed values

`server/src/services/dueCalculationService.ts:76–102` counts positive payment records with SUCCESS/COMPLETED/PAID status or legacy null/empty status, excluding CREDIT and explicitly unsuccessful/refunded records. `:132–203` excludes canceled/failed, isPaid, and settled orders; remaining due is max(0, total minus valid payments), using Decimal arithmetic and a small settlement threshold. `:210–246` sums only eligible positive order dues and counts that same eligible list. `:253–265` builds customer/location filters. This path reads orders/payments, not a frontend total or cached customer balance.

Relevant mapper code (`template-mapper.ts:154–160`):

```ts
templateName: "payment_due_reminder",
variables: { body: [customerName || "Customer", invoiceLabel, `₹${formattedDue}`, dueTiming] }
```

No production literal `3807.20` or `All Dues (9 Bills)` was found in the searched source. The matching test fixture is `server/src/tests/messagingReplacement.test.ts:143–146`, a pure mapper assertion with **three bills**, also present in compiled tests. It has no send operation at that assertion and is not imported by the production entrypoint. No execution evidence links it to production messaging.

The custom path can reproduce these values by accepting them; external flow fields/examples/datasets could also supply them. Their historical origin remains unknown. Establish it by retrieving exact submitted variables, the source request/flow run, and its data snapshot. Historical orders/payments, cache snapshots, campaign datasets, alternate database identities, and changes between calculation and submission must be correlated to that source. A coincidental nine-order subset totaling ₹3,807.20 would not alone establish causation.

## 4. Local compiled JavaScript comparison

Compared installed TypeScript `transpileModule` output (ES2016, CommonJS, esModuleInterop, matching tsconfig) byte-for-byte to local `server/dist/src` output. **All 12 files matched exactly:**

- services/dueCalculationService
- services/mbgcard
- modules/messaging/application/reminder.service
- modules/messaging/application/notification-dispatcher.service
- modules/messaging/application/template.service
- modules/messaging/application/notification.service
- modules/messaging/infrastructure/repositories/notification.repository
- modules/messaging/infrastructure/providers/mbg-whatsapp.provider
- controllers/posController
- controllers/paymentController
- controllers/templateController
- controllers/chatHubController

This establishes local emit parity only. It does not identify the live Docker image, deployed SHA, old containers, alternative entrypoints, or what was running at either incident time. Dockerfile compiles TypeScript (`server/Dockerfile:21`); a build recipe is not proof of a deployed build.

## 5. Offline validation evidence and test limitations

Run from repository root:

```sh
node docs/incident-investigation/reminder-probes.cjs
```

Results are saved in `reminder-probes-results.txt`. Six probes passed, exercising the actual service/repository/adapter code with mocked HTTP, Prisma, logger, environment, and timers. They confirm F1/F2, F3, F5, F6, and the two F7 behaviors. The phone, actor, flow, and financial variables are synthetic inputs. No real send, DB query, financial mutation, or provider dashboard action occurs. These probes demonstrate vulnerabilities, not incident reproduction against real data.

Existing `server/src/tests/messagingIntegration.test.ts:45` implements its own `DatabaseBackedReminderStateMachine`; it does not run the actual PostgreSQL row-lock transaction. Its provider retry test is also a simulator. Passing those simulations cannot establish real database concurrency, cross-path cooldown, audit durability, or live provider behavior. No broad npm test run or production-facing verification scripts were necessary for this read-only review.

## 6. Evidence needed to identify origin, repetition, and impact

1. Preserve provider outbound records for the affected recipient, including both disputed deliveries and earlier submissions. Reported delivery times convert to **31 October 2026 17:56 UTC and 18:56 UTC** (23:26 IST and 1 November 00:26 IST). Search submission history beyond that hour and the supplied 17:30–19:30 UTC window: queued/delayed messages may have been submitted much earlier.
2. For each delivery capture provider/Meta message IDs, submission/acceptance/delivery timestamps, sender account/number, template name/language/version, exact body/header variables, API credential identity (masked ID), request/source IP, user agent, request/correlation ID, campaign/broadcast ID, flow run ID/node, schedule ID, and retry/redelivery reason. Two distinct IDs alone are insufficient if provider retry IDs differ; correlate parent requests and submission events.
3. Correlate request metadata to every EC2/VPS/staging process and external integration. Inventory all containers including stopped ones, immutable image IDs/digests, container start times, entrypoints, working directories, mount paths, running Node command lines, PM2 apps, systemd services/timers, all users' cron, Bull repeat/delayed jobs, CI runs, and external automation schedules. Do not print environments, keys, or secrets into the report.
4. Obtain read-only copies/hashes of `/app/dist/src` reminder/dispatcher/template/repository/provider files from **each running and incident-era image**, plus `/app/dist/index.js` where present. Compare against a fresh compile of the exact release SHA; capture image digest and release timestamp. Do not rebuild/restart the live container to collect evidence.
5. Preserve both stdout and `logs/error.log`/`logs/all.log` from containers and bind mounts (`server/src/utils/logger.ts:34–40`). Search for provider submission/retry logs, dispatch audit failures, FK violations involving STORE_ actors, claim-finalization errors, deployment/restart boundaries, and proxy access to all three custom and both flow endpoints. Preserve proxy method/path/status/actor correlation; typical access logs may not contain request variables.
6. Query the correctly identified database read-only for all audit actions and entity types by normalized phone, recipientId, raw/structured variables, provider IDs, claim IDs, and included order IDs. Include WHATSAPP_DUE_REMINDER_CLAIM and SYSTEM/NOTIFICATION_DISPATCH. Verify JSON fields both nested in metadata and top level. Avoid treating duplicate dispatcher/finalizer audits as two sends.
7. Inspect provider flows, contact custom-field histories, campaigns, schedules, imports, template examples, API-key usage, and Easy Collect records without triggering them. Determine whether the two events are two new submissions, provider retry, schedule executions, or redelivery of one original message.
8. Impact: export all provider submissions for the identified source/credential/campaign over its exposure interval. Deduplicate submission/delivery identities, map recipients to scoped customers, compare actual submitted amount/count with authoritative **as-of-send** financial snapshots, and report unique customers, wrong-value sends, repeated submissions, and repeated deliveries separately. Present-day balances alone cannot validate historical messages. Current impact count is unknown.

## 7. Proposed remediation for review — no implementation or deployment performed

- Route payment reminder intent from every HTTP/custom/legacy entry through one authoritative service that resolves customer/store scope and computes dues/count from the database. Reject manually supplied financial variables for this template or translate the request to a scoped canonical reminder. Preserve generic sending for other approved templates.
- Apply the same policy based on actual reminder template/intent, not merely a caller-chosen notificationType. Cover recipient phone aliases and define store/customer cooldown semantics explicitly.
- Introduce a durable outbound intent/outbox with unique attempt identity and atomic recipient claim before contacting the provider. Persist exact financial snapshot, template variables, actor, source, and deployment identity. Use provider-supported idempotency where available; otherwise retain ambiguous outcomes for reconciliation rather than blind retry. A database transaction alone cannot guarantee exactly-once delivery across an external HTTP provider.
- Make audit persistence failures operationally visible. Normalize virtual actors safely while preserving their location/session identity in metadata; fix POS `triggeredBy` to `actorId`. Persist acceptance and claim state consistently, preserve intent metadata, and reconcile stuck/unknown attempts before allowing another send.
- Make standalone cooldown errors fail closed and query accepted outcomes explicitly, separating failed/rejected attempts from cooldown state. Validate provider business-response semantics against the actual endpoint contract.
- Audit every flow trigger, including actor, flow definition/version, supplied fields, and request receipt. Inventory flows capable of financial messages and ensure they consume verified immutable financial payloads/central policy. Restrict only the offending flow/campaign/credential once evidence identifies it.
- Remove shared credential fallback through a reviewed configuration change; require explicit per-environment identities and isolate staging sends. Preserve key-usage evidence before rotation/revocation.
- Alert on accepted-without-durable-receipt, audit insertion errors, ambiguous sends, failed claim finalization, and repeated financial submissions inside the cooldown. Include structured request/attempt IDs and image/release identity; redact credentials and minimize customer data.

Verification required before deploying any remedy: actual service/controller tests for all custom and flow surfaces; real PostgreSQL multi-process claim races; provider accept-then-timeout and crash-before-audit recovery; virtual STORE_ actor handling; HTTP 200 rejection handling; settled/canceled/partial/refunded/legacy payment eligibility; duplicate-phone and store scoping; one-hour repeat suppression and intended 24-hour expiry; reconciliation of unknown outcomes. Add the incident-specific regression only after its originating path is proven.

## Closure assessment

- Which system sent the two disputed reminders? **Unproven.**
- Where did nine bills and ₹3,807.20 come from? **Unproven.** Caller variables and external flow fields are viable sources, not attribution.
- Why one hour apart? **Unproven.** No one-hour reminder scheduler was found in this checkout. Provider submission/delivery histories are required.
- How many customers? **Unknown.** Provider export and historical financial snapshots are required.
- What prevents the identified incident from recurring? **No incident-specific fix can yet be verified.** The proposed controls close confirmed code gaps; the incident remains open pending provider/runtime evidence and regression validation.
