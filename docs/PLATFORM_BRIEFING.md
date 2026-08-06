# PusoStore — Platform Briefing

Source content for the stakeholder presentation deck (published as a Claude Artifact, click-through slide format). This is the markdown version — same content, plain-text form, for anyone who wants to read, edit, or repurpose it without the slide viewer.

Two parts: **Part 1** is written for leadership and stakeholders (positioning, differentiation, cost structure). **Part 2** is a technical deep-dive for engineering and operations (architecture, workflows, key decisions). Cost figures are marked `[fill in]` — real cost *categories* and *scaling drivers*, no invented numbers. Pull actual figures from the Railway / Cloudinary / WaveSpeed / Maya dashboards before presenting.

---

## Part 1 — Platform Overview & Costs

### PusoStore

**Not a marketplace. A digital home for the institutions Filipino sports fans already believe in.**

What makes it different, what it costs, and how it's built.

*Prepared for leadership & stakeholders · [presenter name] · [date]*

---

### Why this exists

**Philippine sports fandom has no real commerce home.**

- **Fragmented today** — Fans of UAAP, PBA, PVL, and the national teams buy jerseys through resellers, Facebook groups, and one-off drops — no authenticity guarantee, no relationship with the team itself.
- **Built for feeds, not for fandom** — Shopee and Lazada treat "basketball" as a category tag. A UAAP alum searching for their school's jersey gets the same experience as someone buying a phone case.
- **Millions with nowhere to belong** — Local diehards, barangay league pride, and millions of Filipinos abroad who still want to rep home teams — none of them have a platform built around who they support.

---

### The platform

**One platform, one loop.**

1. **Discover** — Find the organization you support
2. **Follow** — Build a real, lasting relationship
3. **Try On** — See it on yourself with AI Fit Check
4. **Buy** — Verified, official merchandise
5. **Own It** — Tracked in My PUSO, your fan home

Every purchase deepens a real relationship between a fan and the institution they support — not a transaction with a faceless storefront.

---

### How we're different

**This is not another marketplace.**

| | Generic Marketplace | Single-Brand Shop | **PusoStore** |
|---|---|---|---|
| **Who can sell** | Anyone who signs up | Just one brand | **Verified institutions only** |
| **Fan relationship** | None — you buy from a stranger | One brand, no discovery | **Follow, own history, real belonging** |
| **Authenticity** | Buyer beware | Guaranteed, one team only | **Guaranteed, across every team** |
| **Growth model** | More sellers, more noise | Can't expand past one brand | **More verified institutions, same trust** |

---

### The founding decision

**Organization-first, not product-first.**

**Typical ecommerce:**
- Product catalog is the anchor
- Sport / team is just a filter attribute
- One generic storefront for everyone
- No durable identity for any one team or league

**PusoStore:**
- Organization (team, league, or athlete) is the anchor
- Every org owns its own storefront, trust status, and products
- Navigation and search route fans to *who* before *what*
- Products live underneath — never the other way around

This is the structural decision behind the comparison above — not a marketing claim, an architecture one. It shapes navigation, search, trust, and checkout alike.

---

### A deliberate choice

**We said no to being Shopee.**

Early on, the platform considered an open marketplace model — anyone can list, scale as fast as sign-ups allow. We rejected it, on purpose.

- **What we gave up** — Instant catalog breadth. Any seller who wants in, in — the fastest way to look big.
- **What we protected** — The one thing a marketplace can't credibly claim: verified, direct-from-institution authenticity. That's the actual moat.

Curated over unlimited. Every organization on PusoStore is a real, vetted institution — never an anonymous seller account.

---

### Fit Check · The Problem

**Buying clothes online is a guess.**

And a wrong guess costs the business twice — once when a hesitant fan doesn't buy at all, and again when they do, get it wrong, and send it back.

---

### Fit Check · The Real Cause

**Returns are a sizing problem. Sizing is a confidence problem.**

> "Will this actually fit me?" — the confidence gap every online shopper hits
> ↓
> A guess, not a decision — the fan picks a size hoping, not knowing
> ↓
> **Outcome A:** Cart abandoned. No sale at all — the safest guess is not buying.
> **Outcome B:** Wrong size arrives. A return, a refund, and a fan who hesitates next time too.

Either way, the business loses — not to a bad product, to an unanswered question.

---

### Fit Check · The Fix

**Fit Check closes the confidence gap before checkout.**

One photo. One product. One real render of the fan actually wearing it — not a mockup, not a generic AR filter. No Philippine sports commerce platform has this today.

