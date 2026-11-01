# Hourly reminders: provider evidence and historical sender investigation

## Current conclusion

**All five reported pairs are verified in authenticated MBG conversation history.** Each pair has two different WhatsApp message IDs and separate OUTGOING provider records approximately one hour apart. All five use the same Book My Veg WhatsApp account.

**A specific historical sender implementation now matches the observed behavior:** `server/src/services/paymentReminderWorker.ts` and `server/src/services/mbgcard.ts` at commit `ffe60f9ddf7bec798f4c0ecca2065eab4d90ccab` (3 October 2026), before the 14 October worker fix. It runs hourly, checks a two-hour eligibility window, has no reminder cooldown/audit, sums JavaScript numbers without rounding, and constructs the same legacy payment-link form.

**The executing server/container and source database are not yet identified.** The implementation is a strongly supported lead, not a confirmed incident origin. Provider history supplies message identities/payloads, but not the originating API credential, source IP, ingress request time, campaign attribution, or executing release. No production changes were made.

This addendum supersedes the earlier report's lack of provider evidence and its current-checkout-only scheduler search. Historical code was not included in that first sender inventory; it is now included below.

## Verified five-customer correlation

Source: authenticated `GET /api/inbox/get_chats` and read-only `POST /api/inbox/get_convo?page=1&size=100` on `https://chatbotbe.digitalmbg.com`. Full message IDs, exact variables, timestamps and context are preserved in `provider-reminder-evidence-2026-11-01.json` in this directory. Only payment-reminder messages from the five relevant conversations were retained there; credentials were excluded.

Common outbound account:

- Internal account: `sa_1778840075442_mlbyphmes`.
- Display sender: Book my veg, `+91 83808 33633`.
- WhatsApp phone-number ID: `946891318515104`.
- Social account/WABA field returned by provider: `1584781019502734`.

This establishes the same WhatsApp sending account, **not necessarily the same calling application or credential**.

1. **Kabir**, provider profile “Sable Sir Daji”, payload name “kabir sir”, chat ID `531242`.
   - 1 Nov 2026, 11:26:48.336 IST / 05:56:48.336 UTC: record `44240667`.
   - 1 Nov 2026, 12:26:51.589 IST / 06:56:51.589 UTC: record `44303613`.
   - Both: `All Dues (2 Bills)`, exact submitted amount **`₹3070.8`**. Delta: 3603.253 seconds.
2. **Arati Kapoor**, provider profile “Aarti kapoor”, chat ID `1824129`.
   - 1 Nov 2026, 09:26:48.605 IST / 03:56:48.605 UTC: record `44220155`.
   - 1 Nov 2026, 10:26:48.434 IST / 04:56:48.434 UTC: record `44229880`.
   - Both: invoice `BMV22DVAY008XC8`, exact submitted amount **`₹70`**. Delta: 3599.829 seconds.
   - The payment link contains **`&billid=BMV22DVAY008XC8`**, a useful old-adapter fingerprint.
3. **Aniruddha Sable**, provider profile “Aniruddha”, chat ID `432619`.
   - 31 Oct 2026, 23:26:48.855 IST / 17:56:48.855 UTC: record `44190860`.
   - 1 Nov 2026, 00:26:48.570 IST / 31 Oct 18:56:48.570 UTC: record `44194050`.
   - Both: `All Dues (9 Bills)`, exact submitted amount **`₹3807.2`**. Delta: 3599.715 seconds.
4. **Mavshi Housekeeping**, provider profile is the contact phone number, chat ID `3931818`.
   - 31 Oct 2026, 21:26:50.458 IST / 15:56:50.458 UTC: record `44182598`.
   - 31 Oct 2026, 22:26:49.641 IST / 16:56:49.641 UTC: record `44186739`.
   - Both: `All Dues (8 Bills)`, **`₹886.9100000000001`**. Delta: 3599.183 seconds.
5. **Amol Ahirao**, chat ID `529975`.
   - 31 Oct 2026, 21:26:48.625 IST / 15:56:48.625 UTC: record `44182593`.
   - 31 Oct 2026, 22:26:48.745 IST / 16:56:48.745 UTC: record `44186737`.
   - Both: `All Dues (3 Bills)`, **`₹449.16999999999996`**. Delta: 3600.120 seconds.

Aniruddha's disputed provider message IDs are:

