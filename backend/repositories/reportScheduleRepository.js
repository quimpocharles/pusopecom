import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';

const FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly'];

/**
 * Self-healing, same pattern as homepageSectionRepository.list() — a
 * frequency with no row yet just means nobody has toggled it, and defaults
 * to active rather than requiring a seed migration.
 */
export async function list({ client = prisma } = {}) {
  const existing = await client.reportSchedule.findMany();
  const existingFrequencies = new Set(existing.map((s) => s.frequency));
  const missing = FREQUENCIES.filter((f) => !existingFrequencies.has(f));

  if (missing.length > 0) {
    await client.reportSchedule.createMany({
      data: missing.map((frequency) => ({ frequency })),
      skipDuplicates: true,
    });
  }

  const rows = missing.length > 0 ? await client.reportSchedule.findMany() : existing;
  return serialize(rows).sort((a, b) => FREQUENCIES.indexOf(a.frequency) - FREQUENCIES.indexOf(b.frequency));
}

/** What each cron job checks before running — defaults to active (true) when no row exists yet. */
export async function isActive(frequency, { client = prisma } = {}) {
  const row = await client.reportSchedule.findUnique({ where: { frequency } });
  return row ? row.active : true;
}

export async function setActive(frequency, active, { client = prisma } = {}) {
  const row = await client.reportSchedule.upsert({
    where: { frequency },
    update: { active },
    create: { frequency, active },
  });
  return serialize(row);
}

export default { list, isActive, setActive };
