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

/** General-purpose query — Finance report's provider success-rate breakdown scopes by Payment's own createdAt (attempts made in range), not by walking through Order. */
export async function find({ where, orderBy = { createdAt: 'desc' }, skip, take, client = prisma } = {}) {
  const payments = await client.payment.findMany({ where, orderBy, skip, take });
  return serialize(payments);
}

/**
 * Bulk form of findLatestForOrder — one query for My PUSO's Resume Checkout
 * module (Payment Platform Redesign, Phase 5) instead of N round trips for N
 * pending orders. `distinct` + `orderBy: createdAt desc` gives Postgres's
 * SELECT DISTINCT ON semantics: exactly one row per orderId, the newest one.
 */
export async function findLatestForOrders(orderIds, { client = prisma } = {}) {
  if (!orderIds.length) return [];
  const payments = await client.payment.findMany({
    where: { orderId: { in: orderIds } },
    orderBy: { createdAt: 'desc' },
    distinct: ['orderId'],
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

/**
 * Payment Platform Redesign, Phase 7 — Admin Dashboard's "Webhook Health."
 * Deliberately only what's derivable from Payment's own webhookProcessedAt
 * column: how many real Maya webhooks actually got processed recently, and
 * when the last one landed. IP-allowlist rejections (mayaWebhookIpAllowlist)
 * aren't persisted anywhere — they're a security-boundary event, already
 * visible via logger.warn + the request logs/Sentry, not a business metric
 * this report needs its own storage table for.
 */
export async function getWebhookHealth({ client = prisma } = {}) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [processedLast24h, mostRecent] = await Promise.all([
    client.payment.count({ where: { webhookProcessedAt: { gte: since } } }),
    client.payment.findFirst({ where: { webhookProcessedAt: { not: null } }, orderBy: { webhookProcessedAt: 'desc' } }),
  ]);
  return { processedLast24h, lastWebhookAt: mostRecent?.webhookProcessedAt ?? null };
}

export default { create, findById, findLatestForOrder, findByOrder, find, findLatestForOrders, resolve, getWebhookHealth };
