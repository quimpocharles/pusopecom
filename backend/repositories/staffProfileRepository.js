import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';

/**
 * Enterprise Fulfillment Blueprint §5 — deliberately separate from User
 * (see the schema comment on StaffProfile). Every function here is a no-op
 * for a customer-role User; nothing in this repository enforces that
 * distinction itself — the routes/settings layer is what only ever calls
 * this for admin-role Users.
 */
export async function findByUserId(userId, { client = prisma } = {}) {
  const profile = await client.staffProfile.findUnique({ where: { userId } });
  return serialize(profile);
}

/** Batched sibling to findByUserId — powers the Settings > Security roles list without N+1 queries. */
export async function findByUserIds(userIds, { client = prisma } = {}) {
  if (userIds.length === 0) return [];
  const profiles = await client.staffProfile.findMany({ where: { userId: { in: userIds } } });
  return profiles.map(serialize);
}

export async function upsert({ userId, department, title, permissions, updatedByUserId }, { client = prisma } = {}) {
  const profile = await client.staffProfile.upsert({
    where: { userId },
    create: { userId, department, title, permissions: permissions ?? [], updatedByUserId },
    update: {
      department,
      ...(title !== undefined && { title }),
      ...(permissions !== undefined && { permissions }),
      ...(updatedByUserId !== undefined && { updatedByUserId }),
    },
  });
  return serialize(profile);
}

/** Department-scoped staff list — powers "who's in Warehouse" for the assignment picker. */
export async function find({ department, active, client = prisma } = {}) {
  const rows = await client.staffProfile.findMany({
    where: { ...(department && { department }), ...(active !== undefined && { active }) },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((r) => serialize(r));
}

export default { findByUserId, findByUserIds, upsert, find };
