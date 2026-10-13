import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';
import { toCentavos } from '../lib/refundMath.js';

/**
 * The first real writer PaymentStatus.refunded has ever had — see the
 * schema comment on Refund. Phase 1 only ever creates these in `pending`
 * status (from a Shipment cancellation, routes/shipments.js); actually
 * processing one against Maya's refund API is Phase 2.
 */
export async function create(
  { orderId, paymentId, returnRequestId, amount, reason, initiatedByUserId },
  { client = prisma } = {}
) {
  const refund = await client.refund.create({
    data: { orderId, paymentId, returnRequestId, amount, reason, initiatedByUserId },
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

export async function count({ where, client = prisma } = {}) {
  return client.refund.count({ where });
}

/** Same atomic conditional-update idempotency shape as paymentRepository.resolve. */
export async function updateStatus(id, status, extra = {}, { client = prisma } = {}) {
  const result = await client.refund.updateMany({
    where: { id, status: { not: status } },
    data: { status, ...extra },
  });
  return result.count > 0;
}

/**
 * The atomic conditional transition for a manually-recorded refund — an
 * updateMany guarded on the refund still being in one of `fromStatuses`
 * (pending from a cancellation/return, or failed from a prior automated
 * attempt). A concurrent second record call finds zero matching rows and
 * no-ops; returns whether this call actually recorded it, the same race-safe
 * shape as updateStatus/resolve.
 */
export async function recordSucceeded(id, { fromStatuses, extra = {}, client = prisma } = {}) {
  const result = await client.refund.updateMany({
    where: { id, status: { in: fromStatuses } },
    data: { status: 'succeeded', ...extra },
  });
  return result.count > 0;
}

/**
 * Stage 2, Step 3 — set a refund's amount, but only while it is still in one
 * of `fromStatuses` (pending/failed). Status is deliberately NOT touched, so a
 * succeeded/processing refund can never be adjusted; a concurrent record or
 * adjust finds zero matching rows and no-ops. Returns whether this call
 * actually applied the new amount.
 */
export async function adjustAmount(id, { fromStatuses, amount, client = prisma } = {}) {
  const result = await client.refund.updateMany({
    where: { id, status: { in: fromStatuses } },
    data: { amount },
  });
  return result.count > 0;
}

/**
 * Capacity already committed against an order's refundable total: a
 * succeeded refund is money actually returned, and a `processing` refund
 * has an unknown external state and is treated conservatively as committed
 * too, so the same capacity can never be spent twice. This is the single
 * definition of "committed" shared by /record, /adjust (routes/refunds.js)
 * and the inspection route (routes/returns.js) — the query itself was
 * previously duplicated verbatim in all three places.
 */
export async function getCommittedCentavos(orderId, { client = prisma } = {}) {
  const [committedReturnOrigin, committedAll] = await Promise.all([
    client.refund.aggregate({
      where: { orderId, returnRequestId: { not: null }, status: { in: ['succeeded', 'processing'] } },
      _sum: { amount: true },
    }),
    client.refund.aggregate({
      where: { orderId, status: { in: ['succeeded', 'processing'] } },
      _sum: { amount: true },
    }),
  ]);
  return {
    committedReturnOriginCentavos: toCentavos(committedReturnOrigin._sum.amount || 0),
    committedAllCentavos: toCentavos(committedAll._sum.amount || 0),
  };
}

export default {
  create,
  findById,
  findByOrder,
  find,
  count,
  updateStatus,
  recordSucceeded,
  adjustAmount,
  getCommittedCentavos,
};
