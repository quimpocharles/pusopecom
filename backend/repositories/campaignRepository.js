import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';

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
  const campaign = await client.campaign.create({ data });
  return serialize(campaign);
}

export async function updateById(id, data, { client = prisma } = {}) {
  const campaign = await client.campaign.update({ where: { id }, data });
  return serialize(campaign);
}

export async function deleteById(id, { client = prisma } = {}) {
  await client.campaign.update({ where: { id }, data: { active: false } });
}

/**
 * The Hero's data source once Milestone 3 wires it up: the single campaign
 * flagged for the homepage, active, and inside its own schedule window (an
 * unset startDate/endDate means "no bound" on that side). At most one
 * campaign is expected to satisfy this at a time — Milestone 1 doesn't
 * enforce that at the DB level (no partial unique index), since the admin
 * UI that would make "only one" a meaningful constraint doesn't exist yet.
 */
export async function findActiveHomepageCampaign({ now = new Date(), client = prisma } = {}) {
  const campaign = await client.campaign.findFirst({
    where: {
      featuredOnHomepage: true,
      active: true,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });
  return serialize(campaign);
}

export default { findById, find, count, create, updateById, deleteById, findActiveHomepageCampaign };
