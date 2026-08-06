import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';

const DEFAULT_COURIER_NAME = 'manual';

/**
 * Self-healing singleton, same idiom as warehouseRepository's
 * getOrCreateDefault — 'manual' is the only courierService.js gateway
 * implemented today, so it's the only account seeded automatically. A real
 * courier gets its own admin-created row once its gateway module exists.
 */
export async function getOrCreateDefault({ client = prisma } = {}) {
  const existing = await client.courierAccount.findUnique({ where: { courierName: DEFAULT_COURIER_NAME } });
  if (existing) return serialize(existing);
  const created = await client.courierAccount.create({
    data: { courierName: DEFAULT_COURIER_NAME, displayName: 'Manual / Self-Arranged' },
  });
  return serialize(created);
}

export async function find({ where, client = prisma } = {}) {
  const rows = await client.courierAccount.findMany({ where, orderBy: { displayName: 'asc' } });
  return serialize(rows);
}

export async function findById(id, { client = prisma } = {}) {
  const account = await client.courierAccount.findUnique({ where: { id } });
  return serialize(account);
}

export async function create({ courierName, displayName, config, active }, { client = prisma } = {}) {
  const account = await client.courierAccount.create({
    data: { courierName, displayName, config, ...(active !== undefined && { active }) },
  });
  return serialize(account);
}

export async function updateById(id, data, { client = prisma } = {}) {
  const account = await client.courierAccount.update({ where: { id }, data });
  return serialize(account);
}

export default { getOrCreateDefault, find, findById, create, updateById };
