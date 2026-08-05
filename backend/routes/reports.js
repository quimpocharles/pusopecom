import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import * as orderRepository from '../repositories/orderRepository.js';
import * as productRepository from '../repositories/productRepository.js';
import * as userRepository from '../repositories/userRepository.js';
import * as tryOnLogRepository from '../repositories/tryOnLogRepository.js';
import * as shippingEventRepository from '../repositories/shippingEventRepository.js';
import * as reportRecipientRepository from '../repositories/reportRecipientRepository.js';
import * as reportRunRepository from '../repositories/reportRunRepository.js';
import * as reportScheduleRepository from '../repositories/reportScheduleRepository.js';
import * as dashboardWidgetRepository from '../repositories/dashboardWidgetRepository.js';
import * as paymentRepository from '../repositories/paymentRepository.js';
import { sendReportExport } from '../lib/reportExport.js';
import {
  generateAndSendDailyBusinessReport,
  generateAndSendWeeklyBusinessReport,
  generateAndSendMonthlyBusinessReport,
  generateAndSendQuarterlyBusinessReport,
  dailyBusinessReportToExportShape,
} from '../services/dailyBusinessReportService.js';
import { body, validationResult } from 'express-validator';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// All routes require admin auth
router.use(authenticate, isAdmin);

// Who the Daily Business Report (and future scheduled reports) get emailed
// to — configured here rather than a single ADMIN_EMAIL env var.
router.get('/recipients', async (req, res) => {
  try {
    const recipients = await reportRecipientRepository.find();
    res.json({ success: true, data: recipients });
  } catch (error) {
    logger.error({ err: error }, 'List report recipients error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to list report recipients' });
  }
});

router.post('/recipients', [body('email').isEmail().normalizeEmail()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'A valid email is required' });
    }
    const recipient = await reportRecipientRepository.create({ email: req.body.email });
    res.status(201).json({ success: true, data: recipient });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'That email is already a recipient' });
    }
    logger.error({ err: error }, 'Add report recipient error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to add report recipient' });
  }
});

router.patch('/recipients/:id', async (req, res) => {
  try {
    const { active } = req.body;
    const recipient = await reportRecipientRepository.updateById(req.params.id, { active });
    res.json({ success: true, data: recipient });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }
    logger.error({ err: error }, 'Update report recipient error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update report recipient' });
  }
});

router.delete('/recipients/:id', async (req, res) => {
  try {
    await reportRecipientRepository.deleteById(req.params.id);
    res.json({ success: true });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }
    logger.error({ err: error }, 'Delete report recipient error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to delete report recipient' });
  }
});

// ── Report Archive ──────────────────────────────────────────────────────
// Every generated scheduled report (currently: the Daily Business Report)
// gets archived here. List/View/Download/Delete/Regenerate — the five
// admin actions the Reporting spec calls for.

router.get('/archive', async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status } = req.query;
    const where = {};
    if (type) where.type = type;
    if (status) where.status = status;
    const skip = (Number(page) - 1) * Number(limit);

    const [runs, total] = await Promise.all([
      reportRunRepository.find({ where, skip, take: Number(limit) }),
      reportRunRepository.count({ where }),
    ]);
    // `data` can be a sizeable JSON blob — the list view only needs enough
    // to render a row, not the full snapshot (that's what GET /archive/:id is for).
    const summaries = runs.map(({ data, ...rest }) => ({ ...rest, hasData: data != null }));

    res.json({
      success: true,
      data: summaries,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    logger.error({ err: error }, 'List report archive error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to list report archive' });
  }
});

const REGENERATE_BY_FREQUENCY = {
  daily: { type: 'daily_business_report', run: generateAndSendDailyBusinessReport },
  weekly: { type: 'weekly_business_report', run: generateAndSendWeeklyBusinessReport },
  monthly: { type: 'monthly_business_report', run: generateAndSendMonthlyBusinessReport },
  quarterly: { type: 'quarterly_business_report', run: generateAndSendQuarterlyBusinessReport },
};

// Manually re-runs a cadence right now, regardless of its ReportSchedule
// on/off state — an explicit admin click always overrides the toggle,
// same as the toggle never gating this endpoint in the first place.
router.post('/archive/regenerate', async (req, res) => {
  try {
    const frequency = REGENERATE_BY_FREQUENCY[req.body.frequency] ? req.body.frequency : 'daily';
    const { type, run } = REGENERATE_BY_FREQUENCY[frequency];

    await run();
    const [latest] = await reportRunRepository.find({ where: { type }, take: 1 });
    res.status(201).json({ success: true, data: latest });
  } catch (error) {
    logger.error({ err: error }, 'Regenerate business report error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to regenerate report' });
  }
});

router.get('/archive/:id', async (req, res) => {
  try {
    const run = await reportRunRepository.findById(req.params.id);
    if (!run) {
      return res.status(404).json({ success: false, message: 'Report run not found' });
    }
    res.json({ success: true, data: run });
  } catch (error) {
    logger.error({ err: error }, 'Get report archive run error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve report run' });
  }
});

