import prisma from '../lib/prisma.js';
import { serialize, withRelationFallback } from './serialize.js';

const RELATION_MAP = { product: 'productId' };
const withProductFallback = (log) => (log ? withRelationFallback(log, RELATION_MAP) : log);

export async function create(data, { client = prisma } = {}) {
  const log = await client.tryOnLog.create({ data });
  return withProductFallback(serialize(log));
}

export async function find({ where, orderBy, skip, take, include, client = prisma } = {}) {
  const logs = await client.tryOnLog.findMany({ where, orderBy, skip, take, include });
  return serialize(logs.map(withProductFallback));
}

export default { create, find };
