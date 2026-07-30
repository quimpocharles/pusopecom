# PusoStore Capability Model

**Version 1.0**

The Domain Model defined PusoStore's nouns — Organization, Commerce Item, Order, and the rest of the vocabulary the platform is built from. This document defines its verbs: the bounded areas of ownership the platform is organized into, what each one is responsible for, and — just as importantly — what it is explicitly *not* responsible for.

A capability is not a team, a service, or a screen. It's a boundary of ownership: a clear answer to "whose job is this?" A platform with fuzzy capability boundaries ends up with the same responsibility half-owned in three places and genuinely owned nowhere — which is precisely the kind of drift this document exists to prevent. This is why "what does NOT belong" gets equal weight to "what belongs inside" for every capability below: the boundary is the whole point.

This document discusses no interface, no screen, no technology. It describes what the platform can *do* and who's accountable for each part of that, which should remain true no matter how any of it is eventually built or rebuilt.

It assumes the **Decision Log**, **Platform Strategy**, and **Domain Model** as prior context — capability boundaries here follow directly from decisions already made there (organization-first, trust as infrastructure, merchandise-first with named future categories, contextual commerce).

Seventeen capabilities, organized into five groups by what kind of question they answer.

---

## Group A — Trust & Institutions
*Who is on the platform, and can they be trusted to operate?*

### Organizations
**Mission.** Make it possible for any real Philippine sports institution — from a national federation to a barangay league — to exist, operate, and be represented on the platform, treated the same way regardless of size.

**Responsibilities.** Onboarding intake; Organization, Team, and Athlete lifecycle (create, update, retire); roster and admin-role management within an Organization; the affiliation structure connecting Teams and Athletes to the Organizations they belong to.

**What belongs inside.** Organization/Team/Athlete profile data, admin role assignment within an org, roster management, org-to-org affiliation structures.

**What does NOT belong.** Judging whether an Organization is legitimate — that's Trust's decision, not Organizations'. Organizations manages the mechanics of operating; Trust decides who's allowed to. Also not authentication of who's logging in — that's Identity's job; Organizations assumes a caller is already authenticated and simply asks Identity what role they hold.

