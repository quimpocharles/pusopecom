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
      maxRetriesPerRequest: 2,
      // Don't crash callers waiting on a command if Redis is briefly down —
      // rate limiting and caching both have safe fallbacks; a hung request
      // does not.
      enableOfflineQueue: false,
    })
  : null;

if (redis) {
  redis.on('error', (err) => logger.error({ err }, 'Redis connection error'));
  redis.on('connect', () => logger.info('Connected to Redis'));
} else {
  logger.warn('REDIS_URL not set — caching, queue, and persistent rate limiting disabled');
}

export default redis;
