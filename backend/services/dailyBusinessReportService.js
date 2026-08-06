import logger from '../lib/logger.js';
import * as orderRepository from '../repositories/orderRepository.js';
import * as productRepository from '../repositories/productRepository.js';
import * as tryOnLogRepository from '../repositories/tryOnLogRepository.js';
import * as organizationRepository from '../repositories/organizationRepository.js';
import * as reportRecipientRepository from '../repositories/reportRecipientRepository.js';
import * as reportRunRepository from '../repositories/reportRunRepository.js';
import * as shipmentRepository from '../repositories/shipmentRepository.js';
import * as returnRequestRepository from '../repositories/returnRequestRepository.js';
import * as refundRepository from '../repositories/refundRepository.js';
import { sendDailyBusinessReportEmail } from './emailService.js';
import { STAGE_THRESHOLD_HOURS } from '../lib/sweepFulfillmentSLA.js';

const LOW_STOCK_THRESHOLD = 5; // matches the threshold already used by admin stats / products report

// PH has no DST, so a fixed +8h offset is safe to hardcode — same
// assumption the original daily-only version of this file already made.
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * Midnight-today in Philippine time, as a UTC instant. Built entirely in
 * UTC math (Date.UTC + the PH offset), never mixing local-timezone Date
 * construction with a UTC read — that mismatch is exactly what caused a
 * real off-by-one-day bug in DateRangeSelector.jsx's lastMonth preset.
 */
function startOfTodayPH(now) {
  const phNow = new Date(now.getTime() + PH_OFFSET_MS);
  return new Date(Date.UTC(phNow.getUTCFullYear(), phNow.getUTCMonth(), phNow.getUTCDate()) - PH_OFFSET_MS);
}

/** Yesterday's [start, end) window in Philippine time (UTC+8), as UTC instants. */
function yesterdayRangePH(now = new Date()) {
  const end = startOfTodayPH(now);
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return { start, end };
}

/** The 7 days just completed — [start, end) ending at today 00:00 PH. */
function lastWeekRangePH(now = new Date()) {
  const end = startOfTodayPH(now);
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { start, end };
}

/** The full previous calendar month in Philippine time. */
function lastMonthRangePH(now = new Date()) {
  const phNow = new Date(now.getTime() + PH_OFFSET_MS);
  const end = new Date(Date.UTC(phNow.getUTCFullYear(), phNow.getUTCMonth(), 1) - PH_OFFSET_MS);
  const start = new Date(Date.UTC(phNow.getUTCFullYear(), phNow.getUTCMonth() - 1, 1) - PH_OFFSET_MS);
  return { start, end };
}

