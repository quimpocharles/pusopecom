import prisma from '../lib/prisma.js';
import { serialize, withRelationFallback } from './serialize.js';

const ACTOR_RELATION_MAP = { actorUser: 'actorUserId' };

function withEventFallbacks(event) {
  return withRelationFallback(event, ACTOR_RELATION_MAP);
}

/** Append-only, same discipline as orderEventRepository — never updated or deleted. */
export async function create(
  { shipmentId, type, actor, actorUserId, fromStatus, toStatus, message, metadata },
  { client = prisma } = {}
) {
  const event = await client.shipmentEvent.create({
    data: { shipmentId, type, actor, actorUserId, fromStatus, toStatus, message, metadata },
  });
  return serialize(withEventFallbacks(event));
}

/** The Shipment Timeline's one query — full history for one shipment, oldest first. */
export async function findByShipment(shipmentId, { client = prisma } = {}) {
  const events = await client.shipmentEvent.findMany({
    where: { shipmentId },
    orderBy: { createdAt: 'asc' },
    include: { actorUser: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
  return events.map((e) => serialize(withEventFallbacks(e)));
}

export default { create, findByShipment };
