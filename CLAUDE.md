# PusoStore — AI Context

This document exists to bring an AI coding assistant up to speed the way a senior engineer joining the founding team would be — not a tutorial, a briefing. It condenses twelve prior documents (`docs/`) into one dense reference. Where you need the full reasoning behind something here, the source document is named; read it before overriding what's stated here.

Format note: this document breaks from the prose style of the other eleven on purpose. Those are written for people reading once, in order, for understanding. This one is written for repeated lookup under time pressure — tables and terse statements are the right tool for that job here, not a stylistic lapse.

---

## How PusoStore Thinks

Six inversions govern every decision on this platform. Get these wrong and every other rule in this document will be applied to the wrong problem.

1. **Organization-first, not product-first.** Fans follow institutions (a team, a league, an athlete), not product categories. The primary data model, navigation, and trust system are all built around Organization as the anchor. *(Decision Log ADR-001, Domain Model)*
2. **Identity before inventory.** Navigation, search, and discovery route a fan to *who* they support before *what* they might buy. Sport/gender/category are filters, never structural floors. *(Information Architecture)*
3. **Trust is infrastructure, not a feature.** It's granted, monitored continuously, and revocable — never a badge bolted onto a product page. *(Trust Model, Decision Log ADR-004)*
4. **Merchandise-first today; category-agnostic underneath.** The platform sells one thing right now on purpose, but the core commerce architecture (`Commerce Item`) was built so Tickets, Experiences, Equipment, and Membership attach later without a redesign. *(Decision Log ADR-003, Commerce Engine Stage 9)*
5. **Contextual commerce over isolated commerce.** A purchase surfaced inside a broadcast moment or a Story should feel like a continuation of that moment, not a hard cut to a generic shop. *(Decision Log ADR-005)*
6. **Discovery and Storefront are different jobs.** The homepage routes and introduces; an Organization's own space is the destination a fan returns to and feels ownership over. Never conflate them into one compromise surface. *(Decision Log ADR-006)*

**North star, for any ambiguous call:** does this decision deepen trust between a fan and the Organization they follow? Everything else is downstream of that question. *(Platform Strategy §12)*

---

## Architecture

Evolving the existing stack, not replacing it — React + Vite, Node.js + Express, PostgreSQL, Cloudinary, Xendit, Replicate/WaveSpeed all stay. *(Technical Architecture, Decision Log ADR-007)*

> **Database changed since Technical Architecture v1.0 was written.** The original MongoDB deployment was permanently removed with no data to preserve; persistence now runs on PostgreSQL (Railway) via Prisma. See ADR-007 for why this doesn't contradict "evolve the foundation, don't replace it" — the foundation itself changed underneath the principle, the principle didn't get abandoned.

> **Payment gateway changed since Technical Architecture v1.0 was written.** Xendit is now the primary gateway (2026-08-19); Maya is not removed, just no longer the default for new checkouts — its gateway module, webhook route, and IP-allowlist middleware stay live so any order already mid-checkout on it still resolves, until a follow-up pass removes it once none remain. See ADR-010 for the full reasoning, including why the two gateways are verified differently (Xendit signs its webhooks with a real token; Maya's ADR-008 workaround was built specifically because it doesn't).

| Layer | Decision | Why |
|---|---|---|
| Backend | Modular monolith — one deployed service, internally organized around the 17 Capability Model boundaries | Microservices solve a scale problem this platform doesn't have yet |
| Database | PostgreSQL (Railway) via Prisma, with real transactions used for every Commerce Engine "atomic" operation | Same requirement as before (fix the stock-overselling bug) — MongoDB is simply no longer the deployment satisfying it |
| Frontend | React components, mirroring the IA's Organization→Team→Collection→Product hierarchy | Contextual Commerce needs the same Product component embeddable anywhere |
| Caching | Redis — never for Inventory | Inventory must always be read live, per Commerce Engine's anti-overselling rule |
| Queue | Redis-backed — AI generation and Notifications run async | Audit found Virtual Try-On blocking a request for up to 75 seconds |
| Events | Same Redis infra, lightweight pub/sub | Notifications is strictly downstream of every event-producing capability, never upstream |
| Search | Dedicated managed search service, not MongoDB `$text` | IA requires identity-aware, multi-entity-type, fuzzy search (Organizations/Teams/Athletes, not just product names) |
| Storage/Media/CDN | Cloudinary, actually using its transformation features | Audit found full-res images shipped everywhere with zero transformation |
| Payments | Xendit (primary, Decision Log ADR-010) — its webhook is verified via a real signed token (`x-callback-token`), so the verified payload is trusted directly, no re-pull needed. Maya (legacy, Decision Log ADR-008) stays live in parallel through the cutover window for orders already in flight on it; it has no signature scheme, so its webhook is instead treated as a bare wake-up signal and re-verified via an authenticated pull against Maya's own status API, with IP allowlisting as the perimeter control | Audit's single most severe finding: the webhook trusted unverified payloads. Xendit's fee is also passed to the customer per payment channel, disclosed before checkout locks in a total, never absorbed |
| Auth | JWT + Google OAuth, add session revocation | 7-day token currently can't be invalidated on password change |
| Deployment | CI/CD gating every deploy on tests | No promise in this document series can hold over time without this |
| Observability | Structured logging + real error tracking | Trust's "ongoing monitoring" and Analytics literally cannot function on console.log |

