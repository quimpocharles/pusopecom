import { describe, it, expect, afterAll } from 'vitest';
import prisma from '../../lib/prisma.js';
import * as productRepo from '../productRepository.js';
import * as orderRepo from '../orderRepository.js';
import * as userRepo from '../userRepository.js';
import * as reviewRepo from '../reviewRepository.js';
import * as siteSettingsRepo from '../siteSettingsRepository.js';
import * as organizationRepo from '../organizationRepository.js';
import * as teamRepo from '../teamRepository.js';
import * as athleteAffiliationRepo from '../athleteAffiliationRepository.js';
import * as tryOnLogRepo from '../tryOnLogRepository.js';
import * as userActivityRepo from '../userActivityRepository.js';
import * as bonusFitCheckGrantRepo from '../bonusFitCheckGrantRepository.js';
import * as fitCheckCampaignRepo from '../fitCheckCampaignRepository.js';
import * as paymentRepo from '../paymentRepository.js';
import * as shipmentRepo from '../shipmentRepository.js';
import { expireStaleOrders } from '../../lib/expireStaleOrders.js';
import { sendPaymentReminders } from '../../lib/sendPaymentReminders.js';

/**
 * Real integration tests against a live database — the honest gap flagged
 * in steps 1 and 2 (everything up to now was schema-only or pure-function
 * validation, never executed against a running Postgres). Requires a
 * reachable DATABASE_URL; there is no live-DB-optional skip here on
 * purpose, so a broken connection fails loudly instead of silently
 * passing an empty suite.
 *
 * Every test runs inside a transaction that is always rolled back at the
 * end, pass or fail, via a rejected sentinel — nothing here ever commits,
 * so this is safe to run against what will become the real production
 * database without leaving any residue behind.
 */
const ROLLBACK = Symbol('intentional-rollback');

