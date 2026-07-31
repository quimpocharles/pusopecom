# PusoStore Frontend Migration Plan

**Version 1.0**

This document audits the actual frontend — every page, the shared component library, and the most-reused feature components — against `README.md`, `EDITORIAL_DESIGN_LANGUAGE.md`, `DESIGN_SYSTEM.md`, `DESIGN_TOKENS.md`, `COMPONENT_SPECIFICATION.md`, and `EDITORIAL_LAYOUT_SYSTEM.md`. It is not a proposal — every finding below is drawn from reading the actual code, not from assumption.

**This is not a redesign plan.** No page is rebuilt from scratch here, and nothing in this document asks for one. The five design documents already exist; the code doesn't yet reflect them. This document identifies, page by page and component by component, what already agrees with the new system, what should be left alone, what should change, and what should simply be deleted — then ranks the resulting work by impact, not by how satisfying it would be to rewrite.

## The one finding that shapes everything else

**Zero pages in production import the shared `components/ui/` library.** `Button`, `Card`, `Badge`, `Modal`, `Input`, `EmptyState`, and `ErrorState` exist, are reasonably well-built, and are used nowhere except the internal, unlinked `/_design-system` demo page. Every one of the platform's 23 real pages hand-rolls its own Tailwind classes instead — which is exactly the duplication the shared library was built to end, per the Engineering Handbook's own naming convention discipline. This single fact is why the migration plan below leads with the shared library itself: fixing it once and having pages adopt it is the actual incremental path; fixing 23 pages' worth of duplicated inline styling individually is not.

---

## Part 1 — Shared Component Library (`components/ui/`)

The foundation everything else depends on. Assessed against `COMPONENT_SPECIFICATION.md` and `DESIGN_TOKENS.md`.

### Button.jsx
**Aligns:** Already a real, consolidated component wrapping named variants rather than each page hand-rolling its own button — the right shape, wrong values inside it.
**Should stay:** The pattern of mapping a `variant` prop to a single defined class, and the component's role as the platform's one button implementation.
**Should change:** Seven variants (`primary`, `primaryLight`, `secondary`, `secondaryLight`, `outline`, `gold`, `tryon`) collapse to the three the Component Specification defines — Primary, Secondary, Text. The underlying `.btn-*` classes in `index.css` carry `rounded-xl`, `shadow-sm`/`shadow-md`/`shadow-lg`, an `active:scale-[0.98]` press animation, and — on `.btn-tryon` specifically — a gradient (`from-primary-600 to-accent-500`) with its own darker-gradient hover state. All of it is replaced: `radius.default`, `elevation.none` always, hover/active as a border or background value shift, no gradient anywhere.
**Should be removed:** `.btn-gold` and `.btn-tryon` as distinct visual identities. The try-on action becomes an ordinary Primary button, per the Component Specification's explicit instruction that no feature earns its own bespoke button treatment.

### Card.jsx → Panel
**Aligns:** Nothing structurally — this is the component the new system renames and rebuilds most deliberately, per `DESIGN_SYSTEM.md`'s explicit "Card is retired as a concept, not just a name."
**Should stay:** The consolidation instinct — this component already exists specifically to end duplication between `StatsCard.jsx` and `ReportCard.jsx` (its own code comment says so), which is the right instinct pointed at the wrong target shape.
**Should change:** Rename to `Panel`. Collapse the two current variants (`bordered`: `rounded-xl border border-gray-200`; `elevated`: the `.card` class, `rounded-2xl shadow-card` with a `shadow-card-hover` on hover) into one treatment: `radius.default`, bordered at `ink.700` or `ink.200`, `elevation.none` at rest and on hover, always.
**Should be removed:** The `elevated` variant entirely, and the `shadow-card`/`shadow-card-hover` tokens in `tailwind.config.js` that back it, once nothing references them.

### Badge.jsx
**Aligns:** Already componentized with a `tone` prop rather than hand-rolled per instance — structurally the right shape.
**Should stay:** The component API itself (`tone` prop, wraps a base `.badge` class).
**Should change:** The four tones (`primary`, `secondary`, `accent`, `success`) map onto generic brand colors, not functional meaning. Per the Component Specification, only three tones should exist going forward — verified, live, error — each tied to its actual `signal.*` token, plus a neutral default for everything else (a category tag, a count) that currently has no non-colored option at all.
**Should be removed:** `badge-primary`/`badge-secondary`/`badge-accent` as decorative, non-functional color options.

