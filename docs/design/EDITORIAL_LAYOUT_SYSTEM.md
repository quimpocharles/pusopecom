# PusoStore Editorial Layout System

**Version 1.0**

The **Component Specification** defined the platform's vocabulary — Button, Panel, Table, and the rest. This document defines its sentences: the recurring, reusable patterns those components and the platform's content — text, photography, commerce — actually get composed into. Where a component is a single, atomic piece, a layout is a considered arrangement of many pieces into one coherent editorial beat.

**A layout is not a page.** A page — an Organization's Storefront, a Product's own URL, the Discovery Hub — is assembled from several of these layouts in sequence, the way a magazine issue is assembled from several considered spreads. The same Feature Hero pattern that opens an Organization's Storefront might also open a Campaign page or lead the Discovery Hub; the same Product Narrative might be reached from a Collection Feature, from Search, or from a Story's own contextual link. This is the direct visual expression of the Technical Architecture's requirement that a component behave identically no matter where it's dropped — extended here from a single component to a whole composed section. Which layouts appear on which actual page, and in what order, is the Information Architecture's decision, made separately from this document.

**This document does not define individual components, tokens, or code.** It defines composition — how much space a layout claims, what leads and what follows within it, how images and commerce are allowed to appear, and the rhythm of space around it. Every layout below is built entirely from the vocabulary the Component Specification and Design Tokens already established; nothing here invents a new primitive.

Sixteen layouts, grouped by the job they do: **Identity & Arrival** (introducing who something is), **Narrative** (telling a story), **Commerce** (presenting what can be bought), **Visual** (presenting photography and video as the primary content), and **Data & Community** (presenting numbers and real people).

Each is specified against eight questions: what it's for, what carries the most visual weight, the order a fan actually encounters its content, how it treats imagery, where and how commerce is allowed to appear inside it, the rhythm of space around it, and — as important as anything else here — when to reach for it and when not to.

---

# Identity & Arrival

## Feature Hero

**Purpose.** The platform's largest, most dramatic editorial statement — the masthead-level "arrival" moment introducing an Organization, a live Campaign, or the Discovery Hub itself at full scale.

**Hierarchy.** One dominant visual and textual statement. Nothing else on the page competes with it while it's in view.

**Reading order.** The image or moment is felt before anything is read; a single headline-scale statement follows; at most one supporting line beneath it. Nothing more.

**Image usage.** Full-bleed, edge to edge — the platform's largest permitted image treatment. The photograph is the content, not a backdrop behind competing text.

**Commerce placement.** None, or at most one quiet, secondary link. A Feature Hero's entire job is identity, not conversion. If commerce needs more presence than that here, the content actually belongs in Collection Feature or Product Narrative instead.

**Whitespace rhythm.** Dramatic section spacing on both sides — the page should feel like it paused specifically to make room for this.

**When to use it.** Opening an Organization's own Storefront, a live Campaign's arrival moment, the Discovery Hub's own top-of-page identity statement.

**When NOT to use it.** Never for a routine Product listing or any section that repeats often — its weight only means something because it's rare.

---

## Organization Spotlight

**Purpose.** Introduces or re-introduces a specific Organization's identity — its story and its current moment — the layout an Organization's own space genuinely opens with.

**Hierarchy.** Identity (name, mark, a brief framing statement) leads at masthead scale; a current moment — an active Campaign, a recent Story — follows at a clearly secondary weight beneath it.

**Reading order.** Who this is, then why now matters, then — only after both — a path into their Teams, Collections, or catalog.

**Image usage.** Full-bleed identity imagery at the top, matching Feature Hero's register, because an Organization's own arrival deserves exactly the weight the platform gives its own.

**Commerce placement.** Deliberately absent or minimal. This is where a fan meets an institution, not where they're asked to buy from it — commerce lives one layer deeper, in whatever this layout leads into.

**Whitespace rhythm.** Dramatic spacing after the identity moment; default spacing between the current-moment section and whatever follows it.

**When to use it.** The top of any Organization's own Storefront, or a featured-Organization moment inside Discovery.

**When NOT to use it.** Never as a repeating card within a list of many Organizations — this layout's weight only works once per view. A list of Organizations needs a far quieter, more compact pattern.

---

## Athlete Story

