import 'dotenv/config';
import Sentry from './lib/sentry.js'; // must import before anything else so init() runs first
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import cron from 'node-cron';
import pinoHttp from 'pino-http';
import logger from './lib/logger.js';
import { validateProductionConfig } from './lib/productionConfig.js';
import prisma from './lib/prisma.js';
import redis from './lib/redis.js';
import * as productRepository from './repositories/productRepository.js';
import * as tryOnLogRepository from './repositories/tryOnLogRepository.js';
import * as userActivityRepository from './repositories/userActivityRepository.js';
import * as reportScheduleRepository from './repositories/reportScheduleRepository.js';
import {
  generateAndSendDailyBusinessReport,
  generateAndSendWeeklyBusinessReport,
  generateAndSendMonthlyBusinessReport,
  generateAndSendQuarterlyBusinessReport,
} from './services/dailyBusinessReportService.js';
import { expireStaleOrders } from './lib/expireStaleOrders.js';
import { sendPaymentReminders } from './lib/sendPaymentReminders.js';
import { sweepFulfillmentSLA } from './lib/sweepFulfillmentSLA.js';
import { sendRefundReminders } from './lib/sendRefundReminders.js';
import { retryUnsentConfirmationEmails } from './lib/retryUnsentConfirmationEmails.js';

// Import routes
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import shipmentRoutes from './routes/shipments.js';
import { router as returnRoutes, adminRouter as adminReturnRoutes } from './routes/returns.js';
import refundRoutes from './routes/refunds.js';
import courierRoutes from './routes/couriers.js';
import staffRoutes from './routes/staff.js';
import integrationsRoutes from './routes/integrations.js';
import tryonRoutes from './routes/tryon.js';
import reviewRoutes from './routes/reviews.js';
import leagueRoutes from './routes/leagues.js';
import reportRoutes from './routes/reports.js';
import uploadRoutes from './routes/upload.js';
import settingsRoutes from './routes/settings.js';
import activityRoutes from './routes/activity.js';
import shippingRoutes from './routes/shipping.js';
import paymentChannelRoutes from './routes/paymentChannels.js';
import pickupRoutes from './routes/pickup.js';
import homepageSectionRoutes from './routes/homepageSections.js';
import featuredTeamRoutes from './routes/featuredTeam.js';
import partnerLogoRoutes from './routes/partnerLogos.js';
import navigationLinkRoutes from './routes/navigationLinks.js';
import footerRoutes from './routes/footer.js';
import campaignRoutes from './routes/campaigns.js';
import fitCheckCampaignRoutes from './routes/fitCheckCampaigns.js';
import faqRoutes from './routes/faq.js';
import promoMessageRoutes from './routes/promoMessages.js';
import promoCodeRoutes from './routes/promoCodes.js';
import venueRoutes from './routes/venues.js';
import passEventRoutes from './routes/passEvents.js';
import organizationRoutes from './routes/organizations.js';
import accountRoutes from './routes/account.js';
import { authenticate } from './middleware/auth.js';

// Create Express app
const app = express();

// Trust Railway/Vercel reverse proxy (required for express-rate-limit)
app.set('trust proxy', 1);

// Structured request logging — placed early so it wraps the full request
// lifecycle regardless of what later middleware does.
app.use(pinoHttp({ logger }));

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "http://localhost:5001", "https:"],
    }
  }
}));

// CORS configuration. In development we allow the local vite dev origin
// (http://localhost:5173) alongside FRONTEND_URL (which may be a temporary
// ngrok tunnel for Xendit's HTTPS return URL). In production localhost is
// intentionally NOT allowed — only the configured FRONTEND_URL origin(s).
// Never add localhost to a production allowlist; if mail.pusostore.com ever
// needs to call this API from its own origin, add it as an explicit
// production origin (and to FRONTEND_URL) rather than re-opening localhost.
const isProduction = process.env.NODE_ENV === 'production';
const corsOrigins = isProduction
  ? [...new Set([process.env.FRONTEND_URL].filter(Boolean))]
  : [...new Set(['http://localhost:5173', process.env.FRONTEND_URL].filter(Boolean))];
app.use(cors({
  origin: corsOrigins,
  credentials: true
}));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from public folder
app.use('/images', express.static('public/images'));

// Rate limiting (disabled in development)
const isDev = process.env.NODE_ENV === 'development';

