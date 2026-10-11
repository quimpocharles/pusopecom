# AGENTS.md — PusoStore (pusopecom)

Full-stack Philippine sports ecommerce platform. Two independent npm packages: `backend/` (Node/Express + Prisma + PostgreSQL) and `frontend/` (React 18 + Vite). No root workspace file — run all commands inside the package directory. Node 20.

## Domain & design guidance — read first

`CLAUDE.md` (root) is the dense domain/architecture briefing: data model vocabulary (Organization-first), binding Commerce Engine rules, hard boundaries ("Things AI Must Never Change"), and the CMS-first rule. Full reasoning lives in `docs/`; design system spec in `docs/design/`. Do not duplicate or contradict it here — read it before making domain decisions.

## Commands

Backend (`cd backend`):
- `npm run dev` — dev server (port 5001). **Read "Local data safety" below first.**
- `npm test` — Vitest suite (CI runs `npx prisma generate` before `npm test` — do this locally after schema changes)
- `npm run dev:local` — dev server against local Postgres via `.env.local` overrides (see README "Local database")
- `npm run db:local:migrate` / `db:local:seed` — local DB setup; seed refuses non-localhost `DATABASE_URL`

Frontend (`cd frontend`):
- `npm test` — Vitest (jsdom, testing-library)
- `npm run build` — must pass alongside tests (CI runs both); no lint/typecheck scripts exist anywhere
- `npm run dev` — port 5173, proxies `/api` to localhost:5001

No lint or format tooling is configured.

## Test & env gotchas

- Backend tests load `backend/.env.test` (via `vitest.config.js` → `lib/testEnv.js`), NOT `.env`. Copy `.env.test.example` → `.env.test`. They fail hard unless the DB name ends in `_test` and email is blanked — never point tests at the dev/prod database.
- `backend/.env` default `DATABASE_URL` is the **production** Railway Postgres. Anything that writes data (sign-ups, orders, admin edits, background cron sweeps) hits production under plain `npm run dev`. For any work creating/mutating test data, use `npm run dev:local`.
- Even locally, payment gateway keys come from `.env`, so submitting checkout opens a real gateway session. Use seeded orders (`PS-LOCAL-*`) for payment-state work.
- Verify DB after boot: the "Connected to PostgreSQL" log line shows which database you're on.

## Deployment & infra quirks

- Prisma migrations run via the `prestart` hook → deploy start command must be `npm start` (never `node server.js` directly, which skips `prestart`). CI gates deploys: `.github/workflows/ci.yml` runs both test suites on push/PR to `main`.
- Backend runs node-cron jobs **in-process** (`server.js`): must stay a single instance. Scaling to replicas duplicates jobs.
- After changing any env var on the hosting platform, redeploy — restart is not enough.

## Architecture

- Entrypoints: `backend/server.js` (Express app; registers all routes and crons) and `frontend/src/main.jsx` → `App.jsx` (routes, mostly lazy-loaded).
- Layers: `backend/routes/` → `backend/repositories/` (one module per Prisma model, thin Prisma wrapper). Frontend: `src/pages/` + `src/components/` → `src/services/` (axios API layer) → Zustand stores in `src/store/`.
- `backend/prisma/schema.prisma` is authoritative and heavily commented — note the Float-money and string-size-label tradeoffs documented in its header before touching it.
- Adding a new CMS/admin content model: follow the six-layer pattern in `CLAUDE.md` ("CMS-First Rule") — Prisma model, repository, admin-gated API, admin page, frontend service, frontend component. Backend CRUD without an admin page is not done.

## Hard rules (from CLAUDE.md — non-negotiable)

- Stock/inventory is read live, never cached or optimistic; reserved atomically at order placement.
- Payment webhooks are verified before acting: Xendit via `x-callback-token`, Maya via re-pull + IP allowlist. No integration ever trusts raw payloads.
- Passes and Merchandise never mix in one Order or checkout.
- Business/site content is never hardcoded — lives in DB, editable from the Admin Dashboard.