router.get('/archive/:id/download', async (req, res) => {
  try {
    const run = await reportRunRepository.findById(req.params.id);
    if (!run) {
      return res.status(404).json({ success: false, message: 'Report run not found' });
    }
    if (!run.data) {
      return res.status(404).json({ success: false, message: 'This run has no data to download (skipped or failed)' });
    }

    const dateLabel = new Date(run.reportDate).toISOString().slice(0, 10);
    await sendReportExport(res, {
      format: exportFormat(req.query),
      baseFilename: `daily-business-report-${dateLabel}`,
      ...dailyBusinessReportToExportShape(run.data),
    });
  } catch (error) {
    logger.error({ err: error }, 'Download report archive run error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to download report run' });
  }
});

router.delete('/archive/:id', async (req, res) => {
  try {
    await reportRunRepository.deleteById(req.params.id);
    res.json({ success: true });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Report run not found' });
    }
    logger.error({ err: error }, 'Delete report archive run error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to delete report run' });
  }
});

// ── Report Delivery Schedules ───────────────────────────────────────────
// On/off toggle per cadence (daily/weekly/monthly/quarterly) — the actual
// firing time stays fixed in server.js's cron definitions. See the
// ReportSchedule model's own comment for why.

router.get('/schedules', async (req, res) => {
  try {
    const schedules = await reportScheduleRepository.list();
    res.json({ success: true, data: schedules });
  } catch (error) {
    logger.error({ err: error }, 'List report schedules error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to list report schedules' });
  }
});

router.patch('/schedules/:frequency', async (req, res) => {
  try {
    const { active } = req.body;
    const schedule = await reportScheduleRepository.setActive(req.params.frequency, active);
    res.json({ success: true, data: schedule });
  } catch (error) {
    logger.error({ err: error }, 'Update report schedule error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update report schedule' });
  }
});

// ── Dashboard Widgets ────────────────────────────────────────────────────
// Which summary cards are pinned to /admin, and their order. `/data`
// computes the live numbers behind each possible widget in one call — the
// dashboard itself decides which of those to render based on `/config`'s
// active flags.

router.get('/dashboard-widgets/config', async (req, res) => {
  try {
    const widgets = await dashboardWidgetRepository.list();
    res.json({ success: true, data: widgets });
  } catch (error) {
    logger.error({ err: error }, 'List dashboard widgets error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to list dashboard widgets' });
  }
});

router.patch('/dashboard-widgets/config/:key', async (req, res) => {
  try {
    const { active } = req.body;
    const widget = await dashboardWidgetRepository.setActive(req.params.key, active);
    res.json({ success: true, data: widget });
  } catch (error) {
    logger.error({ err: error }, 'Update dashboard widget error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to update dashboard widget' });
  }
});

router.put('/dashboard-widgets/config', async (req, res) => {
  try {
    const { widgets } = req.body; // [{ key, displayOrder, active? }, ...]
    const updated = await dashboardWidgetRepository.upsertMany(widgets);
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error({ err: error }, 'Reorder dashboard widgets error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to reorder dashboard widgets' });
  }
});

