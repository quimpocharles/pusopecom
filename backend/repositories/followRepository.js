import prisma from '../lib/prisma.js';
import { serialize, withRelationFallback } from './serialize.js';

const RELATION_MAP = { organization: 'organizationId' };
const withOrgFallback = (row) => (row ? withRelationFallback(row, RELATION_MAP) : row);

/**
 * Idempotent via the schema's @@unique([userId, organizationId]) — upsert
 * rather than create, same pattern as wishlistRepository.add.
 */
export async function follow(userId, organizationId, { client = prisma } = {}) {
  const row = await client.follow.upsert({
    where: { userId_organizationId: { userId, organizationId } },
    update: {},
    create: { userId, organizationId },
  });
  return serialize(row);
}

export async function unfollow(userId, organizationId, { client = prisma } = {}) {
  const result = await client.follow.deleteMany({ where: { userId, organizationId } });
  return result.count > 0;
}

export async function find({ userId, skip, take, client = prisma } = {}) {
  const rows = await client.follow.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
    include: { organization: true },
  });
  return serialize(rows.map(withOrgFallback));
}

export async function count(userId, { client = prisma } = {}) {
  return client.follow.count({ where: { userId } });
}

/** Just the organization ids a user follows — the shape getHomeFeed needs
 * to query recent products without pulling full Organization rows. */
export async function followedOrganizationIds(userId, { client = prisma } = {}) {
  const rows = await client.follow.findMany({ where: { userId }, select: { organizationId: true } });
  return rows.map((r) => r.organizationId);
}

export default { follow, unfollow, find, count, followedOrganizationIds };
