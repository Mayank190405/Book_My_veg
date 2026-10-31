# Workstream 4 — support, policies and CMS

Source audit: 28 October 2026. Verified against checked-out source, including pre-existing uncommitted edits; not a live API certification. No production requests made. Paths below are relative to `/api/v1`, mounted in `server/src/index.ts:141`, `:146`, `:150`.

## Routes and current consumers

- `/chat`: `client/src/app/(app)/chat/page.tsx:123` loads history using its local `apiFetch`; `:249` sends messages; Socket.IO updates and browser-local attachment persistence supplement HTTP.
- `/contact`: `client/src/app/(app)/contact/page.tsx:10` redirects to `/chat`; no contact-form endpoint verified.
- `/returns`: `client/src/app/(app)/returns/page.tsx:24` loads orders, filters by **creation** time rather than delivery time; `:39` submission only changes local state and displays success. No exchange request is persisted. Proposed design must link to actual support until a separately approved return contract exists.
- `/privacy`, `/terms`: call `getPageBySlug('privacy'|'terms')` at respective page line 42.
- `/exchange-policy`: attempts `exchange-policy`, then `refund-policy` (page lines 44–46).
- `/pages/[slug]`: dynamic page loads slug through `getPageBySlug` (page lines 45–58).
- Policy and dynamic consumers share `components/ui/MarkdownRenderer.tsx`; the current renderer escapes basic markup then inserts links and renders HTML (`:60`, `:109`). URL protocols and attribute escaping require security review; basic escaping alone does not establish safe link rendering.

## HTTP contracts

### GET /chat/history

Bearer required; middleware in `routes/chatRoutes.ts:17`, `middleware/auth.ts:19`. Customer sees own history; `?userId` only changes target for ADMIN/STORE_ADMIN. No body. Response 200 `{messages: ChatMessage[]}` sorted ascending, capped at 200 (not cursor-paginated; earliest 200 due ascending sort). `controllers/chatController.ts:9–29`.

ChatMessage persisted fields: `id,senderId,senderName?,isAdmin,message,orderId?,hasAttachment,attachmentType?,isRead,sessionEnded,createdAt` (`prisma/schema.prisma:822`). Binary attachment is absent from history. Errors: 401 missing/invalid token or invalid session; 500 `{message:'Failed to fetch chat history'}`. No route-specific cache, cancellation or retry policy found. Refetch on user change; do not cache across accounts.

### POST /chat/send

Bearer required. Body currently accepts `{message?,orderId?,hasAttachment?,attachmentType?,attachment?,senderName?}`; admin additionally uses `targetUserId`. Text defaults to empty string, attachment metadata persisted, binary data relayed only. 201 `{message: ChatMessage}`. Socket payload adds `attachment` and sender name. 500 `{message:'Failed to send message'}`; shared 401 applies. No idempotency contract verified, so automatic retries can duplicate messages. `controllers/chatController.ts:35–86`. Customer consumer: chat page line 249. No explicit length, media-size or order-ownership validation in this handler; document as backend dependency, do not silently invent guarantees.

### POST /chat/end-session

Bearer required; customer body can be `{}`. Admin may pass `{targetUserId}`. Sets `sessionEnded:true`, emits `chat_session_ended`, returns 200 `{success:true}`; 500 `{message:'Failed to end chat session'}`. `controllers/chatController.ts:91–112`. No pagination/cache. Ended rows remain in history query; client session filtering must be checked during integration.

`GET /chat/conversations` and `PATCH /chat/mark-read` are ADMIN/STORE_ADMIN only, outside customer redesign. Do not infer customer-visible read receipts or staffed availability from them.

### GET /page-content and GET /page-content/:slug

Public. No body; slug is path string. List returns `PageContent[]`, ordered createdAt ascending, no pagination. Detail returns `PageContent={id,slug,title,content,createdAt,updatedAt}`. Content is a **string**, not a typed block array. Unknown slug: 404 `{message:'Page not found'}`. Database failures: 500 `{message,error}`. `controllers/pageContentController.ts:134–161`, `:192–224`; types/consumers `client/src/services/pageContentService.ts:3–22`.

Important: both GET handlers may seed missing defaults into the database. Therefore even authenticated read-only discovery must avoid calling a live system casually. No route-specific caching or cancellation; existing consumers fetch on mount. Preserve approved text, and treat policy approval as separate from rendering approval.

PUT/DELETE on the same slug are restricted to ADMIN/SUPER_ADMIN/STORE_ADMIN; customer UI must not call these. PUT body `{title?,content}` requires truthy content (400), returns `{message,page}`; DELETE system slugs 400, success `{message}`, DB failures 500. `routes/pageContentRoutes.ts:13–15`, controller `:163–242`.

### GET /cms/home/feed

Public, query `{page?:string='home', preview?:string}`. 200 `{page,version:1,serverTimestamp,sections: hydratedSection[]}`. `controllers/cmsController.ts:436–470`. Normal mode filters active, published, scheduled sections sorted by sortOrder. `preview=true` bypasses those filters without authentication in this route: backend security review needed before adopting preview in customer tooling. Handler seeds defaults if empty. Errors delegated to global error handler; no endpoint-specific stable error enum. No pagination, route cache, cancellation or safe retry contract established.

Hydrated section preserves stored fields (type/template/title/subtitle/theme/layout/content/productIds/categoryIds/conditions/scheduling/metadata) and attaches products/categories. Product hydration includes inventory/pricing/variants and numeric conversions; category hydration includes id/name/slug/imageUrl/icon/productCount (`:295–429`). This is distinct from string policy pages. Existing CMS admin CRUD is outside scope. Proposed block registry must adapt these existing formats without requiring a backend migration.

## Realtime and auth compatibility

`client/src/services/socketService.ts:32–48` initializes singleton Socket.IO, websocket transport, credentials and `join_room(userId)`. The client call does not establish that server room authorization is safe; server audit required before making assurances. Events used by chat: `chat_message`, `chat_typing`, `chat_session_ended`; outgoing relay can overlap HTTP broadcast, so deduplicate by saved message id.

Customer shared Axios client (`services/api.ts`) adds Zustand token and refreshes on 401. Chat has a separate local fetch helper; preserve its actual behavior until unified auth work is approved. A third `lib/api.ts` Axios instance exists without token injection. Consolidation requires consumer audit, not blind replacement.

## Approval dependencies

Existing default terms describe a 24-hour refund with 2–3 business-day processing, while refund-policy describes non-refundable goods with 12-hour exchange (`pageContentController.ts:81–119`). These are contradictory source defaults, not verified current business policy. Obtain approved policy/contact details; do not choose one or reproduce guarantees in new UI. Default promotional delivery claims are likewise not authoritative operational data.

Proposed rendering: one readable 720px policy column; explicit loading, not-found and retry states; allowlisted blocks and safe URLs; unsupported blocks omitted with diagnostic logging. Preserve sanitized approved text. For unsupported return submission show 'Contact support about this order', never a fabricated submitted state.
