import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';

export async function find({ where, orderBy, skip, take, client = prisma } = {}) {
  const links = await client.footerLink.findMany({ where, orderBy, skip, take });
  return serialize(links);
}

/** Active links grouped by groupLabel, in displayOrder — the public footer read. */
export async function findActiveGrouped({ client = prisma } = {}) {
  const links = await client.footerLink.findMany({
    where: { active: true },
    orderBy: { displayOrder: 'asc' },
  });
  const groups = new Map();
  for (const link of links) {
    if (!groups.has(link.groupLabel)) groups.set(link.groupLabel, []);
    groups.get(link.groupLabel).push(link);
  }
  return [...groups.entries()].map(([groupLabel, groupLinks]) => ({ groupLabel, links: serialize(groupLinks) }));
}

export async function create(data, { client = prisma } = {}) {
  const link = await client.footerLink.create({ data });
  return serialize(link);
}

export async function updateById(id, data, { client = prisma } = {}) {
  const link = await client.footerLink.update({ where: { id }, data });
  return serialize(link);
}

export async function deleteById(id, { client = prisma } = {}) {
  await client.footerLink.update({ where: { id }, data: { active: false } });
}

export default { find, findActiveGrouped, create, updateById, deleteById };
