# PusoStore Component Specification

**Version 1.0**

The **Editorial Design Language** explains why. The **Design System** decided the rules. **Design Tokens** named the values. This document is where all three meet a specific, buildable component — every shared primitive on the platform, fully redefined against everything that came before it.

**This is a design specification, not an implementation guide.** No React, no markup, no styling syntax — every decision below is a design decision, described the same way an industrial designer's spec sheet describes an object before anyone's drawn the manufacturing plans. What eventually builds each of these is a separate exercise, checked against this document rather than substituting for it.

Twenty-four components, grouped by role rather than presented as one flat list, purely for readability at this length: **Structural** (the platform's most fundamental surfaces), **Form Controls** (how a fan gives the platform information), **Feedback & Status** (how the platform communicates state), **Overlays** (content genuinely layered above the page), and **Navigation & Structure** (how a fan moves through and reads organized content).

Every component is specified against the same seven questions: what it's for, what it visually communicates and how strongly, its shape, its spacing, how it behaves, what it guarantees for a fan using assistive technology, and where it should and shouldn't be reached for.

---

# Structural

## Button

**Purpose.** The platform's mechanism for a fan to take a deliberate, intentional action — proceed, confirm, acquire.

**Visual hierarchy.** Three functional types, and no more: **Primary** (a solid, high-contrast fill — the one action on a given view meant to stand out), **Secondary** (bordered, at the platform's standard structural border weight), and **Text** (label only, no fill or border, for the lowest-emphasis actions). A view never shows more than one Primary button at once.

**Geometry.** `radius.default` on every corner. Flat — `elevation.none` at every state, including hover. No gradient fill, ever.

**Spacing.** Two size tiers only — standard and compact — each with its own fixed internal padding drawn from the spacing scale. No component-specific one-off sizing.

**Interaction.** Hover, focus, and active states are communicated by a border or background value shift — never elevation, never a scale-down "press" animation. Disabled state reduces contrast without erasing the button's color identity, so it still reads as what it is, just unavailable.

**Accessibility.** Native interactive-element semantics. A visible focus indicator, using the same border treatment as focus everywhere else, is never suppressed. An icon-only button always carries an accessible label, whether or not a visible label is also shown. Touch targets meet a comfortable minimum size regardless of the visual size tier chosen.

**Usage rules.** The virtual try-on action and every other feature-specific call to action use these same three types — no button anywhere on the platform earns a bespoke visual identity of its own, including the platform's own signature feature.

---

## Panel *(replaces Card)*

**Purpose.** A bounded region that holds and frames related content — an Organization's summary, a Product's detail, a report's figures — belonging to the page it sits on rather than floating above it.

**Visual hierarchy.** One treatment only. There is no "elevated" versus "bordered" distinction; hierarchy between panels comes entirely from size, position, and what's inside them, never from a different panel style.

**Geometry.** `radius.default`; bordered at the structural border weight, using the stronger neutral value for a panel meant to stand out and the quieter one for a subordinate panel; `elevation.none`, always, at rest and on hover alike.

**Spacing.** Internal padding is set by content density — a data-dense panel (a stat block) uses tighter padding than a narrative one (a Story preview) — but every panel of the same density tier uses identical padding, with no per-instance adjustment.

**Interaction.** An interactive panel (one that leads to more detail) is visually identical to a static one at rest. Hover and focus shift the border's value only — no lift, no shadow appearing where there wasn't one a moment ago.

**Accessibility.** An interactive panel is a genuine link or button in its underlying semantics, not a plain container with a click handler attached. Focus is visible around the whole panel, not just some inner element inside it.

**Usage rules.** A panel is never nested directly inside another panel of the same density tier — if containment needs a second border to be legible, the layout around it needs rethinking, not a second border.

---

## Avatar

**Purpose.** Represents a person, an athlete, or an Organization in a small, contained space — a review, a roster entry, an account menu.

**Visual hierarchy.** A real photograph wherever one genuinely exists. Where it doesn't, a plain initials treatment, set in the platform's label-voice type against a neutral surface — never a generic silhouette icon standing in for a photo that isn't there.

**Geometry.** `radius.circular` — the platform's one legitimate, structural use of a true circle.

**Spacing.** A small, fixed number of sizes, each matched to the specific contexts avatars actually appear in — a roster list, a review byline, an account menu — with no arbitrary in-between sizing invented per screen.

**Interaction.** Where an avatar also links somewhere (a profile, an Organization), it follows Panel's interactive-surface rules exactly — no separate hover treatment invented just for this component.

**Accessibility.** Always carries an accessible label naming who or what it represents, whether it's showing a photograph or initials.

**Usage rules.** Never stretched or aggressively cropped to force a photograph into the circular frame without respecting its real composition — a carelessly cropped face undermines trust in a component this small and this frequently seen.

---

# Form Controls

## Input

**Purpose.** Collects a single line of text or value from a fan.

**Visual hierarchy.** A visible label sits permanently above the field — labels never live only as placeholder text, which disappears exactly when a fan might still need it.

**Geometry.** `radius.default`; bordered at the standard structural weight; the field's shape never changes on focus, only its border's value.

**Spacing.** Standard internal padding from the spacing scale; a small, consistent gap between the label and the field, and between the field and any helper or error text beneath it.

**Interaction.** Focus shifts the border to its strongest available value — no glow, no ring extending past the field's own edge. An error state shifts the border toward the platform's error signal color and adds a specific, plainly-worded line beneath the field — the color and the words always appear together, never the color alone.

**Accessibility.** The label is programmatically associated with its field. Helper and error text are associated with the field as well, so assistive technology announces them at the right moment. Placeholder and border states meet legibility requirements on their own, not only when paired with surrounding content.

**Usage rules.** Placeholder text, where used at all as a genuine example rather than a label substitute, is visibly quieter than real input content and is never mistakable for an already-filled value.

---

## Textarea

**Purpose.** Collects multi-line text — a review, a longer note, an explanation.

**Visual hierarchy.** Identical to Input's label-above-field convention; the only visual distinction is height and, where offered, a resize affordance.

**Geometry.** Same radius and border treatment as Input.

**Spacing.** Same internal padding convention as Input; a minimum height set to comfortably show several lines before scrolling becomes necessary.

**Interaction.** Resizes vertically only, where resizing is offered at all. Focus and error states behave identically to Input.

**Accessibility.** Same labeling and error-association requirements as Input. A resize handle, where present, is operable by keyboard, not only by drag.

**Usage rules.** Reserved for genuinely multi-line content. A single-line need always uses Input — never a Textarea artificially constrained to one visible row.

---

## Checkbox

**Purpose.** Represents an independent, binary choice — one among possibly several that can be true at once.

**Visual hierarchy.** A small square mark, empty by default. A checked state fills with the platform's strongest neutral value and shows a simple check mark — never a colored fill.

**Geometry.** A minimal, near-sharp square — deliberately distinct from Radio's circularity, since the shape difference is how a fan distinguishes "choose any" from "choose one" before reading a single word.

**Spacing.** A small, consistent gap between the mark and its label; the mark and label are always presented as one clickable unit, never two separate targets.

**Interaction.** Focus uses the same border-shift convention as Input. The check/uncheck state change is immediate — an element this small doesn't need a transition to feel considered.

**Accessibility.** Native checkbox semantics. The label is part of the same clickable target as the mark. An indeterminate state (a group that's partially selected) is visually and programmatically distinct from both a fully checked and a fully unchecked state.

**Usage rules.** Never used where only one option in a set may be true at a time — that's Radio's job, and mixing the two shapes for the same kind of decision undermines the whole reason the shapes differ.

---

## Radio

**Purpose.** Represents one choice among a mutually exclusive set.

**Visual hierarchy.** A small circle, empty by default; a checked state shows a filled inner circle in the platform's strongest neutral value.

**Geometry.** `radius.circular` — Checkbox's structural counterpart, and the platform's other legitimate circular use.

**Spacing.** Same convention as Checkbox — a small gap to its label, presented as one clickable unit; a consistent gap between each option within a group.

**Interaction.** Selecting one option in a group immediately and visually deselects any other option in that same group. No transition is needed for a change this small and this immediate.

**Accessibility.** Grouped radios share a programmatic group so assistive technology announces the full set and the fan's current position within it. Arrow keys move between options inside the group.

**Usage rules.** A radio group defaults to a selected option wherever a genuine sensible default exists — it isn't left ambiguously unselected just because no explicit choice has been made yet, if the underlying decision actually has a natural starting point.

---

## Switch

**Purpose.** Toggles a single setting on or off immediately, with no separate confirmation step required.

**Visual hierarchy.** Deliberately redesigned away from the conventional fully-rounded toggle track. This platform's Switch is a rectangular track with a rectangular indicator that moves between two positions — the shape changes specifically to hold the platform-wide rejection of pill geometry without exception; the on/off behavior a fan already expects from a switch does not change at all.

**Geometry.** Track and indicator both use `radius.default`, matching every other rectangular surface on the platform, rather than the fully-rounded track and circular thumb this control conventionally uses in most other systems.

**Spacing.** Sized to a comfortable touch target regardless of its compact visual footprint; a small, consistent gap to its label where one is shown alongside it.

**Interaction.** The indicator moves from one position to the other using the platform's quick transition timing and standard easing curve. The on/off state is also communicated by a value change in the track itself, never by the indicator's position alone.

**Accessibility.** Native toggle semantics with a clearly exposed on/off state. Operable by keyboard with a single activation — never requiring a drag gesture to change state.

**Usage rules.** Reserved for settings that take effect immediately. Anything requiring a separate save or confirmation step uses Checkbox inside a Form instead, where the distinct visual language correctly signals "this doesn't happen until you submit."

---

## Search

**Purpose.** Lets a fan find something specific, fast, by name — including an Organization, Team, or Athlete whose name may not appear anywhere in a single product's own listing.

**Visual hierarchy.** Identical field treatment to Input. Suggestions appear beneath it as an overlay, grouped and labeled by type — Organizations and Teams presented ahead of individual Products — reflecting the Information Architecture's identity-first search principle rather than one undifferentiated list.

**Geometry.** Matches Input's radius and border treatment; its suggestion panel matches Dropdown's overlay elevation and radius.

**Spacing.** Matches Input's internal padding; consistent row spacing within the suggestion list, matching Dropdown's row treatment exactly.

**Interaction.** Suggestions update as a fan types, with a brief, deliberate pause so every keystroke doesn't produce a visible flicker of changing results. Arrow keys move through suggestions; Enter selects whichever is currently highlighted.

**Accessibility.** Updated suggestions are announced to assistive technology as they change. The currently highlighted suggestion is exposed programmatically, not communicated by visual highlighting alone.

**Usage rules.** An Organization, Team, or Athlete matching the query is always presented as a real, first-class result — never filtered down to only the products that happen to mention it, which the Information Architecture names as the specific failure this component exists to correct.

---

# Feedback & Status

## Badge

**Purpose.** A small, structural label carrying specific, real meaning — a category, a status, a count.

**Visual hierarchy.** The default treatment is neutral: bordered, unfilled, set in label-voice type. A color-filled badge is reserved exclusively for the platform's three functional signal colors — verified, live, and error. Nothing else earns a filled color treatment, including a generic "New" or "Featured" flag.

**Geometry.** `radius.default`; never a pill, under any circumstance.

**Spacing.** Tight internal padding, reflecting its role as a small structural marker rather than a button.

**Interaction.** Informational by default and not interactive. Where a badge also functions as a removable filter tag, its dismiss affordance follows Button's Text-type interaction rules exactly.

**Accessibility.** Meaning is never carried by color alone — a verification badge reads "Verified" in words, not only a colored mark. Sufficient contrast between label text and its background or border at every state.

**Usage rules.** A generic "New" or "Featured" callout uses the same neutral treatment as any other non-functional badge — decorative color applied for visual variety alone is exactly the pattern this component exists to prevent.

---

## Alert

**Purpose.** Communicates important, often time-sensitive information inline, without interrupting or blocking the page the way a Modal does.

**Visual hierarchy.** A bordered block with a structural accent, not a full colored fill: neutral for general information, the platform's error signal for a real problem, the platform's live signal for something genuinely time-sensitive. A purely positive confirmation — a save succeeding, an action completing — stays neutral; success is not automatically assigned the platform's verification color, which is reserved specifically for Trust & Verification and nothing else.

**Geometry.** `radius.default`; `elevation.none` — an Alert sits inline in the page's own flow, never layered above it.

**Spacing.** Standard internal padding from the spacing scale; a consistent gap between an Alert and the content immediately around it.

**Interaction.** A dismissible Alert uses a small Text-button-style dismiss action — never a decorative close icon existing outside the platform's own button conventions.

**Accessibility.** Announced to assistive technology at the appropriate level of urgency when it appears dynamically. A dismiss action carries an accessible label, not an icon alone.

**Usage rules.** Reserved for information that genuinely needs a fan's attention right now — never used as a decorative wrapper around routine, expected information that could simply be part of the page's normal content.

---

## Loading

**Purpose.** Communicates that something genuinely in progress hasn't stalled, without performing effort the platform doesn't actually need to perform.

**Visual hierarchy.** A quiet, minimal indicator — never a branded or decorative animation drawing attention to the wait itself.

**Geometry.** Small and unobtrusive, with no panel, border, or elevation of its own; it sits within whatever region is actually waiting rather than asserting a presence of its own.

**Spacing.** Centered within the specific region that's loading, with enough surrounding space that it never crowds already-loaded content nearby.

**Interaction.** Appears only after a brief delay where a wait is typically short, so a fast response never produces a flash of a loading indicator appearing and disappearing before it was ever useful.

**Accessibility.** Announced to assistive technology as a busy or loading state. Replaced by real content or an ErrorState the moment either becomes available — never left showing indefinitely.

**Usage rules.** Scoped to exactly the region that's waiting — never the whole page by default when only one part of it genuinely depends on a pending request.

---

## Skeleton

**Purpose.** Previews the real shape of content that's still loading — more informative than an undifferentiated spinner, because a fan can see roughly what's coming.

**Visual hierarchy.** A set of simple blocks matching the actual layout about to appear — a headline-shaped block, an image-shaped block, a paragraph's worth of line-shaped blocks — never a generic, unrelated placeholder shape.

**Geometry.** Each block matches the radius token of whatever real element it stands in for — the platform's default radius for a panel or a text block, the circular radius for an avatar placeholder.

**Spacing.** Matches the exact spacing the real, loaded content will use, so nothing visibly shifts or reflows the moment the Skeleton resolves into actual content.

**Interaction.** A gentle, slow, barely-perceptible opacity pulse signals the placeholder is still active — never a sweeping shimmer effect, which is decorative motion performing liveliness the platform's motion principles specifically reject.

**Accessibility.** Announced as a loading state, never read aloud as if it were meaningful content. Replaced entirely by real content or an ErrorState once the wait resolves.

**Usage rules.** Used specifically where the real content's shape is already known ahead of time. A plain Loading indicator remains the right choice where no such shape exists yet to preview.

---

## EmptyState

**Purpose.** Represents the genuine, calm absence of content — no results yet, nothing here — as its own real, considered state, not an apology.

**Visual hierarchy.** A minimal, linear icon or mark, never a large, colorful illustration; a plainly-stated headline; and, where relevant, a short, calm explanation — all set with the same typographic restraint as everything else on the platform.

**Geometry.** Sits within a Panel matching the region it's replacing; `radius.default`, `elevation.none`.

**Spacing.** Generous internal spacing — an empty state is given real room, consistent with the platform's whitespace-as-confidence principle, rather than compressed into a small corner of the page.

**Interaction.** Where a recovery action is offered — clearing filters, returning to Discovery — it uses Button's standard Primary or Secondary treatment; no special, more prominent button style exists just for this moment.

**Accessibility.** Announced clearly when it replaces a Loading state, so a fan using assistive technology understands the result is genuinely empty, not still pending.

**Usage rules.** Copy states plainly what's true — "No products match these filters" — never exaggerated cheerfulness or self-deprecating humor standing in for a clear next step.

---

## ErrorState

**Purpose.** Represents a genuine failure to load or complete something — distinct from EmptyState's honest "nothing to show" and from an inline Alert's supplementary warning.

**Visual hierarchy.** The same restrained register as EmptyState: a minimal mark, a plainly-stated headline naming what went wrong, without technical detail a fan has no way to act on.

**Geometry.** The same Panel treatment as EmptyState — `radius.default`, `elevation.none`, sized to the region it's replacing.

**Spacing.** The same generous internal spacing as EmptyState.

**Interaction.** A retry action, where offered, uses Button's standard Primary treatment. Where the failure genuinely requires human support rather than a retry, the action routes there directly instead of offering a retry already known not to help.

**Accessibility.** Announced with appropriate urgency to assistive technology when it replaces a Loading state. The retry action carries a clear, specific label — never a bare icon alone.

**Usage rules.** Never dramatized with alarming color or emphatic language disproportionate to the actual failure — a calm, specific statement of what went wrong is more trustworthy than an anxious one, consistent with the platform's honesty-over-urgency-theater principle.

---

# Overlays

## Modal

**Purpose.** Interrupts the current flow deliberately, for a decision or a piece of information that genuinely requires a fan's full attention before they continue.

**Visual hierarchy.** Centered over a dimmed, flat scrim; everything inside follows the platform's ordinary typographic and spacing rules — a Modal is never a denser, more utilitarian register than the rest of the page it interrupted.

**Geometry.** `radius.default`; the one legitimate, deliberately subtle use of `elevation.overlay`.

**Spacing.** Generous internal padding; a clear, consistent gap between the Modal's heading, its body content, and its actions at the bottom.

**Interaction.** Appears and dismisses using the platform's quick transition timing and standard easing curve — no bounce, no spring overshoot. Dismissible by an explicit close action, a backdrop click, and the Escape key, all three, always.

**Accessibility.** Focus moves into the Modal the moment it opens and is trapped within it until it's dismissed; focus returns to whatever triggered it on close. Announced to assistive technology as a dialog.

**Usage rules.** Reserved for moments that genuinely warrant interrupting a fan — a destructive confirmation, a focused task requiring a decision. Routine, low-stakes information belongs in an Alert or in the page's own content instead.

---

## Drawer

**Purpose.** The same deliberate-interruption pattern as Modal, used specifically where content is naturally reviewed alongside the page it came from rather than fully replacing a fan's attention on it — a cart, a filter panel.

**Visual hierarchy.** Slides in from a screen edge rather than centering over the page; the same scrim, the same internal typographic and spacing rules as Modal.

**Geometry.** `radius.default` on its leading edge only, where it meets the page's remaining open space; `elevation.overlay`, matching Modal exactly.

**Spacing.** The same internal spacing conventions as Modal.

**Interaction.** Enters and exits along its edge using the platform's quick transition timing and standard easing curve; dismissible the same three ways as Modal.

**Accessibility.** The same focus-trap and return-focus behavior as Modal; announced as a dialog region to assistive technology.

**Usage rules.** Chosen over Modal specifically when a fan benefits from a lingering sense of the page behind it — reviewing a cart while still seeing what's currently in view. Where that context doesn't genuinely matter, Modal is the simpler, more appropriate choice.

---

## Tooltip

**Purpose.** A brief, supplementary clarification tied to a specific element — never essential information a fan has no other way to reach.

**Visual hierarchy.** Small, quiet, set in the platform's smallest structural type; the briefest, most transient overlay on the platform.

**Geometry.** `radius.default`; `elevation.overlay` at its most minimal value. A small, geometrically simple connector may point toward its trigger where that spatial relationship genuinely needs reinforcing.

**Spacing.** Minimal internal padding; positioned with enough clearance from its trigger that it never overlaps the element it's describing.

**Interaction.** Appears on hover or focus after a brief, deliberate pause — not instantly, so a page doesn't feel like it's constantly sprouting labels as a cursor passes over it — and dismisses immediately, using the platform's instant timing, the moment hover or focus is lost.

**Accessibility.** Triggered by keyboard focus as well as hover, so a keyboard user receives exactly the same information a mouse user does. Never the sole place essential information is stated.

**Usage rules.** Never used to hide information a fan actually needs to complete a task — a Tooltip clarifies something already mostly clear; it never gatekeeps something a fan can't otherwise find.

---

## Dropdown

**Purpose.** Presents a set of options or actions beneath a trigger, without leaving the current page.

**Visual hierarchy.** A bordered, flat list of options inside a single Panel-like surface. The currently highlighted or hovered option is marked by a background-value shift — never a filled, colored block.

**Geometry.** `radius.default`; `elevation.overlay`, consistent with Modal and Drawer.

**Spacing.** Consistent vertical padding per option; identical row height across every option in the list, with no exceptions for an option that happens to carry more visual weight.

**Interaction.** Opens and closes using the platform's quick transition timing and standard easing curve. Dismisses on an outside click, an option being selected, or the Escape key.

**Accessibility.** Full keyboard operability — arrow keys move between options, Enter selects, Escape closes. The trigger's expanded or collapsed state is exposed to assistive technology.

**Usage rules.** Reserved for a genuinely short, scannable list of options. A long or search-heavy list belongs in Search's suggestion pattern, or a full page, rather than an overloaded Dropdown trying to do a different component's job.

---

# Navigation & Structure

## Tabs

**Purpose.** Switches between a small number of related views within the same context, without navigating away from it.

**Visual hierarchy.** The active tab is marked by an underline or a type-weight change — never a filled, colored, pill-shaped tab background — consistent with how every other active state on the platform is marked.

**Geometry.** Flat; no border around the tab list itself beyond the single line marking the boundary between the tabs and the content beneath them.

**Spacing.** Consistent, generous spacing between individual tab labels; consistent padding beneath the tab row before its content begins.

**Interaction.** Selecting a tab swaps the content beneath it without a full page transition; the active-state change happens using the platform's instant timing.

**Accessibility.** Operable by arrow keys once a tab has focus. The relationship between a tab and the panel it controls is exposed programmatically, so assistive technology can move between them directly rather than by trial and error.

**Usage rules.** Reserved for a small, fixed number of views. Where the number of sections grows or becomes dynamic, a proper navigational structure is a more honest choice than an overflowing tab row trying to hold everything.

---

## Accordion

**Purpose.** Lets a fan progressively reveal detail — a size guide's full measurements, a return policy's specifics — without committing that detail to permanent page space.

**Visual hierarchy.** Each section is a bordered row; its header carries a simple, minimal marker showing expanded or collapsed state, changing appearance rather than animating elaborately.

**Geometry.** `radius.default` on the accordion's outer edge only; internal section dividers use the platform's quieter border value.

**Spacing.** Standard internal padding per section header and per expanded section's content, consistent across every section regardless of how much content it holds.

**Interaction.** Expanding or collapsing a section animates height using the platform's quick transition timing and standard easing curve — motion tied directly to the content actually growing or shrinking, never a fade or slide unrelated to that real change.

**Accessibility.** Each header is a real, operable control exposing its own expanded or collapsed state. Content is only removed from the accessibility tree when genuinely collapsed, never merely hidden visually while still technically present.

**Usage rules.** Reserved for genuinely optional, supplementary detail. A fact essential to a fan's decision — a real price, real availability — is never hidden behind a collapsed accordion by default.

---

## Pagination

**Purpose.** Lets a fan move through a long list of results or records organized into defined pages.

**Visual hierarchy.** Understated and numeric, set with the platform's tabular figure treatment so numbers line up cleanly. The current page is marked by type weight or an underline — never a filled, colored circle.

**Geometry.** Flat; no border around the control itself, consistent with its quiet, purely functional role.

**Spacing.** Consistent spacing between individual page controls.

**Interaction.** Selecting a page updates the result set as directly as possible, avoiding a jarring full-page reload sensation where it can genuinely be avoided. Previous and next controls follow Button's Text-type treatment.

**Accessibility.** The current page is announced to assistive technology, not conveyed by visual marking alone. Previous and next controls carry clear, specific labels rather than bare directional icons with no accompanying text.

**Usage rules.** Reserved for genuinely page-based content. A continuously-loading or infinite list uses a different, honest pattern rather than pagination controls implying fixed pages that don't actually exist.

---

## Breadcrumb

**Purpose.** States a fan's identity lineage — whose thing they're looking at — never a category path.

**Visual hierarchy.** Set with the same confident, structural type as any other label-voice element on the platform — never small, gray, or easy to miss, since its entire purpose depends on being legible enough to actually be read.

**Geometry.** Flat; a simple separator mark between each step in the lineage, consistent with the platform's preference for a line over any decorative divider.

**Spacing.** A small, consistent gap around each separator, keeping the whole lineage readable as one continuous statement rather than a cramped string of fragments.

**Interaction.** Every step except the final, current one is a real link; hover and focus states match Button's Text-type treatment exactly.

**Accessibility.** Marked as a navigation landmark, with the current position in the lineage indicated programmatically — not conveyed only by being visually last in the sequence.

**Usage rules.** Always resolves to the canonical identity lineage — Organization, then Team, then Collection — regardless of the actual path a fan took to arrive there, per the Information Architecture's own rule that a breadcrumb reinforces identity, not click history.

---

## Table

**Purpose.** Presents structured, comparable data — orders, products, report figures — the way a printed ledger or an archive index would.

**Visual hierarchy.** The header row is distinguished by the platform's label-voice type, never by a filled background block. Rows are separated by the platform's quieter border value, with no zebra-striping.

**Geometry.** The table as a whole sits inside a single bordered Panel; `radius.default` on the outer edge only, with every internal rule staying flat.

**Spacing.** Generous row height, favoring legibility over density; consistent cell padding across every row and column in the table, with no exceptions for a cell that happens to hold more content.

**Interaction.** A sortable column header follows Button's Text-type treatment for its interactive affordance. A clickable row leading to detail behaves like an interactive Panel — a background-value shift only, never an elevation change.

**Accessibility.** Real table semantics, with headers programmatically associated with their cells. Sort state is exposed to assistive technology, not communicated by an icon alone.

**Usage rules.** No row is ever singled out with a special background color for emphasis. A genuinely important row is marked with an icon or a label instead, never by breaking the table's otherwise-uniform row treatment for just one entry.

---

## How this specification is meant to be used

Every component above resolves the same tension the same way: a real, sometimes very conventional interface need, met with this platform's specific geometry, spacing, and restraint rather than the generic version of that component most systems ship by default. Where a future component isn't on this list, it's specified the same way before it's built — against the same seven questions, checked against the Design System's rules and the Editorial Design Language's principles, never assembled by copying whichever convention is fastest to reach for.