router.get('/dashboard-widgets/data', async (req, res) => {
  try {
    const now = new Date();
    const phOffset = 8 * 60 * 60 * 1000;
    const phNow = new Date(now.getTime() + phOffset);
    const startOfTodayPH = new Date(Date.UTC(phNow.getUTCFullYear(), phNow.getUTCMonth(), phNow.getUTCDate()) - phOffset);
    const todayFilter = { createdAt: { gte: startOfTodayPH } };

    const [todaysOrders, lowStock, pendingShipments, failedToday, mostViewedProducts, mostTriedOnProducts] = await Promise.all([
      orderRepository.find({ where: todayFilter, include: {} }),
      productRepository.count({ where: { active: true, totalStock: { gt: 0, lte: 5 } } }),
      // Payment Platform Redesign, Phase 2 — 'processing'/'confirmed' meant
      // "paid, not yet shipped" under the old model; that's now paid/
      // processing/packed (never 'confirmed', which nothing sets anymore).
      orderRepository.count({ where: { paymentStatus: 'paid', orderStatus: { in: ['paid', 'processing', 'packed'] } } }),
      orderRepository.count({ where: { paymentStatus: 'failed', ...todayFilter } }),
      productRepository.find({ where: { active: true }, orderBy: { totalViews: 'desc' }, take: 5 }),
      tryOnLogRepository.mostTried(5),
    ]);

    const todaysRevenue = todaysOrders
      .filter((o) => o.paymentStatus === 'paid')
      .reduce((s, o) => s + o.total, 0);

    res.json({
      success: true,
      data: {
        todaysRevenue,
        todaysOrders: todaysOrders.length,
        lowStock,
        pendingShipments,
        failedPayments: failedToday,
        mostViewedProducts: mostViewedProducts.map((p) => ({ name: p.name, image: p.images?.[0], totalViews: p.totalViews })),
        mostTriedOnProducts,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Dashboard widgets data error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to load dashboard widget data' });
  }
});

/**
 * Every report below fetches the relevant rows once via a repository call,
 * then groups/sums them in plain JS — replacing Mongo aggregation
 * pipelines ($group/$lookup/$unwind) rather than hand-translating each one
 * into raw SQL. Deliberate: these are admin-dashboard reads, not the
 * checkout hot path, and the resulting datasets (orders/try-on logs/
 * shipping events for a date range) are small enough that fetch-then-
 * reduce is both simpler and easier to verify than reproducing Mongo's
 * exact $dateToString bucketing and $lookup joins in SQL. Worth revisiting
 * with real SQL aggregation if order volume grows enough to make this a
 * real cost — not a concern at this platform's current scale.
 *
 * Each report's computation lives in its own computeXReport(query)
 * function, called by both the JSON route (GET /x) and the export route
 * (GET /x/export) — added alongside CSV/Excel export so the two never
 * duplicate the underlying query/aggregation logic. This is also the seam
 * a future cached/materialized-view version of a report would replace,
 * without either route needing to change.
 */

// Helper: parse date range from query params into a Prisma-shaped filter
export function getDateFilter(query) {
  const range = {};
  if (query.startDate) range.gte = new Date(query.startDate);
  if (query.endDate) {
    const end = new Date(query.endDate);
    end.setHours(23, 59, 59, 999);
    range.lte = end;
  }
  return Object.keys(range).length > 0 ? { createdAt: range } : {};
}

// Helper: choose time granularity based on date range
export function getGranularity(startDate, endDate) {
  if (!startDate && !endDate) return 'month';
  const start = startDate ? new Date(startDate) : new Date('2020-01-01');
  const end = endDate ? new Date(endDate) : new Date();
  const days = (end - start) / (1000 * 60 * 60 * 24);
  if (days <= 31) return 'day';
  if (days <= 180) return 'week';
  return 'month';
}

/**
 * Buckets a date into the same key shape Mongo's $dateToString produced
 * ('%Y-%m-%d', '%Y-W%V', '%Y-%m'), so every report's date-bucketed output
 * is unchanged for API consumers. The week case needs real ISO-8601 week
 * math (weeks start Monday, week 1 contains the year's first Thursday,
 * matching Mongo's %V) — not just a naive days-since-epoch divide.
 */
export function dateKey(date, granularity) {
  const d = new Date(date);
  if (granularity === 'day') return d.toISOString().slice(0, 10);
  if (granularity === 'month') return d.toISOString().slice(0, 7);

  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = utc.getUTCDay() || 7; // Mon=1..Sun=7
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum); // shift to this week's Thursday
  const isoYear = utc.getUTCFullYear();
  const yearStart = Date.UTC(isoYear, 0, 1);
  const weekNum = Math.ceil(((utc.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${isoYear}-W${String(weekNum).padStart(2, '0')}`;
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

const sortByDateKey = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

function exportFormat(query) {
  return query.format === 'xlsx' ? 'xlsx' : 'csv';
}

// ── Sales ────────────────────────────────────────────────────────────────

async function computeSalesReport(query) {
  const dateFilter = getDateFilter(query);
  const granularity = getGranularity(query.startDate, query.endDate);

  const paidOrders = await orderRepository.find({
    where: { paymentStatus: 'paid', ...dateFilter },
    include: { items: { include: { product: true } } },
  });

  const revenueOverTime = [...groupBy(paidOrders, (o) => dateKey(o.createdAt, granularity))]
    .map(([date, orders]) => ({ date, revenue: orders.reduce((s, o) => s + o.total, 0), orders: orders.length }))
    .sort(sortByDateKey);

  const allItems = paidOrders.flatMap((o) => o.items);

  const salesByCategory = [...groupBy(allItems, (i) => i.product?.category ?? 'unknown')]
    .map(([category, items]) => ({
      category,
      revenue: items.reduce((s, i) => s + i.price * i.quantity, 0),
      units: items.reduce((s, i) => s + i.quantity, 0),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const salesBySport = [...groupBy(allItems, (i) => i.product?.sport ?? 'unknown')]
    .map(([sport, items]) => ({
      sport,
      revenue: items.reduce((s, i) => s + i.price * i.quantity, 0),
      units: items.reduce((s, i) => s + i.quantity, 0),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = paidOrders.reduce((s, o) => s + o.total, 0);
  const totalOrders = paidOrders.length;
  const averageOrderValue = totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0;

  return { revenueOverTime, salesByCategory, salesBySport, totalRevenue, totalOrders, averageOrderValue };
}

router.get('/sales', async (req, res) => {
  try {
    res.json({ success: true, data: await computeSalesReport(req.query) });
  } catch (error) {
    logger.error({ err: error }, 'Sales report error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to generate sales report' });
  }
});

router.get('/sales/export', async (req, res) => {
  try {
    const data = await computeSalesReport(req.query);
    await sendReportExport(res, {
      format: exportFormat(req.query),
      baseFilename: 'sales-report',
      summary: [
        ['Total Revenue', data.totalRevenue],
        ['Total Orders', data.totalOrders],
        ['Average Order Value', data.averageOrderValue],
      ],
      sheets: [
        {
          name: 'Revenue Over Time',
          columns: [{ header: 'Date', key: 'date' }, { header: 'Revenue', key: 'revenue' }, { header: 'Orders', key: 'orders' }],
          rows: data.revenueOverTime,
          totals: { revenue: true, orders: true },
        },
        {
          name: 'By Category',
          columns: [{ header: 'Category', key: 'category' }, { header: 'Revenue', key: 'revenue' }, { header: 'Units', key: 'units' }],
          rows: data.salesByCategory,
          totals: { revenue: true, units: true },
        },
        {
          name: 'By Sport',
          columns: [{ header: 'Sport', key: 'sport' }, { header: 'Revenue', key: 'revenue' }, { header: 'Units', key: 'units' }],
          rows: data.salesBySport,
          totals: { revenue: true, units: true },
        },
      ],
    });
  } catch (error) {
    logger.error({ err: error }, 'Sales report export error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to export sales report' });
  }
});

// ── Products ─────────────────────────────────────────────────────────────

async function computeProductsReport(query) {
  const dateFilter = getDateFilter(query);

  const paidOrders = await orderRepository.find({
    where: { paymentStatus: 'paid', ...dateFilter },
    include: { items: { include: { product: true } } },
  });
  const allItems = paidOrders.flatMap((o) => o.items);

  const productAgg = [...groupBy(allItems, (i) => i.product._id)].map(([, items]) => ({
    name: items[0].name,
    image: items[0].image,
    units: items.reduce((s, i) => s + i.quantity, 0),
    revenue: items.reduce((s, i) => s + i.price * i.quantity, 0),
  }));
  const bestSellers = [...productAgg].sort((a, b) => b.units - a.units).slice(0, 10);
  const worstSellers = [...productAgg].sort((a, b) => a.units - b.units).slice(0, 10);

  const salesByLeague = [...groupBy(allItems.filter((i) => i.product.league), (i) => i.product.league)]
    .map(([league, items]) => ({
      league,
      revenue: items.reduce((s, i) => s + i.price * i.quantity, 0),
      units: items.reduce((s, i) => s + i.quantity, 0),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const salesByTeam = [...groupBy(allItems.filter((i) => i.product.team), (i) => i.product.team)]
    .map(([team, items]) => ({
      team,
      revenue: items.reduce((s, i) => s + i.price * i.quantity, 0),
      units: items.reduce((s, i) => s + i.quantity, 0),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 15);

  const [outOfStock, lowStock, healthy, lowStockProducts] = await Promise.all([
    productRepository.count({ where: { active: true, totalStock: 0 } }),
    productRepository.count({ where: { active: true, totalStock: { gt: 0, lte: 5 } } }),
    productRepository.count({ where: { active: true, totalStock: { gt: 5 } } }),
    productRepository.find({
      where: { active: true, totalStock: { lte: 5 } },
      orderBy: { totalStock: 'asc' },
      take: 15,
    }),
  ]);

  return {
    bestSellers,
    worstSellers,
    salesByLeague,
    salesByTeam,
    stockLevels: { outOfStock, lowStock, healthy },
    lowStockProducts,
  };
}

router.get('/products', async (req, res) => {
  try {
    res.json({ success: true, data: await computeProductsReport(req.query) });
  } catch (error) {
    logger.error({ err: error }, 'Products report error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to generate products report' });
  }
});

router.get('/products/export', async (req, res) => {
  try {
    const data = await computeProductsReport(req.query);
    await sendReportExport(res, {
      format: exportFormat(req.query),
      baseFilename: 'products-report',
      summary: [
        ['Out of Stock', data.stockLevels.outOfStock],
        ['Low Stock', data.stockLevels.lowStock],
        ['Healthy Stock', data.stockLevels.healthy],
      ],
      sheets: [
        {
          name: 'Best Sellers',
          columns: [{ header: 'Product', key: 'name' }, { header: 'Units', key: 'units' }, { header: 'Revenue', key: 'revenue' }],
          rows: data.bestSellers,
          totals: { units: true, revenue: true },
        },
        {
          name: 'Worst Sellers',
          columns: [{ header: 'Product', key: 'name' }, { header: 'Units', key: 'units' }, { header: 'Revenue', key: 'revenue' }],
          rows: data.worstSellers,
          totals: { units: true, revenue: true },
        },
        {
          name: 'By League',
          columns: [{ header: 'League', key: 'league' }, { header: 'Revenue', key: 'revenue' }, { header: 'Units', key: 'units' }],
          rows: data.salesByLeague,
          totals: { revenue: true, units: true },
        },
        {
          name: 'By Team',
          columns: [{ header: 'Team', key: 'team' }, { header: 'Revenue', key: 'revenue' }, { header: 'Units', key: 'units' }],
          rows: data.salesByTeam,
          totals: { revenue: true, units: true },
        },
        {
          name: 'Low Stock',
          columns: [{ header: 'Product', key: 'name' }, { header: 'Stock', key: 'totalStock' }],
          rows: data.lowStockProducts,
        },
      ],
    });
  } catch (error) {
    logger.error({ err: error }, 'Products report export error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to export products report' });
  }
});

// ── Orders ───────────────────────────────────────────────────────────────

async function computeOrdersReport(query) {
  const dateFilter = getDateFilter(query);
  const granularity = getGranularity(query.startDate, query.endDate);

  const orders = await orderRepository.find({ where: { ...dateFilter }, include: {} });

  const ordersOverTime = [...groupBy(orders, (o) => dateKey(o.createdAt, granularity))]
    .map(([date, os]) => ({ date, count: os.length }))
    .sort(sortByDateKey);

  const statusBreakdown = [...groupBy(orders, (o) => o.orderStatus)]
    .map(([status, os]) => ({ status, count: os.length }))
    .sort((a, b) => b.count - a.count);

  const paymentBreakdown = [...groupBy(orders, (o) => o.paymentStatus)]
    .map(([status, os]) => ({ status, count: os.length }))
    .sort((a, b) => b.count - a.count);

  const total = orders.length;
  const delivered = orders.filter((o) => o.orderStatus === 'delivered').length;
  const cancelled = orders.filter((o) => o.orderStatus === 'cancelled').length;
  // Payment Platform Redesign, Phase 2 — an order that never got paid was
  // never going to be fulfilled either, same reasoning 'cancelled' was
  // already excluded for; expired/failed_payment now make that a real,
  // distinguishable status instead of being invisible inside 'processing'.
  const neverPaid = orders.filter((o) => o.orderStatus === 'expired' || o.orderStatus === 'failed_payment').length;
  const eligibleOrders = total - cancelled - neverPaid;
  const fulfillmentRate = eligibleOrders > 0 ? Math.round((delivered / eligibleOrders) * 10000) / 100 : 0;

  const failedOrders = orders.filter((o) => o.paymentStatus === 'failed');
  const failedPayments = { count: failedOrders.length, totalValue: failedOrders.reduce((s, o) => s + o.total, 0) };

  return {
    ordersOverTime,
    statusBreakdown,
    paymentBreakdown,
    fulfillmentRate,
    totalOrders: total,
    deliveredOrders: delivered,
    cancelledOrders: cancelled,
    failedPayments,
  };
}

router.get('/orders', async (req, res) => {
  try {
    res.json({ success: true, data: await computeOrdersReport(req.query) });
  } catch (error) {
    logger.error({ err: error }, 'Orders report error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to generate orders report' });
  }
});

router.get('/orders/export', async (req, res) => {
  try {
    const data = await computeOrdersReport(req.query);
    await sendReportExport(res, {
      format: exportFormat(req.query),
      baseFilename: 'orders-report',
      summary: [
        ['Total Orders', data.totalOrders],
        ['Delivered', data.deliveredOrders],
        ['Cancelled', data.cancelledOrders],
        ['Fulfillment Rate', `${data.fulfillmentRate}%`],
        ['Failed Payments (count)', data.failedPayments.count],
        ['Failed Payments (value)', data.failedPayments.totalValue],
      ],
      sheets: [
        {
          name: 'Orders Over Time',
          columns: [{ header: 'Date', key: 'date' }, { header: 'Orders', key: 'count' }],
          rows: data.ordersOverTime,
          totals: { count: true },
        },
        {
          name: 'Order Status',
          columns: [{ header: 'Status', key: 'status' }, { header: 'Count', key: 'count' }],
          rows: data.statusBreakdown,
          totals: { count: true },
        },
        {
          name: 'Payment Status',
          columns: [{ header: 'Status', key: 'status' }, { header: 'Count', key: 'count' }],
          rows: data.paymentBreakdown,
          totals: { count: true },
        },
      ],
    });
  } catch (error) {
    logger.error({ err: error }, 'Orders report export error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to export orders report' });
  }
});

// ── Customers ────────────────────────────────────────────────────────────

async function computeCustomersReport(query) {
  const dateFilter = getDateFilter(query);
  const granularity = getGranularity(query.startDate, query.endDate);

  // No `user` include — order.user then falls back to the bare userId
  // (or null for a guest order), matching the raw $user field Mongo's
  // pipeline grouped by before any $lookup.
  const paidOrders = await orderRepository.find({ where: { paymentStatus: 'paid', ...dateFilter }, include: {} });

  const byCustomer = groupBy(paidOrders, (o) => o.user || o.email);
  const customerAgg = [...byCustomer.values()].map((os) => ({
    userId: os[0].user || null,
    email: os[0].email,
    totalSpent: os.reduce((s, o) => s + o.total, 0),
    orderCount: os.length,
  }));

  const top10 = [...customerAgg].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10);
  const userIds = top10.filter((c) => c.userId).map((c) => c.userId);
  const users = userIds.length ? await userRepository.find({ where: { id: { in: userIds } } }) : [];
  const userById = new Map(users.map((u) => [u._id, u]));

  const topCustomers = top10.map((c) => {
    const user = c.userId ? userById.get(c.userId) : null;
    return {
      name: user ? `${user.firstName} ${user.lastName}` : c.email,
      email: c.email,
      totalSpent: c.totalSpent,
      orderCount: c.orderCount,
    };
  });

  const geographicDistribution = [...groupBy(paidOrders, (o) => o.shippingAddress.province)]
    .map(([province, os]) => ({ province, orders: os.length, revenue: os.reduce((s, o) => s + o.total, 0) }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 15);

  const cityDistribution = [...groupBy(paidOrders, (o) => o.shippingAddress.city)]
    .map(([city, os]) => ({ city, orders: os.length, revenue: os.reduce((s, o) => s + o.total, 0) }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 15);

  const newCustomers = customerAgg.filter((c) => c.orderCount === 1).length;
  const returningCustomers = customerAgg.filter((c) => c.orderCount > 1).length;

  const usersInRange = await userRepository.find({ where: { ...dateFilter } });
  const customerGrowth = [...groupBy(usersInRange, (u) => dateKey(u.createdAt, granularity))]
    .map(([date, us]) => ({ date, count: us.length }))
    .sort(sortByDateKey);

  return {
    topCustomers,
    geographicDistribution,
    cityDistribution,
    newVsReturning: { newCustomers, returningCustomers },
    customerGrowth,
  };
}

router.get('/customers', async (req, res) => {
  try {
    res.json({ success: true, data: await computeCustomersReport(req.query) });
  } catch (error) {
    logger.error({ err: error }, 'Customers report error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to generate customers report' });
  }
});

router.get('/customers/export', async (req, res) => {
  try {
    const data = await computeCustomersReport(req.query);
    await sendReportExport(res, {
      format: exportFormat(req.query),
      baseFilename: 'customers-report',
      summary: [
        ['New Customers', data.newVsReturning.newCustomers],
        ['Returning Customers', data.newVsReturning.returningCustomers],
      ],
      sheets: [
        {
          name: 'Top Customers',
          columns: [{ header: 'Name', key: 'name' }, { header: 'Email', key: 'email' }, { header: 'Total Spent', key: 'totalSpent' }, { header: 'Orders', key: 'orderCount' }],
          rows: data.topCustomers,
          totals: { totalSpent: true, orderCount: true },
        },
        {
          name: 'By Province',
          columns: [{ header: 'Province', key: 'province' }, { header: 'Orders', key: 'orders' }, { header: 'Revenue', key: 'revenue' }],
          rows: data.geographicDistribution,
          totals: { orders: true, revenue: true },
        },
        {
          name: 'By City',
          columns: [{ header: 'City', key: 'city' }, { header: 'Orders', key: 'orders' }, { header: 'Revenue', key: 'revenue' }],
          rows: data.cityDistribution,
          totals: { orders: true, revenue: true },
        },
        {
          name: 'Customer Growth',
          columns: [{ header: 'Date', key: 'date' }, { header: 'New Signups', key: 'count' }],
          rows: data.customerGrowth,
          totals: { count: true },
        },
      ],
    });
  } catch (error) {
    logger.error({ err: error }, 'Customers report export error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to export customers report' });
  }
});

// ── AI Try-On ────────────────────────────────────────────────────────────

async function computeTryOnReport(query) {
  const dateFilter = getDateFilter(query);
  const granularity = getGranularity(query.startDate, query.endDate);

  const logs = await tryOnLogRepository.find({ where: { ...dateFilter }, orderBy: { createdAt: 'desc' } });

  const tryOnOverTime = [...groupBy(logs, (l) => dateKey(l.createdAt, granularity))]
    .map(([date, ls]) => ({ date, count: ls.length }))
    .sort(sortByDateKey);

  const totalAttempts = logs.length;
  const successfulAttempts = logs.filter((l) => l.success === true).length;
  const successRate = totalAttempts > 0 ? Math.round((successfulAttempts / totalAttempts) * 10000) / 100 : 0;

  // product falls back to the bare productId (or null) — no `include`
  // requested, same reasoning as the customers report above. Entries
  // with no resolved product all group together under one null bucket,
  // matching the original pipeline's exact (if imprecise) behavior.
  const mostTriedProducts = [...groupBy(logs, (l) => l.product ?? 'unresolved').values()]
    .map((ls) => ({ productName: ls[0].productName, productImage: ls[0].productImage, count: ls.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const recentTryOns = logs.slice(0, 10).map((l) => ({
    productName: l.productName,
    productImage: l.productImage,
    success: l.success,
    createdAt: l.createdAt,
  }));

  // Real observed speed/reliability per WaveSpeed model (or Replicate) —
  // added to answer empirically which model to run in production,
  // rather than relying on provider documentation, which turned out to
  // be incomplete/inconsistent on latency. Rows logged before this field
  // existed fall back to 'unknown'; durationMs can be null on an attempt
  // that failed before generation started, so the average excludes those
  // rather than counting them as 0ms.
  const byProvider = [...groupBy(logs, (l) => l.provider ?? 'unknown').entries()]
    .map(([provider, ls]) => {
      const withDuration = ls.filter((l) => l.durationMs != null);
      const avgDurationMs = withDuration.length > 0
        ? Math.round(withDuration.reduce((s, l) => s + l.durationMs, 0) / withDuration.length)
        : null;
      const successCount = ls.filter((l) => l.success === true).length;
      return {
        provider,
        attempts: ls.length,
        avgDurationMs,
        successRate: ls.length > 0 ? Math.round((successCount / ls.length) * 10000) / 100 : 0,
      };
    })
    .sort((a, b) => b.attempts - a.attempts);

  return { tryOnOverTime, totalAttempts, successfulAttempts, successRate, mostTriedProducts, recentTryOns, byProvider };
}

router.get('/tryon', async (req, res) => {
  try {
    res.json({ success: true, data: await computeTryOnReport(req.query) });
  } catch (error) {
    logger.error({ err: error }, 'Try-on report error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to generate try-on report' });
  }
});

router.get('/tryon/export', async (req, res) => {
  try {
    const data = await computeTryOnReport(req.query);
    await sendReportExport(res, {
      format: exportFormat(req.query),
      baseFilename: 'tryon-report',
      summary: [
        ['Total Attempts', data.totalAttempts],
        ['Successful', data.successfulAttempts],
        ['Success Rate', `${data.successRate}%`],
      ],
      sheets: [
        {
          name: 'Try-On Over Time',
          columns: [{ header: 'Date', key: 'date' }, { header: 'Attempts', key: 'count' }],
          rows: data.tryOnOverTime,
          totals: { count: true },
        },
        {
          name: 'Most Tried Products',
          columns: [{ header: 'Product', key: 'productName' }, { header: 'Attempts', key: 'count' }],
          rows: data.mostTriedProducts,
          totals: { count: true },
        },
        {
          name: 'By Provider',
          columns: [{ header: 'Provider', key: 'provider' }, { header: 'Attempts', key: 'attempts' }, { header: 'Avg Duration (ms)', key: 'avgDurationMs' }, { header: 'Success Rate (%)', key: 'successRate' }],
          rows: data.byProvider,
          totals: { attempts: true },
        },
        {
          name: 'Recent Attempts',
          columns: [{ header: 'Product', key: 'productName' }, { header: 'Success', key: 'success' }, { header: 'Date', key: 'createdAt' }],
          rows: data.recentTryOns,
        },
      ],
    });
  } catch (error) {
    logger.error({ err: error }, 'Try-on report export error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to export try-on report' });
  }
});

// ── Shipping ─────────────────────────────────────────────────────────────

async function computeShippingReport(query) {
  const dateFilter = getDateFilter(query);

  const rawEvents = await shippingEventRepository.find({ where: { ...dateFilter }, orderBy: { createdAt: 'desc' } });

  const methodBreakdown = [...groupBy(rawEvents, (e) => `${e.shippingMethod}::${e.region ?? ''}`).values()]
    .map((events) => ({
      _id: { method: events[0].shippingMethod, region: events[0].region },
      count: events.length,
      totalRevenue: events.reduce((s, e) => s + e.orderTotal, 0),
    }))
    .sort((a, b) => b.count - a.count);

  return { methodBreakdown, rawEvents, totalOrders: rawEvents.length };
}

router.get('/shipping', async (req, res) => {
  try {
    res.json({ success: true, data: await computeShippingReport(req.query) });
  } catch (error) {
    logger.error({ err: error }, 'Shipping report error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to generate shipping report' });
  }
});

router.get('/shipping/export', async (req, res) => {
  try {
    const data = await computeShippingReport(req.query);
    const methodRows = data.methodBreakdown.map((m) => ({ method: m._id.method, region: m._id.region, count: m.count, totalRevenue: m.totalRevenue }));
    await sendReportExport(res, {
      format: exportFormat(req.query),
      baseFilename: 'shipping-report',
      summary: [['Total Orders', data.totalOrders]],
      sheets: [
        {
          name: 'Method Breakdown',
          columns: [{ header: 'Method', key: 'method' }, { header: 'Region', key: 'region' }, { header: 'Count', key: 'count' }, { header: 'Total Revenue', key: 'totalRevenue' }],
          rows: methodRows,
          totals: { count: true, totalRevenue: true },
        },
        {
          name: 'Raw Events',
          columns: [{ header: 'Order', key: 'orderId' }, { header: 'Method', key: 'shippingMethod' }, { header: 'Region', key: 'region' }, { header: 'Order Total', key: 'orderTotal' }, { header: 'Date', key: 'createdAt' }],
          rows: data.rawEvents,
        },
      ],
    });
  } catch (error) {
    logger.error({ err: error }, 'Shipping report export error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to export shipping report' });
  }
});

// ── Checkout Recovery (Payment Platform Redesign, Phase 7) ─────────────────
// The metric the daily business report email has flagged as "not yet
// tracked by the platform" since before this whole redesign started — now
// buildable for real, off Payment (Phase 1) and OrderStatus (Phase 2)
// rather than fabricated. Scoped to orders *created* within the selected
// range, same convention every other report here uses.

async function computeCheckoutRecoveryReport(query) {
  const dateFilter = getDateFilter(query);

  const orders = await orderRepository.find({
    where: { ...dateFilter },
    include: { payments: true },
  });

  const pendingOrders = orders.filter((o) => o.orderStatus === 'awaiting_payment');
  const neverRecovered = orders.filter((o) => o.orderStatus === 'expired' || o.orderStatus === 'failed_payment');
  const withAttempt = orders.filter((o) => o.payments.length > 0);
  // "Recovered" means the order showed real friction (more than one
  // checkout attempt) and still ended up paid — a session simply succeeding
  // on the first try isn't a recovery, it's the happy path.
  const recovered = orders.filter((o) => o.paymentStatus === 'paid' && o.payments.length > 1);

  const atRiskCount = recovered.length + neverRecovered.length;
  const recoveryRate = atRiskCount > 0 ? Math.round((recovered.length / atRiskCount) * 1000) / 10 : 0;
  const abandonmentRate = withAttempt.length > 0 ? Math.round((neverRecovered.length / withAttempt.length) * 1000) / 10 : 0;

  // paidAt lives on Payment, not Order — the succeeded attempt among this
  // order's rows is the one that actually carries it.
  const recoveryTimesMinutes = recovered
    .map((o) => {
      const paidAt = o.payments.find((p) => p.status === 'succeeded' && p.paidAt)?.paidAt;
      return paidAt ? (new Date(paidAt).getTime() - new Date(o.createdAt).getTime()) / 60000 : null;
    })
    .filter((minutes) => minutes !== null);
  const avgRecoveryTimeMinutes = recoveryTimesMinutes.length
    ? Math.round(recoveryTimesMinutes.reduce((s, m) => s + m, 0) / recoveryTimesMinutes.length)
    : 0;

  const allPayments = orders.flatMap((o) => o.payments);
  const resolvedPayments = allPayments.filter((p) => ['succeeded', 'failed', 'expired'].includes(p.status));
  const providerBreakdown = [...groupBy(resolvedPayments, (p) => p.provider).entries()].map(([provider, payments]) => {
    const succeeded = payments.filter((p) => p.status === 'succeeded').length;
    return {
      provider,
      succeeded,
      total: payments.length,
      successRate: payments.length ? Math.round((succeeded / payments.length) * 1000) / 10 : 0,
    };
  });

  const expiredSessions = allPayments.filter((p) => p.status === 'expired').length;
  const revenueRecovered = recovered.reduce((s, o) => s + o.total, 0);
  const retryCount = orders.reduce((s, o) => s + Math.max(0, o.payments.length - 1), 0);

  return {
    pendingOrders: pendingOrders.length,
    recoveredPayments: recovered.length,
    neverRecovered: neverRecovered.length,
    recoveryRate,
    abandonmentRate,
    avgRecoveryTimeMinutes,
    providerBreakdown,
    expiredSessions,
    revenueRecovered,
    retryCount,
    totalOrders: orders.length,
  };
}

router.get('/checkout-recovery', async (req, res) => {
  try {
    res.json({ success: true, data: await computeCheckoutRecoveryReport(req.query) });
  } catch (error) {
    logger.error({ err: error }, 'Checkout recovery report error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to generate checkout recovery report' });
  }
});

router.get('/checkout-recovery/export', async (req, res) => {
  try {
    const data = await computeCheckoutRecoveryReport(req.query);
    await sendReportExport(res, {
      format: exportFormat(req.query),
      baseFilename: 'checkout-recovery-report',
      summary: [
        ['Pending Orders', data.pendingOrders],
        ['Recovered Payments', data.recoveredPayments],
        ['Never Recovered', data.neverRecovered],
        ['Recovery Rate', `${data.recoveryRate}%`],
        ['Abandonment Rate', `${data.abandonmentRate}%`],
        ['Avg Recovery Time (min)', data.avgRecoveryTimeMinutes],
        ['Expired Sessions', data.expiredSessions],
        ['Revenue Recovered', data.revenueRecovered],
        ['Retry Count', data.retryCount],
      ],
      sheets: [
        {
          name: 'Provider Success Rate',
          columns: [
            { header: 'Provider', key: 'provider' },
            { header: 'Succeeded', key: 'succeeded' },
            { header: 'Total', key: 'total' },
            { header: 'Success Rate', key: 'successRate' },
          ],
          rows: data.providerBreakdown,
        },
      ],
    });
  } catch (error) {
    logger.error({ err: error }, 'Checkout recovery report export error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to export checkout recovery report' });
  }
});

// Webhook Health — no export (a live-status panel, not a period report).
router.get('/webhook-health', async (req, res) => {
  try {
    res.json({ success: true, data: await paymentRepository.getWebhookHealth() });
  } catch (error) {
    logger.error({ err: error }, 'Webhook health error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to load webhook health' });
  }
});

export default router;
