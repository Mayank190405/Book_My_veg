# Workstream 2 — cart, wishlist, checkout and payment contracts

Source audit: 28 October 2026. This is a source-verified inventory, not a live API certification. No requests, payments, database writes or application changes were performed. Paths below are repository relative; line references identify the inspected source. No applicable AGENTS.md was found in this repository or its parent paths.

## Route coverage and existing consumers

- `/wishlist`: `client/src/app/(app)/wishlist/page.tsx:12`; reads the persisted Zustand wishlist and uses the shared cart store to add products. No wishlist HTTP contract exists in this consumer. `client/src/store/useWishlistStore.ts:4` defines product snapshots, product-ID membership and `wishlist-storage` persistence. Cross-device persistence and variant-aware membership are not established.
- `/cart`: `client/src/app/(app)/cart/page.tsx:36`; consumes `useCartStore`, coupon actions and recommendation product services. Delivery fee, total and savings currently derive locally at lines 74–76.
- `/checkout`: `client/src/app/(app)/checkout/page.tsx:27`; shared cart store, address query (`["addresses"]`, lines 85–88), payment eligibility (69), order creation (109), payment link (135), Easebuzz iframe or redirect. Submission button is disabled during loading/eligibility loading (706). There is no demonstrated request idempotency key.
- `/payment-flow`: existing informational technical documentation, not a payment state machine (`client/src/app/(app)/payment-flow/page.tsx:111`, 203–239). Its prose describing order/payment behavior must not be treated as an API contract.
- `/payment/success`: status lookup and verification (`client/src/app/(app)/payment/success/page.tsx:63–116`). Resolves query order ID or `last_order_id`, polls every three seconds and clears local cart on its success predicate.

## Transport and authentication

All paths use `/api/v1` mounts, verified in `server/src/index.ts:121–129`. The client base is same-origin `/api/v1` on HTTPS/Book My Veg hosts, otherwise environment URL or port 5001 (`client/src/services/api.ts:4–25`). Axios sends credentials and adds the persisted bearer token (29–40).

Protected routes require `Authorization: Bearer <token>`; middleware verifies JWT and an existing user/location session and returns 401 `{message}` for missing, invalid or deleted sessions (`server/src/middleware/auth.ts:15–57`). Cookie credentials alone are not the demonstrated server authentication contract. The client refresh interceptor queues concurrent 401s, posts `/auth/refresh` with refresh-token body/header, then replays original requests (`client/src/services/api.ts:58–125`). This also applies to POST requests; financial replay safety requires a separate approved decision.

The examined cart/payment adapters expose raw Axios responses, without response schema validation, cancellation signals, query caching or automatic data invalidation. No pagination applies to the cart, coupon, eligibility, link, verify or status endpoints. No explicit HTTP cache policy is set inside the inspected handlers; reverse proxy/runtime cache behavior was not verified. Personal financial data must not enter a shared cache.

## Verified endpoint contracts

### GET `/cart`

Bearer required. No body/query. Returns a Prisma Cart object with `items[]`, each including full `product` and `variant`; creates an empty cart if absent. Items ordered newest first. Errors: 401 unauthorized; 500 `{message:"Error fetching cart"}`. Sources: `server/src/routes/cartRoutes.ts:7–11`, `server/src/controllers/cartController.ts:88–116`; consumer adapter `client/src/services/cartService.ts:8`. No bill totals or delivery policy are returned.

### POST `/cart/sync`

Bearer required. Body `{items:[{productId,variantId?,quantity,metadata?}]}`. Non-array items become `[]`; invalid product IDs are skipped, variant existence is checked but its ownership by the product is not demonstrated. Upserts supplied rows; absent rows are not deleted. Returns Cart with nested product/variant items. Errors: 401, 500 `{message:"Error syncing cart"}`. Sources: cart routes 9; cart controller 11–85. `useCartStore.syncWithBackend` sends local rows and merges returned rows (149–176); this is merge behavior, not replacement. Server metadata can return even though sync request mapping omits local metadata.

### POST `/cart/update`

