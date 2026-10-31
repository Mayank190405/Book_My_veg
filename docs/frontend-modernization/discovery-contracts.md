# Discovery workstream: source-verified contract inventory

Review date: 28 October 2026. Scope: `/`, `/categories`, `/category/[id]`, `/products/[id]`, `/search`. Application code was not modified. Verification is static source review, not a live API/database or browser test; response examples and production availability are not asserted. No applicable AGENTS.md was found in the workspace/ancestor locations inspected.

## Existing routes and consumers

All five routes already exist under `client/src/app/(app)`. Retain this route group until shared layout compatibility is reviewed.

- Home: `client/src/app/(app)/page.tsx:1` renders banner-theme content, RecommendationSection, EditorialCategoryGrid and AllProductsSection. Existing full hero is typography-led with gradients and oversized headings; proposed compact photographic hero is a visual change requiring approval.
- Categories: `client/src/app/(app)/categories/page.tsx:12` uses React Query and getCategories.
- Category: `client/src/app/(app)/category/[id]/page.tsx:147` calls getCategoryById, `:152` fetches shared categories. Rail already exists (`:68`), so evolve it rather than duplicate it. Filtering and pagination are local over the fetched subset (`:38`, `:157`).
- Product detail: `client/src/app/(app)/products/[id]/page.tsx:70` fetches product; `:76` fetches reviews. SimilarProducts also has a shared endpoint consumer.
- Search: `client/src/app/(app)/search/page.tsx:83` fetches the first 250 products, then matches name/description/tags locally. Typing debounce is 300 ms (`:41`); this is not a remote search request per keystroke. Recent searches live in useUserStore. SearchInput fetches popular terms and records history (`client/src/components/ui/SearchInput.tsx:51`, `:92`).

## Transport, auth and common errors

All paths below are relative to `/api/v1`. Mounts: `server/src/index.ts:118`, `:119`, `:128`. Products/categories use rateLimiter(500,60); exact limiter behavior should be retained. Shared Axios client `client/src/services/api.ts:4` selects same-origin HTTPS `/api/v1`, environment URL or local port 5001. It enables credentials and injects the user-store bearer token (`:33`). A single-flight 401 refresh flow posts `/auth/refresh`, queues requests, updates tokens and retries; invalid refresh logs out. Do not replace this with a second API client.

Public endpoints below do not require authentication; optional bearer injection is still performed by Axios. Authenticated buy-again/history routes use authenticate: 401 `{message:'Unauthorized'}` / `{message:'Invalid token'}` (middleware `server/src/middleware/auth.ts:19`, `:53`; institutional sessions have an additional 401 path).

UUID/pincode/list validation uses Zod (`server/src/schemas/productSchemas.ts:3`), returning 400 `{message:'Validation failed',errors:[{field,message}]}` or `{message:'Invalid request data structure'}` (`server/src/middleware/validate.ts:25`). Controller failures generally return 500 `{message:string}` with messages recorded below. No response runtime schema exists in the inspected product/category service functions. Services do not accept AbortSignal; React Query cancellation is not forwarded to Axios. No explicit safe retry policy is configured in these service functions.

## Product contracts

Route declarations: `server/src/routes/productRoutes.ts:78`. Client wrappers: `client/src/services/productService.ts:3`.

### GET /products — public

Request query: categoryId optional UUID, search optional string, cursor optional UUID, limit optional numeric string (default 20). Controller also reads locationId, which is not declared in the Zod schema. validate merges parsed fields into req.query rather than replacing it, so locationId remains available in the current implementation. No maximum limit is imposed by this schema.

Response: `{data: ProductWithRelations[], nextCursor: string|null}`. Includes category `{name,slug}`, variants with active pricing and inventory, product active pricing and inventory. Inventory is scoped only when locationId is supplied. Non-search mode restricts product isActive, orders createdAt descending, takes limit+1, removes extra product and uses its ID as nextCursor; next request uses cursor without skip. Search mode uses SearchService then re-fetches full models in relevance order; it does not apply cursor pagination and leaves nextCursor null. It does not apply the category where predicate in the search branch. Evidence: `server/src/controllers/productController.ts:33-107`.

Errors: 400 validation; 500 `Error fetching products`. Redis key includes location/category/search/cursor/limit, TTL 300 s. Client homepage infinite query has 2 minute stale time (`client/src/components/widgets/AllProductsSection.tsx:22`); search uses 5 minutes and a different query key (`search/page.tsx:83`). Other consumers include NewArrivals and CategoryProductListing. Requests are not automatically deduplicated across differing query keys.

### GET /products/:id — public

