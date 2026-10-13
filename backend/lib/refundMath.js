/**
 * Refund math — Stage 2, Step 1.
 *
 * Every function here is pure, takes plain data, and does all money math in
 * integer centavos (INV-C1/C6): a single `toCentavos` conversion at the Float
 * boundary (the schema's documented Float-money tradeoff is contained to that
 * one edge), then integer arithmetic only. No I/O, no Prisma, no env access.
 *
 * The two jobs:
 *
 *  1. `computeLineDiscountAllocations` — allocate an order's `discountAmount`
 *     back onto the individual checkout lines it was computed against, honoring
 *     the promo's scope (ORDER applies to the whole eligible base including
 *     Pass lines, PRODUCT to matching merchandise lines, EVENT to matching Pass
 *     lines, FREE_SHIPPING to nothing), with largest-remainder so allocations
 *     sum exactly to the discount (INV-C3) and never exceed a line's own total
 *     (INV-C2).
 *
 *  2. `attributableReturnAmount` / `attributableMerchandisePaid` — how much of
 *     what the customer actually paid is attributable to a set of returned
 *     items, discount included. A partial-quantity return is floored to
 *     centavos (INV-C4) so no split of a line can ever exceed that line's
 *     attributable amount; a single return of a line's full quantity gets the
 *     exact remainder.
 *
 * Shipping and gateway fees are deliberately excluded from return attribution
 * (D-policy) — this module only ever sees merchandise and Pass lines, never the
 * order's shipping/fee components.
 */

/** Pesos -> integer centavos. The single Float boundary in this module. */
export function toCentavos(value) {
  return Math.round(Number(value) * 100);
}

/** Integer centavos -> pesos, for persisting onto Refund.amount (a Float). */
export function fromCentavos(cents) {
  return cents / 100;
}

/**
 * Normalize OrderItems (Prisma-raw or serialized) into allocation lines.
 * `amountCentavos` is rounded per line — deliberately, so the sum this module
 * allocates against is centavo-exact and self-consistent rather than inheriting
 * a float subtotal's rounding drift.
 */
export function buildMerchandiseLines(orderItems = []) {
  return orderItems.map((item) => ({
    key: item._id ?? item.id,
    productId: item.productId ?? item.product,
    quantity: item.quantity,
    amountCentavos: toCentavos(item.price * item.quantity),
  }));
}

/** One line per Pass (each Pass is a single admission unit — quantity 1). */
export function buildPassLines(passes = []) {
  return passes.map((pass) => ({
    key: pass._id ?? pass.id,
    passEventId: pass.passEventId,
    quantity: 1,
    amountCentavos: toCentavos(pass.price),
  }));
}

/**
 * Largest-remainder apportionment of `totalCentavos` across `weights`
 * (integer centavos). Guarantees:
 *  - Σ result === min(totalCentavos, Σ weights) (exactly, when total ≤ Σ weights)
 *  - 0 ≤ result[i] ≤ weights[i] (never over-allocates a line — INV-C2)
 *  - deterministic (fractional-remainder desc, then index asc)
 */
export function largestRemainderAllocate(totalCentavos, weights) {
  const result = weights.map(() => 0);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalCentavos <= 0 || totalWeight <= 0) return result;

  const target = Math.min(totalCentavos, totalWeight);
  const remainders = [];
  let allocated = 0;
  for (let i = 0; i < weights.length; i++) {
    const ideal = (target * weights[i]) / totalWeight;
    const floored = Math.floor(ideal);
    result[i] = floored;
    allocated += floored;
    remainders.push({ index: i, remainder: ideal - floored });
  }

  let leftover = target - allocated;
  remainders.sort((a, b) => (b.remainder - a.remainder) || (a.index - b.index));
  for (const { index } of remainders) {
    if (leftover <= 0) break;
    if (result[index] < weights[index]) {
      result[index] += 1;
      leftover -= 1;
    }
  }
  // Defensive: only reachable when Σ weights somehow fell below target, which
  // cannot happen for valid checkout data (computeDiscount caps the discount at
  // its base). Never push a line past its own weight handling this.
  for (let i = 0; i < result.length && leftover > 0; i++) {
    while (result[i] < weights[i] && leftover > 0) {
      result[i] += 1;
      leftover -= 1;
    }
  }

  return result;
}

/**
 * Allocate `discountAmount` across the checkout lines it applies to.
 * Returns integer-centavo arrays aligned to the inputs, plus `capped` when the
 * discount exceeded the eligible base (defensive only — never for valid data).
 */
