# PusoStore Trust Model

**Version 1.0**

The Capability Model named Trust as one of seventeen platform capabilities. This document is what it means to take that seriously: Trust is not a feature — not a badge that gets added to a Product page, not a page in a settings menu, not a checkbox on a launch checklist. It's infrastructure every other capability depends on, the same way Identity is. A platform can ship a hundred features and still not be trusted. It cannot be trusted by accident, and it cannot be trusted by adding one more feature called "Trust."

This document defines the ten mechanisms that actually create trust, in four groups that follow the order a fan's own doubt actually moves through: *is this real*, *will it work for me*, *will the transaction actually complete*, and *what happens if something goes wrong*. It closes with how trust should shape every product decision going forward, not just the ones explicitly about Trust.

It builds on the **Capability Model** (Trust, Confidence, Payments, Fulfillment, Customer, Notifications), the **Domain Model** (Trust & Verification, Review, Order, Shipment), and the **Journey Maps** (nearly every failure point across all thirteen journeys traces back to one of these ten mechanisms failing).

---

## Group 1 — Is this real?

### Authenticity

**What it protects against.** The single most acute fear in Philippine sports commerce specifically — that a "genuine" jersey is actually a counterfeit — sharpened by how common counterfeit sports merchandise already is in this market.

**How trust is created.** Authenticity isn't one mechanism; it's the sum of every other one in this document. Official Verification proves who's selling. Partner Verification protects what's behind a co-branded item. Guarantees back the claim explicitly. Purchase-verified Reviews let a fan hear it confirmed by someone who already took the risk. Authenticity is the claim; everything else here is the evidence for it.

**What erodes it.** Any gap between what's claimed and what's delivered — a product photo that doesn't match what arrives, a claimed material or license that turns out wrong, or simply no visible proof at the moment of decision.

**Where it lives.** The outcome every other mechanism in this document, and the Trust capability as a whole, exists to produce.

---

### Official Verification

**What it protects against.** A fan's inability to tell a real Organization from an impersonator, or a legitimate Storefront from an opportunistic seller riding on a team's name.

**How trust is created.** A visible, platform-granted status — granted only by PusoStore, never purchasable — attached to the Organization itself, checkable at the exact moment a fan is deciding whether to trust a Storefront or Product.

**What erodes it.** Granting it too easily, which dilutes what it means. Applying it inconsistently across large and small Organizations, which undermines the platform's own claim to serve the whole pyramid, not just its top. Leaving it in place after an Organization's actual behavior no longer merits it.

**Where it lives.** The Trust capability's verification workflow, attached to the Organization domain concept, surfaced wherever an Organization's Storefront or Products are shown.

---

### Partner Verification

**What it protects against.** A co-branded, licensed, or partner-sourced item quietly carrying less legitimacy than a fan assumes, simply because it came from an Organization they already trust.

**How trust is created.** Not a public badge the way Official Verification is — PusoStore directly vets the commercial terms and legitimacy of a Partner relationship before it's allowed to touch any Organization's Commerce Items, so the trust a fan extends to the Organization isn't quietly borrowed by an unvetted third party.

**What erodes it.** Treating Partner approval as a lighter-touch process than Organization verification, on the assumption that the Organization's own trust status covers for it. It doesn't — the fan has no way to know a Partner was involved at all.

**Where it lives.** The Partner capability's agreement lifecycle — invisible to the fan by design, but load-bearing underneath Authenticity for every co-branded or partner-sourced item.

---

## Group 2 — Will this work for me?

### Sizing Confidence

**What it protects against.** The single most common reason a genuinely happy purchase turns into a disappointed one — a jersey that doesn't fit, discovered only after it's already been worn once for the moment it was bought for.

**How trust is created.** An honest, AI-assisted size recommendation that communicates how confident it actually is, not just what size to pick — so a fan can weigh a strong recommendation differently from a shaky one, instead of treating every suggestion as equally certain.

**What erodes it.** A confident-sounding recommendation that turns out wrong, which damages trust in every future recommendation this fan sees, not just this one purchase.

**Where it lives.** AI produces the recommendation. Confidence governs how certainly it's presented. Product Variant is what's actually being recommended.

---

### AI Confidence

**What it protects against.** The platform ever sounding more certain than it actually is — the trust principle applied inward, to Puso's own outputs, not just outward to who's selling.

**How trust is created.** A hard internal standard that no AI-assisted output — a size recommendation, a try-on result, a demand forecast — is presented without an honest signal of how much to rely on it, and a willingness to say "not sure" rather than guess confidently.

**What erodes it.** Treating confidence scoring as a cosmetic detail rather than a real constraint — for instance, shipping a size recommendation before the honesty layer around it, on the logic that the recommendation is "close enough" without it.

**Where it lives.** The Confidence capability, sitting between AI's raw outputs and every customer-facing moment that uses one.

---

## Group 3 — Will the transaction actually complete?

### Payment Trust

**What it protects against.** The basic, foundational fear of handing over payment details to an online store at all — a fear that predates and outlasts any specific concern about the product itself.

**How trust is created.** Reliable, transparent payment processing with no surprises: the price shown is the price charged, a failed payment fails safely and clearly, and a refund, when owed, actually happens without a fight.

**What erodes it.** Any friction or ambiguity at the exact moment money changes hands — an unclear charge, a failed transaction with no clear explanation, a refund that visibly takes longer than the original charge did.