Request: UUID id path; no body/query contract. Response: full Product, category, variants with active pricing/all inventory, active pricing/all inventory. No location scope and no explicit isActive or isWebsitePublished guard in this controller. 404 `Product not found`; 500 `Error fetching product`; 400 malformed UUID. No explicit controller cache. Evidence: `server/src/controllers/productController.ts:111`. Consumers: product page, ProductDetailsDrawer (`client/src/components/ui/ProductDetailsDrawer.tsx:60` uses a different query key), getProductById wrapper.

### GET /products/:id/similar — public

UUID id. Response: up to six active same-category products excluding the source; variants/pricing/inventory relations. No pagination or explicit cache. Errors 400 UUID, 404 `Product not found`, 500 `Error fetching similar products`. Evidence `server/src/controllers/productController.ts:572`. Consumer SimilarProducts via getSimilarProducts.

### GET /products/trending — public

Optional pincode, lat, lng (client wrapper); controller additionally supports page(default1), limit(default10), parsing numeric strings without route validation. Response is a product array, not `{data}`. With valid coordinates it sorts all active products by nearest in-stock location then creation date and slices the requested page; without coordinates it orders createdAt descending. Pincode is accepted but not used in ranking. Default-mode cache TTL is 7200 s with page/limit key; proximity branch has no explicit cache. No total/hasMore response. 500 `Error fetching trending merchandise`. Evidence `server/src/controllers/productController.ts:413`. Homepage RecommendationSection staleTime 3 minutes, query key includes pincode/lat/lng (`client/src/components/widgets/RecommendationSection.tsx:22`); TrendingSection and CategoryProductListing are additional consumers.

### GET /products/flash-deals — public

No declared request input. Array of ten active products with variant, pricing, inventory relations; selection does not require a real discount. No pagination/cache shown; 500 `Error fetching flash deals`. Evidence `server/src/controllers/productController.ts:550`. Wrapper/FlashDeals consumer. Do not label every returned item as discounted merely because this endpoint is named flash-deals.

### GET /products/buy-again — authenticated

No input. Array from products in the user's five newest orders, includes variants and pricing. No inventory relation in this response and no pagination/cache. Deduplication uses Set over objects, so do not assume ID uniqueness. 401 auth; 500 `Error fetching buy again products`. Evidence `server/src/controllers/productController.ts:603`. BuyAgain/getBuyAgainProducts consumers.

### GET /products/check-pincode/:pincode — public

Six digit pincode. `{serviceable:true,message:'Serviceable at '+pincode}` is unconditionally returned by the current controller (`server/src/controllers/productController.ts:598`). 400 malformed pincode. This is a stub, not verified delivery eligibility; new UI must not treat it as an authoritative delivery promise.

## Category contracts

Declarations `server/src/routes/categoryRoutes.ts:16`; wrappers `client/src/services/categoryService.ts:3`.

### GET /categories — public

No input. Array of active root Category objects, includes children (children are not filtered by isActive in this include), ordered sortOrder ascending. No pagination. Redis `categories:all`, TTL300s. 500 `Error fetching categories`. Evidence `server/src/controllers/categoryController.ts:12`. Shared React Query key `['categories']` across categories, category, search and editorial widgets; widget staleTime5min. No explicit invalidation in read service.

### GET /categories/:id — public

UUID path; optional cursor and limit read by controller (default100, capped500; other numeric edge cases are not validated by route). Response: Category plus children, active products with pricing/variant/inventory relations, nextCursor. Products ordered createdAt desc; cursor skip1 and nextCursor equals last returned ID. Redis `category:<id>:<cursor-or-start>:<limit>`, TTL300s. 400 malformed id, 404 `Category not found`, 500 `Error fetching category`. Evidence `server/src/controllers/categoryController.ts:33`. Current wrapper only accepts id and limit, not cursor; current page therefore cannot fetch beyond its initial100 even when nextCursor exists.

## Search/supporting contracts

Route declarations `server/src/routes/searchRoutes.ts:15`; controllers `server/src/controllers/searchController.ts`.

