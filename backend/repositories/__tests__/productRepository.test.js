import { describe, it, expect } from 'vitest';
import {
  generateSlug,
  calculateTotalStock,
  effectivePrice,
  discountPercentage,
  withVirtuals,
  InsufficientStockError,
  StockAdjustmentError,
  decrementStock,
  restoreStock,
  parseSort,
  buildListingWhere,
} from '../productRepository.js';

describe('generateSlug', () => {
  it('matches productSchema.pre(\'validate\')\'s exact transformation', () => {
    expect(generateSlug('Gilas Pilipinas T-Shirt')).toBe('gilas-pilipinas-t-shirt');
  });

  it('strips leading/trailing dashes produced by non-alphanumeric edges', () => {
    expect(generateSlug('  Ateneo Blue Eagles! ')).toBe('ateneo-blue-eagles');
  });

  it('collapses runs of non-alphanumeric characters into a single dash', () => {
    expect(generateSlug('PBA -- Season 2026!!')).toBe('pba-season-2026');
  });
});

describe('calculateTotalStock', () => {
  it('matches productSchema.pre(\'save\')\'s exact sum of sizes + colors.sizes', () => {
    const sizes = [{ size: 'M', stock: 10 }, { size: 'L', stock: 5 }];
    const colors = [
      { color: 'Navy', sizes: [{ size: 'M', stock: 3 }, { size: 'L', stock: 2 }] },
      { color: 'White', sizes: [{ size: 'M', stock: 1 }] },
    ];
    expect(calculateTotalStock(sizes, colors)).toBe(10 + 5 + 3 + 2 + 1);
  });

  it('returns 0 for a product with no sizes or colors', () => {
    expect(calculateTotalStock([], [])).toBe(0);
    expect(calculateTotalStock()).toBe(0);
  });

  it('handles sizes-only products (no color variants)', () => {
    expect(calculateTotalStock([{ size: 'One Size', stock: 25 }], [])).toBe(25);
  });
});

describe('effectivePrice / discountPercentage (virtual replacements)', () => {
  it('returns salePrice when present, matching the Mongoose virtual', () => {
    expect(effectivePrice({ price: 1000, salePrice: 800 })).toBe(800);
  });

  it('falls back to price when there is no salePrice', () => {
    expect(effectivePrice({ price: 1000, salePrice: null })).toBe(1000);
  });

  it('computes the same rounded percentage the Mongoose virtual computed', () => {
    expect(discountPercentage({ price: 1000, salePrice: 800 })).toBe(20);
  });

  it('returns 0 when salePrice is not actually lower than price', () => {
    expect(discountPercentage({ price: 1000, salePrice: 1000 })).toBe(0);
    expect(discountPercentage({ price: 1000, salePrice: null })).toBe(0);
  });

  it('withVirtuals adds both, matching toJSON({ virtuals: true })', () => {
    const result = withVirtuals({ _id: 'p1', price: 1000, salePrice: 750 });
    expect(result.effectivePrice).toBe(750);
    expect(result.discountPercentage).toBe(25);
  });

  it('withVirtuals passes through null/undefined unchanged', () => {
    expect(withVirtuals(null)).toBe(null);
    expect(withVirtuals(undefined)).toBe(undefined);
  });
});

describe('decrementStock / restoreStock — transaction-client requirement', () => {
  it('throws StockAdjustmentError if called without a transaction client', async () => {
    await expect(
      decrementStock({ productId: 'p1', size: 'M', quantity: 1 }, {})
    ).rejects.toThrow(StockAdjustmentError);
  });

  it('restoreStock also requires a transaction client', async () => {
    await expect(
      restoreStock({ productId: 'p1', size: 'M', quantity: 1 }, {})
    ).rejects.toThrow(StockAdjustmentError);
  });

  it('InsufficientStockError carries the productId/size/color that failed', () => {
    const err = new InsufficientStockError({ productId: 'p1', size: 'M', color: 'Navy' });
    expect(err.productId).toBe('p1');
    expect(err.size).toBe('M');
    expect(err.color).toBe('Navy');
    expect(err.name).toBe('InsufficientStockError');
  });
});

