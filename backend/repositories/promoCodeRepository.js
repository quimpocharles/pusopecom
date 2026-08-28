import prisma from '../lib/prisma.js';
import { serialize } from './serialize.js';
import { normalizeDateFields } from '../lib/dateInput.js';

const DATE_FIELDS = ['startsAt', 'endsAt'];

const DEFAULT_INCLUDE = {
  products: { include: { product: { select: { id: true, name: true, slug: true, images: true } } } },
  // Only populated when scope = EVENT — mirrors `products` above exactly.
  passEvents: { include: { passEvent: { select: { id: true, name: true, slug: true, startsAt: true } } } },
};

export class PromoCodeInvalidError extends Error {
  constructor(reason, message) {
    super(message);
    this.name = 'PromoCodeInvalidError';
    this.reason = reason;
  }
}

/**
 * Thrown by tryRedeem when the atomic conditional increment affects zero
 * rows — the code was deactivated, or another concurrent checkout already
 * claimed the last redemption slot between this order's preview and its
 * actual submission (the same race decrementStock guards against for stock).
 */
export class PromoCodeExhaustedError extends Error {
  constructor(promoCodeId) {
    super('This promo code just reached its redemption limit.');
    this.name = 'PromoCodeExhaustedError';
    this.promoCodeId = promoCodeId;
  }
}

function normalizeCode(data) {
  if (typeof data.code !== 'string') return data;
  return { ...data, code: data.code.trim().toUpperCase() };
}

export async function findById(id, { client = prisma } = {}) {
  const promoCode = await client.promoCode.findUnique({ where: { id }, include: DEFAULT_INCLUDE });
  return serialize(promoCode);
}

export async function findByCode(code, { client = prisma } = {}) {
  if (!code || typeof code !== 'string') return null;
  const promoCode = await client.promoCode.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: DEFAULT_INCLUDE,
  });
  return serialize(promoCode);
}

export async function find({ where, orderBy, skip, take, client = prisma } = {}) {
  const promoCodes = await client.promoCode.findMany({ where, orderBy, skip, take, include: DEFAULT_INCLUDE });
  return serialize(promoCodes);
}

export async function count({ where, client = prisma } = {}) {
  return client.promoCode.count({ where });
}

/** Replace-all for PromoCode.scope = PRODUCT targeting — delete then recreate, not a diff. */
export async function setProducts(promoCodeId, productIds, { client = prisma } = {}) {
  await client.promoCodeProduct.deleteMany({ where: { promoCodeId } });
  if (productIds?.length) {
    await client.promoCodeProduct.createMany({
      data: productIds.map((productId) => ({ promoCodeId, productId })),
      skipDuplicates: true,
    });
  }
}

/** Replace-all for PromoCode.scope = EVENT targeting — mirrors setProducts exactly. */
export async function setPassEvents(promoCodeId, passEventIds, { client = prisma } = {}) {
  await client.promoCodePassEvent.deleteMany({ where: { promoCodeId } });
  if (passEventIds?.length) {
    await client.promoCodePassEvent.createMany({
      data: passEventIds.map((passEventId) => ({ promoCodeId, passEventId })),
      skipDuplicates: true,
    });
  }
}

export async function create({ productIds, passEventIds, ...data }, { client = prisma } = {}) {
  const promoCode = await client.promoCode.create({ data: normalizeDateFields(normalizeCode(data), DATE_FIELDS) });
  if (productIds) await setProducts(promoCode.id, productIds, { client });
  if (passEventIds) await setPassEvents(promoCode.id, passEventIds, { client });
  return findById(promoCode.id, { client });
}

export async function updateById(id, { productIds, passEventIds, ...data }, { client = prisma } = {}) {
  await client.promoCode.update({ where: { id }, data: normalizeDateFields(normalizeCode(data), DATE_FIELDS) });
  if (productIds) await setProducts(id, productIds, { client });
  if (passEventIds) await setPassEvents(id, passEventIds, { client });
  return findById(id, { client });
}