- GET `/search/history`: authenticated; no input; latest10 SearchHistory records sorted lastSearchedAt descending; 401 auth or 500 `Error fetching search history`; no pagination/cache. The current search page uses local recent history instead of reading this route.
- POST `/search/history`: authenticated; JSON `{query}` (only truthiness validation); creates record or increments count/lastSearchedAt; 200 `{message:'Search recorded'}`; 400 `Query required`, 401 auth, 500 `Error recording search`. SearchInput calls this even for guests, swallowing failure (`SearchInput.tsx:92`).
- DELETE `/search/history`: authenticated; no body; `{message:'Search history cleared'}`; 401 auth, 500 `Error clearing history`; no current consumer identified in search page.
- GET `/search/popular`: public; no input; unique string[] from top10 history records by count. Falls back to hardcoded terms on empty data or failure, returning200. No pagination/cache. SearchInput staleTime5min. Fallback terms are editorial suggestions, not verified popularity; label them accordingly.
- POST `/search/smart-list`: public; JSON `{query:string,locationId?:string}`; returns SmartSearchResponse `{isMultiItem,originalQuery,normalizedQuery?,items,summary:{totalItemsParsed,totalMatched,totalUnmatched,estimatedTotal}}`. Items carry parsed request, match state, nullable product, quantity/unit, lineTotal, optional statusMessage. Product projection includes id/name/slug/image/categoryName/price/unit/variantId?/variantName?/inStock/stockQuantity. Evidence `server/src/services/geminiSearchService.ts:13-45`. Redis cache by location/query,2min (`:75`, `:128`). 400 `Search query is required`; 500 `Failed to process smart search`. No current client consumer found by route search. Estimated totals must not become checkout totals.
- GET `/reviews/product/:productId`: public product-detail supporting endpoint, page(default1),limit(default10); response `{reviews,total,page,limit}` including user name. 500 `Error fetching reviews`. No cache/route UUID validation shown. Evidence `server/src/routes/reviewRoutes.ts:10`, `server/src/controllers/reviewController.ts:6`. Product page and ReviewSection consumers may use separate keys.

## Shared response model and pricing questions

Source model definitions: `server/prisma/schema.prisma:78` Category; `:103` Product; `:152` ProductVariant; `:210` Inventory; `:229` Pricing. IDs are UUID strings. Product contains images:string[], nullable basePrice, description, origin/shelfLife/nutrition/specifications/tags and publication/activity flags. Variant has price, nullable weight, weightUnit, isActive. Inventory contains locationId and decimal currentStock. Pricing has channel, decimal price, nullable discountType/discountValue, optional dates and isActive. No explicit MRP field exists in these models. Prisma Decimal JSON wire serialization must be captured from a real sandbox response before finalizing DTO types; do not assume every price is a JavaScript number.

Price selection is already inconsistent: category local filters calculate discounts on basePrice (`category/[id]/page.tsx:22`), while ProductCard selects active WEB pricing/variant pricing then computes discounts (`client/src/components/ui/ProductCard.tsx:103`, `:133`). Both perform frontend arithmetic. Approval of a common display price adapter must come from existing backend semantics, not an invented rule. Do not change financial behavior as part of visual work.

## Risks and implementation prerequisites

1. Establish backend-approved price/MRP/discount/channel/date semantics and stock location before new cards or sort controls ship. Missing MRP should omit the strikethrough amount.
2. Category filters currently operate over100 products, search over250; product counts and sorting are subset counts, not whole catalog counts. Plan server-backed search/pagination using existing verified contracts, with contract changes separately approved.
3. Product/variant detail reads may expose inactive variants, and publication filtering is not uniformly enforced. Report to backend owners; do not silently alter backend rules.
4. Cache invalidation helper deletes `category:<id>` but category read keys contain cursor/limit (`server/src/utils/cacheUtils.ts:10`, `:35`), and category list key is separate. A pricing update can leave category snapshots stale for300s. Backend correction is outside frontend approval.
5. Trending results do not establish store serviceability or ETA. Pincode endpoint is a stub. Hide delivery promises unless a genuine policy API is verified elsewhere.
6. No cancellation is forwarded by service wrappers. New read adapters should accept AbortSignal and use shared query keys; avoid duplicate caches/stores.
7. Existing product card variants, drawer and filter controls should be consolidated under one owner. Keep useCartStore/useUserStore contracts; no new store here.

## Proposed component contract for approval

- ProductCard receives a validated display projection derived from backend data: product identity/image/name; selected variant; approved display price; optional approved reference price/savings; location-qualified availability; quantity/pending/error from existing cart store. Missing values are omitted or show unavailable, never replaced with invented figures.
- ProductCollection supports grid/horizontal variants with shared card. CategoryRail uses existing category IDs; filters advertise only supported data and clearly state subset limitations until pagination is resolved.
- ProductGallery reserves1:1 dimensions; image fallback and navigation are accessible. Category cards reserve image dimensions and preserve catalog names.
- SearchInput uses existing300ms interaction, meaningful query keys and cancellation if remote search is approved. Persist search history according to existing user preferences and distinguish editorial suggestions from measured popularity.

## Acceptance evidence still needed

Sandbox request/response/error captures (including Decimal serialization and pagination boundaries), authenticated/guest sessions, store-specific stock/price examples, approved brand imagery, reference analysis, design prototype approval, screen-reader/keyboard checks and320–1440px screenshots. None of these are represented as completed by static review.
