import prisma from '../lib/prisma.js';
import cloudinary from '../config/cloudinary.js';
import logger from '../lib/logger.js';
import { serialize, withRelationFallback } from './serialize.js';

const RELATION_MAP = { product: 'productId' };
const withProductFallback = (log) => (log ? withRelationFallback(log, RELATION_MAP) : log);

// Every customer-facing read excludes soft-deleted rows unless a caller
// explicitly opts in (admin-gated capability, no customer route ever
// passes this) — see docs/... Fit Check plan: soft delete never removes
// the row, deleted_at is just excluded from the fan's own view.
const notDeleted = (where = {}, includeDeleted = false) =>
  includeDeleted ? where : { ...where, deletedAt: null };

export async function create(data, { client = prisma } = {}) {
  const log = await client.tryOnLog.create({ data });
  return withProductFallback(serialize(log));
}

export async function find({ where, orderBy, skip, take, include, client = prisma } = {}) {
  const logs = await client.tryOnLog.findMany({ where, orderBy, skip, take, include });
  return serialize(logs.map(withProductFallback));
}

/**
 * Customer Portal try-on history. Only logs created after the userId column
 * was added (see the migration adding it) will ever match — there is
 * nothing to backfill historical rows from, so a brand-new account's
 * history genuinely starts empty rather than at some fabricated count.
 *
 * `include` defaults to the live product (price/active/stock/slug) — the
 * Fit Check gallery shows the product's *current* price, not a
 * generation-time snapshot.
 */
// Matches productRepository's own DEFAULT_INCLUDE shape — the Fit Check
// gallery's Buy Now action passes the product straight into the existing
// QuickAddModal (cartStore.openQuickAdd), which reads product.sizes and
// product.colors[].sizes for its picker; a bare product row without those
// would silently break that flow.
const DEFAULT_INCLUDE = { product: { include: { sizes: true, colors: { include: { sizes: true } } } } };

export async function findByUser({
  userId,
  success,
  favorited,
  productIdIn,
  includeDeleted = false,
  skip,
  take,
  include = DEFAULT_INCLUDE,
  client = prisma,
} = {}) {
  const logs = await client.tryOnLog.findMany({
    where: notDeleted(
      {
        userId,
        ...(success !== undefined && { success }),
        ...(favorited !== undefined && { favorited }),
        ...(productIdIn !== undefined && { productId: { in: productIdIn } }),
      },
      includeDeleted
    ),
    orderBy: { createdAt: 'desc' },
    skip,
    take,
    include,
  });
  return serialize(logs.map(withProductFallback));
}

export async function countByUser(userId, { success, favorited, productIdIn, includeDeleted = false, client = prisma } = {}) {
  return client.tryOnLog.count({
    where: notDeleted(
      {
        userId,
        ...(success !== undefined && { success }),
        ...(favorited !== undefined && { favorited }),
        ...(productIdIn !== undefined && { productId: { in: productIdIn } }),
      },
      includeDeleted
    ),
  });
}

/** Ownership-scoped in the WHERE clause — same pattern as
 * notificationRepository.markRead. Returns whether a row actually updated. */
export async function softDelete(id, userId, { client = prisma } = {}) {
  const result = await client.tryOnLog.updateMany({
    where: { id, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  return result.count > 0;
}

export async function setFavorite(id, userId, favorited, { client = prisma } = {}) {
  const result = await client.tryOnLog.updateMany({
    where: { id, userId, deletedAt: null },
    data: { favorited },
  });
  return result.count > 0;
}

/**
 * Replaces MongoDB's TTL index (`expireAfterSeconds: 90 days`) — Postgres
 * has no equivalent, so this is called from a daily node-cron job (see
 * server.js), the same pattern already used there for the daily sales
 * report and for userActivityRepository.deleteOlderThan.
 *
 * Extended for the Fit Check gallery's durably-hosted generated images —
 * this is the "automated cleanup policy" that eventually removes them from
 * storage (never on delete/soft-delete itself, only once a row ages out).
 * Cloudinary destroys are fire-and-forget per row, same discipline
 * wavespeedService.js already uses for its own temp-upload cleanup — a
 * failed destroy shouldn't block the row delete that's the actual TTL
 * contract.
 */
export async function deleteOlderThan(days, { client = prisma } = {}) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const expiring = await client.tryOnLog.findMany({
    where: { createdAt: { lt: cutoff }, generatedImagePublicId: { not: null } },
    select: { generatedImagePublicId: true },
  });
  for (const row of expiring) {
    cloudinary.uploader.destroy(row.generatedImagePublicId).catch((err) =>
      logger.error({ err, publicId: row.generatedImagePublicId }, 'Failed to destroy expired Fit Check image')
    );
  }

  const result = await client.tryOnLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return result.count;
}

/**
 * Top N most-tried-on products, all-time — backs the "Most Tried-On
 * Products" dashboard widget. A real SQL groupBy rather than fetch-all-
 * then-reduce-in-JS (unlike routes/reports.js's own reports): this can run
 * on every dashboard load, not just an admin opening a report page, so it
 * doesn't get the same "small enough dataset, simplicity wins" pass — same
 * reasoning as orderRepository.getTopSellingProducts, which this mirrors.
 */
export async function mostTried(limit = 5, { client = prisma } = {}) {
  const groups = await client.tryOnLog.groupBy({
    by: ['productId'],
    where: { productId: { not: null } },
    _count: true,
    orderBy: { _count: { productId: 'desc' } },
    take: limit,
  });

  return Promise.all(
    groups.map(async (g) => {
      const sample = await client.tryOnLog.findFirst({
        where: { productId: g.productId },
        select: { productName: true, productImage: true },
      });
      return { productName: sample?.productName, productImage: sample?.productImage, count: g._count.productId };
    })
  );
}

export default { create, find, findByUser, countByUser, softDelete, setFavorite, deleteOlderThan, mostTried };
