import pino from 'pino';

// Singleton logger, same rationale as lib/prisma.js — one instance shared
// across the process rather than one per module.
//
// JSON lines in production (what Railway's log viewer and any future log
// aggregator expect); pretty-printed in development since nobody's piping
// local stdout anywhere.
const isDev = process.env.NODE_ENV === 'development';

const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
    : undefined,
});

export default logger;
