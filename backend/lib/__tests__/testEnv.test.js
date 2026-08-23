import { describe, it, expect } from 'vitest';
import { resolveTestEnvironment } from '../testEnv.js';

describe('resolveTestEnvironment', () => {
  it('prefers the dedicated .env.test database over process environment values', () => {
    const result = resolveTestEnvironment({
      filePresent: true,
      fileValues: { DATABASE_URL: 'postgresql://user:pass@host/railway_test' },
      processEnv: { NODE_ENV: 'development', DATABASE_URL: 'postgresql://user:pass@host/railway' },
    });

    expect(result.DATABASE_URL).toContain('/railway_test');
    expect(result.NODE_ENV).toBe('test');
    expect(result.EMAIL_PASSWORD).toBe('');
  });

  it('accepts an explicitly injected CI test database when no file exists', () => {
    const result = resolveTestEnvironment({
      processEnv: { NODE_ENV: 'test', DATABASE_URL: 'postgresql://user:pass@host/ci_test' },
    });

    expect(result.DATABASE_URL).toContain('/ci_test');
  });

  it('rejects a missing test file when the process is not explicitly test', () => {
    expect(() => resolveTestEnvironment({
      processEnv: { NODE_ENV: 'development', DATABASE_URL: 'postgresql://user:pass@host/railway' },
    })).toThrow(/NODE_ENV=test/);
  });

  it('rejects a non-test database name', () => {
    expect(() => resolveTestEnvironment({
      filePresent: true,
      fileValues: { DATABASE_URL: 'postgresql://user:pass@host/railway' },
    })).toThrow(/ends with _test/);
  });

  it('rejects a missing DATABASE_URL in a test file', () => {
    expect(() => resolveTestEnvironment({ filePresent: true, fileValues: {} })).toThrow(/require DATABASE_URL/);
  });
});
