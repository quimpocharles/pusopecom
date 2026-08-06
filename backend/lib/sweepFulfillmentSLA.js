import * as shipmentRepository from '../repositories/shipmentRepository.js';
import * as shipmentEventRepository from '../repositories/shipmentEventRepository.js';
import * as notificationRepository from '../repositories/notificationRepository.js';
import logger from './logger.js';
import Sentry from './sentry.js';

/**
 * Enterprise Fulfillment Blueprint §13.1 — "flags Shipments stuck past a
 * stage threshold; same shape as expireStaleOrders, pointed at fulfillment
 * instead of payment." Per-stage thresholds, not one blanket number — a
 * Shipment sitting in awaiting_picking for 8 hours is a real problem, one
 * sitting in_transit for 8 hours is Tuesday. Fixed constants for now (the
 * Blueprint's own note that a FulfillmentSettings admin control is a later,
 * cheap, additive step — not required to ship the sweep itself).
 */
export const STAGE_THRESHOLD_HOURS = {
  awaiting_picking: 6,
  picking: 4,
  packing: 4,
  quality_check: 4,
  ready_for_courier: 12,
  courier_scheduled: 24,
  picked_up: 48,
  in_transit: 96,
  out_for_delivery: 24,
};

export async function sweepFulfillmentSLA() {
  const now = Date.now();
  let flaggedCount = 0;
  const errors = [];

  for (const [status, thresholdHours] of Object.entries(STAGE_THRESHOLD_HOURS)) {
    const cutoff = new Date(now - thresholdHours * 60 * 60 * 1000);
    const stuck = await shipmentRepository.find({ where: { status, updatedAt: { lt: cutoff } }, include: { order: true } });

    for (const shipment of stuck) {
      try {
        const result = await shipmentRepository.transition(shipment._id, 'exception', {
          actor: 'system',
          message: `SLA sweep — stuck in "${status}" past ${thresholdHours}h threshold`,
        });
        if (!result.applied) continue; // raced with a real status change — leave it alone

        await shipmentEventRepository.create({
          shipmentId: shipment._id,
          type: 'status_changed',
          actor: 'system',
          fromStatus: result.fromStatus,
          toStatus: result.toStatus,
          message: `SLA breach: stuck in "${status}" for over ${thresholdHours}h`,
        });

        const notifyUserId = shipment.assignedToUserId;
        if (notifyUserId) {
          notificationRepository.create({
            userId: notifyUserId,
            type: 'order',
            title: 'Shipment flagged — SLA breach',
            body: `Order #${shipment.order?.orderNumber || shipment.orderId} has been stuck in "${status}" for over ${thresholdHours} hours.`,
            link: `/admin/orders/${shipment.order?.orderNumber || ''}`,
          }).catch((err) => logger.error({ err }, 'Failed to create SLA-breach staff notification'));
        }

        flaggedCount += 1;
      } catch (err) {
        logger.error({ err, shipmentId: shipment._id }, 'Failed to flag stuck shipment during SLA sweep');
        Sentry.captureException(err);
        errors.push({ shipmentId: shipment._id, error: err });
      }
    }
  }

  return { flaggedCount, errors };
}

export default { sweepFulfillmentSLA, STAGE_THRESHOLD_HOURS };