### Modal.jsx
**Aligns:** Genuinely close already. No shadow class in its current implementation, a plain `bg-black/50` backdrop (already close to the flat scrim the Component Specification asks for), and real focus/Escape/backdrop-dismiss behavior already present per its own test coverage.
**Should stay:** Almost everything — the backdrop approach, the dismiss behavior, the focus handling.
**Should change:** `rounded-xl` → `radius.default`; add the single, deliberately subtle `elevation.overlay` value the spec calls for (currently has none at all, which reads as slightly unfinished rather than intentionally flat); the close button's `rounded-full` treatment.
**Should be removed:** Nothing structural — this is the smallest, safest migration target in the entire library.

### Input.jsx
**Aligns:** Already does the one thing the Component Specification insists on hardest — a visible label permanently above the field, never a placeholder standing in for one. Error and helper text are already present as separate, associated elements.
**Should stay:** The label-above-field structure, the error/helper text pattern, the `inputId` association logic.
**Should change:** The underlying `.input-field` class (`bg-gray-50 rounded-xl`, a `focus:ring-2` glow) becomes a bordered field at `radius.default` with a border-value focus state, replacing the ring entirely per the "boundaries as lines, not glows" rule.
**Should be removed:** The `focus:ring-2` glow treatment specifically — the clearest single violation of the platform's border-over-glow rule anywhere in the library.

### EmptyState.jsx / ErrorState.jsx
**Aligns:** Both are already close in spirit — plain, centered, text-first, no illustration, calm copy (`text-gray-500`/`text-gray-400`, no exclamation, no forced cheerfulness). This is genuinely one of the better-aligned corners of the current codebase.
**Should stay:** The overall composition and restraint — this is close enough to the spec that it validates the new philosophy was already partially present in the team's own instincts before this series was written.
**Should change:** The icon's `text-gray-300` treatment and the action button's reliance on the old `.btn-secondary`/`.btn-outline` classes update automatically once Button.jsx migrates — no independent work needed here beyond that dependency.
**Should be removed:** Nothing.

---

## Part 2 — Global, Highest-Leverage Components

Not pages, but components that appear on nearly every page — fixing these has outsized reach.

### Header.jsx (`components/layout/Header.jsx`)
**Aligns:** Nothing meaningfully — this is the single most concentrated collection of patterns the new system replaces, on the one component every page shares.
**Should stay:** The functional behavior — search, cart count, account menu, mobile menu logic — none of which this audit touches.
**Should change:** The "pill-morph" scroll transition (`borderRadius: isExpanded ? '0px' : '100px'`, a multi-layer `boxShadow` including an inset highlight) is the platform's most visible remaining pill shape and needs the most deliberate rework of anything in this audit — not a token swap, a real redesign of the scroll interaction within the Component Specification's Navigation rules. Every dropdown panel (`rounded-xl shadow-card border border-gray-100`) migrates to Panel. Every `rounded-full` icon button, avatar circle, and cart-count badge stays circular only where it's a genuinely circular element (the avatar, per Avatar's spec) and becomes `radius.default` everywhere else (icon buttons are not intrinsically circular). `bg-primary-600` avatar fallback and `text-accent-500` sale-price/logout coloring both need to move onto the new token set.
**Should be removed:** Nothing functional — this is entirely a visual migration, and the highest-effort one in this document precisely because it's the highest-reach.
**Implemented (2026-08-01):** See the Ranked-by-Impact entry above — the pill is gone, replaced by two independent bordered boxes rather than a re-skinned single bar, and the old dark slide-in drawer was deleted rather than migrated.

### ProductCard.jsx (`components/products/ProductCard.jsx`)
**Aligns:** The hover-swap second image and slide-up "Buy Now" interaction are genuinely good, considered product behavior — nothing here needs to change functionally.
**Should stay:** The interaction model; the underlying data it presents.
**Should change:** `rounded-2xl` image container → `radius.default`. The sale/featured badges (`bg-accent-500`/`bg-primary-600`, `rounded-lg`) migrate onto Badge's new signal-based tones. The "Buy Now" button's `shadow-lg` is removed per Button's new elevation rule.
**Should be removed:** Nothing.
**Implemented (2026-08-01):** Done, plus a `merch.*` badge category (New/Sale/Virtual Try-On) this audit didn't anticipate, and a sold-out marquee treatment replacing a plain dim overlay.

---

## Part 3 — Customer-Facing Pages

