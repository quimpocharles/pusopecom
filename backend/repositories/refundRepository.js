import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';

/**
 * The first real writer PaymentStatus.refunded has ever had — see the
 * schema comment on Refund. Phase 1 only ever creates these in `pending`
 * status (from a Shipment cancellation, routes/shipments.js); actually
 * processing one against Maya's refund API is Phase 2.
 */
export async function create(
  { orderId, paymentId, amount, reason, initiatedByUserId },
  { client = prisma } = {}
) {
  const refund = await client.refund.create({
    data: { orderId, paymentId, amount, reason, initiatedByUserId },
  });
  return serialize(refund);
}

export async function findById(id, { client = prisma } = {}) {
  const refund = await client.refund.findUnique({ where: { id } });
  return serialize(refund);
}

export async function findByOrder(orderId, { client = prisma } = {}) {
  const rows = await client.refund.findMany({ where: { orderId }, orderBy: { createdAt: 'desc' } });
  return serialize(rows);
}

export async function find({ where, orderBy = { createdAt: 'desc' }, skip, take, client = prisma } = {}) {
  const rows = await client.refund.findMany({ where, orderBy, skip, take });
  return serialize(rows);
}

/** Same atomic conditional-update idempotency shape as paymentRepository.resolve. */
export async function updateStatus(id, status, extra = {}, { client = prisma } = {}) {
  const result = await client.refund.updateMany({
    where: { id, status: { not: status } },
    data: { status, ...extra },
  });
  return result.count > 0;
}

export default { create, findById, findByOrder, find, updateStatus };
