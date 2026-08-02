import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';

export async function findById(id, { client = prisma } = {}) {
  const message = await client.promoMessage.findUnique({ where: { id } });
  return serialize(message);
}

export async function find({ where, orderBy, skip, take, client = prisma } = {}) {
  const messages = await client.promoMessage.findMany({ where, orderBy, skip, take });
  return serialize(messages);
}

export async function findActiveByPlacement(placement, { client = prisma } = {}) {
  const messages = await client.promoMessage.findMany({
    where: { placement, active: true },
    orderBy: { displayOrder: 'asc' },
  });
  return serialize(messages);
}

export async function create(data, { client = prisma } = {}) {
  const message = await client.promoMessage.create({ data });
  return serialize(message);
}

export async function updateById(id, data, { client = prisma } = {}) {
  const message = await client.promoMessage.update({ where: { id }, data });
  return serialize(message);
}

export async function deleteById(id, { client = prisma } = {}) {
  await client.promoMessage.update({ where: { id }, data: { active: false } });
}

export default { findById, find, findActiveByPlacement, create, updateById, deleteById };
