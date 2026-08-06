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

export async function upsert({ userId, department, title, permissions }, { client = prisma } = {}) {
  const profile = await client.staffProfile.upsert({
    where: { userId },
    create: { userId, department, title, permissions: permissions ?? [] },
    update: {
      department,
      ...(title !== undefined && { title }),
      ...(permissions !== undefined && { permissions }),
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

export default { findByUserId, upsert, find };