### Home.jsx
**Aligns:** More than any other page in the codebase — this is the one place the platform already attempted an editorial direction on purpose. Dark, alternating `#0a0a0a`/`#1a1a1a` section backgrounds; large, confident display type; restrained, opacity-based body text; genuine editorial section rhythm (hero, then a quieter carousel, then a full-bleed collection moment, then featured products, then partners, then FAQ). The instinct behind this page is already correct.
**Should stay:** The section rhythm and ordering, the dark neutral background approach, the restraint in body copy color and size.
**Should change:** Every hardcoded hex value and inline `style={}` block moves onto the token set — this page currently has zero dependency on the shared component library or the Design Tokens, everything is bespoke. The animated Philippine-flag gradient badge, the pill-shaped partner-logo chips (`borderRadius: '100px'`), the browser-mockup's heavy `boxShadow`, and the `rounded-2xl`/`rounded-3xl` image containers all move to the platform's single radius value and drop their elevation. The "Shop by Sport" category tabs are a real candidate for the Component Specification's Tabs pattern rather than a bespoke pill-button group.
**Should be removed:** The entire Instafeed/Social section (lines ~806–956) is dead code, gated behind a literal `{false && ...}`, still referencing `bg-primary-50`/`text-gray-900`/placeholder.co images that don't match either the old or new system. This should simply be deleted, not migrated.

