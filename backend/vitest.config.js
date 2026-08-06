import { defineConfig } from 'vitest/config';
import { config as loadEnv } from 'dotenv';

// The test suite (including routes/__tests__/*.test.js and
// repositories/__tests__/integration.test.js, both of which run real
// queries against a live database) must never point at the same
// DATABASE_URL as `npm run dev` — that was the root cause behind orphaned
// test-fixture products/orders showing up in the real product catalog.
// `test.env` (not a plain top-level dotenv.config() call) is what actually
// gets this into every vitest worker process, since each test file's
// module graph — including lib/prisma.js's `new PrismaClient()` at import
// time — runs in its own worker, not in this config-loading process.
const testEnv = loadEnv({ path: '.env.test' }).parsed;

if (!testEnv?.DATABASE_URL) {
  throw new Error(
    'backend/.env.test is missing or has no DATABASE_URL — see .env.test.example. ' +
    'Tests refuse to run without an explicit, isolated test database.'
  );
}

export default defineConfig({
  test: {
    env: testEnv,
  },
});
