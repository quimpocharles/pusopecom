import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { loadTestEnvironment } from './lib/testEnv.js';

const testEnvPath = fileURLToPath(new URL('./.env.test', import.meta.url));
const testEnvironment = loadTestEnvironment({ envFilePath: testEnvPath });

export default defineConfig({
  test: {
    env: testEnvironment,
  },
});