**Where it lives.** The Payments capability — category-agnostic, identical in behavior regardless of what's being bought.

---

### Shipping Confidence

**What it protects against.** The forward-looking uncertainty a fan carries into checkout about whether an item will actually arrive, and — often more specifically — whether it'll arrive in time for the reason it was bought.

**How trust is created.** Honest, specific delivery estimates shown before checkout, not discovered afterward, paired with tracking that actually reflects reality rather than a generic status that hasn't moved in days.

**What erodes it.** A delivery estimate that turns out to be aspirational rather than real. Silence during a delay instead of proactive communication the moment a risk becomes known.

**Where it lives.** The Fulfillment capability's forward-facing promise, drawing on Operations' capacity data to know whether that promise is realistic before it's ever made.

---

### Fulfillment Trust

**What it protects against.** The difference between one order arriving on time and an Organization being genuinely reliable. Shipping Confidence is a promise made once; Fulfillment Trust is whether that promise has actually been kept, order after order, long enough to be believed without being re-proven every time.

**How trust is created.** A track record, accumulated over time and made visible where it matters — an Organization that reliably delivers earns a standing signal of that reliability, distinct from and in addition to its base Official Verification.

**What erodes it.** A pattern of missed promises that never surfaces anywhere a future fan could see it before their own purchase — the same failure repeating at the individual-order level often enough that it should have become visible, and wasn't.

**Where it lives.** The Trust capability's ongoing monitoring function, fed by Analytics' fulfillment-reliability data — distinct from the one-time verification decision made at onboarding.

---

## Group 4 — What happens if something goes wrong?

### Customer Support

**What it protects against.** The moment a fan's problem has no clear human path to resolution — which, left unaddressed, turns a single bad order into a fan who quietly stops trusting the whole platform rather than ever coming back to complain.

**How trust is created.** A visible, reachable path to real resolution, and communication that keeps happening throughout a problem rather than going quiet the moment it gets hard. Silence, not the original problem itself, is usually what actually breaks the relationship.

**What erodes it.** A support path that's technically available but practically hard to find, or slow enough to reach that a fan gives up before using it.

**Where it lives.** Notifications, for keeping a fan informed throughout, coordinated with whichever capability the underlying problem actually belongs to — Fulfillment, Payments, or Trust itself.

---

### Guarantees

**What it protects against.** A fan's need for a reason to trust the platform *before* they've had any experience with it at all. Every other mechanism here is either earned over time or proven at the moment of use — a Guarantee is trust extended upfront, unilaterally, before a fan has any evidence of their own.

**How trust is created.** An explicit, plainly-stated promise — authenticity, a size or fit backstop, a fulfillment commitment — that a fan can point to and hold the platform accountable against, clear enough that a first-time visitor can read it and feel safer proceeding.

**What erodes it.** A Guarantee that turns out to have exceptions or fine print a fan discovers only when they try to use it — the fastest possible way to turn a trust-building mechanism into evidence the platform can't be trusted at all.

**Where it lives.** A commitment the Trust capability makes and is accountable for keeping, referenced by name at exactly the moments — First Visit, Limited Drop, Returns — where a fan has the least evidence of their own to rely on.

---

## How trust should influence every product decision

Trust is not a line item. It's a lens every other decision gets run through, whether or not the decision has anything to do with Trust on its face.

**Trust is a precondition, not a feature to schedule.** No product decision should treat trust-building as a nice-to-have that gets deprioritized under time pressure. A Drop, a new Collection, a checkout change — each should be evaluated against whether it strengthens or weakens one of the ten mechanisms above, the same way it's evaluated against cost or timeline. "We'll add the trust signal later" is the same mistake as building Confidence after the size recommendation was already shipped.

**When trust and speed conflict, trust wins.** Don't launch a Drop before Operations has real capacity confidence just to hit a date. Don't ship an AI-assisted recommendation before its Confidence scoring is honest just to launch faster. A feature that arrives a week later with its trust mechanism intact is worth more than one that arrives on time without it.

**When trust and short-term revenue conflict, trust wins.** A Guarantee with fine print that protects margin at the cost of a fan discovering an exception exactly when they need it most isn't a clever guarantee — it's a liability wearing a trust mechanism's clothes. This is the same principle the Platform Strategy already commits to: trust is never optional or purchasable, and that includes not being quietly negotiable against a quarter's numbers.

**Every product decision should be able to name which mechanism it strengthens.** Not as a bureaucratic exercise — as a real test. A decision that can't point to Authenticity, Verification, Sizing Confidence, Fulfillment Trust, or one of the other seven and explain how it helps is worth a second look for whether it's actually necessary, or just convenient to build.

**Silence is never neutral.** The Journey Maps found this independently, across almost every journey mapped: nearly every failure point traces back to trust being asked to do more work than it's earned, or urgency met with silence. Communication — even bad news, delivered honestly and early — is itself one of the strongest trust mechanisms available, and a product decision that goes quiet during a problem is actively eroding trust, not merely failing to build it.

**Trust mechanisms belong exactly where doubt naturally arises, not centralized in one place a fan has to go looking for.** A Verification signal matters most on a first-time Organization visit. Shipping Confidence matters most before checkout, not after. A Guarantee matters most to a fan with no track record of their own — a first-time visitor, a fan mid-Drop, a fan initiating a return. Design each mechanism into the specific moment it's needed, not into a single "Trust & Safety" page nobody visits until something has already gone wrong.