// Without Redis, each limiter's counts live in the process's own memory —
// reset on every restart/deploy and not shared across multiple instances,
// so a client can quietly get a fresh quota just by outlasting a deploy.
// With REDIS_URL set, limits persist and stay consistent across the fleet.
// Falls back to express-rate-limit's default in-memory store when Redis
// isn't configured, same as before this change.
const redisStore = (prefix) =>
  redis ? new RedisStore({ sendCommand: (...args) => redis.call(...args), prefix }) : undefined;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  // 100 was sized for the old, mostly-static site. The homepage CMS build
  // put ~9 independent public content reads (footer, nav, campaigns, FAQ,
  // promo messages, featured team, partner logos, homepage sections) on
  // every single page load, plus a set of admin list pages that each poll
  // their own endpoint — one page view alone now spends a meaningful slice
  // of the old budget, so normal browsing/admin use was tripping this.
  max: 600,
  message: 'Too many requests from this IP, please try again later.',
  skip: () => isDev,
  store: redisStore('rl:general:')
});

app.use('/api/', limiter);

// Stricter rate limit for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many authentication attempts, please try again later.',
  skip: () => isDev,
  store: redisStore('rl:auth:')
});

app.use('/api/auth/', authLimiter);

// Try-on rate limits (the AI providers are expensive). The old per-user
// hourly cap (tryonUserLimiter, 10/hour) is gone — Fit Check's tiered
// daily allowance (lib/fitCheckQuota.js) is now the real per-user product
// limit, and a second, differently-shaped limiter on top of it would just
// be a confusing dual cap. The global hourly ceiling stays: a platform-wide
// cost safety net is a different concern from any one user's own quota.
// skip also excludes anything but the generation POST — GET /api/tryon/quota
// is a cheap, frequently-polled status read that shouldn't spend this
// shared budget, and /admin/* actions (Phase 2's manual bonus grant) carry
// no AI generation cost at all, so they don't belong against this budget
// either.
const tryonGlobalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 500, // across all users
  keyGenerator: () => 'global_tryon',
  message: 'Fit Check is temporarily unavailable due to high demand. Please try again later.',
  skip: (req) => isDev || req.method !== 'POST' || req.path.startsWith('/admin/'),
  store: redisStore('rl:tryon-global:')
});

app.use('/api/tryon', tryonGlobalLimiter);

