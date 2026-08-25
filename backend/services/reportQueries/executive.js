import * as paymentRepository from '../../repositories/paymentRepository.js';
import * as orderRepository from '../../repositories/orderRepository.js';
import { computeSalesReport } from './sales.js';
import { computeProductsReport } from './products.js';
import { computeOrdersReport } from './orders.js';
import { buildFulfillmentSection } from '../../lib/fulfillmentSnapshot.js';

const formatPeso = (n) => `₱${Math.round(n).toLocaleString()}`;

/**
 * The equal-length window immediately before the given range, for
 * period-over-period deltas — e.g. querying Aug 8–14 also computes Aug 1–7
 * for comparison. An unbounded ("All Time") current range has no
 * meaningful "prior period", so it falls back to a 30-day window ending
 * where the unbounded range's default start effectively is; the delta is
 * still informative even if the boundary is a little arbitrary.
 */
function previousPeriod(query) {
  const end = query.endDate ? new Date(`${query.endDate}T23:59:59.999Z`) : new Date();
  const start = query.startDate ? new Date(query.startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  const lengthMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - lengthMs);
  return {
    startDate: prevStart.toISOString().slice(0, 10),
    endDate: prevEnd.toISOString().slice(0, 10),
  };
}

function pctDelta(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 10000) / 100;
}

// "Today" in PH time, independent of whatever date range the KPI cards are
// filtered to — alerts are about current operational state, not history.
// Same phOffset technique already used by GET /reports/dashboard-widgets/data.
function startOfTodayPH() {
  const phOffset = 8 * 60 * 60 * 1000;
  const phNow = new Date(Date.now() + phOffset);
  return new Date(Date.UTC(phNow.getUTCFullYear(), phNow.getUTCMonth(), phNow.getUTCDate()) - phOffset);
}

/**
 * Ranked list of operational issues that need a human today — each entry
 * an existing count query, surfaced with severity instead of buried across
 * separate cards. Only real, currently-true conditions ever appear; an
 * empty array means nothing needs attention, not "still loading."
 */
