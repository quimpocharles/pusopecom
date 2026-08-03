import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';

export async function create(data, { client = prisma } = {}) {
  const row = await client.notification.create({ data });
  return serialize(row);
}

export async function find({ userId, read, skip, take, client = prisma } = {}) {
  const rows = await client.notification.findMany({
    where: { userId, ...(read !== undefined && { read }) },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });
  return serialize(rows);
}

export async function count(userId, { read, client = prisma } = {}) {
  return client.notification.count({ where: { userId, ...(read !== undefined && { read }) } });
}

/** Scoped to `userId` in the WHERE clause, not just the id list — a caller
 * can never mark another customer's notification as read by guessing ids. */
export async function markRead(userId, ids, { client = prisma } = {}) {
  const result = await client.notification.updateMany({
    where: { userId, id: { in: ids } },
    data: { read: true, readAt: new Date() },
  });
  return result.count;
}

export async function markAllRead(userId, { client = prisma } = {}) {
  const result = await client.notification.updateMany({
    where: { userId, read: false },
    data: { read: true, readAt: new Date() },
  });
  return result.count;
}

export default { create, find, count, markRead, markAllRead };
