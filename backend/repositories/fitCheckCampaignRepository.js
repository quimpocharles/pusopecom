import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';
import { normalizeDateFields } from '../lib/dateInput.js';

const DATE_FIELDS = ['startDate', 'endDate'];

export async function findById(id, { client = prisma } = {}) {
  const campaign = await client.fitCheckCampaign.findUnique({ where: { id } });
  return serialize(campaign);
}

export async function find({ where, orderBy, skip, take, client = prisma } = {}) {
  const campaigns = await client.fitCheckCampaign.findMany({ where, orderBy, skip, take });
  return serialize(campaigns);
}

export async function count({ where, client = prisma } = {}) {
  return client.fitCheckCampaign.count({ where });
}

export async function create(data, { client = prisma } = {}) {
  const campaign = await client.fitCheckCampaign.create({ data: normalizeDateFields(data, DATE_FIELDS) });
  return serialize(campaign);
}

export async function updateById(id, data, { client = prisma } = {}) {
  const campaign = await client.fitCheckCampaign.update({ where: { id }, data: normalizeDateFields(data, DATE_FIELDS) });
  return serialize(campaign);
}

/** Soft delete — same convention as campaignRepository.deleteById. */
export async function deleteById(id, { client = prisma } = {}) {
  await client.fitCheckCampaign.update({ where: { id }, data: { active: false } });
}

/**
 * The highest-priority active, in-window, unlimited-Fit-Check campaign
 * covering a given product — matched either by direct productIds
 * membership or by category. Powers both the quota bypass check
 * (lib/fitCheckQuota.js) and the "Unlimited Fit Checks — Sponsored by X"
 * surfacing on product pages: the same query is correct for both, since a
 * campaign with unlimitedFitChecks toggled off shouldn't bypass the quota
 * *or* claim to. Same active + schedule-window pattern as
 * campaignRepository.findActiveHomepageCampaign; ties broken by priority
 * desc, then newest.
 */
export async function findActiveForProduct({ productId, category, now = new Date(), client = prisma } = {}) {
  const campaign = await client.fitCheckCampaign.findFirst({
    where: {
      active: true,
      unlimitedFitChecks: true,
      OR: [{ productIds: { has: productId } }, ...(category ? [{ category }] : [])],
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
      ],
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });
  return serialize(campaign);
}

export default { findById, find, count, create, updateById, deleteById, findActiveForProduct };