**Purpose.** Presents an individual athlete's identity and narrative, distinct from any single team or club they represent — the layout answering the Domain Model's own insistence that an Athlete needs its own discovery path, not a sub-page of whichever club they currently play for.

**Hierarchy.** The athlete's own name and image lead at full weight; affiliations — teams and Organizations represented, past and present — are presented clearly but at a visibly secondary weight beneath.

**Reading order.** Who this person is, then their story, then who they've represented — never reversed, which would present the athlete as a function of their club rather than as themselves.

**Image usage.** A generous, portrait-oriented lead image, distinct from the wide, cinematic ratio a team or Organization's imagery typically uses — chosen because it's the ratio that actually suits a single person.

**Commerce placement.** A personal capsule or endorsed Products, where they exist, presented as a clearly secondary, quieter section beneath the narrative — never the layout's opening statement.

**Whitespace rhythm.** The same dramatic-then-default rhythm as Organization Spotlight, reflecting that an Athlete is, structurally, its own kind of Organization.

**When to use it.** An individual athlete's own profile or feature presentation.

**When NOT to use it.** Never for a roster listing of many athletes at once — that needs a compact, list-oriented pattern; this layout's narrative weight is built for one person at a time.

---

# Narrative

## Split Editorial

**Purpose.** Presents two things in genuine relationship to each other — an image and a narrative, two Collections, an athlete and their team — giving both real weight without one subordinating the other.

**Hierarchy.** Two co-equal zones side by side (stacking on narrow viewports); neither zone visually dominates the other.

**Reading order.** Follows natural reading direction — image-then-text or text-then-image, chosen deliberately per instance rather than defaulted — but always one clear path, never a layout that leaves a reader unsure which side to read first.

**Image usage.** A generously sized, contained image occupying one full zone — not full-bleed, which is Feature Hero's register, but never cropped small either.

**Commerce placement.** At most one quiet action, positioned within the text zone. This layout narrates a relationship; it doesn't sell.

**Whitespace rhythm.** Default section spacing; the gutter between the two zones is generous enough that they read as related, not merged into one.

**When to use it.** Introducing a Collection's story alongside its imagery, presenting an athlete beside the team they represent, pairing a Story's opening image with its lead paragraph.

**When NOT to use it.** Never for more than two things at once — a third element forces an asymmetry this pattern isn't built to hold. That belongs in Media Grid or Gallery instead.

---

## Story Layout

**Purpose.** The platform's long-form reading format — an Organization's history, an athlete's journey, the meaning behind a Collection.

**Hierarchy.** A clear masthead (headline, and attribution where relevant) followed by a single, uninterrupted reading column — no competing sidebar pulling attention away from the read.

**Reading order.** Strictly linear, top to bottom: headline, lead image, body copy, occasionally an embedded Quote Block or Media Grid moment within the flow.

**Image usage.** A generous, near-full-bleed lead image opens the piece; inline images within the body respect the reading column's own width rather than breaking out of it.

**Commerce placement.** Deferred to the end, or linked once, contextually, exactly where the narrative naturally references a Product or Collection — never interrupting the read mid-paragraph with an offer.

**Whitespace rhythm.** Generous, measure-driven spacing throughout, consistent with long-form reading comfort rather than page-level dramatic pacing.

**When to use it.** Any Story content — an Organization's narrative, a Campaign's editorial companion, an athlete profile's written component.

**When NOT to use it.** Never for content that's fundamentally transactional, even where it includes narrative elements — a Product's own page is Product Narrative's job, which balances reading and commerce differently than this layout does.

---

## Quote Block

**Purpose.** Isolates a single, meaningful statement — an athlete's own words, an Organization's stated mission, a genuine fan review — giving it room to be read as its own moment rather than blended into surrounding prose.

**Hierarchy.** The quoted statement is the layout's entire content; attribution is present but visibly secondary.

**Reading order.** The statement first, its attribution after — a fan encounters the words before knowing whose weight to lend them, the way a considered publication often presents a quotation.

**Image usage.** Optional, small, and secondary if used at all — a portrait beside the attribution, never a large image competing with the statement's own typographic presence.

**Commerce placement.** None. A Quote Block is never a vehicle for a call to action of its own.

**Whitespace rhythm.** Generous space on every side, isolating it clearly from whatever precedes and follows it.

