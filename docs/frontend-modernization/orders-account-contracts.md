# Orders, account and compatibility contract inventory

Source review: 28 October 2026. This is a source-verified inventory, not a live API certification. No production requests, payment simulations, database writes or application edits were performed. No applicable AGENTS.md was found in the repository. All paths below are repository-relative; line numbers refer to the reviewed working tree.

## Common transport and authentication

The API mount is `/api/v1` (`server/src/index.ts:117–130`). `client/src/services/api.ts:4–43` selects same-origin `/api/v1` under HTTPS, otherwise configured/local port 5001, sends credentials and injects a Bearer token from Zustand. Its response interceptor refreshes and replays a request once after a 401, using refresh token body plus `x-refresh-token` (`api.ts:65–130`). Do not replace this behavior in a visual redesign or add automatic mutation retries.

`server/src/middleware/auth.ts:15–58` requires a Bearer access token, verifies JWT and verifies that the corresponding user/location still exists; missing, invalid or invalidated sessions return 401 with `message`. No endpoint-specific cache headers or request cancellation are set in the reviewed order/address/profile services. React Query owns in-memory query state on the pages; live HTTP cache behavior has not been measured.

## Customer order endpoints

### GET `/api/v1/orders`

- Authenticated; scope is the authenticated user's ID. No body. Query `cursor?: string`, `limit?: number`, default 10 and maximum 50. Negative limits are not explicitly rejected.
- Returns `{data: Order[], nextCursor: string|null}`; each order includes `items[].product`, `location`, `payments`. Sorted by `createdAt desc`; cursor is order ID and the next page skips the cursor row. Returns 500 `{message:"Error fetching orders"}`, plus shared 401.
- Evidence: `server/src/routes/orderRoutes.ts:34,62`; `server/src/controllers/orderController.ts:126–156`.
- Consumer: `client/src/services/orderService.ts:8–11`; `client/src/app/(app)/orders/page.tsx:265–278` uses query key `["orders"]`, filters the loaded page locally and does not send/consume a cursor. A redesign must expose subsequent pages before claiming complete order history.

### GET `/api/v1/orders/:id`

- Authenticated. Path `id`; no body or pagination. For role `USER`, query is `{id,userId}`; other roles use `{id}`.
- Returns a raw order object with `user {id,name,phone,email,totalDue}`, `items[].product`, ascending `statusHistory`, `payments`, `deliveryPartner {id,name,phone}`, `packer {id,name,phone}`, `location`. No dedicated live driver location or ETA field is supplied by this controller.
- 404 `{message:"Order not found"}`; 500 `{message:"Error fetching order detail"}`; shared 401.
- Evidence: `server/src/controllers/orderController.ts:162–187`, `server/src/routes/orderRoutes.ts:73`.
- Consumer: service `orderService.ts:13–16`, detail page query `["order",id]` (`client/src/app/(app)/orders/[id]/page.tsx:59–63`). The page subscribes to `order_status_updated` and invalidates that key (`:175–190`); a repository search did not locate a server emitter using that exact event name. Confirm socket protocol before promising real-time tracking.

### POST `/api/v1/orders/:id/cancel`

- Authenticated; body `{remark?: string}`; service maps optional reason to `remark`. Controller defaults remark by caller role, delegates to order service, returns `{message:"Order cancelled successfully"}`. Errors pass to shared error middleware rather than a stable endpoint-specific error enum.
- Evidence: `server/src/routes/orderRoutes.ts:70`, `server/src/controllers/orderController.ts:192–205`, `client/src/services/orderService.ts:18–21`.
- Critical mismatch: route comment says state-machine guarded, but actual `orderService.cancelOrder` (`server/src/services/orderService.ts:285–324`) fetches only by ID, restores inventory and changes status without an ownership check or transition check in this method. `_isAdmin` is unused. Do not infer backend authorization from the UI's cancel visibility. Backend remediation needs separate ownership.
- Detail page cancellation invalidates only `["order",id]` (`page.tsx:192–204`); it should also invalidate order history during approved implementation.

## Order response schema and truthful tracking

`server/prisma/schema.prisma:277–334` defines `id,userId,totalAmount,status,paymentStatus,shippingAddress,deliveryDate?,deliverySlot?,discountAmount,taxAmount,deliveryCharge,isPaid,createdAt,updatedAt,cashCollected,easebuzzCollected,deliveredAt?`, assignment IDs and optional packing/delivery metadata. Decimal database values must be normalized deliberately; do not assume all raw order endpoint amounts are JSON numbers. `OrderItem` (`:337–357`) includes decimal quantity and sellingPrice, optional variantId and product relation; current detail fetch does not include the variant relation. `OrderStatusHistory` (`:360–367`) supplies actual `status,remark?,changedBy?,createdAt`. `Payment` begins at `:372`, with `amount,method,transactionId?,status`.

