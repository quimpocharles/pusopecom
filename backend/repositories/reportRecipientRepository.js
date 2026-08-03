import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';

export async function find({ where, orderBy = { createdAt: 'asc' }, client = prisma } = {}) {
  const rows = await client.reportRecipient.findMany({ where, orderBy });
  return serialize(rows);
}

/** What the scheduled report job actually sends to — active recipients only. */
export async function findActiveEmails({ client = prisma } = {}) {
  const rows = await client.reportRecipient.findMany({ where: { active: true }, select: { email: true } });
  return rows.map((r) => r.email);
}

export async function create({ email }, { client = prisma } = {}) {
  const row = await client.reportRecipient.create({ data: { email } });
  return serialize(row);
}

export async function updateById(id, data, { client = prisma } = {}) {
  const row = await client.reportRecipient.update({ where: { id }, data });
  return serialize(row);
}

export async function deleteById(id, { client = prisma } = {}) {
  await client.reportRecipient.delete({ where: { id } });
}

export default {
  find,
  findActiveEmails,
  create,
  updateById,
  deleteById,
};
