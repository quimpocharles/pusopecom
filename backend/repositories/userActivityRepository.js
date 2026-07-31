import prisma from '../lib/prisma.js';
import { serialize, withRelationFallback } from './serialize.js';

const RELATION_MAP = { user: 'userId', product: 'productId' };
const withFallbacks = (activity) => (activity ? withRelationFallback(activity, RELATION_MAP) : activity);

export async function create(data, { client = prisma } = {}) {
  const activity = await client.userActivity.create({ data });
  return withFallbacks(serialize(activity));
}

export async function find({ where, orderBy, skip, take, client = prisma } = {}) {
  const activities = await client.userActivity.findMany({ where, orderBy, skip, take });
  return serialize(activities.map(withFallbacks));
}

/**
 * Replaces MongoDB's TTL index (`expireAfterSeconds: 90 days`) — Postgres
 * has no equivalent, so this is called from a daily node-cron job (see
 * server.js), the same pattern already used there for the daily sales
 * report and for tryOnLogRepository.deleteOlderThan.
 */
export async function deleteOlderThan(days, { client = prisma } = {}) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await client.userActivity.deleteMany({ where: { timestamp: { lt: cutoff } } });
  return result.count;
}

export default { create, find, deleteOlderThan };