Real render of the real product · Generated per product, per fan · Answers the question before checkout, not after delivery

The fan doesn't have to imagine whether it fits. They see it.

---

### Fit Check · The Business Model

**Sponsored Fit Checks turn a feature into a revenue line.**

Organizations and brand sponsors back a Fit Check campaign on their own products — unlimited generations for the fan, real placement value for the sponsor.

**Why sponsors pay for this:**
- A placement no marketplace product listing can offer — the fan is trying the product on, not scrolling past it
- Campaign-level conversion analytics prove the sponsorship's ROI back to the sponsor
- Deepens the organization's own relationship with the platform, not just a media buy

A feature that costs to run becomes a line item sponsors want to fund.

---

### Fit Check · The Payoff

**A reason to open the app today, not just when you want to buy.**

A tiered daily allowance — guest, registered, premium — makes Fit Check a daily habit, not a one-time gimmick.

| Outcome | Why |
|---|---|
| **Higher conversion** | Confidence before checkout, not doubt after |
| **Fewer returns** | The right size, the first time |
| **New revenue** | Sponsored campaigns, not a cost center |
| **Daily engagement** | A reason to return, not just transact |

---

### Beyond Fit Check

**Sponsorship isn't limited to Fit Check.**

These are already live, rendering surfaces in the app today — none of them are monetized yet.

- **Fit Check Loading Screen** — A ~30–75 second autoplay video ad fills the screen on every generation — one fixed placement today, not sold to anyone yet.
- **Featured Team** — A curated homepage slot, already integrated and rendering — today it's an editorial choice, not a paid one.
- **Partner Logo** — The platform's existing co-brand and sponsor logo placement, on the homepage and footer — built for exactly this relationship.
- **Hero Campaign** — The homepage's single most valuable pixel. A title run, a drop, a season moment — an organization or brand could own it for that window.

None of these need to be built — they're already running. The only missing piece on any of them is someone paying for it. Membership, on the V3 roadmap, is different: not a placement sale, the platform's first genuinely recurring-revenue product.

---

### Where this is going

**Commerce that lives inside the moment, not next to it.**

A buzzer-beater, a title run, a viral highlight — that's when a fan actually wants to buy. Most platforms make them leave the moment and go find a store. PusoStore's product surfaces are being built as embeddable components — droppable into a livestream, a recap, a highlight itself, not just a page a fan has to separately navigate to.

**Why a competitor can't just copy this:** Puso Pilipinas' broadcast, livestream, and social presence is an asset a commerce-only competitor cannot replicate without also owning the content.

---

### Not just merch, forever

**One commerce engine, built to outgrow itself.**

Merchandise is what we sell today — but the underlying product model is category-agnostic by design. Tickets, Experiences, Equipment, and Membership attach later without redesigning checkout, pricing, or orders.

`Merchandise (live today) → Tickets → Experiences → Membership (recurring revenue)` — all extension points, none built yet except Merchandise.

The difference between a platform and a product: a product does one thing; a platform is built to do the next thing too, without a rebuild.

---

### Why fans can trust it

**Every seller is a verified institution.**

- **Trust is infrastructure** — Granted, monitored continuously, and revocable — never a static badge bolted onto a product page.
- **Human-decided, always** — AI can flag anomalies. It never grants, denies, or revokes an organization's verified status.
- **One baseline guarantee** — Return terms are consistent platform-wide — an org can be more generous, never less.

---

### Retention, not just conversion

**We optimize for fandom, not just checkout.**

Most ecommerce platforms have an "Order History" page. PusoStore has My PUSO — a fan's actual home.

- **Home** — A living feed of what changed since your last visit — not a dashboard of stats about you.
- **Locker** — A growing personal collection — never just "purchases."
- **Fit Check** — Identity and self-expression — never a utility buried in account settings.
- **Following** — The mechanism that makes fandom, not shopping, the reason to come back tomorrow.

A generic store gives you a receipt. PusoStore gives you a locker.

---

### Why this should matter to stakeholders

**Built right, not just fast.**

The commerce fundamentals most platforms get wrong at this stage — we didn't skip them.

- **No phantom stock** — Stock is reserved the instant an order is placed, never shown as available when it isn't — the exact bug behind real overselling scandals elsewhere.
- **No untraceable money** — Every payment attempt and every refund is its own permanent record — never a single field silently overwritten.
- **No blind trust in a webhook** — Every payment notification is independently re-verified before anything is acted on — closes a fraud vector most integrations leave wide open.
- **A real audit trail** — Every inventory change, every status change, records who, what, and why — never a black box.

---

