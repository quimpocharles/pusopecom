# Refunds Runbook — Manual Completion, Reconciliation, and Release

This runbook is the operator-facing counterpart to **ADR-012** (`docs/decisions/0000-decision-log.md`). ADR-012 explains *why* refunds are recorded rather than initiated; this document explains *how staff operate it, how it is released, and what to do when something is off*. Where a rule is a domain rule, it lives in `docs/COMMERCE_ENGINE.md` (the coordinated reversal: inventory, payment, fulfillment) and is referenced here, not restated.

Everything below was verified against the implementation. Items that depend on the payment provider are marked **UNCONFIRMED** and must not be treated as fact.

---

## 1. The model in one paragraph

ePayGames is the platform's only integrated payment gateway and exposes **no automated refund/reversal API**. A refund is therefore always completed **out-of-band** by staff and then **recorded** in the application. Recording never moves money and never changes the refund amount; it confirms an amount already sent, completes the related Order/Return/Shipment/Pass lifecycle, and writes an audit event. Amounts are corrected *before* payment through an adjustment action.

Endpoints (admin-only; the first four are `backend/routes/refunds.js`, the last row is `backend/routes/returns.js`):

| Action | Endpoint | Permission | Allowed from |
| --- | --- | --- | --- |
| List / view refunds | `GET /api/admin/refunds`, `GET /api/admin/refunds/:id` | `returns.view` **or** `refunds.view` | — |
| Record an externally completed refund | `POST /api/admin/refunds/:id/record` | `refunds.manage` | `pending`, `failed` |
| Adjust a refund amount | `POST /api/admin/refunds/:id/adjust` | `refunds.manage` | `pending`, `failed` |
| List / view return requests (the queue `/admin/returns` actually renders from) | `GET /api/admin/returns`, `GET /api/admin/returns/:id` | `returns.view` **or** `refunds.view` | — |

A Finance-only account (`refunds.manage`, which implies `refunds.view`, without `returns.view`) needs **both** this last row and the refunds rows above — the frontend route (`/admin/returns`) reaching `refunds.view`-or-better is not enough by itself if the return-queue data endpoints it calls still required `returns.view` only. Both were aligned together; verify the pair stays in sync if either route's permission changes again.

---

## 2. Manual ePayGames refund procedure

Refunds are reachable from **Admin → Returns & Refunds** (`/admin/returns`). Staff responsibilities, in order:

1. **Complete the refund with the provider first.** How ePayGames actually returns money (dashboard, ticket, email, API-to-support), the eligible channels, and any processing window/SLA are **UNCONFIRMED** — confirm the operational procedure with ePayGames before using this workflow. *Do not record a refund before the money has actually been sent.* **(UNCONFIRMED provider procedure.)**
2. **Open the refund** from the `refund_pending` row ("Record Refund"). The modal resolves *that return's* refund by `returnRequestId` and shows the authoritative amount and status.
3. **Pay exactly the amount shown.** Recording requires the **exact external amount**, entered to the centavo; a mismatch is rejected (it will not silently change the figure). If the amount is wrong, **adjust it before paying** (§3) — do not pay the wrong amount and record a different one.
4. **Record it** (`POST /:id/record`) with:
   - `confirmCompleted: true` (explicit confirmation the refund was completed externally);
   - `externalAmount` = the amount that actually left, centavo-exact with the stored amount;
   - optional `providerReference` (≤ 255 chars) — the provider ticket/transaction reference;
   - optional `note` (≤ 1000 chars) — **required** when correcting a `failed` refund.
5. **Handle the outcome.** Success returns a `lifecycle` summary in the response and shows in the UI:
   - **Pass exceptions** — a `checked_in` Pass cannot be auto-refunded; it is reported and Finance is notified. Resolve manually.
   - **Skipped lifecycle transitions** (`returnRequest`/`shipment` returned a `skipped:<current status>`) — the refund is still recorded (recording is never rolled back for a related state mismatch); the Order record may need manual follow-up.
   Recording a refund twice is impossible: a retry returns **409** (already succeeded), so no duplicate notifications or events.

