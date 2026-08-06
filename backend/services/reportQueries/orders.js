import * as orderRepository from '../../repositories/orderRepository.js';
import { getDateFilter, getGranularity, dateKey, groupBy, sortByDateKey } from '../../lib/reportQueryHelpers.js';

// Moved out of routes/reports.js (zero logic change) — see sales.js's
// header comment for why.
export async function computeOrdersReport(query) {
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