```text
17:56:48.855Z  wamid.HBgMOTE5ODkyNzg5MjE5FQIAERgUQ0UxNEUwMEFGNzVFMEE0OEFENkUA
18:56:48.570Z  wamid.HBgMOTE5ODkyNzg5MjE5FQIAERgUQ0UzQjg4RUMxRUI1MDk3ODhCNjMA
```

These are different outbound message entities. A single message ID being displayed/redelivered twice cannot alone explain these records. However, conversation `createdAt`/`timestamp` is not an ingress submission log: separate queued submissions, provider retries that create new messages, or newly submitted API calls still require ingress/job evidence to distinguish. The returned recent status is `pending`, so this API snapshot does not independently validate delivery times or delivery receipts.

### Direct contrast with the verified manual reminder

Aniruddha record `44170489` at **31 Oct 14:21:05.144 UTC / 19:51:05.144 IST** contains `All Dues (6 Bills) / ₹8961.25`, corroborating the supplied incident's accepted audit timestamp. Its payment-link number includes country code (`919892789219`); both disputed messages use the local 10-digit form. All three carry the same customer UUID in the payment link.

Mavshi has another conflicting provider record: `44170498`, 31 Oct 14:21:09.082 UTC, **32 bills / ₹13505.61**, followed later by the eight-bill / raw-decimal pair. This independently shows conflicting aggregate datasets are affecting more than Aniruddha. The 32-bill balance itself was not checked against the database here.

The first 100 retrieved messages per conversation include older identical payloads. Earliest *retrieved* exact latest-payload matches: Kabir 11 Oct, Arati 6 Oct, Aniruddha 12 Oct, Mavshi 12 Oct, Amol 10 Oct. These are not the first-ever occurrences; pagination is incomplete. Arati additionally has the same 09:26/10:26 pair on 25 October, exactly one week before 1 November, consistent with the old worker's default seven-day cycle.

## Historical implementation matching the evidence

Commit `ffe60f9ddf7bec798f4c0ecca2065eab4d90ccab` is a concrete example of the relevant implementation family, not a proven deployed SHA. It predates the 14 October repair. Preserved snapshots:

- `historical-worker-ffe60f9.txt`: full historical `server/src/services/paymentReminderWorker.ts`; original line numbering is preserved.
- `historical-worker-compiled-ffe60f9.txt`: historical tracked `server/dist/src/services/paymentReminderWorker.js`.
- `historical-mbg-excerpts-ffe60f9.txt`: relevant historical `server/src/services/mbgcard.ts` excerpts with original line numbers; credentials omitted.

Call graph:

```text
server/src/index.ts:210 — startPaymentReminderWorker()
 → paymentReminderWorker.ts:292 — initial check after 15 seconds
 → paymentReminderWorker.ts:293 — setInterval(check, ONE_HOUR_MS)
 → paymentReminderWorker.ts:25–32 — active PAYMENT_REMINDER config
 → paymentReminderWorker.ts:122–129 — global unpaid Order query, take: 200
 → paymentReminderWorker.ts:150–153 — numeric paid/due arithmetic
 → paymentReminderWorker.ts:156–159 — cycle eligibility: remainder < TWO hours
 → paymentReminderWorker.ts:172–175 — customer grouping, totalDue += dueAmount
 → paymentReminderWorker.ts:185–198 — eligible count, All Dues label, send helper
 → mbgcard.ts:310–332 — raw `₹${dueAmount}`, legacy billid link behavior
 → mbgcard.ts:209–235 — payment_due_reminder payload, HTTP POST
 → no payment-reminder audit or cooldown write on this path
```

### Hourly trigger and the two-message window

```ts
// paymentReminderWorker.ts:10,156–159,291–293 at ffe60f9
const ONE_HOUR_MS = 60 * 60 * 1000;
const dueIntervalCycles = Math.floor(ageInMs / dueIntervalMs);
const remainderMs = ageInMs % dueIntervalMs;
const isCycleTrigger = dueIntervalCycles >= 1 && remainderMs < (2 * ONE_HOUR_MS);
setTimeout(runRemindersAndFeedbackCheck, 15000);
setInterval(runRemindersAndFeedbackCheck, ONE_HOUR_MS);
```

