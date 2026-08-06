import { defineConfig } from 'vitest/config';
import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';

// The test suite (including routes/__tests__/*.test.js and
// repositories/__tests__/integration.test.js, both of which run real
// queries against a live database) must never point at the same
// DATABASE_URL as `npm run dev` — that was the root cause behind orphaned
// test-fixture products/orders showing up in the real product catalog.
// `test.env` (not a plain top-level dotenv.config() call) is what actually
// gets this into every vitest worker process, since each test file's
// module graph — including lib/prisma.js's `new PrismaClient()` at import
// time — runs in its own worker, not in this config-loading process.
//
// Local dev supplies this via backend/.env.test (gitignored, see
// .env.test.example). CI has no such file — .github/workflows/ci.yml
// instead sets DATABASE_URL directly as a real process env var from a repo
// secret, already isolated from dev/prod there. Prefer the file when it
// exists (keeps local runs pinned to a known test DB regardless of
// whatever's in the shell), otherwise fall back to whatever's already in
// process.env so CI's own injection isn't clobbered.
const testEnvPath = '.env.test';
const parsedTestEnv = fs.existsSync(testEnvPath) ? loadEnv({ path: testEnvPath }).parsed : undefined;
const databaseUrl = parsedTestEnv?.DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'No DATABASE_URL for tests — set one in backend/.env.test (see .env.test.example) for local runs, ' +
    'or via a real DATABASE_URL env var in CI. Tests refuse to run without an explicit, isolated test database.'
  );
}

export default defineConfig({
  test: {
    env: { DATABASE_URL: databaseUrl },
  },
});
