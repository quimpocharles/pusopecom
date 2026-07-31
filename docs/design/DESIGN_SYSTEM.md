# PusoStore Design System

**Version 2.0**

The **Editorial Design Language** is PusoStore's constitution — what the platform should feel like, and why. This document is its translation into a real, decided specification: concrete enough that a component built against it doesn't require guessing, without stepping into code. Where the Editorial Design Language describes a principle, this document decides what that principle actually means for a specific surface, a specific value, a specific rule.

**The engineering architecture is unchanged by this document.** Component composition, folder structure, state management, the Capability Model's boundaries, the Engineering Handbook's coding philosophy — none of it moves. This document governs one thing: what every component looks like, spaces itself by, and behaves like visually. How that gets built is a separate, later exercise, checked against this specification rather than substituting for it.

**This document contains no code.** No class names, no CSS syntax, no framework-specific instruction. Where a concrete value is given — a spacing unit, a radius, a column count — it's a design decision, the same way a museum's style guide might specify a label's exact point size without knowing or caring what typesetting software eventually sets it. The number is the specification. The implementation is not this document's job.

Two groups: **Foundations**, the shared tokens every surface draws from, and **Components**, the specific pieces built on top of them. Foundations come first because nothing in the Components section makes sense without them already decided.

---

# Foundations

## Spacing

**One spacing scale, used everywhere, with no ad hoc exceptions.** A single base unit, and every space on the platform — the gap between a headline and its body copy, the margin around a panel, the distance between two Products in a grid — is a multiple of that unit. The scale: **4, 8, 12, 16, 24, 32, 48, 64, 96, 128.** Nothing is spaced by an arbitrary value outside this progression; if a spacing need doesn't fit the scale, the scale is revisited deliberately, not quietly overridden for one component.

**Generous by default.** Where a choice exists between a tighter or a looser value from the scale, the editorial instinct — confidence expressed through whitespace — favors the looser one, especially around identity content (an Organization's name, a Story's headline, a hero image). Density is reserved specifically for information genuinely meant to be scanned quickly — a table, a size chart — never applied as a general default.

**Spacing scales with viewport, not just shrinks with it.** Mobile layouts use tighter values from the same scale (4–24 doing more of the work than 48–128), but the relationships between elements stay proportionally similar — a headline that sits far from the paragraph beneath it on desktop shouldn't suddenly sit close on mobile just because room is tighter. Where mobile genuinely needs less air, that's a deliberate scale-down, not compression born of neglect.

**Consistent internal rhythm within any repeating structure.** Every item in a list, a grid, or a table uses the same spacing value between itself and its neighbors — no visual "settling" where later items in a sequence drift from an established rhythm.

---

## Borders

**The border is the platform's primary structural device**, replacing shadow, background-color blocking, and heavy radius as the default way anything is separated from anything else. A panel, a table row, an input field, a section boundary — each is defined by a line, not by simulated depth or a rounded silhouette.

**One weight, two values.** A single border thickness is used everywhere a border appears — no thin-border-here, thick-border-there inconsistency. Two values of that same weight exist: a stronger one for a boundary meant to be clearly seen (a panel's edge, an input's resting state), and a quieter one for a subtler separation that shouldn't compete for attention (a divider inside a dense list, a table's internal row rules).

**Borders don't change on hover to imply elevation.** Where an interactive surface needs a hover or focus signal, the border's value shifts to the stronger of the two tones, or a background value shifts subtly — never a shadow appearing where there wasn't one, and never a glow.

**No decorative color in a border.** A border is always a neutral, structural value — never a brand color used purely to decorate an edge. Where a border does carry color intentionally, it's doing one of the platform's few functional jobs (marking a verified state, an error, a live moment), which is exactly why that use has to stay rare.

---

## Radius

**A single radius value across the entire platform, small enough to remove the harshness of a perfectly sharp digital corner without ever reading as "rounded."** This is not a scale of options — it's one decided value, applied uniformly to every rectangular surface: buttons, panels, inputs, images, dialogs, badges. Consistency here matters more than any single component's individual preference.