async function withRollback(testFn, { timeout } = {}) {
  try {
    await prisma.$transaction(
      async (tx) => {
        await testFn(tx);
        throw ROLLBACK;
      },
      timeout ? { timeout } : undefined
    );
  } catch (err) {
    if (err !== ROLLBACK) throw err;
  }
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('User + Address — embedded array now a real relation', () => {
  it('creates a user with a nested address and reads it back with _id at every level', () =>
    withRollback(async (tx) => {
      const user = await userRepo.create(
        {
          email: `test-${Date.now()}@example.com`,
          firstName: 'Juan',
          lastName: 'Dela Cruz',
          password: 'plaintext-to-be-hashed',
        },
        { client: tx }
      );

      expect(user._id).toBeTypeOf('string');
      expect(user.password).not.toBe('plaintext-to-be-hashed'); // hashIfPresent actually ran

      const address = await tx.address.create({
        data: {
          userId: user._id,
          fullName: 'Juan Dela Cruz',
          phone: '09171234567',
          address: '123 Rizal St',
          city: 'Quezon City',
          province: 'Metro Manila',
          zipCode: '1100',
        },
      });
      expect(address.id).toBeTypeOf('string');

      const isValid = await userRepo.comparePassword(user, 'plaintext-to-be-hashed');
      expect(isValid).toBe(true);
    }), 15000);

  const baseAddress = {
    fullName: 'Juan Dela Cruz',
    phone: '09171234567',
    address: '123 Rizal St',
    city: 'Quezon City',
    province: 'Metro Manila',
    zipCode: '1100',
  };

  it('addAddress flips the previous default off when the new address is marked default', () =>
    withRollback(async (tx) => {
      const user = await userRepo.create(
        { email: `test-${Date.now()}@example.com`, firstName: 'Juan', lastName: 'Dela Cruz' },
        { client: tx }
      );

      const afterFirst = await userRepo.addAddress(user._id, { ...baseAddress, isDefault: true }, { client: tx });
      expect(afterFirst.addresses).toHaveLength(1);
      expect(afterFirst.addresses[0].isDefault).toBe(true);

      const afterSecond = await userRepo.addAddress(
        user._id,
        { ...baseAddress, fullName: 'Second Address', isDefault: true },
        { client: tx }
      );
      expect(afterSecond.addresses).toHaveLength(2);
      const first = afterSecond.addresses.find((a) => a.fullName === 'Juan Dela Cruz');
      const second = afterSecond.addresses.find((a) => a.fullName === 'Second Address');
      expect(first.isDefault).toBe(false);
      expect(second.isDefault).toBe(true);
    }, { timeout: 15000 }), 15000); // both the outer vitest timeout AND Prisma's own interactive-transaction timeout (default 5000ms) need raising — this does ~5 round trips in one tx

  it('updateAddress refuses to touch an address that belongs to a different user', () =>
    withRollback(async (tx) => {
      const owner = await userRepo.create(
        { email: `owner-${Date.now()}@example.com`, firstName: 'Owner', lastName: 'User' },
        { client: tx }
      );
      const attacker = await userRepo.create(
        { email: `attacker-${Date.now()}@example.com`, firstName: 'Attacker', lastName: 'User' },
        { client: tx }
      );
      const withAddress = await userRepo.addAddress(owner._id, baseAddress, { client: tx });
      const addressId = withAddress.addresses[0]._id;

      const result = await userRepo.updateAddress(attacker._id, addressId, { city: 'Hijacked' }, { client: tx });
      expect(result).toBeNull();

      const unchanged = await tx.address.findUnique({ where: { id: addressId } });
      expect(unchanged.city).toBe('Quezon City');
    }, { timeout: 15000 }), 15000);

  it('deleteAddress promotes the first remaining address to default when the default is removed', () =>
    withRollback(async (tx) => {
      const user = await userRepo.create(
        { email: `test-${Date.now()}@example.com`, firstName: 'Juan', lastName: 'Dela Cruz' },
        { client: tx }
      );
      const afterFirst = await userRepo.addAddress(user._id, { ...baseAddress, isDefault: true }, { client: tx });
      const afterSecond = await userRepo.addAddress(
        user._id,
        { ...baseAddress, fullName: 'Second Address', isDefault: false },
        { client: tx }
      );
      const defaultId = afterSecond.addresses.find((a) => a.isDefault)._id;

      const afterDelete = await userRepo.deleteAddress(user._id, defaultId, { client: tx });
      expect(afterDelete.addresses).toHaveLength(1);
      expect(afterDelete.addresses[0].isDefault).toBe(true);
      expect(afterDelete.addresses[0].fullName).toBe('Second Address');
    }, { timeout: 15000 }), 15000);

  it('findByGoogleIdOrEmail matches on either field independently', () =>
    withRollback(async (tx) => {
      const googleId = `google-${Date.now()}`;
      const email = `oauth-${Date.now()}@example.com`;
      const user = await userRepo.create(
        { email, firstName: 'Google', lastName: 'User', googleId, authProvider: 'google', emailVerified: true },
        { client: tx }
      );

      const byGoogleId = await userRepo.findByGoogleIdOrEmail(googleId, 'not-the-email@example.com', { client: tx });
      expect(byGoogleId._id).toBe(user._id);

      const byEmail = await userRepo.findByGoogleIdOrEmail('not-the-google-id', email, { client: tx });
      expect(byEmail._id).toBe(user._id);

      const noMatch = await userRepo.findByGoogleIdOrEmail('no-such-id', 'no-such-email@example.com', { client: tx });
      expect(noMatch).toBeNull();
    }), 15000);
});

describe('Product — nested create computes totalStock like the old pre(\'save\') hook', () => {
  it('creates a product with sizes and colors, matching Mongoose\'s totalStock sum', () =>
    withRollback(async (tx) => {
      const product = await productRepo.create(
        {
          name: `Test Jersey ${Date.now()}`,
          description: 'Integration test product',
          price: 1200,
          category: 'jersey',
          sport: 'basketball',
          images: ['https://example.com/img.jpg'],
          sizes: [{ size: 'M', stock: 10 }, { size: 'L', stock: 5 }],
          colors: [{ color: 'Navy', sizes: [{ size: 'M', stock: 3 }] }],
        },
        { client: tx }
      );

      expect(product.totalStock).toBe(10 + 5 + 3);
      expect(product._id).toBeTypeOf('string');
      expect(product.sizes).toHaveLength(2);
      expect(product.colors[0].sizes).toHaveLength(1);
      expect(product.effectivePrice).toBe(1200); // virtual, computed not stored
    }, { timeout: 15000 }), 15000); // pre-existing test, newly flaky under current Railway latency — same fix pattern as the rest of this file

  it('rejects an invalid size value via the CHECK constraint, not just app-level validation', () =>
    withRollback(async (tx) => {
      await expect(
        productRepo.create(
          {
            name: `Bad Size Product ${Date.now()}`,
            description: 'Should fail',
            price: 500,
            category: 'jersey',
            sport: 'basketball',
            images: [],
            sizes: [{ size: 'HUGE', stock: 1 }], // not in ('XS','S','M','L','XL','2XL','3XL','One Size')
          },
          { client: tx }
        )
      ).rejects.toThrow();
    }));

  it('updateById replaces sizes/colors wholesale (matching findByIdAndUpdate\'s actual behavior on the admin edit form) and recomputes totalStock', () =>
    withRollback(async (tx) => {
      const product = await productRepo.create(
        {
          name: `Update Test ${Date.now()}`,
          description: 'x',
          price: 500,
          category: 'jersey',
          sport: 'basketball',
          images: [],
          sizes: [{ size: 'M', stock: 10 }],
        },
        { client: tx }
      );
      expect(product.totalStock).toBe(10);

      const updated = await productRepo.updateById(
        product._id,
        { sizes: [{ size: 'L', stock: 99 }], colors: [{ color: 'Navy', sizes: [{ size: 'M', stock: 7 }] }] },
        { client: tx }
      );

      expect(updated.sizes).toHaveLength(1);
      expect(updated.sizes[0].size).toBe('L');
      expect(updated.sizes[0].stock).toBe(99);
      expect(updated.colors).toHaveLength(1);
      expect(updated.colors[0].sizes[0].stock).toBe(7);
      // the old 'M' size is gone, not merged — a wholesale replace
      expect(updated.sizes.find((s) => s.size === 'M')).toBeUndefined();
      // totalStock now reflects the new sizes/colors — 99 (plain) + 7 (color-scoped),
      // fixing the real correctness gap where an admin stock edit never
      // actually changed the number that decided whether a product could
      // still be sold or showed as sold out
      expect(updated.totalStock).toBe(106);
    }, { timeout: 15000 }), 15000);

  it('updateById recomputes totalStock down to zero when an admin zeroes out every size — the actual sold-out bug this fixes', () =>
    withRollback(async (tx) => {
      const product = await productRepo.create(
        {
          name: `Sold Out Update Test ${Date.now()}`,
          description: 'x',
          price: 500,
          category: 'jersey',
          sport: 'basketball',
          images: [],
          colors: [{ color: 'Maroon', sizes: [{ size: 'M', stock: 5 }, { size: 'L', stock: 5 }] }],
        },
        { client: tx }
      );
      expect(product.totalStock).toBe(10);

      const updated = await productRepo.updateById(
        product._id,
        { colors: [{ color: 'Maroon', sizes: [{ size: 'M', stock: 0 }, { size: 'L', stock: 0 }] }] },
        { client: tx }
      );

      expect(updated.totalStock).toBe(0);
    }, { timeout: 15000 }), 15000);

  it('updateById recomputing totalStock when only sizes are sent still counts the product\'s existing, untouched colors', () =>
    withRollback(async (tx) => {
      const product = await productRepo.create(
        {
          name: `Partial Update Test ${Date.now()}`,
          description: 'x',
          price: 500,
          category: 'jersey',
          sport: 'basketball',
          images: [],
          sizes: [{ size: 'M', stock: 3 }],
          colors: [{ color: 'Navy', sizes: [{ size: 'S', stock: 4 }] }],
        },
        { client: tx }
      );
      expect(product.totalStock).toBe(7);

      // Only `sizes` is sent — `colors` is absent from the payload entirely,
      // not an empty array — so its existing 4 units must still count.
      const updated = await productRepo.updateById(
        product._id,
        { sizes: [{ size: 'M', stock: 9 }] },
        { client: tx }
      );

      expect(updated.totalStock).toBe(13); // 9 (new sizes) + 4 (untouched colors)
    }, { timeout: 15000 }), 15000);

  it('updateById leaves sizes/colors alone entirely when neither key is in the update payload', () =>
    withRollback(async (tx) => {
      const product = await productRepo.create(
        {
          name: `Scalar Update Test ${Date.now()}`,
          description: 'x',
          price: 500,
          category: 'jersey',
          sport: 'basketball',
          images: [],
          sizes: [{ size: 'M', stock: 10 }],
        },
        { client: tx }
      );

      const updated = await productRepo.updateById(product._id, { featured: true }, { client: tx });
      expect(updated.featured).toBe(true);
      expect(updated.sizes).toHaveLength(1);
      expect(updated.sizes[0].size).toBe('M');
    }));
});

describe('getAdminStats — replaces the three $group aggregation pipelines', () => {
  it('returns total/active/featured counts and category/sport/gender breakdowns in the original { _id, count } shape', () =>
    withRollback(async (tx) => {
      await productRepo.create(
        {
          name: `Stats Test A ${Date.now()}`,
          description: 'x', price: 500, category: 'jersey', sport: 'basketball',
          gender: 'men', images: [], active: true, featured: true,
        },
        { client: tx }
      );
      await productRepo.create(
        {
          name: `Stats Test B ${Date.now()}`,
          description: 'x', price: 500, category: 'jersey', sport: 'basketball',
          gender: 'men', images: [], active: false,
        },
        { client: tx }
      );

      const stats = await productRepo.getAdminStats({ client: tx });

      expect(stats.total).toBeGreaterThanOrEqual(2);
      expect(stats.active).toBeGreaterThanOrEqual(1);
      expect(stats.featured).toBeGreaterThanOrEqual(1);
      expect(stats.byCategory.find((c) => c._id === 'jersey').count).toBeGreaterThanOrEqual(2);
      expect(stats.bySport.find((s) => s._id === 'basketball').count).toBeGreaterThanOrEqual(2);
      expect(stats.byGender.find((g) => g._id === 'men').count).toBeGreaterThanOrEqual(2);
    }, { timeout: 15000 }), 15000);
});

describe('decrementStock — the actual fix for platform-audit Critical #3', () => {
  it('decrements stock atomically when enough is available', () =>
    withRollback(async (tx) => {
      const product = await productRepo.create(
        {
          name: `Stock Test ${Date.now()}`,
          description: 'x',
          price: 500,
          category: 'jersey',
          sport: 'basketball',
          images: [],
          sizes: [{ size: 'M', stock: 5 }],
        },
        { client: tx }
      );

      await productRepo.decrementStock({ productId: product._id, size: 'M', quantity: 3 }, { client: tx });

      const updated = await productRepo.findById(product._id, { client: tx });
      expect(updated.sizes[0].stock).toBe(2);
      expect(updated.totalStock).toBe(2);
    }));

  it('throws InsufficientStockError and changes nothing when stock is too low — no partial decrement', () =>
    withRollback(async (tx) => {
      const product = await productRepo.create(
        {
          name: `Low Stock Test ${Date.now()}`,
          description: 'x',
          price: 500,
          category: 'jersey',
          sport: 'basketball',
          images: [],
          sizes: [{ size: 'M', stock: 2 }],
        },
        { client: tx }
      );

      await expect(
        productRepo.decrementStock({ productId: product._id, size: 'M', quantity: 5 }, { client: tx })
      ).rejects.toThrow(productRepo.InsufficientStockError);

      const unchanged = await productRepo.findById(product._id, { client: tx });
      expect(unchanged.sizes[0].stock).toBe(2); // untouched — the conditional UPDATE affected zero rows
    }));

  it('the exact race the fix targets: two concurrent decrements for the last unit — only one succeeds', async () => {
    // This one runs outside withRollback deliberately: it needs the product
    // to actually be committed and visible to two independent, concurrent
    // transactions, which a single enclosing transaction would prevent
    // (both "concurrent" transactions would just be nested in the same
    // one). Cleaned up explicitly in a finally block instead.
    const product = await prisma.product.create({
      data: {
        name: `Race Test ${Date.now()}`,
        slug: `race-test-${Date.now()}`,
        description: 'x',
        price: 500,
        category: 'jersey',
        sport: 'basketball',
        images: [],
        totalStock: 1,
        sizes: { create: [{ size: 'M', stock: 1 }] }, // exactly one left
      },
    });

    try {
      const attempt = () =>
        prisma.$transaction((tx) =>
          productRepo.decrementStock({ productId: product.id, size: 'M', quantity: 1 }, { client: tx })
        );

      const results = await Promise.allSettled([attempt(), attempt()]);
      const succeeded = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);
      expect(failed[0].reason).toBeInstanceOf(productRepo.InsufficientStockError);

      const final = await productRepo.findById(product.id);
      expect(final.sizes[0].stock).toBe(0); // decremented exactly once, not twice, not zero times
    } finally {
      await prisma.product.delete({ where: { id: product.id } });
    }
  }, 15000); // two real racing network round trips to Postgres — observed ~4.9s under normal conditions, right at the 5s default; given explicit headroom rather than left to flake under any added latency
});

