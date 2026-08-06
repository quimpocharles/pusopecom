import * as manualGateway from './couriers/manualGateway.js';
import logger from '../lib/logger.js';

/**
 * Enterprise Fulfillment Blueprint §6 — the gateway-agnostic interface
 * routes/shipments.js talks to, mirroring paymentService.js's own GATEWAYS
 * registry pattern exactly: one interface, one module per real provider,
 * adding a new courier is one file plus one registry line, nothing
 * upstream changes.
 *
 * Every gateway module must implement:
 *   bookPickup(shipment, manualData) -> { trackingNumber, labelUrl }
 *   getTrackingStatus(trackingNumber) -> normalized status
 *
 * `manual` is the only real implementation today — no external courier
 * account/credentials exist yet (named explicitly, not silently deferred,
 * same as this codebase's other genuinely-out-of-scope items). A real
 * courier (J&T, LBC, Ninja Van...) is added the same way mayaGateway.js
 * was: a new module implementing this exact shape, one new line in
 * GATEWAYS below.
 */
const GATEWAYS = {
  manual: manualGateway,
};

function resolveGateway(courierName) {
  const gateway = GATEWAYS[courierName];
  if (!gateway) throw new Error(`Unsupported courier: ${courierName}`);
  return gateway;
}

export function isSupportedCourier(courierName) {
  return courierName in GATEWAYS;
}

export async function bookPickup(courierName, shipment, manualData) {
  const gateway = resolveGateway(courierName);
  try {
    return await gateway.bookPickup(shipment, manualData);
  } catch (error) {
    logger.error({ err: error, courierName, shipmentId: shipment?._id }, 'Courier bookPickup failed');
    throw error;
  }
}

export async function getTrackingStatus(courierName, trackingNumber) {
  const gateway = resolveGateway(courierName);
  return gateway.getTrackingStatus(trackingNumber);
}

export default { isSupportedCourier, bookPickup, getTrackingStatus };
