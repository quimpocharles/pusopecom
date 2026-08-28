import { describe, it, expect, vi } from 'vitest';
import * as promoCodeRepository from '../promoCodeRepository.js';

// computeDiscount is pure (no I/O) — every test below exercises it directly,
// no client/DB needed. validate() is exercised separately further down with
// a mocked Prisma client (matching orderRepository.test.js's own precedent
// for repository unit tests), never a real database.

function makePromoCode(overrides = {}) {
  return {
    _id: 'promo-1',
    code: 'TESTCODE',
    active: true,
    discountType: 'PERCENTAGE',
    scope: 'ORDER',
    percentOff: 10,
    amountOff: null,
    startsAt: null,
    endsAt: null,
    minOrderValue: null,
    perCustomerLimit: null,
    maxRedemptions: null,
    redemptionCount: 0,
    products: [],
    passEvents: [],
    ...overrides,
  };
}

function makePassUnit(overrides = {}) {
  return { passEventId: 'event-1', passTierId: 'tier-1', price: 350, ...overrides };
}

describe('promoCodeRepository.computeDiscount — EVENT scope', () => {
  it('matches the correct event and computes a percentage discount from only that event\'s Pass units', () => {
    const promoCode = makePromoCode({
      scope: 'EVENT',
      discountType: 'PERCENTAGE',
      percentOff: 20,
      passEvents: [{ passEventId: 'event-1' }],
    });
    const passes = [makePassUnit({ passEventId: 'event-1', price: 350 }), makePassUnit({ passEventId: 'event-1', price: 350 })];

    const { discountAmount } = promoCodeRepository.computeDiscount({ promoCode, passes, subtotal: 700, shippingFee: 0 });
    expect(discountAmount).toBe(140); // 20% of (350+350)
  });

  it('rejects a different event — Pass units for a non-matching event contribute nothing to the discount base', () => {
    const promoCode = makePromoCode({ scope: 'EVENT', discountType: 'PERCENTAGE', percentOff: 50, passEvents: [{ passEventId: 'event-1' }] });
    const passes = [makePassUnit({ passEventId: 'event-2', price: 500 })];

    const { discountAmount } = promoCodeRepository.computeDiscount({ promoCode, passes, subtotal: 500, shippingFee: 0 });
    expect(discountAmount).toBe(0);
  });

  it('multiple selected events all match — a promo targeting Event A + Event B discounts Pass units from either', () => {
    const promoCode = makePromoCode({
      scope: 'EVENT',
      discountType: 'PERCENTAGE',
      percentOff: 10,
      passEvents: [{ passEventId: 'event-A' }, { passEventId: 'event-B' }],
    });
    const passes = [
      makePassUnit({ passEventId: 'event-A', price: 300 }),
      makePassUnit({ passEventId: 'event-B', price: 200 }),
      makePassUnit({ passEventId: 'event-C', price: 999 }), // not targeted — must not count
    ];

    const { discountAmount } = promoCodeRepository.computeDiscount({ promoCode, passes, subtotal: 1499, shippingFee: 0 });
    expect(discountAmount).toBe(50); // 10% of (300 + 200), event-C excluded
  });

  it('does not discount merchandise items — an EVENT-scope promo ignores `items` entirely', () => {
    const promoCode = makePromoCode({
      scope: 'EVENT',
      discountType: 'PERCENTAGE',
      percentOff: 100,
      passEvents: [{ passEventId: 'event-1' }],
    });
    const items = [{ product: 'prod-1', price: 800, quantity: 1 }];

    const { discountAmount } = promoCodeRepository.computeDiscount({ promoCode, items, passes: [], subtotal: 800, shippingFee: 0 });
    expect(discountAmount).toBe(0);
  });

  it('fixed-amount discount works for Passes, capped at the matching Pass units\' own total', () => {
    const promoCode = makePromoCode({
      scope: 'EVENT',
      discountType: 'FIXED_AMOUNT',
      amountOff: 1000,
      passEvents: [{ passEventId: 'event-1' }],
    });
    const passes = [makePassUnit({ passEventId: 'event-1', price: 350 })];

    const { discountAmount } = promoCodeRepository.computeDiscount({ promoCode, passes, subtotal: 350, shippingFee: 0 });
    expect(discountAmount).toBe(350); // capped at the base, never exceeds it
  });
});

