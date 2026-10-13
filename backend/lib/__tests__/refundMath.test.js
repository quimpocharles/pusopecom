import { describe, it, expect } from 'vitest';
import {
  toCentavos,
  fromCentavos,
  buildMerchandiseLines,
  buildPassLines,
  largestRemainderAllocate,
  computeLineDiscountAllocations,
  attributableMerchandisePaid,
  attributableReturnAmount,
  returnRefundCeilingCentavos,
} from '../refundMath.js';

const sum = (values) => values.reduce((total, value) => total + value, 0);

describe('refundMath — centavo conversion (INV-C1, INV-C6)', () => {
  it('converts pesos to integer centavos at the Float boundary', () => {
    expect(toCentavos(599.1)).toBe(59910);
    expect(toCentavos(0.1 + 0.2)).toBe(30); // 0.30000000000000004
    expect(toCentavos(10.005)).toBe(1001);
    expect(toCentavos(333.333)).toBe(33333);
  });

  it('round-trips whole centavos', () => {
    expect(fromCentavos(59910)).toBe(599.1);
    expect(fromCentavos(33333)).toBe(333.33);
  });
});

describe('refundMath — buildMerchandiseLines / buildPassLines', () => {
  it('reads both Prisma-raw (id) and serialized (_id) order items', () => {
    const lines = buildMerchandiseLines([
      { id: 'a', productId: 'p1', price: 599.1, quantity: 2 },
      { _id: 'b', product: 'p2', price: 1000, quantity: 1 },
    ]);
    expect(lines).toEqual([
      { key: 'a', productId: 'p1', quantity: 2, amountCentavos: 119820 },
      { key: 'b', productId: 'p2', quantity: 1, amountCentavos: 100000 },
    ]);
  });

  it('builds one line per Pass with quantity 1', () => {
    const lines = buildPassLines([
      { _id: 'pa', passEventId: 'e1', price: 1500 },
      { id: 'pb', passEventId: 'e1', price: 1500 },
    ]);
    expect(lines).toEqual([
      { key: 'pa', passEventId: 'e1', quantity: 1, amountCentavos: 150000 },
      { key: 'pb', passEventId: 'e1', quantity: 1, amountCentavos: 150000 },
    ]);
  });
});

describe('refundMath — largestRemainderAllocate (INV-C2, INV-C3)', () => {
  it('sums exactly to the target and never exceeds a weight', () => {
    const weights = [100000, 100000, 100000];
    const out = largestRemainderAllocate(10000, weights);
    expect(sum(out)).toBe(10000);
    out.forEach((value, i) => expect(value).toBeLessThanOrEqual(weights[i]));
    expect([...out].sort((a, b) => a - b)).toEqual([3333, 3333, 3334]);
  });

  it('distributes by weight for uneven lines', () => {
    const weights = [100000, 200000, 300000];
    const out = largestRemainderAllocate(60000, weights);
    expect(sum(out)).toBe(60000);
    expect(out[2]).toBeGreaterThan(out[1]);
    expect(out[1]).toBeGreaterThan(out[0]);
  });

  it('returns zeros for a zero target or zero base', () => {
    expect(largestRemainderAllocate(0, [100, 200])).toEqual([0, 0]);
    expect(largestRemainderAllocate(500, [0, 0])).toEqual([0, 0]);
  });

  it('caps at the base rather than over-allocating', () => {
    const out = largestRemainderAllocate(999999, [100000, 50000]);
    expect(sum(out)).toBe(150000);
    expect(out).toEqual([100000, 50000]);
  });
});

