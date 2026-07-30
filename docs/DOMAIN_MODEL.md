# PusoStore Business Domain Model

**Version 1.0**

This document defines the business concepts PusoStore is built from — what each one means, what it's responsible for, how it relates to the others, who owns it, how it moves through its life, and where it's deliberately left room to grow. It is not a database schema and not an ERD: there are no field types, no keys, no tables here. This is the vocabulary the whole company — product, engineering, design, partnerships, support — should use to mean the same thing when they say "Organization" or "Drop" or "Trust."

It follows directly from the **Decision Log** (the architectural decisions) and the **Platform Strategy** (the principles those decisions serve). Where a concept's shape below seems like an unusual choice, the reasoning almost always traces back to one of those two documents — organization-first (ADR-001/002), merchandise-first with named future categories (ADR-003), trust as infrastructure (ADR-004), contextual commerce (ADR-005), and discovery-versus-destination (ADR-006).

Four concepts here — **Trust & Verification**, **Athlete**, **Discovery Hub**, and **Membership** — aren't in most commerce glossaries. They're included because the platform doesn't make sense without them: trust and discovery are named as first-class architectural surfaces in the Decision Log, an athlete's commercial identity doesn't cleanly fit inside "Team," and membership is one of the four future categories this document is explicitly asked to plan for.

Every concept below is marked **Core** (built and load-bearing for the merchandise MVP) or **Extension Point** (deliberately anticipated in the shape of the model, not built today). Most of this document is Core — PusoStore is a merchandise platform today. Where a Core concept is also built to carry future categories without being redesigned, that's called out explicitly in its Future Extension Points field.

---

## Layer 1 — Institutions

The entities that make PusoStore infrastructure for someone, rather than a store on its own.

### Organization
**Core**

**Purpose.** Represents a real Philippine sports institution — a national federation, a professional club, a school's athletics department, a barangay league, or an individual athlete's personal brand (see *Athlete*). It is the anchor everything else in the model attaches to.

**Responsibilities.** Holds the institution's identity (name, story, verification status), owns one or more Teams, owns exactly one Storefront, and is the accountable party for every Commerce Item sold under its name.

**Relationships.** Owns many Teams. Owns one Storefront. Holds a Trust & Verification status granted by the platform. May have one or more Partner relationships. Publishes Stories and Campaigns. Is followed by Customers via Favorite.

**Ownership.** The Organization's own administrators control its identity, roster, and storefront content. PusoStore controls whether it is verified and remains on the platform.

**Lifecycle.** Applied → Under Review → Verified → Active → (Suspended or Retired). Verification is revisited periodically, not granted once and forgotten — consistent with the Decision Log's position that trust is earned continuously.

**Future extension points.** The unit that any future commerce category — tickets, experiences, equipment, memberships — attaches to. A ticketed event or a membership tier belongs to an Organization exactly the way a jersey does today; nothing about Organization needs to change when those categories are built.

---

### Team
**Core**

**Purpose.** Represents a specific squad or roster within an Organization — a men's basketball team, a women's volleyball team, an age-group squad. Gives fans something more specific than the institution to follow.

**Responsibilities.** Carries its own presentational identity (name, colors, roster, media) while inheriting trust and commerce infrastructure from its parent Organization.

**Relationships.** Belongs to exactly one Organization. May be referenced by Commerce Items, Collections, Seasons, and Campaigns as the specific subject. Athletes may be affiliated with a Team.

**Ownership.** Managed by the Organization's administrators; a Team has no independent administrative identity of its own.

**Lifecycle.** Formed (usually at the start of a Season or a competitive era) → Active → Dormant (off-season) → Retired or Renamed. A Team's commercial life often outlasts any single roster, which is why heritage and alumni products are modeled against the Team, not against individual rosters.

**Future extension points.** A Team is a natural scope for a future membership tier ("Season Ticket Holder — Blue Eagles Basketball") or a future ticketed event, without requiring its own separate commerce identity.

---

### Athlete
**Core**

**Purpose.** Represents an individual competitor whose personal following is commercially significant in its own right — the pattern the Strategic Research identified as unusually strong in Philippine sports (boxing, gymnastics, athletics, weightlifting), where the individual regularly outdraws the team or league they compete under.