**Legacy `/process` casualties:** refunds left `failed` by the retired automated route (`processedAt` set, no provider reference) require provider verification before being treated as "not sent" — see §3.4.

---

## 3. Adjustment and reconciliation rules

Adjustment **only changes the recorded amount**; it never initiates a refund and never bypasses a financial ceiling. It is allowed only while the refund is `pending` or `failed` — a `succeeded` refund is **immutable**.

`POST /api/admin/refunds/:id/adjust` body (requires `refunds.manage`; `reason` always required, ≤ 1000 chars):

- **Normal pre-payment correction** — `externalPayment: 'none'`, with exactly one of:
  - `recompute: true` (return refunds only — the system reverts to the promo-aware attributable value for the returned items); or
  - explicit `amount` (a positive value ≤ the remaining refundable ceiling).
- **Already-sent reconciliation** — `externalPayment: 'already_sent'` with `externalAmount` (the amount that actually left). The amount is set to **exactly** that figure, still bounded by the same ceiling. This is a reconciliation for money already sent, **not** a general override.

Ceilings (both enforced at adjust and at record):

- **Order-level:** the refund cannot push the sum of refunds already **committed** (`succeeded` + `processing`) past `order.total` (the amount actually paid).
- **Attributable merchandise (return refunds only):** a return refund is bounded by **both** (a) the promo-aware value of the items on *its own* return request and (b) the order-wide attributable merchandise capacity still remaining after other committed refunds. Shipping and gateway fees are excluded. Cancel-origin refunds are governed by the order-level ceiling only (a full-order reversal).

The ceiling is computed net of refunds already **committed**: `succeeded` refunds are money returned; a `processing` refund has an unknown external state and is treated conservatively as committed, so its capacity cannot be spent twice. A `failed` refund is not money returned, and a `pending` one (including the refund being adjusted or recorded) is not yet confirmed — neither is counted, so a refund never counts against itself. If a `processing` refund already exists for the **same** return, that return's true remaining value cannot be established, so `/record` and `/adjust` refuse with a **409** and require reconciliation rather than guessing. Recording re-checks the ceilings at the moment money is declared, which is the backstop against a set of pending refunds later being recorded past a ceiling.

### 3.1 Confirmed sent vs confirmed not-sent vs inconclusive
Before adjusting or recording around a questionable legacy refund, establish the provider truth:
- **Provider-confirmed sent** — the money demonstrably left; record it (or reconcile the amount with `already_sent`) so the database reflects reality.
- **Provider-confirmed not sent** — no money moved; correct the amount (or leave it pending) and proceed normally.
- **Inconclusive** — **do not mark it succeeded.** Escalate (Finance owner + the founder) and resolve against provider statements before recording. A refund is never marked `succeeded` without evidence the external refund was completed.

### 3.2 Recompute vs explicit amount
Use `recompute` when the stored amount is known to be the pre-fix, undiscounted value **and** the return's full attributable value is within the remaining ceiling. `recompute` always targets the *full* attributable value for the returned items; if a refund for the same return has already succeeded, the remaining ceiling is lower, so `recompute` is rejected (422). In that case — and for any deliberate partial/goodwill figure — use an explicit `amount` equal to the remaining refundable value shown by the readiness audit, which stays within the ceiling.

### 3.3 Post-record immutability
Once `succeeded`, the amount cannot be changed through the API (adjust returns 409), and recording never writes the amount. Corrections to a mistaken *recorded* figure are a Finance/provider reconciliation matter, not an in-app edit.

