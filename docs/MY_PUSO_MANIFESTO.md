# The My PUSO Manifesto

**Version 1.0**

This document defines what My PUSO — the customer portal — is, and what it is deliberately not. It is the guiding philosophy for all Customer Portal work going forward. Every feature proposed for My PUSO must pass the test in §7 before it ships, regardless of how useful it might be as a feature somewhere else.

This document does not describe pages, routes, or components. Those are downstream decisions, made once against this philosophy, not the other way around.

---

## 1. What My PUSO Is

My PUSO is the personal home every Filipino sports fan returns to inside PusoStore — not a feature of the store, but the thing the store exists to serve. Every jersey worn, every Fit Check generated, every school and team followed becomes part of one continuous, growing record: this fan's life in Philippine sports.

The store sells merchandise. My PUSO holds a life.

---

## 2. What My PUSO Is Not

- An account page with a nicer name.
- Order history, dressed up as a dashboard.
- A loyalty widget bolted onto checkout.
- A place fans visit only when something's wrong.
- Organized by data type — orders, wishlist, notifications — instead of by a fan's actual life: what's new, what's mine, who I follow, what I'm becoming part of.

---

## 3. The One Question

Every module, every feature, every future addition must answer honestly:

**"What would make this customer come back tomorrow?"**

If the answer is nothing, it doesn't belong in My PUSO — no matter how useful it is elsewhere.

---

## 4. Why Fans Return

Not because they need something. Because something changed. A shipped order. A finished Fit Check. A school's new drop. A followed team's announcement. A wishlist item on sale. My PUSO is never static — and on the rare visit where nothing has genuinely changed, it still surfaces something worth seeing: a moment from Philippine sports, never a blank dashboard that reads as "you haven't done anything yet."

---

## 5. What Fans Should Feel

- **Proud** — their fandom has a real, permanent home, not a folder buried in a menu.
- **Recognized** — My PUSO remembers who they support, not just what they bought.
- **Connected** — following a school or team creates real updates, never a checkbox.
- **Part of it** — Philippine sports is the subject. PusoStore is just where it lives.

---

## 6. The Core Concepts

Four ideas replace what would otherwise be a settings page with nine equal tabs:

- **Home** — not a dashboard. A living feed of what changed since the fan's last visit.
- **Locker** — not purchase history. A fan's growing personal collection: merchandise today; tickets, memberships, digital collectibles, and rewards tomorrow — the same locker, always.
- **Fit Check** — not "AI Try-On" buried in account settings. The platform's most personal, most shareable feature, treated as identity, not utility.
- **Following** — not organization management. The mechanism that makes fandom, not shopping, the reason to come back.

Settings still exists. It stays exactly where utility belongs: out of the way, one tap from the avatar, never competing with the four ideas above.

### Why these names, specifically

**Locker, not Purchases.** A purchase is a transaction, closed the moment it ships. A locker is personal, lived-in, and always growing — exactly the shape PusoStore's commerce architecture already committed to: Commerce Item was built category-agnostic from day one specifically so Tickets, Experiences, Equipment, and Membership could join Merchandise later without a rebuild (see CLAUDE.md § Extension Points, Decision Log ADR-003). Locker is what that decision looks like from the fan's side.

**Fit Check, not "AI Try-On" buried in Account.** A feature a fan uses to see themselves in a jersey isn't a utility — it's self-expression. It earns a name as memorable as the products it shows, and a place inside a fan's identity, not a tab inside settings.

**Following, not Organizations.** The platform's own domain model already names this correctly: a Favorite is identity, not purchase intent (CLAUDE.md § Terminology). Following makes that real — a fan supports Ateneo, or UAAP, or Gilas Pilipinas the same way they'd follow them anywhere else, and My PUSO listens for what happens next. This is the one mechanism that gives fans a reason to return that has nothing to do with buying anything.

---

## 7. The Test for Every Future Feature

Before anything ships inside My PUSO, it answers three questions honestly:

1. Does this give the fan a reason to come back tomorrow?
2. Does it fit inside Home, Locker, Fit Check, or Following — without inventing a fifth concept?
3. Does it treat the fan as a supporter of Philippine sports first, and a customer second?

If any answer is no, it doesn't ship inside My PUSO — even if it would be a perfectly good feature somewhere else.

---

## 8. The Five-Year Test

Every principle above must survive hundreds of purchases, thousands of Fit Check generations, multiple memberships, season tickets, rewards, digital collectibles, and dozens of followed organizations — without a redesign.

That's not a hope. It's already how the platform's commerce layer is built: one category-agnostic Commerce Item, one Fulfillment pattern per category, one recurring-payment capability away from Membership becoming real (CLAUDE.md § Extension Points). My PUSO's job is to be the one place all of it lives, in a shape that never has to change to fit what's added to it.
