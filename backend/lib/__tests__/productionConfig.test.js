import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateProductionConfig } from '../productionConfig.js';

describe('validateProductionConfig — production fail-fast (names only, never values)', () => {
  const makeEnv = (overrides = {}) => ({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://u:p@h:5432/db',
    JWT_SECRET: 'a-32-char-secret-that-is-long-enough',
    FRONTEND_URL: 'https://pusostore.com',
    EMAIL_HOST: 'smtp.example.com',
    EMAIL_PORT: '587',
    EMAIL_USER: 'noreply@pusostore.com',
    EMAIL_PASSWORD: 'smtp-pass',
    XENDIT_SECRET_KEY: 'xnd_production_xxx',
    XENDIT_WEBHOOK_TOKEN: 'webhook-token',
    ...overrides,
  });

  beforeEach(() => vi.clearAllMocks());

  it('passes when every required production variable is present', () => {
    expect(validateProductionConfig(makeEnv())).toEqual({ ok: true, missing: [] });
  });

  it.each(['DATABASE_URL', 'JWT_SECRET', 'FRONTEND_URL', 'EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASSWORD', 'XENDIT_SECRET_KEY', 'XENDIT_WEBHOOK_TOKEN'])(
    'fails fast when %s is missing, naming only the variable',
    (missingName) => {
      const env = makeEnv();
      delete env[missingName];
      let err;
      try {
        validateProductionConfig(env);
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toContain(missingName);
      // Never leak the value of any other secret in the error.
      expect(err.message).not.toContain('xnd_production_xxx');
      expect(err.message).not.toContain('smtp-pass');
      expect(err.missing).toContain(missingName);
    }
  );

  it('does not fail in non-production environments', () => {
    const env = makeEnv({ NODE_ENV: 'development', XENDIT_SECRET_KEY: undefined });
    expect(validateProductionConfig(env)).toEqual({ ok: true, missing: [] });
  });

  it('does not require optional/fallback integrations (Maya, Replicate, WaveSpeed, Redis, Sentry)', () => {
    const env = makeEnv();
    delete env.MAYA_SECRET_KEY;
    delete env.REPLICATE_API_TOKEN;
    delete env.WAVESPEED_API_KEY;
    delete env.REDIS_URL;
    delete env.SENTRY_DSN;
    expect(validateProductionConfig(env)).toEqual({ ok: true, missing: [] });
  });
});