export async function deleteById(id, { client = prisma } = {}) {
  await client.promoCode.update({ where: { id }, data: { active: false } });
}

/**
 * How many times this customer has already redeemed this code. Counts every
 * Order that isn't 'failed' (pending/paid/refunded) — mirroring exactly which
 * states keep a promo redemption "claimed" vs. released (see tryRedeem /
 * releaseRedemption): a redemption is claimed at Order placement and only
 * ever released when payment resolves to failed, same as stock.
 *
 * No dedicated redemption-ledger table — Order already carries promoCodeId,
 * userId/email, and paymentStatus, so a ledger would be an abstraction with
 * no second use case yet.
 */
export async function countCustomerRedemptions({ promoCodeId, userId, email }, { client = prisma } = {}) {
  if (!userId && !email) return 0;
  return client.order.count({
    where: {
      promoCodeId,
      paymentStatus: { not: 'failed' },
      ...(userId ? { userId } : { email }),
    },
  });
}

/**
 * Pure discount math — no I/O. FREE_SHIPPING discounts exactly the real
 * computed shippingFee (not a flat waiver), so Order.total = subtotal +
 * shippingFee - discountAmount stays one formula for every discount type.
 * Otherwise the "base" a percent/fixed amount applies against is either the
 * whole subtotal (ORDER scope), just the matching line items' total
 * (PRODUCT scope), or just the matching Pass units' total (EVENT scope) —
 * capped so the discount can never exceed its own base or go negative.
 *
 * `passes` mirrors `items`' shape for Merchandise: each entry is one
 * already-quantity-expanded Pass unit (routes/orders.js's `passUnits`,
 * `{ passEventId, passTierId, price }` — one entry per admission, not one
 * entry per requested tier/quantity pair), so summing `.price` directly is
 * correct without a second `.quantity` multiplier the way `items` needs.
 */
export function computeDiscount({ promoCode, items = [], passes = [], subtotal, shippingFee }) {
  if (promoCode.discountType === 'FREE_SHIPPING') {
    return { discountAmount: shippingFee, freeShipping: true };
  }

  let base = subtotal;
  if (promoCode.scope === 'PRODUCT') {
    const matchingProductIds = new Set((promoCode.products ?? []).map((p) => p.productId));
    base = items
      .filter((item) => matchingProductIds.has(item.product))
      .reduce((sum, item) => sum + item.price * item.quantity, 0);
  } else if (promoCode.scope === 'EVENT') {
    const matchingPassEventIds = new Set((promoCode.passEvents ?? []).map((p) => p.passEventId));
    base = passes
      .filter((unit) => matchingPassEventIds.has(unit.passEventId))
      .reduce((sum, unit) => sum + unit.price, 0);
  }

  const raw = promoCode.discountType === 'PERCENTAGE' ? base * (promoCode.percentOff / 100) : promoCode.amountOff;
  const discountAmount = Math.max(0, Math.min(raw, base));
  return { discountAmount, freeShipping: false };
}

/**
 * The one function both the checkout-page preview (POST /validate) and the
 * real order-creation transaction call — same checks, same order, so a code
 * that passes preview and then fails at submission only ever does so because
 * something genuinely changed in between (expired, hit its cap), never
 * because the two paths disagree with each other.
 */
