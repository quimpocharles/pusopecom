# PusoStore Decision Log

This is the architecture decision record (ADR) for PusoStore. It exists so that years from now, when someone asks "why did we design it this way?", the answer is written down — not reconstructed from memory or guessed at from the code.

Each entry captures a decision that shaped the platform, in the same five parts: the context that forced the decision, the decision itself, the alternatives that were seriously considered, why the chosen approach won, and what it implies for work that comes later. Decisions here are not easily reversible — they're the ones that every other feature, migration, and roadmap item ends up depending on. When one of these needs to change, add a new entry rather than editing history; note which prior entry it supersedes.

Entries are numbered in the order they were made, not in order of importance.

---

## ADR-001 — PusoStore is organization-first, not product-first

**Context**
Conventional ecommerce platforms — including PusoStore's own MVP — organize around the product catalog as the primary entity: a shop is a bucket of products, and sport/league/team exist only as filter attributes on top of it. But PusoStore exists to serve fans of specific institutions — the national team, a PBA club, a UAAP school, a barangay league — and fans don't discover "products," they discover and follow *organizations* they already have a relationship with. The existing data model (`Product.sport` / `Product.league` / `Product.team` as free-text strings, with no real ownership or hierarchy behind them) makes this structurally impossible: there is no entity in the system that represents "Ateneo Blue Eagles" or "Gilas Pilipinas" as a thing with its own identity, storefront, trust status, and admin ownership.

**Decision**
Organization is the top-level architectural entity in PusoStore. Every product, storefront, trust signal, and commerce relationship is scoped to an Organization first, and to a sport/category second.

**Alternatives considered**
- *Product-first (status quo).* Rejected — it treats fandom as a filter attribute rather than an identity, and it cannot support independently branded, independently operated storefronts for the leagues, schools, and barangay teams that make up the platform's real institutional base.
- *Sport → League → Team as a fixed hierarchy.* Rejected — not everything fits a rigid three-level tree. National teams don't sit under a "league" the way a PBA club does; a university athletics department fields teams across multiple sports under one institution, which a strict sport-first tree can't represent cleanly.
- *Marketplace-first (many independent seller accounts, à la Shopee).* Rejected outright — it commodifies sellers rather than curating trusted, licensed institutions, which directly contradicts the platform's founding position that PusoStore is not another Shopee.

**Why the chosen approach won**
It mirrors how fans actually organize their fandom — around institutions, not category tags — and it gives trust, licensing, ownership, and storefront branding a natural home: an organization can be verified as a unit, can own multiple teams, and can present one coherent destination. A flat product catalog cannot deliver any of that no matter how it's filtered.

**Future implications**
Every future capability — trust badges, storefront theming, athlete profiles, the ticketing/experiences extension points in ADR-003 — attaches to Organization as the anchor. Onboarding a new barangay league or college athletics department becomes "create an Organization," not "bulk-upload products with matching tags." This requires introducing an Organization entity above the existing League model, with Product re-scoped to reference an Organization (and optionally a specific Team within it). This is the single hardest decision in this log to reverse — everything downstream inherits it.

---

## ADR-002 — Organizations may own multiple teams

**Context**
Real Philippine sports institutions rarely map to a single team. A university fields many UAAP squads — basketball, volleyball, football — under one athletics department. A national federation may oversee several national squads across age groups and formats. Even a single barangay could field more than one team. The current `League` model already gestures at this (`League.teams: [String]`) but treats teams as an unstructured list with no ownership, branding, or independent identity — flagged separately as a content gap in the PusoStore platform audit.

**Decision**
An Organization is a container that can own any number of Teams, potentially spanning multiple sports. Each Team can carry its own branding (name, colors, roster, logo) while inheriting trust/verification status and commerce infrastructure from its parent Organization.