**When to use it.** Breaking up a long Story with a genuinely meaningful statement, presenting a verified Review with real weight, stating an Organization's own mission plainly.

**When NOT to use it.** Never for marketing copy dressed up as a quotation — this layout's entire authority rests on the statement being real and attributed; using it for unattributed platform copy borrows credibility it hasn't earned.

---

## Timeline

**Purpose.** Presents a sequence of events across real time — a Season's milestones, an Organization's history, a career — giving chronology itself the structure.

**Hierarchy.** Each entry is a distinct, dated moment; the sequence's overall chronological direction is the layout's one organizing principle, and no single entry visually dominates unless a moment is deliberately marked as the most significant.

**Reading order.** Strictly chronological, applied consistently everywhere a Timeline appears on the platform.

**Image usage.** Each entry may carry a small, contained image where one genuinely exists; a text-only entry is presented with the same structural confidence as an illustrated one, never as a lesser version of it.

**Commerce placement.** Rare, and only where a specific moment genuinely connects to a Product or Collection — a title-winning Season and its commemorative capsule, for instance. Never a default feature of every entry.

**Whitespace rhythm.** Consistent, even spacing between entries regardless of how much content each one holds, so the rhythm itself communicates the passage of time rather than the density of any single moment.

**When to use it.** An Organization's history, a Season's real-time progression, a career retrospective.

**When NOT to use it.** Never for content with no genuine chronological relationship — forcing an unordered set of facts into a Timeline implies a sequence that isn't actually true.

---

# Commerce

## Collection Feature

**Purpose.** Introduces a Collection with real editorial weight before handing a fan into its catalog — the visual expression of a Collection being where an Organization gives its catalog shape and meaning, not just a filtered list.