---

## Domain (the nouns)

Full detail: `docs/DOMAIN_MODEL.md`. 28 concepts across 5 layers. Four were added beyond the original brief because the model didn't hold together without them: **Trust & Verification, Athlete, Discovery Hub, Membership**.

| Layer | Concepts |
|---|---|
| Institutions | Organization, Team, Athlete, Partner, Trust & Verification |
| Commerce | Commerce Item, Merchandise, Product Variant, Collection, Drop, Promotion, Membership *(extension point, not built)* |
| The Fan | Customer, Wishlist, Favorite, Review, AI Confidence |
| Transaction & Fulfillment | Order, Payment, Shipment, Fulfillment, Inventory |
| Presence & Story | Storefront, Discovery Hub, Story, Media, Season, Campaign |

Key structural facts, easy to get wrong:
- A **League** (UAAP, PBA, PVL) is itself an **Organization** — related to member schools/clubs through *participation*, not *ownership*. Ownership is reserved for Organization→Team.
- An **Athlete** is modeled as its own lightweight Organization, plus separate affiliation links to whichever Team-owning Organizations they've represented over a career.
- An **Order** can span multiple Organizations in one checkout; Fulfillment, refunds, and Trust signals all decompose per-Organization beneath it.
- **Media** has no independent meaning — it never exists without a required reference to what it's attached to. No standalone gallery, no orphaned assets.

---

## Capabilities (the verbs)

Full detail: `docs/CAPABILITY_MODEL.md`. 17 capabilities, 5 groups. **Rule: any new feature should name exactly one capability that owns it.** Needing two to jointly explain a feature means the boundary needs revisiting, not that the feature should ship anyway.

| Group | Capabilities |
|---|---|
| Trust & Institutions | Organizations, Trust, Identity, Partner |
| Commerce Spine | Commerce, Payments, Fulfillment, Operations |
| Fan-Facing Intelligence | Discovery, Search, Confidence, AI |
| Narrative & Relationship | Content, Media, Customer, Notifications |
| Measurement | Analytics |

Layer dependency, bottom-up: **Identity** is foundational. **Trust/Organizations/Partner** sit on it. **Commerce/Payments/Fulfillment/Operations** transact through those institutions. **Discovery/Search/Confidence/AI** help fans navigate honestly. **Content/Media/Customer/Notifications** make it feel like fandom. **Analytics** watches everything, decides nothing.

---

## Boundaries — confusions to never collapse

| These two | Are not the same, because |
|---|---|
| Trust vs. Confidence | Trust judges *who's selling* (institutional legitimacy). Confidence judges *what the platform just told you* (AI output reliability). |
| Discovery vs. Search | Discovery surfaces what a fan didn't ask for. Search finds what they did. |
| Operations vs. Fulfillment | Operations decides what's *safe to promise* (capacity/forecasting). Fulfillment *keeps* the promise once made. |
| Shipping Confidence vs. Fulfillment Trust | Shipping Confidence is a promise made once, per order. Fulfillment Trust is whether that promise has been kept, repeatedly, long enough to be believed without re-proving it. |
| Collection vs. Bundle vs. Drop vs. Campaign | Collection = *what's* for sale (curatorial). Bundle = multi-item *pricing*. Drop = *how/when* it's released (scarcity). Campaign = *why now* (narrative orchestration around a moment). |
| Authenticity vs. Official Verification | Authenticity is the claim ("this is real"). Official Verification is one mechanism backing it — not the same thing, and not the only one. |
| AI vs. Confidence vs. Sizing Confidence | AI produces the raw prediction. Confidence is the general honesty discipline. Sizing Confidence is one specific customer-facing application of it. |

