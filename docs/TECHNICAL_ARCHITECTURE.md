# PusoStore Technical Architecture

**Version 1.0**

Every document before this one was deliberately silent on technology. This is the one where that silence ends — but the discipline that produced the other nine documents doesn't. Every technical decision below exists because a specific capability, a specific business rule, or a specific finding from the platform audit already demanded it by name. Nothing here is included because it's industry-standard. If a technology appears in this document, something written earlier in this series required it.

PusoStore already runs on a real, working foundation: React and Vite on the frontend, Node.js and Express on the backend, PostgreSQL as the primary database, Cloudinary for media, Maya for payments, Replicate and WaveSpeed for AI generation. This document is an evolution of that foundation, not a replacement for it — consistent with the Product Principles ranking Simplicity and Maintainability above Scalability. Where something changes below, it changes because a named gap — from the Capability Model, the Commerce Engine, the Trust Model, or the earlier platform audit — requires it, not because a rewrite would be more satisfying to design.

> **Amendment, see Decision Log ADR-007.** This document originally recommended keeping MongoDB. That recommendation was conditioned on a working MongoDB deployment existing and not being worth disturbing. The production MongoDB database has since been permanently removed with no data to preserve, which is the specific condition that reasoning depended on — so it no longer applies. The Database entry below has been updated to reflect PostgreSQL + Prisma, per ADR-007; every other decision in this document, including "evolve the foundation, don't replace it," still holds — this is a change in what "the foundation" currently is, not an abandonment of the principle.

---

## Architecture Principles

**Evolve the foundation, don't replace it.** The existing stack is proven and the team already knows it. Every recommendation here either reinforces what exists or fills a gap already identified by name elsewhere in this series.

**Every piece of infrastructure exists because a capability needs it.** The same discipline the Capability Model applied to business ownership — name the capability, or don't build it — applies here to technology. A new system earns its place by naming which capability it serves.

**Fix correctness before chasing scale.** Several of the platform audit's "scalability" findings — in-memory rate limiting, absent database transactions, a synchronous AI call blocking a request for up to 75 seconds — are correctness and reliability bugs wearing a scale costume. Fixing them serves today's trust promises, not just tomorrow's traffic, and they're addressed here as such.

**Consolidate infrastructure rather than let it sprawl.** One well-understood piece of infrastructure doing three related jobs is a better architecture than three specialized tools the team now has to operate, monitor, and staff for.

**The Capability Model's boundaries are the security architecture.** Identity, Trust, and Authorization aren't a separate security layer bolted on afterward — they're the enforcement mechanism every other capability already trusts instead of re-implementing its own checks.

---

## Experience Layer

### Frontend

**Keep React, Vite, and a component-based architecture — and let the Design System's primitives be the reason why, not just convention.** A component model matters here specifically because of Contextual Commerce (ADR-005): a Product card needs to be the *same* component whether it's rendered inside a Storefront, embedded in a Story, or dropped into a livestream overlay during a broadcast moment. That reusability requirement, not a generic preference for React, is the actual architectural justification.

Client-side routing mirrors the Information Architecture's identity-first hierarchy directly — Organization, Team, Collection, and Product nest as routes in the same order a fan actually moves through them, so the URL structure and the breadcrumb lineage the IA specifies are the same structure, not two systems that have to be kept in sync by hand.

### CDN

Cloudinary already serves as both storage and CDN for media, and that consolidation is worth keeping rather than splitting into separate systems. The gap the platform audit already found — full-resolution images shipped with no transformation parameters — isn't a CDN problem to solve with new infrastructure; it's an existing capability the current stack already has and simply isn't using yet. Static frontend assets (the compiled application itself) sit behind their own CDN edge layer, which matters directly for the Mobile Purchase and International Fan journeys, both of which assume real-world, non-ideal connection speeds rather than a fast office network.

---

## Application Layer

### Backend

**A modular monolith, not microservices — organized internally around the Capability Model's seventeen boundaries, deployed as one service.** Microservices would solve a scaling problem this platform doesn't have yet, at the cost of operational complexity a small team can't absorb yet — a direct application of "fix correctness before chasing scale." What does change from today's implementation is internal structure: the platform audit found fat routes with no service layer, business logic duplicated between order creation and webhook stock-restoration. The fix isn't a new deployment topology — it's organizing the existing codebase around the Capability Model's boundaries internally, so Commerce, Payments, Fulfillment, and Operations are distinct, enforceable modules inside one service today, and separable into real services later only if the platform's actual scale ever demands it.

### Authentication

Keep JWT-based authentication with the existing Google OAuth integration — Identity is foundational and nothing about the rest of this series requires changing how a session is established. What does need to change is session *revocation*: the current seven-day token has no way to be invalidated early, which means a password change today doesn't actually end a compromised session. A lightweight revocation check — tied to the account, verified on each authenticated request — closes that gap without touching how authentication itself works.

