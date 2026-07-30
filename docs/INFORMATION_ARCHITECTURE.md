# PusoStore Information Architecture

**Version 1.0**

Every decision in this document follows from one inversion. A conventional ecommerce site organizes itself around the question "what are you looking for?" — category, then subcategory, then product, an architecture built for a shopper who arrives with a need and no loyalty. PusoStore is built around a different question: "who do you support?" A fan arrives with the loyalty already formed; the architecture's job is to get out of the way of it, not to make the fan restate it as a category filter.

This document assumes the **Domain Model** (Organization, Team, Athlete, Collection, Commerce Item, Story, Media, Campaign) and the **Capability Model** (Discovery, Search, Content, Media as bounded capabilities) as given. It describes how those concepts are arranged into a structure a fan can navigate, not how any of it looks.

One clarification this document requires, extending the Domain Model without contradicting it: a **League** or federation (UAAP, PBA, PVL) is itself an Organization — not a special category above Organization — related to its member schools and clubs through *participation*, a second kind of relationship alongside the *ownership* Organization already has over Team. A school is not owned by the UAAP the way a basketball team is owned by its school's athletics department; it participates in it. This matters because it means a fan can follow a league directly, the same way they follow a specific team, and both are legitimate, permanent identities.

---

## IA Principles

Every decision below traces back to one of these five.

**1. Identity before inventory.** The primary navigational axis is who a fan supports, not what category of good they want. Sport, gender, and product category exist to help a fan *find* an identity to follow — they never replace identity as the main way the site is organized.

**2. Depth mirrors commitment.** A fan is never forced deeper into the hierarchy than their current relationship to the platform justifies. An undecided fan stays in Discovery. A fan who already knows their team lands directly on that Organization's space, skipping every step that would otherwise sit between Discovery and that destination.

**3. Every destination remembers its lineage.** No Product, Collection, or Story should be reachable without a permanent, visible path back to the Organization or Athlete it belongs to. Breadcrumbs and cross-links exist to enforce this — not as a navigational courtesy, but because a fan should never be able to lose track of *whose* thing they're looking at.

**4. Facets, not floors.** Sport, league, gender, and category are filters that help a fan locate an Organization — never permanent structural floors every Organization must be nested beneath. This is the same reasoning the Domain Model already applied to Organization and Team: real institutions don't fit a rigid tree, so the architecture doesn't force one.

**5. Context travels with the click.** Arriving at a Product from a Story, a Campaign, or a live broadcast moment carries that context forward. A fan who clicked through from "the shirt Kai Sotto just wore" should still know that's why they're looking at it three clicks later — not land on a product page stripped of the moment that brought them there.

---

## The shape of the site

The core spine, only as deep as a given Organization actually needs it to be:

```
Discovery Hub (home)
└── Organization                      (e.g. Gilas Pilipinas, Ateneo Blue Eagles, a barangay league)
    ├── Team                          (only where an Organization has more than one)
    │   ├── Collection
    │   │   └── Product
    │   └── Product                   (Collection is optional; a Team can list Products directly)
    ├── Athlete                       (where affiliated — cross-linked, not owned)
    ├── Story
    └── Campaign
```

Athletes and Leagues sit alongside Organization as the same kind of node — every one of them is an Organization, reachable the same way, held to the same Trust standard, capable of the same depth beneath it. Sport, gender, and category never appear as levels in this tree. They appear only as filters inside Discovery and Search, described below.

---

## Navigation

Navigation's job is to answer "where does a fan who already knows what they want go, in as few decisions as possible" — which is a different job from "how do we expose everything the catalog contains." A fan who supports one team does not want a tour of the taxonomy; they want to be one tap from their team's space, every time, from anywhere on the site.

This is why navigation here is built around *shortcuts to identity* rather than a menu of categories. The most important navigational element on the entire platform is not a menu — it's the fact that a fan's Favorited Organizations are always one tap away, everywhere, because Favorite (from the Domain Model) is what actually represents who this fan is.

---

## Global navigation

What belongs in persistent, sitewide navigation is deliberately short, and every item earns its place by serving either an undecided fan (Discovery, Search) or a committed one (a direct shortcut to their followed Organizations) — never a taxonomy browser.

Persistent navigation carries: a route back to Discovery (for a fan who wants to explore rather than go straight to a team), Search (for a fan who knows exactly what they want), a personalized shortcut surfacing the fan's own Favorited Organizations directly (for a fan who wants to go straight home to their team), and the fan's own account and cart. What's deliberately *absent* is a sport-or-category mega-menu — the kind of exhaustive "Basketball / Volleyball / Football / Men / Women / Sale" listing a conventional ecommerce nav would carry. That structure asks a fan to describe themselves in category terms before they're allowed to reach the thing they already know they want, which is precisely the ecommerce-brain default this document exists to reject.

---

## Mobile navigation