### 3.4 Legacy data: run the readiness audit first
Before enabling manual recording in production, run the read-only readiness audit (§5.2). It produces:
- **confirmed** overstated pending/failed return refunds → correct via `adjust` **before** any payment. Use an explicit `amount` equal to the reported remaining figure; use `recompute` only when the return's full attributable value still fits within the remaining ceiling (after a succeeded refund it usually does not — see §3.2). Its other confirmed lists (a cancellation refund over the order total, or an order whose pending+failed refunds exceed what remains) are reconciled the same way, by adjustment before payment.
- **manual-investigation** lists: `/process` casualties (`failed` + `processedAt`, no provider ref), refunds stuck in **`processing`** (money state unknown — verify with the provider; `processing` cannot be recorded or adjusted, so it must be resolved manually and never marked `succeeded` without evidence), a pending/failed refund whose return already has a succeeded refund (permanently unrecordable — resolve or remove), duplicate refunds for one return, `refund_pending` returns with no refund row, and any return refund whose items no longer resolve.
- **blocking** lists: any `succeeded` refund, any order whose succeeded refunds exceed the amount paid, **more than one succeeded refund for the same return**, and any refund stuck in **`processing`** (unknown external money state — see §3.1) → reconcile with Finance before proceeding.

---

## 4. Permissions, reminders, monitoring, escalation

### 4.1 Permissions
- `refunds.manage` — record and adjust refunds. **Finance holds this by default** (`backend/lib/permissions.js` DEPARTMENT_DEFAULTS; mirrored in `frontend/src/utils/permissions.js`). It implies `refunds.view`.
- `refunds.view` / `returns.view` — read the refund queue and return detail.
- Return *inspection* is gated on `returns.approve` (unchanged), separate from recording money.
- The frontend hides recording/adjustment actions from users without `refunds.manage`; the backend `requirePermission` is the real enforcement.

### 4.2 Pending-refund reminders
`backend/lib/sendRefundReminders.js` runs hourly (cron `15 * * * *`, `backend/server.js`). It notifies every **active Finance-department** staffer once per refund that has sat `pending` for over **24 hours**, deduplicated per refund per staffer. It is the safety net for money sitting unrefunded.

### 4.3 Monitoring ownership and escalation
- Assign a named Finance owner for the refund queue. Finance should treat `/admin/returns` (filter `Refund Pending`) as the working queue, and the reminder notifications as the backstop when they miss it.
- **If reminders or notifications fail:** the sweep logs `Failed to send refund reminder` and reports to Sentry per refund. Watch for that message; a silent backlog means Finance is not being nudged. A recent fix corrected the reminder recipient lookup (`staff.user._id`); confirm reminders fire after the next deploy by checking the cron log line (`Refund reminder sweep completed`) and that Finance staff receive a notification for a genuinely stale pending refund.
- **Escalation ladder:** Finance owner → engineering on-call for recording/adjustment errors (400/409/422 messages are surfaced in the UI) → founder for any unresolved financial discrepancy (inconclusive legacy refunds, over-refunds, provider mismatches).

---

## 5. Production release checklist and approval gate

> **Approval gate:** every production step below requires the founder's explicit approval immediately before it is run. Nothing in this section is executed automatically.

### 5.1 Pre-release (local, no production access)
- Backend test suite green (CI on `main`); the refund-specific suites pass.
- The readiness audit script is validated locally against the isolated `_test` DB (it refuses to run without an explicit environment + matching confirmation, and refuses production entirely in its current build).
- Migrations reviewed: two append-only enum additions (§7).

### 5.2 Production data audit (read-only; approval required)
Run **after approval**, from `backend/`, having independently verified the target is the production database (the audit refuses a `_test`/localhost target as production, and production execution is disabled in the current script build — enabling it is a separate, reviewed change):

1. **Migration status (read-only):** `npx prisma migrate status` — expect exactly the two refund enum migrations pending; anything else (drift, failed entries) is **blocking**.
2. **Data audit (read-only, `refundMath` as source of truth):** `backend/scripts/auditRefundReadiness.mjs` — reports overstated pending/failed return refunds, same-origin and all-origin cumulative overflow, cancellation refunds over the order total, `/process` casualties, refunds stuck in `processing`, pending refunds whose return is already refunded, duplicate candidates, `refund_pending` returns without a refund, any succeeded refunds, and over-refund orders. **Any succeeded refund, over-refund order, or unresolved `processing` refund is release-blocking** until Finance reconciles it.
3. **Finance staff check (read-only):** at least one active `finance`-department staff profile exists (they hold `refunds.manage`). Zero is **blocking**.