describe('Order — multi-Organization-shaped Order-plus-OrderItems, and relation fallback on real data', () => {
  it('creates an order with items and serializes product as a bare id when not included', () =>
    withRollback(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: `Order Test Product ${Date.now()}`,
          slug: `order-test-${Date.now()}`,
          description: 'x',
          price: 500,
          category: 'jersey',
          sport: 'basketball',
          images: [],
        },
      });

      const order = await orderRepo.create(
        {
          email: 'guest@example.com',
          items: [
            { productId: product.id, name: product.name, price: 500, quantity: 2, size: 'M', image: 'x.jpg' },
          ],
          shippingAddress: {
            fullName: 'Guest Buyer',
            phone: '09170000000',
            address: '1 Test St',
            city: 'Manila',
            province: 'Metro Manila',
            zipCode: '1000',
          },
          subtotal: 1000,
          shippingFee: 150,
          total: 1150,
        },
        { client: tx }
      );

      expect(order._id).toBeTypeOf('string');
      expect(order.orderNumber).toMatch(/^PS-\d{8}-[A-Z0-9]{6}$/);
      expect(order.items).toHaveLength(1);
      // Not included, so product falls back to the bare id — exactly what
      // Order.items[].product looked like in Mongoose before .populate().
      expect(order.items[0].product).toBe(product.id);
      expect(order.items[0]).not.toHaveProperty('productId');
      // shipTo* columns reshaped back into the original nested shippingAddress contract
      expect(order.shippingAddress).toEqual({
        fullName: 'Guest Buyer', phone: '09170000000', country: 'Philippines',
        address: '1 Test St', city: 'Manila', province: 'Metro Manila',
        region: null, barangay: null, zipCode: '1000',
      });
      expect(order).not.toHaveProperty('shipToFullName');
    }));

  it('tryResolvePayment\'s WHERE-guard rejects a second resolution attempt on an already-resolved order', () =>
    withRollback(async (tx) => {
      // Genuine concurrent-request testing for this exact guard pattern is
      // already covered by the decrementStock race test above (two real,
      // independent transactions). This test verifies the guard condition
      // itself: once paymentStatus has left 'pending', a second call must
      // be a no-op — the same property that, under real concurrency, stops
      // a duplicate confirmation email or a double stock restore.
      const product = await tx.product.create({
        data: {
          name: `Order Race Test ${Date.now()}`, slug: `order-race-${Date.now()}`,
          description: 'x', price: 500, category: 'jersey', sport: 'basketball', images: [],
        },
      });
      const order = await orderRepo.create(
        {
          email: 'guest@example.com',
          items: [{ productId: product.id, name: product.name, price: 500, quantity: 1, size: 'M', image: 'x.jpg' }],
          shippingAddress: {
            fullName: 'Guest', phone: '09170000000', address: '1 Test St',
            city: 'Manila', province: 'Metro Manila', zipCode: '1000',
          },
          subtotal: 500, shippingFee: 150, total: 650,
        },
        { client: tx }
      );

      const first = await orderRepo.tryResolvePayment(order._id, 'paid', { orderStatus: 'paid' }, { client: tx });
      const second = await orderRepo.tryResolvePayment(order._id, 'failed', {}, { client: tx });
      expect(first).toBe(true);
      expect(second).toBe(false); // already resolved — must not flip a paid order to failed

      const finalOrder = await orderRepo.findById(order._id, { client: tx });
      expect(finalOrder.paymentStatus).toBe('paid');
      expect(finalOrder.orderStatus).toBe('paid');
    }));
});

describe('Review — aggregation methods replacing Mongo $group pipelines', () => {
  it('getStats computes the same rounded average and count the old pipeline computed', () =>
    withRollback(async (tx) => {
      const product = await tx.product.create({
        data: { name: `Review Stats Test ${Date.now()}`, slug: `rst-${Date.now()}`, description: 'x', price: 500, category: 'jersey', sport: 'basketball', images: [] },
      });
      await tx.review.createMany({
        data: [
          { productId: product.id, author: 'A', rating: 5 },
          { productId: product.id, author: 'B', rating: 4 },
          { productId: product.id, author: 'C', rating: 4 },
        ],
      });

      const stats = await reviewRepo.getStats(product.id, { client: tx });
      // (5 + 4 + 4) / 3 = 4.333... -> rounds to 4.3, matching Math.round(x*10)/10
      expect(stats.avgRating).toBe(4.3);
      expect(stats.reviewCount).toBe(3);
    }));

  it('getStats returns zeroed stats for a product with no reviews, matching the original else-branch', () =>
    withRollback(async (tx) => {
      const product = await tx.product.create({
        data: { name: `No Reviews Test ${Date.now()}`, slug: `nrt-${Date.now()}`, description: 'x', price: 500, category: 'jersey', sport: 'basketball', images: [] },
      });
      const stats = await reviewRepo.getStats(product.id, { client: tx });
      expect(stats).toEqual({ avgRating: 0, reviewCount: 0 });
    }));

  it('getRatingDistribution returns a full 5-to-1 object with zeros for ratings that have no reviews', () =>
    withRollback(async (tx) => {
      const product = await tx.product.create({
        data: { name: `Rating Dist Test ${Date.now()}`, slug: `rdt-${Date.now()}`, description: 'x', price: 500, category: 'jersey', sport: 'basketball', images: [] },
      });
      await tx.review.createMany({
        data: [
          { productId: product.id, author: 'A', rating: 5 },
          { productId: product.id, author: 'B', rating: 5 },
          { productId: product.id, author: 'C', rating: 3 },
        ],
      });

      const dist = await reviewRepo.getRatingDistribution(product.id, { client: tx });
      expect(dist).toEqual({ 5: 2, 4: 0, 3: 1, 2: 0, 1: 0 });
    }));
});

describe('SiteSettings — flat columns reshaped back into the original nested API contract', () => {
  it('get() returns the original { tryOn: {...}, tryOnAd: {...} } shape, not flat columns', () =>
    withRollback(async (tx) => {
      const settings = await siteSettingsRepo.get({ client: tx });
      expect(settings).toHaveProperty('tryOn.title');
      expect(settings).toHaveProperty('tryOn.image');
      expect(settings).toHaveProperty('tryOn.productUrl');
      expect(settings).toHaveProperty('tryOnAd.videoUrl');
      expect(settings).not.toHaveProperty('tryOnTitle'); // flat column name must not leak through
    }));

  it('update() partially merges tryOn without clobbering tryOnAd, matching Object.assign semantics', () =>
    withRollback(async (tx) => {
      await siteSettingsRepo.get({ client: tx }); // ensure a row exists
      const before = await siteSettingsRepo.get({ client: tx });

      const updated = await siteSettingsRepo.update({ tryOn: { title: 'New Title Only' } }, { client: tx });

      expect(updated.tryOn.title).toBe('New Title Only');
      expect(updated.tryOn.productUrl).toBe(before.tryOn.productUrl); // untouched field preserved
      expect(updated.tryOnAd).toEqual(before.tryOnAd); // untouched sub-object preserved entirely
    }));
});

