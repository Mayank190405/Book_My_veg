# Design proposal and implementation contracts

Status: proposal for approval; does not authorize application changes.

## Visual direction

Use the supplied primary #087F5B, deep #056647, light #E8F7EF, background #F8FAF8, surface white, text #17251E, secondary #64736B and border #E5EBE7. Orange #FF7A45 is decorative and offer-accent only; pair it with dark text rather than assuming white text passes contrast. Error #C92A2A and warning #B45309 always accompany explanatory text. Font: system sans fallback until approved Inter loading is confirmed; avoid adding remote font requests during approval review.

Mobile headings 24px, section titles 19px, product names 13–14px, body 14px, metadata 12px; desktop headings 32px, section titles 24px, body 16px. Minimum 44px targets; visible focus and semantic headings. Spacing 4/8/12/16/20/24/32/40/48; mobile gutter16, tiny screens12 when needed, grids8–12, cards10–12. Radius8 for controls,16 for cards,20 for hero,24 top corners for sheets. Width max1280–1440.

Home: location → search → photographic editorial hero → categories → supported product collections. Hero conveys discovery without fabricated freshness, delivery or discount guarantees. Category: persistent 72–80px mobile rail, sticky filter row and two-column card grid; desktop rail160–220px with four to six columns. Order detail: verified status → verified ETA only when present → milestone timeline → assigned partner → address → items → validated savings/payment → support. Do not fill missing data with synthetic progress or map coordinates.

320px is the stress frame. Product text wraps, CTA keeps 44px height, pack/price source labels may wrap in the design artifact. At 375–430 use four category columns and two product columns; tablet three/four product columns, desktop four/six based on available space. Real application sticky header/mobile nav/cart/purchase bar share a single offset contract: reserve bottom content space equal to visible stacked controls + safe-area inset; never independently fix several bars at bottom:0. Mobile purchase bar replaces floating cart on product detail; checkout uses its own submission bar. Chat uses keyboard-safe composer and its own header.

## Shared foundation — single maintainer

Retain `client/src/app/(app)` and existing root providers. Do not move routes. Root layout, shell, tokens, primitives, authentication wrappers, API transport and cart interfaces require one nominated lead. Lead changes merge before route owners consume them. Existing working tree changes must be reviewed and separated by their owner before branch/integration operations.

- **CustomerShell** accepts route policy (header mode, nav visibility, active destination, floating-cart eligibility) and children; reads existing user/cart stores. It owns safe-area and sticky offsets, not checkout business decisions.
- **Button/Input/Status/Empty/Skeleton** share tokens, labels, disabled/pending state, focus and reduced motion. Form errors use `aria-describedby`; result announcements use a polite live region.
- **Sheet/Dialog** accepts open, title, onClose and content; manages focus trap, initial focus, focus restoration, Escape, scroll lock and dismissal. Prefer installed Radix primitives; do not hand-roll focus behavior without testing.
- **ProductCard** consumes normalized presentation `{id,name,image,variantLabel,priceDisplay,availability,discountDisplay?}` plus selected variant/quantity and callbacks. Price normalization must be agreed against verified pricing contract before implementation; no new discount arithmetic or invented MRP. Card supports grid/horizontal variants; quantity keyed by product + variant, pending/error states and canonical cart reconciliation. Do not nest buttons inside links.
- **CategoryRail/Grid** consume verified categories and selected ID; link navigation rather than local pseudo-filters. **FilterBar** renders only supported fields. **ProductGallery** receives media array and alt text; explicit1:1 dimensions, thumbnails/swipe with keyboard equivalents, no stretched assets.
- **CartItem/QuantityControl** route every mutation through existing store actions. Mutation errors restore the prior state and announce failure; reconcile server result. Stale operation ordering must not overwrite newer quantity changes. Do not create a second cart store.
- **BillSummary** takes an authoritative quote/order view; unknown values display pending/unavailable. No frontend reconstruction of dues, payment balances, refund amounts or delivery thresholds. Existing API lacks a verified pre-order authoritative quote: this is a backend dependency, not permission to invent a new endpoint.
- **PaymentStatusView** consumes existing verified status response mapped to initiating/redirecting/awaiting verification/delayed/confirmed/failed/cancelled. Order CONFIRMED does not alone establish paid. Partial payment requires an approved response field; no inferred paid amount. Polling GET status can use cancellation/backoff; mutation replay follows existing approved contracts only.
- **OrderTimeline** takes verified timestamped milestones; unknown future states are labelled upcoming without timers. **PartnerCard** renders only assigned data and supported actions. No map if tracking unsupported.
- **Profile/AddressForm** retain current auth and address schemas. Validate field requirements from existing controller, preserve recoverable values, show server errors, support manual entry. Never invent a default-address field when the contract lacks it.
- **SupportComposer** sends existing contract, uses saved message ID to deduplicate HTTP/socket updates; shows sending/failed/retry. Media history limitation is explicit; retry cannot be assumed idempotent.
- **PolicyLayout/CmsRenderer** separates string markdown pages from section-based home feed. Runtime validate allowlisted heading/paragraph/image/hero/CTA/FAQ/info/product/category blocks; bounded text/array lengths; approved URL schemes and image hosts; no arbitrary JS/HTML/style injection. Ignore unsupported blocks with diagnostic logging. Mapping from existing templates needs an explicit adapter, not a backend contract replacement.