Bearer required. Body `{productId,variantId?,quantity,metadata?}`; product ID required. `quantity <= 0` removes matching rows; otherwise upsert. Returns updated Cart with nested product/variant. Errors: 400 missing product ID, 404 missing product registry entry, 401, 500 update failure. No complete quantity/body Zod validation is installed on this route. Sources: cart routes 11; cart controller 119–184; adapter `client/src/services/cartService.ts:21`. Store add/remove/update actions optimistically mutate totals, await the adapter but ignore returned canonical rows, log most errors and do not roll back (`client/src/store/useCartStore.ts:41–127`).

### POST `/coupons/validate`

Public route; bearer not required by route middleware (`server/src/routes/couponRoutes.ts:9`). Body accepts `{code,orderAmount,paymentMethod?,pincode?}` (`server/src/controllers/couponController.ts:143–151`); current cart adapter sends only code/orderAmount. Returns `{isValid:true,code,discountAmount,description,couponId,type,rewardProductId,specialPrice}` (198–207). Missing code returns 400; coupon validation throws status code or defaults to 400 with `{message}` (210). Existing consumer: cart store `applyCoupon` (132–144); stores discount locally. Coupon eligibility is rechecked during order creation, but the amount basis is inconsistent below.

### GET `/payments/eligibility?amount=<number>`

Bearer required. Amount parsed via `parseFloat(...) || 0`. Returns `{codAllowed,reasons:string[],onlineAllowed,nextOrderIndex,advanceAmount,codAmount}`; 401 and 500 `{message}`. Sources: `server/src/routes/paymentRoutes.ts:26–34`; `server/src/controllers/paymentController.ts:1731–1743`; `server/src/services/paymentEligibilityService.ts:3–11`, 46–132. Actual current policy derives from delivered orders since cancellation/failure/return and returns onlineAllowed true. This documents existing behavior only; the redesigned frontend must consume it, not reimplement it. Checkout makes this request on its payment step using locally computed grandTotal (checkout 65–82).

### POST `/orders`

Bearer required. Rate limit 50/hour; `createOrderSchema` installed (`server/src/routes/orderRoutes.ts:61`). Required body: `items` nonempty array with `{productId:string,quantity:number>0,price?:number>=0|null,variantId?:string|null}`, `totalAmount:number>=0`. Optional nullable fields: paymentMethod; address object containing fullAddress/landmark/type/city/state/pincode/name/phone/locationId; deliverySlot, deliveryDate, couponCode, deliveryCharge>=0, locationId, notes. Source: `server/src/schemas/orderSchemas.ts:3–43`. Payment method is a string rather than an enum in the schema.

Returns 201 raw created order (`server/src/controllers/orderController.ts:102–122`; order service creates order/items/payment records). Authentication 401; validation failures use validation middleware; rate limit errors use rate limiter; service failures go through central handler `{status:"error",statusCode,message}` (`server/src/middleware/errorHandler.ts:5–35`). Slot-capacity errors and inventory errors originate in services; not every service error maps to a stable customer-safe error code. No endpoint-level idempotency header/key is established by these files. Source consumer: `client/src/services/orderService.ts:3–6`, checkout 109–128. Preserve request compatibility; do not create another independent checkout endpoint.

### POST `/payments/:orderId/generate-link`

Bearer required. Path orderId. Existing checkout sends an empty body. Handler additionally accepts amount in body/query on Easebuzz branch. Returns either `{iframe:true,key,accessKey,env,amount}`, `{paymentLink,amount}`, or `{paymentLink}`. Errors 404 order absent, 400 already-paid predicate, 500 general failure. Sources: payment routes 35; payment controller 323–455. Link destination depends on environment gateway configuration and can currently fall back to `/payment/mock-gateway`. No environment restriction is visible in these fallback branches. The handler fetches order by ID without a customer ownership predicate; remediation belongs to separately authorized backend work.

### POST `/payments/verify`

Bearer required. Main body `{order_id,status?,amount?,txn_id?}` with additional phone/userId and gateway metadata used by special dues/settlement flows. Identifier normalization/resolution supports multiple transaction types. Returns 200 `{status:"SUCCESS",message}` for completed or gateway-verified branches; 202 `{status:"PENDING",message}` for pending gateway verification; 400 failed/declined branches; 404 order absent; 500 verification failure. Sources: payment controller 1222–1467. No response schema guard installed at route. Existing success page spreads all redirect parameters into its request after initial order/status fields (97–101), so redirect data can overwrite those initial properties. Frontend redesign must not add another verification path or retry posting blindly.