### Authorization

**This is the one place the Organization-first decision (the Decision Log's ADR-001/002) forces a real architectural change, not just a fix.** A single global "is this user an admin" flag, which is what exists today, cannot express "is this user an admin of *this* Organization" — and once Organizations own their own Teams and their own admin rosters, authorization has to be scoped per-Organization, not platform-wide. This is a direct technical consequence of Organizations being real, independently-administered institutions rather than rows in one shared catalog: role assignment — Organization admin, Team manager, platform-level access — has to be evaluated against a specific Organization, every time, not against one global permission bit.

---

## Data Layer

### Database

**PostgreSQL, hosted on Railway, accessed through Prisma — see Decision Log ADR-007.** This supersedes this document's original "keep MongoDB" recommendation, which was conditioned on a working MongoDB deployment existing that wasn't worth disturbing; that deployment was permanently removed with no data to migrate, so the condition the original reasoning depended on no longer holds. What doesn't change is the underlying requirement the original recommendation was protecting: the platform audit found zero use of database transactions anywhere in the codebase, which is the direct cause of the stock-overselling race condition documented as Critical in that audit and governed explicitly by the Commerce Engine's Inventory rules. Postgres transactions, via Prisma's `$transaction`, need to wrap exactly the operations the Commerce Engine already identifies as atomic: stock reservation, checkout completion, and order/payment recording — the requirement is unchanged, only the mechanism satisfying it is. Embedded Mongoose subdocuments with independent identity (addresses, product size/color variants, pickup slots) become proper relational tables with foreign keys under this model, which is a net improvement for the same atomicity requirement, not a complication of it.

### Storage

Cloudinary remains the object storage layer for images and video — no reason to introduce a second storage system alongside one that already works and already provides transformation and delivery in the same place. The architectural requirement that matters here comes from the Trust Model, not from storage technology: any asset containing a fan's own uploaded photo (a Virtual Try-On input) has to be deleted after use, not retained, the same discipline the platform audit already confirmed the WaveSpeed integration follows today — this needs to be a stated architectural rule, not an incidental property of one integration, so it holds as new AI features are added.

### Media

Distinct from Storage: Media is the domain layer connecting a stored asset to whatever it belongs to — an Organization's identity imagery, a Product's photography, a Story's illustration — and the Capability Model's rule that Media has no independent meaning becomes, technically, a constraint that a Media record can never exist without a required reference to the concept it's attached to. There's no such thing as an orphaned, unattached asset in this architecture, because the Capability Model already said there shouldn't be one conceptually.

### Caching

**Redis, applied selectively, never applied to Inventory.** The platform audit found no caching layer anywhere, and the fix matters for exactly the reads the Information Architecture and Discovery capability depend on being fast — Organization and Team profiles, Story content, Discovery Hub's trending data — none of which need millisecond-fresh accuracy. Inventory is the deliberate, explicit exception: the Commerce Engine's rule that displayed availability must reflect committed reservations, never a hopeful cached state, means stock counts are read live, every time, with no cache layer sitting between a fan and the real number — the exact discipline the industry's clearest cautionary tale, cited throughout this series, existed to teach.

Redis is also where rate limiting and Drop-checkout reservation locking live, replacing the platform audit's in-memory implementation that silently breaks the moment the backend runs on more than one instance — the same infrastructure serving both caching and this cross-instance coordination need, rather than two separate systems.

### Search

The Information Architecture's core requirement — a query for a team or league name has to return that Organization directly, not just the products that happen to mention it — is not something a basic keyword index is built to do well: multi-entity-type ranking (Organizations, Teams, Athletes, and Products in one relevance-ordered result set) and fuzzy, colloquial matching are outside what Postgres's native full-text search (`tsvector` plus a GIN index — the direct replacement for MongoDB's `$text` index used today) handles gracefully at that scope. A dedicated, managed search service earns its place here specifically to serve that requirement — deliberately a managed option over a self-hosted search cluster, in keeping with "consolidate infrastructure rather than let it sprawl" and the team's current operational scale. Postgres full-text search remains the right tool for simpler, single-entity-type product search in the interim.

---

## Async & Intelligence

### Queues

**The clearest, most concrete justification for adding a job queue in this entire document: the platform audit found Virtual Try-On generation running synchronously inside the request cycle for up to seventy-five seconds.** That's not a performance nice-to-have, it's a request handler held open long enough to threaten the platform's own capacity under any real concurrent load. AI generation work moves to background jobs, with a result delivered once ready rather than a connection held open and hoping. The same queue infrastructure carries Notifications' message dispatch — order confirmations, Trust status changes, Drop alerts — so a slow or failed email can never again cause a successful registration to report itself as failed, the exact bug the platform audit found in the current authentication flow.

### Events

The Capability Model already describes Notifications as strictly downstream — triggered by other capabilities, never deciding independently what's noteworthy. A lightweight event mechanism is the direct technical expression of that rule: Fulfillment emits that an order shipped; Notifications, Analytics, and Trust's ongoing monitoring each subscribe independently, without Fulfillment's code needing to know or care who's listening. This runs on the same Redis infrastructure already justified for Caching and Queues rather than introducing a dedicated event-streaming platform sized for a scale this platform isn't at yet — again, "consolidate rather than sprawl."

### AI

AI generation and prediction work — Virtual Try-On today, Sizing and Demand Forecasting as the AI Capability document's horizons arrive — runs through the Queue described above and returns results paired with Confidence scoring, never one without the other, exactly as the AI Capability document requires. Architecturally, this means a single internal interface that every AI-assisted feature calls through, with the specific external provider swappable behind it — the platform audit's clearest cautionary finding here is its own history: five abandoned AI-provider integrations left in the codebase from feature-by-feature experimentation with no shared abstraction. One capability boundary, one interface, providers as an implementation detail behind it — not repeated per feature.

---

## Money

### Payments

Maya remains the payment integration — no reason here to change providers, and the gap the platform audit found is a specific, fixable one: the webhook that marks an order paid currently trusts an unverified payload, the single most serious finding in that entire audit. Webhook signature verification is a binding architectural requirement, not an enhancement, directly enforcing the Trust Model's Payment Trust mechanism and the Commerce Engine's rule that nothing about an Order is final until it resolves completely. Payment authorization happens as part of the same atomic checkout resolution the Commerce Engine already specifies — locking in price, inventory reservation, and payment together, so none of the three can succeed while the others silently fail.

---

## Operations

### Deployment

The platform audit found manual deployment with no CI/CD pipeline and almost no automated test coverage. This document series has spent nine prior documents establishing rules the platform is supposed to reliably keep — inventory accuracy, price integrity through checkout, Drop capacity certification, consistent baseline return terms. **None of those promises can actually be trusted to hold over time without automated tests gating every deploy and a staged environment a change passes through before reaching a real fan.** This isn't a general engineering best practice invoked for its own sake; it's the specific technical prerequisite for the Trust Model's claim that trust is earned continuously rather than assumed.

### Observability

The platform audit found no structured logging and no error tracking anywhere in the codebase — effectively no way to know what actually happened after the fact. This is a direct blocker to capabilities this series has already committed to: the Trust capability's "ongoing monitoring of fulfillment reliability" and Analytics' entire mission of giving every other capability an honest, shared picture of what's happening cannot be built on scattered console output. Structured logging and real error tracking aren't optional tooling here — they're the data source the Trust and Analytics capabilities were already promised to have.

### Scalability

Scalability isn't a separate system to add — it's a property that falls out of getting the other sixteen items right, and the Product Principles are explicit that it ranks below Simplicity and Maintainability for a reason: this document deliberately doesn't reach for microservices, a dedicated event-streaming platform, or a database migration, because none of those are justified by the platform's actual current scale. What is justified, and addressed above, are the specific scalability landmines the platform audit already found — state held in memory that breaks under more than one instance, missing database indexes on the fields every product listing filters by, a synchronous external call that can exhaust server capacity under concurrent load. Fixing those is scalability work that was overdue before scale was even the question.

### Security

Security is not a seventeenth system alongside the other sixteen — it's enforced at the boundaries the Capability Model already drew. Identity authenticates. Authorization scopes access per-Organization. Trust decides legitimacy. Every other capability calls these rather than reimplementing its own version of any of them, which is itself the architectural fix for the platform audit's specific findings: guest order lookups that skip an ownership check, file uploads validated only by a client-supplied content type, an account-lockout mechanism with no time-based recovery that can be weaponized against a real fan. Each of those is a place where a capability quietly built its own security logic instead of relying on the boundary that already existed to provide it — and the fix, in every case, is routing the check through Identity, Authorization, or Trust rather than patching the symptom locally.

---

## What this document is actually saying

Read end to end, most of this document isn't proposing anything genuinely new — it's naming the technical debt the platform audit already found, and showing that every item on that list turns out to be the direct, predictable consequence of skipping something this document series had already decided mattered. The missing transactions were always going to cause the overselling bug the Commerce Engine warns about. The synchronous AI call was always going to become a scaling problem the moment Virtual Try-On stopped being a novelty and started being what the Strategic Research said it should be: part of the shopping experience itself, at real volume. Nothing here is a surprise. That's the actual value of having written the other nine documents first.
