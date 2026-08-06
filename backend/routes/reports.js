import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import * as orderRepository from '../repositories/orderRepository.js';
import * as productRepository from '../repositories/productRepository.js';
import * as userRepository from '../repositories/userRepository.js';
import * as tryOnLogRepository from '../repositories/tryOnLogRepository.js';
import * as reportRecipientRepository from '../repositories/reportRecipientRepository.js';
import * as reportRunRepository from '../repositories/reportRunRepository.js';
import * as reportScheduleRepository from '../repositories/reportScheduleRepository.js';
import * as dashboardWidgetRepository from '../repositories/dashboardWidgetRepository.js';
import * as paymentRepository from '../repositories/paymentRepository.js';
import { sendReportExport } from '../lib/reportExport.js';
import { getDateFilter, getGranularity, dateKey, groupBy, sortByDateKey, exportFormat } from '../lib/reportQueryHelpers.js';
import { computeSalesReport, salesReportToExportShape } from '../services/reportQueries/sales.js';
import { computeProductsReport, productsReportToExportShape } from '../services/reportQueries/products.js';
import { computeOrdersReport } from '../services/reportQueries/orders.js';
import { computeExecutiveReport, executiveReportToExportShape } from '../services/reportQueries/executive.js';
import { computeFitCheckAnalyticsReport, fitCheckAnalyticsReportToExportShape } from '../services/reportQueries/fitCheckAnalytics.js';
import { computeOrganizationsReport, organizationsReportToExportShape } from '../services/reportQueries/organizations.js';
import { computeFinanceReport, financeReportToExportShape } from '../services/reportQueries/finance.js';
import { computeShippingReport, shippingReportToExportShape } from '../services/reportQueries/shipping.js';
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
  // Daily now fans out into six archived runs (Reports Module Redesign,
  // Phase 3) — no single ReportRunType to look up afterward the way the
  // other three cadences still have.
  daily: { type: null, run: generateAndSendDailyBusinessReport },
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
    const latest = type ? (await reportRunRepository.find({ where: { type }, take: 1 }))[0] ?? null : null;
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
 *
 * getDateFilter/getGranularity/dateKey/groupBy/sortByDateKey/exportFormat
 * live in lib/reportQueryHelpers.js (not defined here) so the
 * services/reportQueries/*.js modules below can reuse them without a
 * circular import back into this router file.
 */

// ── Executive Dashboard ─────────────────────────────────────────────────
// computeExecutiveReport lives in services/reportQueries/executive.js — it
// composes computeSalesReport/computeProductsReport/computeOrdersReport
// rather than recomputing their totals, plus two genuinely new pieces
// (the alerts feed, the deterministic executive summary text).

router.get('/executive', async (req, res) => {
  try {
    res.json({ success: true, data: await computeExecutiveReport(req.query) });
  } catch (error) {
    logger.error({ err: error }, 'Executive report error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to generate executive report' });
  }
});

router.get('/executive/export', async (req, res) => {
  try {
    const data = await computeExecutiveReport(req.query);
    await sendReportExport(res, {
      format: exportFormat(req.query),
      baseFilename: 'executive-report',
      ...executiveReportToExportShape(data),
    });
  } catch (error) {
    logger.error({ err: error }, 'Executive report export error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to export executive report' });
  }
});

// ── Sales ────────────────────────────────────────────────────────────────
// computeSalesReport itself now lives in services/reportQueries/sales.js —
// see that file's header comment for why (executive.js reuses it without a
// circular import, and Phase 3's scheduled email will call it directly).

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
      ...salesReportToExportShape(data),
    });
  } catch (error) {
    logger.error({ err: error }, 'Sales report export error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to export sales report' });
  }
});

// ── Products ─────────────────────────────────────────────────────────────
// computeProductsReport now lives in services/reportQueries/products.js.

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
      ...productsReportToExportShape(data),
    });
  } catch (error) {
    logger.error({ err: error }, 'Products report export error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to export products report' });
  }
});

