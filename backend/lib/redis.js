import Redis from 'ioredis';
import logger from './logger.js';

// Singleton, same rationale as lib/prisma.js.
//
// Null (not a connected-but-idle client) when REDIS_URL isn't set — every
// call site must treat Redis as optional and degrade to its non-cached/
// in-memory behavior, the same graceful-without-it pattern used for every
// other optional integration in this codebase (WAVESPEED_API_KEY,
// SENTRY_DSN, etc.). Instantiating an ioredis client with no URL would
// otherwise retry-connect to localhost forever and spam error logs.
const redisUrl = process.env.REDIS_URL;

const redis = redisUrl
  ? new Redis(redisUrl, {
      // Bounds how long any single command waits/retries before giving up —
      // rate limiting and caching both have safe fallbacks, a hung request
      // does not. Offline queueing stays on (ioredis's default): rate-limit-
      // redis's RedisStore sends its initial Lua-script-loading commands
      // synchronously at construction time, before the connection is even
      // established, so disabling the offline queue made every request
      // crash the process at startup instead of just waiting a beat.
      maxRetriesPerRequest: 2,
    })
  : null;

if (redis) {
  redis.on('error', (err) => logger.error({ err }, 'Redis connection error'));
  redis.on('connect', () => logger.info('Connected to Redis'));
} else {
  logger.warn('REDIS_URL not set — caching, queue, and persistent rate limiting disabled');
}

export default redis;