// A non-integer or non-positive quantity must never reach the conditional
// UPDATE inside decrementStock/restoreStock — `stock: { gte: quantity }`
// is only a valid guard when quantity is a positive integer, since stock
// is always >= 0. This is checked with a client object present (`{}`,
// since the guard must throw before ever touching it), so a passing test
// proves the quantity check itself, independent of the transaction-client
// requirement above and of whatever the API boundary (routes/orders.js)
// also validates.
describe('decrementStock / restoreStock — quantity validation (defense in depth)', () => {
  const baseArgs = { productId: 'p1', size: 'M' };
  const untouchedClient = {};

  it.each([-1, -1000, 0, 1.5, -0.5, NaN, Infinity, -Infinity, '3', null, undefined])(
    'decrementStock rejects invalid quantity %p regardless of caller',
    async (quantity) => {
      await expect(
        decrementStock({ ...baseArgs, quantity }, { client: untouchedClient })
      ).rejects.toThrow(StockAdjustmentError);
    }
  );

  it.each([-1, -1000, 0, 1.5, -0.5, NaN, Infinity, -Infinity, '3', null, undefined])(
    'restoreStock rejects invalid quantity %p regardless of caller',
    async (quantity) => {
      await expect(
        restoreStock({ ...baseArgs, quantity }, { client: untouchedClient })
      ).rejects.toThrow(StockAdjustmentError);
    }
  );

  it('decrementStock still accepts a valid positive integer quantity — the guard does not block legitimate calls', async () => {
    const stubClient = {
      productSize: { updateMany: async () => ({ count: 1 }) },
      product: { update: async () => ({}) },
    };
    await expect(
      decrementStock({ ...baseArgs, quantity: 1 }, { client: stubClient })
    ).resolves.toBeUndefined();
  });

  it('restoreStock still accepts a valid positive integer quantity — the guard does not block legitimate calls', async () => {
    const stubClient = {
      productSize: { updateMany: async () => ({ count: 1 }) },
      product: { update: async () => ({}) },
    };
    await expect(
      restoreStock({ ...baseArgs, quantity: 3 }, { client: stubClient })
    ).resolves.toBeUndefined();
  });
});

describe('parseSort', () => {
  it('parses a leading-dash Mongoose-style token as descending', () => {
    expect(parseSort('-totalSold')).toEqual({ field: 'totalSold', direction: 'desc' });
  });

  it('parses a bare field name as ascending', () => {
    expect(parseSort('name')).toEqual({ field: 'name', direction: 'asc' });
  });

  it('falls back to -createdAt for an unrecognized field — the whitelist that closes the raw-SQL injection gap search() would otherwise open', () => {
    expect(parseSort('-password')).toEqual({ field: 'createdAt', direction: 'desc' });
    expect(parseSort('"; DROP TABLE products; --')).toEqual({ field: 'createdAt', direction: 'desc' });
  });

  it('defaults to -createdAt when no sort is given', () => {
    expect(parseSort()).toEqual({ field: 'createdAt', direction: 'desc' });
  });
});

describe('buildListingWhere', () => {
  it('returns just the active filter when no other filters are given', () => {
    expect(buildListingWhere({ active: true })).toEqual({ active: true });
  });

  it('sport filter also matches products tagged "general" (available regardless of sport)', () => {
    const where = buildListingWhere({ active: true, sport: 'basketball' });
    expect(where.AND).toContainEqual({ OR: [{ sport: { in: ['basketball'] } }, { sport: 'general' }] });
  });

  it('gender filter also matches products tagged "unisex"', () => {
    const where = buildListingWhere({ active: true, gender: 'men' });
    expect(where.AND).toContainEqual({ OR: [{ gender: { in: ['men'] } }, { gender: 'unisex' }] });
  });

  it('splits and lowercases comma-separated multi-value filters', () => {
    const where = buildListingWhere({ active: true, category: 'Jersey, TSHIRT' });
    expect(where.category).toEqual({ in: ['jersey', 'tshirt'] });
  });

  it('price range matches salePrice when set, else falls back to price', () => {
    const where = buildListingWhere({ active: true, minPrice: '500', maxPrice: '1000' });
    expect(where.AND).toContainEqual({
      OR: [
        { salePrice: { gte: 500, lte: 1000 } },
        { AND: [{ salePrice: null }, { price: { gte: 500, lte: 1000 } }] },
      ],
    });
  });

  it('team/league match case-insensitively', () => {
    const where = buildListingWhere({ active: true, team: 'Ateneo' });
    expect(where.team).toEqual({ equals: 'Ateneo', mode: 'insensitive' });
  });

  it('sale=true filters to products with a positive salePrice', () => {
    expect(buildListingWhere({ active: true, sale: 'true' }).salePrice).toEqual({ gt: 0 });
  });

  it('featured is set whenever the query param is present, even "false" — matches the original truthy-string quirk', () => {
    expect(buildListingWhere({ active: true, featured: 'true' }).featured).toBe(true);
    expect(buildListingWhere({ active: true, featured: 'false' }).featured).toBe(false);
    expect(buildListingWhere({ active: true }).featured).toBeUndefined();
  });
});