## State and query ownership

Authentication/location remain `useUserStore`; cart remains `useCartStore`; wishlist remains `useWishlistStore` with its existing local-only scope clearly documented. Query keys include customer/location/variant where relevant; clear user-bound caches at logout. Selected address references existing address records, not a duplicate store. Checkout session references created order and existing provider handoff; prevent multiple submission while pending. Product variants persist by ID, never by display position. Use installed TanStack Query and Axios; forward AbortSignal where approved and deduplicate identical collection queries. Preserve refresh-token queue semantics and review financial POST replay separately.

## Four workstreams after approval

1. Discovery owner: five routes, card/gallery/category/filter/search components. First integrate normalized display contract with cart owner; eliminate truncated search only within approved backend capabilities.
2. Cart owner: wishlist/cart/checkout/payment presentation. Resolve authoritative amount dependency with financial team; implement safe pending UI where contracts are incomplete. No backend payment changes.
3. Orders/account owner: four customer routes and mock-gateway compatibility review. Replace fabricated progress presentation with real milestones; mock gateway server guards belong to separately authorized backend work.
4. Support owner: seven routes, chat/contact/policies/CMS. Reuse approved content and existing support contract; no fabricated return completion.

Suggested branches use default prefix `codex/bmv-home-discovery`, `codex/bmv-cart-checkout`, `codex/bmv-orders-account`, `codex/bmv-support-cms`; final branch workflow must be approved. No branches or commits were created in this discovery phase.

## Integration and acceptance sequence

1. Approve prototype, tokens, component/state contracts, route scope and source findings. Confirm Figma requirement and legal/contact content.
2. Establish source baseline with existing change owners; nominate foundation maintainer. Record API fixtures from an authorized sandbox, including errors, decimals and partial states; do not call production write endpoints.
3. Implement tokens/primitives/shell first; then shared product/cart contracts; then four feature workstreams. Keep admin/driver/packer/POS untouched.
4. Feature regression: catalog/variants/out-of-stock, add/update/remove cart with failed mutation rollback and request ordering, price refresh, failed checkout, pending payment and verified-only success, missing ETA/partner and partial payment display, address CRUD/session expiry, chat failure/deduplication, unknown CMS blocks/slug and unsafe URLs.
5. End-to-end sandbox journey: Home → Category → Product → Cart → Checkout → Payment status → Order detail → Account → Support. Use sandbox/mocked financial responses, never real payments. Assert duplicate-click protection; do not simulate success as a production fallback.
6. Responsive 320/375/390/430/768/1024/1440 checks, keyboard-only and screen-reader flows, 200% text zoom, reduced motion, contrast and safe-area checks. Cross-browser Chrome/Safari/Firefox/Edge supported versions; record versions at test time. Capture mobile and desktop screenshots.
7. Measure production build on representative mobile conditions: LCP≤2.5s, INP≤200ms, CLS≤0.1. Reserve image aspect ratios; priority only actual hero; lazy below fold; AVIF/WebP/host config and variant mapping review. These are targets, not claimed results.
8. Produce release pack:22-route checklist, tests, screenshots, bundle/performance evidence, known backend dependencies, rollback steps and explicit release approval. Financial NOT READY status must not be overridden by design approval.

## Release and rollback proposal

Keep changes reviewable by foundation then route workstream. PRs list changed routes/components/contracts/screenshots/tests/accessibility evidence/backend dependencies/risks. Before any authorized release, retain the last approved client build and verify deployment rollback process in staging. Roll back the client artifact without database mutation if catalog-to-order journey regresses. Do not reset this dirty working tree as a rollback method. Deployment itself remains separately gated.