### Products.jsx
**Aligns:** The filter-and-sort structure itself is sound and doesn't need to change.
**Should stay:** The filtering logic, the `ProductCard` grid composition (a real instance of the Layout System's Product Grid pattern already, structurally).
**Should change:** Sort dropdown and filter chips (`rounded-xl`, `bg-primary-600` active state, `focus:ring-2`) migrate onto Input/Button/Badge once those exist. Pagination's small numbered buttons are a direct candidate for the Component Specification's Pagination component rather than a hand-rolled button set.
**Should be removed:** Nothing.
**Implemented (2026-08-01):** Done, and expanded well past controls-only — see the Ranked-by-Impact entry above for the navbar-to-tabs move and the new Filters/Sort By/Search dropdown row.

### ProductDetail.jsx
**Aligns:** The overall content ordering — imagery, then identity, then variant selection, then acquisition, then reviews — already roughly matches the Layout System's Product Narrative pattern.
**Should stay:** That ordering, and the size-chart modal's core content.
**Should change:** This is the largest page in the codebase (800 lines) and carries the largest raw count of `rounded-xl`/`rounded-2xl` instances anywhere — variant selectors, thumbnail borders, the size-chart table, the review form. All of it is a token-level migration once Input, Button, and Panel exist, not a structural one. The review section's star-rating progress bars (`bg-gray-100 rounded-full` tracks) become Statistics-Panel-adjacent, plainly typographic where possible.
**Should be removed:** Nothing structural.

### Checkout.jsx
**Aligns:** The step structure (contact → delivery → payment) and the atomic-checkout backend behind it are correct and untouched by this audit.
**Should stay:** The flow itself.
**Should change:** This page currently hand-rolls three different colored alert boxes with no shared pattern — `bg-amber-50 border-amber-200 text-amber-800` for a warning, `bg-blue-50 border-blue-100 text-blue-800` for information, `bg-red-50 text-red-600` for an error. All three collapse into the Component Specification's single Alert component, using `signal.error` for the real error and a neutral treatment for the other two, since neither is actually a functional-color situation per Alert's own rule. The custom `DeliveryCard` radio-style selector is a direct candidate for the Radio component instead of a bespoke bordered button.
**Should be removed:** Nothing.

### Account.jsx, Orders.jsx, OrderConfirmation.jsx, CompleteProfile.jsx
**Aligns:** Standard account/order-history pages with no unusual patterns — same `rounded-xl`/`rounded-2xl` card treatment as everywhere else, nothing page-specific.
**Should stay:** Structure and content as-is.
**Should change:** Straightforward Panel, Button, Input, and (for order status) Badge adoption — no page-specific design decisions needed beyond what the shared components already resolve.
**Should be removed:** Nothing.

### Login.jsx, Register.jsx, ForgotPassword.jsx, ResetPassword.jsx, VerifyEmail.jsx
**Aligns:** Simple, focused forms — already the right shape for what they are.
**Should stay:** Everything structural.
**Should change:** Direct Input and Button adoption; nothing else. These pages will look correct almost automatically the moment the two components they're built from are migrated.
**Should be removed:** Nothing.

### DataPolicy.jsx, TermsOfService.jsx
**Aligns:** Long-form, single-column text pages — already structurally close to the Layout System's Story Layout pattern (a reading-measure column, no competing sidebar).
**Should stay:** Everything.
**Should change:** Typography scale and spacing tokens only, once those are in place globally via `index.css`/`tailwind.config.js`.
**Should be removed:** Nothing.

---

## Part 4 — Admin Pages

Every admin page shares the same handful of underlying patterns, so they're assessed together rather than 10 times over.

**Aligns:** Functionally, nothing in this audit questions any admin workflow — CRUD forms, filters, tables all work and stay exactly as they are.
**Should stay:** Every admin page's actual behavior, data flow, and layout structure.
**Should change:** All of it traces back to two shared pieces:
- **`StatsCard.jsx`** — the clearest single example of the "generic dashboard" anti-pattern named throughout this series: `rounded-xl border border-gray-200`, and a `colorVariants` map of six arbitrary hues (blue, green, purple, orange, red, indigo) assigned per-instance with no functional meaning whatsoever — color chosen for visual variety, the exact anti-pattern `EDITORIAL_DESIGN_LANGUAGE.md` names directly. This collapses onto Panel, with color removed entirely unless a specific stat is a genuine `signal.*` case.
- **`AdminLayout.jsx`** — sidebar nav items (`rounded-lg`, `bg-primary-50 text-primary-700` active state) and the mobile drawer (`shadow-xl`) migrate onto Navigation's active-state rule (a structural marker, not a filled color block) and Panel/elevation rules respectively.

Once those two pieces move, `AdminDashboard.jsx`, `AdminProducts.jsx`, `AdminOrders.jsx`, `AdminLeagues.jsx`, `AdminPickup.jsx`, `AdminProductForm.jsx`, `AdminSettings.jsx`, `AdminShippingReports.jsx`, `AdminUsers.jsx`, and the `AdminReports.jsx` sub-sections (`SalesSection`, `ProductsSection`, `OrdersSection`, `CustomersSection`, `TryOnSection`, `ReportCard.jsx`, `HorizontalBarList.jsx`) inherit nearly all of the benefit automatically — every one of them is built from `StatsCard`/`ReportCard`-style panels and the same status-badge pattern (`bg-blue-100 text-blue-800`-style inline color maps, repeated slightly differently in `AdminDashboard.jsx` and `AdminOrders.jsx`), which becomes one consistent Badge usage everywhere instead of a hand-rolled color object per file.

**Should be removed:** The duplicate status-color-mapping objects hand-rolled separately in `AdminDashboard.jsx` and `AdminOrders.jsx` — once Badge carries real status logic, these per-page copies of the same mapping have no reason to exist.

---

## Part 5 — Dev-Only

### `pages/_dev/DesignSystemDemo.jsx`
**Aligns:** Its own purpose — it exists specifically to preview the shared library in isolation, which is exactly right.
**Should stay:** Its unlinked, internal-only nature.
**Should change:** Its content currently and faithfully previews the *old* system, by its own design ("every variant here wraps an existing class already defined in index.css"). Once Part 1's components migrate, this page should be updated to preview the *new* ones — otherwise it becomes actively misleading, the one place in the codebase showing an outdated version of the truth on purpose.
**Should be removed:** Nothing — update it, don't delete it.

---

## Migration Plan, Ranked by Impact

**A note on sequencing versus impact.** The Execution Plan's own Design System migration plan sequences admin surfaces before high-traffic customer pages specifically to de-risk — proving new components somewhere a fan never sees before touching the platform's most visible surfaces. That's a sequencing principle, not an impact ranking, and the two point in different directions here. The ranking below is by impact — how much a given change improves consistency and how far its effect reaches — not by which order is safest to build in. Reconciling them: Part 1 (the shared library itself) is both the highest-impact *and* the lowest-risk starting point, since updating the library's own tokens touches zero live pages until something actually imports it. From there, this plan agrees with the Execution Plan's own instinct to prove real-page adoption on Admin before moving to Home and the core commerce flow.

### High Impact

1. **Migrate `Button.jsx`, `Panel.jsx` (renamed from `Card.jsx`), `Badge.jsx`, `Input.jsx`, `Modal.jsx` to the new tokens** — Part 1. This is the single highest-leverage step in the entire plan: every page that later adopts these inherits the fix for free, and none of this touches a live page yet.
   **Status (2026-08-01): Partially done.** `Button` (collapsed to Primary/Secondary/Text) and `Panel` (new, replaces `Card`) are migrated. `Badge`, `Input`, `Modal` are unchanged — still next.
2. **Migrate `Header.jsx`** — Part 2. Appears on every single page; carries the platform's most visible remaining pill shape (the scroll-morph navbar) and its heaviest shadow. The highest-effort item here, and the one with the widest reach.
   **Status (2026-08-01): Done — and the outcome went further than this entry predicted.** The scroll-morph pill is gone entirely, not just re-skinned: the header is now two independent bordered boxes (logo/menu, cart) with real transparent space between them, not one continuous bar. The persistent link row this document elsewhere assumed would stay is gone too — on the home hero the full nav renders as plain text over the hero image and collapses into a small panel attached to the logo box once scrolled (or on any other page), opened by the hamburger. No blur, no shadow, no pill radius anywhere in it now. Account access, sports links, and sign-in/out all live in that one small attached panel — the old full-height dark slide-in drawer with its own search-suggestions UI was deleted outright, not migrated.
3. **Migrate `ProductCard.jsx`** — Part 2. Reused across Home, Products, and every future product-grid surface; one fix cascades everywhere products are listed.
   **Status (2026-08-01): Done for the Products grid.** `radius.default`, `border-2`, and the merch.* badge tones (New/Sale/Virtual Try-On) are live, plus a sold-out marquee treatment and a `totalStock`-driven out-of-stock state not in this document's original scope. Home.jsx still renders its own bespoke product cards (see item 4 — still not started), so this component's new treatment isn't yet visible there.
4. **Migrate `Home.jsx` and delete its dead Instafeed block** — Part 3. The platform's highest-traffic page, the one that's already closest in spirit to the target direction, and the clearest possible proof that the new system works in production, not just in documentation.
   **Status: Not started.**

### Medium Impact

5. **Migrate `StatsCard.jsx` and `AdminLayout.jsx`** — Part 4. Two components carrying nearly the entire admin surface's visual debt; fixing both cascades across all nine remaining admin pages with comparatively little direct work on any of them.
   **Status: Not started.**
6. **Migrate `Checkout.jsx`'s three ad hoc alert boxes onto a real Alert component** — Part 3. A high-stakes page (real money, real trust moment per the Trust Model) where the current three-different-colors-for-similar-messages pattern is a real, visible inconsistency, not just a token mismatch.
   **Status: Not started.**
7. **Migrate `ProductDetail.jsx`** — Part 3. The largest single page by line count and by raw pattern count, but the changes required are mechanical once Input/Button/Panel exist — no structural rethinking needed.
   **Status: Not started.**
8. **Migrate `Products.jsx`'s filter/sort controls and pagination** — Part 3. Real, visible, but lower-stakes than Checkout or Product Detail.
   **Status (2026-08-01): Done — and it grew beyond "filter/sort controls."** Pagination is typographic per spec. The old always-visible Shop All/Men/Women/Youth/Sale navbar row was removed from `Header.jsx` entirely and rebuilt as tabs in this page's own landing area instead, with the H1 switching to "Shop <Category>" on selection. Sort and Filters are now a matched pair of bordered dropdown buttons (structural pattern only, not a literal copy of any reference site's colors/type) rather than a `<select>` plus chip row. A collapsible search control (icon → input, with debounced suggestions) was added next to them, replacing the header's old full-width search overlay. None of this was anticipated by the original audit — it emerged from rounds of real side-by-side comparison against a reference, not from this plan.