Mobile carries the same logic under real space constraints, which means it has to be more disciplined about priority, not less faithful to the principle. Given that most of this platform's commerce happens on a phone, mobile navigation is where "identity before inventory" is tested hardest.

The two elements that matter most on mobile are Search (fast, explicit intent) and the personalized Favorites shortcut (fast, no intent required at all — the platform already knows who this fan is). A "browse everything" entry point is deliberately not given equal visual priority to either of these, because it's the one navigational element that only serves an ecommerce-brain use case: a fan with no loyalty yet, comparing categories. That fan still needs a path — Discovery still exists on mobile — but it doesn't compete for the same priority as getting a committed fan to their team in one motion.

---

## Search

Search fails a fan the moment it only matches product names, because the thing a fan is most likely to type is a team or league name, not a product's title — "Gilas," "UAAP," "Pacquiao" — and a search architecture that only indexes Merchandise names will return nothing for exactly the queries fandom actually produces.

Search results are therefore organized around the same identity-first logic as everything else: an Organization or Athlete that matches the query is returned as a first-class result in its own right, not filtered down to only the products that happen to mention it in their title. A fan searching a team name should be able to land directly on that team's Organization space from the results — the same destination Navigation and Discovery would take them to — rather than being shown a product grid with no path to the identity behind it.

---

## Organizations

An Organization's own information space is internally organized by the same principle that governs the whole site: identity first, commerce second. The order in which an Organization's space presents itself is deliberate — its story and current moment (an active Campaign, if one exists) lead, followed by its Teams (if more than one), its Collections, and only then a full, unfiltered catalog of everything it currently sells.

This ordering matters because it's the same "identity before inventory" principle applied at a smaller scale: even a fan who has already arrived at exactly the right Organization shouldn't be handed a flat product grid first. They should be handed the thing that made them a fan in the first place, with commerce positioned as the natural next step rather than the entry point.

---

## Teams

Team is a conditional layer, not a mandatory one. It appears in an Organization's structure only when that Organization genuinely fields more than one Team — a university athletics department needs it, a single national federation whose entire public identity is one squad usually doesn't. Where a Team layer isn't needed, it's skipped entirely rather than kept as an empty formality, in direct service of "depth mirrors commitment": nobody should have to click through a Team page that exists only to satisfy a template.

Where a Team layer does exist, it inherits everything about its parent Organization's identity (trust, presentation) while carrying enough of its own (colors, roster, its own Collections) that a fan of specifically the volleyball program, not the whole athletics department, has a real destination that's theirs.

---

## Athletes

An Athlete is structurally an Organization — reachable the same way, held to the same standard, capable of the same depth — but it needs its own discovery path precisely because Philippine sports fandom rallies around individuals with an intensity that regularly exceeds attachment to the team or league they compete under. Burying an athlete's presence as a sub-page of whichever club they currently play for would misrepresent how that fandom actually works, especially for athletes competing individually (boxing, athletics, gymnastics) rather than as part of a club at all.

Athletes are cross-linked bidirectionally with every Organization or Team they're affiliated with, past and present — a fan should be able to move from an athlete to any team they've represented, and from any team's page to every athlete who represents or has represented it. This relationship is participation, not ownership, the same distinction drawn between a school and its league: an athlete's move to a new club doesn't erase the identity built at the last one.

---

## Collections

A Collection is where an Organization or Team gives its catalog shape and meaning — a kit line, a heritage capsule, a season's identity — rather than leaving a fan to face an undifferentiated grid. Collections are surfaced prominently within their owning Organization or Team's space, generally scoped to a Season or built around a Campaign, and they exist specifically so that "browse everything this team sells" is never the only way to explore what's available.

