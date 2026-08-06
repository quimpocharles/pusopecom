import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';

/**
 * The missing inventory audit trail the Fulfillment Audit flagged — every
 * call site must supply a reason, matching Enterprise Fulfillment
 * Blueprint §8. Append-only, same discipline as OrderEvent/ShipmentEvent.
 */
export async function create(
  { productSizeId, productColorSizeId, type, quantityDelta, reason, relatedOrderId, staffUserId },
  { client = prisma } = {}
) {
  const adjustment = await client.stockAdjustment.create({
    data: { productSizeId, productColorSizeId, type, quantityDelta, reason, relatedOrderId, staffUserId },
  });
  return serialize(adjustment);
}

export async function findByProductSize(productSizeId, { client = prisma } = {}) {
  const rows = await client.stockAdjustment.findMany({ where: { productSizeId }, orderBy: { createdAt: 'desc' } });
  return serialize(rows);
}

export async function findByProductColorSize(productColorSizeId, { client = prisma } = {}) {
  const rows = await client.stockAdjustment.findMany({ where: { productColorSizeId }, orderBy: { createdAt: 'desc' } });
  return serialize(rows);
}

export async function findByOrder(relatedOrderId, { client = prisma } = {}) {
  const rows = await client.stockAdjustment.findMany({ where: { relatedOrderId }, orderBy: { createdAt: 'desc' } });
  return serialize(rows);
}

export default { create, findByProductSize, findByProductColorSize, findByOrder };
