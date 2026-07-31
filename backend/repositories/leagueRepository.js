import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';

export async function findById(id, { client = prisma } = {}) {
  return serialize(await client.league.findUnique({ where: { id } }));
}

export async function find({ where, orderBy, skip, take, client = prisma } = {}) {
  return serialize(await client.league.findMany({ where, orderBy, skip, take }));
}

export async function create(data, { client = prisma } = {}) {
  return serialize(await client.league.create({ data }));
}

export async function updateById(id, data, { client = prisma } = {}) {
  return serialize(await client.league.update({ where: { id }, data }));
}

export async function deleteById(id, { client = prisma } = {}) {
  await client.league.delete({ where: { id } });
}

export default { findById, find, create, updateById, deleteById };