describe('refundMath — computeLineDiscountAllocations scopes (INV-C1, INV-C3)', () => {
  const merch = (key, productId, amountCentavos) => ({ key, productId, quantity: 1, amountCentavos });
  const pass = (key, passEventId, amountCentavos) => ({ key, passEventId, quantity: 1, amountCentavos });

  it('ORDER scope spreads across every eligible line and sums exactly', () => {
    const { merchandiseAllocations, passAllocations, capped } = computeLineDiscountAllocations({
      merchandiseLines: [merch('a', 'p1', 100000), merch('b', 'p2', 100000)],
      passLines: [],
      discountAmount: 300,
      promoCode: { scope: 'ORDER', discountType: 'PERCENTAGE' },
    });
    expect(capped).toBe(false);
    expect(sum(merchandiseAllocations)).toBe(30000);
    expect(passAllocations).toEqual([]);
  });

  it('PRODUCT scope allocates only to matching product lines', () => {
    const { merchandiseAllocations } = computeLineDiscountAllocations({
      merchandiseLines: [merch('a', 'p1', 100000), merch('b', 'p2', 100000)],
      passLines: [],
      discountAmount: 300,
      promoCode: { scope: 'PRODUCT', discountType: 'FIXED', products: [{ productId: 'p1' }] },
    });
    expect(merchandiseAllocations).toEqual([30000, 0]);
  });

  it('EVENT scope allocates only to matching Pass lines and leaves merchandise untouched', () => {
    const { merchandiseAllocations, passAllocations } = computeLineDiscountAllocations({
      merchandiseLines: [merch('a', 'p1', 100000)],
      passLines: [pass('pa', 'e1', 150000), pass('pb', 'e2', 150000)],
      discountAmount: 500,
      promoCode: { scope: 'EVENT', discountType: 'FIXED', passEvents: [{ passEventId: 'e1' }] },
    });
    expect(merchandiseAllocations).toEqual([0]);
    expect(passAllocations).toEqual([50000, 0]);
  });

  it('ORDER scope lets Pass lines share the base, shrinking the merchandise allocation', () => {
    const { merchandiseAllocations, passAllocations } = computeLineDiscountAllocations({
      merchandiseLines: [merch('a', 'p1', 100000)],
      passLines: [pass('pa', 'e1', 100000)],
      discountAmount: 200,
      promoCode: { scope: 'ORDER', discountType: 'PERCENTAGE' },
    });
    // Half the discount belongs to the Pass line, so merchandise bears only 100.00
    expect(merchandiseAllocations).toEqual([10000]);
    expect(passAllocations).toEqual([10000]);
    expect(sum([...merchandiseAllocations, ...passAllocations])).toBe(20000);
  });

  it('FREE_SHIPPING and zero discounts allocate nothing to any line', () => {
    const lines = { merchandiseLines: [merch('a', 'p1', 100000)], passLines: [] };
    expect(computeLineDiscountAllocations({ ...lines, discountAmount: 150, promoCode: { discountType: 'FREE_SHIPPING', scope: 'ORDER' } }).merchandiseAllocations).toEqual([0]);
    expect(computeLineDiscountAllocations({ ...lines, discountAmount: 0, promoCode: { scope: 'ORDER', discountType: 'PERCENTAGE' } }).merchandiseAllocations).toEqual([0]);
  });

  it('falls back to ORDER scope when the promoCode row is missing but a discount exists', () => {
    const { merchandiseAllocations } = computeLineDiscountAllocations({
      merchandiseLines: [merch('a', 'p1', 100000), merch('b', 'p2', 100000)],
      passLines: [],
      discountAmount: 200,
      promoCode: null,
    });
    expect(sum(merchandiseAllocations)).toBe(20000);
  });

  it('property: allocations sum exactly to the discount and never exceed a line, over random baskets', () => {
    for (let iteration = 0; iteration < 500; iteration++) {
      const lineCount = 1 + Math.floor(Math.random() * 5);
      const merchandiseLines = Array.from({ length: lineCount }, (_, i) => merch(`m${i}`, `p${i}`, 1 + Math.floor(Math.random() * 500000)));
      const base = sum(merchandiseLines.map((line) => line.amountCentavos));
      const discountCentavos = Math.floor(Math.random() * (base + 1));
      const { merchandiseAllocations, capped } = computeLineDiscountAllocations({
        merchandiseLines,
        passLines: [],
        discountAmount: discountCentavos / 100,
        promoCode: { scope: 'ORDER', discountType: 'PERCENTAGE' },
      });
      expect(capped).toBe(false);
      expect(sum(merchandiseAllocations)).toBe(discountCentavos);
      merchandiseAllocations.forEach((value, i) => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(merchandiseLines[i].amountCentavos);
      });
    }
  });
});

describe('refundMath — attributableMerchandisePaid (INV-C5)', () => {
  const merch = (key, productId, amountCentavos) => ({ key, productId, quantity: 1, amountCentavos });

  it('equals the line total when there is no discount', () => {
    expect(attributableMerchandisePaid({ merchandiseLines: [merch('a', 'p1', 100000), merch('b', 'p2', 50000)], discountAmount: 0, promoCode: null }))
      .toBe(150000);
  });

  it('subtracts only the merchandise share of an ORDER discount', () => {
    const merchandiseLines = [merch('a', 'p1', 100000)];
    const passLines = [{ key: 'pa', passEventId: 'e1', quantity: 1, amountCentavos: 100000 }];
    const paid = attributableMerchandisePaid({
      merchandiseLines, passLines, discountAmount: 200,
      promoCode: { scope: 'ORDER', discountType: 'PERCENTAGE' },
    });
    expect(paid).toBe(90000); // 1000.00 - its 100.00 share (Pass took the other half)
  });

  it('ignores non-matching lines under PRODUCT scope', () => {
    expect(attributableMerchandisePaid({
      merchandiseLines: [merch('a', 'p1', 100000), merch('b', 'p2', 100000)],
      discountAmount: 300,
      promoCode: { scope: 'PRODUCT', discountType: 'FIXED', products: [{ productId: 'p1' }] },
    })).toBe(170000);
  });
});