/** The full previous calendar quarter (Jan-Mar / Apr-Jun / Jul-Sep / Oct-Dec) in Philippine time. */
function lastQuarterRangePH(now = new Date()) {
  const phNow = new Date(now.getTime() + PH_OFFSET_MS);
  const currentQuarterStartMonth = Math.floor(phNow.getUTCMonth() / 3) * 3;
  const end = new Date(Date.UTC(phNow.getUTCFullYear(), currentQuarterStartMonth, 1) - PH_OFFSET_MS);
  const start = new Date(Date.UTC(phNow.getUTCFullYear(), currentQuarterStartMonth - 3, 1) - PH_OFFSET_MS);
  return { start, end };
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

async function buildSalesSection(allOrders, paidOrders) {
  const grossRevenue = paidOrders.reduce((s, o) => s + o.total, 0);
  const shippingRevenue = paidOrders.reduce((s, o) => s + o.shippingFee, 0);
  const refundedOrders = allOrders.filter((o) => o.paymentStatus === 'refunded');
  const refundedAmount = refundedOrders.reduce((s, o) => s + o.total, 0);

  return {
    orders: paidOrders.length,
    avgOrderValue: paidOrders.length > 0 ? grossRevenue / paidOrders.length : 0,
    grossRevenue,
    // No tax or discount fields exist on Order today (Commerce Engine's
    // Promotion model isn't implemented yet) — Net Revenue is therefore
    // Gross minus the one deduction that IS real and trackable: refunds.
    // Taxes/Discounts are deliberately omitted rather than shown as a
    // misleading 0 — see the Operations section below for the same rule
    // applied to Checkout Abandonment / Refund Requests / Support Issues.
    netRevenue: grossRevenue - refundedAmount,
    shippingRevenue,
    refundedAmount,
  };
}

async function buildProductsSection(paidOrders) {
  const allItems = paidOrders.flatMap((o) => o.items);
  const productMap = groupBy(allItems, (i) => i.product?._id ?? i.name);
  const topSelling = [...productMap.values()]
    .map((items) => ({
      name: items[0].name,
      quantity: items.reduce((s, i) => s + i.quantity, 0),
      revenue: items.reduce((s, i) => s + i.price * i.quantity, 0),
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  const soldProductIds = new Set(allItems.map((i) => i.product?._id).filter(Boolean));
  const [totalActive, outOfStock, lowStock, lowStockProducts] = await Promise.all([
    productRepository.count({ where: { active: true } }),
    productRepository.count({ where: { active: true, totalStock: 0 } }),
    productRepository.count({ where: { active: true, totalStock: { gt: 0, lte: LOW_STOCK_THRESHOLD } } }),
    productRepository.find({
      where: { active: true, totalStock: { gt: 0, lte: LOW_STOCK_THRESHOLD } },
      orderBy: { totalStock: 'asc' },
      take: 5,
    }),
  ]);

  return {
    topSelling,
    noSalesCount: Math.max(totalActive - soldProductIds.size, 0),
    lowStock,
    lowStockProducts,
    outOfStock,
  };
}

/**
 * Sales by League/Team use the legacy flat strings (Product.league/team),
 * the same fields every other existing report (routes/reports.js) already
 * groups by — every product has these populated, only the pilot
 * Organization's 16 products have organizationId/teamId set. Sales by
 * Organization is the new one, added specifically to give the Organization-
 * first migration (ADR-001) something real to prove itself against as more
 * Organizations get migrated.
 */
async function buildOrganizationsSection(paidOrders) {
  const allItems = paidOrders.flatMap((o) => o.items);

  const byLeague = [...groupBy(allItems.filter((i) => i.product?.league), (i) => i.product.league)]
    .map(([league, items]) => ({ name: league, revenue: items.reduce((s, i) => s + i.price * i.quantity, 0) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const byTeamLegacy = [...groupBy(allItems.filter((i) => i.product?.team), (i) => i.product.team)]
    .map(([team, items]) => ({ name: team, revenue: items.reduce((s, i) => s + i.price * i.quantity, 0) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const orgItems = allItems.filter((i) => i.product?.organizationId);
  const orgGroups = [...groupBy(orgItems, (i) => i.product.organizationId)];
  const orgIds = orgGroups.map(([id]) => id);
  const orgs = orgIds.length ? await organizationRepository.find({ where: { id: { in: orgIds } } }) : [];
  const orgById = new Map(orgs.map((o) => [o._id, o]));
  const byOrganization = orgGroups
    .map(([id, items]) => ({
      name: orgById.get(id)?.name ?? 'Unknown Organization',
      revenue: items.reduce((s, i) => s + i.price * i.quantity, 0),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return { byOrganization, byLeague, byTeam: byTeamLegacy };
}

async function buildCustomersSection(paidOrders) {
  const byCustomer = groupBy(paidOrders, (o) => o.user || o.email);
  const customerKeys = [...byCustomer.keys()];

  const lifetimeCounts = await Promise.all(
    customerKeys.map((key) => {
      const [sample] = byCustomer.get(key);
      const where = sample.user
        ? { paymentStatus: 'paid', userId: sample.user }
        : { paymentStatus: 'paid', email: sample.email };
      return orderRepository.count({ where });
    })
  );

  let newCustomers = 0;
  let returningCustomers = 0;
  customerKeys.forEach((_, i) => {
    // This customer's lifetime paid-order count includes yesterday's own
    // order(s) — exactly 1 means yesterday was their first ever purchase.
    if (lifetimeCounts[i] <= 1) newCustomers++;
    else returningCustomers++;
  });

  const totalCustomers = customerKeys.length;
  const repeatPurchaseRate = totalCustomers > 0
    ? Math.round((returningCustomers / totalCustomers) * 10000) / 100
    : 0;

  return { newCustomers, returningCustomers, repeatPurchaseRate };
}

function buildPaymentsSection(allOrders) {
  const byStatus = { paid: 0, pending: 0, failed: 0, refunded: 0 };
  for (const o of allOrders) {
    if (o.paymentStatus in byStatus) byStatus[o.paymentStatus]++;
  }
  const byMethod = [...groupBy(allOrders, (o) => o.paymentMethod || 'unknown')]
    .map(([method, os]) => ({ method, count: os.length }))
    .sort((a, b) => b.count - a.count);

  return {
    successful: byStatus.paid,
    failed: byStatus.failed,
    pending: byStatus.pending,
    refunded: byStatus.refunded,
    byMethod,
  };
}

function buildShippingSection(allOrders) {
  // Payment Platform Redesign, Phase 2 — "awaiting shipment" means paid,
  // not yet shipped: paid/processing/packed, never 'confirmed' (superseded)
  // or 'awaiting_payment' (not paid at all, a different bucket entirely).
  const AWAITING_SHIPMENT_STATUSES = new Set(['paid', 'processing', 'packed']);
  return {
    awaitingShipment: allOrders.filter((o) => AWAITING_SHIPMENT_STATUSES.has(o.orderStatus)).length,
    inTransit: allOrders.filter((o) => o.orderStatus === 'shipped').length,
    delivered: allOrders.filter((o) => o.orderStatus === 'delivered').length,
  };
}

async function buildTryOnSection(start, end) {
  const logs = await tryOnLogRepository.find({ where: { createdAt: { gte: start, lt: end } } });
  const sessions = logs.length;
  const successful = logs.filter((l) => l.success === true).length;
  const failed = sessions - successful;

  const mostTriedOn = [...groupBy(logs, (l) => l.product ?? 'unresolved').values()]
    .map((ls) => ({ productName: ls[0].productName, count: ls.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Enterprise Fulfillment Blueprint §10/§11 — platform-wide try-on to
  // purchase conversion, for this same window. Previously disclaimed as
  // uncomputable; tryOnLogRepository.platformConversionStats finally
  // implements the join (same technique fitCheckCampaignRepository
  // .analytics() already proved works per-campaign).
  const conversion = await tryOnLogRepository.platformConversionStats({ since: start, until: end });

  return {
    sessions,
    successful,
    failed,
    // Generation success rate — distinct from conversion.conversionRate
    // below, which is the real try-on-to-purchase number.
    successRate: sessions > 0 ? Math.round((successful / sessions) * 10000) / 100 : 0,
    mostTriedOn,
    conversion,
  };
}

/**
 * Enterprise Fulfillment Blueprint §11 — Pending Fulfillment / Late
 * Shipments / Returns / Refunds, read directly off Shipment/ReturnRequest/
 * Refund. Deliberately a live snapshot at generation time, not filtered to
 * the report's [start, end) window — these are operational queues (like
 * the existing low-stock inventory alert), not period-scoped activity.
 */
async function buildFulfillmentSection() {
  const ACTIVE_STATUSES = Object.keys(STAGE_THRESHOLD_HOURS);
  const [pendingFulfillment, exceptions, returnsAwaitingApproval, refundQueue] = await Promise.all([
    shipmentRepository.count({ where: { status: { in: ACTIVE_STATUSES } } }),
    shipmentRepository.count({ where: { status: 'exception' } }),
    returnRequestRepository.count({ where: { status: { in: ['requested', 'under_review'] } } }),
    refundRepository.count({ where: { status: 'pending' } }),
  ]);

  return { pendingFulfillment, exceptions, returnsAwaitingApproval, refundQueue };
}

/**
 * The Business Report's core — computes every section for an arbitrary
 * [start, end) window. generateDailyBusinessReport and its weekly/monthly/
 * quarterly siblings below are thin wrappers that just supply a different
 * range, so the whole aggregation only exists once (this is the second and
 * third real use case for generalizing it, per the "no abstraction before
 * the second use case" rule — a single-cadence version wasn't worth
 * generalizing until Weekly/Monthly/Quarterly actually needed the same
 * logic).
 */
export const generateBusinessReportForRange = async (start, end) => {
  const dateFilter = { createdAt: { gte: start, lt: end } };

  const allOrders = await orderRepository.find({
    where: dateFilter,
    include: { items: { include: { product: true } } },
  });
  const paidOrders = allOrders.filter((o) => o.paymentStatus === 'paid');

  const [sales, products, organizations, customers, tryOn, fulfillment] = await Promise.all([
    buildSalesSection(allOrders, paidOrders),
    buildProductsSection(paidOrders),
    buildOrganizationsSection(paidOrders),
    buildCustomersSection(paidOrders),
    buildTryOnSection(start, end),
    buildFulfillmentSection(),
  ]);

  return {
    date: start, // kept for backward compatibility — periodStart/periodEnd below are the general form
    periodStart: start,
    periodEnd: end,
    sales,
    products,
    organizations,
    customers,
    payments: buildPaymentsSection(allOrders),
    shipping: buildShippingSection(allOrders),
    tryOn,
    fulfillment,
    // Operations: Checkout Abandonment is deliberately still absent, not
    // zeroed — no cart-started event exists yet (the cart is client-only
    // until submit). Refund Requests and Support Issues, previously in the
    // same bucket, now have real tracking (`fulfillment` above,
    // Refund/ReturnRequest) as of the Enterprise Fulfillment Blueprint.
  };
};

export const generateDailyBusinessReport = async (now = new Date()) => {
  const { start, end } = yesterdayRangePH(now);
  return generateBusinessReportForRange(start, end);
};

/**
 * Every run — sent, skipped (no recipients), or failed — is archived to
 * ReportRun. Archiving failures are logged but never allowed to mask the
 * original error/outcome; the caller (the 5 AM cron job, or an admin
 * clicking Regenerate) sees the real result either way.
 */
async function archiveRun(fields) {
  try {
    return await reportRunRepository.create(fields);
  } catch (archiveError) {
    logger.error({ err: archiveError }, 'Failed to archive daily business report run');
    return null;
  }
}

/**
 * Maps a frozen ReportRun.data snapshot (same shape generateDailyBusinessReport
 * returns) into the { summary, sheets } shape lib/reportExport.js's
 * sendReportExport expects — what Report Archive's Download action calls,
 * so a downloaded file always matches what was actually sent that day
 * rather than recomputing against today's (since-changed) data.
 */
export function dailyBusinessReportToExportShape(data) {
  // Enterprise Fulfillment Blueprint, Phase 2 added tryOn.conversion and the
  // whole `fulfillment` section — a ReportRun archived before this shipped
  // has neither in its frozen snapshot. Report Archive's Download action
  // replays that exact old snapshot (deliberately, see the comment above),
  // so this must degrade gracefully rather than assume every archive was
  // written by today's version of this function.
  const conversion = data.tryOn.conversion || { conversionRate: 0, revenue: 0 };
  const fulfillment = data.fulfillment || { pendingFulfillment: 0, exceptions: 0, returnsAwaitingApproval: 0, refundQueue: 0 };

  return {
    summary: [
      ['Gross Revenue', data.sales.grossRevenue],
      ['Net Revenue', data.sales.netRevenue],
      ['Orders', data.sales.orders],
      ['Avg Order Value', data.sales.avgOrderValue],
      ['Shipping Revenue', data.sales.shippingRevenue],
      ['Refunded', data.sales.refundedAmount],
      ['New Customers', data.customers.newCustomers],
      ['Returning Customers', data.customers.returningCustomers],
      ['Try-On Sessions', data.tryOn.sessions],
      ['Try-On Success Rate', `${data.tryOn.successRate}%`],
      ['Try-On Conversion Rate', `${Math.round(conversion.conversionRate * 10000) / 100}%`],
      ['Try-On Attributed Revenue', conversion.revenue],
      ['Pending Fulfillment', fulfillment.pendingFulfillment],
      ['Refund Queue', fulfillment.refundQueue],
    ],
    sheets: [
      {
        name: 'Top Selling Products',
        columns: [{ header: 'Product', key: 'name' }, { header: 'Qty', key: 'quantity' }, { header: 'Revenue', key: 'revenue' }],
        rows: data.products.topSelling,
        totals: { quantity: true, revenue: true },
      },
      {
        name: 'Sales by Organization',
        columns: [{ header: 'Organization', key: 'name' }, { header: 'Revenue', key: 'revenue' }],
        rows: data.organizations.byOrganization,
        totals: { revenue: true },
      },
      {
        name: 'Sales by League',
        columns: [{ header: 'League', key: 'name' }, { header: 'Revenue', key: 'revenue' }],
        rows: data.organizations.byLeague,
        totals: { revenue: true },
      },
      {
        name: 'Payments',
        columns: [{ header: 'Status', key: 'status' }, { header: 'Count', key: 'count' }],
        rows: [
          { status: 'Successful', count: data.payments.successful },
          { status: 'Failed', count: data.payments.failed },
          { status: 'Pending', count: data.payments.pending },
          { status: 'Refunded', count: data.payments.refunded },
        ],
      },
      {
        name: 'Payment Methods',
        columns: [{ header: 'Method', key: 'method' }, { header: 'Count', key: 'count' }],
        rows: data.payments.byMethod,
        totals: { count: true },
      },
      {
        name: 'Shipping',
        columns: [{ header: 'Status', key: 'status' }, { header: 'Orders', key: 'count' }],
        rows: [
          { status: 'Awaiting Shipment', count: data.shipping.awaitingShipment },
          { status: 'In Transit', count: data.shipping.inTransit },
          { status: 'Delivered', count: data.shipping.delivered },
        ],
      },
      {
        name: 'Most Tried-On',
        columns: [{ header: 'Product', key: 'productName' }, { header: 'Sessions', key: 'count' }],
        rows: data.tryOn.mostTriedOn,
        totals: { count: true },
      },
      {
        name: 'Fulfillment',
        columns: [{ header: 'Metric', key: 'metric' }, { header: 'Count', key: 'count' }],
        rows: [
          { metric: 'Pending Fulfillment', count: fulfillment.pendingFulfillment },
          { metric: 'Flagged / Needs Attention', count: fulfillment.exceptions },
          { metric: 'Returns Awaiting Approval', count: fulfillment.returnsAwaitingApproval },
          { metric: 'Refund Queue', count: fulfillment.refundQueue },
        ],
      },
    ],
  };
}

const CADENCE_TITLES = {
  daily_business_report: 'Daily Business Report',
  weekly_business_report: 'Weekly Business Report',
  monthly_business_report: 'Monthly Business Report',
  quarterly_business_report: 'Quarterly Business Report',
};

/**
 * Shared by every cadence — computes the report for [start, end), emails
 * it, and archives the outcome. Whether a given cadence should run at all
 * (the ReportSchedule on/off toggle) is decided by the caller (server.js's
 * cron handlers), not here — this function's job is "do the run", not
 * "decide whether to."
 */
async function generateAndSendBusinessReport({ type, start, end }) {
  let recipients = await reportRecipientRepository.findActiveEmails();

  // Deployments that already had ADMIN_EMAIL set (the old single-recipient
  // config) keep receiving the report until someone configures real
  // recipients via the admin UI — avoids this silently going dark on
  // upgrade for an env var nobody thought to migrate. Only applied to the
  // daily cadence — ADMIN_EMAIL predates Weekly/Monthly/Quarterly existing
  // at all, so there's no prior behavior to preserve for those.
  if (recipients.length === 0 && type === 'daily_business_report' && process.env.ADMIN_EMAIL) {
    logger.warn('No ReportRecipient rows configured — falling back to ADMIN_EMAIL. Add recipients in Admin > Reports to stop seeing this.');
    recipients = [process.env.ADMIN_EMAIL];
  }

  if (recipients.length === 0) {
    logger.warn({ type }, 'No report recipients configured — skipping this run');
    await archiveRun({ type, status: 'skipped', reportDate: start, recipients: [] });
    return;
  }

  let report;
  try {
    report = await generateBusinessReportForRange(start, end);
    await sendDailyBusinessReportEmail(recipients, report, CADENCE_TITLES[type]);
  } catch (error) {
    await archiveRun({ type, status: 'failed', reportDate: start, recipients, errorMessage: error.message });
    throw error; // preserve the existing logger.error/Sentry handling at the call site (server.js cron job)
  }

  await archiveRun({ type, status: 'sent', reportDate: start, data: report, recipients });
  logger.info({ recipientCount: recipients.length, type }, 'Business report sent');
}

export const generateAndSendDailyBusinessReport = async () => {
  const { start, end } = yesterdayRangePH();
  return generateAndSendBusinessReport({ type: 'daily_business_report', start, end });
};

export const generateAndSendWeeklyBusinessReport = async () => {
  const { start, end } = lastWeekRangePH();
  return generateAndSendBusinessReport({ type: 'weekly_business_report', start, end });
};

export const generateAndSendMonthlyBusinessReport = async () => {
  const { start, end } = lastMonthRangePH();
  return generateAndSendBusinessReport({ type: 'monthly_business_report', start, end });
};

export const generateAndSendQuarterlyBusinessReport = async () => {
  const { start, end } = lastQuarterRangePH();
  return generateAndSendBusinessReport({ type: 'quarterly_business_report', start, end });
};