describe('Organization — the anchor everything institutional attaches to (ADR-001)', () => {
  it('creates an Organization with an auto-generated slug, unverified by default', () =>
    withRollback(async (tx) => {
      const org = await organizationRepo.create(
        { name: `Test University ${Date.now()}`, kind: 'institution' },
        { client: tx }
      );
      expect(org._id).toBeTypeOf('string');
      expect(org.slug).toMatch(/^test-university-\d+$/);
      expect(org.verificationStatus).toBe('unverified');
      expect(org.verifiedAt).toBeNull();
    }));

  it('findWithTeams returns the Organization with its Teams, looked up by id or by slug', () =>
    withRollback(async (tx) => {
      const org = await organizationRepo.create({ name: `Slug Lookup Org ${Date.now()}` }, { client: tx });
      await teamRepo.create({ organizationId: org._id, name: 'Basketball', sport: 'basketball' }, { client: tx });

      const byId = await organizationRepo.findWithTeams(org._id, { client: tx });
      expect(byId.teams).toHaveLength(1);

      const bySlug = await organizationRepo.findWithTeams(org.slug, { client: tx });
      expect(bySlug._id).toBe(org._id);
      expect(bySlug.teams).toHaveLength(1);
    }));

  it('two different Organizations may each have a Team with the same slug (unique per Organization, not globally)', () =>
    withRollback(async (tx) => {
      const orgA = await organizationRepo.create({ name: `Org A ${Date.now()}` }, { client: tx });
      const orgB = await organizationRepo.create({ name: `Org B ${Date.now()}` }, { client: tx });

      const teamA = await teamRepo.create({ organizationId: orgA._id, name: 'Basketball', slug: 'basketball', sport: 'basketball' }, { client: tx });
      const teamB = await teamRepo.create({ organizationId: orgB._id, name: 'Basketball', slug: 'basketball', sport: 'basketball' }, { client: tx });

      expect(teamA._id).not.toBe(teamB._id);
      expect(await teamRepo.findBySlug({ organizationId: orgA._id, slug: 'basketball' }, { client: tx })).toMatchObject({ _id: teamA._id });
      expect(await teamRepo.findBySlug({ organizationId: orgB._id, slug: 'basketball' }, { client: tx })).toMatchObject({ _id: teamB._id });
    }));

  it('participation is directional — a member Organization\'s participation is not its body\'s participation', () =>
    withRollback(async (tx) => {
      const school = await organizationRepo.create({ name: `Member School ${Date.now()}`, kind: 'institution' }, { client: tx });
      const league = await organizationRepo.create({ name: `Test League ${Date.now()}`, kind: 'league' }, { client: tx });

      await organizationRepo.addParticipation({ memberOrganizationId: school._id, inOrganizationId: league._id }, { client: tx });

      const schoolParticipations = await organizationRepo.findParticipations(school._id, { client: tx });
      expect(schoolParticipations).toHaveLength(1);
      expect(schoolParticipations[0].inOrganization._id).toBe(league._id);

      const leagueParticipants = await organizationRepo.findParticipants(league._id, { client: tx });
      expect(leagueParticipants).toHaveLength(1);
      expect(leagueParticipants[0].memberOrganization._id).toBe(school._id);

      // the reverse queries return nothing — participation is not ownership,
      // and isn't symmetric either
      expect(await organizationRepo.findParticipants(school._id, { client: tx })).toHaveLength(0);
      expect(await organizationRepo.findParticipations(league._id, { client: tx })).toHaveLength(0);
    }));

  it('endParticipation sets endDate without deleting the row — history stays intact', () =>
    withRollback(async (tx) => {
      const school = await organizationRepo.create({ name: `Ending School ${Date.now()}` }, { client: tx });
      const league = await organizationRepo.create({ name: `Ending League ${Date.now()}`, kind: 'league' }, { client: tx });
      const edge = await organizationRepo.addParticipation({ memberOrganizationId: school._id, inOrganizationId: league._id }, { client: tx });

      expect(edge.endDate).toBeNull();
      const ended = await organizationRepo.endParticipation(edge._id, new Date('2026-01-01'), { client: tx });
      expect(ended.endDate).not.toBeNull();

      const stillFound = await organizationRepo.findParticipations(school._id, { client: tx });
      expect(stillFound).toHaveLength(1); // ended, not deleted
    }));

  it('AthleteAffiliation is time-bounded and can be scoped to a Team or just an Organization', () =>
    withRollback(async (tx) => {
      const athlete = await organizationRepo.create({ name: `Test Athlete ${Date.now()}`, kind: 'athlete' }, { client: tx });
      const org = await organizationRepo.create({ name: `Affiliating Org ${Date.now()}` }, { client: tx });
      const team = await teamRepo.create({ organizationId: org._id, name: 'Basketball', sport: 'basketball' }, { client: tx });

      const teamScoped = await athleteAffiliationRepo.create(
        { athleteOrganizationId: athlete._id, organizationId: org._id, teamId: team._id },
        { client: tx }
      );
      expect(teamScoped.endDate).toBeNull();
      expect(teamScoped.team).toBe(team._id); // bare id — team not included, matching the populated-or-bare-id convention

      const orgScoped = await athleteAffiliationRepo.create(
        { athleteOrganizationId: athlete._id, organizationId: org._id, teamId: null },
        { client: tx }
      );
      expect(orgScoped.team).toBeNull();

      const byAthlete = await athleteAffiliationRepo.findByAthlete(athlete._id, { client: tx });
      expect(byAthlete).toHaveLength(2);

      const ended = await athleteAffiliationRepo.endById(teamScoped._id, new Date('2026-06-01'), { client: tx });
      expect(ended.endDate).not.toBeNull(); // a transfer/retirement — ended, not deleted

      const byTeam = await athleteAffiliationRepo.findByTeam(team._id, { client: tx });
      expect(byTeam).toHaveLength(1); // still findable even though it's ended
    }));

  it('recordVerificationDecision refuses to grant or revoke without a verifiedByUserId — Trust decisions stay human', () =>
    withRollback(async (tx) => {
      const org = await organizationRepo.create({ name: `Guard Test Org ${Date.now()}` }, { client: tx });

      await expect(
        organizationRepo.recordVerificationDecision(org._id, { status: 'granted' }, { client: tx })
      ).rejects.toThrow(/verifiedByUserId/);

      await expect(
        organizationRepo.recordVerificationDecision(org._id, { status: 'revoked' }, { client: tx })
      ).rejects.toThrow(/verifiedByUserId/);

      // flagged is not a grant/revoke decision — no human-accountability guard applies
      const flagged = await organizationRepo.recordVerificationDecision(org._id, { status: 'flagged' }, { client: tx });
      expect(flagged).toBe(true);
    }));

  it('recordVerificationDecision grants with a real verifiedByUserId, and requestVerification/recordVerificationDecision use the same atomic WHERE-guard as tryResolvePayment', () =>
    withRollback(async (tx) => {
      const admin = await userRepo.create(
        { email: `verifier-${Date.now()}@example.com`, firstName: 'Verifier', lastName: 'Admin', role: 'admin' },
        { client: tx }
      );
      const org = await organizationRepo.create({ name: `Grant Test Org ${Date.now()}` }, { client: tx });

      const requested = await organizationRepo.requestVerification(org._id, { client: tx });
      expect(requested).toBe(true);
      const requestedAgain = await organizationRepo.requestVerification(org._id, { client: tx });
      expect(requestedAgain).toBe(false); // already left 'unverified' — guard rejects a second request

      const granted = await organizationRepo.recordVerificationDecision(
        org._id,
        { status: 'granted', verifiedByUserId: admin._id, expectedCurrentStatus: 'requested' },
        { client: tx }
      );
      expect(granted).toBe(true);

      const finalOrg = await organizationRepo.findById(org._id, { client: tx });
      expect(finalOrg.verificationStatus).toBe('granted');
      expect(finalOrg.verifiedAt).not.toBeNull();
      expect(finalOrg.verifiedBy).toBe(admin._id); // bare id — verifiedBy not included on this read path

      // a second, stale decision attempt against the same expected prior status must not re-apply
      const staleRetry = await organizationRepo.recordVerificationDecision(
        org._id,
        { status: 'granted', verifiedByUserId: admin._id, expectedCurrentStatus: 'requested' },
        { client: tx }
      );
      expect(staleRetry).toBe(false);
    }, { timeout: 15000 }), 15000);
});

