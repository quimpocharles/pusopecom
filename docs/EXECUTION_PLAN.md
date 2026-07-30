# PusoStore Execution Plan

**Version 1.0**

Nine documents defined what PusoStore is and why it should be built this way. This one converts that into an order of operations — what happens first, what it unlocks, what it would cost to get wrong, and how to know each step actually worked. Everything here is sequenced by one question, asked at every step: what does this depend on, and what depends on it?

This document assumes the entire series as context, especially the **Decision Log** (ADR-001/002's organization-first decision, which turns out to be the single largest dependency in this whole plan), the **Technical Architecture** (which already mapped every technology decision back to a specific gap), and the **Design System migration plan** (whose phased, regression-minimizing logic this document extends from the UI layer to the whole platform).

---

## Dependencies

Stated first, because the phases below aren't an arbitrary sequence — they're a direct consequence of this dependency graph.

**Everything depends on the Organization-first data model existing.** The Domain Model, the Capability Model's per-Organization Authorization, the Information Architecture's whole navigational spine, the Trust Model's per-Organization verification, and the Commerce Engine's multi-Organization Order decomposition all assume Organization is a real entity, not the current flat `Product.sport/league/team` strings. Nothing else in this plan can be built *correctly* before this exists — it can only be built *twice*, once now and once again after the migration.

**Safety infrastructure depends on nothing, and almost everything depends on it.** CI/CD, automated tests, and real observability don't require the Organization migration or any other business change to exist — and every other change in this plan is riskier without them already in place. This is why they're first, not a reward for finishing something else.

**Commerce correctness fixes (transactions, webhook verification, inventory reservation) are independent of the Organization migration** — they're fixes to code that already exists, and can run in parallel with it rather than waiting behind it.

**New UI work depends on Design System primitives existing first**, per the Design System's own migration plan — building new Organization/Team pages before Button, Card, and Modal exist just recreates the duplication problem that plan was written to end.

**AI Capability work depends on Queue infrastructure and, for most items, on real usage data existing** — which is itself a reason several AI items can't move earlier than they're scheduled below, independent of engineering effort.

**Future commerce categories depend on nothing new** — this is the one dependency that doesn't exist, because the Commerce Engine's Stage 9 already confirmed the architecture holds for them without modification. They're sequenced late because of focus and evidence, not because anything blocks them technically.

---

## Phase 1 — Foundation & Safety Net

**What it is.** The work that has no viable shortcut and that every later phase depends on. Nothing customer-visible ships that isn't already possible today — the point of this phase is making everything after it safe to build.

**Contains.** The Organization-first data model migration (Organization, Team, Athlete, and League-as-Organization, per the Information Architecture's extension of the Domain Model). The platform audit's critical correctness fixes: real database transactions around stock reservation and checkout, Maya webhook signature verification, the guest order ownership check, missing database indexes. CI/CD with automated tests gating deploys. Structured logging and real error tracking. Redis, standing up caching, rate limiting, and queue infrastructure together. Design System primitives — Button, Card, Modal, Badge, EmptyState — built and verified in isolation, per that plan's own Phase 1, so nothing customer-facing in later phases has to invent its own version of any of them.

**Why it's first.** Every one of these is either something everything else depends on, or something dangerous to leave broken while new, more complex features get built on top of it. Shipping a Drop mechanic on a database that's never used a transaction, or a new Organization experience on top of an unverified payment webhook, would mean building new trust promises on a foundation already known not to keep its old ones.

---

## Phase 2 — The Identity-First Experience

**What it is.** Where the platform starts looking and behaving like the platform the rest of this series describes, for real fans, not just internally.

**Contains.** The Information Architecture's full navigational rollout — League and Athlete as first-class Organizations, Team and Collection as conditional layers, identity-lineage breadcrumbs, a Discovery Hub that personalizes from Favorites. Trust signals surfaced where fans actually decide to buy — Official Verification badges, Guarantees stated plainly, Shipping Confidence shown before checkout, not after. The Design System's migration to customer-facing pages, sequenced exactly as that plan already specifies: admin surfaces first, then the highest-traffic customer pages last. AI Capability's Near Future layer — Sizing paired with honest Confidence scoring, identity-aware Search, Recommendations bounded by the IA's own cross-linking rule. The Commerce Engine's Drop mechanic, now safe to build for real because Phase 1 already fixed the transaction and reservation logic underneath it. Contextual commerce — a Story or broadcast moment linking directly to a Product without losing the context that brought the fan there.

**Why it's second.** Every item here assumes Organization is already real and the correctness fixes already hold. Building identity-first navigation on top of the old flat product model would mean building it once now, incorrectly, and once again after Phase 1 — the exact double-cost this plan exists to avoid.

---

## Phase 3 — Growth & Extension

**What it is.** Where the platform starts becoming more than a merchandise store, and where the whole rest of this series' vision starts becoming testable, not just designed.

**Contains.** Diaspora-specific logistics — the OFW gifting flow and the three shipping profiles the Commerce Engine already specifies, rather than treating international delivery as one generic case. The first new commerce category, Membership, chosen to go first because the Commerce Engine already identified it as the one category needing genuinely new infrastructure (recurring payment capture), making it the right test of whether the category-agnostic architecture actually holds under real pressure. AI Capability's Long Term layer — assistive Content tooling, tightly bounded Customer Support, forecasting maturity extended across the new category. Deliberate onboarding investment in the grassroots and barangay layer of the pyramid, the segment the Strategic Research identified as commercially invisible to any global competitor.

**Why it's third.** Every item here is either explicitly sequenced last elsewhere in this series (Membership, per the Commerce Engine; AI's Long Term items, per the AI Capability document) or depends on Phase 2's identity-first experience already being real and working — there's no credible diaspora gifting flow or grassroots onboarding push on top of navigation that doesn't yet know what an Organization is.

---

## MVP → Version 1 → Version 2 → Version 3

The three phases above describe engineering sequence. This describes what actually ships and when a real fan sees it — a narrower, more concrete ladder layered on top.

**MVP.** Phase 1's foundation, plus the Organization-first model proven on a single pilot Organization — one real Storefront, one real Team structure, running on the new model end to end — while every other Organization continues running on the current structure behind the scenes. This is a deliberate small-blast-radius test, not a partial rollout: the same discipline the Design System's migration plan already applied to UI components, applied here to the riskiest data migration in the whole plan.

**Version 1.** The Organization-first migration completed for every existing Organization and Product. Trust signals live everywhere. The Design System fully migrated across customer-facing pages. Basic identity-first navigation and a personalized Discovery Hub live for every fan. This is the point where the new foundation stops being a pilot and becomes what everyone actually uses.

**Version 2.** AI's Near Future layer live — Sizing, Search, Recommendations. The Drop mechanic live with real Operations capacity certification behind it. Contextual commerce live, connecting broadcast and Story moments directly to purchase. This is the point where the platform starts behaving the way the Strategic Research and Journey Maps actually described it should.

**Version 3.** Membership as the first new commerce category. Diaspora-specific shipping and gifting live. AI's Long Term layer beginning. This is the point where PusoStore stops being only a merchandise platform and starts becoming the broader infrastructure the Platform Strategy's long-term vision describes.

---

## Milestones

Concrete checkpoints, not calendar dates — each one is complete when its condition is true, not when a deadline arrives.

**M1 — Safety net is real.** CI/CD blocks a deploy on a failing test. An error in production surfaces in an error tracker within minutes, not by a fan reporting it. Both true before any other Phase 1 work merges.

**M2 — The pilot Organization is live.** One real Organization runs entirely on the new Organization-first model, in production, with real fans, real Orders, and real Fulfillment — proof the model works before it's applied everywhere.

**M3 — Every Organization has migrated, with zero data loss.** The full platform runs on the new model. The old flat `sport/league/team` fields are no longer read by anything.

**M4 — A fan can find a team by name they typed themselves.** Search returns the right Organization for an identity-bearing query, not just products that happen to mention it — the Information Architecture's founding complaint, closed.

**M5 — A Drop has sold out without an overselling incident.** The single clearest proof the Commerce Engine's Inventory rules and the Operations capacity-certification process actually hold under real, concentrated demand.

**M6 — The first Membership subscription renews successfully.** Proof the recurring-payment extension actually works, not just that it was designed to.

**M7 — An Organization outside the professional tier — a school, a barangay league — completes its first sale.** The clearest evidence the platform serves the whole pyramid the Platform Strategy commits to, not just its most visible layer.

---

## Success Metrics

Chosen because they measure whether this series' actual promises held, not generic platform health.

**Zero overselling incidents after the transaction fix ships.** A direct test of the Commerce Engine's Inventory rules and the specific failure mode this whole series keeps returning to.

**Search success rate for identity-bearing queries** — the share of team, league, and athlete name searches that land the fan on the right Organization, not a dead end. The Information Architecture's core thesis, measured directly.

**Time to detect a Fulfillment Trust issue** — how quickly a pattern of missed delivery promises becomes visible to the Trust capability's ongoing monitoring, rather than being discovered only when a fan complains publicly.

**Cart abandonment recovery rate**, specifically for recoveries that address the likely reason for hesitation rather than a generic reminder — the Journey Maps' own definition of what a good recovery looks like.

**Share of Organizations below the professional tier** — grassroots and collegiate Organizations as a proportion of the total. A platform that only grows at the top has quietly abandoned the Platform Strategy's own boundary against serving only the visible layer of the pyramid.

**OFW and international order volume as a share of total commerce** — the most direct test of whether the Strategic Research's diaspora thesis was right, not just plausible.

---

## Risk Assessment

**Phase 1 — the Organization migration corrupts or loses live production data.** The highest-severity risk in this entire plan, mitigated by the MVP's single-Organization pilot before any full migration, and by M1's safety net existing before the migration itself begins — a rollback path has to exist before the risky change does, not be improvised after something breaks.

**Phase 1 — rushing the correctness fixes introduces new bugs while fixing old ones.** Transactions and webhook verification are exactly the kind of change that's dangerous to make quickly. Mitigated by the same test coverage M1 already requires — these fixes ship behind tests proving the specific failure mode (overselling, forged payment status) is actually closed, not just that the code compiles.

**Phase 2 — the new navigation confuses fans who were comfortable with the old one.** A real risk any identity-first redesign carries. Mitigated by staged rollout and close attention to the Journey Maps' First Visit and Returning Fan failure points specifically, rather than treating a conversion dip as acceptable short-term noise.

**Phase 2 — AI Sizing or Recommendations ship before there's enough real data to be trustworthy.** The AI Capability document already warns against this directly. Mitigated by treating the Confidence-scoring requirement as a hard gate, not a target — a feature with no honest way to express uncertainty yet doesn't ship, on schedule or not.

**Phase 3 — chasing Membership or new categories dilutes focus before Version 2's core promises are actually proven.** Mitigated by gating Phase 3 on Phase 2's success metrics genuinely being met, not on the calendar — the same discipline ADR-003 already applied to keep the original MVP scoped to Merchandise alone.

**Cross-cutting — scope creep across the whole plan.** The single largest risk to the plan as a whole is treating every phase as a suggestion rather than a sequence, and starting Phase 2 or 3 work before Phase 1's dependencies are genuinely closed. Every other risk in this section gets worse if this one isn't taken seriously.

---

## Technical Debt Strategy

Not "fix everything first," which is unrealistic, and not "ignore it," which is unsafe. A policy, applied consistently:

**Debt that blocks safety gets fixed in Phase 1, non-negotiably, before new feature work.** Missing transactions, unverified webhooks, the guest order ownership gap — these aren't scheduled around other priorities, because every later phase's Trust promises depend on them already being closed.

**Debt that's pure cleanup with no functional risk gets fixed opportunistically, never as a dedicated sweep.** The platform audit's five abandoned AI-provider service files and unused dependencies get removed when a Phase 2 developer is already in that part of the codebase for the AI Capability work, not as a standalone cleanup sprint competing with real roadmap work for priority.

**Structural debt gets fixed as part of the work that already has to touch it.** The audit's fat-routes, no-service-layer finding gets addressed *during* the Organization migration, not before or after it — that migration already has to touch nearly every route handling Organization-scoped data, so extracting a real service layer at the same time costs far less than doing it as a second, separate pass later.

**New debt gets prevented by construction, not caught by review.** Every capability built from Phase 2 onward is organized around the Capability Model's seventeen boundaries from the start, per the Technical Architecture's modular-monolith decision — so this plan doesn't spend Phase 3 fixing the same category of fat-route debt Phase 1 just finished cleaning up.

---

## Why the sequence matters

Getting this order wrong doesn't just mean working inefficiently — it means paying for the same work twice, and it means breaking the specific promises this series spent nine documents making, at the exact moments those promises matter most.

Building Phase 2's identity-first navigation before Phase 1's Organization migration would mean building it against data that doesn't yet support it, then rebuilding it once the migration finally happens — the same feature, built twice, for no reason except impatience. Shipping a Drop mechanic before Phase 1's transaction fixes land would mean building the Commerce Engine's most demanding feature directly on top of the platform's single worst-documented failure mode, with a real fanbase watching. Shipping AI Sizing before enough data or an honest Confidence signal exists would mean breaking the Trust Model's own rule in the same release meant to demonstrate the platform takes it seriously.

The sequence in this document isn't a project-management convenience. It's the difference between building on the ten documents that came before it, and quietly ignoring them the first time a deadline makes skipping ahead look tempting.