describe('refundMath — attributableReturnAmount rounding and ceilings (INV-C4, INV-C5)', () => {
  const line = (key, price, quantity, productId = 'p1') => ({
    key, productId, quantity, amountCentavos: toCentavos(price * quantity),
  });

  it('returns the exact line amount for a full-quantity return', () => {
    expect(attributableReturnAmount({
      merchandiseLines: [line('a', 1000, 3)],
      returnItems: [{ orderItemId: 'a', quantity: 3 }],
    })).toBe(300000);
  });

  it('floors a partial-quantity return to centavos', () => {
    const merchandiseLines = [line('a', 1000, 3)];
    expect(attributableReturnAmount({ merchandiseLines, returnItems: [{ orderItemId: 'a', quantity: 2 }] })).toBe(200000);
    expect(attributableReturnAmount({ merchandiseLines, returnItems: [{ orderItemId: 'a', quantity: 1 }] })).toBe(100000);
  });

  it('never lets repeated partial returns of one line exceed its attributable amount', () => {
    const merchandiseLines = [line('a', 333.33, 3)]; // 999.99 total, not evenly divisible
    const one = attributableReturnAmount({ merchandiseLines, returnItems: [{ orderItemId: 'a', quantity: 1 }] });
    expect(one).toBe(33333);
    expect(one * 3).toBe(99999);
    expect(one * 3).toBeLessThanOrEqual(merchandiseLines[0].amountCentavos);
  });

  it('floors partial returns of a discounted line without exceeding its attributable amount', () => {
    const merchandiseLines = [line('a', 1000, 3)];
    const promoCode = { scope: 'ORDER', discountType: 'PERCENTAGE' };
    const alloc = computeLineDiscountAllocations({ merchandiseLines, promoCode, discountAmount: 300 });
    const lineAttributable = merchandiseLines[0].amountCentavos - alloc.merchandiseAllocations[0];
    expect(lineAttributable).toBe(270000); // 3000.00 - 300.00

    const two = attributableReturnAmount({ merchandiseLines, discountAmount: 300, promoCode, returnItems: [{ orderItemId: 'a', quantity: 2 }] });
    const one = attributableReturnAmount({ merchandiseLines, discountAmount: 300, promoCode, returnItems: [{ orderItemId: 'a', quantity: 1 }] });
    expect(two).toBe(180000);
    expect(one).toBe(90000);
    expect(two + one).toBe(270000);
  });

  it('sums multiple returned lines', () => {
    const merchandiseLines = [line('a', 1000, 2, 'p1'), line('b', 500, 4, 'p2')];
    expect(attributableReturnAmount({
      merchandiseLines,
      returnItems: [{ orderItemId: 'a', quantity: 2 }, { orderItemId: 'b', quantity: 3 }],
    })).toBe(200000 + 150000);
  });

  it('throws on an unknown order item or an out-of-range quantity', () => {
    const merchandiseLines = [line('a', 1000, 3)];
    expect(() => attributableReturnAmount({ merchandiseLines, returnItems: [{ orderItemId: 'zzz', quantity: 1 }] })).toThrow(/unknown order item/);
    expect(() => attributableReturnAmount({ merchandiseLines, returnItems: [{ orderItemId: 'a', quantity: 4 }] })).toThrow(/invalid/);
    expect(() => attributableReturnAmount({ merchandiseLines, returnItems: [{ orderItemId: 'a', quantity: 0 }] })).toThrow(/invalid/);
  });
});

describe('refundMath — returnRefundCeilingCentavos (shared return-refund ceiling)', () => {
  const line = (key, price, quantity, productId = 'p1') => ({
    key, productId, quantity, amountCentavos: toCentavos(price * quantity),
  });

  it('bounds by the return’s own attributable value when that is the tighter term', () => {
    // Line 500 × 2 = 1000; a partial return of one unit → 500 (its own value).
    const merchandiseLines = [line('a', 500, 2)];
    expect(returnRefundCeilingCentavos({ merchandiseLines, returnItems: [{ orderItemId: 'a', quantity: 1 }] })).toBe(50000);
  });

  it('tightens to the order-wide remaining after committed return refunds', () => {
    // Full-line return (1000) but 700 already committed → only 300 remains.
    const merchandiseLines = [line('a', 500, 2)];
    expect(returnRefundCeilingCentavos({
      merchandiseLines, returnItems: [{ orderItemId: 'a', quantity: 2 }], committedReturnCentavos: 70000,
    })).toBe(30000);
  });

  it('never goes negative when committed refunds exceed the attributable balance', () => {
    const merchandiseLines = [line('a', 500, 2)];
    expect(returnRefundCeilingCentavos({
      merchandiseLines, returnItems: [{ orderItemId: 'a', quantity: 2 }], committedReturnCentavos: 150000,
    })).toBe(0);
  });

  it('is promo-aware — an order discount lowers the ceiling', () => {
    const merchandiseLines = [line('a', 1000, 1)];
    expect(returnRefundCeilingCentavos({
      merchandiseLines,
      discountAmount: 300,
      promoCode: { scope: 'ORDER', discountType: 'PERCENTAGE' },
      returnItems: [{ orderItemId: 'a', quantity: 1 }],
    })).toBe(70000);
  });

  it('throws on an unresolvable return item (caller normalizes to a conflict)', () => {
    const merchandiseLines = [line('a', 500, 2)];
    expect(() => returnRefundCeilingCentavos({ merchandiseLines, returnItems: [{ orderItemId: 'zzz', quantity: 1 }] }))
      .toThrow(/unknown order item/);
  });
});
