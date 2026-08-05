import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';
import { normalizeDateFields } from '../lib/dateInput.js';

const DATE_FIELDS = ['startDate', 'endDate'];

export async function findById(id, { client = prisma } = {}) {
  const campaign = await client.fitCheckCampaign.findUnique({ where: { id } });
  return serialize(campaign);
}

export async function find({ where, orderBy, skip, take, client = prisma } = {}) {
  const campaigns = await client.fitCheckCampaign.findMany({ where, orderBy, skip, take });
  return serialize(campaigns);
}

export async function count({ where, client = prisma } = {}) {
  return client.fitCheckCampaign.count({ where });
}

export async function create(data, { client = prisma } = {}) {
  const campaign = await client.fitCheckCampaign.create({ data: normalizeDateFields(data, DATE_FIELDS) });
  return serialize(campaign);
}

export async function updateById(id, data, { client = prisma } = {}) {
  const campaign = await client.fitCheckCampaign.update({ where: { id }, data: normalizeDateFields(data, DATE_FIELDS) });
  return serialize(campaign);
}

/** Soft delete — same convention as campaignRepository.deleteById. */
export async function deleteById(id, { client = prisma } = {}) {
  await client.fitCheckCampaign.update({ where: { id }, data: { active: false } });
}

/**
 * The highest-priority active, in-window, unlimited-Fit-Check campaign
 * covering a given product — matched either by direct productIds
 * membership or by category. Powers both the quota bypass check
 * (lib/fitCheckQuota.js) and the "Unlimited Fit Checks — Sponsored by X"
 * surfacing on product pages: the same query is correct for both, since a
 * campaign with unlimitedFitChecks toggled off shouldn't bypass the quota
 * *or* claim to. Same active + schedule-window pattern as
 * campaignRepository.findActiveHomepageCampaign; ties broken by priority
 * desc, then newest.
 */
export async function findActiveForProduct({ productId, category, now = new Date(), client = prisma } = {}) {
  const campaign = await client.fitCheckCampaign.findFirst({
    where: {
      active: true,
      unlimitedFitChecks: true,
      OR: [{ productIds: { has: productId } }, ...(category ? [{ category }] : [])],
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
      ],
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });
  return serialize(campaign);
}

/** Fire-and-forget counter bump — see the schema comment on FitCheckCampaign.views. */
export async function incrementViews(id, { client = prisma } = {}) {
  await client.fitCheckCampaign.update({ where: { id }, data: { views: { increment: 1 } } });
}

/**
 * Phase 4's Campaign Analytics — generations/views/unique fans/avg
 * generation time/top products, plus purchases and revenue. Purchases
 * aren't a stored flag on TryOnLog (nothing writes one, and a denormalized
 * flag would drift stale against refunds/cancellations) — instead this
 * computes, live, whether a fan who generated a Fit Check under this
 * campaign went on to buy that same product in a paid order. A real
 * correlation query, not an invented number.
 */
export async function analytics(campaignId, { client = prisma } = {}) {
  const [campaign, generations, successCount, avgDuration, distinctUsers, distinctSessions, topProductGroups] =
    await Promise.all([
      client.fitCheckCampaign.findUnique({ where: { id: campaignId }, select: { views: true } }),
      client.tryOnLog.count({ where: { fitCheckCampaignId: campaignId } }),
      client.tryOnLog.count({ where: { fitCheckCampaignId: campaignId, success: true } }),
      client.tryOnLog.aggregate({
        where: { fitCheckCampaignId: campaignId, durationMs: { not: null } },
        _avg: { durationMs: true },
      }),
      client.tryOnLog.findMany({
        where: { fitCheckCampaignId: campaignId, userId: { not: null } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      client.tryOnLog.findMany({
        where: { fitCheckCampaignId: campaignId, userId: null, sessionId: { not: null } },
        select: { sessionId: true },
        distinct: ['sessionId'],
      }),
      client.tryOnLog.groupBy({
        by: ['productId'],
        where: { fitCheckCampaignId: campaignId, productId: { not: null } },
        _count: true,
        orderBy: { _count: { productId: 'desc' } },
        take: 5,
      }),
    ]);

  const products = await client.product.findMany({
    where: { id: { in: topProductGroups.map((g) => g.productId) } },
    select: { id: true, name: true, slug: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));
  const topProducts = topProductGroups
    .map((g) => {
      const product = productById.get(g.productId);
      // With a single `by` field and `_count: true`, this Prisma version
      // returns `_count` as a bare number, not `{ productId: n }` — same
      // fix as tryOnLogRepository.mostTried/trending.
      return product ? { ...product, count: g._count } : null;
    })
    .filter(Boolean);

  // Correlation: (userId, productId) pairs that actually generated a Fit
  // Check under this campaign, matched against that same user's paid
  // orders for that same product.
  const generatedPairs = await client.tryOnLog.findMany({
    where: { fitCheckCampaignId: campaignId, userId: { not: null }, productId: { not: null } },
    select: { userId: true, productId: true },
    distinct: ['userId', 'productId'],
  });

  let purchases = 0;
  let revenue = 0;
  if (generatedPairs.length > 0) {
    const pairKey = (userId, productId) => `${userId}:${productId}`;
    const generatedSet = new Set(generatedPairs.map((p) => pairKey(p.userId, p.productId)));
    const orderItems = await client.orderItem.findMany({
      where: {
        productId: { in: [...new Set(generatedPairs.map((p) => p.productId))] },
        order: { userId: { in: [...new Set(generatedPairs.map((p) => p.userId))] }, paymentStatus: 'paid' },
      },
      select: { productId: true, price: true, quantity: true, order: { select: { userId: true } } },
    });
    for (const item of orderItems) {
      if (generatedSet.has(pairKey(item.order.userId, item.productId))) {
        purchases += 1;
        revenue += item.price * item.quantity;
      }
    }
  }

  return {
    views: campaign?.views || 0,
    generations,
    successRate: generations > 0 ? successCount / generations : 0,
    avgGenerationMs: avgDuration._avg.durationMs || 0,
    uniqueFans: distinctUsers.length + distinctSessions.length,
    purchases,
    revenue,
    topProducts,
  };
}

export default { findById, find, count, create, updateById, deleteById, findActiveForProduct, incrementViews, analytics };
