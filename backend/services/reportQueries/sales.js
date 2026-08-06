import * as orderRepository from '../../repositories/orderRepository.js';
import { getDateFilter, getGranularity, dateKey, groupBy, sortByDateKey } from '../../lib/reportQueryHelpers.js';

// Moved out of routes/reports.js (zero logic change) so it can be reused by
// services/reportQueries/executive.js without a circular import back into
// the router file — executive.js composes this report's totals rather than
// recomputing them, and Phase 3's scheduled Executive Daily Report email
// will call this same function directly, outside any HTTP request.
export async function computeSalesReport(query) {
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

export function salesReportToExportShape(data) {
  return {
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
  };
}
