import prisma from '../lib/prisma.js';
import { serialize, withRelationFallback } from './serialize.js';

const RELATION_MAP = { product: 'productId' };
const withProductFallback = (log) => (log ? withRelationFallback(log, RELATION_MAP) : log);

export async function create(data, { client = prisma } = {}) {
  const log = await client.tryOnLog.create({ data });
  return withProductFallback(serialize(log));
}

export async function find({ where, orderBy, skip, take, include, client = prisma } = {}) {
  const logs = await client.tryOnLog.findMany({ where, orderBy, skip, take, include });
  return serialize(logs.map(withProductFallback));
}

/**
 * Replaces MongoDB's TTL index (`expireAfterSeconds: 90 days`) — Postgres
 * has no equivalent, so this is called from a daily node-cron job (see
 * server.js), the same pattern already used there for the daily sales
 * report and for userActivityRepository.deleteOlderThan.
 */
export async function deleteOlderThan(days, { client = prisma } = {}) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await client.tryOnLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return result.count;
}

/**
 * Top N most-tried-on products, all-time — backs the "Most Tried-On
 * Products" dashboard widget. A real SQL groupBy rather than fetch-all-
 * then-reduce-in-JS (unlike routes/reports.js's own reports): this can run
 * on every dashboard load, not just an admin opening a report page, so it
 * doesn't get the same "small enough dataset, simplicity wins" pass — same
 * reasoning as orderRepository.getTopSellingProducts, which this mirrors.
 */
export async function mostTried(limit = 5, { client = prisma } = {}) {
  const groups = await client.tryOnLog.groupBy({
    by: ['productId'],
    where: { productId: { not: null } },
    _count: true,
    orderBy: { _count: { productId: 'desc' } },
    take: limit,
  });

  return Promise.all(
    groups.map(async (g) => {
      const sample = await client.tryOnLog.findFirst({
        where: { productId: g.productId },
        select: { productName: true, productImage: true },
      });
      return { productName: sample?.productName, productImage: sample?.productImage, count: g._count.productId };
    })
  );
}

export default { create, find, deleteOlderThan, mostTried };