Where a Product belongs to more than one Collection (a heritage piece that's also part of a current capsule), it's presented in whichever context brought the fan there, with the other equally valid — this is the same "context travels with the click" principle applied to curation: there's no single canonical Collection a Product is trapped inside.

---

## Products

A Product is the deepest, most specific node in the architecture, and it stays that way deliberately — a fan should generally arrive here already knowing whose it is, not discover the Organization behind it as an afterthought on the product page itself.

Every Product page carries an unbroken, visible lineage back to its Organization (and Team and Collection, where applicable) via breadcrumb, and its cross-links reinforce identity rather than category: what a fan is offered alongside a Product is more of that Organization or that Collection, not a generic "customers also bought" list assembled purely from purchase-pattern similarity across unrelated teams. A jersey's neighbors on the page are its own team's other gear, not a stranger's.

---

## Stories

Story doesn't get a single, isolated destination the way a conventional site might bury editorial content behind a "Blog" link in the footer — it needs two forms of presence at once, because it serves two different moments. Contextually, a Story is woven directly into the Organization, Team, Campaign, or Collection it's about, so a fan encountering it there experiences it as part of that identity, not as separate content that happens to reference it. Independently, Stories are also discoverable on their own, surfaced through Discovery for a fan who wants to read or watch before they're ready to buy anything at all.

Both forms matter because they answer different questions. Contextual placement answers "why does this team's current collection matter." A standalone, discoverable Story answers "tell me something about a team I don't support yet" — which is itself a legitimate way for a new fan to be introduced to an Organization, arguably a better one than a product grid ever could be.

---

## Media

Media is deliberately not a navigational destination. There is no "Media" or "Gallery" section of the site a fan visits directly, because a raw image or video clip has no meaning on its own — it only means something in service of the Organization, Story, Product, or Campaign it's attached to, exactly as the Capability Model defines it. Giving Media its own destination would invite a fan to browse assets divorced from the identity those assets exist to express, which is the opposite of what this architecture is for.

Media is encountered everywhere — Organization identity imagery, Product photography, Story illustration, Campaign promotion — but it is never itself the place a fan navigates *to*.

---

## Campaigns

A Campaign needs prominent, time-sensitive placement while it's live and a much quieter one once it isn't, because its entire value is tied to a real-world moment — a Season milestone, a call-up, a Finals run — and treating it as permanent content past that moment would dilute exactly the urgency that made it worth building in the first place.

While live, a Campaign earns priority placement inside its owning Organization's space and, where it's platform-significant, inside Discovery itself. Once concluded, it steps back — its commercial mechanics (a Drop, a Promotion) end, but any Story content built for it doesn't disappear; it folds into the Organization's ongoing narrative as heritage content, available to a fan exploring that Organization's history rather than pushed at every visitor the way it was during its live window.

---

## Discovery

The Discovery Hub is the one surface in this architecture explicitly built for a fan who hasn't decided yet, or who follows enough Organizations that no single one of them should be their default landing place — and its composition changes based on which of those two fans is looking at it.

For a fan with an established Favorites list, Discovery leads with what's happening across the Organizations they already follow — an active Campaign, a live Drop, a new Story — personalized directly from that data, so a returning, committed fan still gets pulled toward their own teams first even from the one surface that isn't any single team's home. For a fan with no such history, Discovery leads with what's broadly trending or editorially significant across the whole pyramid — a national-team moment, a rivalry week — because a platform-wide highlight is a far better introduction to an unfamiliar Organization than an empty personalization engine would be.

---

## Breadcrumbs

A breadcrumb here expresses identity lineage, not category lineage — the difference between *Home › Ateneo Blue Eagles › Men's Basketball › 2026 Home Collection › Product* and the conventional ecommerce version, *Home › Men › Basketball › Jerseys › Product*. The first tells a fan whose thing they're looking at. The second tells them what shelf it came from. Only one of those reinforces fandom.

Because a fan can arrive at a Product from many paths — hierarchical browsing, Search, a Story, a Campaign — the breadcrumb doesn't reflect the literal click path that got them there. It always resolves to the canonical identity lineage: Organization, then Team if applicable, then Collection if applicable. A fan who searched their way to a product still sees the same lineage a fan who browsed there would — because the breadcrumb's job is reinforcing whose thing this is, not logging navigation history.

---

## Contextual commerce

Where a Product or Collection is surfaced inside a Story, a Campaign, or a live broadcast moment, the path from that moment to the Product has to preserve the moment, not just the item — this is "context travels with the click" made concrete. A fan who taps through from a livestream overlay showing what a player is wearing arrives already knowing why they're there; the transition from watching to buying should feel like a continuation of the moment they were just in, not a hard cut into an unrelated shopping page.

Structurally, this means a Product or Collection referenced from a contextual surface carries a visible pointer back to the Story or Campaign it came from, the same way a breadcrumb points back to an Organization — a fan should be able to return to the moment as easily as they moved forward into the purchase.

---

## Cross-linking

One rule governs every cross-link on the platform: **no page is more than one click from the identity it belongs to, and every identity page links outward to everything that reinforces it.** A Product links to its Organization, Team, and Collection. A Team links up to its Organization and out to the Athletes affiliated with it. An Athlete links to every Organization and Team it has ever represented. A Story links to the Organizations, Athletes, and Collections it's about. Discovery links out to Organizations, Athletes, and Campaigns — never directly to a bare Product stripped of the identity behind it.

What this rule deliberately excludes is the conventional ecommerce cross-sell: "customers who bought this also bought," assembled from purchase-pattern similarity with no regard for whose team either item belongs to. That pattern optimizes for basket size at the direct expense of identity, which is the exact tradeoff this architecture is built to refuse. Every cross-link here is justified by whose it is, not by what else happened to sell alongside it.

---

## How to evaluate a future IA decision

Before adding a new navigational element, a new filter, or a new way to reach a Product, ask: does this help a fan reach an identity they already have, or find one they don't yet — or does it just help them find a category of good? If the honest answer is the third one, it belongs in a filter inside Discovery or Search, never in the primary structure. The primary structure is reserved for identity, permanently, because that's the one thing about this platform a conventional ecommerce site could never copy by adding a filter of its own.
