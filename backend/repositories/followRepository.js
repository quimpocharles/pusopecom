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

/**
 * Follower count per organization — for the Organizations report (Reports
 * module redesign, Phase 2). No such per-organization count existed before
 * this; `count(userId)` above is the inverse (a user's own follow count),
 * not what a report ranking organizations by followers needs.
 */
export async function followerCountsByOrganization(organizationIds, { client = prisma } = {}) {
  if (!organizationIds || organizationIds.length === 0) return new Map();
  const groups = await client.follow.groupBy({
    by: ['organizationId'],
    where: { organizationId: { in: organizationIds } },
    _count: true,
  });
  return new Map(groups.map((g) => [g.organizationId, g._count]));
}

export default { follow, unfollow, find, count, followedOrganizationIds, followerCountsByOrganization };
