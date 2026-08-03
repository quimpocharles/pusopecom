import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';
import { normalizeDateFields } from '../lib/dateInput.js';

const DATE_FIELDS = ['startDate', 'endDate'];

export async function findById(id, { client = prisma } = {}) {
  const campaign = await client.campaign.findUnique({ where: { id } });
  return serialize(campaign);
}

export async function find({ where, orderBy, skip, take, client = prisma } = {}) {
  const campaigns = await client.campaign.findMany({ where, orderBy, skip, take });
  return serialize(campaigns);
}

export async function count({ where, client = prisma } = {}) {
  return client.campaign.count({ where });
}

export async function create(data, { client = prisma } = {}) {
  const campaign = await client.campaign.create({ data: normalizeDateFields(data, DATE_FIELDS) });
  return serialize(campaign);
}

export async function updateById(id, data, { client = prisma } = {}) {
  const campaign = await client.campaign.update({ where: { id }, data: normalizeDateFields(data, DATE_FIELDS) });
  return serialize(campaign);
}

export async function deleteById(id, { client = prisma } = {}) {
  await client.campaign.update({ where: { id }, data: { active: false } });
}

/**
 * The active campaign for a given homepage slot (the Hero, or the AI Try-On
 * section — see CampaignPlacement): flagged for the homepage, active, and
 * inside its own schedule window (an unset startDate/endDate means "no
 * bound" on that side). At most one campaign is expected to satisfy this
 * per placement at a time — not enforced at the DB level (no partial unique
 * index), left to the admin UI to keep honest.
 *
 * Includes featuredProduct so a tryOn campaign's CTA can resolve a product
 * slug without a second request — safe to always include since it's a
 * cheap, optional relation and every other placement simply has it null.
 */
export async function findActiveHomepageCampaign({ placement, now = new Date(), client = prisma } = {}) {
  const campaign = await client.campaign.findFirst({
    where: {
      placement,
      featuredOnHomepage: true,
      active: true,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
      ],
    },
    orderBy: { createdAt: 'desc' },
    include: { featuredProduct: true },
  });
  return serialize(campaign);
}

export default { findById, find, count, create, updateById, deleteById, findActiveHomepageCampaign };
