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

  it('updateById replaces sizes/colors wholesale (matching findByIdAndUpdate\'s actual behavior on the admin edit form) without touching totalStock', () =>
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
      // totalStock is untouched by this path — reproduces the existing quirk, not a new bug
      expect(updated.totalStock).toBe(10);
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
      expect(order.orderNumber).toMatch(/^PP-/);
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

      const first = await orderRepo.tryResolvePayment(order._id, 'paid', { orderStatus: 'confirmed' }, { client: tx });
      const second = await orderRepo.tryResolvePayment(order._id, 'failed', {}, { client: tx });
      expect(first).toBe(true);
      expect(second).toBe(false); // already resolved — must not flip a paid order to failed

      const finalOrder = await orderRepo.findById(order._id, { client: tx });
      expect(finalOrder.paymentStatus).toBe('paid');
      expect(finalOrder.orderStatus).toBe('confirmed');
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