---

## Business Rules (Commerce Engine — binding, not guidance)

Full detail: `docs/COMMERCE_ENGINE.md`.

- Pricing, inventory, and fulfillment always operate at the **Product Variant** level, never the listing level.
- A Commerce Item cannot go "Available" until every Variant has a price and a stock figure — no half-published state.
- Only the single best-for-the-fan Promotion applies by default. **No silent stacking** of Discounts/Bundles — any exception is an explicit, deliberate Organization choice.
- The price a fan sees at checkout start is the price they pay, for a bounded window.
- **Stock is reserved at Order placement, not Payment confirmation**, and releases automatically if checkout doesn't complete within a bounded window.
- **Displayed availability always reflects committed reservations — never a hopeful "should still be available" state.** This is the direct fix for the overselling failure mode referenced throughout this series.
- A Drop's capacity is certified by Operations *before* it's scheduled; its end condition (time or sell-out) is fixed before going live, never changed mid-run.
- Checkout is atomic — Pricing, Promotions, Inventory reservation, Shipping, Taxes, and Payment authorization resolve together or the whole thing fails. No partial success.
- Shipping and tax are calculated as part of that same atomic resolution — never revealed as a later surprise.
- A refund is scoped to the specific Organization's portion of an Order — refunding one Organization never touches Payment already settled for another's item in the same Order.
- A return is a coordinated reversal: Inventory, Payment, Fulfillment status, and — if the reason is authenticity/quality — a signal fed to Trust's ongoing monitoring.
- **Baseline return terms are consistent across every Organization.** An Organization can be more generous, never less.

---

## Coding Principles

Full detail: `docs/ENGINEERING_HANDBOOK.md`.

