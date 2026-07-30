# PusoStore AI Capability

**Version 1.0**

The Capability Model already defined AI as a horizontal enabler — infrastructure other capabilities draw on, with no end-to-end business outcome of its own. This document is what that means in practice, sequenced honestly, with the gimmicks left out on purpose.

"Avoid gimmicks" is doing real work as an instruction, and it means two things at once. First: every AI application here has to trace back to a real need already identified elsewhere in this series — a fan psychology finding, a Journey Map failure point, a Trust Model mechanism, a Commerce Engine rule — never a capability built because the technology exists and looks impressive in a demo. Second, and less comfortable: several of the eleven things on the requested list are not actually AI problems at launch. Calling a basic validation check or a simple fraud rule "AI-powered" because it sounds more advanced is exactly the gimmick this document is asked to avoid. Where that's true below, it says so.

Everything here is sequenced into three horizons — MVP, Near Future, Long Term — based on one honest question: does this capability have enough real data and real operational experience behind it yet to be trustworthy, not just possible?

---

## Confidence: the discipline that governs everything else

Confidence isn't a horizon. It doesn't ship in MVP, Near Future, or Long Term as its own deliverable — it ships *with* every other AI capability on this list, from the first one, with no exceptions. The Trust Model already establishes why: nothing the platform tells a fan should sound more certain than it actually is, and that standard doesn't get to wait for a later release.

In practice, this means no AI capability below reaches a fan until it can honestly say how much to trust its own output — and a capability that can't yet do that honestly isn't ready to ship, regardless of which horizon it otherwise belongs to. This is the single hardest discipline in this document to maintain under pressure, because it's the one most likely to be quietly skipped when a deadline is close and the underlying feature "mostly works."

---

## MVP: What Ships Now

### Virtual Try-On

The one genuinely AI-native capability that has to exist now, not later — already part of the platform's identity, and directly answering the Strategic Research's position that AI Virtual Try-On is not a feature but part of the shopping experience itself. This is also the reason Confidence has to exist from day one: a try-on result is exactly the kind of AI output a fan could over-trust if its reliability isn't communicated honestly alongside it.

### Catalog Management — automation, not yet AI

Ensuring every Commerce Item has what the Commerce Engine requires before it can go live (a price and stock figure on every Variant, complete product information) is a real, valuable capability at launch — and at this stage, it's honestly rule-based validation, not AI. Calling straightforward completeness checks "AI-powered" would be the exact gimmick this document is meant to avoid. The genuinely AI-assisted version of this — automated tagging, description assistance, duplicate detection across a large catalog — belongs later, once there's enough catalog volume to justify it.

### Fraud Detection — rules, not yet AI

The same honesty applies here. At launch, protecting Payment Trust means straightforward rule-based screening — velocity limits, mismatched billing and shipping signals — not a learned model, because there isn't yet enough transaction history on this platform for a model to learn from responsibly. Real AI-assisted fraud pattern detection is a Near Future capability, not an MVP one, and pretending otherwise would risk a model making decisions on data too thin to trust.

---

## Near Future: What Needs Real Data First

### Sizing

An AI-assisted size recommendation, always paired with honest Confidence scoring, addressing the single most common reason a happy purchase turns disappointing, per the Trust Model. This can't responsibly launch at MVP because it needs a real base of past orders, sizing feedback, and returns data to recommend from — recommending confidently off no data at all would itself be a Confidence violation.

### Search

The Information Architecture already establishes that search fails a fan the moment it only matches product names instead of team and league names. The immediate MVP fix for that is not AI at all — it's making sure Organization, Team, and Athlete data is properly indexed as first-class search content. The AI-assisted layer on top of that — understanding a fuzzy or colloquial query, matching "Blue Eagles" to Ateneo without an exact string match — is the Near Future capability, once there's a real corpus of Organizations and real query data to learn the patterns from.

### Recommendations

Personalized surfacing across Discovery, bounded by the Information Architecture's own rule that a recommendation reinforces identity — more from the fan's own Organization or Collection — rather than a generic, identity-blind "customers also bought" list. This needs a real base of Favorites and purchase history to personalize from, which an early platform with few fans simply doesn't have yet; before that, Discovery's platform-wide trending and editorial curation, described in the Information Architecture, does this job better than an undertrained recommender could.

### Merchandising

AI-assisted suggestions to an Organization about what to feature — which Collection, which Drop timing — informed by real sales and engagement data once enough of it exists. This stays a suggestion an Organization can act on or ignore, never an autonomous decision, for reasons covered in the boundaries section below.

