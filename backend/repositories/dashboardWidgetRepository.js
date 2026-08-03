import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';

/** Default pinned state/order — every widget starts pinned, in this order. */
const DEFAULT_ORDER = [
  'todaysRevenue',
  'todaysOrders',
  'lowStock',
  'pendingShipments',
  'failedPayments',
  'mostViewedProducts',
  'mostTriedOnProducts',
];

/** Self-healing, same pattern as homepageSectionRepository.list(). */
export async function list({ client = prisma } = {}) {
  const existing = await client.dashboardWidget.findMany();
  const existingKeys = new Set(existing.map((w) => w.key));
  const missing = DEFAULT_ORDER.filter((key) => !existingKeys.has(key));

  if (missing.length > 0) {
    await client.dashboardWidget.createMany({
      data: missing.map((key) => ({ key, displayOrder: DEFAULT_ORDER.indexOf(key) })),
      skipDuplicates: true,
    });
  }

  const rows = missing.length > 0 ? await client.dashboardWidget.findMany() : existing;
  return serialize(rows).sort((a, b) => a.displayOrder - b.displayOrder);
}

export async function setActive(key, active, { client = prisma } = {}) {
  const row = await client.dashboardWidget.upsert({
    where: { key },
    update: { active },
    create: { key, active, displayOrder: DEFAULT_ORDER.indexOf(key) },
  });
  return serialize(row);
}

/** Bulk-reorder, mirroring homepageSectionRepository.upsertMany(). */
export async function upsertMany(widgets, { client = prisma } = {}) {
  const rows = await Promise.all(
    widgets.map(({ key, displayOrder, active }) =>
      client.dashboardWidget.upsert({
        where: { key },
        update: { displayOrder, ...(active !== undefined ? { active } : {}) },
        create: { key, displayOrder, active: active ?? true },
      })
    )
  );
  return serialize(rows).sort((a, b) => a.displayOrder - b.displayOrder);
}

export default { list, setActive, upsertMany };