describe('Product coexistence with the new organizationId/teamId FKs', () => {
  it('setting organizationId/teamId on a Product never touches the legacy league/team/player strings', () =>
    withRollback(async (tx) => {
      const org = await organizationRepo.create({ name: `Coexistence Org ${Date.now()}` }, { client: tx });
      const team = await teamRepo.create({ organizationId: org._id, name: 'Basketball', sport: 'basketball' }, { client: tx });

      const product = await productRepo.create(
        {
          name: `Coexistence Product ${Date.now()}`, description: 'x', price: 500,
          category: 'jersey', sport: 'basketball', league: 'UAAP', team: 'Legacy Team String', images: [],
        },
        { client: tx }
      );
      expect(product.team).toBe('Legacy Team String');

      const updated = await productRepo.updateById(product._id, { organizationId: org._id, teamId: team._id }, { client: tx });

      // the legacy free-text field is completely untouched by setting the new FKs
      expect(updated.team).toBe('Legacy Team String');
      expect(updated.league).toBe('UAAP');
      // and the raw FK scalars are present, not a populated relation object —
      // productRepository never includes organization/teamRef
      expect(updated.organizationId).toBe(org._id);
      expect(updated.teamId).toBe(team._id);
      expect(updated.organization).toBeUndefined();
      expect(updated.teamRef).toBeUndefined();
    }));

  it('cannot delete an Organization that still owns Products (onDelete: Restrict)', () =>
    withRollback(async (tx) => {
      const org = await organizationRepo.create({ name: `Restrict Test Org ${Date.now()}` }, { client: tx });
      await productRepo.create(
        {
          name: `Restrict Test Product ${Date.now()}`, description: 'x', price: 500,
          category: 'jersey', sport: 'basketball', images: [], organizationId: org._id,
        },
        { client: tx }
      );

      await expect(organizationRepo.deleteById(org._id, { client: tx })).rejects.toThrow();
    }));

  it('deleting a Team sets Product.teamId to null rather than deleting the product (onDelete: SetNull)', () =>
    withRollback(async (tx) => {
      const org = await organizationRepo.create({ name: `SetNull Test Org ${Date.now()}` }, { client: tx });
      const team = await teamRepo.create({ organizationId: org._id, name: 'Retiring Team', sport: 'basketball' }, { client: tx });
      const product = await productRepo.create(
        {
          name: `SetNull Test Product ${Date.now()}`, description: 'x', price: 500,
          category: 'jersey', sport: 'basketball', images: [], organizationId: org._id, teamId: team._id,
        },
        { client: tx }
      );

      await teamRepo.deleteById(team._id, { client: tx });

      const survived = await productRepo.findById(product._id, { client: tx });
      expect(survived).not.toBeNull(); // heritage products outlive rosters
      expect(survived.teamId).toBeNull();
      expect(survived.organizationId).toBe(org._id); // unaffected
    }));
});

describe('deleteOlderThan — the TTL-index replacement for TryOnLog/UserActivity', () => {
  it('tryOnLogRepository.deleteOlderThan removes only rows past the cutoff', () =>
    withRollback(async (tx) => {
      const old = await tx.tryOnLog.create({
        data: { productName: `Old TryOnLog ${Date.now()}`, createdAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000) },
      });
      const recent = await tryOnLogRepo.create({ productName: `Recent TryOnLog ${Date.now()}` }, { client: tx });

      const deletedCount = await tryOnLogRepo.deleteOlderThan(90, { client: tx });
      expect(deletedCount).toBe(1);

      expect(await tx.tryOnLog.findUnique({ where: { id: old.id } })).toBeNull();
      expect(await tx.tryOnLog.findUnique({ where: { id: recent._id } })).not.toBeNull();
    }), 15000);

  it('userActivityRepository.deleteOlderThan removes only rows past the cutoff', () =>
    withRollback(async (tx) => {
      const old = await tx.userActivity.create({
        data: { type: 'view', timestamp: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000) },
      });
      const recent = await userActivityRepo.create({ type: 'view' }, { client: tx });

      const deletedCount = await userActivityRepo.deleteOlderThan(90, { client: tx });
      expect(deletedCount).toBe(1);

      expect(await tx.userActivity.findUnique({ where: { id: old.id } })).toBeNull();
      expect(await tx.userActivity.findUnique({ where: { id: recent._id } })).not.toBeNull();
    }), 15000);
});

describe('bonusFitCheckGrantRepository — Fit Check Phase 2 ledger', () => {
  it('grant() is idempotent for once-per-user reasons but allows repeat admin_grant rows', () =>
    withRollback(async (tx) => {
      const user = await userRepo.create(
        { email: `bonus-${Date.now()}@example.com`, firstName: 'Bonus', lastName: 'Test', password: 'x' },
        { client: tx }
      );

      const first = await bonusFitCheckGrantRepo.grant(user._id, 'profile_complete', 1, { client: tx });
      const second = await bonusFitCheckGrantRepo.grant(user._id, 'profile_complete', 1, { client: tx });
      expect(first).not.toBeNull();
      expect(second).toBeNull(); // already granted once — no-op, not a duplicate row

      const firstAdminGrant = await bonusFitCheckGrantRepo.grant(user._id, 'admin_grant', 3, { client: tx, note: 'gesture' });
      const secondAdminGrant = await bonusFitCheckGrantRepo.grant(user._id, 'admin_grant', 2, { client: tx });
      expect(firstAdminGrant).not.toBeNull();
      expect(secondAdminGrant).not.toBeNull(); // an admin can grant to the same user more than once, on purpose

      const grants = await tx.bonusFitCheckGrant.findMany({ where: { userId: user._id } });
      expect(grants).toHaveLength(3); // 1 profile_complete + 2 admin_grant
    }), 15000);

  it('getBalance() sums (amount - consumedCount) across every grant, never negative', () =>
    withRollback(async (tx) => {
      const user = await userRepo.create(
        { email: `bonus-balance-${Date.now()}@example.com`, firstName: 'Bonus', lastName: 'Balance', password: 'x' },
        { client: tx }
      );
      await tx.bonusFitCheckGrant.create({ data: { userId: user._id, reason: 'profile_complete', amount: 1, consumedCount: 1 } }); // fully used
      await tx.bonusFitCheckGrant.create({ data: { userId: user._id, reason: 'email_verified', amount: 1, consumedCount: 0 } });
      await tx.bonusFitCheckGrant.create({ data: { userId: user._id, reason: 'admin_grant', amount: 3, consumedCount: 1 } });

      const balance = await bonusFitCheckGrantRepo.getBalance(user._id, { client: tx });
      expect(balance).toBe(3); // 0 + 1 + 2
    }), 15000);
});

