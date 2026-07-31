import prisma from '../lib/prisma.js';
import { serialize, withRelationFallback } from './serialize.js';

/** Matches orderSchema.pre('validate')'s order number generation exactly. */
export function generateOrderNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PP-${timestamp}-${random}`;
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
  const orderNumber = data.orderNumber || generateOrderNumber();

  const order = await client.order.create({
    data: {
      ...data,
      ...flattenShippingAddress(shippingAddress),
      orderNumber,
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
    },
    include: DEFAULT_INCLUDE,
  });

  return reshapeOrder(serialize(withOrderFallbacks(order)));
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

export default {
  generateOrderNumber,
  findById,
  findByOrderNumber,
  find,
  count,
  create,
  updateById,
  tryResolvePayment,
  getRevenueStats,
  getTopSellingProducts,
  getOrdersByStatus,
};
