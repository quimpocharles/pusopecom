import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { serialize, withRelationFallback } from './serialize.js';

const ORDER_NUMBER_PREFIX = process.env.ORDER_NUMBER_PREFIX || 'PS';
// Excludes 0/O/1/I — a support agent reading this back to a customer over
// the phone, or a customer typing it off a shipping label, shouldn't have
// to guess which character it was.
const ORDER_NUMBER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ORDER_NUMBER_SUFFIX_LENGTH = 6;
const MAX_ORDER_NUMBER_ATTEMPTS = 5;

function randomOrderSuffix() {
  const bytes = crypto.randomBytes(ORDER_NUMBER_SUFFIX_LENGTH);
  let result = '';
  for (let i = 0; i < ORDER_NUMBER_SUFFIX_LENGTH; i++) {
    result += ORDER_NUMBER_ALPHABET[bytes[i] % ORDER_NUMBER_ALPHABET.length];
  }
  return result;
}

/**
 * PS-20260802-8F4X2K — configurable prefix (ORDER_NUMBER_PREFIX env var,
 * default PS), UTC creation date, and a 6-character crypto-random
 * alphanumeric suffix (32^6 ≈ 1.07 billion combinations per day). Never
 * derived from or containing the database id. Collisions are made rare by
 * this, not impossible — create() below is what actually guarantees
 * uniqueness, by retrying on the (expected to be exceedingly rare) case
 * where one occurs anyway.
 */