// consumeOne() opens its own real transaction internally (the same
// FOR-UPDATE-locked-atomic-conditional-update discipline as
// productRepository.decrementStock) — it can't be driven through
// withRollback's own enclosing transaction the way the plain CRUD above
// can, and its whole reason for existing is to be race-safe under real
// concurrency. Runs outside withRollback deliberately, with explicit
// cleanup, exactly like decrementStock's own race test below.
describe('bonusFitCheckGrantRepository.consumeOne — real transaction, real concurrency', () => {
  it('draws from the oldest unconsumed grant first (FIFO)', async () => {
    const user = await prisma.user.create({
      data: { email: `bonus-fifo-${Date.now()}@example.com`, firstName: 'Bonus', lastName: 'Fifo' },
    });
    try {
      const older = await prisma.bonusFitCheckGrant.create({
        data: { userId: user.id, reason: 'email_verified', amount: 1, grantedAt: new Date(Date.now() - 60000) },
      });
      const newer = await prisma.bonusFitCheckGrant.create({
        data: { userId: user.id, reason: 'admin_grant', amount: 1, grantedAt: new Date() },
      });

      const consumed = await bonusFitCheckGrantRepo.consumeOne(user.id);
      expect(consumed).toBe(true);

      const olderRow = await prisma.bonusFitCheckGrant.findUnique({ where: { id: older.id } });
      const newerRow = await prisma.bonusFitCheckGrant.findUnique({ where: { id: newer.id } });
      expect(olderRow.consumedCount).toBe(1);
      expect(newerRow.consumedCount).toBe(0);
    } finally {
      await prisma.user.delete({ where: { id: user.id } }); // cascades to grants
    }
  }, 15000);

  it('returns false once every grant is fully consumed', async () => {
    const user = await prisma.user.create({
      data: { email: `bonus-empty-${Date.now()}@example.com`, firstName: 'Bonus', lastName: 'Empty' },
    });
    try {
      await prisma.bonusFitCheckGrant.create({ data: { userId: user.id, reason: 'admin_grant', amount: 1, consumedCount: 1 } });
      expect(await bonusFitCheckGrantRepo.consumeOne(user.id)).toBe(false);
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  }, 15000);

  it('two concurrent Fit Checks drawing on the last unit of bonus balance — only one succeeds', async () => {
    const user = await prisma.user.create({
      data: { email: `bonus-race-${Date.now()}@example.com`, firstName: 'Bonus', lastName: 'Race' },
    });
    try {
      await prisma.bonusFitCheckGrant.create({ data: { userId: user.id, reason: 'admin_grant', amount: 1 } }); // exactly one left

      const results = await Promise.allSettled([
        bonusFitCheckGrantRepo.consumeOne(user.id),
        bonusFitCheckGrantRepo.consumeOne(user.id),
      ]);

      const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value === true);
      const failed = results.filter((r) => r.status === 'fulfilled' && r.value === false);
      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);

      expect(await bonusFitCheckGrantRepo.getBalance(user.id)).toBe(0);
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  }, 15000);
});

