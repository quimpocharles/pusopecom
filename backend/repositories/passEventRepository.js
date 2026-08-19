import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';
import { normalizeDateFields } from '../lib/dateInput.js';

const DATE_FIELDS = ['startsAt', 'endsAt', 'salesStartAt', 'salesEndAt'];

const DEFAULT_INCLUDE = {
  venue: true,
  organization: { select: { id: true, name: true, slug: true, logoUrl: true } },
  team: { select: { id: true, name: true, slug: true } },
  tiers: { include: { venueSection: true } },
};

export async function findById(id, { include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const event = await client.passEvent.findUnique({ where: { id }, include });
  return serialize(event);
}

export async function findBySlug(slug, { include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const event = await client.passEvent.findUnique({ where: { slug }, include });
  return serialize(event);
}

export async function find({ where, orderBy, skip, take, include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const events = await client.passEvent.findMany({ where, orderBy, skip, take, include });
  return serialize(events);
}

export async function count({ where, client = prisma } = {}) {
  return client.passEvent.count({ where });
}

export async function create(data, { client = prisma } = {}) {
  const event = await client.passEvent.create({ data: normalizeDateFields(data, DATE_FIELDS) });
  return findById(event.id, { client });
}

export async function updateById(id, data, { client = prisma } = {}) {
  await client.passEvent.update({ where: { id }, data: normalizeDateFields(data, DATE_FIELDS) });
  return findById(id, { client });
}

export async function deleteById(id, { client = prisma } = {}) {
  await client.passEvent.update({ where: { id }, data: { active: false } });
}

/**
 * Public browse — active events whose event window hasn't ended yet,
 * soonest first. Doesn't filter on the sales window itself (a not-yet-
 * on-sale event is still worth showing as "coming soon"); PassTier
 * availability/on-sale gating is enforced at hold/purchase time, not here.
 */
export async function findUpcoming({ organizationId, skip, take, client = prisma } = {}) {
  const events = await client.passEvent.findMany({
    where: { active: true, endsAt: { gte: new Date() }, ...(organizationId && { organizationId }) },
    orderBy: { startsAt: 'asc' },
    skip,
    take,
    include: DEFAULT_INCLUDE,
  });
  return serialize(events);
}

// --- PassTier ---

export async function createTier(data, { client = prisma } = {}) {
  const tier = await client.passTier.create({ data, include: { venueSection: true } });
  return serialize(tier);
}

export async function updateTier(id, data, { client = prisma } = {}) {
  const tier = await client.passTier.update({ where: { id }, data });
  return serialize(tier);
}

export async function findTierById(id, { client = prisma } = {}) {
  const tier = await client.passTier.findUnique({ where: { id }, include: { venueSection: true } });
  return serialize(tier);
}

/** Hard delete — same convention as ProductSize (a variant is deleted/recreated by admins, not soft-retired). */
export async function deleteTier(id, { client = prisma } = {}) {
  await client.passTier.delete({ where: { id } });
}

export default {
  findById,
  findBySlug,
  find,
  count,
  create,
  updateById,
  deleteById,
  findUpcoming,
  createTier,
  updateTier,
  findTierById,
  deleteTier,
};