**Responsibilities.** Carries a personal commercial identity — capsule collections, personal-brand storytelling — that is not fully owned by any single Team the athlete competes for.

**Relationships.** Modeled as its own lightweight Organization (so it inherits Trust & Verification, a Storefront, and commerce infrastructure the same way any institution does), while also holding affiliation relationships to the Team-owning Organizations they represent over a career. This keeps Organization the single anchor for commerce and trust, rather than creating a second, inconsistent kind of seller.

**Ownership.** The athlete or their designated representative controls their Organization's identity and storefront; PusoStore verifies and maintains it the same as any other Organization.

**Lifecycle.** Mirrors Organization's lifecycle, with one addition: affiliation to a given Team's Organization can start and end independently of the athlete's own Organization remaining active — a transfer, a retirement from a club, or a new call-up doesn't require rebuilding the athlete's personal storefront.

**Future extension points.** The most natural home for a future personal-appearance "experience" (a meet-and-greet, a training session) or a personal membership tier, since these are commercial patterns that make sense at the individual level in a way they rarely do at the barangay-league level.

---

### Partner
**Core**

**Purpose.** Represents a commercial collaborator that isn't itself a Philippine sports institution — a co-branding apparel partner, a licensing partner, a logistics or fulfillment partner — but contributes to how a Commerce Item or Collection comes to exist.

**Responsibilities.** Defines the terms of a specific collaboration (a co-branded capsule, a licensed design, a fulfillment arrangement) attached to one or more Organizations' Commerce Items or Collections.

**Relationships.** Attaches to one or more Organizations, Collections, or Commerce Items via a specific partnership agreement. Unlike Organization, a Partner does not own a Storefront and is not followed by Customers via Favorite — it is not itself a subject of fandom.

**Ownership.** Negotiated and managed by PusoStore's partnerships function, in coordination with the Organization(s) involved.

**Lifecycle.** Negotiated → Active (scoped to specific Collections or a time period) → Concluded or Renewed.

**Future extension points.** As equipment commerce is added, equipment-manufacturer partnerships become a natural Partner type without changing what Partner means structurally.

---

### Trust & Verification
**Core**

**Purpose.** Makes the platform's core differentiator — "this is genuinely official" — a real, checkable status rather than an implicit assumption. Directly implements the Decision Log's position that trust is a platform capability, not a feature bolted onto commerce.

**Responsibilities.** Establishes and maintains verified status for Organizations and Partners; establishes authenticity signaling for the Commerce Items sold under a verified Organization; tracks fulfillment reliability over time as a component of ongoing trust, not just a one-time check at onboarding.

