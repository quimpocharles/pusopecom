import prisma from '../lib/prisma.js';
import { serialize, withRelationFallback } from './serialize.js';

/**
 * Enterprise Fulfillment Blueprint, Phase 1 — Shipment.status's real state
 * machine. Unlike Order's own VALID_ORDER_STATUSES (a flat allowlist —
 * any value, from any prior value, accepted), transitions here are
 * validated against this explicit adjacency map. The Fulfillment Audit
 * flagged this exact gap: "delivered → awaiting_payment is accepted with
 * no validation." It can't happen here.
 *
 * `exception` is a deliberate catch-all recovery point — anything that
 * doesn't fit the happy path routes back into it, and it can route back
 * into the pipeline at a few sensible re-entry stages, or out to cancelled.
 */
export const SHIPMENT_TRANSITIONS = {
  awaiting_picking: ['picking', 'cancelled', 'exception'],
  picking: ['packing', 'exception', 'cancelled'],
  packing: ['quality_check', 'exception', 'cancelled'],
  quality_check: ['ready_for_courier', 'packing', 'exception'],
  ready_for_courier: ['courier_scheduled', 'exception', 'cancelled'],
  courier_scheduled: ['picked_up', 'exception'],
  picked_up: ['in_transit', 'exception'],
  in_transit: ['out_for_delivery', 'exception'],
  out_for_delivery: ['delivered', 'exception'],
  delivered: ['completed', 'return_requested'],
  completed: ['return_requested'],
  return_requested: ['return_approved', 'delivered'], // 'delivered' = rejected, reverts
  return_approved: ['returned'],
  returned: ['refund_pending'],
  refund_pending: ['refunded'],
  refunded: [],
  cancelled: [],
  exception: ['awaiting_picking', 'picking', 'packing', 'ready_for_courier', 'cancelled'],
};

export class InvalidTransitionError extends Error {
  constructor(fromStatus, toStatus) {
    super(`Cannot transition Shipment from "${fromStatus}" to "${toStatus}"`);
    this.name = 'InvalidTransitionError';
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
  }
}

const SHIPMENT_RELATION_MAP = { assignedToUser: 'assignedToUserId', warehouse: 'warehouseId' };
// Matches orderRepository's own ORDER_RELATION_MAP exactly — the nested
// `order` this repository's default include fetches needs the identical
// user/userId collapsing, or `order.user` silently comes back undefined
// even for a logged-in customer's order (breaking every `if (order.user)`
// guard downstream — notifications, accountCache invalidation — that
// every other caller of an Order object in this codebase relies on).
const ORDER_RELATION_MAP = { user: 'userId' };

function withShipmentFallbacks(shipment) {
  const withOwn = withRelationFallback(shipment, SHIPMENT_RELATION_MAP);
  if (withOwn?.order) {
    withOwn.order = withRelationFallback(withOwn.order, ORDER_RELATION_MAP);
  }
  return withOwn;
}

const DEFAULT_INCLUDE = { order: { include: { items: true } } };

export async function findById(id, { include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const shipment = await client.shipment.findUnique({ where: { id }, include });
  return serialize(withShipmentFallbacks(shipment));
}

export async function findByOrderId(orderId, { client = prisma } = {}) {
  const shipment = await client.shipment.findFirst({ where: { orderId }, orderBy: { createdAt: 'desc' } });
  return serialize(withShipmentFallbacks(shipment));
}

export async function find({ where, orderBy = { createdAt: 'desc' }, skip, take, include, client = prisma } = {}) {
  const shipments = await client.shipment.findMany({ where, orderBy, skip, take, include });
  return serialize(shipments.map(withShipmentFallbacks));
}

export async function count({ where, client = prisma } = {}) {
  return client.shipment.count({ where });
}

/** Auto-created the moment an Order's payment resolves — see routes/orders.js's applyPaymentResolution. */
export async function create(data, { client = prisma } = {}) {
  const shipment = await client.shipment.create({ data });
  return serialize(withShipmentFallbacks(shipment));
}

export async function updateById(id, data, { client = prisma } = {}) {
  const shipment = await client.shipment.update({ where: { id }, data });
  return serialize(withShipmentFallbacks(shipment));
}

/**
 * The one real transition primitive — atomically conditional on the
 * shipment's CURRENT status matching what the caller observed, the same
 * race-safe shape orderRepository.tryResolvePayment already proved
 * (WHERE id, status: fromStatus — a second concurrent transition attempt
 * finds zero matching rows and no-ops rather than racing this one).
 * Validates the adjacency map before ever touching the database.
 *
 * Deliberately side-effect-free beyond the status write and its own
 * ShipmentEvent row — stock release, Refund creation, and any other
 * business consequence of a specific transition (e.g. cancellation) is
 * orchestrated one layer up, in routes/shipments.js, the same way
 * applyPaymentResolution orchestrates side effects around
 * orderRepository.tryResolvePayment rather than burying them in the
 * repository.
 */
export async function transition(shipmentId, toStatus, { actor = 'admin', actorUserId, message, metadata, client = prisma } = {}) {
  const current = await client.shipment.findUnique({ where: { id: shipmentId } });
  if (!current) return { applied: false, reason: 'not_found' };

  const allowed = SHIPMENT_TRANSITIONS[current.status] || [];
  if (!allowed.includes(toStatus)) {
    throw new InvalidTransitionError(current.status, toStatus);
  }

  const timestampField =
    toStatus === 'packing' ? { packedAt: new Date() } :
    toStatus === 'picked_up' ? { pickedUpAt: new Date() } :
    toStatus === 'delivered' ? { deliveredAt: new Date() } :
    {};

  const result = await client.shipment.updateMany({
    where: { id: shipmentId, status: current.status },
    data: { status: toStatus, ...timestampField },
  });
  if (result.count === 0) return { applied: false, reason: 'race_lost' };

  await client.shipmentEvent.create({
    data: {
      shipmentId,
      type: 'status_changed',
      actor,
      actorUserId,
      fromStatus: current.status,
      toStatus,
      message: message || `Shipment ${current.status} → ${toStatus}`,
      metadata,
    },
  });

  return { applied: true, fromStatus: current.status, toStatus };
}

export default { findById, findByOrderId, find, count, create, updateById, transition, SHIPMENT_TRANSITIONS, InvalidTransitionError };