// ── Orders ───────────────────────────────────────────────────────────────
// computeOrdersReport now lives in services/reportQueries/orders.js.

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

  // `include: { user }` resolves the email for the full-log table below —
  // for upper-management visibility into who's actually using Fit Check,
  // not just aggregate counts. A guest attempt has no `user` row at all
  // (userId is null), so `log.user?.email` naturally falls through to
  // undefined and gets labeled "Guest" where this list is built.
  const logs = await tryOnLogRepository.find({
    where: { ...dateFilter },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { email: true } } },
  });

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

  // The full per-attempt log for the date range, not just a "recent 10"
  // preview — this is what answers "who used Fit Check and when" for
  // upper-management reporting. Ordered desc (from the query above), never
  // sliced here — the /tryon route paginates it for the live table, and
  // /tryon/export ships it in full.
  const tryOnLog = logs.map((l) => ({
    productName: l.productName,
    productImage: l.productImage,
    success: l.success,
    createdAt: l.createdAt,
    email: l.user?.email || 'Guest',
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

  return { tryOnOverTime, totalAttempts, successfulAttempts, successRate, mostTriedProducts, tryOnLog, byProvider };
}

router.get('/tryon', async (req, res) => {
  try {
    const data = await computeTryOnReport(req.query);

    // Pagination applies only to the live table, not the computed
    // aggregates above it (chart/totals/most-tried already reflect the
    // full date range regardless of which page of the log is showing).
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const start = (page - 1) * pageSize;
    const pageRows = data.tryOnLog.slice(start, start + pageSize);

    res.json({
      success: true,
      data: {
        ...data,
        tryOnLog: pageRows,
        tryOnLogTotal: data.tryOnLog.length,
        page,
        pageSize,
      },
    });
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
          name: 'Fit Check Log',
          columns: [
            { header: 'Date', key: 'createdAt' },
            { header: 'Email', key: 'email' },
            { header: 'Product', key: 'productName' },
            { header: 'Success', key: 'success' },
          ],
          // Full date-range log, not the live table's current page — an
          // export is meant to be a complete record.
          rows: data.tryOnLog,
        },
      ],
    });
  } catch (error) {
    logger.error({ err: error }, 'Try-on report export error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to export try-on report' });
  }
});

// ── Fit Check Analytics ─────────────────────────────────────────────────
// computeFitCheckAnalyticsReport lives in services/reportQueries/fitCheckAnalytics.js
// — the dedicated workspace superseding the old flat page's Try-On section,
// with 11 requested metrics (guest/registered/premium split, cost per
// provider, conversion/revenue attribution, sponsored campaign
// performance) beyond what /tryon above already covers. /tryon itself is
// untouched — still used by the Exports picker and its own log/pagination
// behavior, this is additive, not a replacement.

router.get('/fit-check', async (req, res) => {
  try {
    const data = await computeFitCheckAnalyticsReport(req.query);

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const start = (page - 1) * pageSize;
    const pageRows = data.tryOnLog.slice(start, start + pageSize);

    res.json({
      success: true,
      data: { ...data, tryOnLog: pageRows, tryOnLogTotal: data.tryOnLog.length, page, pageSize },
    });
  } catch (error) {
    logger.error({ err: error }, 'Fit Check Analytics report error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to generate Fit Check Analytics report' });
  }
});

router.get('/fit-check/export', async (req, res) => {
  try {
    const data = await computeFitCheckAnalyticsReport(req.query);
    await sendReportExport(res, {
      format: exportFormat(req.query),
      baseFilename: 'fit-check-analytics-report',
      ...fitCheckAnalyticsReportToExportShape(data),
    });
  } catch (error) {
    logger.error({ err: error }, 'Fit Check Analytics report export error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to export Fit Check Analytics report' });
  }
});

// ── Organizations ────────────────────────────────────────────────────────
// computeOrganizationsReport lives in services/reportQueries/organizations.js.
// Queries the new Organization/Team FK model exclusively — see that file's
// header comment.

router.get('/organizations', async (req, res) => {
  try {
    res.json({ success: true, data: await computeOrganizationsReport(req.query) });
  } catch (error) {
    logger.error({ err: error }, 'Organizations report error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to generate organizations report' });
  }
});

router.get('/organizations/export', async (req, res) => {
  try {
    const data = await computeOrganizationsReport(req.query);
    await sendReportExport(res, {
      format: exportFormat(req.query),
      baseFilename: 'organizations-report',
      ...organizationsReportToExportShape(data),
    });
  } catch (error) {
    logger.error({ err: error }, 'Organizations report export error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to export organizations report' });
  }
});

// ── Finance ──────────────────────────────────────────────────────────────
// computeFinanceReport lives in services/reportQueries/finance.js. Fee
// breakdown is explicitly out of scope (feeBreakdownAvailable: false) —
// no feeAmount field exists anywhere yet; confirmed decision to ship
// without it rather than add a migration for it this pass.

router.get('/finance', async (req, res) => {
  try {
    res.json({ success: true, data: await computeFinanceReport(req.query) });
  } catch (error) {
    logger.error({ err: error }, 'Finance report error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to generate finance report' });
  }
});

router.get('/finance/export', async (req, res) => {
  try {
    const data = await computeFinanceReport(req.query);
    await sendReportExport(res, {
      format: exportFormat(req.query),
      baseFilename: 'finance-report',
      ...financeReportToExportShape(data),
    });
  } catch (error) {
    logger.error({ err: error }, 'Finance report export error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to export finance report' });
  }
});

// ── Shipping ─────────────────────────────────────────────────────────────
// computeShippingReport now lives in services/reportQueries/shipping.js —
// the Fulfillment Report (below) composes it without a circular import.

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
    await sendReportExport(res, {
      format: exportFormat(req.query),
      baseFilename: 'shipping-report',
      ...shippingReportToExportShape(data),
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