**Dependencies.** Identity (to know who's allowed to act as an org admin). Trust (to know whether an org is currently allowed to operate or sell at all).

**Future opportunities.** As Membership and multi-category commerce mature, this capability extends to define per-Organization membership tiers and category participation rules, without changing what Organizations itself is responsible for.

---

### Trust
**Mission.** Make "genuinely official" a real, continuously-earned status rather than an assumption — the platform's core differentiator, operationalized as a capability rather than left as a claim.

**Responsibilities.** Verification review and decisioning (grant, deny, revoke); ongoing monitoring of fulfillment reliability and complaint patterns; authenticity signaling for Commerce Items tied to a verified Organization; gating which Reviews are eligible to publish.

**What belongs inside.** Verification workflow and decisions, trust-status history per Organization and Partner, Review eligibility gating and moderation, the escalation and suspension process when trust is broken.

**What does NOT belong.** Day-to-day org account management (Organizations' job), authentication (Identity's job), demand forecasting or fulfillment execution (Operations' and Fulfillment's jobs). Trust judges legitimacy and integrity — not operational performance beyond what feeds into a trust decision.

**Dependencies.** Organizations (the subject of verification). Analytics (fulfillment-reliability signals feeding ongoing monitoring). Customer (the source of the Reviews Trust gates).

**Future opportunities.** Extending verification to category-specific concerns as new commerce categories launch — event authenticity for a future Ticket category, safety and authorization checks for a future Experience category — without building a new trust system per category.

---

### Identity
**Mission.** Know, reliably, who is acting on the platform — a Customer or an Organization's admin — and what they're allowed to do, underneath every other capability.

**Responsibilities.** Authentication (credentials, session, recovery); authorization and role resolution (Customer, Organization admin, Team manager); account-level security.

**What belongs inside.** Login and credential management, session and access lifecycle, role-assignment resolution, account recovery and security events.

**What does NOT belong.** Anything about who a Customer is *as a fan* — preferences, Favorites, order history belong to Customer, not Identity. Whether an Organization is trustworthy belongs to Trust, not Identity. Identity only ever answers "who is this, and are they authenticated" — never "should this Organization be allowed to operate" or "what does this fan like."

**Dependencies.** None upstream. Identity is foundational; every capability that needs to know who's asking depends on it, never the reverse.

**Future opportunities.** As Membership introduces durational Customer-to-Organization relationships, Identity's role resolution extends to recognize membership-tier status as another form of "what this account is allowed to do," without changing what Identity fundamentally does.

---

### Partner
**Mission.** Make it possible for commercial collaborators who aren't sports institutions themselves — co-branding apparel partners, licensing partners, logistics partners — to contribute to what an Organization can offer, without ever being mistaken for one.

**Responsibilities.** Partnership agreement lifecycle (proposed, active, concluded); scoping which Organizations, Collections, or Commerce Items a partnership applies to; tracking partner-specific commercial terms.

**What belongs inside.** Partner profile and agreement terms, the scope of a given partnership, partner-attributed contribution to a Commerce Item.

**What does NOT belong.** A Partner does not get a Storefront presence of its own and is not followed the way an Organization is — Partner legitimacy is a business-relationship concern PusoStore manages directly, not a public trust signal the way Organization verification is.

**Dependencies.** Organizations (a partnership always attaches to one or more). Commerce (partnerships manifest as specific Commerce Items or Collections).

**Future opportunities.** As Equipment commerce is added, equipment-manufacturer relationships become a natural Partner type without Partner itself changing.

---

## Group B — The Commerce Spine
*What's for sale, what's promised, and how that promise is kept.*

### Commerce
**Mission.** Own everything about what can be offered and how it's organized and released — the category-agnostic core the rest of the transactional spine is built on.

**Responsibilities.** Commerce Item lifecycle across categories (Merchandise today); Collection curation; Drop scheduling and scarcity mechanics; Promotion configuration; pricing and availability rules.

**What belongs inside.** Catalog and category management, Collections, Drops, Promotions, and the category-agnostic Commerce Item rules every future category will also follow.

**What does NOT belong.** Taking payment (Payments' job), delivering what was bought (Fulfillment's job), deciding how much stock or capacity actually exists (Operations' job). Commerce decides what's offered and on what terms — not whether the money moved or the promise was kept.

**Dependencies.** Organizations (every Commerce Item belongs to one). Operations (Commerce relies on Operations' capacity signal to know what's genuinely available to sell). Trust (Commerce Items inherit their owning Organization's trust status).

**Future opportunities.** This capability was deliberately built category-agnostic. Tickets, Experiences, Equipment, and Membership are new categories *inside* Commerce, not new capabilities alongside it.

---

### Payments
**Mission.** Move money reliably and transparently between a Customer and the Organization(s) they bought from, regardless of what was purchased.

**Responsibilities.** Payment capture and authorization; refund and chargeback handling; financial reconciliation across an Order that may span more than one Organization.

**What belongs inside.** Transaction processing, refund handling, payout coordination to Organizations, financial audit trail.

**What does NOT belong.** What was bought or its price rules (Commerce's job), whether it was actually delivered (Fulfillment's job). Payments concerns itself with the movement of money, not the commercial or delivery substance behind it.

**Dependencies.** Commerce (to know what's being paid for and at what price). Identity (to know who's paying).

**Future opportunities.** A future Membership's recurring billing is the one meaningful extension this capability needs — a repeating authorization tied to a standing relationship rather than a single Order. Everything else about Payments already generalizes across categories.

---

### Fulfillment
**Mission.** Keep the promise made at the moment of purchase, and let a Customer track that promise until it's kept.

**Responsibilities.** Coordinating delivery execution once an Order is placed and Payment confirmed — physical shipment for Merchandise today, and category-specific delivery mechanisms as new categories launch.

**What belongs inside.** Shipment tracking and status, carrier coordination, delivery-promise tracking and communication of delay or completion.

**What does NOT belong.** Deciding how much capacity or stock exists in the first place — that's Operations, upstream of Fulfillment. Fulfillment executes against a promise Operations already confirmed was safe to make; it doesn't decide whether that promise should have been made.

**Dependencies.** Operations (must confirm committed inventory or capacity before Fulfillment can promise delivery). Commerce (to know what was ordered). Notifications (to communicate status to the Customer).

**Future opportunities.** The capability most directly extended by new categories — a future Ticket's fulfillment is an access grant, an Experience's is a booking confirmation, Equipment likely stays shipment-shaped with added fit or safety steps. This is also the natural home for diaspora-specific delivery patterns — treating cross-border, gift-oriented delivery, in the spirit of how the diaspora already moves goods home, as a first-class delivery pattern alongside standard domestic shipment rather than an edge case bolted on later.

---

### Operations
**Mission.** Make sure the platform never promises more than it can deliver — this capability exists specifically because of the industry's clearest cautionary tale: infrastructure that couldn't forecast a demand surge and broke the trust of exactly the fans it mattered most to keep.

**Responsibilities.** Inventory and capacity tracking; demand forecasting; surge protection during Drops; monitoring Organizations' operational ability to fulfill what they've listed.

**What belongs inside.** Stock-level tracking, reservation logic during checkout (so two Customers can never be sold the same last unit), demand forecasting ahead of scheduled Drops, capacity alerts before a promise gets made that can't be kept.

**What does NOT belong.** The actual act of delivering — that's Fulfillment, downstream of Operations' capacity decision. Operations decides what's safe to promise; Fulfillment keeps the promise once made.

**Dependencies.** Commerce (to know what's being scheduled for availability). Analytics (historical demand data informing forecasts). AI (forecasting models).

**Future opportunities.** The capability every future category most depends on getting right before launch — a Ticket's seat count or an Experience's time-slot capacity is the same "how much do we actually have" problem Operations already solves for Merchandise, just counting a different thing.

---

## Group C — Fan-Facing Intelligence
*How a fan finds something, and how honestly the platform talks about what it doesn't know for certain.*

### Discovery
**Mission.** Help a fan find an Organization, Team, or moment they'd care about — especially one they don't already know to look for.

**Responsibilities.** Personalized surfacing of Organizations, Campaigns, and Drops based on a Customer's Favorites and platform-wide trends; routing for fans without an established loyalty yet.

**What belongs inside.** Recommendation and personalization logic, trending and momentum signals across Organizations, routing logic connecting an undecided fan to relevant Organizations.

**What does NOT belong.** Explicit query-driven lookup — that's Search. Discovery surfaces things a fan didn't ask for; Search finds things a fan did ask for. Also not the content being surfaced (Content's job) or its trust status (Trust's job) — Discovery decides relevance and ordering, not truth or legitimacy.

**Dependencies.** Customer (Favorites as the primary personalization input). Content and Commerce (the material being surfaced). AI (relevance modeling). Analytics (trend signals).

**Future opportunities.** Becomes the cross-category discovery surface — routing a fan toward a Drop, a future Ticket, or a future Membership offer through the same personalization logic, not a separate system per category.

---

### Search
**Mission.** Let a fan find something specific, fast, using their own words — including a team or league name that may not appear anywhere in a product's own listing.

**Responsibilities.** Query interpretation; matching across Organizations, Teams, and Commerce Items, not just product names; ranking of results.

**What belongs inside.** Query processing and matching, autocomplete and suggestion logic, ranking of matched results across Organization, Team, and Commerce Item data.

**What does NOT belong.** Recommending things a fan didn't ask for — that's Discovery. Search only responds to an explicit query; it never proactively surfaces anything.

**Dependencies.** Organizations and Commerce (the indexed material). AI (query understanding, especially for team or league names not literally present in a product's own data).

**Future opportunities.** Extends to searching across future categories — finding a Ticket to a specific event, or an Organization's Membership offering — using the same query-matching foundation.

---

### Confidence
**Mission.** Make sure nothing the platform communicates to a fan sounds more certain than it actually is — the trust principle turned inward, applied to the platform's own outputs rather than to who's selling.

**Responsibilities.** Quantifying and attaching a reliability signal to any AI-assisted or predictive output reaching a Customer — a size recommendation, a try-on result, a "likely to sell out" signal.

**What belongs inside.** Confidence scoring for AI-assisted outputs, the standard for how much certainty is required before a recommendation is surfaced at all, honesty calibration across every capability that produces a prediction.

**What does NOT belong.** The underlying prediction or recommendation itself — that's AI's job. Confidence doesn't generate a size recommendation or a try-on result; it evaluates and communicates how much that output should be trusted. Also not institutional trust in an Organization — Trust is a completely different kind of confidence.

**Dependencies.** AI (the outputs Confidence evaluates). Discovery and Commerce (the moments where a confidence-scored output matters to a Customer's decision).

**Future opportunities.** Extends the same honesty standard to demand-forecasting outputs feeding Operations, and to fit-guidance outputs for a future Equipment category — anywhere the platform predicts something for a Customer or an Organization, Confidence applies.

---

### AI
**Mission.** Provide the underlying inference and modeling capability other capabilities draw on — a horizontal enabler, not a business capability with an end-to-end outcome of its own.

**Responsibilities.** Model development and inference for try-on generation, size and fit recommendation, personalization ranking, and demand forecasting; maintaining the infrastructure those models run on.

**What belongs inside.** Model development and inference serving, and the specific outputs — a generated try-on image, a ranked recommendation list, a forecasted demand curve — that other capabilities consume.

**What does NOT belong.** Deciding how confidently to present an output (Confidence's job), deciding what to do with a forecast (Operations' job), deciding what to surface to a fan and in what order (Discovery's job). AI produces raw predictions and generations; it doesn't decide how they're used or communicated.

**Dependencies.** Media (image and video inputs and outputs for try-on). Analytics (training data). Commerce and Operations (the business context a model needs to be useful).

**Future opportunities.** The same modeling capability extends to fit guidance for a future Equipment category and personalization for a future Membership capability, without AI itself needing new infrastructure per category — new categories are new inputs and use cases for the same underlying capability, not new capabilities.

---

## Group D — Narrative & Relationship
*The story behind the sale, and the ongoing relationship with the fan.*

### Content
**Mission.** Give commerce a story — implementing the platform's founding belief that a product without a real institution and a real story behind it isn't something worth selling.

**Responsibilities.** Story authoring and management; Campaign coordination, tying a Story, Media, and a Collection or Drop to a real-world moment; editorial support drawing on Puso's broadcast origins.

**What belongs inside.** Story lifecycle, Campaign orchestration and timing, editorial standards and support for Organizations telling their own story.

**What does NOT belong.** The raw visual or video assets themselves — that's Media; Content is the narrative, Media is the asset it's built from. Also not the commercial mechanics of a Drop or Promotion — a Campaign coordinates those but doesn't own their internal rules, which stay with Commerce.

**Dependencies.** Media (the assets Stories and Campaigns are built from). Organizations (the subject and usual author of Content). Commerce (what a Campaign is coordinating around).

**Future opportunities.** The natural narrative layer for a future Experience (the story behind why a meet-and-greet matters) or a Membership tier (what belonging to a supporters' tier means) — Content doesn't change; only what it gives meaning to grows.

---

### Media
**Mission.** Store, manage, and serve every visual and video asset the rest of the platform needs to actually be seen.

**Responsibilities.** Asset ingestion, storage, and delivery for imagery and video referenced by Organizations, Commerce Items, Stories, and Campaigns; connecting broadcast-originated footage to the rest of the platform.

**What belongs inside.** Asset storage and delivery, asset-to-concept attachment, broadcast archive integration.

**What does NOT belong.** The narrative meaning of an asset — Media stores a video clip, Content decides what story it tells. Also not the model that generates an asset like a try-on result — that's AI; Media stores and serves the result once generated.

**Dependencies.** AI (for generated assets like try-on results). Organizations and Content (the concepts assets are attached to).

**Future opportunities.** The connective tissue for turning a live broadcast moment into something immediately buyable — already shaped for this, since Puso's own broadcast footage is Media the moment it exists, not a separate system to be built later.

---

### Customer
**Mission.** Represent the fan's relationship to the platform over time — what they care about and what they're considering, not just what they've bought.

**Responsibilities.** Favorite (followed Organizations and Teams) and Wishlist (saved Commerce Items) management; account-level preferences; the fan-facing view of past Orders.

**What belongs inside.** Favorites and Wishlist data, fan preference signals, the fan-facing purchase-history record.

**What does NOT belong.** Authentication itself — that's Identity; Customer assumes an account is already established. Also not Reviews — those belong to Trust, because Review eligibility is a trust-integrity concern, not a personalization concern, even though a Customer is the one who authors them.

**Dependencies.** Identity (to know which authenticated account this data belongs to). Commerce (the Organizations and Commerce Items a Customer can Favorite or Wishlist).

**Future opportunities.** The natural subject of a future Membership relationship, and the party a future Ticket or Experience is issued to — Customer doesn't need to change shape for either.

---

### Notifications
**Mission.** Tell a Customer or an Organization admin what they need to know, when they need to know it — a horizontal capability triggered by events elsewhere on the platform, not a source of decisions itself.

**Responsibilities.** Delivering messages triggered by other capabilities — an order status change, a Drop going live, a verification decision, a price drop on a Wishlist item.

**What belongs inside.** Message delivery across channels, timing and batching logic, a Customer or Organization's communication preferences.

**What does NOT belong.** Deciding that something noteworthy happened — that's always the triggering capability's job. Fulfillment decides an Order shipped; Notifications only delivers word of it. Notifications has no independent judgment about what matters, only about delivering word of what another capability already decided mattered.

**Dependencies.** Every capability that produces an event worth communicating — Fulfillment, Trust, Commerce, Payments chief among them. Notifications is downstream of all of them, never upstream.

**Future opportunities.** Extends naturally to a future Ticket's event-reminder pattern or a Membership's renewal notice, using the same delivery infrastructure already built for order and Drop communication.

---

## Group E — Measurement
*An honest picture of what's actually happening.*

### Analytics
**Mission.** Give every other capability an honest, shared picture of what's actually happening on the platform — a measurement capability, not a decision-making one.

**Responsibilities.** Aggregating and reporting on activity across Organizations, Commerce, Fulfillment, and Trust; providing the historical data Operations' forecasting and AI's training need to work well.

**What belongs inside.** Data aggregation and reporting, trend and pattern surfacing, historical performance tracking per Organization and Commerce Item.

**What does NOT belong.** Acting on what it observes. Operations, Trust, and Commerce each act on Analytics' signals — Analytics itself never decides to suspend an Organization or schedule a Drop. It informs; it doesn't decide.

**Dependencies.** Nearly every other capability is a data source for Analytics. Analytics is upstream only of the decisions other capabilities make using its output — never upstream of any action directly.

**Future opportunities.** Extends to measuring performance of future categories — Ticket sell-through, Membership retention — the same way it measures Merchandise today, without needing new infrastructure per category.

---

## How the layers stack

Read from the bottom up, each group depends on the one below it more than the reverse. **Identity** is the foundation everything else assumes. **Trust, Organizations, and Partner** sit on top of it, establishing who's really on the platform. **Commerce, Payments, Fulfillment, and Operations** form the transactional spine those institutions transact through. **Discovery, Search, Confidence, and AI** form an intelligence layer that helps fans navigate that spine honestly. **Content, Media, Customer, and Notifications** form the relationship layer that makes the whole thing feel like fandom rather than shopping. **Analytics** sits alongside all of it, watching everything, deciding nothing.

The discipline worth protecting as this platform grows: a new feature should be able to name exactly one capability that owns it. The moment a feature needs two capabilities to jointly "sort of" own it, that's a sign the boundary drawn here needs to be revisited — not a sign the feature should be built anyway and sorted out later.