### GET `/payments/order-status/:orderId`

Bearer required, order lookup scoped to authenticated user. No body. Returns `{id,status,paymentStatus,totalAmount,createdAt}`; 404 absent/not owned; 500 lookup failure. Sources: payment routes 37; payment controller 1205–1219. This narrow response omits amount paid, outstanding balance, individual payments and refund details; partial-payment presentation cannot safely infer those values from totalAmount/status. Existing success page polls this endpoint without cancellation/backoff or a bounded delayed-verification transition.

### POST `/payments/initiate` (compatibility only)

Bearer required; accepts `{amount,address,items,locationId?}`, creates pending order and returns gateway handoff including order ID/link depending on provider. Errors 401 missing auth, 404 missing user, 400 no active store, 409 inventory conflict, 500 generic. Sources: payment controller 176–321. Current checkout instead uses POST `/orders` then generate-link. Do not switch flows during a visual redesign without explicit contract approval.

## Financial and consistency gaps requiring decisions

1. **Order confirmation currently triggers payment success.** Success page line 76 accepts `dbStatus === "CONFIRMED"` even if paymentStatus is pending/partial, then clears cart and celebrates. A confirmed COD order is not evidence of full payment. Frontend correction is within a future approved presentation scope; backend verification remains separately gated.
2. **Verification can fabricate gateway completion.** Payment controller 1406–1416 and 1426–1441 fall back to mock completion after external gateway status failure; 1304 onward also handles client-supplied status. This prevents treating the current verify response as sufficient evidence that the payment integration is production ready. Do not fix or exercise these branches in this workstream.
3. **Client submits financial inputs and server reuses them.** Cart 74–76 and checkout 30–34 hardcode ₹249/₹40 delivery policy and local totals. Checkout sends local price/total/deliveryCharge (119–127). Order service 78–84 uses supplied nonzero price; 130–135 permits submitted deliveryCharge and computes finalOrderAmount from submitted totalAmount. A backend-authoritative quote contract was not found in these consumers/routes. A frontend-only replacement cannot guarantee authoritative amounts.
4. **Possible double coupon subtraction.** Checkout's grandTotal already subtracts local discount and sends couponCode; order service 112–135 validates coupon and subtracts discountAmount again from submitted totalAmount. Document and resolve amount semantics with the financial owner before checkout redesign approval.
5. **Optimistic rollback is absent.** Cart writes keep changed local state after network failure and ignore canonical response. Local clearCart does not delete server cart (store 130), and sync merges omitted rows rather than deleting them. New layout must retain one store while an approved cart-contract change addresses consistency.
6. **Link/verify ownership and mock restrictions need backend review.** generate-link fetches by ID; verify resolves order globally. Protected routing alone does not establish resource ownership. Existing mock fallback is not visibly production-gated in the inspected controller. No new financial behavior is authorized.
7. **Eligibility and quote coupling are incomplete.** Eligibility uses amount supplied by browser; onlineAllowed is not a gateway-channel availability catalog. Nested payment-channel visuals or delivery estimates must not be presented as supported solely from static frontend markup (checkout 411–414, 528 onward).

## Proposed presentation contract for approval

Keep Zustand cart as the sole cart source; distinguish local provisional totals from authoritative server amounts. Show no invented savings/delivery threshold. Use one pending action per cart row, canonical reconciliation and rollback with an accessible announcement after approval. Checkout must stop on unavailable eligibility/quote data. Payment presentation states: initiating, redirecting, awaiting verification, delayed, confirmed, failed, cancelled. A confirmed order can show “Order placed”; only verified payment evidence may show “Payment confirmed.” Missing ID, network errors, timeout and partial payments stay pending/error with a View Order/support action. No new financial endpoint or verification algorithm is proposed here.

Before implementation, financial owners must confirm authoritative quote/amount semantics, accepted paid/partial statuses, idempotency/retry policy, ownership enforcement and server-only mock gating. Reuse existing services after decisions; no backend modification is included in this report.
