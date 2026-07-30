# PusoStore Engineering Handbook

**Version 1.0**

Every document before this one explained what to build and why. This one explains how to actually work on it — day to day, PR to PR — so that five years from now, someone who never read the other ten documents can still open this codebase and understand it, extend it safely, and not quietly undo a decision that was made for a reason they can't see.

That's the whole purpose of this handbook in one sentence: this is what the Product Principles' "Maintainability" actually looks like in practice, not just as a word in a ranked list.

This assumes the full series as context, but three documents matter most here: the **Capability Model** (this handbook's folder structure and PR standards are both direct applications of its seventeen boundaries), the **Technical Architecture** (which already named every technology decision), and the original **platform audit**, whose specific findings — god components, fat routes with no service layer, inconsistent naming, near-zero test coverage, a README that had already drifted from what the code actually did — this handbook exists to make structurally difficult to repeat, not just to fix once.

---

## Group A — How We Think

### Architecture Principles

The Technical Architecture already stated five principles for technology decisions. Restated for the code itself, they mean this in practice:

**Evolve the foundation, don't replace it** means no rewrites-in-passing — swapping a working pattern for a "better" one inside an unrelated PR is not a small improvement, it's an undiscussed architecture change.

**Every piece of infrastructure exists because a capability needs it** means before adding a dependency, a service, or a new abstraction, name which of the seventeen capabilities actually needs it. If the answer is "it might be useful later," it doesn't go in yet — that's Commerce Item's own restraint about Tickets and Experiences, applied at the code level.

**Fix correctness before chasing scale** means a PR that optimizes something before it's demonstrably correct gets sent back, every time, no matter how much faster it is.

**Capability boundaries are the security architecture** means code lives inside its owning capability's module, and a cross-capability call happens through that module's defined interface — never by reaching directly into another capability's internals because it's convenient this one time.

### Coding Philosophy

Readability over cleverness, composition over duplication, and — the rule the platform audit's god components violated most directly — a file does one job. `ProductDetail.jsx` at 800 lines wasn't one component doing one thing; it was five components that happened to share a file. The fix isn't a rule about line counts, it's a rule about responsibility: when a file starts handling more than one concern a reasonable person would describe separately, it gets split, at the moment that becomes true, not preemptively and not indefinitely deferred.

No abstraction before the second real use case. The Domain Model's own restraint — not inventing Ticket or Experience before Membership proved the pattern was needed — is the same judgment applied to a helper function, a shared hook, or a new component prop. Three similar lines are better than a speculative abstraction built for a future that might not arrive the way it's imagined.

---

## Group B — How We Organize

### Folder Structure

The backend is organized around the Capability Model's seventeen boundaries directly, not around technical layers the way `routes/`, `models/`, `middleware/` currently split things. Each capability — Commerce, Trust, Fulfillment, Identity, and the rest — owns a module containing everything it needs: its own data access, its own business logic, its own API surface. A capability's internals are private to that module; anything another capability needs from it goes through an explicit interface, the same discipline the Capability Model already required conceptually, now enforced by where the code physically lives.

The frontend mirrors the Information Architecture's own hierarchy: Organization, Team, Athlete, and Collection as the primary structural units, with the Design System's primitives — Button, Card, Modal, and the rest — living in their own shared layer that every feature consumes and nothing duplicates. A new page reaching for a raw utility class instead of an existing primitive is the exact failure the Design System's migration plan was written to end; the folder structure exists partly to make that harder to do by accident.

### Naming Conventions

**The code's vocabulary matches the Domain Model's vocabulary exactly.** If the Domain Model calls something a Commerce Item, the code never quietly calls it a "product" in one file and an "item" in another — that drift is exactly how the platform audit found a README claiming Replicate power the try-on feature that had actually been running on WaveSpeed for months. A name that diverges from this series' established vocabulary isn't a style nitpick; it's the first crack in the same kind of drift.

Beyond that: components in PascalCase, hooks prefixed `use` and named for what they return, capability modules named exactly as the Capability Model names them. Consistency here isn't aesthetic — it's what lets someone search the codebase for "Fulfillment" and actually find everything Fulfillment owns.

---

## Group C — How We Build

### API Philosophy

Endpoints are organized by capability, not by database table — a direct consequence of the folder structure above. The platform audit found the current API's response-shape consistency to be a genuine strength; that convention holds and extends to every new endpoint, not just the ones that already follow it.

Two rules exist specifically because the audit found their absence causing real bugs. Route registration order is disciplined — a specific path always registers before a parameterized one that could shadow it, which is the exact fix for the `/admin/stats` route the audit found silently unreachable behind `/admin/:id`. And every route delegates to the centralized error-handling middleware rather than hand-rolling its own catch-and-respond block — the audit found this middleware already existed and simply wasn't being used, which is the cheapest kind of bug to have: the fix was already written, just not called.

### Testing Philosophy

Not "100% coverage" — that's its own kind of gimmick, precision without judgment. Coverage is risk-proportional: checkout, payment authorization, inventory reservation, and webhook verification carry the highest testing bar on the platform, because the Commerce Engine and Trust Model both describe exactly what happens when those specific paths fail. Presentational code carries a lighter one. This is the same principle the platform audit already recommended when it found near-zero coverage — start with the paths that touch money and trust, not the paths that are easiest to test.

Every fix to a Trust-critical or Commerce-critical bug ships with a test that fails on the old code and passes on the new — proof the specific failure mode is closed, not just that the symptom is gone.

---

## Group D — How We Communicate

### Documentation Standards

This series of ten documents is the source of truth for why the platform is shaped the way it is, and it's kept that way the same way the Decision Log already treats itself: when a real decision changes, a new entry gets added, not a silent edit to history. Code comments exist only for the non-obvious why — a workaround, a hidden constraint, a reason a naive reader would get wrong — never for what the code already says plainly by being well-named. A README claim about the codebase is verified against the actual code before it's written, not assumed true because it used to be.

### Pull Request Standards

A PR names the capability it touches, the same discipline the Capability Model already asks of every feature decision. A PR that needs two capabilities to explain what it does is a signal the change is either too large or the capability boundary needs revisiting — not a reason to write a longer description and proceed anyway.

Review rigor scales with what's at stake, mirroring Testing Philosophy: a change touching Payments, Trust, or Fulfillment gets closer review than a change to presentational styling, and CI blocking a failing test is not a suggestion to override under deadline pressure — it's the specific mechanism the Execution Plan's first milestone exists to guarantee.

---

## Group E — How We Change

### Migration Strategy

Every migration on this platform — not just the Organization-first one the Execution Plan describes, but every one that comes after it — follows the same shape that plan and the Design System's migration plan both already used independently: prove it on the smallest reasonable blast radius before rolling out everywhere, keep the old pattern and the new one coexisting during the transition rather than a single cutover moment, and have a rollback path that exists *before* the risky change ships, not one improvised after something breaks. This isn't a rule invented for this handbook — it's the pattern this series already used twice, generalized into a standing practice instead of something reinvented each time a migration comes up.

### Refactoring Philosophy

A refactor happens inside the PR that already needs the refactored code to be different — never as a separate "cleanup" PR competing with real roadmap work for review time and priority, and never touching code nobody is actively working in just because it could be better. This is the Execution Plan's Technical Debt Strategy, generalized past the specific debt that plan named: structural debt gets paid down by the work that already has to touch it, opportunistically, indefinitely, rather than through a dedicated sweep that has to win a prioritization argument against shipping something new.

---

## Group F — How We Protect

### Performance Standards

Every new query against a field fans will filter or search by is checked for an index before merge — the platform audit's missing-index finding doesn't get to recur once it's been named. Product imagery is always served through a real transformation, never the raw upload — the same finding, for a different resource. And Inventory is never read from cache, under any circumstance, no matter how tempting the performance win looks — the Commerce Engine's rule against a "hopeful" stock count isn't a suggestion with an escape hatch for a good enough reason.

### Security Standards

No endpoint returns another party's data without an explicit ownership or authorization check — the direct, permanent fix for the guest-order-lookup gap the platform audit found, restated as a rule that applies to every future endpoint, not just the one that was patched. Every external webhook — Maya today, any payment or fulfillment partner integration added later — verifies its sender's signature before trusting a single field in its payload; the Payments section of the Technical Architecture already made this non-negotiable for the one integration that exists today, and this handbook makes it the standing rule for every one that doesn't yet. File uploads are validated by their actual content, not by a client-supplied label that can be typed by anyone sending the request.

---

## What this handbook is actually protecting

Every rule above traces back to something that already went wrong once, or something this series already decided mattered enough to protect. That's deliberate. A handbook full of best practices nobody can point to a reason for gets ignored the first time it's inconvenient. A handbook where every rule has a name — a specific bug, a specific finding, a specific document that already explained why — is harder to quietly skip, because skipping it means consciously deciding the thing that already happened once is fine to let happen again.