### What drives spend

**Two kinds of cost.**

- **Fixed infrastructure** — Costs that exist whether the platform serves 10 fans or 10,000 this month: application hosting, database, error monitoring (when enabled).
- **Usage-based services** — Costs that scale directly with real activity: media storage & delivery, AI image generation, payment processing fees, transactional email.

Figures below are placeholders — framework and cost drivers are real.

---

### Cost breakdown

**Where the platform spends.**

| Category | Powers | Scales with | Monthly cost |
|---|---|---|---|
| Hosting & Database | App server + all persistent data (Railway, Postgres) | Traffic, data volume | *[fill in]* |
| Media & CDN | Product images, Fit Check photos, transformations (Cloudinary) | Storage + bandwidth + transforms | *[fill in]* |
| AI Generation | Virtual try-on image generation (WaveSpeed / Replicate) | # of Fit Check generations | *[fill in]* |
| Payments | Checkout processing (Maya) | % + fixed fee per transaction | *[fill in]* |
| Cache & Queue | Rate limiting, session cache, async jobs (Redis) | Traffic | *[fill in]* |
| Search | Organization / team / product search | Index size + query volume | *[fill in]* |
| Transactional Email | Order, payment, and notification emails | # of emails sent | *[fill in]* |
| Error Monitoring | Sentry — coded and ready, **currently off** | Event volume | ₱0 by design |

---

### Unit economics

**Cost per meaningful action.**

| Metric | Formula |
|---|---|
| Cost per order fulfilled | Fulfillment + payment-fee spend ÷ orders/month |
| Cost per Fit Check generation | AI generation spend ÷ generations/month |
| Cost per org onboarded | Verification + support time ÷ orgs onboarded |
| Blended cost / active fan / month | Total infra spend ÷ monthly active fans |

Formulas are real; figures fill in once billing data for the reporting month is pulled from Railway / Cloudinary / WaveSpeed / Maya dashboards.

---

### Where we're headed

**A four-stage release ladder.**

1. **MVP — Foundation** — Safety-net fixes + one pilot organization on the new model
2. **V1 — Identity-First** — Full migration, Trust live, Design System everywhere
3. **V2 — Growth Mechanics** — AI recommendations, Drops, contextual commerce
4. **V3 — New Categories** — Membership (recurring revenue), OFW & diaspora logistics, long-term AI

Membership is chosen first in V3 specifically because it's the real test of whether "built to outgrow itself" actually holds — and it's the platform's first recurring-revenue product, not another one-off sale.

Nothing in a later stage is built against the old data model to save time — it gets built once, correctly, or it gets built twice.

---

## Part Two — How Everything Works

*A technical walkthrough for engineering & operations — architecture, workflows, and the decisions behind them.*

### Built to be understood, not just used

- **Who this is for** — Engineering, operations, and anyone taking over or extending the platform day-to-day.
- **What it covers** — System architecture, the domain model, real operational workflows, and the decisions that shaped them.
- **What it isn't** — A line-by-line code walkthrough — this is the map; the code and `docs/` are the territory.

---

### The stack

**A modular monolith on a modern stack.**

- **Frontend** — React + Vite, mirroring the Organization → Team → Collection → Product hierarchy.
- **Backend** — Node.js + Express — one deployed service, internally organized around 17 capability boundaries.
- **Database** — PostgreSQL on Railway via Prisma — real transactions for every atomic commerce operation.
- **Cache & Queue** — Redis — rate limiting, session cache, async AI/notification jobs. Never used for inventory.
- **Media** — Cloudinary — real image transformation, not full-res assets shipped everywhere.
- **External services** — Maya (payments), WaveSpeed/Replicate (AI generation) — both behind gateway-agnostic interfaces.

One deployed service, not microservices — that's a scale problem this platform doesn't have yet.

---

### The core nouns

**28 concepts, 5 layers.**

| Layer | Concepts |
|---|---|
| Institutions | Organization, Team, Athlete, Partner, Trust |
| Commerce | Commerce Item, Merchandise, Variant, Collection, Drop, Promotion |
| The Fan | Customer, Wishlist, Favorite, Review |
| Transaction & Fulfillment | Order, Payment, Shipment, Inventory |
| Presence & Story | Storefront, Discovery Hub, Story, Media |

---

### Who owns what

**Every feature names exactly one capability.**

Layer dependency, bottom-up:

