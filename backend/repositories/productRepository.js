import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';
import { generateSlug } from '../lib/slug.js';

// Re-exported for backward compatibility — organizationRepository and
// teamRepository now import generateSlug directly from lib/slug.js.
export { generateSlug };

export class InsufficientStockError extends Error {
  constructor({ productId, size, color }) {
    super(
      `Insufficient stock for product ${productId}, size ${size}${color ? `, color ${color}` : ''}`
    );
    this.name = 'InsufficientStockError';
    this.productId = productId;
    this.size = size;
    this.color = color;
  }
}

export class StockAdjustmentError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StockAdjustmentError';
  }
}


/**
 * Matches productSchema.pre('save')'s totalStock calculation exactly —
 * sum of plain sizes[] plus every color's nested sizes[].
 */
export function calculateTotalStock(sizes = [], colors = []) {
  const sizeTotal = sizes.reduce((sum, s) => sum + (s.stock ?? 0), 0);
  const colorTotal = colors.reduce(
    (sum, c) => sum + (c.sizes ?? []).reduce((sSum, s) => sSum + (s.stock ?? 0), 0),
    0
  );
  return sizeTotal + colorTotal;
}

/** Replaces the Mongoose `effectivePrice` virtual — Prisma has no virtuals. */
export function effectivePrice(product) {
  return product.salePrice || product.price;
}

/** Replaces the Mongoose `discountPercentage` virtual. */
export function discountPercentage(product) {
  if (product.salePrice && product.salePrice < product.price) {
    return Math.round(((product.price - product.salePrice) / product.price) * 100);
  }
  return 0;
}

/** Adds both virtuals to a serialized product, matching `toJSON({ virtuals: true })`. */
export function withVirtuals(product) {
  if (!product) return product;
  return {
    ...product,
    effectivePrice: effectivePrice(product),
    discountPercentage: discountPercentage(product),
  };
}

const DEFAULT_INCLUDE = { sizes: true, colors: { include: { sizes: true } } };

