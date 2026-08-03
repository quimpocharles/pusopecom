import redis from './redis.js';
import logger from './logger.js';

// First cache-read/write in this codebase beyond rate limiting (lib/redis.js
// has otherwise only ever backed RedisStore). Degrades the same null-safe
// way every other optional Redis integration here does — no client means
// always compute, never cache, same as rate limiting falling back to
// in-memory. A 60s TTL bounds staleness for whatever isn't explicitly
// invalidated below, without needing a hook at every possible mutation site
// in the app — only the handful of routes that actually change
// dashboard-visible data (orders.js, tryon.js, routes/account.js itself)
// call invalidateDashboard.
const TTL_SECONDS = 60;
const key = (userId) => `acct:dashboard:${userId}`;

export async function getOrSetDashboard(userId, computeFn) {
  if (!redis) return computeFn();

  const cacheKey = key(userId);
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (err) {
    logger.error({ err }, 'accountCache read error');
  }

  const fresh = await computeFn();

  try {
    await redis.set(cacheKey, JSON.stringify(fresh), 'EX', TTL_SECONDS);
  } catch (err) {
    logger.error({ err }, 'accountCache write error');
  }

  return fresh;
}

export async function invalidateDashboard(userId) {
  if (!redis || !userId) return;
  try {
    await redis.del(key(userId));
  } catch (err) {
    logger.error({ err }, 'accountCache invalidate error');
  }
}

export default { getOrSetDashboard, invalidateDashboard };