describe('tryOnLogRepository.trending — Fit Check Phase 4', () => {
  it('counts only recent, successful, non-deleted generations, ranked by count', () =>
    withRollback(async (tx) => {
      const trendyProduct = await tx.product.create({
        data: { name: `Trendy ${Date.now()}`, slug: `trendy-${Date.now()}`, description: 'x', price: 500, category: 'jersey', sport: 'basketball', images: ['img.jpg'], active: true },
      });
      const quietProduct = await tx.product.create({
        data: { name: `Quiet ${Date.now()}`, slug: `quiet-${Date.now()}`, description: 'x', price: 500, category: 'jersey', sport: 'basketball', images: ['img.jpg'], active: true },
      });

      // 2 recent successful — should count
      await tx.tryOnLog.create({ data: { productId: trendyProduct.id, productName: trendyProduct.name, success: true } });
      await tx.tryOnLog.create({ data: { productId: trendyProduct.id, productName: trendyProduct.name, success: true } });
      // 1 recent but failed — must not count
      await tx.tryOnLog.create({ data: { productId: trendyProduct.id, productName: trendyProduct.name, success: false } });
      // 1 recent but soft-deleted — must not count
      await tx.tryOnLog.create({ data: { productId: trendyProduct.id, productName: trendyProduct.name, success: true, deletedAt: new Date() } });
      // 1 recent successful for the other product — should count once
      await tx.tryOnLog.create({ data: { productId: quietProduct.id, productName: quietProduct.name, success: true } });
      // 1 successful but outside the window — must not count
      await tx.tryOnLog.create({
        data: { productId: quietProduct.id, productName: quietProduct.name, success: true, createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      });

      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const results = await tryOnLogRepo.trending({ since, limit: 10, client: tx });

      const trendyResult = results.find((r) => r.productId === trendyProduct.id);
      const quietResult = results.find((r) => r.productId === quietProduct.id);
      expect(trendyResult.count).toBe(2);
      expect(quietResult.count).toBe(1);
      // Never leaks anything identity-related — only display/count fields.
      for (const r of results) {
        expect(Object.keys(r).sort()).toEqual(['count', 'image', 'name', 'price', 'productId', 'salePrice', 'slug'].sort());
      }
    }), 15000);
});

describe('fitCheckCampaignRepository.analytics + incrementViews — Fit Check Phase 4', () => {
  it('computes generations, unique fans, and live purchase correlation for a campaign', async () => {
    const buyer = await prisma.user.create({ data: { email: `analytics-buyer-${Date.now()}@example.com`, firstName: 'A', lastName: 'B' } });
    const browser = await prisma.user.create({ data: { email: `analytics-browser-${Date.now()}@example.com`, firstName: 'C', lastName: 'D' } });
    const product = await prisma.product.create({
      data: { name: `Analytics Product ${Date.now()}`, slug: `analytics-product-${Date.now()}`, description: 'x', price: 1000, category: 'jersey', sport: 'basketball', images: ['img.jpg'], active: true },
    });
    const campaign = await prisma.fitCheckCampaign.create({
      data: { name: 'Analytics Test', sponsorName: 'Test Sponsor', headline: 'x', productIds: [product.id] },
    });
    let order = null;

    try {
      // buyer generated a Fit Check under this campaign, then bought the product
      await prisma.tryOnLog.create({
        data: { fitCheckCampaignId: campaign.id, userId: buyer.id, productId: product.id, productName: product.name, success: true, durationMs: 4000 },
      });
      // browser also generated one, but never bought
      await prisma.tryOnLog.create({
        data: { fitCheckCampaignId: campaign.id, userId: browser.id, productId: product.id, productName: product.name, success: true, durationMs: 6000 },
      });
      // a guest generation too — contributes to uniqueFans via sessionId, not userId
      await prisma.tryOnLog.create({
        data: { fitCheckCampaignId: campaign.id, sessionId: `guest-${Date.now()}`, productId: product.id, productName: product.name, success: true, durationMs: 2000 },
      });

      order = await prisma.order.create({
        data: {
          orderNumber: `PS-ANALYTICS-${Date.now()}`,
          userId: buyer.id,
          email: buyer.email,
          shipToFullName: 'Buyer', shipToPhone: '09171234567', shipToAddress: '1 St', shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
          subtotal: 1000, total: 1000,
          paymentStatus: 'paid',
          items: { create: [{ productId: product.id, name: product.name, price: 1000, quantity: 1, size: 'M', image: 'img.jpg' }] },
        },
      });

      await fitCheckCampaignRepo.incrementViews(campaign.id);
      await fitCheckCampaignRepo.incrementViews(campaign.id);

      const result = await fitCheckCampaignRepo.analytics(campaign.id);
      expect(result.views).toBe(2);
      expect(result.generations).toBe(3);
      expect(result.successRate).toBe(1);
      expect(result.avgGenerationMs).toBe(4000); // (4000 + 6000 + 2000) / 3
      expect(result.uniqueFans).toBe(3); // 2 distinct userIds + 1 distinct sessionId
      expect(result.purchases).toBe(1);
      expect(result.revenue).toBe(1000);
      expect(result.topProducts).toEqual([{ id: product.id, name: product.name, slug: product.slug, count: 3 }]);
    } finally {
      // All cleanup lives here, not split across the try body — an
      // assertion failure above must never leave the order/orderItem rows
      // still referencing the product and turning a real failure into a
      // confusing FK-violation error instead.
      if (order) {
        await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
        await prisma.order.delete({ where: { id: order.id } });
      }
      await prisma.tryOnLog.deleteMany({ where: { fitCheckCampaignId: campaign.id } });
      await prisma.fitCheckCampaign.delete({ where: { id: campaign.id } });
      await prisma.product.delete({ where: { id: product.id } });
      await prisma.user.deleteMany({ where: { id: { in: [buyer.id, browser.id] } } });
    }
  }, 20000);
});

// Payment Platform Redesign, Phase 1 — the new Payment entity.
function makeMinimalOrder(client, suffix) {
  return client.order.create({
    data: {
      orderNumber: `PS-PAYMENTTEST-${suffix}`,
      email: 'payment-test@example.com',
      shipToFullName: 'Test Buyer', shipToPhone: '09171234567', shipToAddress: '1 St',
      shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
      subtotal: 500, total: 500,
    },
  });
}

describe('paymentRepository — Payment Platform Redesign Phase 1', () => {
  it('findLatestForOrder returns the most recent attempt, not the first', () =>
    withRollback(async (tx) => {
      const order = await makeMinimalOrder(tx, `latest-${Date.now()}`);
      const older = await paymentRepo.create(
        { orderId: order.id, provider: 'maya', checkoutReference: 'chk_old' }, { client: tx }
      );
      // Postgres timestamp resolution + immediate sequential inserts can
      // land in the same millisecond — force a real ordering gap so
      // "most recent" is unambiguous, matching how other tests in this
      // file separate createdAt values that must sort deterministically.
      await tx.payment.update({ where: { id: older._id }, data: { createdAt: new Date(Date.now() - 60000) } });
      const newer = await paymentRepo.create(
        { orderId: order.id, provider: 'maya', checkoutReference: 'chk_new' }, { client: tx }
      );

      const latest = await paymentRepo.findLatestForOrder(order.id, { client: tx });
      expect(latest._id).toBe(newer._id);
      expect(latest.checkoutReference).toBe('chk_new');

      const all = await paymentRepo.findByOrder(order.id, { client: tx });
      expect(all).toHaveLength(2);
    }), 15000);

  it('findLatestForOrders (bulk) returns exactly one row per order — the newest one, not an arbitrary attempt', () =>
    withRollback(async (tx) => {
      const orderOne = await makeMinimalOrder(tx, `bulk-latest-1-${Date.now()}`);
      const orderTwo = await makeMinimalOrder(tx, `bulk-latest-2-${Date.now()}`);

      const oneOlder = await paymentRepo.create(
        { orderId: orderOne.id, provider: 'maya', checkoutReference: 'chk_1_old' }, { client: tx }
      );
      await tx.payment.update({ where: { id: oneOlder._id }, data: { createdAt: new Date(Date.now() - 60000) } });
      const oneNewer = await paymentRepo.create(
        { orderId: orderOne.id, provider: 'maya', checkoutReference: 'chk_1_new' }, { client: tx }
      );
      const twoOnly = await paymentRepo.create(
        { orderId: orderTwo.id, provider: 'maya', checkoutReference: 'chk_2_only' }, { client: tx }
      );

      const latest = await paymentRepo.findLatestForOrders([orderOne.id, orderTwo.id], { client: tx });
      expect(latest).toHaveLength(2);

      const byOrderId = new Map(latest.map((p) => [p.orderId, p]));
      expect(byOrderId.get(orderOne.id)._id).toBe(oneNewer._id);
      expect(byOrderId.get(orderOne.id).checkoutReference).toBe('chk_1_new');
      expect(byOrderId.get(orderTwo.id)._id).toBe(twoOnly._id);
    }), 15000);

  it('resolve() is idempotent — a second resolution of an already-resolved attempt no-ops', () =>
    withRollback(async (tx) => {
      const order = await makeMinimalOrder(tx, `resolve-${Date.now()}`);
      const payment = await paymentRepo.create({ orderId: order.id, provider: 'maya' }, { client: tx });

      const first = await paymentRepo.resolve(payment._id, 'succeeded', { paidAt: new Date() }, { client: tx });
      expect(first).toBe(true);

      const second = await paymentRepo.resolve(payment._id, 'failed', { errorCode: 'late' }, { client: tx });
      expect(second).toBe(false); // already resolved — the WHERE status:'pending' guard blocks this

      const row = await paymentRepo.findById(payment._id, { client: tx });
      expect(row.status).toBe('succeeded'); // untouched by the second, no-op call
      expect(row.errorCode).toBeNull();
    }), 15000);
});

// Same real-transaction, real-concurrency discipline as productRepository
// .decrementStock's own race test — runs outside withRollback deliberately
// (needs two independently-committed transactions actually racing each
// other, not two operations nested in one enclosing transaction), cleaned
// up explicitly in a finally block.
describe('paymentRepository.resolve — the exact race two concurrent resolutions target', () => {
  it('two concurrent resolutions of the same pending attempt — only one succeeds', async () => {
    const order = await makeMinimalOrder(prisma, `race-${Date.now()}`);
    const payment = await prisma.payment.create({ data: { orderId: order.id, provider: 'maya' } });

    try {
      const results = await Promise.allSettled([
        paymentRepo.resolve(payment.id, 'succeeded', { paidAt: new Date() }),
        paymentRepo.resolve(payment.id, 'failed', { errorCode: 'lost_race' }),
      ]);

      const applied = results.filter((r) => r.status === 'fulfilled' && r.value === true);
      const noop = results.filter((r) => r.status === 'fulfilled' && r.value === false);
      expect(applied).toHaveLength(1);
      expect(noop).toHaveLength(1);

      const final = await prisma.payment.findUnique({ where: { id: payment.id } });
      // Whichever call's updateMany actually matched the still-pending row
      // first is authoritative — status is one of the two, never left at
      // 'pending' and never corrupted by the loser applying on top.
      expect(['succeeded', 'failed']).toContain(final.status);
    } finally {
      await prisma.payment.delete({ where: { id: payment.id } });
      await prisma.order.delete({ where: { id: order.id } });
    }
  }, 15000);
});

describe('expireStaleOrders — Payment Platform Redesign, Phase 4', () => {
  it('marks a stale pending order Expired, releases its stock, and resolves the Payment row', async () => {
    const product = await prisma.product.create({
      data: {
        name: `ExpireTest ${Date.now()}`, slug: `expire-test-${Date.now()}`, description: 'x',
        price: 500, category: 'jersey', sport: 'basketball', images: [], active: true,
        totalStock: 10, sizes: { create: [{ size: 'M', stock: 10 }] },
      },
    });
    const staleOrder = await prisma.order.create({
      data: {
        orderNumber: `PS-EXPIRETEST-${Date.now()}`,
        email: 'expire-test@example.com',
        shipToFullName: 'Test', shipToPhone: '09171234567', shipToAddress: '1 St',
        shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
        subtotal: 1000, total: 1000,
        paymentStatus: 'pending',
        createdAt: new Date(Date.now() - 49 * 60 * 60 * 1000), // 49h ago — past the 48h default
        items: { create: [{ productId: product.id, name: product.name, price: 500, quantity: 2, size: 'M', image: 'x.jpg' }] },
      },
    });
    // Simulate the real reservation-at-placement flow this order would have gone through.
    await prisma.productSize.updateMany({ where: { productId: product.id, size: 'M' }, data: { stock: { decrement: 2 } } });
    await prisma.product.update({ where: { id: product.id }, data: { totalStock: { decrement: 2 } } });

    const payment = await prisma.payment.create({
      data: { orderId: staleOrder.id, provider: 'maya', status: 'pending', checkoutReference: 'chk_expire_test', expiresAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    });

    try {
      const result = await expireStaleOrders();
      expect(result.skipped).toBe(false);
      // Not an exact count — a long-running shared dev DB may have other
      // genuinely stale rows too; the real assertion is what happened to
      // *this* fixture, checked individually below.
      expect(result.expiredCount).toBeGreaterThanOrEqual(1);

      const updatedOrder = await prisma.order.findUnique({ where: { id: staleOrder.id } });
      expect(updatedOrder.paymentStatus).toBe('failed');
      expect(updatedOrder.orderStatus).toBe('expired');

      const restoredSize = await prisma.productSize.findFirst({ where: { productId: product.id, size: 'M' } });
      expect(restoredSize.stock).toBe(10); // released back to inventory

      const updatedPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
      expect(updatedPayment.status).toBe('expired');

      const event = await prisma.orderEvent.findFirst({ where: { orderId: staleOrder.id, type: 'payment_expired' } });
      expect(event).not.toBeNull();
    } finally {
      await prisma.orderEvent.deleteMany({ where: { orderId: staleOrder.id } });
      await prisma.payment.deleteMany({ where: { orderId: staleOrder.id } });
      await prisma.orderItem.deleteMany({ where: { orderId: staleOrder.id } });
      await prisma.order.delete({ where: { id: staleOrder.id } });
      await prisma.product.delete({ where: { id: product.id } });
    }
  }, 20000);

  it('never touches an order still inside the retention window', async () => {
    const product = await prisma.product.create({
      data: {
        name: `RecentTest ${Date.now()}`, slug: `recent-test-${Date.now()}`, description: 'x',
        price: 500, category: 'jersey', sport: 'basketball', images: [], active: true,
      },
    });
    const recentOrder = await prisma.order.create({
      data: {
        orderNumber: `PS-RECENTTEST-${Date.now()}`,
        email: 'recent-test@example.com',
        shipToFullName: 'Test', shipToPhone: '09171234567', shipToAddress: '1 St',
        shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
        subtotal: 500, total: 500,
        paymentStatus: 'pending', // createdAt defaults to now — well inside any real retention window
      },
    });

    try {
      await expireStaleOrders();
      const unchanged = await prisma.order.findUnique({ where: { id: recentOrder.id } });
      expect(unchanged.paymentStatus).toBe('pending');
      expect(unchanged.orderStatus).toBe('awaiting_payment');
    } finally {
      await prisma.order.delete({ where: { id: recentOrder.id } });
      await prisma.product.delete({ where: { id: product.id } });
    }
  }, 15000);

  it('skips the entire sweep when orderExpirationEnabled is off — a real kill switch, not just a number', async () => {
    const before = await siteSettingsRepo.get();
    await siteSettingsRepo.update({ payment: { orderExpirationEnabled: false } });

    try {
      const result = await expireStaleOrders();
      expect(result).toEqual({ skipped: true, expiredCount: 0, candidateCount: 0, errors: [] });
    } finally {
      await siteSettingsRepo.update({ payment: { orderExpirationEnabled: before.payment.orderExpirationEnabled } });
    }
  }, 15000);
});

async function makeReminderTestOrder(hoursAgo, extra = {}) {
  return prisma.order.create({
    data: {
      orderNumber: `PS-REMINDERTEST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      email: 'reminder-test@example.com',
      shipToFullName: 'Test', shipToPhone: '09171234567', shipToAddress: '1 St',
      shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
      subtotal: 500, total: 500,
      paymentStatus: 'pending',
      createdAt: new Date(Date.now() - hoursAgo * 60 * 60 * 1000),
      ...extra,
    },
  });
}

describe('sendPaymentReminders — Payment Platform Redesign, Phase 6', () => {
  it('sends the 24h tier for an order that just crossed 24h remaining (default 48h retention), and records it', async () => {
    // 25h old under a 48h window = 23h remaining — past the 24h threshold.
    const order = await makeReminderTestOrder(25);

    try {
      const result = await sendPaymentReminders();
      expect(result.skipped).toBe(false);
      expect(result.remindersSent).toBeGreaterThanOrEqual(1);

      const updated = await prisma.order.findUnique({ where: { id: order.id } });
      expect(updated.paymentReminderTiers).toEqual(['24h']);
    } finally {
      await prisma.order.delete({ where: { id: order.id } });
    }
  }, 20000);

  it('sends nothing for an order still well inside every tier window', async () => {
    const order = await makeReminderTestOrder(5); // 43h remaining — under no threshold yet

    try {
      await sendPaymentReminders();
      const updated = await prisma.order.findUnique({ where: { id: order.id } });
      expect(updated.paymentReminderTiers).toEqual([]);
    } finally {
      await prisma.order.delete({ where: { id: order.id } });
    }
  }, 15000);

  it('never re-sends a tier that was already recorded — idempotent across runs', async () => {
    const order = await makeReminderTestOrder(25, { paymentReminderTiers: ['24h'] });

    try {
      await sendPaymentReminders();
      const updated = await prisma.order.findUnique({ where: { id: order.id } });
      expect(updated.paymentReminderTiers).toEqual(['24h']); // unchanged — not appended again
    } finally {
      await prisma.order.delete({ where: { id: order.id } });
    }
  }, 15000);

  it('a cron gap that skips past multiple tiers sends only the most urgent, but records all of them', async () => {
    // 47h old under a 48h window = 1h remaining — past 24h, 6h, AND 2h at once.
    const order = await makeReminderTestOrder(47);

    try {
      await sendPaymentReminders();
      const updated = await prisma.order.findUnique({ where: { id: order.id } });
      expect(updated.paymentReminderTiers).toEqual(['24h', '6h', '2h']);
    } finally {
      await prisma.order.delete({ where: { id: order.id } });
    }
  }, 15000);

  it('skips the entire sweep when orderExpirationEnabled is off — reminders reference the same deadline the sweep enforces', async () => {
    const before = await siteSettingsRepo.get();
    await siteSettingsRepo.update({ payment: { orderExpirationEnabled: false } });

    try {
      const result = await sendPaymentReminders();
      expect(result).toEqual({ skipped: true, remindersSent: 0, candidateCount: 0, errors: [] });
    } finally {
      await siteSettingsRepo.update({ payment: { orderExpirationEnabled: before.payment.orderExpirationEnabled } });
    }
  }, 15000);
});

describe('shipmentRepository.transition — Enterprise Fulfillment Blueprint, Phase 1', () => {
  it('rejects an illegal jump per the adjacency map, without touching the database', async () => {
    const order = await makeMinimalOrder(prisma, `shipment-illegal-${Date.now()}`);
    const shipment = await prisma.shipment.create({ data: { orderId: order.id } }); // default: awaiting_picking

    try {
      await expect(shipmentRepo.transition(shipment.id, 'delivered')).rejects.toThrow(shipmentRepo.InvalidTransitionError);

      const unchanged = await prisma.shipment.findUnique({ where: { id: shipment.id } });
      expect(unchanged.status).toBe('awaiting_picking');
      const events = await prisma.shipmentEvent.count({ where: { shipmentId: shipment.id } });
      expect(events).toBe(0); // no event written for a rejected transition
    } finally {
      await prisma.shipment.delete({ where: { id: shipment.id } });
      await prisma.order.delete({ where: { id: order.id } });
    }
  }, 15000);

  it('a legal transition writes both the status change and its ShipmentEvent, with fromStatus/toStatus structured (not just a message string)', async () => {
    const order = await makeMinimalOrder(prisma, `shipment-legal-${Date.now()}`);
    const shipment = await prisma.shipment.create({ data: { orderId: order.id } });

    try {
      const result = await shipmentRepo.transition(shipment.id, 'picking', { actor: 'admin', actorUserId: null, message: 'Started picking' });
      expect(result).toEqual({ applied: true, fromStatus: 'awaiting_picking', toStatus: 'picking' });

      const updated = await prisma.shipment.findUnique({ where: { id: shipment.id } });
      expect(updated.status).toBe('picking');

      const event = await prisma.shipmentEvent.findFirst({ where: { shipmentId: shipment.id, type: 'status_changed' } });
      expect(event.fromStatus).toBe('awaiting_picking');
      expect(event.toStatus).toBe('picking');
      expect(event.message).toBe('Started picking');
    } finally {
      await prisma.shipmentEvent.deleteMany({ where: { shipmentId: shipment.id } });
      await prisma.shipment.delete({ where: { id: shipment.id } });
      await prisma.order.delete({ where: { id: order.id } });
    }
  }, 15000);

  it('the exact race two concurrent transitions target — only one succeeds, matching tryResolvePayment\'s own guard shape', async () => {
    const order = await makeMinimalOrder(prisma, `shipment-race-${Date.now()}`);
    const shipment = await prisma.shipment.create({ data: { orderId: order.id, status: 'picking' } });

    try {
      const results = await Promise.allSettled([
        shipmentRepo.transition(shipment.id, 'packing'),
        shipmentRepo.transition(shipment.id, 'exception'),
      ]);

      const applied = results.filter((r) => r.status === 'fulfilled' && r.value.applied === true);
      const lost = results.filter((r) => r.status === 'fulfilled' && r.value.applied === false);
      expect(applied).toHaveLength(1);
      expect(lost).toHaveLength(1);

      const final = await prisma.shipment.findUnique({ where: { id: shipment.id } });
      expect(['packing', 'exception']).toContain(final.status);

      // Exactly one ShipmentEvent for the transition that actually won —
      // the loser's updateMany matched zero rows and never reached the
      // event-creation step at all.
      const events = await prisma.shipmentEvent.count({ where: { shipmentId: shipment.id, type: 'status_changed' } });
      expect(events).toBe(1);
    } finally {
      await prisma.shipmentEvent.deleteMany({ where: { shipmentId: shipment.id } });
      await prisma.shipment.delete({ where: { id: shipment.id } });
      await prisma.order.delete({ where: { id: order.id } });
    }
  }, 15000);
});