**Hierarchy.** A leading identity moment (the Collection's own name, imagery, brief framing) followed by a structured Product Grid.

**Reading order.** Identity and story first, catalog second — the Information Architecture's own ordering rule, made into a layout.

**Image usage.** A full-bleed or near-full-bleed lead image establishing the Collection's mood, followed by the Product Grid's disciplined, consistent-ratio commerce imagery.

**Commerce placement.** Present and central, but only after the identity moment — commerce is this layout's second act, never its opening line.

**Whitespace rhythm.** A dramatic pause between the identity moment and the grid that follows it, marking the shift in register clearly.

**When to use it.** A Collection's own landing presentation, a Drop's own page, a Season capsule.

**When NOT to use it.** Never for a flat, unthemed catalog listing with no real curatorial identity behind it — that's Product Grid alone, without the editorial lead-in this layout promises and needs content to justify.

---

## Product Narrative

**Purpose.** A single Product's detail presentation, told with real editorial care rather than as a bare spec sheet — the format making "a jersey is an artifact, not a product" concrete.

**Hierarchy.** Identity and story context lead — which Organization, which Collection, why it matters — followed by transactional detail (price, variant selection, availability) as a clear, distinct, but not visually detached second act.

**Reading order.** Image and context first, specification and acquisition second — a fan understands what something is and means before being asked to decide on it.

**Image usage.** The Product's own photography given real size and multiple angles, following the platform's consistent commerce-imagery discipline rather than the more dramatic full-bleed treatment reserved for identity moments.

**Commerce placement.** The clear focal point of the layout's second half — price stated plainly, availability stated as fact, the acquisition action unmistakable — but never crowding or competing with the identity context above it.

**Whitespace rhythm.** A deliberate section break between the narrative half and the commerce half, marking the tonal shift honestly rather than blending the two into one dense block.

**When to use it.** Every individual Product's own detail presentation.

**When NOT to use it.** Never for a Collection or catalog-level view — this layout is built around one specific, singular thing; using it for a set of items forces an awkwardly inflated presentation of each.

---

## Product Grid

**Purpose.** Presents multiple Products for browsing and comparison — a Collection's full catalog, a search result set, a category listing.

**Hierarchy.** Every Product carries equal visual weight; no item is artificially inflated in size to imply an importance the grid itself hasn't earned the right to assign.

**Reading order.** Non-linear, scanned rather than read — a fan's eye moves across the grid according to their own interest, not a forced sequence.

**Image usage.** One consistent aspect ratio across the entire grid, so a fan comparing items is comparing the Products, not fighting inconsistent photography from one item to the next.

**Commerce placement.** Present on every item — price and availability stated plainly beneath each image — but restrained: no discount badges, no urgency graphics layered onto individual items beyond the platform's own disciplined Badge treatment where genuinely warranted.

**Whitespace rhythm.** Consistent, moderate gutters between items — enough separation that the grid never feels crowded, not so much that it stops reading as one coherent set.

**When to use it.** Any browsable set of Products — a Collection's catalog, search results, a filtered category view.

**When NOT to use it.** Never as a page's opening statement. A Product Grid is always the second act, arriving after an identity or editorial moment — a Collection Feature, an Organization Spotlight — has already established why these Products matter, per the Information Architecture's identity-before-inventory rule.

---

## Comparison

**Purpose.** Presents two or more things side by side for direct evaluation — Product Variants, a size chart's measurements, two Collections' contents.

**Hierarchy.** Every item being compared carries equal visual weight; the comparison's own structure — a consistent set of attributes evaluated across every item — is the layout's actual subject, not any single item within it.

**Reading order.** Across before down — a fan compares one attribute across every item before moving to the next attribute, which the layout's own structure has to make natural rather than requiring an awkward back-and-forth scan.

**Image usage.** Small, consistent, contained imagery per item at most. This layout's job is information, not photography, and a large image would compete with the comparison itself.

**Commerce placement.** Where the comparison is between purchasable options, the acquisition action is consistent per item and placed at the same position in every column, so the comparison never becomes lopsided by inconsistent commerce treatment.

**Whitespace rhythm.** Tight, consistent internal spacing, matching Table's density-favoring-legibility rhythm — a Comparison is read the way a table is, not the way a Story is.

**When to use it.** Product Variant comparison, a size chart, two Collections or Drops presented against each other.

**When NOT to use it.** Never for more than a handful of items at once — beyond a small number, a genuine comparison stops being scannable, and the content is better served by Product Grid with filtering instead.

---

# Visual

## Media Grid

**Purpose.** Presents a curated set of images or video as a considered visual sequence — a match's photography, a Campaign's visual moments — without any single image claiming the full-bleed weight of a Feature Hero.

**Hierarchy.** Every item in the grid carries equal visual weight by default, unless one is deliberately given a larger span to mark it as the set's most important entry.

**Reading order.** Non-linear — a fan can enter anywhere in the grid, which is exactly why every item needs to stand on its own without depending on being seen in sequence.

**Image usage.** Contained, consistent aspect ratios across the grid — the same commerce-imagery discipline used elsewhere on the platform, even though this content is editorial rather than transactional.

**Commerce placement.** None directly within the grid. Where an item links to a Product, that's a secondary action on interaction, never a visible price or badge sitting on top of the image itself.

**Whitespace rhythm.** Tight, consistent internal gutters between items; generous spacing separating the grid as a whole from what comes before and after it.

**When to use it.** A photo set from a broadcast moment, a Campaign's visual archive, an Organization's identity imagery collection.

**When NOT to use it.** Never for product photography meant to be compared and purchased — that's Product Grid, which carries commerce information this layout deliberately withholds.

---

## Gallery

**Purpose.** A focused, sequential presentation of a single set of related images — a Product's own photography across angles, a specific moment's photo set — meant to be moved through in order, unlike Media Grid's non-linear browsing.

**Hierarchy.** One image holds primary focus at any given moment; the rest of the set is present but visually secondary, indicated quietly rather than competing for the same attention.

**Reading order.** Sequential and fan-directed — moving forward and backward through a defined order, never entered at random the way a Media Grid is.

**Image usage.** The platform's most generous per-image treatment outside of a Feature Hero — each image gets real, uncropped space while it holds focus.

**Commerce placement.** None within the Gallery itself. Where the set belongs to a Product, the acquisition action lives in the Product Narrative surrounding it, not inside the Gallery's own controls.

**Whitespace rhythm.** Minimal internal rhythm — the images are the content — but generous spacing separating the Gallery as a whole unit from surrounding page content.

**When to use it.** A Product's multi-angle photography, a single moment's sequential photo documentation.

**When NOT to use it.** Never for a broad, browsable set with no natural order — that's Media Grid's job. Forcing an unordered set into a sequential Gallery asks a fan to move through a false order that doesn't actually mean anything.

---

# Data & Community

## Statistics Panel

**Purpose.** Presents a small set of meaningful figures — a Season's record, a Drop's sell-through, a career's numbers — with the same calm authority a museum label states an object's dimensions.

**Hierarchy.** Each figure carries equal structural weight (consistent size, consistent label treatment) unless one is genuinely the most significant, in which case it alone is given a larger typographic treatment.

**Reading order.** Scanned, not read linearly — the layout's job is letting a fan's eye land on the specific number they're looking for, not forcing a top-to-bottom read.

**Image usage.** None. A Statistics Panel is typographic content only — numbers set with the platform's tabular-figure discipline, labels set in label-voice type.

**Commerce placement.** None directly, though a Statistics Panel may sit adjacent to a Collection Feature or Product Narrative it provides context for.

**Whitespace rhythm.** Even, generous spacing between each figure. A Statistics Panel that crowds its numbers together reads as trying to prove something; one with room reads as simply stating fact.

**When to use it.** A Season's record, a Drop's real-time sell-through stated honestly, a career's defining numbers.

**When NOT to use it.** Never to manufacture false authority around a number that isn't actually meaningful — this layout's calm confidence only holds up if every figure in it genuinely matters.

---

## Community Feed

**Purpose.** Surfaces genuine fan activity and content — reviews, shared moments, community-submitted photography — giving the platform's actual community real, visible presence.

**Hierarchy.** Individual entries carry roughly equal weight; the feed as a whole, not any single entry, is the layout's real subject.

**Reading order.** Non-linear, typically reverse-chronological, scanned the way a fan would move through any real-time feed rather than read start to finish.

**Image usage.** Contained, moderate-sized imagery per entry, respecting whatever a fan actually submitted rather than forcing it into an artificially dramatic crop.

**Commerce placement.** Indirect at most. A piece of community content may reference a Product, surfaced as a quiet, secondary link — never as a primary call to action riding on someone else's genuine post.

**Whitespace rhythm.** Consistent, moderate spacing between entries, similar in density to Product Grid but distinguished by content type rather than rhythm.

**When to use it.** Genuine fan reviews presented with real weight, a moderated stream of fan-submitted moments, community reaction to a live event.

**When NOT to use it.** Never populated with platform-authored content dressed up as community activity — this layout's entire credibility depends on what it shows being genuinely from fans, not manufactured to look that way.

---

## Live Match Section

**Purpose.** Surfaces a genuinely live, real-time sporting moment — a broadcast in progress, live scoring, an active match — the direct expression of contextual commerce's principle that the moment wins.

**Hierarchy.** The live moment itself — a score, a broadcast embed, a real-time update — holds absolute primary weight; anything else in the section, including any commerce, is clearly secondary.

**Reading order.** The live fact first — what's happening right now — before any narrative or commercial content connected to it.

**Image usage.** Live broadcast imagery or real-time visual data takes the section's full available space. This is the one layout where genuinely real-time-updating content is allowed the platform's motion tokens for that specific purpose — never for decorative effect.

**Commerce placement.** Present only where it's a direct, honest continuation of the moment — a single, clear path to what a player is wearing right now, for instance — never a general storefront presence riding on the broadcast's attention for its own sake.

**Whitespace rhythm.** Tighter than most editorial layouts, reflecting genuine urgency rather than manufactured pacing. This is the one layout allowed to feel more immediate and front-loaded than the platform's usual contemplative rhythm, because the real-world moment it represents actually is that immediate.

**When to use it.** An active broadcast, a live Drop tied to a real-time match moment, real-time score or event tracking.

**When NOT to use it.** Never for a completed or not-yet-live match — that's Timeline's job for the past, and a much quieter announcement pattern for the future. Using this layout for anything short of a genuinely live moment borrows an urgency the platform can't actually back up.

---

## How these layouts are meant to be composed

A page is a sequence of these sixteen, chosen and ordered deliberately, never a single layout stretched to do a job it wasn't built for. The Information Architecture decides which layouts belong on which page and in what order; this document decides what each one, on its own, is actually for. Where a page's real content doesn't fit any layout above cleanly, that's a signal worth pausing on — either the content needs a genuinely new pattern, specified with the same rigor as the sixteen here, or it's being forced into the wrong one for convenience, which is exactly the kind of quiet exception the rest of this series has already warned against.
