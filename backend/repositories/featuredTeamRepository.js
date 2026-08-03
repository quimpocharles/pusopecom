import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';
import { normalizeDateFields } from '../lib/dateInput.js';

const DATE_FIELDS = ['startDate', 'endDate'];

export async function findById(id, { client = prisma } = {}) {
  const team = await client.featuredTeam.findUnique({ where: { id } });
  return serialize(team);
}

export async function find({ where, orderBy, skip, take, client = prisma } = {}) {
  const teams = await client.featuredTeam.findMany({ where, orderBy, skip, take });
  return serialize(teams);
}

/**
 * The single active, in-window Featured Team — same active + schedule-
 * window pattern as campaignRepository.findActiveHomepageCampaign. Only
 * one is ever shown on the homepage at a time.
 */
export async function findActive({ now = new Date(), client = prisma } = {}) {
  const team = await client.featuredTeam.findFirst({
    where: {
      active: true,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
      ],
    },
    orderBy: [{ displayOrder: 'desc' }, { createdAt: 'desc' }],
  });
  return serialize(team);
}

export async function create(data, { client = prisma } = {}) {
  const team = await client.featuredTeam.create({ data: normalizeDateFields(data, DATE_FIELDS) });
  return serialize(team);
}

export async function updateById(id, data, { client = prisma } = {}) {
  const team = await client.featuredTeam.update({ where: { id }, data: normalizeDateFields(data, DATE_FIELDS) });
  return serialize(team);
}

export async function deleteById(id, { client = prisma } = {}) {
  await client.featuredTeam.update({ where: { id }, data: { active: false } });
}

export default { findById, find, findActive, create, updateById, deleteById };
