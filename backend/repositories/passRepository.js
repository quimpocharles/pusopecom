import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';

export class InsufficientPassCapacityError extends Error {
  constructor({ passTierId }) {
    super(`Insufficient capacity remaining on pass tier ${passTierId}`);
    this.name = 'InsufficientPassCapacityError';
    this.passTierId = passTierId;
  }
}

// --- PassTier capacity ---

/**
 * Mirrors productRepository.decrementStock's single-atomic-statement
 * shape — genuinely one round trip, not read-then-write. `sold + quantity
 * <= capacity` isn't directly expressible as a Prisma filter (comparing
 * two columns plus a literal), so it's rearranged to
 * `sold <= capacity - quantity`, with `capacity` passed in by the caller
 * rather than read here — the same shape promoCodeRepository.tryRedeem
 * already uses for `redemptionCount < maxRedemptions` (maxRedemptions is
 * a parameter there too, never re-read inside that function).
 *
 * An earlier version read `capacity` internally, inside this same
 * function, before the conditional UPDATE — a second round trip inside
 * the race-sensitive step. Two concurrent callers racing for the exact
 * last unit of capacity could then hit a raw, unhandled
 * PrismaClientKnownRequestError instead of the clean
 * InsufficientPassCapacityError below (confirmed via two consecutive
 * isolated reruns of the concurrency test, while the equivalent
 * decrementStock race passed cleanly on the same database — this
 * function's extra round trip, not the environment, was the difference).
 * Capacity is effectively static (admin-set, not concurrently written the
 * way `sold` is), so reading it in the caller — which already fetches the
 * tier once per order, before the transaction even starts — costs nothing
 * real and removes the second round trip from the transaction entirely.
 */
export async function decrementTierCapacity({ passTierId, quantity, capacity }, { client } = {}) {
  if (!client) throw new Error('decrementTierCapacity must be called with a transaction client');
  if (capacity == null) {
    throw new Error(`Pass tier ${passTierId} has no capacity configured`);
  }
  const result = await client.passTier.updateMany({
    where: { id: passTierId, sold: { lte: capacity - quantity } },
    data: { sold: { increment: quantity } },
  });
  if (result.count === 0) throw new InsufficientPassCapacityError({ passTierId });
}

/** Symmetric inverse of decrementTierCapacity. */
export async function restoreTierCapacity({ passTierId, quantity }, { client } = {}) {
  if (!client) throw new Error('restoreTierCapacity must be called with a transaction client');
  await client.passTier.updateMany({
    where: { id: passTierId, sold: { gte: quantity } },
    data: { sold: { decrement: quantity } },
  });
}

// --- Pass: the individual scannable admission credential ---

const DEFAULT_INCLUDE = {
  passEvent: { include: { venue: true, organization: { select: { id: true, name: true, slug: true } } } },
  passTier: { include: { venueSection: true } },
};

export async function findById(id, { include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const pass = await client.pass.findUnique({ where: { id }, include });
  return serialize(pass);
}

export async function findByQrToken(qrToken, { include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const pass = await client.pass.findUnique({ where: { qrToken }, include });
  return serialize(pass);
}

export async function findByOrderId(orderId, { include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const passes = await client.pass.findMany({ where: { orderId }, include });
  return serialize(passes);
}

export async function findByUserId(userId, { include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const passes = await client.pass.findMany({
    where: { order: { userId } },
    include,
    orderBy: { createdAt: 'desc' },
  });
  return serialize(passes);
}

export async function updateById(id, data, { client = prisma } = {}) {
  const pass = await client.pass.update({ where: { id }, data });
  return serialize(pass);
}

/**
 * Creates the Pass row and its opening PassLog entry — must run inside the
 * order-creation transaction, alongside decrementTierCapacity. Issued
 * directly (no separate "reserved" pre-status): a Pass only comes into
 * existence once an Order successfully commits, at which point the
 * capacity reservation has already succeeded — same "reserved at
 * placement, not payment confirmation" rule Merchandise stock already
 * follows.
 */
export async function issuePass({ orderId, passEventId, passTierId, price }, { client } = {}) {
  if (!client) throw new Error('issuePass must be called with a transaction client');
  const pass = await client.pass.create({
    data: { orderId, passEventId, passTierId, price, status: 'issued' },
  });
  await client.passLog.create({
    data: { passId: pass.id, type: 'created', actor: 'system', message: 'Pass issued at order placement' },
  });
  return serialize(pass);
}

export const PASS_TRANSITIONS = {
  issued: ['checked_in', 'cancelled', 'refunded'],
  checked_in: [],
  cancelled: [],
  refunded: [],
};

export class InvalidPassTransitionError extends Error {
  constructor(fromStatus, toStatus) {
    super(`Cannot transition Pass from "${fromStatus}" to "${toStatus}"`);
    this.name = 'InvalidPassTransitionError';
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
  }
}

/**
 * The one real transition primitive for Pass.status — exact mirror of
 * shipmentRepository.transition: atomic CAS on the observed current
 * status (a second concurrent transition finds zero matching rows and
 * no-ops rather than racing), validated against PASS_TRANSITIONS first,
 * one typed PassLog row per applied transition. A check-in scan is
 * literally `transition(passId, 'checked_in', { actor: 'admin', actorUserId, metadata: { gate } })`.
 */
export async function transition(passId, toStatus, { actor = 'admin', actorUserId, message, metadata, client = prisma } = {}) {
  const current = await client.pass.findUnique({ where: { id: passId } });
  if (!current) return { applied: false, reason: 'not_found' };

  const allowed = PASS_TRANSITIONS[current.status] || [];
  if (!allowed.includes(toStatus)) {
    throw new InvalidPassTransitionError(current.status, toStatus);
  }

  const timestampField = toStatus === 'checked_in' ? { checkedInAt: new Date() } : {};

  const result = await client.pass.updateMany({
    where: { id: passId, status: current.status },
    data: { status: toStatus, ...timestampField },
  });
  if (result.count === 0) return { applied: false, reason: 'race_lost' };

  await client.passLog.create({
    data: {
      passId,
      type: 'status_changed',
      actor,
      actorUserId,
      fromStatus: current.status,
      toStatus,
      message: message || `Pass ${current.status} → ${toStatus}`,
      metadata,
    },
  });

  return { applied: true, fromStatus: current.status, toStatus };
}

export default {
  decrementTierCapacity,
  restoreTierCapacity,
  findById,
  findByQrToken,
  findByOrderId,
  findByUserId,
  updateById,
  issuePass,
  transition,
  PASS_TRANSITIONS,
  InsufficientPassCapacityError,
  InvalidPassTransitionError,
};