export function generateOrderNumber(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${ORDER_NUMBER_PREFIX}-${y}${m}${d}-${randomOrderSuffix()}`;
}

const ORDER_RELATION_MAP = { user: 'userId' };
const ITEM_RELATION_MAP = { product: 'productId' };

// OrderItem's `product` field has the same populated-object-vs-bare-id
// duality as Order.user — applied to every item before Order.user's own
// fallback so both levels end up shaped like the original Mongoose
// .populate() result.
function withOrderFallbacks(order) {
  if (!order) return order;
  const withUser = withRelationFallback(order, ORDER_RELATION_MAP);
  if (Array.isArray(withUser.items)) {
    withUser.items = withUser.items.map((item) => withRelationFallback(item, ITEM_RELATION_MAP));
  }
  return withUser;
}

const DEFAULT_INCLUDE = { items: true };

/**
 * Order.shippingAddress was a single embedded object; the Prisma schema
 * flattens it to shipTo*-prefixed columns (see the schema comment on
 * Order). Every existing caller — the Maya checkout payload builder, the
 * order confirmation email, the frontend order/checkout pages — expects
 * the original nested `shippingAddress` object, so this is the one place
 * that reshapes flat columns back into it on the way out, and flattens
 * the same nested shape back down on the way in. Same pattern as
 * siteSettingsRepository's toNestedShape/flattenPartialUpdate.
 */
function toShippingAddress(row) {
  return {
    fullName: row.shipToFullName,
    phone: row.shipToPhone,
    country: row.shipToCountry,
    address: row.shipToAddress,
    city: row.shipToCity,
    province: row.shipToProvince,
    region: row.shipToRegion,
    barangay: row.shipToBarangay,
    zipCode: row.shipToZipCode,
  };
}

function flattenShippingAddress(shippingAddress = {}) {
  return {
    shipToFullName: shippingAddress.fullName,
    shipToPhone: shippingAddress.phone,
    shipToCountry: shippingAddress.country || 'Philippines',
    shipToAddress: shippingAddress.address,
    shipToCity: shippingAddress.city,
    shipToProvince: shippingAddress.province,
    shipToRegion: shippingAddress.region,
    shipToBarangay: shippingAddress.barangay,
    shipToZipCode: shippingAddress.zipCode,
  };
}

function reshapeOrder(order) {
  if (!order) return order;
  const {
    shipToFullName, shipToPhone, shipToCountry, shipToAddress,
    shipToCity, shipToProvince, shipToRegion, shipToBarangay, shipToZipCode,
    ...rest
  } = order;
  return { ...rest, shippingAddress: toShippingAddress(order) };
}

export async function findById(id, { include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const order = await client.order.findUnique({ where: { id }, include });
  return reshapeOrder(serialize(withOrderFallbacks(order)));
}

export async function findByOrderNumber(orderNumber, { include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const order = await client.order.findUnique({ where: { orderNumber }, include });
  return reshapeOrder(serialize(withOrderFallbacks(order)));
}

export async function find({ where, orderBy, skip, take, include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const orders = await client.order.findMany({ where, orderBy, skip, take, include });
  return serialize(orders.map(withOrderFallbacks)).map(reshapeOrder);
}

export async function count({ where, client = prisma } = {}) {
  return client.order.count({ where });
}

/**
 * Creates an Order with its OrderItems in one write. Does not touch
 * Inventory — stock decrementing is productRepository's job, and the two
 * are meant to run together inside one `prisma.$transaction`, wired up
 * when routes/orders.js itself is migrated (step 6). Building this as two
 * separately-composable repository calls now, rather than one repository
 * method that reaches into Product itself, keeps each repository owning
 * only its own entity — the same capability-boundary discipline
 * documented in CLAUDE.md.
 */
export async function create({ items = [], shippingAddress, ...data }, { client = prisma } = {}) {
  const baseData = {
    ...data,
    ...flattenShippingAddress(shippingAddress),
    items: {
      create: items.map(({ product, productId, name, price, quantity, size, color, image }) => ({
        productId: productId || product,
        name,
        price,
        quantity,
        size,
        color,
        image,
      })),
    },
  };

  // A caller-supplied orderNumber (e.g. a fixture) is used exactly once,
  // with no retry — retrying would silently generate a different number
  // than the one the caller explicitly asked for.
  if (data.orderNumber) {
    const order = await client.order.create({ data: baseData, include: DEFAULT_INCLUDE });
    return reshapeOrder(serialize(withOrderFallbacks(order)));
  }

  // orderNumber has the only extra unique constraint on Order beyond its
  // primary key, so a P2002 here can only mean a generated-number
  // collision — retry with a freshly generated one rather than failing
  // the whole checkout over odds this long.
  for (let attempt = 1; attempt <= MAX_ORDER_NUMBER_ATTEMPTS; attempt++) {
    try {
      const order = await client.order.create({
        data: { ...baseData, orderNumber: generateOrderNumber() },
        include: DEFAULT_INCLUDE,
      });
      return reshapeOrder(serialize(withOrderFallbacks(order)));
    } catch (error) {
      if (error.code !== 'P2002' || attempt === MAX_ORDER_NUMBER_ATTEMPTS) throw error;
    }
  }
}

export async function updateById(id, data, { include = DEFAULT_INCLUDE, client = prisma } = {}) {
  const order = await client.order.update({ where: { id }, data, include });
  return reshapeOrder(serialize(withOrderFallbacks(order)));
}

/**
 * Atomically transitions paymentStatus away from 'pending' via a WHERE-
 * guarded updateMany, not a plain update — so two concurrent resolution
 * attempts for the same order (the customer's browser polling
 * /verify-payment while the Maya webhook fires for the same event) can't
 * both succeed and double-apply side effects: a duplicate confirmation
 * email, or stock restored twice for one failed payment. Same technique
 * as productRepository.decrementStock's conditional guard, applied to the
 * same class of concurrent-mutation race. Returns true only if this call
 * actually performed the transition.
 */
export async function tryResolvePayment(id, paymentStatus, extra = {}, { client = prisma } = {}) {
  const result = await client.order.updateMany({
    where: { id, paymentStatus: 'pending' },
    data: { paymentStatus, ...extra },
  });
  return result.count > 0;
}

/**
 * Payment Platform Redesign, Phase 4 — orders lib/expireStaleOrders.js's
 * hourly sweep should mark Expired: still genuinely unresolved
 * (paymentStatus never moved off 'pending' — a resolved order, whichever
 * way, is never a candidate here) and placed before the retention cutoff.
 * Measured from Order.createdAt, not the latest Payment attempt's own
 * createdAt — regenerating a checkout session (Phase 3's "Generate New
 * Payment Link") extends how long a fan can *try* to pay, not how long
 * their reserved stock stays held for a purchase that still hasn't happened.
 */
export async function findStalePending({ cutoff, client = prisma } = {}) {
  const orders = await client.order.findMany({
    where: { paymentStatus: 'pending', createdAt: { lt: cutoff } },
    include: DEFAULT_INCLUDE,
  });
  return serialize(orders.map(withOrderFallbacks)).map(reshapeOrder);
}

/** Replaces the revenue $group aggregations behind admin order stats. */
export async function getRevenueStats({ client = prisma } = {}) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [total, monthly] = await Promise.all([
    client.order.aggregate({ where: { paymentStatus: 'paid' }, _sum: { total: true }, _count: true }),
    client.order.aggregate({
      where: { paymentStatus: 'paid', createdAt: { gte: startOfMonth } },
      _sum: { total: true },
      _count: true,
    }),
  ]);

  return {
    totalRevenue: total._sum.total || 0,
    paidOrdersCount: total._count,
    revenueThisMonth: monthly._sum.total || 0,
    monthlyOrdersCount: monthly._count,
  };
}

/**
 * Replaces the $unwind + $group-by-product pipeline behind "top selling
 * products". name/image come from one representative OrderItem per
 * product (groupBy can't project arbitrary non-grouped columns, the same
 * limitation the original pipeline's $first sidestepped) — an item
 * snapshot at time of purchase, not necessarily the product's current
 * name/image, matching the original's own semantics exactly.
 */
export async function getTopSellingProducts(limit = 5, { client = prisma } = {}) {
  const groups = await client.orderItem.groupBy({
    by: ['productId'],
    where: { order: { paymentStatus: 'paid' } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: limit,
  });

  return Promise.all(
    groups.map(async (g) => {
      const sample = await client.orderItem.findFirst({
        where: { productId: g.productId },
        select: { name: true, image: true },
      });
      return { _id: g.productId, name: sample?.name, image: sample?.image, totalQuantity: g._sum.quantity };
    })
  );
}

/** Replaces the $group-by-orderStatus pipeline, returning the same { [status]: count } shape. */
export async function getOrdersByStatus({ client = prisma } = {}) {
  const groups = await client.order.groupBy({ by: ['orderStatus'], _count: true });
  const result = {};
  for (const g of groups) result[g.orderStatus] = g._count;
  return result;
}

/**
 * Fit Check's "Purchased" badge — one query over the user's paid
 * OrderItems, not N+1 per try-on. `paid` specifically, not just any order
 * status: a reserved-but-never-paid-for cart shouldn't read as "Purchased."
 * Mirrors the shape organizationRepository.findPurchasedByUser already
 * established for a similar cross-entity lookup (there: which
 * organizations; here: which products, and the order each came from).
 */
export async function findPurchasedProductMap(userId, { client = prisma } = {}) {
  const items = await client.orderItem.findMany({
    where: { order: { userId, paymentStatus: 'paid' } },
    select: { productId: true, order: { select: { orderNumber: true, createdAt: true } } },
    orderBy: { order: { createdAt: 'desc' } },
  });

  const map = new Map();
  for (const item of items) {
    // Most recent paid order wins if a product was bought more than once —
    // orderBy above means the first occurrence per productId is the latest.
    if (!map.has(item.productId)) map.set(item.productId, item.order.orderNumber);
  }
  return map;
}

export default {
  generateOrderNumber,
  findById,
  findByOrderNumber,
  find,
  count,
  create,
  updateById,
  tryResolvePayment,
  findStalePending,
  getRevenueStats,
  getTopSellingProducts,
  getOrdersByStatus,
  findPurchasedProductMap,
};