export async function validate({ code, userId, email, items = [], passes = [], subtotal, shippingFee }, { client = prisma } = {}) {
  const promoCode = await findByCode(code, { client });
  if (!promoCode || !promoCode.active) {
    throw new PromoCodeInvalidError('not_found', 'This promo code is invalid.');
  }

  const now = new Date();
  if (promoCode.startsAt && now < new Date(promoCode.startsAt)) {
    throw new PromoCodeInvalidError('not_started', 'This promo code is not active yet.');
  }
  if (promoCode.endsAt && now > new Date(promoCode.endsAt)) {
    throw new PromoCodeInvalidError('expired', 'This promo code has expired.');
  }

  if (promoCode.minOrderValue != null && subtotal < promoCode.minOrderValue) {
    throw new PromoCodeInvalidError(
      'min_order_not_met',
      `This code requires a minimum order of ₱${promoCode.minOrderValue.toFixed(2)}.`
    );
  }

  if (promoCode.scope === 'PRODUCT') {
    const matchingProductIds = new Set((promoCode.products ?? []).map((p) => p.productId));
    if (!items.some((item) => matchingProductIds.has(item.product))) {
      throw new PromoCodeInvalidError('no_matching_items', "This code doesn't apply to any items in your cart.");
    }
  }

  if (promoCode.scope === 'EVENT') {
    const matchingPassEventIds = new Set((promoCode.passEvents ?? []).map((p) => p.passEventId));
    if (!passes.some((unit) => matchingPassEventIds.has(unit.passEventId))) {
      throw new PromoCodeInvalidError('no_matching_items', "This code doesn't apply to any Passes in your cart.");
    }
  }

  // Only enforced when an identity is actually available — the checkout
  // page's preview call may run before the customer has entered an email.
  // The authoritative enforcement is always the real order-creation call,
  // which has a required, validated email by that point.
  if (promoCode.perCustomerLimit != null && (userId || email)) {
    const used = await countCustomerRedemptions({ promoCodeId: promoCode._id, userId, email }, { client });
    if (used >= promoCode.perCustomerLimit) {
      throw new PromoCodeInvalidError(
        'customer_limit_reached',
        "You've already used this code the maximum number of times."
      );
    }
  }

  // Soft pre-check for a fast, friendly error — the real guarantee against
  // a race at the boundary is tryRedeem's atomic conditional update inside
  // the order-creation transaction.
  if (promoCode.maxRedemptions != null && promoCode.redemptionCount >= promoCode.maxRedemptions) {
    throw new PromoCodeInvalidError('exhausted', 'This promo code has reached its redemption limit.');
  }

  const { discountAmount, freeShipping } = computeDiscount({ promoCode, items, passes, subtotal, shippingFee });
  return { promoCode, discountAmount, freeShipping };
}

/**
 * Atomic conditional increment — must run inside a `prisma.$transaction`.
 * Mirrors productRepository.decrementStock's "conditional update, check
 * affected-row count" precedent for closing the exact same category of race
 * (two checkouts claiming the last redemption slot at once): the
 * `maxRedemptions` comparison value is captured by the caller (from the
 * `validate()` call moments earlier) so this stays a plain Prisma `updateMany`
 * against a literal, not a raw-SQL column-to-column comparison.
 */
export async function tryRedeem({ promoCodeId, maxRedemptions }, { client } = {}) {
  if (!client) throw new Error('tryRedeem must be called with a transaction client');

  const result = await client.promoCode.updateMany({
    where: {
      id: promoCodeId,
      active: true,
      ...(maxRedemptions != null ? { redemptionCount: { lt: maxRedemptions } } : {}),
    },
    data: { redemptionCount: { increment: 1 } },
  });

  if (result.count === 0) throw new PromoCodeExhaustedError(promoCodeId);
}

/** The symmetric inverse of tryRedeem — used by releaseStock when a promo-carrying order's payment fails/expires. */
export async function releaseRedemption(promoCodeId, { client } = {}) {
  if (!client) throw new Error('releaseRedemption must be called with a transaction client');

  await client.promoCode.updateMany({
    where: { id: promoCodeId, redemptionCount: { gt: 0 } },
    data: { redemptionCount: { decrement: 1 } },
  });
}

export default {
  findById,
  findByCode,
  find,
  count,
  setProducts,
  setPassEvents,
  create,
  updateById,
  deleteById,
  countCustomerRedemptions,
  computeDiscount,
  validate,
  tryRedeem,
  releaseRedemption,
  PromoCodeInvalidError,
  PromoCodeExhaustedError,
};
