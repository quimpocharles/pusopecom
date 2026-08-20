import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';

export async function findById(id, { client = prisma } = {}) {
  const link = await client.navigationLink.findUnique({ where: { id } });
  return serialize(link);
}

export async function find({ where, orderBy, skip, take, client = prisma } = {}) {
  const links = await client.navigationLink.findMany({ where, orderBy, skip, take });
  return serialize(links);
}

/** Top-level active links, in order, with their active children nested — the public header read. */
export async function findActive({ client = prisma } = {}) {
  const links = await client.navigationLink.findMany({
    where: { active: true, parentId: null },
    orderBy: { displayOrder: 'asc' },
    include: { children: { where: { active: true }, orderBy: { displayOrder: 'asc' } } },
  });
  return serialize(links);
}

export async function create(data, { client = prisma } = {}) {
  const link = await client.navigationLink.create({ data });
  return serialize(link);
}

export async function updateById(id, data, { client = prisma } = {}) {
  const link = await client.navigationLink.update({ where: { id }, data });
  return serialize(link);
}

export async function deleteById(id, { client = prisma } = {}) {
  await client.navigationLink.update({ where: { id }, data: { active: false } });
}

export default { findById, find, findActive, create, updateById, deleteById };
