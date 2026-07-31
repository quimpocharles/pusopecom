import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';

// orderId is deliberately a plain string field here, not a foreign key —
// see the ShippingEvent model comment in schema.prisma. Preserved exactly
// as the original Mongoose schema had it (an analytics log, not a strict
// relation), not tightened as part of this migration.

export async function create(data, { client = prisma } = {}) {
  return serialize(await client.shippingEvent.create({ data }));
}

export async function find({ where, orderBy, skip, take, client = prisma } = {}) {
  return serialize(await client.shippingEvent.findMany({ where, orderBy, skip, take }));
}

export default { create, find };