// Readiness probe — verifies the dependencies a request actually needs
// before reporting the process as healthy, so a load balancer / Railway
// health check can't keep routing traffic to an instance that can't serve
// it. POSTGRES is checked on every call (cheap `SELECT 1`); Redis is
// optional, so it's only probed when REDIS_URL is configured. Returns 503
// with a non-sensitive `status` when a critical dependency is unavailable.
// A 200 means "ready", not merely "the Node process is alive" — that's the
// distinction a readiness probe exists to provide.
app.get('/health', async (req, res) => {
  const checks = { postgres: 'ok' };
  let ready = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    checks.postgres = 'down';
    ready = false;
  }

  if (redis) {
    try {
      await redis.ping();
      checks.redis = 'ok';
    } catch (error) {
      checks.redis = 'down';
      ready = false;
    }
  }

  res.status(ready ? 200 : 503).json({
    success: ready,
    status: ready ? 'ok' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin/shipments', shipmentRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/admin/returns', adminReturnRoutes);
app.use('/api/admin/refunds', refundRoutes);
app.use('/api/admin/couriers', courierRoutes);
app.use('/api/admin/staff', staffRoutes);
app.use('/api/admin/integrations', integrationsRoutes);
app.use('/api/tryon', tryonRoutes);
app.use('/api/products', reviewRoutes);
app.use('/api/leagues', leagueRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/payment-channels', paymentChannelRoutes);
app.use('/api/admin/pickup', pickupRoutes);
app.use('/api/homepage-sections', homepageSectionRoutes);
app.use('/api/featured-team', featuredTeamRoutes);
app.use('/api/partner-logos', partnerLogoRoutes);
app.use('/api/navigation-links', navigationLinkRoutes);
app.use('/api/footer', footerRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/fit-check-campaigns', fitCheckCampaignRoutes);
app.use('/api/faq', faqRoutes);
app.use('/api/promo-messages', promoMessageRoutes);
app.use('/api/promo-codes', promoCodeRoutes);
app.use('/api/admin/venues', venueRoutes);
app.use('/api/pass-events', passEventRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/account', authenticate, accountRoutes);

// Sitemap endpoint
app.get('/api/sitemap.xml', async (req, res) => {
  try {
    const products = await productRepository.find({ where: { active: true } });
    const baseUrl = process.env.FRONTEND_URL || 'https://pusostore.com';

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    const staticPages = ['/', '/products'];
    for (const page of staticPages) {
      xml += `  <url><loc>${baseUrl}${page}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n`;
    }

    for (const product of products) {
      xml += `  <url><loc>${baseUrl}/products/${product.slug}</loc><lastmod>${product.updatedAt.toISOString()}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
    }

    xml += '</urlset>';
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    logger.error({ err: error }, 'Sitemap generation failed');
    Sentry.captureException(error);
    res.status(500).send('Failed to generate sitemap');
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  (req.log || logger).error({ err }, 'Unhandled request error');
  Sentry.captureException(err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// Business Report cadences — all fixed at 5:00 AM Philippine time (the
// spec's hard requirement for Daily; Weekly/Monthly/Quarterly reuse the
// same time rather than each getting its own admin-configurable slot, see
// the ReportSchedule model's own comment for why). Each cadence checks
// ReportSchedule before running — an admin can turn any one of them off
// from Admin > Reports without touching this file. Recipients come from
// ReportRecipient, not a single ADMIN_EMAIL — see dailyBusinessReportService.js.

// Daily, every day — reports on the prior calendar day (yesterday's data
// is fully settled by 5 AM; running at 11:59 PM the old sales-report job
// used to would still catch same-day late-night activity).
cron.schedule('0 5 * * *', async () => {
  try {
    if (!(await reportScheduleRepository.isActive('daily'))) return;
    await generateAndSendDailyBusinessReport();
  } catch (error) {
    logger.error({ err: error }, 'Daily business report failed');
    Sentry.captureException(error);
  }
}, { timezone: 'Asia/Manila' });

// Weekly, every Monday — covers the 7 days just completed.
cron.schedule('0 5 * * 1', async () => {
  try {
    if (!(await reportScheduleRepository.isActive('weekly'))) return;
    await generateAndSendWeeklyBusinessReport();
  } catch (error) {
    logger.error({ err: error }, 'Weekly business report failed');
    Sentry.captureException(error);
  }
}, { timezone: 'Asia/Manila' });

// Monthly, 1st of the month — covers the full previous calendar month.
cron.schedule('0 5 1 * *', async () => {
  try {
    if (!(await reportScheduleRepository.isActive('monthly'))) return;
    await generateAndSendMonthlyBusinessReport();
  } catch (error) {
    logger.error({ err: error }, 'Monthly business report failed');
    Sentry.captureException(error);
  }
}, { timezone: 'Asia/Manila' });

// Quarterly, 1st of Jan/Apr/Jul/Oct — covers the full previous calendar quarter.
cron.schedule('0 5 1 1,4,7,10 *', async () => {
  try {
    if (!(await reportScheduleRepository.isActive('quarterly'))) return;
    await generateAndSendQuarterlyBusinessReport();
  } catch (error) {
    logger.error({ err: error }, 'Quarterly business report failed');
    Sentry.captureException(error);
  }
}, { timezone: 'Asia/Manila' });

// Payment Platform Redesign, Phase 4 — sweeps orders that have sat
// paymentStatus='pending' past the admin-configured retention window
// (default 48h) into Expired, releasing their reserved stock. Hourly, not
// daily like the jobs above: this holds live inventory, not just a report
// number, so stock shouldn't stay artificially locked for up to a full day
// waiting on a once-a-day sweep.
cron.schedule('0 * * * *', async () => {
  try {
    const result = await expireStaleOrders();
    if (result.expiredCount > 0 || result.errors.length > 0) {
      logger.info(result, 'Stale order expiration sweep completed');
    }
    for (const { orderNumber, error } of result.errors) {
      logger.error({ err: error, orderNumber }, 'Failed to expire a stale order');
      Sentry.captureException(error);
    }
  } catch (error) {
    logger.error({ err: error }, 'Stale order expiration sweep failed');
    Sentry.captureException(error);
  }
}, { timezone: 'Asia/Manila' });

// Payment Platform Redesign, Phase 6 — 6h/24h/2h-before-deadline reminder
// emails (see sendPaymentReminders.js for why those tiers are measured
// against the order's retention deadline, not the 1-hour Maya session).
// Offset 5 minutes past the expiration sweep above so the two hourly jobs
// don't both hit the same awaiting_payment rows in the same tick.
cron.schedule('5 * * * *', async () => {
  try {
    const result = await sendPaymentReminders();
    if (result.remindersSent > 0 || result.errors.length > 0) {
      logger.info(result, 'Payment reminder sweep completed');
    }
    for (const { orderNumber, error } of result.errors) {
      logger.error({ err: error, orderNumber }, 'Failed to send a payment reminder');
      Sentry.captureException(error);
    }
  } catch (error) {
    logger.error({ err: error }, 'Payment reminder sweep failed');
    Sentry.captureException(error);
  }
}, { timezone: 'Asia/Manila' });

// Enterprise Fulfillment Blueprint §13.1 — flags Shipments stuck past their
// stage's SLA threshold into `exception` so they surface on the queue
// instead of silently sitting unworked. Offset 10 minutes past the payment
// sweeps above so all three hourly jobs don't collide on the same tick.
cron.schedule('10 * * * *', async () => {
  try {
    const result = await sweepFulfillmentSLA();
    if (result.flaggedCount > 0 || result.errors.length > 0) {
      logger.info(result, 'Fulfillment SLA sweep completed');
    }
    for (const { shipmentId, error } of result.errors) {
      logger.error({ err: error, shipmentId }, 'Failed to flag a stuck shipment');
      Sentry.captureException(error);
    }
  } catch (error) {
    logger.error({ err: error }, 'Fulfillment SLA sweep failed');
    Sentry.captureException(error);
  }
}, { timezone: 'Asia/Manila' });

// Enterprise Fulfillment Blueprint §13.4 — same cadence discipline, offset
// again so it never collides with the sweep above.
cron.schedule('15 * * * *', async () => {
  try {
    const result = await sendRefundReminders();
    if (result.remindersSent > 0 || result.errors.length > 0) {
      logger.info(result, 'Refund reminder sweep completed');
    }
    for (const { refundId, error } of result.errors) {
      logger.error({ err: error, refundId }, 'Failed to send a refund reminder');
      Sentry.captureException(error);
    }
  } catch (error) {
    logger.error({ err: error }, 'Refund reminder sweep failed');
    Sentry.captureException(error);
  }
}, { timezone: 'Asia/Manila' });

cron.schedule('20 * * * *', async () => {
  try {
    const result = await retryUnsentConfirmationEmails();
    if (result.sentCount > 0 || result.errors.length > 0) {
      logger.info(result, 'Unsent confirmation email sweep completed');
    }
  } catch (error) {
    logger.error({ err: error }, 'Unsent confirmation email sweep failed');
    Sentry.captureException(error);
  }
}, { timezone: 'Asia/Manila' });

// Replaces MongoDB's TTL indexes on TryOnLog/UserActivity (both had
// `expireAfterSeconds: 90 days`) — Postgres has no equivalent, so this
// deletes what the TTL indexes used to. Scheduled outside the sales
// report's window so the two never overlap.
cron.schedule('0 3 * * *', async () => {
  try {
    const tryOnDeleted = await tryOnLogRepository.deleteOlderThan(90);
    const activityDeleted = await userActivityRepository.deleteOlderThan(90);
    logger.info({ tryOnDeleted, activityDeleted }, 'Expired TryOnLog/UserActivity rows cleaned up');
  } catch (error) {
    logger.error({ err: error }, 'TryOnLog/UserActivity cleanup failed');
    Sentry.captureException(error);
  }
}, { timezone: 'Asia/Manila' });

// Start server — the database check runs first and blocks listen, so the
// app fails fast on a bad DATABASE_URL instead of accepting traffic it
// can't serve. (The original mongoose.connect() call didn't actually
// block app.listen() either; blocking here is a deliberate hardening
// while this exact bootstrap code is already being touched to drop
// mongoose entirely.)
const PORT = process.env.PORT || 5000;

let server;
let shuttingDown = false;

async function start() {
  try {
    // Fail fast on missing required production config BEFORE touching the DB
    // or binding the port. Throws with variable NAMES only (never values).
    validateProductionConfig();
  } catch (configError) {
    logger.fatal({ err: configError, missing: configError.missing }, 'Missing required production configuration');
    Sentry.captureException(configError);
    await Sentry.close(2000);
    process.exit(1);
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Connected to PostgreSQL');
  } catch (error) {
    logger.fatal({ err: error }, 'Database connection error');
    Sentry.captureException(error);
    await Sentry.close(2000);
    process.exit(1);
  }

  server = app.listen(PORT, () => {
    logger.info({ port: PORT, environment: process.env.NODE_ENV || 'development' }, 'Server is running');
    retryUnsentConfirmationEmails().catch((error) => {
      logger.error({ err: error }, 'Startup confirmation email sweep failed');
      Sentry.captureException(error);
    });
  });
}

start();

// Catch what nothing else caught. Logged and reported before exiting so a
// crash leaves a real record instead of just unstructured stderr scrollback.
process.on('uncaughtException', async (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  Sentry.captureException(error);
  await Sentry.close(2000);
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  Sentry.captureException(reason);
  await Sentry.close(2000);
  process.exit(1);
});

// Graceful shutdown. `server.close()` stops accepting new connections and
// lets in-flight requests finish (it does not disconnect established
// keep-alive sockets that are idle — `server.closeIdleConnections()` trims
// those), and `cron` is not itself awaitable, so we stop the scheduled jobs
// first, then drain the HTTP server, then release the DB/Redis handles, then
// exit. Without this ordering an in-flight checkout/payment request or an
// hourly stock-release sweep is killed mid-transaction on a Railway
// SIGTERM (the normal deploy/scale-down signal).
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Starting graceful shutdown');

  cron.getTasks().forEach((task) => task.stop());

  if (server) {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeIdleConnections?.();
    });
  }

  await prisma.$disconnect();
  if (redis) redis.disconnect();

  logger.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