**No pill shapes, anywhere, for any reason.** A button, a badge, a tag — none of them use a fully-rounded, capsule silhouette. This is one of the clearest, most visible breaks from the platform's earlier direction, and it's non-negotiable precisely because a pill shape is the single most recognizable signature of the consumer-app register this system exists to move away from.

**Fully circular treatment is reserved for elements that are structurally circular** — a portrait or avatar, a small status indicator, an icon-only mark with no rectangular content inside it. A circle used here is a genuine circle, not a rectangle rounded until it happens to look like one.

**Radius never changes based on a component's size or context.** A large hero panel and a small inline badge use the exact same radius value. Scaling radius with size is a common instinct that quietly reintroduces inconsistency; this system holds the value fixed regardless of what it's applied to.

---

## Elevation

**Flat is the default and near-universal state.** No panel, button, image, badge, table, or resting piece of content casts a shadow or appears lifted above the page. Separation between adjacent elements comes from spacing and border, per the two sections above — never from simulated light.

**The one legitimate exception is content genuinely layered above the page** — a dialog, a dropdown menu, a toast notification — where something really is stacked on top of the interface beneath it and a fan needs that spatial relationship communicated honestly. Even there, the elevation is minimal and quiet: enough to read as "above," never a dramatic, deep shadow performing importance.

**No hover-elevation, anywhere, under any circumstance.** A panel or card that "lifts" toward the viewer on hover is the clearest possible violation of this system's flatness — retired entirely, including from any surface that currently uses it. Hover state is communicated by the border and background rules already defined above.

**Elevation is never used to indicate importance or hierarchy.** A featured Organization, a highlighted Collection, a primary action — none of these earn a shadow to stand out. They earn size, position, and typographic weight instead, exactly as the Editorial Design Language's visual principles require.

---

## Grid

**A twelve-column grid underlies every surface on the platform** — the Discovery Hub, a Storefront, a Story, a Product embedded in a contextual or broadcast surface — sharing the same column count, margin, and gutter logic rather than each page inventing its own layout math. This is what makes a component genuinely portable between contexts, not just visually similar between them.

**Margins and gutters scale by breakpoint; the column count does not.** A mobile layout collapses how many columns are visibly in use at once, but the underlying twelve-column logic stays the same system at every size — a component built and verified against the grid at one breakpoint behaves predictably at every other one.

**Full-bleed content is the deliberate, singular exception that breaks the grid's margins.** A hero image, a full-width Story photograph, a Campaign moment — these are allowed to extend edge to edge specifically because that's what a full-bleed editorial moment requires. Every other kind of content — text, panels, forms, contained imagery — respects the grid's margins without exception. The moment ordinary content is allowed to bleed "just this once," the grid stops meaning anything anywhere else.

**Alignment to the grid is mandatory for every component, including ones that feel like they should float free** — a badge, a small callout, a floating action. If something needs to sit outside the grid to work visually, that's a signal the surrounding layout needs rethinking, not that this component has an exception built in.

---

## Images

