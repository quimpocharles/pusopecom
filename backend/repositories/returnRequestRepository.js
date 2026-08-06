import prisma from '../lib/prisma.js';
import { serialize, withRelationFallback } from './serialize.js';

const RELATION_MAP = { user: 'userId', reviewedByUser: 'reviewedByUserId' };

function withFallbacks(returnRequest) {
  return withRelationFallback(returnRequest, RELATION_MAP);
}

const DEFAULT_INCLUDE = {
  order: { include: { items: true } },
  items: { include: { orderItem: true } },
  refunds: true,
};

export async function create({ orderId, userId, reason, description, photos, items }, { client = prisma } = {}) {
  const created = await client.returnRequest.create({
    data: {
      orderId,
      userId,
      reason,
      description,
      photos: photos ?? [],
      items: { create: items.map(({ orderItemId, quantity }) => ({ orderItemId, quantity })) },
    },
    include: DEFAULT_INCLUDE,
  });
  return serialize(withFallbacks(created));
}

export async function findById(id, { include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const returnRequest = await client.returnRequest.findUnique({ where: { id }, include });
  return serialize(withFallbacks(returnRequest));
}

export async function findByOrder(orderId, { client = prisma } = {}) {
  const rows = await client.returnRequest.findMany({
    where: { orderId },
    include: DEFAULT_INCLUDE,
    orderBy: { requestedAt: 'desc' },
  });
  return rows.map((r) => serialize(withFallbacks(r)));
}

/** A customer's own return history — guest orders are matched by email at the route layer, not here. */
export async function findByUser(userId, { client = prisma } = {}) {
  const rows = await client.returnRequest.findMany({
    where: { userId },
    include: DEFAULT_INCLUDE,
    orderBy: { requestedAt: 'desc' },
  });
  return rows.map((r) => serialize(withFallbacks(r)));
}

/** The admin Returns queue — filterable by status, same shape as shipmentRepository.find. */
export async function find({ where, orderBy = { requestedAt: 'desc' }, skip, take, client = prisma } = {}) {
  const rows = await client.returnRequest.findMany({
    where,
    orderBy,
    skip,
    take,
    include: { order: { select: { orderNumber: true, email: true, total: true, user: { select: { firstName: true, lastName: true } } } } },
  });
  return rows.map((r) => serialize(withFallbacks(r)));
}

export async function count({ where, client = prisma } = {}) {
  return client.returnRequest.count({ where });
}

export async function updateById(id, data, { client = prisma } = {}) {
  const updated = await client.returnRequest.update({ where: { id }, data, include: DEFAULT_INCLUDE });
  return serialize(withFallbacks(updated));
}

export async function updateItemCondition(returnItemId, condition, { client = prisma } = {}) {
  const updated = await client.returnItem.update({ where: { id: returnItemId }, data: { condition } });
  return serialize(updated);
}

// Same adjacency-validated state-machine discipline as
// shipmentRepository.SHIPMENT_TRANSITIONS — a request can't jump from
// 'requested' straight to 'refunded' any more than a Shipment can jump
// from awaiting_picking straight to delivered.
export const RETURN_TRANSITIONS = {
  requested: ['under_review', 'rejected'],
  under_review: ['approved', 'rejected'],
  approved: ['return_shipped'],
  rejected: [],
  return_shipped: ['received'],
  received: ['inspected'],
  inspected: ['refund_pending', 'closed'], // closed: nothing came back refundable
  refund_pending: ['refunded'],
  refunded: ['closed'],
  closed: [],
};

export class InvalidReturnTransitionError extends Error {
  constructor(fromStatus, toStatus) {
    super(`Cannot transition ReturnRequest from "${fromStatus}" to "${toStatus}"`);
    this.name = 'InvalidReturnTransitionError';
  }
}

/** Atomic conditional update, same shape as shipmentRepository.transition — a race loses cleanly, not corruptly. */
export async function transition(id, toStatus, extra = {}, { client = prisma } = {}) {
  const current = await client.returnRequest.findUnique({ where: { id } });
  if (!current) return { applied: false, reason: 'not_found' };

  const allowed = RETURN_TRANSITIONS[current.status] || [];
  if (!allowed.includes(toStatus)) {
    throw new InvalidReturnTransitionError(current.status, toStatus);
  }

  const result = await client.returnRequest.updateMany({
    where: { id, status: current.status },
    data: { status: toStatus, ...extra },
  });
  if (result.count === 0) return { applied: false, reason: 'race_lost' };

  return { applied: true, fromStatus: current.status, toStatus };
}

export default { create, findById, findByOrder, findByUser, find, count, updateById, updateItemCondition, transition, RETURN_TRANSITIONS };
