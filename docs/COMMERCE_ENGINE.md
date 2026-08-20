# PusoStore Commerce Engine

**Version 1.0**

The Capability Model named Commerce, Payments, Fulfillment, and Operations as separate bounded capabilities. This document is where they meet: the business architecture of how a fan's intent actually becomes a completed, trustworthy transaction — what must be true at each stage, and why, independent of how any of it is eventually built.

Fifteen topics, organized into the nine stages a transaction actually moves through: what can be sold, what it costs, what's available, how scarcity is released, committing to buy, the full landed cost, moving money, reversing a transaction, and growing the engine to categories beyond Merchandise. Business architecture, not implementation — every rule below is a policy decision, not a technical one.

Builds on the **Domain Model** (Commerce Item, Product Variant, Order, Payment, Shipment, Inventory, Drop, Promotion), the **Capability Model** (Commerce, Payments, Fulfillment, Operations), and the **Trust Model** (Payment Trust, Shipping Confidence, Fulfillment Trust, Guarantees).

---

## Stage 1 — What Can Be Sold: Commerce Items and Products

A **Commerce Item** is the abstract listing — category-agnostic, per the Domain Model. A **Product** (Merchandise, today's only concrete category) is its realized form, and beneath every Product sit its **Product Variants**: the specific size-and-color combinations a fan actually buys.

**Governing rule: pricing, inventory, and fulfillment always operate at the Variant level, never the listing level.** A size-8 shirt and a size-10 shirt of "the same product" are, for every business purpose that matters — can it be sold, is it in stock, what does it cost — two entirely separate things that happen to share a description and photos. Treating them as one thing anywhere in the pricing or inventory logic is how a platform ends up promising something it can't actually deliver.

**Governing rule: a Commerce Item cannot move to "Available" until every Variant beneath it has, at minimum, a price and an initial stock figure.** There's no such state as half-published — a listing missing that information for even one Variant isn't live with a gap in it, it's simply not live yet.

---

## Stage 2 — What It Costs: Pricing, Promotions, Discounts, Bundles

This is the cluster most often built sloppily, because the four pieces interact and it's tempting to let them blur together. They don't.

**Pricing** is the base layer: every Variant has exactly one canonical price at any given moment, set by its owning Organization. There is no supported state where a Variant has two simultaneous "true" prices — anything that changes what a fan actually pays flows through the Promotions layer, never through silently editing the base price. This keeps a clean, always-auditable line between *what this costs* and *what it's being sold for right now*.

**Promotion** is the umbrella business object: it defines who qualifies (which Organization, Collection, or specific Commerce Items), when it's active, and which incentive mechanism it authorizes underneath it.

**Discount** is the single-item price-reduction mechanic a Promotion can authorize — a fixed amount or percentage off one Variant.

**Bundle** is the multi-item pricing mechanic — a defined group of Commerce Items priced together for less than their sum. A Bundle is deliberately distinct from a Collection: a Collection is curatorial, meant to be browsed and understood; a Bundle is a pricing decision, meant to be purchased as a unit. A Bundle's items are often drawn from a Collection, but the two are never the same mechanism wearing different names.

**Governing rule: by default, only the single best-for-the-fan Promotion applies to a given Variant in an Order — Discounts and Bundles do not silently stack.** Any exception has to be an explicit, deliberate choice by the owning Organization, never an accidental default. Uncontrolled stacking is a margin risk for the Organization and, less obviously, a trust risk for the platform: a fan who stumbles into an unintended 70% off starts to wonder what the "real" price of anything here actually is.

**Governing rule: the price a fan sees at the start of checkout is the price they pay, for a bounded window.** A live price change mid-checkout doesn't retroactively raise what's already been agreed to — the same principle the Trust Model already establishes for Payment Trust, applied here at the pricing layer instead.

---

## Stage 3 — What's Available: Inventory

**Governing rule: stock is reserved the moment an Order is placed, not only once Payment is confirmed.** The same-last-unit problem doesn't wait for a payment gateway to respond, so the reservation can't either.

**Governing rule: a reservation not converted into a completed Order within a bounded window releases automatically.** An abandoned checkout cannot lock up the last unit of a Drop item indefinitely — the reservation exists to prevent a genuine conflict between two real buyers, not to reward whoever clicked first regardless of whether they ever intended to complete the purchase.

**Governing rule: displayed availability always reflects committed reservations, never a hopeful "should still be available" state.** This is the rule written most directly in response to the industry's clearest cautionary tale, documented elsewhere in this series — overselling is a governance failure, not bad luck, and this rule is the governance.

---

## Stage 4 — Releasing Scarcity: Drops

A Drop is a business commitment, not a marketing wrapper placed over existing inventory. Operations has to certify real capacity before Commerce is allowed to schedule a Drop's start time — a Drop that goes live without that certification is the exact failure this entire engine exists to prevent.

**Governing rule: a Drop's end condition — fixed time, or sell-out, whichever comes first — is decided and fixed before it goes live, never decided in the moment based on how demand looks.** Changing a Drop's rules while it's running, even with good intentions, is one of the fastest ways to convert fan excitement into a trust incident.

---

## Stage 5 — Committing to Buy: Checkout and Orders

Checkout is a process, not a business object with its own permanent lifecycle. It's the moment Pricing, Promotions, Inventory reservation, Shipping, Taxes, and Payment authorization all get resolved together, atomically, into the one thing that *does* have a permanent lifecycle: the Order.

**Governing rule: nothing is final until Checkout completes successfully as a whole.** A partially completed checkout — payment authorized but the inventory reservation already expired, say — is not a valid end state. It either resolves completely or fails completely, and the fan is told clearly which one happened.

**Governing rule: a single Order can contain Commerce Items from more than one Organization, per the Domain Model's own decision — but every downstream consequence is tracked per-Organization beneath that one Order.** Fulfillment, refunds, and Trust signals all decompose by Organization, so no Organization is ever held responsible for another's part of a shared cart.

---

## Stage 6 — The Full Landed Cost: Shipping and Taxes

**Governing rule: shipping cost and tax are calculated as part of the same atomic checkout resolution as price — never revealed as a separate, later step.** A fan commits to one total number, once, not a price that quietly grows as they proceed.

Shipping needs at least three distinct business profiles, not one generic calculator: domestic delivery, international delivery to a fan abroad, and delivery to the Philippines on behalf of a fan abroad — the OFW gifting pattern documented in the Journey Maps. Treating the third as a minor variant of the first two, rather than its own real profile, is exactly the gap already flagged there.

Taxes need a clean, honest line between what PusoStore collects and remits on the platform's behalf, and what remains the buyer's own responsibility once an order crosses a border. Customs duties are not something the platform can silently absorb or promise away — being upfront that they may apply is a better trust outcome than pretending otherwise at checkout and letting the fan discover it later.

---

## Stage 7 — Moving Money: Payments

**Governing rule: payment authorization happens as part of Checkout's atomic resolution, locking in the Order — but capture can be tied to different business timing depending on what's being bought.** For Merchandise today, authorization and capture happen essentially together, since it's a single, complete transaction with nothing left to determine afterward.

**Governing rule: a refund is scoped to the specific Organization's portion of an Order that's actually being returned or cancelled.** Refunding one Organization's item never touches the Payment already settled for another Organization's item in the same Order.

---

## Stage 8 — Reversing the Transaction: Returns

A return is not a single action — it's a coordinated reversal across everything the original Order touched. Inventory is restocked, or isn't, if the reason is a defect that makes the item unsellable. Payment is refunded. Fulfillment status is updated. And where the reason is authenticity or quality rather than a simple change of mind, the event feeds Trust's ongoing monitoring of the Organization involved, exactly as the Trust Model's Fulfillment Trust mechanism describes.

**Governing rule: baseline return terms are consistent across every Organization on the platform, even where an Organization chooses to offer more generous terms of its own.** A fan's trust in PusoStore as a whole cannot become conditional on which specific Organization they happened to buy from — that would quietly turn a platform-wide Guarantee into something only some purchases actually carry.

---

## Stage 9 — Growing the Engine: Future Commerce Categories

The test of whether this engine was actually built as business architecture, and not just a Merchandise system with a category label, is whether it holds for Tickets, Experiences, Equipment, and Membership without being rebuilt.

| Stage | What stays exactly the same | What needs a new concrete shape |
|---|---|---|
| Commerce Items / Products | The Commerce Item anchor itself | A new concrete category per type — the same pattern Merchandise already follows |
| Pricing | The single-canonical-price rule | Membership introduces recurring, tiered pricing — the one genuinely new pricing pattern |
| Promotions / Discounts / Bundles | The whole mechanism, unchanged | A Bundle can no longer span Pass and Merchandise, since one purchase can't anymore either — see the Checkout / Orders row |
| Inventory | Reserve → commit → release | Counts a different thing per category — seats, time slots, membership-tier capacity — but the mechanism doesn't change |
| Drops | The whole mechanism, unchanged | Applies directly to a limited Ticket release or a limited Equipment run |
| Checkout / Orders | The whole mechanism, including multi-Organization Orders | One exception, decided after this table was written: Pass (née Ticket) and Merchandise are kept out of the same Order entirely, not merged — see Decision Log ADR-011 addendum (2026-08-20) |
| Shipping / Taxes | The atomic, upfront-disclosure rule | Tickets and Experiences need a sibling to physical shipping — an access grant or booking confirmation, not a package |
| Payments | Authorization at Checkout | Membership needs the one genuinely new capability: recurring capture |
| Returns | The coordinated-reversal pattern | Tickets and Experiences need a different concrete meaning of "return" — cancellation and refund policy rather than physical restock — but the pattern itself still applies |

Nearly every row reads "unchanged." That's the point, and it's not an accident — it's what building Commerce Item as a category-agnostic anchor, back in the Domain Model, was actually for. The two genuinely new things this engine will need — recurring payment capture and a non-physical Fulfillment sibling to Shipment — are exactly the two extension points already named when Membership and Tickets were first identified as future categories. Nothing in this document was a surprise by the time it was written; that was deliberate.