- **A file does one job.** Split it when it starts doing more than one — not preemptively, not indefinitely deferred. (The audit's god components — 800+ line files — were five components sharing one file.)
- **No abstraction before the second real use case.** Three similar lines beat a speculative abstraction.
- **The code's vocabulary matches the Domain Model's vocabulary, exactly.** Never "product" in one file and "item" in another. Vocabulary drift is how the audit found a README crediting the wrong AI provider for months.
- Folder structure mirrors the Capability Model's boundaries. A capability's internals are private; cross-capability calls go through a defined interface.
- Testing is risk-proportional: checkout, payment, inventory reservation, and webhook verification carry the highest bar on the platform.
- Refactor inside the PR that already needs the code changed — never a separate "cleanup" PR.
- Every migration: prove it on the smallest reasonable blast radius first, keep old and new coexisting during transition, have a rollback path before the risky change ships.

---

## CMS-First Rule (Homepage & Site Content)

**Business content must never be hardcoded.** This was audited and completed (2026-08) — the homepage, header, and footer used to be a mix of live Admin Dashboard data and JSX/asset-import content a developer had to edit and redeploy to change. That gap is closed; do not reopen it.

The only things allowed to live in code are what CLAUDE.md's own boundary already implies — presentation, not content:

- design system (tokens, typography, spacing)
- layouts and reusable UI components
- icons and animations (an icon's *shape* is code; which icons appear and in what order is CMS data)
- utility constants (thresholds, feature flags, non-editorial config)

Everything else — headlines, descriptions, images, CTA text/links, colors tied to a campaign or institution, nav labels/destinations, footer copy, FAQ, logos — is Customer/Organization/Marketing-facing content and belongs in the database, editable from the Admin Dashboard.

**Before any new homepage/site-content feature is considered done, it needs all six layers**, in this order:

1. **Database model** (Prisma)
2. **Repository** (`repositories/*.js`)
3. **API** (admin-gated CRUD + a public read)
4. **Admin page** (`pages/admin/*.jsx`) — if the backend exists but nothing in the Admin Dashboard can reach it, the feature is incomplete, not "backend-done." This was the exact gap the 2026-08 audit found: `Campaign` (placement=hero), `FAQItem`, and `PromoMessage` all had full backend CRUD with zero frontend consumption.
5. **Frontend service** (`services/*.js`)
6. **Frontend component** consuming the service — never a hardcoded fallback for content the CMS is supposed to own. An empty/unconfigured CMS section should render as absent (or, for Hero/AI Try-On specifically, fall back to the one approved default the section was launched with) — never as stale content nobody can find or edit again.

Content models already wired end-to-end this way: `Campaign` (Hero + AI Try-On placements), `FeaturedTeam`, `PartnerLogo`, `FAQItem`, `PromoMessage` (Announcement Bar + Marquee), `NavigationLink`, `HomepageSection` (section order/visibility), and `FooterSettings`/`FooterLink`/`SocialLink`/`PaymentIcon`. Use these as the reference pattern — repository shape, admin-gated route conventions, `active`/schedule-window filtering — before adding a new one.

---

## My PUSO (Customer Portal)

Full detail: `docs/MY_PUSO_MANIFESTO.md`. My PUSO is the customer portal's real name and its real identity — a fan's personal home inside PusoStore, not an account settings page. Four concepts govern it, replacing what would otherwise be a flat settings-style tab bar:

| Concept | Is | Is not |
|---|---|---|
| **Home** | A living feed of what changed since the fan's last visit | A dashboard of statistics about them |
| **Locker** | A fan's growing personal collection — Merchandise today, Tickets/Memberships/Digital Collectibles/Rewards later, same shape | "Purchases" or order history |
| **Fit Check** | The AI Try-On feature, treated as identity and self-expression | A utility tool buried in account settings |
| **Following** | The mechanism (built on the existing `Favorite` domain concept) that makes fandom, not shopping, a reason to return | "Organizations," a management page |

Settings (Profile, Addresses, Security, Connected Accounts, Notification Preferences) still exists — it stays a secondary utility reached from the avatar, never competing with the four concepts above for top-level attention.

**Every feature proposed for My PUSO must pass the test in the manifesto's §7 before it ships**: does it give the fan a reason to come back tomorrow; does it fit inside Home, Locker, Fit Check, or Following without inventing a fifth concept; does it treat the fan as a supporter of Philippine sports first and a customer second. A feature that fails any of these doesn't belong in My PUSO, even if it's a reasonable feature elsewhere on the platform.

---

## Terminology

Use these words exactly as defined. If a term isn't here, check `docs/DOMAIN_MODEL.md` before inventing usage.

| Term | Definition |
|---|---|
| **Organization** | A real institution — federation, club, school, barangay league, or an individual athlete's personal brand. The top-level anchor for everything. |
| **Team** | A specific squad within an Organization. Conditional — only exists where an Organization fields more than one. |
| **Athlete** | An individual competitor, modeled as its own lightweight Organization plus affiliation links to Teams represented. |
| **Partner** | A non-institutional commercial collaborator (co-brand, licensing, logistics). No Storefront, not publicly trust-badged. |
| **Commerce Item** | The category-agnostic abstract listing. Merchandise is its only concrete category today. |
| **Merchandise** | The concrete, physical-goods Commerce Item category sold today. |
| **Product Variant** | The actual purchasable unit — a specific size/color combination. What Inventory tracks. |
| **Collection** | A curated, usually persistent grouping of Commerce Items. Not a pricing mechanism. |
| **Drop** | A time-boxed, scarcity-driven release. Governs timing/availability, not price. |
| **Promotion / Discount / Bundle** | Promotion = eligibility/timing rule. Discount = single-item price cut. Bundle = multi-item combined pricing. |
| **Membership** | Extension point, not built. A durational Customer-to-Organization relationship. |
| **Customer** | The fan. Holds identity, history, Favorites, Wishlist. |
| **Favorite** | Followed Organizations/Teams — identity, not purchase intent. |
| **Wishlist** | Saved Commerce Items — purchase intent, not identity. |
| **Order** | A Customer's purchase commitment. Can span multiple Organizations. Its own `paymentStatus`/`paymentMethod` fields stay the fast "what's the current state" read; **Payment** underneath carries the detailed history (Decision Log ADR-008). |
| **Payment** | One checkout-gateway attempt against an Order — one-to-many, not a single mutable field on Order. A regenerated session after expiry is a new Payment row, not an overwrite; "the current payment" is just the most recent row. |
| **Fulfillment** | The abstract "deliver on the promise" concept. Shipment is its Merchandise-specific form. Shipment carries its own granular, staff-facing status, decoupled from Order's coarse customer-facing `orderStatus` the same way Payment is decoupled from Order (Decision Log ADR-009). |
| **Return** | The customer-initiated request to send Commerce Items back, its own entity (`ReturnRequest`/`ReturnItem`) with a real state machine — not a status value on Order or Shipment (Decision Log ADR-009). |
| **Refund** | One reversal of money against a specific Order — one-to-many, mirroring Payment's own shape, not a single mutable field. Only `Refund.status = succeeded` ever sets `Order.paymentStatus = 'refunded'` (Decision Log ADR-009). |
| **Storefront** | An Organization's own branded destination. |
| **Discovery Hub** | The platform-owned homepage — routing and introduction, owned by no single Organization. |
| **Story** | Narrative content about an Organization/Team/Athlete/Campaign. |
| **Media** | Raw assets (images/video). Never independently meaningful. |
| **Season / Campaign** | Season = a real-world competitive time period. Campaign = commerce orchestration around a moment within one. |

---

## Things AI Must Never Change

These are hard boundaries from `docs/AI_CAPABILITY.md` and `docs/PLATFORM_STRATEGY.md`. Not style preferences — violating these breaks a stated trust guarantee.

- **Trust & Verification grant/revoke decisions stay human.** An AI system may flag anomalies. It never grants, denies, or revokes an Organization's verified status.
- **The authored voice of a Story belongs to the Organization.** AI may assist with drafting/translation/tagging — never author an Organization's narrative wholesale on its behalf.
- **Support during a Trust-critical moment (Returns, disputes, authenticity concerns) always has an immediate human path.** Never route these to automation as the default.
- **Pricing exceptions and Promotion-stacking overrides require an explicit human Organization decision.** Never auto-approved.
- **Drop capacity certification keeps a human sign-off**, even with AI forecasting assisting the decision.
- **An Athlete's identity, voice, or likeness is never AI-generated without their own authorization.**
- **The Organization-first data anchor is never "simplified" back to flat sport/league/team strings.** Everything in this document depends on it remaining real.
- **Inventory is never cached or read optimistically.** Live, every time.
- **No webhook payload is trusted at face value** — every current or future integration must independently verify it's genuinely from the provider before acting on it. Signature verification is the mechanism when a provider offers one, and is sufficient on its own once checked — Xendit signs its webhooks with a real token, so its payload is trusted directly once that token is verified (Decision Log ADR-010). Maya doesn't offer one, so IP allowlisting plus mandatory re-verification via an authenticated pull is the substitute (Decision Log ADR-008) — the rule is "never act on an unauthenticated payload," not "always re-pull the same way."
- **No Organization's return terms fall below the platform-wide baseline Guarantee.**

---

## Extension Points

Where new work should attach without redesigning the foundation. Full detail: `docs/DOMAIN_MODEL.md` §Future extension points, `docs/COMMERCE_ENGINE.md` Stage 9.

- **Commerce Item** is the category-agnostic anchor. Tickets, Experiences, Equipment, and Membership are new concrete categories beneath it — Pricing, Promotions, Checkout, and Orders need no changes.
- **Fulfillment** needs a new concrete sibling per category: an access grant (Tickets), a booking confirmation (Experiences). Shipment stays specific to Merchandise/Equipment.
- **Payments** needs exactly one new capability for Membership: recurring capture. Everything else already generalizes.
- **Athlete-as-Organization** and **League-as-Organization** are already-proven patterns — any new institutional type should follow the same shape rather than inventing a new one.
- **Discovery Hub** automatically becomes a cross-category surface as new categories launch — no rebuild required.

---

## Future Roadmap

Full detail: `docs/EXECUTION_PLAN.md`.

**Phase 1 — Foundation & Safety Net** *(blocks everything else)*: Organization-first data migration; transaction/webhook/ownership-check fixes; CI/CD and observability; Redis infra; Design System primitives built in isolation.

**Phase 2 — Identity-First Experience**: Full IA rollout (League/Athlete browsing, identity breadcrumbs, personalized Discovery); Trust signals surfaced at decision points; Design System migrated to customer-facing pages; AI's Near-Future layer (Sizing, Search, Recommendations); the Drop mechanic live; contextual commerce live.

**Phase 3 — Growth & Extension**: Diaspora/OFW-specific shipping and gifting flow; **Membership** as the first new commerce category (chosen first because it needs the one genuinely new piece of infrastructure — recurring payment capture — making it the real test of whether the category-agnostic architecture holds); AI's Long-Term layer; deliberate grassroots/barangay-tier onboarding.

**Release ladder:** MVP (Phase 1 + one pilot Organization on the new model) → V1 (full migration, Trust live, Design System live everywhere) → V2 (AI Near-Future, Drops, contextual commerce) → V3 (Membership, diaspora logistics, AI Long-Term).

**The one rule that governs sequencing above all others:** nothing in Phase 2 or 3 gets built against the old flat data model "to save time." It gets built once, correctly, after Phase 1 — or it gets built twice.
