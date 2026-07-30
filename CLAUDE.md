# PusoStore — AI Context

This document exists to bring an AI coding assistant up to speed the way a senior engineer joining the founding team would be — not a tutorial, a briefing. It condenses eleven prior documents (`docs/`) into one dense reference. Where you need the full reasoning behind something here, the source document is named; read it before overriding what's stated here.

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

Evolving the existing stack, not replacing it — React + Vite, Node.js + Express, MongoDB, Cloudinary, Maya, Replicate/WaveSpeed all stay. *(Technical Architecture)*

| Layer | Decision | Why |
|---|---|---|
| Backend | Modular monolith — one deployed service, internally organized around the 17 Capability Model boundaries | Microservices solve a scale problem this platform doesn't have yet |
| Database | Keep MongoDB, but use its multi-document transactions for real | Audit found zero transaction usage anywhere — the direct cause of the stock-overselling bug |
| Frontend | React components, mirroring the IA's Organization→Team→Collection→Product hierarchy | Contextual Commerce needs the same Product component embeddable anywhere |
| Caching | Redis — never for Inventory | Inventory must always be read live, per Commerce Engine's anti-overselling rule |
| Queue | Redis-backed — AI generation and Notifications run async | Audit found Virtual Try-On blocking a request for up to 75 seconds |
| Events | Same Redis infra, lightweight pub/sub | Notifications is strictly downstream of every event-producing capability, never upstream |
| Search | Dedicated managed search service, not MongoDB `$text` | IA requires identity-aware, multi-entity-type, fuzzy search (Organizations/Teams/Athletes, not just product names) |
| Storage/Media/CDN | Cloudinary, actually using its transformation features | Audit found full-res images shipped everywhere with zero transformation |
| Payments | Maya, with mandatory webhook signature verification | Audit's single most severe finding: the webhook trusted unverified payloads |
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
| **Order** | A Customer's purchase commitment. Can span multiple Organizations. |
| **Fulfillment** | The abstract "deliver on the promise" concept. Shipment is its Merchandise-specific form. |
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
- **No webhook payload is trusted without signature verification**, on any current or future integration.
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