Supported order enum is `PENDING, PAYMENT_PENDING, CONFIRMED, PROCESSING, PACKED, SHIPPED, OUT_FOR_DELIVERY, DELIVERED, CANCELLED, RETURNED, FAILED` (`schema.prisma:768–780`). `paymentStatus` is a free string, not this order enum. Retain separate delivery/payment states and do not equate delivered with paid.

Current presentation conflicts with the requested truthfulness rules:

- Detail page `MOCK_STEPS` contains fixed `10:05 AM` and `10:20 AM` and marks preceding steps completed by index (`client/src/app/(app)/orders/[id]/page.tsx:32–47,315–352`), although actual history exists.
- Detail map substitutes hardcoded store and customer coordinates (`:65–69`) and renders the map without a verified tracking contract (`:359–363`). Omit this in the proposed design until verified tracking exists.
- Order history `parseExpectedDate` uses creation time plus 24 hours when deliveryDate is absent (`client/src/app/(app)/orders/page.tsx:253–255`). This must become an unavailable ETA state, not a delivery promise.
- The UI maps `REFUNDED` to `EXCHANGED`, although `REFUNDED` is absent from the order enum (`detail page:294`, list `:416`). Refund and exchange semantics need a backend contract decision.

## Address endpoints

All are authenticated through `server/src/routes/addressRoutes.ts:7–12`; there is no route-level schema validator. `client/src/services/addressService.ts:3–16` declares `Address`: `id,type,fullAddress,isDefault` plus optional landmark/city/state/pincode/name/phone/latitude/longitude.

### GET `/api/v1/addresses`

No request body, no pagination. Returns raw `Address[]` scoped by user, default first. 500 `{message:"Error fetching addresses"}` and 401. Controller evidence `server/src/controllers/addressController.ts:11–23`.

### POST `/api/v1/addresses`

Body accepts `type,fullAddress,landmark?,city?,state?,pincode?,name?,phone?,latitude?,longitude?,isDefault?`. Database requires fullAddress, defaults type HOME/isDefault false (`schema.prisma:56–73`). Sets tag from type and clears other defaults if requested; returns 201 raw Address. 500 `{message:"Error creating address"}` and 401. Controller `:26–76`. There is no explicit 400 validation contract, and clearing defaults plus creation is not transactional.

### PUT `/api/v1/addresses/:id`

Same fields, client accepts Partial<Address>. Update scope includes both ID and userId. Returns raw Address; 500 `{message:"Error updating address"}` including missing/not-owned records, plus 401. Clears other defaults first when requested; a missing `type` can set `tag` to Office because of the controller's ternary. Evidence `addressController.ts:79–127`. Default selection uses this update, not a separate endpoint.

### DELETE `/api/v1/addresses/:id`

No body; scoped by ID/userId. Returns `{message:"Address deleted"}`, errors 500 `{message:"Error deleting address"}`, plus 401. No automatic replacement default contract. Evidence `addressController.ts:130–143`.

Consumers: addresses page query `["addresses"]`, delete mutation invalidates it (`client/src/app/(app)/account/addresses/page.tsx:54–65`); shared AddressForm creates/updates then invalidates it (`client/src/components/features/AddressForm.tsx:209–221`). Retain the existing selected address source in the shared user/cart flow rather than introducing a parallel store. Test deletion/default address consistency and server validation failures after approval.

## Profile and session contracts

### GET `/api/v1/auth/me`

Authenticated; no body/pagination. Returns a flat profile `{id,phone,name,email,role,locationId,accountBalance:number,trustScore,ordersSummary:{totalOrders,onlineOrders,offlineOrders}}`. 404 user not found; 500 error fetching profile; shared 401. Evidence `server/src/controllers/authController.ts:515–555`, route `authRoutes.ts:18`.

There are duplicate `getMe` wrappers: `userService.ts:3–6` returns response data; `authService.ts:92–105` updates Zustand only if `response.data.user` exists. The actual response is flat. Preserve and resolve this shape mismatch explicitly during approved integration; do not silently assume a nested user. Account reads the existing Zustand user (`client/src/app/(app)/account/page.tsx:41`).

### PUT `/api/v1/users/profile`

Authenticated; validated body `{name?: string(min2),email?: validEmail|""}`. Returns `{id,name,email,phone,role}`. 409 email already in use; 500 error updating profile; schema validation errors plus shared 401. Evidence `server/src/routes/userRoutes.ts:10`, `server/src/schemas/authSchemas.ts:17–22`, `server/src/controllers/userController.ts:10–44`. `ProfileEditForm.tsx:22–33` merges response into Zustand. No pagination/cache.

