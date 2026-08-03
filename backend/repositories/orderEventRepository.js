import prisma from '../lib/prisma.js';
import { serialize, withRelationFallback } from './serialize.js';

const ACTOR_RELATION_MAP = { actorUser: 'actorUserId' };

function withEventFallbacks(event) {
  return withRelationFallback(event, ACTOR_RELATION_MAP);
}

/**
 * Appends one row to an Order's audit trail. Never updates or deletes an
 * existing event — the log is append-only by construction, since its whole
 * purpose is preserving what happened even after the Order's own columns
 * move on to a different state.
 */
export async function create(
  { orderId, type, actor, actorUserId, message, metadata },
  { client = prisma } = {}
) {
  const event = await client.orderEvent.create({
    data: { orderId, type, actor, actorUserId, message, metadata },
  });
  return serialize(withEventFallbacks(event));
}

/** The Admin Order Timeline's one query — full history for one order, oldest first. */
export async function findByOrder(orderId, { client = prisma } = {}) {
  const events = await client.orderEvent.findMany({
    where: { orderId },
    orderBy: { createdAt: 'asc' },
    include: { actorUser: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
  return events.map((e) => serialize(withEventFallbacks(e)));
}

export default {
  create,
  findByOrder,
};
