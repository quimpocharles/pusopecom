import * as Sentry from '@sentry/node';
import logger from './logger.js';

// Real error tracking — without this, production failures only exist as
// scrollback in Railway's log viewer with no alerting and no aggregation
// across occurrences.
//
// No-ops cleanly without SENTRY_DSN (e.g. local dev, CI) rather than
// failing to start — same pattern as the optional third-party API keys
// elsewhere in this codebase (WAVESPEED_API_KEY, etc.). Imported first in
// server.js so Sentry.init() runs before any other module's top-level code.
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
  });
  logger.info('Sentry error tracking initialized');
} else {
  logger.warn('SENTRY_DSN not set — error tracking disabled');
}

export default Sentry;
