# PusoStore Design Tokens

**Version 1.0**

The **Editorial Design Language** explains why. The **Design System** decides the rules. This document is the layer beneath both: the actual named, valued primitives an implementation reaches for — a specific color, a specific scale step, a specific duration — each one traceable back to a rule in the Design System and, through it, to a principle in the Editorial Design Language. Nothing here exists without a reason stated next to it.

**This is a token dictionary, not a stylesheet.** Every entry is a name, a value, and a rationale — never a selector, a property, or a function. What technology eventually consumes these values (CSS custom properties, a theme object, a Figma library, a native platform's own token format) is an implementation decision this document deliberately doesn't make. A token here should be exactly as usable translated into any of those as into any other.

**Naming breaks deliberately from the system it replaces.** The current tokens — `primary`/`secondary`/`accent`, each a numbered 50–900 scale — are a generic, pre-built naming convention borrowed wholesale from a Tailwind starter template, and the naming itself is part of what made the platform feel generic, independent of the actual color values chosen. The tokens below are named for what they *are* in an editorial system — ink, paper, a reading measure, a beat of rhythm — because a name is not neutral. It's the first thing anyone extending this system reads, and it should already sound like this platform, not like every other one built on the same starter kit.

---

## Colors

**The palette is small on purpose.** A short, deliberate list of colors is easier to keep disciplined than a large one, and discipline — not a specific hue — is the actual point of this section, per the Editorial Design Language's rule that the platform's own palette recedes so an institution's colors can lead.

### Ink and paper — the structural neutrals

| Token | Value | Why it exists |
|---|---|---|
| `ink.900` | `#0E0E0E` | Primary text and the platform's strongest surface value. Deliberately not pure black — a true `#000000` against a true white creates a harsh optical vibration that considered print typography has avoided for centuries. A soft near-black is legible without the harshness. |
| `ink.700` | `#3A3A3A` | Secondary text, and the "strong" border value referenced throughout the Design System — used wherever a boundary needs to be clearly seen. |
| `ink.500` | `#767676` | Tertiary text, placeholder content, and disabled-state labeling — present but deliberately quieter, never used for anything a fan needs to read with confidence. |
| `ink.200` | `#E4E4E2` | The "quiet" border value — internal table rules, subtle dividers, anything that needs to separate without drawing attention to itself. |
| `paper.000` | `#FAFAF8` | The platform's base surface. A warm, slightly-off white rather than a stark `#FFFFFF` — the same reasoning as `ink.900` in reverse, and a deliberate echo of an actual printed page rather than a screen's default white. |

### Institution — the reserved slot, not a fixed value

| Token | Value | Why it exists |
|---|---|---|
| `institution.identity` | *Not defined here — supplied per Organization* | This is the one token in the system whose value is intentionally left open. Per the Editorial Design Language, an Organization's own color is what should actually register on its own pages — this token exists to name *where* that color is allowed to appear (an identity accent within that Organization's own Storefront, never inside the platform's own neutral chrome) without PusoStore ever assigning it a platform-wide value of its own. |

### Signal — the only saturated colors on the platform

| Token | Value | Why it exists |
|---|---|---|
| `signal.verified` | `#2F5D46` | A muted, deep green — closer to an institutional seal or an accreditation mark than a bright "success" green. Used exclusively for Trust & Verification status. Deliberately restrained: this color is making a real claim about legitimacy, and a loud color would undercut the seriousness of that claim. |
| `signal.live` | `#B5762A` | A muted amber. Used exclusively for something genuinely live or time-bound right now — a running Drop, an active Campaign. Warm enough to register as "happening now," restrained enough to never read as alarm. |
| `signal.error` | `#8C2F2C` | A muted brick red, deliberately distinct from any color a national or institutional identity on this platform is likely to already use — it needed to be unambiguously the platform's own functional signal, never mistakable for an Organization's brand color appearing where it doesn't belong. Used exclusively for errors and destructive actions. |

### Merch — a narrow, functional exception for commerce labels

| Token | Value | Why it exists |
|---|---|---|
| `merch.sale` | `#6B4E71` | A muted plum. Used exclusively for a "Sale" label on a Product. |
| `merch.tryon` | `#2E6B7A` | A muted teal. Used exclusively for a "Virtual Try-On" label on a Product. |
| `merch.new` | `#3D5A80` | A muted steel blue. Used exclusively for a "New" label — computed from a Product's actual `createdAt` against a fixed recency window, never set manually, so the label stays honest as time passes. |

Added after checking a real migrated page (Products) against real reference: a fully neutral badge treatment made "Sale" and "Try-On" — genuinely meaningful, frequently-scanned commerce states — hard to distinguish from decorative noise at a glance. These pass the same "color is meaning" test `signal.*` is held to (each is a fixed, repeatable, functionally real state, never applied decoratively), but use deliberately different hues from `signal.verified`/`live`/`error` so a merchandising label can never be mistaken for a Trust or urgency signal. This category is scoped to exactly these three labels — it is not a general-purpose accent palette, and a fourth label doesn't get added here without the same naming discipline the rest of this document already requires.

**No other color token exists.** Every other value on the platform is one of the five neutrals above, an Organization's own reserved `institution.identity` slot, one of the three signal colors, or one of the three merch colors — nothing is added to this list without naming, specifically, which of those categories it belongs to and why the existing set doesn't already cover it.

---

## Spacing

**One base unit — 4 — and every spacing token is a deliberate multiple of it.** A single progression, used everywhere, is what keeps the platform's rhythm feeling authored rather than assembled from whatever gap felt right in the moment.

| Token | Value (× base unit) | Typical use | Why it exists |
|---|---|---|---|
| `space.1` | 4 | Tightest internal spacing — inside a compact label, between an icon and its text | The smallest deliberate gap the system allows; below this, two things read as touching. |
| `space.2` | 8 | Between closely related inline elements | |
| `space.3` | 12 | Internal padding for compact components | |
| `space.4` | 16 | Standard internal padding, the platform's default "comfortable" gap | The most frequently used step — the system's baseline unit of comfortable separation. |
| `space.5` | 24 | Between related but distinct elements — a label and its field, a heading and its immediate body copy | |
| `space.6` | 32 | Between components within the same structural group | |
| `space.7` | 48 | Between distinct groups within a section | |
| `space.8` | 64 | Around major structural regions | |
| `space.9` | 96 | The beginning of macro, page-rhythm spacing — see Section Spacing below | |
| `space.10` | 128 | The largest deliberate gap on the platform, reserved for the most dramatic pauses in a page's rhythm | Exists as a ceiling, specifically so nothing on the platform ever needs a value larger than this — if something does, the scale itself needs revisiting, not a one-off exception. |

---

## Radius

| Token | Value | Why it exists |
|---|---|---|
| `radius.none` | 0 | For anything that's structurally a line, not a surface — a table's internal rule, a simple divider. A rounded end on a line reads as an error, not a choice. |
| `radius.default` | 0 | The single radius value applied to every rectangular surface on the platform — buttons, panels, inputs, images, dialogs, badges. Revised from an initial value of 2 after checking a real migrated page against real reference: even a 2-unit softening still read as "rounded" at card and button scale, not sharp. A true 0 is the platform's clearest, most deliberate break from its previous, heavily-rounded direction — one value, applied everywhere, instead of a scale of increasingly soft options. |
| `radius.circular` | round (a true circle/oval, not a large numeric radius) | Reserved exclusively for elements that are structurally circular — a portrait, an avatar, a small status mark. Named separately from `radius.default` specifically so no one is tempted to reach for "a bigger number" on the same scale to approximate a circle; a circle here is never a rectangle rounded until it happens to look like one. |

**No token exists between `radius.default` and `radius.circular`.** That gap is deliberate — the entire "increasingly soft corner" scale common to most component libraries (a small radius, a medium radius, a large radius, a pill) is exactly the vocabulary this platform is refusing to speak.

---

## Border Width

| Token | Value | Why it exists |
|---|---|---|
| `border.width` | 2 | The single border weight used everywhere on the platform. Revised from an initial value of 1 (hairline) after real usage on the Products page — with radius at a true 0 and shadow retired entirely, the border is doing all of the platform's structural-separation work, and at that load a hairline read as thin rather than deliberate. Borders are the platform's primary structural device, replacing shadow and background-fill as the default way anything is separated from anything else — and a system asking a border to do that much work needs exactly one weight, applied with total consistency, or the eye starts reading inconsistent weights as meaningful when they aren't. |

**Border color, not border width, is what varies.** Where a boundary needs to read as stronger or quieter, that distinction is made with `ink.700` versus `ink.200` from the Colors section above — never by thickening the line itself. This keeps the single most-used structural device on the platform behaving predictably everywhere it appears.

---

## Elevation

| Token | Value | Why it exists |
|---|---|---|
| `elevation.none` | No shadow | The default state for everything on the platform — every panel, button, image, badge, and table. Flatness is not the absence of a decision here; it's the decision, made once, applied to nearly the entire interface. |
| `elevation.overlay` | A small, tightly-contained shadow: short vertical offset, moderate blur, low opacity, in `ink.900` | The one legitimate exception — reserved exclusively for content genuinely layered above the page: a dialog, a dropdown, a toast. Even here the value stays deliberately subtle — just enough to read as "above," never a dramatic shadow performing importance the way the platform's earlier direction used shadow on nearly every card. |

**No token exists for a hover-elevation change.** A surface that "lifts" on interaction — a common pattern in the system this replaces — has no token here at all, on purpose; that interaction state is handled entirely through the Colors section's border and surface values instead.

---

## Typography Scale

**Six steps, each with one clear job — not a dense, general-purpose scale offering a size for every possible situation.** Per the Editorial Design Language's typography philosophy, a confident system speaks in a small number of clear voices, used consistently, rather than inventing a new size for every new context.

| Token | Relative size (base = 1) | Role | Why it exists |
|---|---|---|---|
| `type.caption` | 0.75× | Fine print, timestamps, the smallest helper text | The floor of the scale — used sparingly, for information that's genuinely secondary to everything around it. |
| `type.label` | 0.8125× | Structural labels — section eyebrows, table headers, badges, button text | Distinguished from caption not by size alone but by role: a label is a structural marker, almost always paired with wide letter-spacing, never body prose. |
| `type.body` | 1× (the platform's base reading size) | Story content, descriptions, anything meant to be read at length | Every other step in this scale is defined relative to this one — it's the platform's actual reading size, and every other size exists to either support or elevate above it. |
| `type.title` | 1.5× | Panel and card headings, sub-section titles | |
| `type.headline` | 2.5× | Section headlines, Story titles, Collection names | |
| `type.display` | 4.5× (scaling larger still on wide viewports, for genuine hero moments) | An Organization's name, a masthead-level identity moment, a page's single largest statement | The scale's ceiling, reserved for the rare moment a page needs to say one thing at true editorial scale — an Organization's name presented the way a masthead presents a publication's own name, not a headline competing with everything around it. |

**No step exists between `type.body` and `type.title`, or beyond `type.display`.** Gaps in the scale are as deliberate as the steps themselves — a scale with a size for every possible in-between need stops being a disciplined hierarchy and starts being an unlimited menu.

---

## Container Widths

| Token | Value | Why it exists |
|---|---|---|
| `container.reading` | A narrow measure, roughly 40 units of the base spacing scale wide | Reserved for long-form content — a Story, an Organization's narrative, a policy page — sized specifically to keep a line of text at a comfortable reading length. Editorial typesetting has always known that a line of text can be too wide to read comfortably; this token exists so that knowledge is respected everywhere prose appears. |
| `container.grid` | A wide measure, aligned to the outer edge of the platform's twelve-column grid | The standard container for browsing and structured surfaces — a Collection, a Discovery Hub, an admin table. Every grid-based layout on the platform shares this one outer bound, which is what keeps a component built for one grid-based page behaving identically on another. |
| `container.full` | No constraint — edge to edge | Not really a "width" so much as the deliberate absence of one, reserved exclusively for full-bleed identity moments — a hero image, a Story's lead photograph. Naming it as a token, rather than treating it as just "no container," keeps it a conscious choice every time it's reached for, not a default anyone can fall back on casually. |

---

## Section Spacing

**A distinct naming layer over the top of the base Spacing scale — not a new set of numbers, a new set of *meanings*.** Section Spacing governs the macro rhythm between major beats of a page (per Editorial Rhythm), which is a conceptually different job from Spacing's micro job of separating elements within one component — even where, today, the actual values happen to overlap.

| Token | Maps to | Typical use | Why it exists |
|---|---|---|---|
| `section.compact` | `space.7` (48) | Between two closely related beats — a headline and the structured content that immediately elaborates on it | |
| `section.default` | `space.9` (96) | The platform's standard pause between one editorial beat and the next — an identity moment giving way to structured detail, or one Collection giving way to another | The most common section transition on the platform, and the value most responsible for the page actually feeling like it's breathing rather than being packed. |
| `section.dramatic` | `space.10` (128) | The single largest pause on a page — after a full-bleed hero moment, before the page returns to structure | Reserved for the platform's most deliberate rhythm break, used sparingly enough that it still reads as a real pause each time. |

**Naming these separately from the base scale matters even though the values currently match**, because it lets the platform's macro rhythm be tuned on its own later — widening the pause between sections without touching `space.7`–`space.10`, which every smaller component also depends on.

---

## Motion

**A short, named inventory of what's allowed to move — not a general capability every component can reach for.** Per the Editorial Design Language, motion explains a real state change; it never performs. This section names the *only* categories of motion that exist on the platform.

| Token | Covers | Why it exists |
|---|---|---|
| `motion.state` | A border, background, or type-weight change signaling hover, focus, active, or selection | The most common motion on the platform — small, quick, and directly tied to something a fan just did. |
| `motion.overlay` | A dialog, dropdown, or toast appearing and dismissing | Reserved for genuine overlay content, matching `elevation.overlay`'s reasoning — these are the moments something real appears above the page, and that transition deserves to be smooth without being a performance. |
| `motion.loading` | A quiet, indeterminate indicator, or a skeleton placeholder resolving into real content | Communicates that a wait is genuinely happening — never dressed up to seem more alive than the wait actually is. |

**No token exists for scroll-triggered entrance animation, decorative looping motion, or any effect not directly tied to one of the three categories above.** This is a deliberate, permanent absence, not an oversight — the platform's earlier direction used broad entrance animation across nearly every section, and the lack of a token for it here is the specification's way of closing that door rather than leaving it quietly open.

---

## Timing

| Token | Value | Why it exists |
|---|---|---|
| `timing.instant` | ~100ms | For `motion.state` — small, immediate feedback that should feel like a direct extension of the fan's own action, not a separate event happening after it. |
| `timing.quick` | ~180ms | For `motion.overlay` and `motion.loading` transitions — fast enough to never feel like a wait in its own right, slow enough to still register as a smooth, intentional change rather than an abrupt cut. |

**No duration on the platform exceeds `timing.quick`.** There is no "slow" or "dramatic" timing tier, on purpose — a system this restrained doesn't ask a fan to wait through an elaborate transition to see what it already decided to show them.

---

## Easing

| Token | Value | Why it exists |
|---|---|---|
| `ease.standard` | A quick, symmetric deceleration — fast to start, smooth and complete to settle, with no bounce and no overshoot | The default curve for nearly everything that moves on the platform. A curve with any spring, bounce, or overshoot borrows a playful, consumer-app character this system has deliberately moved away from — `ease.standard` arrives and settles the way a considered, confident interface should, without any extra flourish on the way. |
| `ease.linear` | A constant, unchanging rate of change | Reserved for the rare case of communicating genuine, measurable progress — a real loading percentage, for instance — where a constant rate is the honest representation of steady, ongoing progress. Used anywhere else, a linear curve feels mechanical; used here, specifically, it's the truthful choice. |

**No other easing curve exists.** Two curves, each doing one clearly-defined job, is the complete set — consistent with every other section in this document choosing a short, deliberate list over a flexible one.

---

## How these tokens relate to everything above them

Every token in this document exists because a rule in the **Design System** required a real value, and every one of those rules exists because a principle in the **Editorial Design Language** required that rule. Reading upward — a token to the rule that demanded it, a rule to the principle that demanded that — should always be possible. A future token that can't be traced that way isn't a gap in this document; it's a sign the token doesn't belong yet, and the right next step is asking which rule actually needs it, not adding it to keep a component moving.
