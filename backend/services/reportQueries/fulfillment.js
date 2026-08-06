import { buildFulfillmentSection } from '../../lib/fulfillmentSnapshot.js';
import { computeShippingReport, shippingReportToExportShape } from './shipping.js';

/**
 * The scheduled "Fulfillment Report" (Reports Module Redesign, Phase 3) —
 * composes the two existing pieces that already answer "is fulfillment
 * healthy" rather than recomputing either: buildFulfillmentSection()'s live
 * operational snapshot (pending/exceptions/returns/refunds) and the
 * Operations workspace's own Shipping breakdown for the report's date
 * range. No new aggregation logic lives here.
 */
export async function composeFulfillmentReport(query) {
  const [fulfillment, shipping] = await Promise.all([
    buildFulfillmentSection(),
    computeShippingReport(query),
  ]);
  return { fulfillment, shipping };
}

export function fulfillmentReportToExportShape(data) {
  const shippingShape = shippingReportToExportShape(data.shipping);
  return {
    summary: [
      ['Pending Fulfillment', data.fulfillment.pendingFulfillment],
      ['Flagged / Needs Attention', data.fulfillment.exceptions],
      ['Returns Awaiting Approval', data.fulfillment.returnsAwaitingApproval],
      ['Refund Queue', data.fulfillment.refundQueue],
      ...shippingShape.summary,
    ],
    sheets: [
      {
        name: 'Fulfillment Snapshot',
        columns: [{ header: 'Metric', key: 'metric' }, { header: 'Count', key: 'count' }],
        rows: [
          { metric: 'Pending Fulfillment', count: data.fulfillment.pendingFulfillment },
          { metric: 'Flagged / Needs Attention', count: data.fulfillment.exceptions },
          { metric: 'Returns Awaiting Approval', count: data.fulfillment.returnsAwaitingApproval },
          { metric: 'Refund Queue', count: data.fulfillment.refundQueue },
        ],
      },
      ...shippingShape.sheets,
    ],
  };
}
