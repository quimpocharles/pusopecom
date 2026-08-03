import prisma from '../lib/prisma.js';
import { serialize, withRelationFallback } from './serialize.js';

const RELATION_MAP = { product: 'productId' };
const withProductFallback = (row) => (row ? withRelationFallback(row, RELATION_MAP) : row);

/**
 * Idempotent via the schema's @@unique([userId, productId]) — upsert rather
 * than create, so re-adding an already-wishlisted product is a no-op, not
 * a P2002 the route has to catch.
 */
export async function add(userId, productId, { client = prisma } = {}) {
  const row = await client.wishlist.upsert({
    where: { userId_productId: { userId, productId } },
    update: {},
    create: { userId, productId },
  });
  return serialize(row);
}

export async function remove(userId, productId, { client = prisma } = {}) {
  const result = await client.wishlist.deleteMany({ where: { userId, productId } });
  return result.count > 0;
}

export async function find({ userId, skip, take, client = prisma } = {}) {
  const rows = await client.wishlist.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
    include: { product: true },
  });
  return serialize(rows.map(withProductFallback));
}

export async function count(userId, { client = prisma } = {}) {
  return client.wishlist.count({ where: { userId } });
}

export default { add, remove, find, count };