**Alternatives considered**
- *One Organization = one Team (1:1).* Rejected — it would force real institutions to fragment into multiple accounts (a university would need a separate "organization" per sport), splitting a single trusted brand into several unrelated ones instead of consolidating it, and it contradicts how these institutions actually operate.
- *Team as the top-level entity, with Organization as a loose metadata tag.* Rejected — it doesn't support organization-level capabilities like verification, admin roles, and revenue arrangements cleanly, and it would just recreate today's flat, ownerless `teams: [String]` list under a new name.

**Why the chosen approach won**
It matches the real shape of Philippine sports institutions, and it lets trust and admin access be established once at the Organization level and inherited by every Team beneath it — essential for onboarding at barangay-league scale without re-verifying from scratch for every team a school or federation fields.

**Future implications**
Requires role-based access at two levels — Organization admin and Team-level manager/coach — and a storefront IA that can present "shop by team" within one Organization's destination. Product must reference both an Organization and, optionally, a specific Team. It also sets up ADR-003's future categories cleanly: an Organization selling event tickets will naturally need to specify which of its teams or events a given ticket belongs to.

---

## ADR-003 — Merchandise is the initial commerce category; tickets, experiences, and equipment are planned extension points, out of scope for MVP

**Context**
Puso Pilipinas' broadcast and livestream relationships make ticketing and live "experiences" (meet-and-greets, watch parties) an obvious and tempting adjacent category — commerce tied to a live event plays directly into the platform's content-commerce strengths. But the current platform is merchandise-only end to end (product catalog, cart, checkout, fulfillment), and ticketing carries fundamentally different operational demands: time-boxed, non-returnable inventory, seat/venue mapping, anti-scalping controls, and different payment/refund regulatory exposure.

**Decision**
MVP scope is merchandise only. Tickets, experiences, and equipment/gear commerce are named and explicitly anticipated as future categories — the Organization/Team model in ADR-001/002 is deliberately built to support them later — but none are built now.

**Alternatives considered**
- *Build ticketing alongside merchandise from day one.* Rejected for MVP — it would dilute focus at exactly the moment the organization-first foundation (ADR-001/002) most needs to be gotten right, and ticketing's operational requirements are different enough that bolting it on early risks compromising both.
- *Build a generalized "commerce object" abstraction now, treating merchandise, tickets, and experiences as interchangeable line-item types from the start.* Rejected as premature abstraction — the platform doesn't yet know the real operational shape ticketing or experiences will need, and guessing wrong on an abstraction is more expensive to unwind than adding a second concrete type later.

**Why the chosen approach won**
It respects the platform's own principle ordering — simplicity and maintainability before scalability — and its phased roadmap, which sequences customer-experience work ahead of growth-platform expansion. Get the organization-first merchandise foundation genuinely right first; every future category depends on it.

**Future implications**
The one place this decision demands foresight, not restraint: the Organization/Team anchor from ADR-001/002 must stay category-agnostic enough that Tickets and Experiences can attach to it later without re-architecting the core entity model. The cost of guessing wrong on *that* anchor is much higher than the cost of guessing wrong on any single category's details — which is exactly why those details are deferred and the anchor is not.

---

## ADR-004 — Trust is a core platform capability

**Context**
Authenticity carries unusually high weight in the Philippine market: counterfeit and unlicensed sports merchandise is genuinely widespread, both in physical markets and increasingly across online marketplaces, and general online-shopping scam anxiety is a live, everyday concern. "Officially licensed" is therefore a real, load-bearing trust signal a fan has to actively choose to pay for over a visually identical fake — not a legal footnote. The current platform has no systematic way to signal this: legitimacy is assumed, not demonstrated.

**Decision**
Trust — verified organization status, licensing authenticity, and fulfillment reliability — is a first-class platform capability with its own data model and visible UI surface, not an implicit assumption or a claim confined to an About page.

