import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';

/**
 * `id` is optional — Prisma's `@default(uuid())` fills it in when omitted,
 * unchanged from before. Scheduled Report Email Redesign — an explicit id
 * lets the caller generate the run's id *before* archiving it, so a
 * download link embedded in the email being composed right now can
 * reference this exact run, without needing a separate update-after-create
 * step (or, worse, marking the run "sent" before delivery is confirmed
 * just to obtain an id).
 */
export async function create(
  { id, type = 'daily_business_report', status, reportDate, data, recipients = [], errorMessage },
  { client = prisma } = {}
) {
  const run = await client.reportRun.create({
    data: { ...(id ? { id } : {}), type, status, reportDate, data, recipients, errorMessage },
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