9. **Consolidate the duplicate status-color-mapping objects in `AdminDashboard.jsx` and `AdminOrders.jsx` into one Badge-driven pattern** — Part 4.

### Low Impact

10. **Migrate the account/order pages** (`Account.jsx`, `Orders.jsx`, `OrderConfirmation.jsx`, `CompleteProfile.jsx`) — Part 3. Real but mechanical; no page-specific decisions remain once the shared components exist.
11. **Migrate the auth flow** (`Login.jsx`, `Register.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx`, `VerifyEmail.jsx`) — Part 3. Same reasoning — these will look nearly correct automatically once Input and Button migrate.
12. **Migrate the remaining admin CRUD pages individually** (`AdminProducts.jsx`, `AdminOrders.jsx`, `AdminLeagues.jsx`, `AdminPickup.jsx`, `AdminProductForm.jsx`, `AdminSettings.jsx`, `AdminShippingReports.jsx`, `AdminUsers.jsx`, the `AdminReports.jsx` sub-sections) — Part 4. Most of the real work happens upstream in item 5; what's left here is cleanup, not redesign.
13. **Migrate `DataPolicy.jsx` and `TermsOfService.jsx`** — Part 3. Lowest-traffic, lowest-risk, purely typographic.
14. **Update `pages/_dev/DesignSystemDemo.jsx`** to preview the new components — Part 5. Internal-only, but worth doing once the components it previews have actually changed, so it stops being a quietly outdated reference.

---

## How to use this plan

Each numbered item above should be its own change, reviewed and shipped on its own — not batched into one large "design system migration" commit, consistent with the Engineering Handbook's own migration strategy of proving a change on the smallest reasonable blast radius before it spreads. Old and new patterns are expected to coexist on the site for the entire duration of this plan; a page not yet migrated isn't a bug, it's simply not its turn yet.