**Alternatives considered**
- *Implicit trust via curation only* (vet organizations before they're allowed onto the platform, but surface no visible signal). Rejected — invisible trust doesn't help a fan distinguish PusoStore from a counterfeit seller at the actual moment of purchase decision, which is exactly where the signal needs to appear.
- *Generic marketplace trust patterns* (star ratings and reviews only, as on Shopee/Lazada). Rejected — reviews alone don't address the specific counterfeit-vs-genuine concern this market has, and star ratings are precisely the generic-marketplace pattern the platform is positioned against.
- *One-time verification at organization onboarding, with no ongoing signal.* Rejected — fulfillment trust is earned continuously through delivery performance, not granted permanently at signup; a badge that no longer reflects current reliability is worse than no badge.

**Why the chosen approach won**
It's the direct product answer to the platform's clearest structural advantage over Shopee, Lazada, and unlicensed sellers: verified, direct-from-institution authenticity that a marketplace aggregator cannot credibly claim. Trust is not a feature bolted onto commerce here — it's a differentiator competitors are structurally unable to copy.

**Future implications**
Requires a "verified organization" flag and badge system, a fulfillment-reliability signal surfaced to buyers (not just tracked internally), and product-level authenticity indicators tied back to the owning Organization from ADR-001 — meaning trust cannot be added later as a bolt-on without the organization-first foundation already in place. Also implies an ongoing review/moderation workload for onboarding and re-certifying organizations, which should be staffed and planned for rather than discovered as a surprise operational cost.

**Supersedes:** implicitly, the current MVP's lack of any verification/authenticity signaling.

---

## ADR-005 — Contextual commerce is preferred over isolated ecommerce experiences

**Context**
Puso Pilipinas' broadcast, livestream, and social audience are assets no commerce-only competitor has. The platform's own research points repeatedly to the same finding: purchase intent peaks at identity-affirming moments — a live match, a win, a viral highlight — not when a fan independently decides to go shopping. The current app is a fully isolated storefront with no connection to any broadcast or content context; a fan must form shopping intent and navigate to the store on their own.

**Decision**
Commerce surfaces are designed to be embeddable in and attachable to content and live moments — a livestream, a match recap, a highlight, an organization's page — rather than existing solely as a self-contained storefront a user must separately choose to visit.

**Alternatives considered**
- *Pure standalone ecommerce app (status quo).* Rejected as the primary pattern — it forfeits the one structural advantage Puso has that a commerce-only infrastructure player cannot replicate without also owning the content: presence at the moment of emotional peak.
- *Fully content-embedded commerce only, with no standalone storefront.* Rejected — organizations still need a durable, ownable destination fans return to outside of a live moment (browsing history, gifting, planned purchases). Contextual commerce complements the storefront model in ADR-006; it doesn't replace it.

**Why the chosen approach won**
It turns the platform's clearest asset — ownership of the content, not just rights to sell around it — into an architectural commitment instead of leaving it as an aspiration that never gets built because the commerce system was designed in isolation from day one.

**Future implications**
Product and checkout surfaces need to be built as embeddable components, not only full pages, from early in the platform's life — so they can be dropped into a livestream overlay, a recap article, or a social post later without a rebuild. Content and commerce cannot be treated as fully separate systems even at MVP stage, or this becomes exactly the kind of expensive later migration that ADR-001 was written to avoid.

---

## ADR-006 — The homepage is a discovery hub; organization storefronts are primary destinations

**Context**
The current homepage tries to be the primary shopping destination itself — product grids, generic sport-based tabs — rather than routing fans toward the specific organization they care about. Given ADR-001 (organization-first) and the observation that most returning fans already follow specific institutions rather than browsing generally, a single undifferentiated homepage-as-storefront works against both new-fan discovery and returning-fan identity at once.

**Decision**
The homepage's job is discovery and routing: surfacing trending organizations, live moments, and cross-pyramid highlights. Each Organization's own storefront is the destination fans bookmark, return to, and spend sustained time in.

**Alternatives considered**
- *Single unified storefront model (status quo).* Rejected — this is the direct cause of the platform's current lack of real organization browsing: a flat catalog with filters can't give any single organization its own identity or give a fan a reason to return to "their" team's shop specifically rather than a generic front page.
- *No homepage at all — every visit begins at a specific organization's storefront.* Rejected — new and undecided fans, gift shoppers, and fans following multiple organizations across the pyramid still need a neutral entry point to discover organizations they don't already follow. Removing the homepage would sharpen retention at the direct cost of acquisition.

**Why the chosen approach won**
It resolves the tension between acquisition (a discovery surface for fans who haven't chosen yet) and retention (a destination that feels owned by one team, not shared with every other team) by assigning each job to a different surface, rather than compromising one page to do both.

**Future implications**
Information architecture and routing need two distinct patterns from the start: homepage-as-hub (search, trending, cross-organization merchandising, editorial surfacing) and storefront-as-destination (per-organization theming, bookmarkable and shareable URLs, its own navigation). Success metrics should be tracked separately for each surface — homepage optimized for routing and click-through, storefront optimized for conversion and return visits — rather than judged by one blended conversion number, which would quietly pull the platform back toward the single-storefront compromise this decision explicitly rejected.

---

## ADR-007 — Persistence moves from MongoDB/Mongoose to PostgreSQL/Prisma on Railway

**Supersedes:** the Database decision in `TECHNICAL_ARCHITECTURE.md`, which explicitly recommended keeping MongoDB ("there's no architectural pressure here to migrate to a relational system, and doing so anyway would violate 'evolve the foundation, don't replace it' for no real gain").

**Context**
The production MongoDB database was permanently removed. There is no backup or export to migrate from — this is a fresh start at the data layer, not a live migration of existing records. The organization has standardized hosting on Railway, and Railway's native, well-supported offering is PostgreSQL, not MongoDB Atlas. TECHNICAL_ARCHITECTURE.md's original reasoning for keeping MongoDB — that the Organization/Team/League hierarchy fits a document database well, and that the real bug (Critical #3 in the platform audit, the stock-overselling race condition) was an absent-transactions problem rather than a wrong-database problem — was sound *at the time*, but it assumed continuity with an existing MongoDB deployment that no longer exists. That assumption is gone.

**Decision**
Adopt PostgreSQL, hosted on Railway, with Prisma as the ORM, replacing MongoDB and Mongoose across the backend. This is a persistence-layer migration only: existing API contracts, route paths, request/response payload shapes, business logic, and authentication are preserved deliberately and are explicitly not being redesigned as part of this change.

**Alternatives considered**
- *Provision a fresh MongoDB Atlas cluster and continue with Mongoose.* Rejected — it would keep the platform on a second hosting relationship (Atlas) alongside Railway rather than consolidating on Railway's native database offering, for no offsetting benefit now that there's no existing Mongo deployment or data continuity to preserve.
- *Migrate to Postgres without an ORM (raw SQL / a query builder).* Rejected — Prisma's schema-first workflow and generated client most closely replicate the ergonomics Mongoose already provided (model-shaped objects, migrations, type-safe queries), minimizing how much route and service code has to change to satisfy this decision's own preservation requirement.
- *Supabase instead of Railway-hosted Postgres.* Explicitly rejected — Railway is the standardized hosting target; introducing a second platform vendor for the database alone would contradict the reason for choosing Railway in the first place.

**Why the chosen approach won**
With the original MongoDB deployment gone and no data to preserve, the switching cost this decision previously weighed against no longer exists — the "don't migrate for no real gain" reasoning in TECHNICAL_ARCHITECTURE.md was conditioned entirely on there being a working MongoDB deployment worth not disturbing. Consolidating on Railway's native Postgres, rather than reconstituting a MongoDB Atlas dependency from scratch, is the lower-total-cost path forward given that constraint no longer holds.

**Future implications**
Every embedded Mongoose subdocument array with independent identity (`User.addresses`, `Product.colors`/`sizes`, `VenuePickupConfig.slots`) becomes a proper relational table with a foreign key, rather than a nested document — this is a net improvement for exactly the workflows the Commerce Engine and the original platform audit already flagged as needing real atomicity (stock reservation, checkout). MongoDB's TTL index behavior (used today for `UserActivity`'s 90-day auto-expiry) has no Postgres equivalent and needs an explicit scheduled job, following the same `node-cron` pattern the daily sales report already uses. MongoDB's `$text` search index needs a Postgres full-text search (`tsvector` + GIN index) replacement. All Mongoose ObjectId-keyed relationships (`_id`, `ref`) become Postgres UUID foreign keys — API responses must continue serializing these as `_id` to avoid a frontend payload change, which means Prisma's `id` field needs an explicit mapping step at the response boundary, not a database-level rename.

---

## ADR-008 — Payment is its own entity, decoupled from Order; checkout interruption is treated as recoverable, not failed

**Supersedes:** the implicit pre-existing design where `Order` *was* the payment record (`paymentMethod`/`paymentStatus`/`mayaPaymentId`/`mayaCheckoutUrl` living directly on it, one row, no history) — kept, not removed, as the fast "current state" read; and the "mandatory webhook signature verification" framing in this document's own Architecture table and AI Boundaries list, corrected to describe what Maya's API actually supports.

**Context**
The Pending Payment experience audited as incomplete: a customer whose Maya checkout was interrupted — tab closed, phone died, session lapsed — saw a stale "processing" order with no way to resume, no timeline, no expiration awareness, and no recovery path except rebuilding their cart. Underneath that UI gap sat a real architectural one: `Order` conflated "the purchase commitment" with "the payment attempt," meaning there was no history across retries, no computed session expiration (Maya's own Checkout API returns none), no proactive handling of an order nobody ever reported back on, and — the platform audit's single most severe finding — a webhook handler that trusted an unverified payload's claimed status outright.

**Decision**
`Payment` becomes its own entity, one-to-many with `Order` — each checkout attempt (the original, or a regenerated session after expiry) is its own row, not an overwritten field. `Order` keeps its existing payment fields as the fast current-state read; `Payment` is the detailed history underneath. Every payment-state resolution — a customer's poll, a webhook, or an hourly proactive sweep — converges through one atomic, idempotent resolution path (`applyPaymentResolution`), never three separate copies of the same stock-release/audit-log/notification sequence. A lapsed or failed payment is presented to the fan as recoverable ("Complete Payment" / "Generate New Payment Link"), never as a dead purchase, and the platform proactively emails and in-app-notifies rather than waiting to be asked.

**Alternatives considered**
- *Add expiration/history fields directly to `Order` instead of a new entity.* Rejected — a single mutable row can't represent multiple attempts, which is exactly what "regenerate a session after it expires" needs; the next regeneration would silently erase the previous attempt's own audit trail.
- *Trust Maya's webhook payload once a shared secret is configured.* Rejected after verifying against Maya's own docs — Maya's Checkout API has no signing/HMAC scheme to configure. The fix that actually closes the audit finding is architectural, not configuration: treat every webhook delivery as a bare wake-up signal, re-verify via an authenticated pull against Maya's own status API before acting on it, and add Maya's own recommended IP allowlist as the perimeter control in place of a signature.
- *Literal spec compliance on reminder timing ("6h/24h/2h before expiration") measured against the Maya checkout session itself.* Rejected — that session is a fixed, non-configurable 1 hour (verified against Maya's docs, not assumed), so a 24-hour-out reminder against it is meaningless. Reminders are measured against the Order's own retention deadline instead (`createdAt` + the admin-configurable retention window) — the real "you lose your reserved stock" cliff the platform actually enforces.

**Why the chosen approach won**
It's the direct fix for both halves of the original gap at once: `Payment`-as-history gives the customer-facing recovery experience (resume-or-regenerate, a real countdown, a timeline) something honest to read from, and the same entity's atomic resolution path is what let webhook hardening, proactive expiration, and reminder emails all reuse one mechanism instead of accumulating parallel, drifting copies of "what happens when a payment resolves." Every correction here came from checking a specific claim against Maya's real documented behavior rather than building against the original spec's literal assumptions — the same discipline ADR-007 already established for this codebase's persistence layer.

**Future implications**
`Payment.provider` is a plain string, not an enum, and every gateway-specific call is isolated behind `services/paymentService.js`'s two-function interface (`createCheckoutSession`, `getPaymentStatus`) — adding GCash, PayMongo, Xendit, or Stripe later is one new gateway module matching that shape plus one registry line, with no change to `Order`, `Payment`, checkout, or reporting. A gateway's own request-correlation field must be treated as attempt-scoped, not order-scoped: Maya's `requestReferenceNumber` was originally sent as the bare order number on every attempt, including regenerations, which Maya's own docs require to be unique per request — reusing it handed back a reference to the original, already-lapsed session instead of a genuinely new one, reproduced live and fixed by making it `${orderNumber}#${attempt-unique suffix}`, parsed back apart wherever a webhook needs to resolve the order. The in-app Notification system's first real write-side triggers now exist (payment succeeded/failed/reminder, order status changes) as direct, synchronous calls from the routes that decide them — not yet routed through this document's own Architecture table's stated Redis pub/sub event design, which remains the real future migration for Notifications specifically. Refunds, a second live gateway, and push/SMS notifications were named and deliberately left out, the same way ADR-003 named and deferred Tickets/Experiences rather than guessing their shape early.

---

## ADR-009 — Fulfillment is its own entity, decoupled from Order, the same way ADR-008 decoupled Payment

**Context**
A platform Fulfillment Audit found that everything past "paid" was a single `Order.orderStatus` dropdown, hand-edited one row at a time — no picking/packing/QC pipeline, no staff assignment, no typed audit trail for why a status or a stock count changed, no returns workflow, no refund mechanism, and a specific Critical finding: the cancellation path could set `orderStatus = 'cancelled'` without ever releasing reserved stock or creating a refund record, a bare status write with no guaranteed consequences. `DOMAIN_MODEL.md` had already named `Shipment` as Fulfillment's concrete Merchandise-specific form, and `COMMERCE_ENGINE.md` had already stated the governing rules a return must satisfy (a coordinated reversal of inventory/payment/fulfillment status; baseline return terms consistent across every Organization) — but no concrete entity or state machine existed yet to actually enforce either.

**Decision**
`Shipment` becomes its own entity, one-to-many with `Order` (today 1:1, since multi-Organization orders per shipment aren't live yet) — the exact move ADR-008 already made for `Payment`. `Order.orderStatus` is unchanged: it stays the coarse, customer-facing "where's my order" read every existing surface (`OrderConfirmation.jsx`, status emails, My PUSO) already depends on. `Shipment.status` is the new staff-facing, queue-driven granular state (`awaiting_picking → picking → packing → quality_check → ... → delivered`, plus return/refund/cancellation sub-states), validated against a real adjacency map (`SHIPMENT_TRANSITIONS`) instead of the old flat allowlist that accepted any status from any prior one. Every transition is a race-safe atomic conditional update (`updateMany({where: {id, status: currentStatus}, ...})`, the same idempotency shape `Payment.resolve`/`Order.tryResolvePayment` already established) and writes a typed `ShipmentEvent` row (`fromStatus`/`toStatus` as real columns, not a parsed message string) — the direct fix for the Audit's other finding that the old `OrderEvent.status_updated` type couldn't be queried without string-parsing.

The same entity-of-its-own pattern extends to the two things Commerce Engine's return rule required but had no home for: `ReturnRequest`/`ReturnItem` (its own state machine, `requested → under_review → approved → return_shipped → received → inspected → refund_pending → refunded`) and `Refund` (one-to-many with `Order`, mirroring `Payment`'s own one-to-many shape) — `Order.paymentStatus = 'refunded'`, dead in the schema since Payment Platform Redesign added it, gets its first real writer the moment a `Refund` actually reaches `succeeded`. Cancellation's fix is structural, not a patch: the code path that sets `Shipment.status = cancelled` is the same transaction that releases stock (with a typed `StockAdjustment` audit row per item) and creates the `Refund` — cancellation without both consequences is no longer reachable.

Courier integration follows the same gateway-abstraction shape ADR-008 already proved for payment providers: `courierService.js` defines `bookPickup`/`getTrackingStatus`, one registry entry per real courier, with `manual` (staff enters a tracking number by hand) as the only implementation shipped so far — a real courier (J&T, LBC, Ninja Van...) is a new module matching that shape plus one registry line, exactly like adding a second payment gateway would be.

**Alternatives considered**
- *Add fulfillment-stage fields directly to `Order` instead of a new entity.* Rejected for the same reason ADR-008 rejected it for Payment — a single mutable row can't hold a real multi-stage, multi-actor, potentially-returned execution history without either losing prior state on every update or accumulating an ever-growing set of nullable columns that only make sense in some states.
- *A single `status` enum spanning both customer-facing and staff-facing granularity.* Rejected — this is what the old `orderStatus` dropdown already was, and it's the direct cause of the Audit's findings: a customer doesn't need to know a shipment moved from "quality check" to "ready for courier," and forcing every internal queue stage into the one field the customer sees means either exposing internal noise or losing operational granularity. Keeping `Order.orderStatus` coarse and deriving it from `Shipment.status` (`SHIPMENT_TO_ORDER_STATUS`) gives each audience the vocabulary suited to it, the same separation ADR-006 already established between the Discovery Hub and an Organization's storefront for a different pair of audiences.
- *Building a real courier API integration in the same pass as the entity redesign.* Rejected for this round — no external courier account or credentials existed to integrate against honestly. Building the abstraction (`courierService.js`'s interface, the `CourierAccount` registry) without a second real implementation behind it is the same "extension point, not the extension" discipline `Payment.provider` already used before a second payment gateway existed.

**Why the chosen approach won**
It's the same reasoning ADR-008 already validated once: separating "the coarse thing the customer reads" from "the detailed thing the record actually is" lets both sides be simple in the vocabulary that matters to them, instead of one compromised field trying to serve two audiences and satisfying neither. Reusing the exact atomic-transition, typed-event, and gateway-registry patterns already proven for Payment meant Fulfillment's own version of each didn't need to be separately designed or separately trusted — the race-safety and audit-trail guarantees transferred directly.

**Future implications**
`Shipment.assignedToUserId` and the new `StaffProfile` (department + a `permissions` string array, deliberately separate from the coarse `User.role` admin gate) are the first real RBAC concepts this platform has had — every future admin capability that needs department-scoped visibility extends `StaffProfile`, not `User.role`. `Warehouse`/`WarehouseZone`/`Bin`/`ProductLocation` and `CourierAccount` both carry their real foreign keys from day one while exactly one row of each exists in practice (`MAIN` warehouse, `manual` courier) — activating a second warehouse or a real courier is a data-entry-plus-one-gateway-module operation, not a migration, the same "extension point built in before the second instance exists" pattern `Payment.provider` already used. `ReturnItemCondition` (`sellable`/`damaged`/`unsellable`) and `StockAdjustmentType` (`returned`/`damaged`/`quarantine`/...) are deliberately separate enums — what an inspector observed versus what happened to stock as a result — so a damaged-but-still-technically-returned item is never silently conflated with one that's back on the shelf. Multi-warehouse pick-source activation, wiring `Shipment.source = partner_3pl` to a real `Partner` capability (no `Partner` domain model exists yet — that's a separate capability's own initiative per the Capability Model's boundaries, not Fulfillment's to build), and real courier performance reporting (meaningless before real tracking data exists) were named and deliberately left out, the same way ADR-008 named and deferred refunds, a second gateway, and push/SMS.