Any customer with one order meeting that cycle condition can be selected on two consecutive hourly checks. The default cycle is seven days (`:133–135`), configurable by duration/unit; the customer total includes all qualifying orders in the retrieved subset, not merely the order triggering the cycle. There is no per-customer reminder state check/write on this historical path.

This is **startup-anchored**, not cron fixed to minute 26. A surviving process whose timer began around `:56:48 UTC` naturally continues around `:26:48 IST`. UTC cron searches should include `56 * * * *`, not only `26 * * * *`. A deployment/startup time and process log are needed to prove that alignment.

### Unrounded financial variables and partial dataset

```ts
// paymentReminderWorker.ts:150–153,172–173
const paid = order.payments
  .filter(p => p.status === "SUCCESS" || p.status === "COMPLETED" || p.status === "PAID" || !p.status)
  .reduce((sum, p) => sum + Number(p.amount), 0);
const dueAmount = Math.max(0, Number(order.totalAmount) - paid);
customerUnpaidSummary[uId].orders.push(order);
customerUnpaidSummary[uId].totalDue += dueAmount;
// mbgcard.ts:331–332
return sendTemplateViaChatHub(phone, "payment_due_reminder", {
  body: [customerName, invoiceNo, `₹${dueAmount}`, dueTiming]
});
```

The source is **Order + Payment rows in that process's configured database**, with an unordered global `take: 200`, then customer grouping. This code can truncate customer order sets; it also differs from canonical payment eligibility rules, including not excluding CREDIT method records. These differences can produce divergent totals/counts. They do not establish which actual rows produced nine bills / ₹3807.2: the executing database identity and selected rows remain required evidence. The unchanged customer UUIDs in provider payment links tie the payloads to the same logical customers, not to a specific database deployment.

Raw Number addition followed by interpolation reproduces the exact two decimal tails. The historical helper also preserves 10-digit payment-link numbers and includes billid for a single invoice, matching Arati. The newer canonical mapper calls `formatCurrencyAmount`, uses authoritative eligible dues, and acquires a database-backed claim; it does not match these formatting fingerprints.

### Actual-code offline validation

`node docs/incident-investigation/historical-hourly-probe.cjs` loads the historical worker **and historical MBG helper** directly from Git. HTTP, Prisma, environment loading, logger and timers are replaced with mocks. Two hourly callbacks emitted ten mocked POSTs for five synthetic customers and zero payment-reminder audits. Eight synthetic positive orders produced `₹886.9100000000001`; three produced `₹449.16999999999996`. Outputs are in `historical-hourly-probe-results.txt`.

**Synthetic financial rows were deliberately constructed to test the mechanism. They are not the customers' financial data and do not identify their actual order/payment composition.** This proves the historical execution path is capable of the observed formatting, count labels and repeated sends, not that its binary is running now.

### Repair/removal timeline in Git

- **14 Oct, `5744371`**: replaced the unordered 200-order aggregate with customer queries, added business-hours gating and duplicate suppression. The preceding snapshot has neither gate nor cooldown, making nighttime pairs especially relevant.
- **19 Oct, `3d0c108` / `d96f540` / `da45b46`**: unified calculations, two-decimal helper formatting and stronger claim handling.
- **24 Oct, `b0dbb29`**: removed automated dues sending from the worker; feedback/retention remained.
- **31 Oct, `2b8f3fd`**: removed the legacy worker file/compiled file and startup call during messaging replacement.

A current checkout search misses this deleted sender. A surviving old container, VPS/PM2 process, alternate EC2 instance, historical compiled deployment, or copied script is therefore a priority lead. Git history proves code existence/removal, not deployment or shutdown of prior environments.

## Provider campaigns and flows inspected

Authenticated inventory, preserved in `provider-automation-evidence-2026-11-01.json`:

- `GET /api/automation-rules`: success, empty rule list.
- `GET /api/drip-campaign/get_campaigns`: success, zero campaigns.
- `GET /api/broadcast/get_broadcast`: three total broadcasts, from May/July 2026, none using payment_due_reminder; no current hourly broadcast identified.
- `GET /api/chat_flow/get_mine`: eight flows, including a flow titled **reminder**, ID `flow_1787570675060`.
- Read-only `POST /api/chat_flow/get_by_flow_id` with `flowId`: inspected reminder flow `8899`. It has a payment_due_reminder template node, a catalog-link button node, and one edge from the Pay now action to the button. No delay, loop, or hourly scheduler appears in the returned graph. Its current template parameters include only `{{__contact_name}}`, not the four exact financial values seen in these messages.

