import orderRepository from '../../repositories/orderRepository.js';
import refundRepository from '../../repositories/refundRepository.js';
import paymentRepository from '../../repositories/paymentRepository.js';
import { getDateFilter, getGranularity, dateKey, groupBy, sortByDateKey } from '../../lib/reportQueryHelpers.js';

/**
 * Payment-provider fee breakdown is explicitly out of scope — no
 * feeAmount field exists anywhere in the schema yet (confirmed decision,
 * Reports Module Redesign Phase 3 plan). `feeBreakdownAvailable: false`
 * lets the frontend render "not available" instead of a fabricated $0.
 */
export async function computeFinanceReport(query) {
  const dateFilter = getDateFilter(query);
  const granularity = getGranularity(query.startDate, query.endDate);

  const paidOrders = await orderRepository.find({
    where: { paymentStatus: 'paid', ...dateFilter },
  });
  const grossRevenue = paidOrders.reduce((s, o) => s + o.total, 0);

  // Refunds are recognized by when they actually resolved (processedAt),
  // not by order creation date — a refund settling this week against an
  // order placed last month still belongs in this week's net revenue.
  const processedRange = {};
  if (query.startDate) processedRange.gte = new Date(query.startDate);
  if (query.endDate) {
    const end = new Date(query.endDate);
    end.setHours(23, 59, 59, 999);
    processedRange.lte = end;
  }
  const succeededRefunds = await refundRepository.find({
    where: { status: 'succeeded', ...(Object.keys(processedRange).length > 0 ? { processedAt: processedRange } : {}) },
  });
  const refundedAmount = succeededRefunds.reduce((s, r) => s + r.amount, 0);
  const netRevenue = grossRevenue - refundedAmount;

  const grossByDate = groupBy(paidOrders, (o) => dateKey(o.createdAt, granularity));
  const refundsByDate = groupBy(succeededRefunds, (r) => dateKey(r.processedAt, granularity));
  const allDateKeys = new Set([...grossByDate.keys(), ...refundsByDate.keys()]);
  const revenueOverTime = [...allDateKeys].map((date) => {
    const orders = grossByDate.get(date) ?? [];
    const refunds = refundsByDate.get(date) ?? [];
    const dateGross = orders.reduce((s, o) => s + o.total, 0);
    const dateRefunded = refunds.reduce((s, r) => s + r.amount, 0);
    return { date, grossRevenue: dateGross, refundedAmount: dateRefunded, netRevenue: dateGross - dateRefunded, orders: orders.length };
  }).sort(sortByDateKey);

  // Live snapshot, same convention as dailyBusinessReportService's
  // buildFulfillmentSection — the queue is "what needs attention right
  // now," not scoped to the report's date range.
  const refundQueueCount = await refundRepository.count({ where: { status: 'pending' } });

  const velocityHours = succeededRefunds
    .filter((r) => r.processedAt)
    .map((r) => (new Date(r.processedAt).getTime() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60));
  const avgRefundVelocityHours = velocityHours.length
    ? Math.round((velocityHours.reduce((s, v) => s + v, 0) / velocityHours.length) * 10) / 10
    : null;

  // Payment attempts made within the range, regardless of which order they
  // ultimately belonged to — this is a gateway-health metric, not a sales one.
  const payments = await paymentRepository.find({ where: { ...dateFilter } });
  const resolvedPayments = payments.filter((p) => ['succeeded', 'failed', 'expired'].includes(p.status));
  const providerSuccessRate = [...groupBy(resolvedPayments, (p) => p.provider).entries()]
    .map(([provider, rows]) => {
      const succeeded = rows.filter((p) => p.status === 'succeeded').length;
      return {
        provider,
        succeeded,
        total: rows.length,
        successRate: rows.length ? Math.round((succeeded / rows.length) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.total - a.total);

  return {
    grossRevenue,
    refundedAmount,
    netRevenue,
    revenueOverTime,
    refundQueueCount,
    refundCount: succeededRefunds.length,
    avgRefundVelocityHours,
    providerSuccessRate,
    feeBreakdownAvailable: false,
  };
}

export function financeReportToExportShape(data) {
  return {
    summary: [
      ['Gross Revenue', data.grossRevenue],
      ['Refunded Amount', data.refundedAmount],
      ['Net Revenue', data.netRevenue],
      ['Refund Queue (pending)', data.refundQueueCount],
      ['Refunds Processed', data.refundCount],
      ['Avg Refund Velocity (hrs)', data.avgRefundVelocityHours ?? 'N/A'],
      ['Fee Breakdown', 'Not available — not yet tracked'],
    ],
    sheets: [
      {
        name: 'Revenue Over Time',
        columns: [
          { header: 'Date', key: 'date' },
          { header: 'Gross Revenue', key: 'grossRevenue' },
          { header: 'Refunded', key: 'refundedAmount' },
          { header: 'Net Revenue', key: 'netRevenue' },
          { header: 'Orders', key: 'orders' },
        ],
        rows: data.revenueOverTime,
        totals: { grossRevenue: true, refundedAmount: true, netRevenue: true, orders: true },
      },
      {
        name: 'Payment Provider Success Rate',
        columns: [
          { header: 'Provider', key: 'provider' },
          { header: 'Succeeded', key: 'succeeded' },
          { header: 'Total', key: 'total' },
          { header: 'Success Rate', key: 'successRate' },
        ],
        rows: data.providerSuccessRate,
      },
    ],
  };
}
