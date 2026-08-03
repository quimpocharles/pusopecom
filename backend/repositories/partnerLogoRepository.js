import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';

export async function findById(id, { client = prisma } = {}) {
  const logo = await client.partnerLogo.findUnique({ where: { id } });
  return serialize(logo);
}

export async function find({ where, orderBy, skip, take, client = prisma } = {}) {
  const logos = await client.partnerLogo.findMany({ where, orderBy, skip, take });
  return serialize(logos);
}

/** Every active logo, highest priority first — the public homepage read. */
export async function findActive({ client = prisma } = {}) {
  const logos = await client.partnerLogo.findMany({
    where: { active: true },
    orderBy: [{ priority: 'desc' }, { displayOrder: 'asc' }],
  });
  return serialize(logos);
}

export async function create(data, { client = prisma } = {}) {
  const logo = await client.partnerLogo.create({ data });
  return serialize(logo);
}

export async function updateById(id, data, { client = prisma } = {}) {
  const logo = await client.partnerLogo.update({ where: { id }, data });
  return serialize(logo);
}

export async function deleteById(id, { client = prisma } = {}) {
  await client.partnerLogo.update({ where: { id }, data: { active: false } });
}

export default { findById, find, findActive, create, updateById, deleteById };
