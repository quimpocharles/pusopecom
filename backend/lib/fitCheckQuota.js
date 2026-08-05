import redis from './redis.js';
import * as siteSettingsRepository from '../repositories/siteSettingsRepository.js';
import * as bonusFitCheckGrantRepository from '../repositories/bonusFitCheckGrantRepository.js';

// Philippines has no DST — a fixed UTC+8 offset is exact, not an
// approximation, matching the same Asia/Manila day-boundary convention
// server.js's report crons already use (`{ timezone: 'Asia/Manila' }`).
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

function manilaDateKey(date = new Date()) {
  const manila = new Date(date.getTime() + MANILA_OFFSET_MS);
  return manila.toISOString().slice(0, 10); // YYYY-MM-DD
}

function secondsUntilManilaMidnight(date = new Date()) {
  const manila = new Date(date.getTime() + MANILA_OFFSET_MS);
  const nextMidnightManila = new Date(Date.UTC(manila.getUTCFullYear(), manila.getUTCMonth(), manila.getUTCDate() + 1));
  const nextMidnightUtc = new Date(nextMidnightManila.getTime() - MANILA_OFFSET_MS);
  return Math.max(1, Math.ceil((nextMidnightUtc.getTime() - date.getTime()) / 1000));
}

// Guests (no User row — identified only by the client-generated sessionId
// already used by TryOnLog/UserActivity) key off sessionId; everyone else
// keys off userId. One key per person per day — naturally resets via the
// TTL set in consume() below, no cleanup job needed.
function quotaKey({ userId, sessionId }) {
  const who = userId ? `user:${userId}` : `guest:${sessionId}`;
  return `fitcheck:quota:${who}:${manilaDateKey()}`;
}

function resolveLimit(settings, { userId, tier }) {
  if (!userId) return settings.fitCheck.dailyLimitGuest;
  if (tier === 'premium') return settings.fitCheck.dailyLimitPremium;
  return settings.fitCheck.dailyLimitRegistered;
}

// Guests never carry a bonus balance — every grant reason requires a real
// account (see BonusFitCheckGrant's schema comment). Reading it is skipped
// entirely for guests rather than querying and getting 0 back every time.
async function bonusRemaining(settings, userId) {
  if (!userId || !settings.fitCheck.bonus.enabled) return 0;
  return bonusFitCheckGrantRepository.getBalance(userId);
}

export class QuotaExceededError extends Error {
  constructor(status) {
    super("You've reached today's Fit Check limit.");
    this.name = 'QuotaExceededError';
    this.status = status;
  }
}

/**
 * Read-only — does not consume. Powers the "3/5 Remaining, Resets in
 * 14h 12m" display shown throughout the experience, independent of
 * whether a generation is happening right now.
 */
export async function getStatus({ userId, sessionId, tier } = {}) {
  const settings = await siteSettingsRepository.get();
  const limit = resolveLimit(settings, { userId, tier });
  const resetsInSeconds = secondsUntilManilaMidnight();
  const bonus = await bonusRemaining(settings, userId);

  if (!redis) return { limit, used: 0, remaining: limit, resetsInSeconds, bonusRemaining: bonus };

  const used = Number((await redis.get(quotaKey({ userId, sessionId }))) || 0);
  return {
    limit,
    used: Math.min(used, limit),
    remaining: Math.max(0, limit - used),
    resetsInSeconds,
    bonusRemaining: bonus,
  };
}

/**
 * Atomically consumes one Fit Check against today's allowance — checked
 * and incremented as a single Redis INCR so two concurrent requests can't
 * both slip through on the last unit (the same race class
 * productRepository.decrementStock already guards against for inventory,
 * just via Postgres instead of Redis here). Once the daily allowance is
 * exhausted, falls back to the user's Bonus Fit Check balance (Phase 2) —
 * a durable ledger, not a second daily counter, and guests never have one.
 * Throws QuotaExceededError only once both are exhausted; callers still pay
 * the INCR cost for a request that ends up bonus-funded or rejected, which
 * is fine — the counter self-corrects to "at limit," it doesn't run away,
 * and the next call each day starts the count fresh.
 */
export async function consume({ userId, sessionId, tier } = {}) {
  const settings = await siteSettingsRepository.get();
  const limit = resolveLimit(settings, { userId, tier });
  const resetsInSeconds = secondsUntilManilaMidnight();

  // No Redis configured — degrade to "unlimited," the same null-safe
  // pattern every other optional Redis integration here follows (rate
  // limiting, accountCache). A product quota isn't enforceable without a
  // shared counter; failing open rather than blocking every Fit Check.
  if (!redis) return { limit, used: 0, remaining: limit, resetsInSeconds, bonusRemaining: 0 };

  const key = quotaKey({ userId, sessionId });
  const used = await redis.incr(key);
  await redis.expire(key, resetsInSeconds);

  if (used <= limit) {
    return {
      limit,
      used,
      remaining: Math.max(0, limit - used),
      resetsInSeconds,
      bonusRemaining: await bonusRemaining(settings, userId),
    };
  }

  if (userId && settings.fitCheck.bonus.enabled) {
    const drewFromBonus = await bonusFitCheckGrantRepository.consumeOne(userId);
    if (drewFromBonus) {
      return {
        limit,
        used: limit,
        remaining: 0,
        resetsInSeconds,
        bonusRemaining: await bonusFitCheckGrantRepository.getBalance(userId),
      };
    }
  }

  throw new QuotaExceededError({
    limit,
    used: limit,
    remaining: 0,
    resetsInSeconds,
    bonusRemaining: await bonusRemaining(settings, userId),
  });
}

export default { getStatus, consume, QuotaExceededError };
