import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';

export async function findById(id, { client = prisma } = {}) {
  const item = await client.fAQItem.findUnique({ where: { id } });
  return serialize(item);
}

export async function find({ where, orderBy, skip, take, client = prisma } = {}) {
  const items = await client.fAQItem.findMany({ where, orderBy, skip, take });
  return serialize(items);
}

export async function findActive({ client = prisma } = {}) {
  const items = await client.fAQItem.findMany({
    where: { active: true },
    orderBy: { displayOrder: 'asc' },
  });
  return serialize(items);
}

export async function create(data, { client = prisma } = {}) {
  const item = await client.fAQItem.create({ data });
  return serialize(item);
}

export async function updateById(id, data, { client = prisma } = {}) {
  const item = await client.fAQItem.update({ where: { id }, data });
  return serialize(item);
}

export async function deleteById(id, { client = prisma } = {}) {
  await client.fAQItem.update({ where: { id }, data: { active: false } });
}

export default { findById, find, findActive, create, updateById, deleteById };