**Release-blocking conditions:** any succeeded refund that cannot be reconciled to a provider statement; any order whose succeeded refunds exceed the amount paid; unexpected migration state; no active Finance staff; an unresolved inconclusive legacy refund.

### 5.3 Deployment order
1. **Backend first** — deploy via the platform's start command `npm start` (its `prestart` runs `prisma migrate deploy`, applying the pending enum migrations). **Never** start with `node server.js` directly (skips migrations). The backend must remain a **single instance** (in-process crons).
2. **Frontend second** — after the backend is confirmed healthy.
3. **Redeploy (not just restart)** if any environment variable changed.

### 5.4 Smoke tests

**Read-only production checks (safe — no data written):**
- Backend logs show `Connected to PostgreSQL` and no migration errors.
- `GET /api/admin/refunds` returns 200 for a Finance account and 403 for one without access.
- The Returns & Refunds screen loads; the Record Refund action is visible only to `refunds.manage` holders.
- **Finance-only account** (`refunds.manage`, no `returns.view`): confirm the screen loads *actual return-list data* — not just the page shell — and that opening a specific return retrieves its detail successfully. The frontend route alone reaching this account is not sufficient evidence; the queue is populated by `GET /api/admin/returns` and a specific return is opened via `GET /api/admin/returns/:id`, both separately permissioned (§1) — check that the list is non-empty/correct and a detail view opens, not just that no 403 banner appears.
- A pending refund older than 24h produces a Finance reminder on the next hourly sweep (or the sweep log line appears).

**Never create test refunds, orders, events, or notifications in production.** The end-to-end recording rehearsal (record → `refund_recorded` audit event → lifecycle summary → notification) is exercised **only in a local or staging environment against isolated fixtures** — never against real orders, and never to manufacture a `succeeded` refund that no external payment backs (§3.1).

---

## 6. Financial safeguards (reference)

Implemented in `backend/lib/refundMath.js` and the refund routes; do not re-derive these by hand:
- integer-centavo math with a single Float→centavo boundary; scope-aware discount allocation over all eligible checkout lines with exact-sum rounding; conservative floor rounding for partial-quantity returns.
- both ceilings above — the return's own attributable value plus the order-wide attributable and order-level capacities, net of committed (`succeeded` + `processing`) refunds — re-checked inside the order-row-locked transaction; a `processing` refund on the same return refuses the operation outright (409).
- atomic status update + audit event in one transaction; post-commit notifications are non-throwing and can never duplicate (recording is once-only).

---

## 7. Migrations and rollback policy

- The release adds two append-only enum values on `OrderEventType`: `refund_recorded`, `refund_adjusted` (migrations `20261012120000_*`, `20261012130000_*`). Both are single `ALTER TYPE … ADD VALUE` statements; neither uses the value in the same migration. This pattern is already proven on this database.
- **Enum values are append-only.** PostgreSQL has no `DROP VALUE`; and a client built before these migrations cannot read an `order_events` row typed `refund_recorded`/`refund_adjusted` (Prisma rejects unknown enum values). Therefore:
  - **Rollback policy is forward-fix.** Do not roll the backend back to a build without these enum values once refund events exist; ship a fix forward instead.
  - If an urgent rollback is unavoidable and refund events exist, treat the affected order timelines as read-broken until a forward fix lands — do not edit historical audit events.
- Re-running `prisma migrate deploy` is idempotent (already-applied migrations are skipped).

---

## 8. Unconfirmed / open items
- **ePayGames external refund procedure** — how money is actually returned, eligible channels, windows, and SLA are **UNCONFIRMED**; confirm with the provider before staff use the workflow.
- **Production refund data state** — unknown until §5.2 is run under approval.
- **Reminder fix in production** — verified by unit tests, not yet exercised against a live cron run.

See ADR-012 for the architectural decision, and `docs/COMMERCE_ENGINE.md` for the governing return/refund domain rules.