export async function findById(id, { include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const product = await client.product.findUnique({ where: { id }, include });
  return withVirtuals(serialize(product));
}

export async function findBySlug(slug, { include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const product = await client.product.findUnique({ where: { slug }, include });
  return withVirtuals(serialize(product));
}

export async function find({ where, orderBy, skip, take, include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const products = await client.product.findMany({ where, orderBy, skip, take, include });
  return serialize(products).map(withVirtuals);
}

export async function count({ where, client = prisma } = {}) {
  return client.product.count({ where });
}

const parseList = (value) =>
  value ? value.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean) : [];

// Every sortable field the public listing exposes. The original Mongoose
// route passed `sort` straight into `.sort()` with no whitelist — an
// arbitrary-field-name gap that was harmless there but becomes a real SQL
// injection surface once `search()` below has to turn the same value into
// a raw ORDER BY column. Whitelisting closes that gap for both paths
// without changing behavior for any legitimate sort value.
const SORTABLE_FIELDS = new Set([
  'name', 'createdAt', 'price', 'salePrice', 'totalSold', 'totalViews', 'avgRating',
]);

/** Parses a Mongoose-style sort token ('-createdAt', 'name') into { field, direction }. */
export function parseSort(sort = '-createdAt') {
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  if (!SORTABLE_FIELDS.has(field)) return { field: 'createdAt', direction: 'desc' };
  return { field, direction: desc ? 'desc' : 'asc' };
}

/**
 * Builds the `where` clause for the public product listing's filters —
 * sport/gender each fall back to matching a product tagged 'general' /
 * 'unisex' respectively (an item for any sport, or for any gender), and
 * price range matches against salePrice when set, else price — exactly
 * the semantics of the original Mongoose filter object. Kept separate
 * from `search()`'s raw-SQL WHERE fragments below (same filters, but
 * Prisma's query builder can't reach the Unsupported tsvector column
 * full-text search needs) rather than unified, since unifying them would
 * cost more in generality than the duplication costs in upkeep — the
 * filter set here is small and stable.
 */
export function buildListingWhere({
  active, sport, team, league, category, gender, sale, minPrice, maxPrice, featured,
} = {}) {
  const and = [];

  if (sport) {
    and.push({ OR: [{ sport: { in: parseList(sport) } }, { sport: 'general' }] });
  }
  if (gender) {
    and.push({ OR: [{ gender: { in: parseList(gender) } }, { gender: 'unisex' }] });
  }
  if (minPrice || maxPrice) {
    const range = {
      ...(minPrice && { gte: Number(minPrice) }),
      ...(maxPrice && { lte: Number(maxPrice) }),
    };
    and.push({ OR: [{ salePrice: range }, { AND: [{ salePrice: null }, { price: range }] }] });
  }

  const where = {};
  if (active !== undefined) where.active = active;
  if (and.length) where.AND = and;
  if (team) where.team = { equals: team, mode: 'insensitive' };
  if (league) where.league = { equals: league, mode: 'insensitive' };
  if (category) where.category = { in: parseList(category) };
  if (sale === 'true') where.salePrice = { gt: 0 };
  if (featured) where.featured = featured === 'true'; // matches the original's truthy check — 'false' is a truthy string, so it explicitly filters to non-featured

  return where;
}

/**
 * Full-text search — the Postgres replacement for Mongo's `$text` index.
 * Applies the exact same filters as buildListingWhere, expressed as raw
 * SQL fragments because the `searchVector` column is `Unsupported` to
 * Prisma's query builder. Matches the original route's behavior of
 * sorting search results by the normal sort criteria (not by text
 * relevance) — the original never asked Mongo for a $text relevance
 * score sort either, so this isn't a regression, just carried forward.
 *
 * Two-step: rank/filter/paginate ids via raw SQL, then re-fetch full rows
 * (with sizes/colors) through the normal Prisma include mechanism, then
 * restore the SQL-decided order — avoids hand-writing the sizes/colors
 * joins in raw SQL for what's otherwise an ordinary paginated read.
 */
export async function search({
  query, active, sport, team, league, category, gender, sale, minPrice, maxPrice, featured,
  sortField = 'createdAt', sortDirection = 'desc', skip = 0, take = 12,
} = {}) {
  if (!SORTABLE_FIELDS.has(sortField)) sortField = 'createdAt';
  const direction = sortDirection === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;

  const conditions = [Prisma.sql`"searchVector" @@ plainto_tsquery('english', ${query})`];
  if (active !== undefined) conditions.push(Prisma.sql`"active" = ${active}`);
  if (sport) {
    const values = parseList(sport);
    const clauses = values.map((v) => Prisma.sql`"sport" = ${v}::"Sport"`);
    conditions.push(Prisma.sql`(${Prisma.join(clauses, ' OR ')} OR "sport" = 'general')`);
  }
  if (gender) {
    const values = parseList(gender);
    const clauses = values.map((v) => Prisma.sql`"gender" = ${v}::"Gender"`);
    conditions.push(Prisma.sql`(${Prisma.join(clauses, ' OR ')} OR "gender" = 'unisex')`);
  }
  if (team) conditions.push(Prisma.sql`"team" ILIKE ${team}`);
  if (league) conditions.push(Prisma.sql`"league" ILIKE ${league}`);
  if (category) {
    const values = parseList(category);
    const clauses = values.map((v) => Prisma.sql`"category" = ${v}::"ProductCategory"`);
    conditions.push(Prisma.sql`(${Prisma.join(clauses, ' OR ')})`);
  }
  if (sale === 'true') conditions.push(Prisma.sql`"salePrice" > 0`);
  if (featured) conditions.push(Prisma.sql`"featured" = ${featured === 'true'}`);
  if (minPrice) conditions.push(Prisma.sql`COALESCE("salePrice", "price") >= ${Number(minPrice)}`);
  if (maxPrice) conditions.push(Prisma.sql`COALESCE("salePrice", "price") <= ${Number(maxPrice)}`);

  const whereSql = Prisma.join(conditions, ' AND ');
  const orderColumn = Prisma.raw(`"${sortField}"`);

  const [rows, totalRows] = await Promise.all([
    prisma.$queryRaw`SELECT "id" FROM "products" WHERE ${whereSql} ORDER BY ${orderColumn} ${direction} LIMIT ${take} OFFSET ${skip}`,
    prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "products" WHERE ${whereSql}`,
  ]);

  const orderedIds = rows.map((r) => r.id);
  if (orderedIds.length === 0) return { products: [], total: totalRows[0].count };

  const products = await hydrateInOrder(orderedIds);
  return { products, total: totalRows[0].count };
}

async function hydrateInOrder(ids) {
  const rows = await prisma.product.findMany({ where: { id: { in: ids } }, include: DEFAULT_INCLUDE });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => withVirtuals(serialize(byId.get(id))));
}

/** Replaces the three $group aggregation pipelines behind admin product stats. */
export async function getAdminStats({ client = prisma } = {}) {
  const [total, active, featured, byCategory, bySport, byGender] = await Promise.all([
    client.product.count(),
    client.product.count({ where: { active: true } }),
    client.product.count({ where: { featured: true } }),
    client.product.groupBy({ by: ['category'], _count: true }),
    client.product.groupBy({ by: ['sport'], _count: true }),
    client.product.groupBy({ by: ['gender'], _count: true }),
  ]);

  const toIdCount = (groups, key) => groups.map((g) => ({ _id: g[key], count: g._count }));

  return {
    total,
    active,
    featured,
    byCategory: toIdCount(byCategory, 'category'),
    bySport: toIdCount(bySport, 'sport'),
    byGender: toIdCount(byGender, 'gender'),
  };
}

/**
 * Creates a Product plus its nested sizes/colors in one write. Slug and
 * totalStock are computed the same way the Mongoose pre-validate/pre-save
 * hooks computed them — explicitly, here, rather than via Prisma
 * middleware (see repositories/userRepository.js for why).
 */
export async function create({ sizes = [], colors = [], ...data }, { client = prisma } = {}) {
  const slug = data.slug || generateSlug(data.name);
  const totalStock = calculateTotalStock(sizes, colors);

  const product = await client.product.create({
    data: {
      ...data,
      slug,
      totalStock,
      sizes: { create: sizes.map(({ size, stock }) => ({ size, stock })) },
      colors: {
        create: colors.map(({ color, hex, image, sizes: colorSizes = [] }) => ({
          color,
          hex,
          image,
          sizes: { create: colorSizes.map(({ size, stock }) => ({ size, stock })) },
        })),
      },
    },
    include: DEFAULT_INCLUDE,
  });

  return withVirtuals(serialize(product));
}

/**
 * Updates a Product. Confirmed against the actual admin edit form
 * (frontend/src/pages/admin/AdminProductForm.jsx) that `sizes`/`colors`
 * ARE submitted wholesale on every edit — Mongoose's `findByIdAndUpdate`
 * replaced the whole embedded array when given a plain array value for
 * that path, so this replaces them wholesale too (delete + recreate,
 * cascade removes any color's nested sizes automatically).
 *
 * totalStock IS recomputed here whenever sizes or colors change — this
 * used to reproduce a real Mongoose-era quirk (`findByIdAndUpdate` never
 * ran the `pre('save')` hook that computed totalStock, and the admin form
 * never sends `totalStock` itself, so an admin stock edit always left
 * totalStock stale in production — a genuine Commerce Engine correctness
 * gap: a product edited down to zero stock everywhere never actually
 * showed as sold out). Fixed rather than preserved, since nothing
 * downstream depends on totalStock being wrong. Only whichever of
 * sizes/colors is actually being replaced is read from the new payload;
 * the other is read fresh from the database inside the same transaction,
 * so an update touching only one of the two doesn't silently drop the
 * other's contribution to the total.
 */
export async function updateById(id, { sizes, colors, ...data } = {}, { client = prisma } = {}) {
  const hasNestedWrite = sizes !== undefined || colors !== undefined;

  const run = async (tx) => {
    let totalStockUpdate = {};
    if (hasNestedWrite) {
      const finalSizes =
        sizes !== undefined ? sizes : await tx.productSize.findMany({ where: { productId: id } });
      const finalColors =
        colors !== undefined
          ? colors
          : await tx.productColor.findMany({ where: { productId: id }, include: { sizes: true } });
      totalStockUpdate = { totalStock: calculateTotalStock(finalSizes, finalColors) };
    }

    if (sizes !== undefined) await tx.productSize.deleteMany({ where: { productId: id } });
    if (colors !== undefined) await tx.productColor.deleteMany({ where: { productId: id } });

    return tx.product.update({
      where: { id },
      data: {
        ...data,
        ...totalStockUpdate,
        ...(sizes !== undefined && {
          sizes: { create: sizes.map(({ size, stock }) => ({ size, stock })) },
        }),
        ...(colors !== undefined && {
          colors: {
            create: colors.map(({ color, hex, image, sizes: colorSizes = [] }) => ({
              color,
              hex,
              image,
              sizes: { create: colorSizes.map(({ size, stock }) => ({ size, stock })) },
            })),
          },
        }),
      },
      include: DEFAULT_INCLUDE,
    });
  };

  const product =
    hasNestedWrite && client === prisma ? await client.$transaction(run) : await run(client);
  return withVirtuals(serialize(product));
}

export async function deleteById(id, { client = prisma } = {}) {
  await client.product.delete({ where: { id } });
}

/**
 * Atomically decrements stock for a plain-size or color+size variant,
 * failing the whole operation (via an all-or-nothing conditional UPDATE,
 * not a read-then-write) if insufficient stock remains. This is the direct
 * fix for platform-audit Critical #3 and the concrete implementation of
 * the Commerce Engine's Inventory rule: "displayed availability always
 * reflects committed reservations, never a hopeful state."
 *
 * Must be called with a transaction client from within
 * `prisma.$transaction(...)` — order creation (step 6) is the caller.
 */
export async function decrementStock({ productId, size, color, quantity }, { client }) {
  if (!client) throw new StockAdjustmentError('decrementStock must be called with a transaction client');

  if (color) {
    const colorRow = await client.productColor.findFirst({ where: { productId, color } });
    if (!colorRow) throw new StockAdjustmentError(`No color "${color}" for product ${productId}`);

    const result = await client.productColorSize.updateMany({
      where: { colorId: colorRow.id, size, stock: { gte: quantity } },
      data: { stock: { decrement: quantity } },
    });
    if (result.count === 0) throw new InsufficientStockError({ productId, size, color });
  } else {
    const result = await client.productSize.updateMany({
      where: { productId, size, stock: { gte: quantity } },
      data: { stock: { decrement: quantity } },
    });
    if (result.count === 0) throw new InsufficientStockError({ productId, size, color: null });
  }

  await client.product.update({
    where: { id: productId },
    data: { totalStock: { decrement: quantity } },
  });
}

/**
 * The symmetric inverse of decrementStock — used by the Maya webhook's
 * stock-restore path on payment failure/cancellation (Commerce Engine
 * Stage 3). Also must run inside a transaction.
 */
export async function restoreStock({ productId, size, color, quantity }, { client }) {
  if (!client) throw new StockAdjustmentError('restoreStock must be called with a transaction client');

  if (color) {
    const colorRow = await client.productColor.findFirst({ where: { productId, color } });
    if (!colorRow) return; // variant no longer exists — nothing to restore into
    await client.productColorSize.updateMany({
      where: { colorId: colorRow.id, size },
      data: { stock: { increment: quantity } },
    });
  } else {
    await client.productSize.updateMany({
      where: { productId, size },
      data: { stock: { increment: quantity } },
    });
  }

  await client.product.update({
    where: { id: productId },
    data: { totalStock: { increment: quantity } },
  });
}

export default {
  generateSlug,
  calculateTotalStock,
  effectivePrice,
  discountPercentage,
  withVirtuals,
  findById,
  findBySlug,
  find,
  count,
  parseSort,
  buildListingWhere,
  search,
  getAdminStats,
  create,
  updateById,
  deleteById,
  decrementStock,
  restoreStock,
  InsufficientStockError,
  StockAdjustmentError,
};
