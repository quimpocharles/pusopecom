import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';

/**
 * Fixed display order Home.jsx already used implicitly before this model
 * existed — the seed default for any HomepageSectionKey with no row yet.
 */
const DEFAULT_ORDER = [
  'hero',
  'aiTryOn',
  'marquee',
  'featuredProducts',
  'trendingFitChecks',
  'featuredTeam',
  'partners',
  'faq',
];

/**
 * Self-healing rather than migration-seeded: any enum key missing a row
 * (new key added later, or first run against a fresh DB) is created here,
 * at read time, instead of requiring a manual seed step to stay in sync
 * with the HomepageSectionKey enum.
 */
export async function list({ client = prisma } = {}) {
  const existing = await client.homepageSection.findMany();
  const existingKeys = new Set(existing.map((s) => s.key));
  const missing = DEFAULT_ORDER.filter((key) => !existingKeys.has(key));

  if (missing.length > 0) {
    await client.homepageSection.createMany({
      data: missing.map((key) => ({ key, displayOrder: DEFAULT_ORDER.indexOf(key) })),
      skipDuplicates: true,
    });
  }

  const rows = missing.length > 0 ? await client.homepageSection.findMany() : existing;
  return serialize(rows).sort((a, b) => a.displayOrder - b.displayOrder);
}

export async function setActive(key, active, { client = prisma } = {}) {
  const row = await client.homepageSection.upsert({
    where: { key },
    update: { active },
    create: { key, active, displayOrder: DEFAULT_ORDER.indexOf(key) },
  });
  return serialize(row);
}

/** Bulk-reorder: [{ key, displayOrder }, ...] — one upsert per row, not a transaction, since each row is independently valid. */
export async function upsertMany(sections, { client = prisma } = {}) {
  const rows = await Promise.all(
    sections.map(({ key, displayOrder, active }) =>
      client.homepageSection.upsert({
        where: { key },
        update: { displayOrder, ...(active !== undefined ? { active } : {}) },
        create: { key, displayOrder, active: active ?? true },
      })
    )
  );
  return serialize(rows).sort((a, b) => a.displayOrder - b.displayOrder);
}

export default { list, setActive, upsertMany };