1. **Identity** — Foundational — everything else sits on top of it
2. **Trust · Organizations · Partner** — The institutional layer
3. **Commerce · Payments · Fulfillment · Operations** — Transacts through those institutions
4. **Discovery · Search · Confidence · AI** — Helps fans navigate honestly
5. **Content · Media · Customer · Notifications** — Makes it feel like fandom
6. **Analytics** — Watches everything, decides nothing

---

### Workflow · Orders

**From cart to delivered.**

1. **Checkout** — Pricing, stock, shipping, tax & payment resolve atomically — or not at all
2. **Payment** — Maya checkout, independently re-verified
3. **Shipment** — Picking → Packing → QC → Courier
4. **Delivered** — Real timeline, live status
5. **Return path** — Branches off if needed — its own workflow

**Stock is reserved at order placement**, not payment confirmation — and releases automatically if checkout doesn't complete in time.

---

### Workflow · Payments

**Payment is its own record, not a field on Order.**

- **One Order, many Payments** — Every checkout attempt — including a regenerated session after expiry — is its own row, not an overwrite. "The current payment" is just the most recent one.
- **No webhook trusted at face value** — A webhook is treated as a bare wake-up signal, then independently re-verified against the gateway's own status API before anything is acted on. Always — not just for Maya.

---

### Workflow · Fulfillment

**A real operational queue, not a status dropdown.**

`Awaiting Picking → Picking → Packing → QC → Ready for Courier → In Transit → Delivered`

Every stage is staff-assignable and validated against a real state machine — an illegal jump (e.g. skipping straight to Delivered) is rejected, not silently accepted.

---

### Workflow · Returns & Refunds

**A coordinated reversal, not a single click.**

`Requested → Reviewed & Approved → Shipped Back → Inspected → Refunded`

**Only sellable-condition items restock automatically** — damaged or unsellable items are quarantined, never silently returned to sellable count.

---

### Workflow · AI Generation

**Photo in, try-on out — asynchronously.**

`Upload photo → Quota check (atomic, Redis-backed) → Queued generation → AI provider → Delivered to fan`

Generation runs async on a queue — a real AI call can take up to 75 seconds, and no request is ever left blocking on it.

---

### Workflow · Operations

**Staff work from real queues, not spreadsheets.**

- Fulfillment — picking through delivery
- Returns & Refunds — review through payout
- Inventory alerts — low stock, damaged, quarantine
- Automated business reports

**Real RBAC, day one** — Staff profiles carry a department and explicit permissions — separate from the coarse admin/customer role gate — so visibility can scope to what a role actually needs.

---

### Content model

**Nothing a marketer needs to change requires a developer.**

Headlines, images, CTAs, nav labels, FAQ, footer copy — all live in the database, editable from the Admin Dashboard.

- **Lives in code** — Design system (tokens, layout), reusable UI components, icon shapes, utility config
- **Lives in the database** — Homepage hero, campaigns, promos, navigation & footer content, FAQ, featured teams, partner logos

---

### Measurement

**The business gets a report before anyone has to ask.**

- **Daily** — 5:00 AM Philippine time, every day
- **Weekly** — Every Monday
- **Monthly** — 1st of the month
- **Quarterly** — Jan / Apr / Jul / Oct

Sales, products, organizations, customers, payments, shipping, Fit Check conversion, and fulfillment queue health — one email, no one has to build a dashboard query to find out how the business is doing.

---

### Why it's built this way

**A few decisions everything else depends on.**

1. **Organization is the top-level entity** — Every product, storefront, and trust signal scopes to an Organization first, sport/category second.
2. **Payment is its own entity** — One-to-many with Order — a full attempt history, not one overwritten field.
3. **Fulfillment is its own entity, the same way** — Shipment carries granular staff-facing status; Order stays the simple customer-facing read.
4. **No webhook is ever trusted at face value** — Every delivery is independently re-verified against the provider's own API before anything is acted on.

---

### Day-to-day reference

**Common tasks, where they live.**

| Task | Where | Notes |
|---|---|---|
| Process a return | Admin → Returns & Refunds | Inspect items; refund auto-created on submit |
| Check payment health | Admin → Reports | Webhook Health panel, Checkout Recovery report |
| Update homepage content | Admin Dashboard → Homepage | No deploy needed — content lives in the DB |
| Track a stuck shipment | Admin → Fulfillment | SLA sweep auto-flags anything stuck past threshold |
| Grant a bonus Fit Check | Admin → Fit Check | Manual grant, or automatic on profile/verification/purchase |

---

### Reference

**This deck is a summary.**

The full detail lives in `docs/` — Domain Model, Capability Model, Commerce Engine, Trust Model, and the Decision Log recording every major architectural call and why it won.

*Questions?*