async function buildAlertsFeed({ productsData, fulfillment }) {
  const todayFilter = { createdAt: { gte: startOfTodayPH() } };
  const [failedPaymentsToday, webhookHealth] = await Promise.all([
    orderRepository.count({ where: { paymentStatus: 'failed', ...todayFilter } }),
    paymentRepository.getWebhookHealth(),
  ]);

  const alerts = [];

  if (productsData.stockLevels.outOfStock > 0) {
    alerts.push({
      severity: 'critical',
      message: `${productsData.stockLevels.outOfStock} product${productsData.stockLevels.outOfStock === 1 ? '' : 's'} out of stock`,
      link: '/admin/reports/products',
    });
  }
  if (productsData.stockLevels.lowStock > 0) {
    alerts.push({
      severity: 'warning',
      message: `${productsData.stockLevels.lowStock} product${productsData.stockLevels.lowStock === 1 ? '' : 's'} low on stock`,
      link: '/admin/reports/products',
    });
  }
  if (failedPaymentsToday > 0) {
    alerts.push({
      severity: 'warning',
      message: `${failedPaymentsToday} failed payment${failedPaymentsToday === 1 ? '' : 's'} today`,
      link: '/admin/reports/operations',
    });
  }
  if (fulfillment.exceptions > 0) {
    alerts.push({
      severity: 'critical',
      message: `${fulfillment.exceptions} shipment${fulfillment.exceptions === 1 ? '' : 's'} flagged as an exception`,
      link: '/admin/reports/operations',
    });
  }
  if (fulfillment.refundQueue > 0) {
    alerts.push({
      severity: 'warning',
      message: `${fulfillment.refundQueue} refund${fulfillment.refundQueue === 1 ? '' : 's'} pending`,
      link: '/admin/reports/finance',
    });
  }
  // Already computed by buildFulfillmentSection on every call — this was
  // silently dropped before reaching the alerts feed (Admin Dashboard
  // Phase 2 audit). Links to the actual Returns & Refunds admin page
  // (where a return is approved/rejected), not a report — unlike the
  // refund-queue alert above, which is a financial figure with no single
  // actionable page of its own yet.
  if (fulfillment.returnsAwaitingApproval > 0) {
    alerts.push({
      severity: 'warning',
      message: `${fulfillment.returnsAwaitingApproval} return${fulfillment.returnsAwaitingApproval === 1 ? '' : 's'} awaiting approval`,
      link: '/admin/returns',
    });
  }
  // Only flag silence, not absence — a system that has never once
  // processed a webhook (a fresh environment) isn't "unhealthy", it just
  // has no data yet.
  if (webhookHealth.lastWebhookAt && webhookHealth.processedLast24h === 0) {
    alerts.push({
      severity: 'critical',
      message: `No payment webhooks processed in the last 24h (last: ${new Date(webhookHealth.lastWebhookAt).toLocaleString('en-PH')})`,
      link: '/admin/reports/operations',
    });
  }

  const severityRank = { critical: 0, warning: 1 };
  return alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

/**
 * Deterministic templated sentences from the same numbers already on the
 * page — never an LLM call. Matches this codebase's existing discipline of
 * never fabricating a figure (e.g. TryOnLog.costUsd staying null rather
 * than a guessed price for an unverified provider).
 */
function buildExecutiveSummary({ salesData, salesDelta, ordersData, alerts }) {
  const lines = [];

  const direction = salesDelta.revenue >= 0 ? 'up' : 'down';
  lines.push(
    `Revenue was ${formatPeso(salesData.totalRevenue)} across ${salesData.totalOrders} orders, ` +
    `${direction} ${Math.abs(salesDelta.revenue)}% from the prior period.`
  );

  lines.push(`Fulfillment rate is ${ordersData.fulfillmentRate}%, with ${ordersData.failedPayments.count} failed payment${ordersData.failedPayments.count === 1 ? '' : 's'} in range.`);

  if (alerts.length === 0) {
    lines.push('No operational alerts — nothing flagged needs attention right now.');
  } else {
    const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
    lines.push(
      criticalCount > 0
        ? `${criticalCount} item${criticalCount === 1 ? '' : 's'} need${criticalCount === 1 ? 's' : ''} attention today — see Alerts below.`
        : `${alerts.length} item${alerts.length === 1 ? '' : 's'} worth a look — see Alerts below.`
    );
  }

  return lines;
}

export async function computeExecutiveReport(query) {
  const prevQuery = previousPeriod(query);

  const [salesData, prevSalesData, ordersData, productsData, fulfillment] = await Promise.all([
    computeSalesReport(query),
    computeSalesReport(prevQuery),
    computeOrdersReport(query),
    computeProductsReport(query),
    buildFulfillmentSection(),
  ]);

  const salesDelta = {
    revenue: pctDelta(salesData.totalRevenue, prevSalesData.totalRevenue),
    orders: pctDelta(salesData.totalOrders, prevSalesData.totalOrders),
    averageOrderValue: pctDelta(salesData.averageOrderValue, prevSalesData.averageOrderValue),
  };

  const alerts = await buildAlertsFeed({ productsData, fulfillment });
  const executiveSummary = buildExecutiveSummary({ salesData, salesDelta, ordersData, alerts });

  return {
    kpis: {
      totalRevenue: salesData.totalRevenue,
      totalOrders: salesData.totalOrders,
      averageOrderValue: salesData.averageOrderValue,
      netRevenue: salesData.totalRevenue, // refunds aren't tracked against a date range anywhere yet — see Finance workspace (Phase 3), which will supersede this with a real net figure
      delta: salesDelta,
    },
    operationsHealth: {
      fulfillmentRate: ordersData.fulfillmentRate,
      pendingShipments: fulfillment.pendingFulfillment,
      failedPayments: ordersData.failedPayments.count,
      refundQueue: fulfillment.refundQueue,
      exceptions: fulfillment.exceptions,
    },
    whatsSelling: {
      bestSellers: productsData.bestSellers.slice(0, 5),
      salesByCategory: salesData.salesByCategory,
    },
    revenueOverTime: salesData.revenueOverTime,
    alerts,
    executiveSummary,
  };
}

export function executiveReportToExportShape(data) {
  return {
    summary: [
      ['Total Revenue', data.kpis.totalRevenue],
      ['Total Orders', data.kpis.totalOrders],
      ['Average Order Value', data.kpis.averageOrderValue],
      ['Revenue Δ vs prior period', `${data.kpis.delta.revenue}%`],
      ['Fulfillment Rate', `${data.operationsHealth.fulfillmentRate}%`],
      ['Pending Shipments', data.operationsHealth.pendingShipments],
      ['Failed Payments', data.operationsHealth.failedPayments],
      ['Refund Queue', data.operationsHealth.refundQueue],
    ],
    sheets: [
      {
        name: 'Revenue Over Time',
        columns: [{ header: 'Date', key: 'date' }, { header: 'Revenue', key: 'revenue' }, { header: 'Orders', key: 'orders' }],
        rows: data.revenueOverTime,
        totals: { revenue: true, orders: true },
      },
      {
        name: 'Sales by Category',
        columns: [{ header: 'Category', key: 'category' }, { header: 'Revenue', key: 'revenue' }, { header: 'Units', key: 'units' }],
        rows: data.whatsSelling.salesByCategory,
        totals: { revenue: true, units: true },
      },
      {
        name: 'Top Products',
        columns: [{ header: 'Product', key: 'name' }, { header: 'Units', key: 'units' }, { header: 'Revenue', key: 'revenue' }],
        rows: data.whatsSelling.bestSellers,
        totals: { units: true, revenue: true },
      },
      {
        name: 'Alerts',
        columns: [{ header: 'Severity', key: 'severity' }, { header: 'Message', key: 'message' }],
        rows: data.alerts,
      },
    ],
  };
}
