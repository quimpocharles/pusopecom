import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';
import { normalizeDateFields } from '../lib/dateInput.js';

const DATE_FIELDS = ['startDate', 'endDate'];

export async function findById(id, { client = prisma } = {}) {
  const message = await client.promoMessage.findUnique({ where: { id } });
  return serialize(message);
}

export async function find({ where, orderBy, skip, take, client = prisma } = {}) {
  const messages = await client.promoMessage.findMany({ where, orderBy, skip, take });
  return serialize(messages);
}

/**
 * Public read for one placement (announcement bar or marquee) — active,
 * inside its schedule window (unset startDate/endDate means no bound on
 * that side, same convention as Campaign), pinned messages first, then by
 * displayOrder. Evaluated fresh on every request, so a schedule expiring
 * takes effect immediately with no redeploy and no cache to invalidate.
 */
export async function findActiveByPlacement(placement, { now = new Date(), client = prisma } = {}) {
  const messages = await client.promoMessage.findMany({
    where: {
      placement,
      active: true,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
      ],
    },
    orderBy: [{ pinned: 'desc' }, { displayOrder: 'asc' }],
  });
  return serialize(messages);
}

export async function create(data, { client = prisma } = {}) {
  const message = await client.promoMessage.create({ data: normalizeDateFields(data, DATE_FIELDS) });
  return serialize(message);
}

export async function updateById(id, data, { client = prisma } = {}) {
  const message = await client.promoMessage.update({ where: { id }, data: normalizeDateFields(data, DATE_FIELDS) });
  return serialize(message);
}

export async function deleteById(id, { client = prisma } = {}) {
  await client.promoMessage.update({ where: { id }, data: { active: false } });
}

export default { findById, find, findActiveByPlacement, create, updateById, deleteById };
