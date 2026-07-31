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

export default { create, find, deleteOlderThan };
