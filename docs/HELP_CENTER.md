# Staff Help Center — Maintenance

The Help Center (`/admin/help`) is an internal, staff-only onboarding and how-to guide. This document is for developers updating its content — the help center's own articles are the end-user-facing documentation, not this file.

## Why there's no CMS for this

CLAUDE.md's CMS-first rule ("Business content must never be hardcoded") governs *customer- and marketing-facing* content — homepage, footer, FAQ, nav labels, and the rest of the list in `CLAUDE.md`'s "CMS-First Rule" section. The Help Center is neither: it's internal staff documentation, maintained by developers through normal code review, the same way `AGENTS.md` and this very file are. Building a six-layer CMS model (Prisma model, repository, admin CRUD API, admin editor page) for ~35 short articles would be the "elaborate documentation CMS" the original task explicitly said to avoid building unless one already exists. One doesn't.

## Where the content lives

`backend/data/helpCenterContent.js` exports two arrays:

- `HELP_CATEGORIES` — the topic groups shown in the sidebar/chips.
- `HELP_ARTICLES` — each article: `slug`, `categoryId`, `title`, `summary`, `keywords`, `departments` (informational tags for "relevant to you" filtering — **not** an access gate), `sourceRef`, `verified`, an optional `correction`, and `body` (an array of typed blocks — see the file's own header comment for the exact block shapes: `p`, `steps`, `list`, `note`, `warning`, `image`).

`backend/routes/help.js` serves this over `/api/admin/help`, gated by `authenticate` + `isAdmin` only — **no `requirePermission()` call anywhere in that file, on purpose.** Every legitimate staff account, regardless of department, can read every article — the same access model as the Dashboard itself. Content is never shipped in the frontend bundle; it's fetched from this admin-gated API, so the backend/data boundary is the real enforcement, not just the hidden nav link or the `/admin/help` React route (which also carries no permission gate, to match).

To add, edit, or remove an article: edit `helpCenterContent.js` directly and open a PR, same as any other code change. There is intentionally no admin UI to create or edit articles.

## Content source and discrepancy policy

The canonical external source is the **"Puso Shop — Staff Training Guide"** Google Doc (a 79-page staff training guide; last updated September 2026). When reproducing its instructions:

- Use its exact terminology and button/field labels unless the live implementation has since changed — in that case, follow the live implementation and say so.
- Mark an article `verified: true` once its claims have been checked against the actual route/permission/schema code (not just the source doc), and set `correction` to a one-sentence note of what was stale and why, if anything was.
- An article not yet independently re-derived from code stays `verified: false` and should faithfully reproduce the source doc's own wording — don't silently "fix" a claim you haven't actually checked against the code.
- Never present an unconfirmed operational detail (e.g. an external provider's exact procedure) as settled fact — say it's unconfirmed, the same way `docs/REFUNDS_RUNBOOK.md` does.

If the source Google Doc is updated later, re-diff it against `helpCenterContent.js` by hand — there's no automated sync.

## Screenshots

Each article's `body` can include `{ type: 'image', src, alt }` blocks. `src` is `null` until a real screenshot has been extracted from the source PDF/Doc and placed under `frontend/public/help/images/`; both `AdminHelpArticle.jsx`'s renderer and this content file's own contract require rendering **nothing** (never a broken `<img>`, never an unrelated placeholder) when `src` is `null`. Do not fabricate a screenshot — leave the block's `src` as `null` until a real one is extracted.