**Two distinct aspect-ratio treatments, used deliberately by context — never a single uniform ratio applied everywhere out of convenience.** Identity imagery (an Organization, a Team, an Athlete, a Story's lead photograph) uses generous, larger-format ratios — wide and cinematic for a hero moment, tall and portrait-oriented for an individual athlete — chosen to fit what the photograph is actually showing. Commerce imagery (a Product within a Collection or catalog grid) uses one single consistent ratio across any given grid, so a fan comparing items is comparing the products, not fighting inconsistent photography.

**No forced cropping to fit a container the image wasn't shot for.** The container is chosen to match the photograph's real composition, not the reverse. Where a genuine crop is unavoidable, it favors showing more of the original frame rather than tightening aggressively for a "cleaner" grid.

**No filters, gradients, or color treatments applied over photography.** An image is presented as captured. Where text must sit over an image for legibility, a flat, neutral, low-opacity scrim is used — and only exactly as much as legibility requires, never as a stylistic layer in its own right.

**Every image respects the flat, sharp geometry the rest of the system uses** — the platform's single radius value, no exceptions for "hero" treatment, no rounded photo frames pretending toward a softer register the rest of the page has already rejected.

---

# Components

## Buttons

**Three functional types, and only three: Primary, Secondary, and Text.** This replaces the current wider set of stylistic variants (a gradient treatment for try-on, a gold accent treatment, separate "light" variants for dark backgrounds) with a system organized by function, not occasion. A Primary button is a solid, high-contrast fill — the one action on a given view meant to stand out. A Secondary button is bordered, same weight as the surrounding structural borders, used for a real but lower-priority action. A Text button carries no fill or border at all — a label alone, used for the lowest-emphasis actions, like a link.

**A Primary button is not entitled to more than one appearance per meaningful view.** Where a page has several actions, only one is Primary; the rest are Secondary or Text. This is the direct visual enforcement of "editorial hierarchy over commercial hierarchy" — a page doesn't get to make everything feel equally urgent.

**No gradient, no shadow, no scale-bounce on press.** A button's state changes — hover, active, focus, disabled — are communicated through the same border-weight and background-value shifts defined in Foundations, never through elevation, color transition effects, or a physical "press" animation. Disabled state reduces contrast rather than removing color identity entirely, so a disabled action is still legible as what it is.

**A button's label is always visible text.** An icon-only button still carries an accessible label even where the visible label is condensed or omitted for space — an icon alone is a comprehension risk this system doesn't accept for the sake of compactness.

**The try-on action uses the same Primary treatment as any other primary action on its page — no bespoke gradient identity of its own.** Consistency of system, per the Editorial Design Language's Component Philosophy, matters more than giving any single feature its own visual signature.

---

## Panels *(replaces "Card")*

**"Card" is retired as a concept, not just a name.** A card implies an object floating above a page on its own simulated light; a panel is a bounded region that belongs to the page it's on, flush within the grid, with no independent physical presence of its own. The rename is the point — it corrects the actual mental model, not just the label.

**One panel treatment, not several.** The current split between a lightly-bordered variant and a shadow-elevated variant collapses into a single, consistent Panel: a flat surface, bordered at the structural border value, radius matching the platform's single value, no shadow at rest or on hover. A Panel used to group admin statistics and a Panel used to present a Story preview are visually the same kind of object — what differs between them is their content and their size on the grid, never their underlying treatment.

**A Panel is a vessel, not a decorated object.** It exists to hold and frame content — an Organization's summary, a Product's detail, a report's figures — clearly and predictably. Nothing about a Panel's own styling should compete with what's inside it for a fan's attention.

**An interactive Panel (one that leads somewhere on click) is visually identical to a non-interactive one at rest**, distinguished only by cursor affordance and a focus/hover state that shifts border weight or background value — never by an elevation change implying it's "clickable because it floats."

**Panels align to the grid at every size**, from a small stat panel to a full-width Story panel — no panel is ever positioned or sized outside the shared grid logic defined in Foundations.

---

## Inputs

**A rectangular, bordered field, matching the platform's single radius value — never a filled, borderless, or heavily rounded treatment.** An input's boundary is a border, consistent with every other structural boundary on the platform, not a background-color block pretending to be one.

**A label is always visible above the field, permanently — never a placeholder standing in for a label.** A placeholder disappears the moment a fan starts typing, which is exactly the moment a label is often still needed for confidence or comparison; using one to do the other's job is a legibility and trust failure, however common the pattern is elsewhere.

**Focus state is a border change, not a glow.** The border shifts to its stronger structural value on focus — no soft halo, no colored ring extending beyond the field's own edge. This keeps focus indication consistent with how every other interactive state on the platform is communicated: through the border, never through simulated light.

**Helper text and error text are set plainly below the field, in the platform's label-voice type, and never communicated by color alone.** An error state changes the border's value and adds a specific, calmly-worded line explaining what's wrong — color reinforces the message, it never carries the message by itself.

**Placeholder text, where genuinely useful as an example rather than a label substitute, is visually quieter than real input content** — clearly a hint, never mistakable for an already-filled value.

---

## Forms

**A form reads top to bottom in one deliberate sequence, single-column by default.** This mirrors how the rest of the platform is read — an editorial, linear order — rather than a dense, multi-column data-entry layout optimized purely for screen-space efficiency. Two fields share a row only where they're genuinely one unit a fan thinks of together (a city and a postal code), never as a general space-saving device.

**Fields are grouped under a clear, quietly-labeled section heading wherever a form covers more than one real topic** (contact information, then delivery details, then payment) — using the platform's label-voice type and the generous spacing Foundations already establishes between groups, so a long form still reads as considered stages rather than one undifferentiated block.

**Validation is calm, specific, and immediate — not decorative.** An error is stated as a fact about what's needed, not dramatized with color saturation, motion, or alarmist language. This is the same "truth, not pressure" instinct the Commerce Philosophy applies to availability, applied here to form correctness.

**A submitting form communicates its own state without losing its own layout.** The submit action's label and position stay legible and stable; a loading indicator (per the Loading section below) is added to or near it, never swapped in as an ambiguous, content-replacing spinner that leaves a fan unsure what's actually happening.

---

## Navigation

**Minimal, quiet, and positioned to recede — never a dense taxonomy competing with the content it sits above.** Global navigation carries only what the Information Architecture already specifies as essential (a route to Discovery, Search, a personalized shortcut to Favorited Organizations, account and cart) — no sport-and-category mega-menu, no exhaustive browse structure competing for the same visual weight.

**Current/active state is a structural marker, not a colored block.** A navigation item's active state is communicated by a weight change or an underline — consistent with how the rest of the system marks emphasis through type rather than through fill color or a pill-shaped highlight.

**Mobile navigation carries the same restraint under tighter space, not less of it.** Search and the personalized Favorites shortcut get real visual priority; a general "browse everything" entry point is present but deliberately not given equal weight, exactly as the Information Architecture already specifies — this document's job is making sure that priority is visible, not just structurally true.

**A breadcrumb is set with the same confident, structural type as a section label — not small, gray, or easy to miss.** Its job, per the Information Architecture, is telling a fan whose thing they're looking at; it has to be legible enough at a glance to actually do that, carrying identity lineage rather than a category path.

**Implemented site header (2026-08-01):** The global header is two independent bordered boxes (`bg-white`, `border.width` on `ink.900`, `radius.default`) — a logo/menu cluster and a cart control — with real transparent space between them, not one continuous bar. There is no persistent, always-visible link row anywhere on the site: on the home hero, the full nav (Shop plus the sport links) renders as plain text directly over the hero image and collapses into a small panel attached to the logo box the moment the fan scrolls (or on any page that isn't home); everywhere else, that same small attached panel opens on tap from the hamburger cell in the logo box. It is never a full-height slide-in drawer — account access, sign-in/out, and the sport links all live in that one small panel. This directly supersedes this document's original abstract "minimal, quiet, positioned to recede" framing above with the actual concrete shape that took: two boxes, one small attached panel, zero pill shapes, zero blur.

---

## Tables

**A table reads like a printed ledger or an archive index — clean horizontal rules between rows, no zebra-striping, no shadowed container.** Rows are separated by the Foundations' quieter border value; the table as a whole sits inside a single bordered Panel, flat and consistent with every other structural surface on the platform.

**Row height is generous enough to read comfortably, not compressed for maximum density.** Legibility over density is the same instinct Typography already applies to body copy, extended here to tabular data.

**Numeric columns are right-aligned and set with consistent figure widths so values actually line up down the column** — a small rule with an outsized effect on whether a table feels carefully made or merely dumped onto the page.

**A header row is distinguished by type — the platform's label-voice, small and deliberately spaced — never by a filled background color block.** The header's authority comes from its typographic treatment, consistent with how the rest of the system creates hierarchy through type rather than color.

**No row is ever elevated, bordered differently, or otherwise decorated to draw attention** — including a "highlighted" or "featured" row. Where a specific row genuinely needs emphasis, that's a type-weight or icon-based signal, never a background color applied to single out one row from its neighbors.

---

## Badges

**A badge is a structural label carrying real, specific meaning — never a colorful sticker applied for visual variety.** The default badge treatment is neutral: a bordered, unfilled label set in the platform's label-voice type, radius matching the platform's single value, no pill shape.

**Color-filled badges are reserved exclusively for the platform's short, functional list: verified status, a genuinely live or urgent state, and an error or warning.** A general category tag, a "New" flag, or a decorative status marker uses the neutral treatment, not a color pulled in purely to make it stand out. This directly enforces the Editorial Design Language's rule that trust and status signals are structural, never decorative — a badge earns color by doing real functional work, not by needing to be noticed.

**A badge never appears alone as the sole carrier of its meaning.** Verification status, in particular, is paired with a short label stating what it means — never a colored dot or icon a fan has to already know how to interpret.

---

## Dialogs

**A dialog is the one place in this system where a boundary is communicated by more than a border — because it's the one place content is genuinely, physically layered above everything else.** A dimmed, flat scrim separates the dialog from the page behind it, and the dialog surface itself carries the minimal elevation Foundations already permits for real overlay content — quiet enough not to feel like a dramatic departure from the platform's otherwise-flat register.

**Everything inside a dialog follows the same typographic, spacing, and component rules as the rest of the platform.** A dialog is not a different, denser, more utilitarian register than the page it interrupted — its heading, body copy, and any buttons inside it are set exactly as they would be anywhere else.

**Radius and border match the platform's single values.** A dialog's corners and edges are not treated as a special case — consistency here is what keeps a dialog feeling like part of the same considered system, not a bolted-on utility window.

**Dialog motion is quick and minimal — an appearance and a dismissal, not a performance.** No bounce, no spring overshoot, no lingering entrance. This matches the Motion Philosophy's restraint exactly: the dialog's job is to be understood immediately, not to be enjoyed arriving.

**A confirmation for a destructive action states the consequence plainly, in ordinary body-voice type.** The specific destructive action's own button may use the platform's narrow, functional error color — nothing else in the dialog is dramatized to match it.

---

## Empty States

**An empty state is a genuine, calm editorial moment — not an apology and not a joke.** Copy states plainly what's true ("No products match these filters") rather than reaching for exaggerated cheerfulness or self-deprecating humor to soften the moment. The platform's overall seriousness extends to the moments when it has nothing to show, not just the moments when it does.

**Any icon or mark used is minimal and linear, matching the platform's restrained visual register — never a large, colorful illustration.** An empty state doesn't need decoration to feel complete; a well-set headline and a clear next step do that job.

**Where an action is offered, it uses the platform's standard button treatment — no special, more prominent styling reserved just for empty-state recovery.** An empty state's call to action is a normal Primary or Secondary button, positioned and weighted like any other, not inflated to compensate for the page otherwise having nothing on it.

---

## Loading

**A loading state communicates truthfully that something is genuinely in progress — it never performs effort to seem more alive or more responsive than the platform actually is.** This is Motion Philosophy's core rule ("motion explains; it never performs") applied specifically to waiting.

**Where the eventual content's shape is known, a structural placeholder that previews that shape is preferred over a generic spinner.** Previewing real structure is more honest and more informative than an undifferentiated "please wait" signal — a fan can see roughly what's coming, not just that something eventually will.

**Where a simple indicator is used instead, it's quiet and minimal — never a branded or decorative animation drawing attention to the wait itself.** The goal of a loading indicator is to be barely noticed while still being reassuring that nothing has stalled, not to fill the waiting moment with its own visual interest.

**Loading state is scoped to exactly the region that's actually waiting**, never the whole page by default. The rest of an already-loaded page stays fully composed and legible while a specific panel, table, or image catches up — consistent with the editorial rhythm of a page never feeling like it's been reduced to one undifferentiated state.

**No loading indicator implies false progress.** A progress bar or percentage is only ever shown where real, measurable progress exists behind it — an indeterminate wait is shown as indeterminate, honestly, rather than dressed up with a number that isn't really tracking anything.

---

## How this specification is meant to be used

Every value and rule above is a decision, not a suggestion — the same discipline the rest of this document series already holds itself to. Where a future component's real requirement seems to need an exception (a new radius, a new elevation case, a new button variant), that exception gets named and reasoned through explicitly against the Editorial Design Language first, the same way any other deliberate departure from a standing rule in this series is handled — never adopted quietly because it was convenient for one screen.