The reminder flow's `updatedAt` is **1 Nov 08:00:03.292 UTC**, after the disputed pairs. This snapshot cannot rule out earlier flow versions, removed campaigns, provider-internal jobs or external API callers. The flow name itself is not attribution.

The supplied `/api/logs` route is the dashboard's **error logs** route, as confirmed by its public client API constants. The latest returned entries end on 29 October and are message/template errors. It is not a complete outbound request log; its absence of 31 October events is not evidence that no sends happened.

## Scope, blockers and precise next evidence

Completed: current source and local dist schedule search; local Git history including deleted compiled worker; bounded local project discovery; relevant sender-string searches in Desktop/Documents/Downloads source files; provider inbox inventory (3,758 chats over 19 pages, with unrelated contacts excluded from saved matching evidence); first 100 messages in each affected conversation; current provider rules, campaigns, broadcasts and reminder flow. The connected GitHub installation exposes only `DIU2610/voice-call-ai`, not this repository's `Mayank190405` account, so it cannot inventory all remote application repos/deployments.

Runtime access attempts:

- Found existing `/Users/kradsagency/Downloads/BMV_PROD.pem`; copied temporarily with restricted permissions for SSH without changing the original file.
- Read-only SSH to repository-listed `43.205.177.124` rejected that key for both ec2-user and ubuntu. The initially unrecognized host key was recorded only in a temporary investigation known-hosts file; host identity was not independently verified. No remote command executed.
- Existing AWS credentials returned `AuthFailure` for read-only EC2 DescribeInstances in ap-south-1 and configured eu-north-1. No cloud inventory was obtained.
- Computer Use access to native Chrome is not granted. Authenticated provider API reads supplied the evidence instead.
- Working current host/key/account has been requested. No live process list, container image identity, cron/PM2 inventory, backend request trace, or financial dataset has yet been obtained.

To finish attribution, MBG support/backend operators should resolve **the ten provider message IDs preserved in the evidence file** to ingress request timestamp, source IP, authenticated API credential ID, user-agent, request ID, broadcast/flow/job ID, and queue parent/retry events. The historical helper's expected user-agent is `BookMyVeg-Server/1.0`; the current adapter's is `BookMyVeg-MessagingService/2.0`. Those strings are code fingerprints to search for, **not observed request headers in the retrieved history**.

Then map the IP/credential to the actual server; capture process start time, `node` entrypoint, PM2/systemd/container inventory and image digest; search all old deployment trees for `paymentReminderWorker`, the two-hour cycle expression, `take: 200`, raw dues interpolation and the worker log line. Preserve each process's database identity without printing credentials. Re-run the exact historical SELECT/calculation read-only against a timestamped snapshot to identify the nine actual order IDs, payments and sum. Check whether an old database or old global 200-row subset explains the differences. Do not modify financial data to force a match.

## Cooldown, impact and proposed containment

**Why the 24-hour cooldown may not apply:** the matched historical worker directly invokes the old HTTP helper and has no central reminder claim, reminder audit lookup, or reminder audit insertion. A current application's database cooldown cannot stop a separate old process that never calls it. The current generic custom-template/flow bypasses described in the initial report also remain possible until ingress attribution is obtained.

Confirmed minimum: **five customers, ten distinct outgoing records in the reported repeated pairs**. This is a duplicate-message lower bound, not a complete count of incorrect financial balances. Two customers have verified conflicting payload sets in provider history; authoritative financial validation remains separate. In the first 200 inbox chats, 27 latest-message entries are payment reminders created at UTC minute 56 on the same sender account; that is an investigation cohort only, not 27 proven affected customers or a complete exposure count.

Do not disable the shared WhatsApp account indiscriminately. Once the source process/credential/job is identified, preserve its logs/configuration and stop only its financial reminder execution through an approved change. Replace/retire that sender so all reminder intents use canonical dues calculation, shared cooldown and durable outbound evidence. If a provider job is instead proven responsible, fix/restrict that exact job and its financial dataset rather than changing canonical arithmetic.

**Closure remains open:** provider message identities, common outbound account, exact financial strings, recurring cadence and a matching historical implementation are now established. The executing hourly component, ingress credential/IP, actual financial row source and full impact are still unproven. No fix has been deployed.
