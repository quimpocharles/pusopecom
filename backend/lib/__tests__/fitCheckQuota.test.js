import { describe, it, expect, vi, beforeEach } from 'vitest';

// A tiny in-memory fake standing in for ioredis — real enough to prove
// per-key isolation and INCR/EXPIRE semantics without a real Redis
// instance, which is the actual thing worth verifying here (the limit
// arithmetic itself is trivial; getting the key scoping wrong — one guest
// silently sharing another's counter — is the real risk).
function makeFakeRedis() {
  const store = new Map();
  return {
    async get(key) {
      return store.has(key) ? String(store.get(key)) : null;
    },
    async incr(key) {
      const next = (store.get(key) || 0) + 1;
      store.set(key, next);
      return next;
    },
    async expire() {
      return 1; // TTL bookkeeping isn't observable in-memory — not under test here
    },
  };
}

const fakeRedis = makeFakeRedis();
vi.mock('../redis.js', () => ({ default: fakeRedis }));

vi.mock('../../repositories/siteSettingsRepository.js', () => ({
  get: vi.fn().mockResolvedValue({
    fitCheck: { dailyLimitGuest: 1, dailyLimitRegistered: 5, dailyLimitPremium: 10, guestRetentionHours: 24 },
  }),
}));

const fitCheckQuota = await import('../fitCheckQuota.js');

describe('fitCheckQuota — with Redis available', () => {
  it('a guest gets the guest limit (1/day) and is blocked on the second attempt', async () => {
    const guest = { sessionId: `guest-${Date.now()}-a` };
    const first = await fitCheckQuota.consume(guest);
    expect(first).toEqual({ limit: 1, used: 1, remaining: 0, resetsInSeconds: expect.any(Number) });

    await expect(fitCheckQuota.consume(guest)).rejects.toBeInstanceOf(fitCheckQuota.QuotaExceededError);
  });

  it('two different guests never share a counter', async () => {
    const guestA = { sessionId: `guest-${Date.now()}-b` };
    const guestB = { sessionId: `guest-${Date.now()}-c` };

    await fitCheckQuota.consume(guestA);
    // guestA is now at their limit — guestB must still have their own full allowance
    const statusB = await fitCheckQuota.getStatus(guestB);
    expect(statusB.remaining).toBe(1);
  });

  it('a registered user gets the higher registered limit (5/day)', async () => {
    const user = { userId: `user-${Date.now()}-a`, tier: 'registered' };
    for (let i = 0; i < 5; i++) {
      const res = await fitCheckQuota.consume(user);
      expect(res.remaining).toBe(4 - i);
    }
    await expect(fitCheckQuota.consume(user)).rejects.toBeInstanceOf(fitCheckQuota.QuotaExceededError);
  });

  it('a premium user gets the premium limit (10/day), distinct from registered', async () => {
    const user = { userId: `user-${Date.now()}-b`, tier: 'premium' };
    const status = await fitCheckQuota.getStatus(user);
    expect(status.limit).toBe(10);
  });

  it('an undefined tier defaults to the registered limit, not guest or premium', async () => {
    const user = { userId: `user-${Date.now()}-c` };
    const status = await fitCheckQuota.getStatus(user);
    expect(status.limit).toBe(5);
  });

  it('getStatus never mutates the counter — checking status repeatedly costs nothing', async () => {
    const guest = { sessionId: `guest-${Date.now()}-d` };
    await fitCheckQuota.getStatus(guest);
    await fitCheckQuota.getStatus(guest);
    const status = await fitCheckQuota.getStatus(guest);
    expect(status.used).toBe(0);
    expect(status.remaining).toBe(1);
  });

  it('resetsInSeconds is always a positive number within one day', async () => {
    const { resetsInSeconds } = await fitCheckQuota.getStatus({ sessionId: 'reset-check' });
    expect(resetsInSeconds).toBeGreaterThan(0);
    expect(resetsInSeconds).toBeLessThanOrEqual(24 * 60 * 60);
  });
});

describe('fitCheckQuota — Redis not configured', () => {
  it('degrades to unlimited rather than blocking every Fit Check', async () => {
    vi.resetModules();
    vi.doMock('../redis.js', () => ({ default: null }));
    vi.doMock('../../repositories/siteSettingsRepository.js', () => ({
      get: vi.fn().mockResolvedValue({ fitCheck: { dailyLimitGuest: 1, dailyLimitRegistered: 5, dailyLimitPremium: 10 } }),
    }));
    const noRedisQuota = await import('../fitCheckQuota.js');

    const status = await noRedisQuota.getStatus({ sessionId: 'no-redis-guest' });
    expect(status).toMatchObject({ limit: 1, used: 0, remaining: 1 });

    const consumed = await noRedisQuota.consume({ sessionId: 'no-redis-guest' });
    expect(consumed).toMatchObject({ limit: 1, used: 0, remaining: 1 }); // never actually counted — nothing to enforce against
  });
});
