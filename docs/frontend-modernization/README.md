# Book My Veg — design and technical review pack

28 October 2026 · **Customer UI implementation requested and applied** · Release not authorized

Latest status: see [implementation review](implementation-review.md) and the [live local app](http://127.0.0.1:3000). The sections below preserve the earlier discovery-stage findings and prototype scope.

## Review the proposal

Open [interactive prototype](http://127.0.0.1:8765/docs/frontend-modernization/prototype.html) while the local preview server is running, or open `prototype.html` directly in a browser. All assets are local repository images; no production services are contacted. Route, frame and state selectors are review controls, not application features.

The prototype covers all 22 scoped route layouts at selectable widths 320, 375, 390, 430, 768, 1024 and 1440. It is a local HTML design artifact, **not a Figma file or production implementation**. Product/financial/customer/policy fields deliberately identify their data source instead of fabricating records. Photography shows existing assets for composition review only; it does not certify product variants, licensing or production image quality. Detailed sheet, gallery swipe, address CRUD and payment interactions remain component specifications rather than complete working flows. Figma fidelity/handoff remains an open deliverable if required by the approver.

## Source-verified API inventory

1. [Discovery](discovery-contracts.md): home, categories, category detail, product detail, search; product/category/search/review/banner/CMS consumers.
2. [Cart and checkout](checkout-contracts.md): wishlist, cart, checkout, payment flow, success; cart, coupons, eligibility, order creation, payment initiation/link/status/verification.
3. [Orders and account](orders-account-contracts.md): orders, tracking, profile, addresses, development gateway and compatibility routes.
4. [Support and CMS](support-cms-contracts.md): chat, contact, returns, exchange policy, privacy, terms, dynamic pages; HTTP and realtime contracts.
5. [Component contracts and plan](design-and-implementation-plan.md): ownership, state boundaries, review gates, validation and release strategy.

Verification means the contracts were traced from frontend consumers to server mounts, middleware, handlers and schema where available. No live response, deployed code parity, database contents, provider configuration, production permissions or policy accuracy was verified. Audited checkout includes existing uncommitted changes. Source paths and line references are snapshots and may move with those edits.

## Decisions needed before implementation

- Approve the proposed green/neutral design, compact image-led cards, category rail and timeline-first order layout; identify any brand/font changes.
- Approve preservation of the existing `(app)` route group, Zustand stores, React Query and shared Axios refresh behavior; no new dependencies are proposed.
- Confirm whether the local interactive prototype is sufficient for design approval or whether Figma handoff is required.
- Approve the exact frontend-only implementation scope with backend-dependent functionality retained as pending/unavailable until separately remediated.
- Supply approved contact and policy content and resolve contradictory refund/exchange defaults. Do not adopt source defaults as business approval.

## Material dependencies

Financial readiness remains **NOT READY** per the supplied specification. Frontend approval does not authorize backend remediation or production release. Source audit identified mock payment success fallback, unsafe success inference, client-supplied totals, insufficient cart reconciliation, and order-status/ETA/map fallbacks. See individual reports for evidence and limitations. Do not build new verification paths or silently repair financial behavior within a visual redesign.

Support submission is another correctness gap: returns currently reports a submitted exchange without a network mutation. Proposed design routes requests to real support pending an approved return API. Policy rendering needs safe-link validation. Public CMS preview and GET-time default seeding need backend review.

## Validation performed

The prototype was opened in the in-app browser. All 22 routes were rendered at the 320px frame setting: a heading was present, main content did not horizontally overflow, and no completed image had a failed natural width. Mobile home and narrow category layout were visually inspected. This is prototype checking only, not production QA, accessibility certification or financial regression testing. See `validation.md` for additional checks and limits.

## Change boundary

Only files inside `docs/frontend-modernization/` were added for this request. No application, authentication, backend, financial, admin, driver, packer or POS code was modified by this work. Existing changes were preserved. No deployment or Git push was performed.
