# Customer UI redesign — implementation review

28 October 2026. The user requested implementation with “redesin ui” after supplying the six-screen visual sample. This supersedes the discovery-only status of the earlier review pack. No deployment authorization was given.

## Implemented

Customer-only white/green shell, compact image-led home, live category shortcuts, five-tab navigation, cart badge and cart summary. Shared product cards now have readable two-line names, real product links, wishlist labels, 44px controls and a focus-managed Radix pack selector. Home collections retain existing data services and stores. Category imagery now prefers actual category assets rather than unrelated stock photographs.

Discovery: categories, category rail/grid, product gallery/variant layout and search. Cart/checkout: item rows, coupon/bill layout, mobile checkout action, wishlist. Orders/account: profile green header, settings rows, address cards and error recovery, compact order cards, status-history timeline. Support: chat typography/status presentation, contact hub, policy/dynamic-page typography. Returns now directs customers to actual chat support rather than falsely reporting a persisted exchange request.

Existing financial calculations, payment payloads, authentication and backend code were not changed. Order presentation no longer invents payment completion, milestone times, driver coordinates or arrival estimates. Purchase and checkout bars reserve their space; removing the route transition transform fixes fixed purchase controls being positioned at the end of the scrolling content.

## Explicitly retained

- `/payment-flow` remains the existing informational route, inheriting customer typography. Converting it to a new payment state machine requires a separately agreed contract.
- `/payment/success` received presentation/contrast/size updates only. Its existing verification and success predicate are retained; the source-audit financial correctness concerns remain unresolved and release-blocking. Do not interpret the visual redesign as payment certification.
- `/payment/mock-gateway` is retained without adding navigation links or touching financial behavior. Missing backend environment restrictions remain a separate release dependency.
- No admin, driver, packer, POS or backend source was edited for this redesign. Pre-existing changes in those files remain untouched.
- CMS remains the existing string-policy/section-feed architecture; a new typed block registry and policy sanitization overhaul were not silently introduced as part of styling.

## Validation

- Live Next.js development preview runs at http://127.0.0.1:3000.
- Visually inspected home (390 and desktop), live category rail (390), product detail (390), empty-cart recovery (390). Home → category → product → cart navigation exercised without placing orders, making payments, logging in or submitting profile/support data.
- Category DOM overflow checked at actual viewport widths320,375,390,430,768,1024,1440. No page/main/card overflow detected in the rendered checks.
- Product fixed purchase bar verified at390×844: bottom844, top771. It remains visible above the viewport edge.
- Targeted ESLint of25 route/shared component files returned zero errors with inherited `no-explicit-any` and `set-state-in-effect` rules disabled. Remaining15 warnings cover unused imports/variables and existing raw chat images. This is not a clean full-repository lint claim.
- Full TypeScript check reports only existing `.next/types/app/pay/page.ts` errors concerning the extra `PayContent` export and `slugParams` page props. The same failures were observed before the route workstreams completed. No redesign-source TypeScript errors were reported. Full build/release validation remains blocked by that route issue.
- No complete authenticated checkout/order/address E2E, browser matrix, screen-reader audit or performance benchmark was run. Existing financial remediation readiness remains NOT READY.

Screenshots: `implemented-home-mobile.png`, `implemented-home-desktop.png`, `implemented-product-mobile.png`. Desktop screenshot records an earlier headline iteration; mobile screenshot is the latest home copy. The dev-tools corner badge is development-only.

## Remaining release work

Resolve the pre-existing `/pay` route type errors; independently remediate and validate financial readiness findings; complete authenticated sandbox regression, accessibility/browser/performance checks and approve policy content. Release requires explicit separate authorization. The application has not been deployed or pushed by this work.
