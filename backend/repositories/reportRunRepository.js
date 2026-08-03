import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';

export async function create(
  { type = 'daily_business_report', status, reportDate, data, recipients = [], errorMessage },
  { client = prisma } = {}
) {
  const run = await client.reportRun.create({
    data: { type, status, reportDate, data, recipients, errorMessage },
  });
  return serialize(run);
}

export async function find({ where, orderBy = { createdAt: 'desc' }, skip, take, client = prisma } = {}) {
  const runs = await client.reportRun.findMany({ where, orderBy, skip, take });
  return serialize(runs);
}

export async function count({ where, client = prisma } = {}) {
  return client.reportRun.count({ where });
}

export async function findById(id, { client = prisma } = {}) {
  const run = await client.reportRun.findUnique({ where: { id } });
  return serialize(run);
}

export async function deleteById(id, { client = prisma } = {}) {
  await client.reportRun.delete({ where: { id } });
}

export default {
  create,
  find,
  count,
  findById,
  deleteById,
};
