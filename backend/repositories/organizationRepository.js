import prisma from '../lib/prisma.js';
import { generateSlug } from '../lib/slug.js';
import { serialize, withRelationFallback } from './serialize.js';

const RELATION_MAP = { verifiedBy: 'verifiedByUserId' };
const withVerifierFallback = (org) => (org ? withRelationFallback(org, RELATION_MAP) : org);

const DEFAULT_INCLUDE = undefined;

export async function findById(id, { include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const org = await client.organization.findUnique({ where: { id }, include });
  return withVerifierFallback(serialize(org));
}

export async function findBySlug(slug, { include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const org = await client.organization.findUnique({ where: { slug }, include });
  return withVerifierFallback(serialize(org));
}

export async function find({ where, orderBy, skip, take, include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const orgs = await client.organization.findMany({ where, orderBy, skip, take, include });
  return serialize(orgs).map(withVerifierFallback);
}

export async function count({ where, client = prisma } = {}) {
  return client.organization.count({ where });
}

/** Organization plus its Teams — the Org -> Teams read used to prove the pilot end-to-end. */
export async function findWithTeams(idOrSlug, { client = prisma } = {}) {
  // slug and id are both opaque strings here (uuid ids, hyphenated slugs) —
  // try id first since callers overwhelmingly pass one; a non-uuid string
  // makes Postgres throw rather than return null, hence the catch, not
  // because "not found" is an error case.
  const byId = await client.organization
    .findUnique({ where: { id: idOrSlug }, include: { teams: true } })
    .catch(() => null);
  const org = byId ?? (await client.organization.findUnique({ where: { slug: idOrSlug }, include: { teams: true } }));
  return withVerifierFallback(serialize(org));
}

export async function create({ slug, name, ...data }, { client = prisma } = {}) {
  const org = await client.organization.create({
    data: { ...data, name, slug: slug || generateSlug(name) },
  });
  return withVerifierFallback(serialize(org));
}

export async function updateById(id, data, { client = prisma } = {}) {
  const org = await client.organization.update({ where: { id }, data });
  return withVerifierFallback(serialize(org));
}

export async function deleteById(id, { client = prisma } = {}) {
  await client.organization.delete({ where: { id } });
}

/**
 * Participation is the second relationship kind (docs/INFORMATION_ARCHITECTURE.md)
 * — a member Organization participates IN a body Organization, distinct
 * from the ownership Organization has over its own Teams. Both directions
 * are real, separate queries because the edge is directional: FEU
 * participates in UAAP; UAAP does not participate in FEU.
 */
export async function findParticipations(memberOrganizationId, { client = prisma } = {}) {
  const rows = await client.organizationParticipation.findMany({
    where: { memberOrganizationId },
    include: { inOrganization: true },
  });
  return serialize(rows);
}

export async function findParticipants(inOrganizationId, { client = prisma } = {}) {
  const rows = await client.organizationParticipation.findMany({
    where: { inOrganizationId },
    include: { memberOrganization: true },
  });
  return serialize(rows);
}

/**
 * Batch counterpart to findParticipations — every participation row for a
 * whole set of member organizations in one query, not one call per org.
 * Added for the Organizations report's "Top Leagues" rollup (Reports
 * module redesign, Phase 2): a school's (member org's) revenue attributes
 * up to each league (body org, kind='league') it participates in.
 */
export async function findParticipationsForMembers(memberOrganizationIds, { client = prisma } = {}) {
  if (!memberOrganizationIds || memberOrganizationIds.length === 0) return [];
  const rows = await client.organizationParticipation.findMany({
    where: { memberOrganizationId: { in: memberOrganizationIds } },
    include: { inOrganization: true },
  });
  return serialize(rows);
}

export async function addParticipation({ memberOrganizationId, inOrganizationId, startDate }, { client = prisma } = {}) {
  const row = await client.organizationParticipation.create({
    data: { memberOrganizationId, inOrganizationId, startDate: startDate ?? null },
  });
  return serialize(row);
}

export async function endParticipation(id, endDate = new Date(), { client = prisma } = {}) {
  const row = await client.organizationParticipation.update({ where: { id }, data: { endDate } });
  return serialize(row);
}

/**
 * Requests review for an unverified Organization. Atomic conditional
 * update (WHERE-guarded, not a plain update) — same reasoning as
 * productRepository.decrementStock / orderRepository.tryResolvePayment:
 * a status transition must not double-apply under a race. Returns true
 * only if this call actually performed the transition.
 */
export async function requestVerification(id, { client = prisma } = {}) {
  const result = await client.organization.updateMany({
    where: { id, verificationStatus: 'unverified' },
    data: { verificationStatus: 'requested', verificationRequestedAt: new Date() },
  });
  return result.count > 0;
}

/**
 * The only path in this codebase that may change verificationStatus to or
 * from `granted`/`revoked`. CLAUDE.md: "Trust & Verification grant/revoke
 * decisions stay human" — enforced here as a guard clause, not left to
 * caller discipline. No seed, script, or backfill in the Organization-first
 * pilot migration calls this function at all; it exists so the guard is
 * provably in place before any admin verification workflow (Phase 2) is
 * ever built on top of it.
 *
 * Uses the same atomic-conditional-updateMany pattern as
 * requestVerification, guarded additionally by `expectedCurrentStatus` so
 * a stale "reviewed" decision can't clobber a status that already moved on.
 */
export async function recordVerificationDecision(
  id,
  { status, verifiedByUserId, note, expectedCurrentStatus },
  { client = prisma } = {}
) {
  if ((status === 'granted' || status === 'revoked') && !verifiedByUserId) {
    throw new Error(`recordVerificationDecision: ${status} requires a verifiedByUserId`);
  }

  const data = { verificationStatus: status, verificationNote: note ?? null };
  if (status === 'granted') {
    data.verifiedAt = new Date();
    data.verifiedByUserId = verifiedByUserId;
  }

  const result = await client.organization.updateMany({
    where: expectedCurrentStatus ? { id, verificationStatus: expectedCurrentStatus } : { id },
    data,
  });
  return result.count > 0;
}

/**
 * Customer Portal "organizations" — the customer's own purchase history,
 * not a follow/favorite relationship (that feature doesn't exist yet; see
 * the Wishlist/Notification/OrganizationFollow scoping decision this
 * shipped under). Two queries, not N+1: one to collect the distinct
 * organization ids behind the user's order items, one to fetch those
 * organizations.
 */
export async function findPurchasedByUser(userId, { client = prisma } = {}) {
  const items = await client.orderItem.findMany({
    where: { order: { userId }, product: { organizationId: { not: null } } },
    select: { product: { select: { organizationId: true } } },
  });
  const orgIds = [...new Set(items.map((i) => i.product.organizationId).filter(Boolean))];
  if (orgIds.length === 0) return [];

  const orgs = await client.organization.findMany({ where: { id: { in: orgIds } } });
  return serialize(orgs).map(withVerifierFallback);
}

export default {
  findById,
  findBySlug,
  find,
  count,
  findWithTeams,
  create,
  updateById,
  deleteById,
  findParticipations,
  findParticipants,
  findParticipationsForMembers,
  addParticipation,
  endParticipation,
  requestVerification,
  recordVerificationDecision,
  findPurchasedByUser,
};