export function computeLineDiscountAllocations({
  merchandiseLines = [],
  passLines = [],
  discountAmount = 0,
  promoCode = null,
} = {}) {
  const merchandiseAllocations = merchandiseLines.map(() => 0);
  const passAllocations = passLines.map(() => 0);
  const discountCentavos = toCentavos(discountAmount);

  // No discount, or a shipping-only discount — no line bears any of it.
  if (discountCentavos <= 0 || (promoCode && promoCode.discountType === 'FREE_SHIPPING')) {
    return { merchandiseAllocations, passAllocations, discountCentavos, capped: false };
  }

  const scope = promoCode?.scope;
  const combined = []; // { kind, index, weight } over the eligible base only
  if (scope === 'PRODUCT') {
    const productIds = new Set((promoCode.products ?? []).map((p) => p.productId));
    merchandiseLines.forEach((line, index) => {
      if (productIds.has(line.productId)) combined.push({ kind: 'merchandise', index, weight: line.amountCentavos });
    });
  } else if (scope === 'EVENT') {
    const passEventIds = new Set((promoCode.passEvents ?? []).map((p) => p.passEventId));
    passLines.forEach((line, index) => {
      if (passEventIds.has(line.passEventId)) combined.push({ kind: 'pass', index, weight: line.amountCentavos });
    });
  } else {
    // ORDER (default/unknown) — every eligible line: merchandise AND Pass.
    // A missing promoCode row falls back here too, conservatively matching how
    // the discount actually reduced the whole subtotal.
    merchandiseLines.forEach((line, index) => combined.push({ kind: 'merchandise', index, weight: line.amountCentavos }));
    passLines.forEach((line, index) => combined.push({ kind: 'pass', index, weight: line.amountCentavos }));
  }

  const eligibleBase = combined.reduce((sum, c) => sum + c.weight, 0);
  const capped = discountCentavos > eligibleBase;
  const allocations = largestRemainderAllocate(discountCentavos, combined.map((c) => c.weight));
  combined.forEach((c, i) => {
    if (c.kind === 'merchandise') merchandiseAllocations[c.index] = allocations[i];
    else passAllocations[c.index] = allocations[i];
  });

  return { merchandiseAllocations, passAllocations, discountCentavos, capped };
}

/**
 * The cumulative ceiling for return-origin refunds: what the customer actually
 * paid for merchandise, after its share of any discount. Shipping and gateway
 * fees are excluded by policy.
 */
export function attributableMerchandisePaid({ merchandiseLines = [], passLines = [], discountAmount = 0, promoCode = null } = {}) {
  const { merchandiseAllocations } = computeLineDiscountAllocations({ merchandiseLines, passLines, discountAmount, promoCode });
  return merchandiseLines.reduce((sum, line, index) => sum + (line.amountCentavos - merchandiseAllocations[index]), 0);
}

/**
 * Attributable amount for the items actually being returned — integer centavos.
 * A full-line return gets the exact line remainder; a partial return is floored
 * so repeated partial returns of the same line can never sum past its
 * attributable amount (INV-C4).
 */
export function attributableReturnAmount({
  merchandiseLines = [],
  passLines = [],
  discountAmount = 0,
  promoCode = null,
  returnItems = [],
} = {}) {
  const { merchandiseAllocations } = computeLineDiscountAllocations({ merchandiseLines, passLines, discountAmount, promoCode });
  const lineIndexByKey = new Map(merchandiseLines.map((line, index) => [line.key, index]));

  let total = 0;
  for (const returnItem of returnItems) {
    const index = lineIndexByKey.get(returnItem.orderItemId);
    if (index === undefined) {
      throw new Error(`Return item references an unknown order item: ${returnItem.orderItemId}`);
    }
    const line = merchandiseLines[index];
    if (!Number.isInteger(returnItem.quantity) || returnItem.quantity <= 0 || returnItem.quantity > line.quantity) {
      throw new Error(`Return quantity ${returnItem.quantity} is invalid for order item ${returnItem.orderItemId}`);
    }
    const lineAttributable = line.amountCentavos - merchandiseAllocations[index];
    const share = returnItem.quantity >= line.quantity
      ? lineAttributable
      : Math.floor((lineAttributable * returnItem.quantity) / line.quantity);
    total += share;
  }
  return total;
}

/**
 * The refundable ceiling (integer centavos) for a RETURN-origin refund: the
 * tighter of the return's own attributable value and the order-wide attributable
 * merchandise capacity still remaining after other committed (succeeded +
 * processing) return-origin refunds. Shared by the inspection and manual-record
 * routes so every return-refund path enforces the same rule. Throws (via
 * attributableReturnAmount) when a returned item no longer resolves to the order,
 * so the caller can refuse rather than guess.
 */
export function returnRefundCeilingCentavos({
  merchandiseLines = [],
  passLines = [],
  discountAmount = 0,
  promoCode = null,
  returnItems = [],
  committedReturnCentavos = 0,
} = {}) {
  const attributableReturn = attributableReturnAmount({ merchandiseLines, passLines, discountAmount, promoCode, returnItems });
  const attributablePaid = attributableMerchandisePaid({ merchandiseLines, passLines, discountAmount, promoCode });
  const orderWideRemaining = Math.max(0, attributablePaid - committedReturnCentavos);
  return Math.min(attributableReturn, orderWideRemaining);
}

export default {
  toCentavos,
  fromCentavos,
  buildMerchandiseLines,
  buildPassLines,
  largestRemainderAllocate,
  computeLineDiscountAllocations,
  attributableMerchandisePaid,
  attributableReturnAmount,
  returnRefundCeilingCentavos,
};
