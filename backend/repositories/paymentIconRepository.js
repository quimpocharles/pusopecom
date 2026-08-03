import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';

export async function find({ where, orderBy, skip, take, client = prisma } = {}) {
  const icons = await client.paymentIcon.findMany({ where, orderBy, skip, take });
  return serialize(icons);
}

export async function findActive({ client = prisma } = {}) {
  const icons = await client.paymentIcon.findMany({ where: { active: true }, orderBy: { displayOrder: 'asc' } });
  return serialize(icons);
}

export async function create(data, { client = prisma } = {}) {
  const icon = await client.paymentIcon.create({ data });
  return serialize(icon);
}

export async function updateById(id, data, { client = prisma } = {}) {
  const icon = await client.paymentIcon.update({ where: { id }, data });
  return serialize(icon);
}

export async function deleteById(id, { client = prisma } = {}) {
  await client.paymentIcon.update({ where: { id }, data: { active: false } });
}

export default { find, findActive, create, updateById, deleteById };
