import * as shipmentRepository from '../repositories/shipmentRepository.js';
import * as returnRequestRepository from '../repositories/returnRequestRepository.js';
import * as refundRepository from '../repositories/refundRepository.js';
import { STAGE_THRESHOLD_HOURS } from './sweepFulfillmentSLA.js';

/**
 * Enterprise Fulfillment Blueprint §11 — Pending Fulfillment / Late
 * Shipments / Returns / Refunds, read directly off Shipment/ReturnRequest/
 * Refund. Deliberately a live snapshot at generation time, not filtered to
 * any report's [start, end) window — these are operational queues (like
 * the existing low-stock inventory alert), not period-scoped activity.
 *
 * Lives in lib/, not services/dailyBusinessReportService.js where it
 * originated, because both the Executive Dashboard (services/reportQueries/
 * executive.js) and the new Fulfillment Report (services/reportQueries/
 * fulfillment.js) need it, and dailyBusinessReportService.js itself now
 * imports those two — a shared leaf module avoids the circular import
 * that would otherwise create.
 */
export async function buildFulfillmentSection() {
  const ACTIVE_STATUSES = Object.keys(STAGE_THRESHOLD_HOURS);
  const [pendingFulfillment, exceptions, returnsAwaitingApproval, refundQueue] = await Promise.all([
    shipmentRepository.count({ where: { status: { in: ACTIVE_STATUSES } } }),
    shipmentRepository.count({ where: { status: 'exception' } }),
    returnRequestRepository.count({ where: { status: { in: ['requested', 'under_review'] } } }),
    refundRepository.count({ where: { status: 'pending' } }),
  ]);

  return { pendingFulfillment, exceptions, returnsAwaitingApproval, refundQueue };
}
