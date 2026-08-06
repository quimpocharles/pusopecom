import * as shippingEventRepository from '../../repositories/shippingEventRepository.js';
import { getDateFilter, groupBy } from '../../lib/reportQueryHelpers.js';

/**
 * Extracted out of routes/reports.js for the same reason sales/products/
 * orders were — the new Fulfillment Report (Reports Module Redesign,
 * Phase 3) composes this alongside buildFulfillmentSection(), and needs to
 * call it from dailyBusinessReportService.js without a circular import
 * back into the router file.
 */
export async function computeShippingReport(query) {
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

export function shippingReportToExportShape(data) {
  const methodRows = data.methodBreakdown.map((m) => ({ method: m._id.method, region: m._id.region, count: m.count, totalRevenue: m.totalRevenue }));
  return {
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
  };
}