### Demand Forecasting (assisted stage)

The Commerce Engine requires Operations to certify real capacity before a Drop can be scheduled. At this stage, that certification is a human judgment, informed by AI-assisted forecasting recommendations once there's enough order history to forecast from responsibly — the forecasting model assists the human decision here; it doesn't yet make it.

---

## Long Term: What Needs Real Operational Experience First

### Content — assistive only, permanently bounded

AI-assisted drafting scaffolding, translation, and tagging support for Organizations telling their own Story — never authorship of the story itself. This stays long-term and deliberately limited in scope, not because the technology isn't ready sooner, but because the Platform Strategy is explicit that a product without a real story and a real institution behind it isn't something this platform sells — and a story an AI wrote wholesale on an Organization's behalf, even a technically accurate one, isn't a real story in the sense that commitment means.

### Customer Support — bounded to low-stakes queries, and only after real experience

AI-assisted handling of simple, low-stakes questions — an order status lookup, a shipping estimate — arrives here last, and deliberately after the platform has enough real operational history to know precisely which queries are genuinely safe to automate and which aren't. Getting that boundary wrong is a Trust Model violation waiting to happen: the Trust Model already identifies silence, not the original problem, as what actually breaks a support relationship, and a fan trapped in an unhelpful bot loop during something like a Returns dispute is a worse outcome than no AI support at all. This capability doesn't get built until the boundary in the next section can be drawn with confidence, not guessed at.

### Demand Forecasting and Merchandising at full maturity

Fully realized versions of both Near Future capabilities, extended across future commerce categories as they launch — forecasting Ticket seat demand or Membership renewal patterns the same way Merchandise demand is forecast today, and merchandising suggestions informed by patterns across an Organization's entire commerce footprint, not just one category. This depends on categories beyond Merchandise actually existing, which the Commerce Engine already treats as a later stage in its own right.

---

## Where AI should never replace human judgment

Some of these are not close calls. They're listed here because "avoid gimmicks" also means being explicit about the boundary, not just describing what AI is allowed to do.

**Trust & Verification decisions.** Whether an Organization or Partner is legitimate — granted, monitored, or revoked — is a human judgment, always. The Trust Model is explicit that PusoStore alone grants and revokes this status specifically so it can never be purchased or gamed; an AI system making or auto-approving that call would reopen exactly the vulnerability that rule exists to close. AI can flag anomalies worth a human's attention. It doesn't get the final decision.

**The authored voice of a Story.** AI can assist with drafting, translation, and tagging, but the actual narrative voice an Organization tells its story in belongs to that Organization and its people, not to a model — because the entire premise of Content as a capability is that a real institution's own story is what makes commerce here different from a generic marketplace. An AI-generated story, however fluent, isn't a substitute for that.

**Support during a Trust-critical moment.** A fan mid-Returns dispute, or raising an authenticity concern, must always have an immediate, easy path to a human — never routed through automation as the default, even a well-built one. This is the single highest-stakes moment identified anywhere in the Trust Model, and it's exactly the wrong place to let an AI system's confidence in its own helpfulness substitute for a person actually listening.

**Pricing exceptions and margin-affecting decisions.** The Commerce Engine's rule that Promotion stacking requires an explicit, deliberate Organization choice exists specifically to prevent uncontrolled discounting — an AI system should never be the one making or auto-approving that exception, because it's a real financial commitment made on an Organization's behalf, not a recommendation to weigh.

**Drop capacity certification.** AI-assisted forecasting can inform the decision, but the actual sign-off that a Drop is safe to go live belongs to a person accountable for it, at least until the platform has enough of a track record to trust the forecast the way it trusts a person today. This rule exists because the industry's clearest cautionary tale — documented in the Strategic Research — was fundamentally a case of an optimistic assumption never getting checked by someone responsible before a promise went out publicly.

**Representing a real person's identity.** An Athlete's storefront, voice, or likeness should never be AI-generated or extended without that person's own authorization, for the same reason an unauthorized "athlete store" would be a direct violation of Authenticity in the Trust Model — a real person's identity isn't raw material for a model to generate content about on the platform's behalf.

---

## The pattern across all of it

Every boundary above shares the same shape: AI is trusted to inform a decision, and never trusted to be the last word on one where a real institution's legitimacy, a real person's voice, or a fan's trust at its most fragile moment is actually at stake. That's not a limitation on what the technology can do — it's a deliberate choice about which decisions this platform is willing to let a model make unsupervised, made now, before the pressure to ship something faster makes that boundary easier to quietly erode.
