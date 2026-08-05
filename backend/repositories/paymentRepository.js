import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';

export async function create(data, { client = prisma } = {}) {
  const payment = await client.payment.create({ data });
  return serialize(payment);
}

export async function findById(id, { client = prisma } = {}) {
  const payment = await client.payment.findUnique({ where: { id } });
  return serialize(payment);
}

/** The "current" payment for an order — most recent attempt, not a separate pointer field to keep in sync. */
export async function findLatestForOrder(orderId, { client = prisma } = {}) {
  const payment = await client.payment.findFirst({
    where: { orderId },
    orderBy: { createdAt: 'desc' },
  });
  return serialize(payment);
}

export async function findByOrder(orderId, { client = prisma } = {}) {
  const payments = await client.payment.findMany({
    where: { orderId },
    orderBy: { createdAt: 'desc' },
  });
  return serialize(payments);
}

/**
 * Atomically resolves one payment attempt — a conditional `updateMany`
 * (`WHERE id, status: 'pending'`), the same race-safe shape as
 * orderRepository.tryResolvePayment, just scoped one level down to a single
 * attempt instead of the whole order. A second webhook/poll racing the same
 * resolution finds zero matching rows and no-ops; returns whether this call
 * was the one that actually applied.
 */
export async function resolve(id, status, extra = {}, { client = prisma } = {}) {
  const result = await client.payment.updateMany({
    where: { id, status: 'pending' },
    data: { status, ...extra },
  });
  return result.count > 0;
}

export default { create, findById, findLatestForOrder, findByOrder, resolve };