**Relationships.** Attaches to every Organization and Partner. Indirectly governs whether a Review is eligible to be published (only from verified purchases, per the platform's rejection of anonymous drive-by reviews). Surfaced to Customers at the point of decision — on the Storefront and on individual Commerce Items — not buried in policy pages.

**Ownership.** PusoStore alone grants and revokes verification. No Organization can purchase or self-assign trust status — this is the one part of the model explicitly protected from being commercialized, per the Platform Strategy's boundary against trust being purchasable.

**Lifecycle.** Requested → Reviewed → Granted → Continuously Monitored → (Reaffirmed, Flagged, or Revoked). Unlike most concepts in this model, Trust & Verification never reaches a final "done" state while an Organization remains active — it is always being re-earned.

**Future extension points.** As new commerce categories launch, verification extends to cover category-specific trust concerns (event authenticity for tickets, safety/authorization for experiences) without requiring a new trust system per category.

---

## Layer 2 — Commerce

What can actually be sold, and how it's organized and released.

### Commerce Item
**Core (category-agnostic anchor)**

**Purpose.** The abstract concept of "a thing a Customer can acquire from an Organization." This exists specifically so the platform never has to be redesigned when a new commerce category is added — it is the anchor the Decision Log requires to stay category-agnostic.

**Responsibilities.** Defines what every sellable thing has in common regardless of category: an owning Organization, a price, availability, and eligibility for Collections, Drops, and Promotions.

**Relationships.** Owned by exactly one Organization (and optionally scoped to one Team or Athlete within it). Merchandise (below) is the only concrete category implemented today. Grouped into Collections; may be released as part of a Drop; may carry a Promotion; is the subject of Reviews, Wishlist entries, and Orders.

**Ownership.** The owning Organization controls what's offered; PusoStore's platform rules govern what categories of Commerce Item can exist at all.

**Lifecycle.** Drafted → Published → Available → (Sold Out, Retired, or Archived).

**Future extension points.** This is the concept that makes Tickets, Experiences, Equipment, and Memberships possible without re-architecting the platform. Each is a future concrete category beneath Commerce Item, the same way Merchandise is today: a **Ticket** is a Commerce Item granting access to a specific time-boxed event; an **Experience** is a Commerce Item granting access to an activity or interaction rather than a physical good; **Equipment** is a Commerce Item that is physical like Merchandise but carries different fit/safety/technical-spec responsibilities (relevant given the grassroots and barangay-league opportunity identified in the Strategic Research); a **Membership** (see its own entry below) is a Commerce Item representing a durational relationship rather than a single acquisition. None of these require Commerce Item, Collection, Drop, Order, or Payment to change — only Fulfillment (below) needs a category-specific shape for each.

---

### Merchandise
**Core**

**Purpose.** The concrete, physical-goods category of Commerce Item that PusoStore sells today — jerseys, apparel, accessories. This is the platform's entire commerce scope at MVP, by deliberate decision (Decision Log, ADR-003).

**Responsibilities.** Carries the product-level detail generic Commerce Item doesn't need: description, imagery, sizing, and the Product Variants that are actually purchased.

**Relationships.** Is a Commerce Item. Composed of one or more Product Variants. Requires Inventory tracking and Shipment-based Fulfillment.

**Ownership.** The owning Organization (or its licensed production partner) controls design and availability.

**Lifecycle.** Same as Commerce Item, with an additional manufacturing/production step before it can be Published.

**Future extension points.** None beyond what Commerce Item already provides — Merchandise is intentionally the simplest, most fully-built category so the category-agnostic pattern above it can be proven out before a second category is added.

---

### Product Variant
**Core**

**Purpose.** The actual purchasable unit of a Merchandise item — a specific size and color combination, for instance. This is what Inventory tracks and what a Customer actually adds to an Order.

**Responsibilities.** Represents one specific configuration of a Merchandise item, with its own availability and stock level.

**Relationships.** Belongs to exactly one Merchandise item. Is what Inventory counts. Is what an Order line item actually references, not the Merchandise item itself.

**Ownership.** Managed by the owning Organization or its production partner.

**Lifecycle.** Created alongside its parent Merchandise item → Available → (Out of Stock, temporarily or permanently) → Discontinued.

**Future extension points.** The equivalent concept for a future Ticket category is a specific seat or access tier; for Membership, a specific tier or duration. The pattern — "the sellable unit is a specific configuration of the Commerce Item, not the item itself" — repeats across categories even though the configuration options differ.

---

### Collection
**Core**

**Purpose.** A curated, generally persistent grouping of Commerce Items presented together — a kit line, a capsule, an alumni heritage line. Gives a Storefront structure beyond a flat catalog.

**Responsibilities.** Groups Commerce Items around a theme, Season, or Team, and gives that grouping its own presentation on the Organization's Storefront.

**Relationships.** Belongs to one Organization. Contains many Commerce Items, which may also belong to other Collections. May be scoped to a Season. May be the basis for a Drop or the subject of a Campaign, but is not itself either of those — Collection is what's for sale; Drop is how and when it's released; Campaign is why it matters right now.

**Ownership.** Curated by the owning Organization's administrators.

**Lifecycle.** Assembled → Published → (Updated over time as items are added or retired) → Archived, typically at the close of the Season or era it represents.

**Future extension points.** A future Membership tier could bundle access alongside a Collection (a season-ticket-holder-exclusive capsule), without Collection itself needing to change.

---

### Drop
**Core**

**Purpose.** A time-boxed, scarcity-driven release of one or more Commerce Items — implementing the "limited drops" pattern identified as a major global trend, and designed with the Strategic Research's Fanatics case study specifically in mind: a Drop's entire purpose is to convert emotional intensity into urgency without repeating the surge-capacity failure that produced the Super Bowl jersey backlash.

**Responsibilities.** Defines a start time, an end condition (time-boxed or sold-out), and the finite set of Commerce Items or Product Variants available within it. Distinct from Collection: a Collection can persist indefinitely, a Drop cannot.

**Relationships.** Draws from one or more Collections or standalone Commerce Items belonging to one Organization. Is frequently the commercial center of a Campaign, but a Drop can exist without a Campaign around it (a routine restock) and a Campaign can exist without a Drop (a purely narrative moment with no scarcity mechanic).

**Ownership.** Scheduled and configured by the owning Organization, within platform-level guardrails that exist specifically to protect against the demand-forecasting failure mode documented in the Strategic Research.

**Lifecycle.** Scheduled → Live → Ended (by time or by sell-out) → Archived. A Drop's end state is permanent — unlike Collection, a Drop is not reopened.

**Future extension points.** The natural release mechanic for a limited-availability Ticket (a finite number of seats for a single event) or a limited-run Equipment release, reusing the same scarcity and timing logic already built for Merchandise.

---

### Promotion
**Core**

**Purpose.** A price or incentive mechanism applied to Commerce Items, Collections, or Orders — distinct from Drop, which governs availability and timing rather than price.

**Responsibilities.** Defines a discount, bundle, or incentive and the conditions under which it applies.

**Relationships.** May apply to one or more Commerce Items, a whole Collection, or an Order as a whole. Can coexist with a Drop (a launch-week discount) but is conceptually independent of it.

**Ownership.** Configured by the owning Organization, or by PusoStore at a platform level for cross-organization incentives (a sitewide free-shipping threshold, for instance).

**Lifecycle.** Configured → Active → Expired or Manually Ended.

**Future extension points.** Membership (below) is, structurally, a durational Promotion mechanism as much as it is a Commerce Item — a membership tier's core value is often preferential pricing across future purchases, which this concept is already shaped to support.

---

### Membership
**Extension Point — not built today**

**Purpose.** Represents an ongoing, durational relationship between a Customer and an Organization — season-ticket-holder status, a supporters'-club tier, recurring access or benefits — rather than a single acquisition. Named explicitly as one of the four future categories this platform is built to support without a redesign.

**Responsibilities (planned).** Would define a tier, a duration or renewal cadence, and the bundle of benefits (discounts, early Drop access, exclusive Collections) that come with it.

**Relationships (planned).** Would belong to one Organization or Team. Would function partly as a Commerce Item (something a Customer acquires) and partly as an ongoing Promotion (a standing benefit applied to future Orders) — the first future category that meaningfully combines two existing concepts rather than extending one.

**Ownership (planned).** The owning Organization would define its own membership tiers and benefits, within platform rules ensuring the value delivered matches what's promised — consistent with the trust principle applying to every category, not just Merchandise.

**Lifecycle (planned).** Offered → Subscribed → Active (with a renewal or expiration cadence) → Lapsed or Renewed.

**Why it's deferred.** Membership has real operational requirements — recurring billing, renewal communication, benefit fulfillment over time — that are meaningfully different from a single-purchase Order, and building it prematurely risks the same mistake the Decision Log warns against in ADR-003: guessing at an abstraction before the real shape of demand is known.

---

## Layer 3 — The Fan

The Customer and everything that represents their relationship to the platform.

### Customer
**Core**

**Purpose.** Represents a fan — the person the entire platform exists to serve, per the Platform Strategy's framing of a purchase as an identity statement, not a transaction.

**Responsibilities.** Holds identity, purchase history, and the fan-specific relationships (Favorite, Wishlist, Reviews) that make the platform feel personal rather than anonymous. Represents both domestic fans and diaspora fans without distinguishing them structurally — the difference is in behavior and context, not in the underlying concept.

**Relationships.** Places Orders. Maintains a Wishlist and a set of Favorites. May author Reviews. Is the audience for Campaigns and the Discovery Hub's personalization.

**Ownership.** The individual fan controls their own identity and data; PusoStore is the custodian of it.

**Lifecycle.** Registered → Active → (Dormant) → Reactivated or Closed.

**Future extension points.** The subject of a future Membership relationship, and the party a future Ticket or Experience is issued to.

---

### Wishlist
**Core**

**Purpose.** Lets a Customer save specific Commerce Items they intend to buy later — a purchase-intent list scoped to products, not to organizations.

**Responsibilities.** Tracks which specific Commerce Items or Product Variants a Customer has saved, across any number of Organizations.

**Relationships.** Belongs to one Customer. References many Commerce Items across many Organizations. Distinct from Favorite (below), which tracks who a Customer follows, not what they want to buy.

**Ownership.** Entirely the Customer's; visible only to them.

**Lifecycle.** Items are added and removed continuously; the Wishlist itself persists for the life of the Customer's account.

**Future extension points.** Extends naturally to a future Ticket a Customer is watching for availability, or an Experience they're considering.

---

### Favorite
**Core**

**Purpose.** Lets a Customer follow the Organizations and Teams they identify with — the data that represents the layered, multi-loyalty fandom the Strategic Research found to be the norm here (a fan of the national team, a PBA club, a UAAP school, and a barangay squad, all at once, without contradiction).

**Responsibilities.** Tracks which Organizations and Teams a Customer follows. Is the primary input to the Discovery Hub's personalization — what it surfaces to a returning Customer is drawn directly from this.

**Relationships.** Belongs to one Customer. References many Organizations and Teams. Distinct from Wishlist — Favorite is about identity ("who I am a fan of"), Wishlist is about intent ("what I want to buy").

**Ownership.** Entirely the Customer's.

**Lifecycle.** Added when a Customer follows an Organization or Team; persists until removed. Unlike Wishlist, Favorite is not expected to be regularly emptied — it is closer to a standing identity than a shopping list.

**Future extension points.** Naturally extends to following an Athlete's Organization, and would drive eligibility or early access for a future Membership tier tied to the same Organization.

---

### Review
**Core**

**Purpose.** Lets a Customer share feedback on a Commerce Item or an Organization, gated by Trust & Verification to preserve the integrity the Platform Strategy insists on — no anonymous, unverified reviews of the kind that make a generic marketplace impossible to trust.

**Responsibilities.** Captures a Customer's genuine, purchase-verified experience and attaches it to the Commerce Item and, by extension, the Organization behind it.

**Relationships.** Authored by one Customer, about one Commerce Item, tied to a completed Order as proof of genuine purchase. Contributes to an Organization's ongoing trust signal over time.

**Ownership.** The Customer authors it; the platform moderates it against clear, explainable standards, consistent with the Platform Strategy's boundary against trust being opaque.

**Lifecycle.** Eligible (after a completed Order) → Submitted → Published → (rarely) Removed for policy violation.

**Future extension points.** Extends to a future Experience or Ticket the same way it does to Merchandise today — verified attendance or participation standing in for verified purchase.

---

### AI Confidence
**Core**

**Purpose.** Makes the reliability of an AI-assisted output — a virtual try-on result, a fit or size recommendation — visible to the Customer, rather than presenting AI output with false certainty. This is the platform's trust principle applied inward, to its own features, not just outward to Organizations and sellers.

**Responsibilities.** Quantifies and surfaces how reliable a specific AI-generated recommendation or result is at the moment it's shown, so a Customer can weigh it appropriately rather than trust it blindly.

**Relationships.** Attaches to a specific AI-assisted output — most directly, a virtual try-on result or a size recommendation tied to a Product Variant. Informs, but does not replace, the Customer's own judgment.

**Ownership.** Owned by the platform's AI capability; not configurable by any individual Organization, since consistent honesty about AI reliability is a platform-wide trust commitment, not a per-seller choice.

**Lifecycle.** Generated at the moment of the AI output it describes; not persisted as a standing record the way a Review or an Order is — it's a property of a moment, not an object with its own independent life.

**Future extension points.** As AI is used for other decision-support moments — demand forecasting for Drops, fit guidance for Equipment — the same honesty-about-confidence principle applies without needing a new concept.

---

## Layer 4 — Transaction & Fulfillment

What happens after a Customer decides to buy.

### Order
**Core**

**Purpose.** Represents a Customer's commitment to purchase — the transactional record that ties a Customer, one or more Commerce Items, and a Payment together.

**Responsibilities.** Captures what was bought, at what price, by whom, and coordinates what happens next (Payment, Fulfillment).

**Relationships.** Placed by one Customer. May contain Commerce Items from more than one Organization in a single checkout — a deliberate choice, since a fan's layered loyalties mean a single cart may reasonably span a national-team item and a college item at once. Fulfillment is decomposed per-Organization beneath a single Order, the same way a marketplace order splits into multiple sellers' shipments, so that each Organization remains accountable for its own delivery promise even when a Customer's cart isn't scoped to just one of them.

**Ownership.** The Customer initiates it; the platform and the relevant Organizations are jointly responsible for completing it.

**Lifecycle.** Placed → Payment Confirmed → Fulfilling → Completed → (Returned or Cancelled, exceptionally).

**Future extension points.** The same Order concept holds a mix of categories in the future — a jersey and an event Ticket in one checkout — without needing to change; only the per-category Fulfillment beneath it differs.

---

### Payment
**Core**

**Purpose.** Represents the financial transaction that funds an Order — category-agnostic by design, since money moves the same way regardless of what was bought.

**Responsibilities.** Captures and confirms funds for an Order, and coordinates refunds when an Order is cancelled or returned.

**Relationships.** Tied to exactly one Order. Does not vary by Commerce Item category — a future Ticket or Membership payment works through the same concept as a Merchandise payment today.

**Ownership.** Processed by the platform on behalf of the Customer and the Organization(s) involved; the platform is the accountable party for the integrity of the transaction itself.

**Lifecycle.** Initiated → Authorized → Captured → (Refunded, wholly or partly, if the Order requires it).

**Future extension points.** A future Membership's recurring payment is the one meaningful extension needed here — a repeating Payment tied to a standing relationship rather than a single Order — everything else about Payment already generalizes.

---

### Shipment
**Core (Merchandise-specific)**

**Purpose.** The physical fulfillment record for the Merchandise portion of an Order — getting a real, physical object from an Organization to a Customer.

**Responsibilities.** Tracks packaging, carrier handoff, and delivery status for a specific Organization's portion of an Order.

**Relationships.** Belongs to one Order (or, more precisely, to one Organization's portion of an Order, per Order's relationship description above). Is the Merchandise-specific instance of the broader Fulfillment concept below.

**Ownership.** Managed by the owning Organization or its logistics partner, with the platform providing shared shipping infrastructure and, where relevant, diaspora-specific logistics options identified in the Strategic Research.

**Lifecycle.** Preparing → Shipped → In Transit → Delivered → (Returned, exceptionally).

**Future extension points.** Deliberately not the general concept — Shipment is what Fulfillment looks like specifically for a physical good. A future Ticket's "fulfillment" is an access grant, not a Shipment; a future Experience's is a booking confirmation. Shipment stays Merchandise- and Equipment-specific rather than being stretched to cover things that were never physical objects.

---

### Fulfillment
**Core (category-agnostic concept; Shipment is its Merchandise-specific form today)**

**Purpose.** The abstract idea of "delivering on what was purchased," of which Shipment is the only concrete implementation that exists today.

**Responsibilities.** Defines what every category's delivery has in common: a promise made at the moment of purchase, and a status a Customer can track until that promise is kept.

**Relationships.** Every Order's Commerce Items require some form of Fulfillment. Today, that form is always Shipment. 

**Ownership.** Ultimately the owning Organization's responsibility, supported by shared platform infrastructure.

**Lifecycle.** Mirrors whichever concrete form applies — Shipment's lifecycle today.

**Future extension points.** This is the concept that most directly needs a new concrete form per future category: a Ticket's fulfillment is an **access grant** (a scannable pass or confirmation, not a physical shipment); an Experience's fulfillment is a **booking confirmation** with a scheduled time; Equipment's fulfillment likely remains Shipment-shaped, given it's physical, but may require additional fit or safety confirmation steps Merchandise doesn't. None of these require Order or Payment to change — only a new sibling to Shipment beneath Fulfillment.

---

### Inventory
**Core**

**Purpose.** Tracks how much of a specific Product Variant is available to sell, preventing the overselling and underselling failure modes documented at length in the Strategic Research (both the general overselling risk and the specific Fanatics surge-forecasting failure).

**Responsibilities.** Maintains an accurate, real-time count of available stock per Product Variant, and reserves stock at the moment an Order is placed rather than only at Payment confirmation, to prevent two Customers from being sold the same last unit.

**Relationships.** Tracks exactly one Product Variant per record. Consulted whenever a Commerce Item is added to an Order, and especially load-bearing during a Drop, when demand is concentrated into a short window by design.

**Ownership.** Managed by the owning Organization or its production partner; platform-level safeguards exist to prevent overselling regardless of who's managing the count.

**Lifecycle.** Stocked → Reserved (during checkout) → Committed (on Order completion) or Released (if checkout doesn't complete) → Replenished or Discontinued.

**Future extension points.** The same concept generalizes to a Ticket's seat count or an Experience's available time slots — "how many of this specific thing are left" is category-independent, even though what's being counted differs.

---

## Layer 5 — Presence & Story

Where fans encounter Organizations, and the narrative layer that makes commerce feel like fandom rather than shopping.

### Storefront
**Core**

**Purpose.** The owned, branded destination for a single Organization — where a fan who already knows who they support goes to shop, browse, and belong. Implements the Decision Log's position that the homepage and an Organization's storefront do different jobs.

**Responsibilities.** Presents one Organization's Teams, Collections, Drops, Campaigns, and Story content as one coherent, ownable destination.

**Relationships.** Belongs to exactly one Organization. Houses that Organization's Collections and Commerce Items. Distinct from the Discovery Hub, which belongs to no single Organization.

**Ownership.** The Organization's administrators control its presentation; the platform provides the shared infrastructure it runs on.

**Lifecycle.** Created alongside Organization verification → Active → (rarely) Archived if an Organization becomes inactive.

**Future extension points.** The natural home for a future Membership sign-up specific to that Organization, and for future Ticket sales to that Organization's events.

---

### Discovery Hub
**Core**

**Purpose.** The platform-owned surface — the homepage — whose job is routing and introduction: surfacing trending Organizations, live moments, and cross-pyramid highlights to fans who haven't yet decided who to follow, or who follow many.

**Responsibilities.** Aggregates and personalizes across every Organization on the platform, using a Customer's Favorites where available and platform-wide trends and moments where not.

**Relationships.** Draws from every Organization's Campaigns, Drops, and Stories, but is owned by none of them. The only concept in this model owned at the platform level rather than by an Organization or a Customer.

**Ownership.** PusoStore, directly — the one surface in the model without a single Organization or Customer as its owner.

**Lifecycle.** Continuously updated rather than versioned per-item; its content changes with what's live and trending, not through a discrete lifecycle of its own.

**Future extension points.** As new categories launch, the Discovery Hub becomes the cross-category surface — a fan could be routed toward a Drop, a Ticket, or a Membership offer from the same discovery surface, personalized the same way.

---

### Story
**Core**

**Purpose.** Narrative, editorial content — a rivalry's history, an athlete's journey, the meaning behind a Collection — that gives commerce the storytelling foundation the platform audit found missing entirely from the current app. Directly answers the Platform Strategy's position that a product without a story and a real institution behind it isn't something this platform sells.

**Responsibilities.** Carries narrative content that can exist independently of any specific sale, and can be attached to Organizations, Teams, Athletes, Collections, or Campaigns to give them meaning beyond a product listing.

**Relationships.** Authored by or on behalf of one Organization. May be referenced by a Campaign to add narrative weight to a Drop, but doesn't require one — a Story can stand alone as pure content.

**Ownership.** The Organization controls its own narrative; editorial support may come from PusoStore's media capability given its broadcast origins.

**Lifecycle.** Drafted → Published → (Featured, during a relevant moment) → Archived, though archived Stories remain part of an Organization's heritage content rather than being deleted.

**Future extension points.** The natural narrative companion to a future Experience (the story behind why this meet-and-greet matters) or a Membership tier (the story of what belonging to this supporters' tier means).

---

### Media
**Core**

**Purpose.** The raw asset layer — images, video, livestream references — that Story, Commerce Item, and Organization/Team profiles all draw on. Distinct from Story: Media is the asset, Story is the narrative built from it.

**Responsibilities.** Stores and serves the visual and video assets the rest of the model needs to actually be seen — product photography, team and athlete imagery, broadcast clips referenced by a Story or Campaign.

**Relationships.** Referenced by Commerce Items (product imagery), Organizations and Teams (identity imagery), and Stories and Campaigns (narrative and promotional imagery). Has no independent meaning on its own — Media only matters in service of something else in this model.

**Ownership.** Uploaded and managed by the owning Organization, or sourced from Puso's own broadcast archive where relevant — directly relevant to the contextual-commerce principle, since a broadcast clip is Media that can turn a live moment into a linked Commerce Item.

**Lifecycle.** Uploaded → Attached to one or more other concepts → Retired when no longer referenced.

**Future extension points.** As live, contextual commerce matures, Media becomes the connective tissue between a livestream moment and a buyable Commerce Item — this is already how the concept is shaped, not something that needs to be added later.

---

### Season
**Core**

**Purpose.** A time-bound competitive period — a UAAP season, a PBA conference, an Olympic or SEA Games cycle — that gives real-world sports time structure to Collections, Drops, and Campaigns.

**Responsibilities.** Defines a start and end for a competitive period, giving other concepts a way to be scoped to "right now" in sports terms rather than an arbitrary calendar date.

**Relationships.** Associated with one or more Organizations (a league-level Organization's Season may be shared by all its member Teams). Collections and Campaigns may be scoped to a Season; Drops are more often scoped to a specific moment within one.

**Ownership.** Defined by the relevant league or federation Organization, or by PusoStore for cross-organization moments like an Olympic cycle that spans many Organizations at once.

**Lifecycle.** Announced → In Progress → Concluded → (referenced indefinitely afterward for heritage purposes, per the college-rivalry, generational-loyalty pattern the Strategic Research identified).

**Future extension points.** The natural scope for a future season-long Membership tier, and the natural time-boundary for a set of Tickets to that Season's home events.

---

### Campaign
**Core**

**Purpose.** The orchestration layer that ties a Story, Media, a Collection or Drop, and often a Promotion together around a specific real-world moment — a Season milestone, a national-team call-up, a Finals run. This is the concept that makes ADR-005's contextual-commerce principle operational rather than aspirational.

**Responsibilities.** Coordinates when and how a moment becomes commercially visible across the Storefront, the Discovery Hub, and any embedded/contextual surface (a livestream overlay, a recap article) it's attached to.

**Relationships.** Belongs to one Organization (or, for a cross-organization moment like a national tournament, may be coordinated at the platform level). May reference one or more Stories, one or more Collections or a Drop, and Media. Distinct from Drop — a Campaign is the "why now," a Drop is the "what's for sale and until when," and a single Campaign may exist with no Drop at all, or coordinate more than one.

**Ownership.** Planned by the owning Organization, often with PusoStore's editorial and broadcast support given the contextual-commerce advantage that support represents.

**Lifecycle.** Planned → Live (timed to the real-world moment it's built around) → Concluded → Archived, with its constituent Story content often outliving the Campaign itself.

**Future extension points.** The natural coordination layer for launching a future Ticket sale or Membership offer around a real moment, exactly the way it coordinates a Merchandise Drop today — Campaign doesn't change; what it coordinates simply grows.

---

## How to read this model going forward

Twenty-four concepts were named at the outset; four more — Trust & Verification, Athlete, Discovery Hub, and Membership — were added because the platform doesn't hold together without them. Of the resulting twenty-eight, only one, Membership, is a true extension point with nothing built today. Everything else is Core — because PusoStore is, by deliberate decision, a merchandise platform right now, not a platform pretending to be four platforms at once.

What makes this model worth having isn't that it lists every concept. It's that the concepts built today — Commerce Item, Fulfillment, Organization chief among them — were shaped from the start to hold Tickets, Experiences, Equipment, and Membership without being redesigned when those categories eventually get built. That was the point of writing this before writing any more code.