### Authentication compatibility

Public POST `/auth/send-otp` `{phone:10 digits}`; POST `/auth/verify-otp` `{phone:10 digits,otp:6 chars}`; POST `/auth/login` `{phone,password}`; POST `/auth/whatsapp-check` `{phone,token:min10}`. Rate limited by router. OTP login returns `{user,accessToken,refreshToken}` (`authController.ts:134`); WhatsApp check can return `{verified:false,message}` while pending, and returns verified/user/tokens when completed (`:212–245`). POST `/auth/refresh` accepts stored refresh token, returns accessToken/refreshToken/user, 401 missing/user not found and 403 invalid token (`:297–355`). POST `/auth/logout` returns `{message:"Logged out successfully"}` (`:359–362`). Schema evidence `authSchemas.ts:3–15,25–30`; routes `authRoutes.ts:10–18`. Client auth service persists tokens/user. Account currently calls the store's local logout and navigates home (`account/page.tsx:109–111`), whereas authService.logout also invokes server logout; session behavior must be reviewed without broad redesign changes.

## Test-only mock gateway review

`/payment/mock-gateway` exists as a client page under `(app)`. It reads orderId and amount from query parameters, posts `/payments/verify` `{order_id,status:"CHARGED"|"FAILED",amount}` and navigates to success with query status even if verification throws (`client/src/app/(app)/payment/mock-gateway/page.tsx:16–39`). There is no environment check in this page.

Server `paymentController.ts:1405–1443` contains gateway-error fallback branches that invoke completion with MOCK_TXN / MOCK_ONLINE and can return SUCCESS; the inspected branches have no NODE_ENV restriction. Controller also returns mock-gateway links when gateway initiation fails (`:274–305,409–445`). This fails the specification's test-only server-enforcement requirement. Treat remediation as a separate financial/security approval dependency; do not cosmetically certify this route safe. Do not exercise these endpoints for the audit.

## Related route compatibility

- `/login`: retain OTP, WhatsApp and password entry and persisted user/token semantics (`client/src/app/login/page.tsx`, `services/authService.ts`). No visual redesign is included here.
- `/onboard`: posts public `/api/v1/pay/onboard` `{name,phone,email,address}` (`client/src/app/onboard/page.tsx:53`). Required name/phone; normalizes phone to exactly ten digits; existing/new customer returns 200/201 `{message,customer}`; validation 400, errors shared middleware. Evidence `server/src/routes/payRoutes.ts:11`, `paymentController.ts:2149–2223`. It can update existing customer data, so preserve only within separately reviewed scope.
- `/feedback`: POST public `/api/v1/pay/order-feedback` `{orderId,rating,feedback}` (`client/src/app/feedback/page.tsx:119`); requires order ID and rating 1–5, 404 missing order, returns `{message,order,googleReviewUrl}` (`paymentController.ts:2226–2283`); also GET `/page-content/google-review-link` (`feedback/page.tsx:54`). Feedback marks other orders for the same customer feedbackSent; do not change this side effect during styling.
- Actual invoice route is `/invoice/[id]`, not a standalone `/invoice` page in the source listing. It GETs public `/api/v1/pay/pay-info?billid=:id` (`client/src/app/invoice/[id]/page.tsx:24`). Shared bill contract accepts userid/userId/user_id, number/phone/mobile, billid/billId/orderid/orderId/order_id/id. Requires at least one; 400 if absent, 500 fetch failure; response `{customer:{id,name,phone,email}|null,bill,unpaidOrders,totalDue}`. Evidence `paymentController.ts:1748–1870`.
- `/pay`, `/pay/[...slug]`, `/pay/login` share PayPage; login passes `forceShowOtpForm`, slug wrapper passes slugParams. PayPage fetches `/pay/pay-info` (`:128`), POSTs `/pay/pay-due` (`:179`) and `/pay/verify` (`:225`). Routes are public (`server/src/routes/payRoutes.ts:8–12`); payment implementation belongs to separate financial scope. Preserve links/query parameters and callbacks; do not independently infer payment success.
- Staff `/admin`, `/driver`, `/packer`, `/pos` remain outside visual redesign. Shared order/auth primitives are also staff consumers, so changes to API clients, status adapters and stores require regression review without editing staff interfaces.

## Review requirements before implementation

Approve timeline-only real history, omit absent ETA/driver/map, preserve backend monetary values, add real pagination and distinct error/empty states. Resolve cancellation authorization, mock fallback restrictions and payment certainty with the separately authorized backend team. Validate real response samples and documented error envelopes in a sandbox before declaring runtime compatibility; the above establishes source behavior only.