describe('promoCodeRepository.computeDiscount — ORDER and PRODUCT scope remain unchanged', () => {
  it('ORDER scope still discounts the whole subtotal regardless of items/passes', () => {
    const promoCode = makePromoCode({ scope: 'ORDER', discountType: 'PERCENTAGE', percentOff: 10 });
    const { discountAmount } = promoCodeRepository.computeDiscount({ promoCode, subtotal: 1000, shippingFee: 0 });
    expect(discountAmount).toBe(100);
  });

  it('PRODUCT scope still matches only items, unaffected by the new passEvents field being present but empty', () => {
    const promoCode = makePromoCode({
      scope: 'PRODUCT',
      discountType: 'PERCENTAGE',
      percentOff: 50,
      products: [{ productId: 'prod-1' }],
    });
    const items = [
      { product: 'prod-1', price: 400, quantity: 1 },
      { product: 'prod-2', price: 600, quantity: 1 },
    ];

    const { discountAmount } = promoCodeRepository.computeDiscount({ promoCode, items, subtotal: 1000, shippingFee: 0 });
    expect(discountAmount).toBe(200); // 50% of only prod-1's 400
  });

  it('FREE_SHIPPING still discounts exactly shippingFee regardless of scope', () => {
    const promoCode = makePromoCode({ scope: 'ORDER', discountType: 'FREE_SHIPPING' });
    const { discountAmount, freeShipping } = promoCodeRepository.computeDiscount({ promoCode, subtotal: 1000, shippingFee: 150 });
    expect(discountAmount).toBe(150);
    expect(freeShipping).toBe(true);
  });
});

describe('promoCodeRepository.validate — EVENT scope', () => {
  function mockClientFor(promoCode) {
    return { promoCode: { findUnique: vi.fn().mockResolvedValue(promoCode) } };
  }

  it('accepts an EVENT-scope code when the cart has a Pass for the targeted event', async () => {
    const promoCode = makePromoCode({ scope: 'EVENT', discountType: 'PERCENTAGE', percentOff: 15, passEvents: [{ passEventId: 'event-1' }] });
    const client = mockClientFor(promoCode);

    const result = await promoCodeRepository.validate(
      { code: 'TESTCODE', passes: [makePassUnit({ passEventId: 'event-1', price: 350 })], subtotal: 350, shippingFee: 0 },
      { client }
    );
    expect(result.discountAmount).toBeCloseTo(52.5);
  });

  it('rejects an EVENT-scope code when no Pass in the cart matches the targeted event — "no_matching_items"', async () => {
    const promoCode = makePromoCode({ scope: 'EVENT', discountType: 'PERCENTAGE', percentOff: 15, passEvents: [{ passEventId: 'event-1' }] });
    const client = mockClientFor(promoCode);

    await expect(
      promoCodeRepository.validate(
        { code: 'TESTCODE', passes: [makePassUnit({ passEventId: 'event-2', price: 350 })], subtotal: 350, shippingFee: 0 },
        { client }
      )
    ).rejects.toMatchObject({ name: 'PromoCodeInvalidError', reason: 'no_matching_items' });
  });

  it('rejects an EVENT-scope code against a merchandise-only cart (no passes at all)', async () => {
    const promoCode = makePromoCode({ scope: 'EVENT', discountType: 'PERCENTAGE', percentOff: 15, passEvents: [{ passEventId: 'event-1' }] });
    const client = mockClientFor(promoCode);

    await expect(
      promoCodeRepository.validate({ code: 'TESTCODE', items: [{ product: 'p1', price: 800, quantity: 1 }], subtotal: 800, shippingFee: 0 }, { client })
    ).rejects.toMatchObject({ reason: 'no_matching_items' });
  });
});

describe('promoCodeRepository.validate — ORDER and PRODUCT scope remain unchanged', () => {
  function mockClientFor(promoCode) {
    return { promoCode: { findUnique: vi.fn().mockResolvedValue(promoCode) } };
  }

  it('ORDER scope still validates and discounts with no items/passes at all', async () => {
    const promoCode = makePromoCode({ scope: 'ORDER', discountType: 'PERCENTAGE', percentOff: 10 });
    const client = mockClientFor(promoCode);

    const result = await promoCodeRepository.validate({ code: 'TESTCODE', subtotal: 1000, shippingFee: 0 }, { client });
    expect(result.discountAmount).toBe(100);
  });

  it('PRODUCT scope still rejects a cart with no matching product, unaffected by EVENT scope existing', async () => {
    const promoCode = makePromoCode({ scope: 'PRODUCT', discountType: 'PERCENTAGE', percentOff: 10, products: [{ productId: 'prod-1' }] });
    const client = mockClientFor(promoCode);

    await expect(
      promoCodeRepository.validate({ code: 'TESTCODE', items: [{ product: 'prod-2', price: 100, quantity: 1 }], subtotal: 100, shippingFee: 0 }, { client })
    ).rejects.toMatchObject({ reason: 'no_matching_items' });
  });

  it('inactive/expired promo behavior is unchanged by the EVENT-scope addition', async () => {
    const promoCode = makePromoCode({ active: false });
    const client = mockClientFor(promoCode);

    await expect(promoCodeRepository.validate({ code: 'TESTCODE', subtotal: 100, shippingFee: 0 }, { client })).rejects.toMatchObject({ reason: 'not_found' });
  });
});
