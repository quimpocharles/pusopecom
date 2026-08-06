import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';

const DEFAULT_WAREHOUSE_CODE = 'MAIN';

/**
 * Self-healing singleton, same idiom as reportScheduleRepository/
 * dashboardWidgetRepository — no seed script needed. Every table under
 * Warehouse (Zone, Bin, ProductLocation) and every Shipment already
 * carries a real warehouseId FK from day one (Enterprise Fulfillment
 * Blueprint §8) even though exactly one row exists in practice today;
 * activating a second warehouse later is a data-entry operation, not a
 * migration.
 */
export async function getOrCreateDefault({ client = prisma } = {}) {
  const existing = await client.warehouse.findUnique({ where: { code: DEFAULT_WAREHOUSE_CODE } });
  if (existing) return serialize(existing);
  const created = await client.warehouse.create({
    data: { code: DEFAULT_WAREHOUSE_CODE, name: 'Main Warehouse' },
  });
  return serialize(created);
}

export async function find({ where, client = prisma } = {}) {
  const rows = await client.warehouse.findMany({ where, orderBy: { name: 'asc' } });
  return serialize(rows);
}

export async function findById(id, { client = prisma } = {}) {
  const warehouse = await client.warehouse.findUnique({
    where: { id },
    include: { zones: { include: { bins: true } } },
  });
  return serialize(warehouse);
}

export default { getOrCreateDefault, find, findById };
