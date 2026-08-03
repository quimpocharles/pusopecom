import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';

export async function find({ where, orderBy, skip, take, client = prisma } = {}) {
  const links = await client.socialLink.findMany({ where, orderBy, skip, take });
  return serialize(links);
}

export async function findActive({ client = prisma } = {}) {
  const links = await client.socialLink.findMany({ where: { active: true }, orderBy: { displayOrder: 'asc' } });
  return serialize(links);
}

export async function create(data, { client = prisma } = {}) {
  const link = await client.socialLink.create({ data });
  return serialize(link);
}

export async function updateById(id, data, { client = prisma } = {}) {
  const link = await client.socialLink.update({ where: { id }, data });
  return serialize(link);
}

export async function deleteById(id, { client = prisma } = {}) {
  await client.socialLink.update({ where: { id }, data: { active: false } });
}

export default { find, findActive, create, updateById, deleteById };
