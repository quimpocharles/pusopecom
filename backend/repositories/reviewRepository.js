import prisma from '../lib/prisma.js';
import { serialize, withRelationFallback } from './serialize.js';

const RELATION_MAP = { product: 'productId' };
const withProductFallback = (review) => (review ? withRelationFallback(review, RELATION_MAP) : review);

export async function find({ where, orderBy, skip, take, include, client = prisma } = {}) {
  const reviews = await client.review.findMany({ where, orderBy, skip, take, include });
  return serialize(reviews.map(withProductFallback));
}

export async function count({ where, client = prisma } = {}) {
  return client.review.count({ where });
}

/**
 * The one review per (product, email) constraint is enforced by the
 * database now (@@unique([productId, email]) in schema.prisma) as well as
 * here — Prisma throws a known P2002 error on violation, which routes/
 * reviews.js will need to catch and translate into the same user-facing
 * message the old duplicate-key handling produced (step 3+).
 */
export async function create(data, { client = prisma } = {}) {
  const review = await client.review.create({ data });
  return withProductFallback(serialize(review));
}

/**
 * Replaces the $group aggregation pipeline in routes/reviews.js's
 * recalcStats() — Prisma's own aggregate() covers this in one call, no
 * pipeline needed. Returns { avgRating, reviewCount }, avgRating rounded
 * to 1 decimal exactly as the original route did (Math.round(x*10)/10).
 */
export async function getStats(productId, { client = prisma } = {}) {
  const result = await client.review.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: true,
  });
  const reviewCount = result._count;
  const avgRating = reviewCount > 0 ? Math.round(result._avg.rating * 10) / 10 : 0;
  return { avgRating, reviewCount };
}

/**
 * Replaces the $group-by-rating aggregation pipeline used to build the
 * 1-5 star rating distribution. Returns a plain { 5: n, 4: n, ... 1: n }
 * object with every rating present (0 if no reviews at that rating) —
 * the same shape routes/reviews.js already builds from the raw pipeline
 * output, moved here so the route doesn't need to know it used to be a
 * Mongo aggregation at all.
 */
export async function getRatingDistribution(productId, { client = prisma } = {}) {
  const groups = await client.review.groupBy({
    by: ['rating'],
    where: { productId },
    _count: true,
    orderBy: { rating: 'desc' },
  });
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const g of groups) distribution[g.rating] = g._count;
  return distribution;
}

export default { find, count, create, getStats, getRatingDistribution };
