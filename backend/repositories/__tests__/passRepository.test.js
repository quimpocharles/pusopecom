import { describe, it, expect } from 'vitest';
import prisma from '../../lib/prisma.js';
import * as passRepo from '../passRepository.js';

/**
 * Real integration tests against a live database, same convention as
 * repositories/__tests__/integration.test.js: single-transaction tests use
 * withRollback (nothing ever commits); the actual concurrency races need
 * two independent, really-concurrent transactions, which a single
 * enclosing transaction can't produce, so those run outside withRollback
 * with explicit cleanup in a finally block.
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

async function makeVenueEventFixtures(tx) {
  const org = await tx.organization.create({
    data: { name: `Pass Test Org ${Date.now()}`, slug: `pass-test-org-${Date.now()}-${Math.random().toString(36).slice(2)}`, kind: 'institution' },
  });
  const venue = await tx.venue.create({
    data: { name: 'Pass Test Arena', slug: `pass-test-arena-${Date.now()}-${Math.random().toString(36).slice(2)}`, address: '1 St', city: 'QC' },
  });
  const section = await tx.venueSection.create({ data: { venueId: venue.id, name: 'GA' } });
  const event = await tx.passEvent.create({
    data: {
      name: 'Pass Test Event', slug: `pass-test-event-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      organizationId: org.id, venueId: venue.id,
      startsAt: new Date(Date.now() + 86400000), endsAt: new Date(Date.now() + 90000000),
    },
  });
  const tier = await tx.passTier.create({ data: { passEventId: event.id, venueSectionId: section.id, name: 'GA', price: 300, capacity: 2, sold: 0 } });
  return { org, venue, section, event, tier };
}

describe('decrementTierCapacity / restoreTierCapacity — PassTier counters', () => {
  it('decrements atomically when enough capacity remains', () =>
    withRollback(async (tx) => {
      const { tier } = await makeVenueEventFixtures(tx);
      await passRepo.decrementTierCapacity({ passTierId: tier.id, quantity: 2, capacity: tier.capacity }, { client: tx });
      const updated = await tx.passTier.findUnique({ where: { id: tier.id } });
      expect(updated.sold).toBe(2);
    }, { timeout: 15000 }), 15000);

  it('throws InsufficientPassCapacityError and changes nothing when quantity exceeds remaining capacity', () =>
    withRollback(async (tx) => {
      const { tier } = await makeVenueEventFixtures(tx);
      await expect(
        passRepo.decrementTierCapacity({ passTierId: tier.id, quantity: 3, capacity: tier.capacity }, { client: tx })
      ).rejects.toThrow(passRepo.InsufficientPassCapacityError);
      const unchanged = await tx.passTier.findUnique({ where: { id: tier.id } });
      expect(unchanged.sold).toBe(0);
    }, { timeout: 15000 }), 15000);

  it('restoreTierCapacity is the exact symmetric inverse', () =>
    withRollback(async (tx) => {
      const { tier } = await makeVenueEventFixtures(tx);
      await passRepo.decrementTierCapacity({ passTierId: tier.id, quantity: 2, capacity: tier.capacity }, { client: tx });
      await passRepo.restoreTierCapacity({ passTierId: tier.id, quantity: 2 }, { client: tx });
      const restored = await tx.passTier.findUnique({ where: { id: tier.id } });
      expect(restored.sold).toBe(0);
    }, { timeout: 15000 }), 15000);

  it('the exact race the fix targets: two concurrent decrements for the last unit of capacity — only one succeeds', async () => {
    // Two concurrent attempts, not three — matches the exact shape
    // productRepository's own decrementStock race test already proved;
    // more concurrent transactions than that mainly adds connection-pool
    // contention noise against this deployment's real remote database,
    // not additional proof of the atomic guard itself.
    const { org, venue, tier, event } = await prisma.$transaction(async (tx) => makeVenueEventFixtures(tx));
    await prisma.passTier.update({ where: { id: tier.id }, data: { capacity: 1 } });

    try {
      const attempt = () => prisma.$transaction((tx) => passRepo.decrementTierCapacity({ passTierId: tier.id, quantity: 1, capacity: 1 }, { client: tx }));
      const results = await Promise.allSettled([attempt(), attempt()]);
      const succeeded = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);
      expect(failed[0].reason).toBeInstanceOf(passRepo.InsufficientPassCapacityError);

      const final = await prisma.passTier.findUnique({ where: { id: tier.id } });
      expect(final.sold).toBe(1); // never oversold past capacity
    } finally {
      await prisma.passTier.deleteMany({ where: { passEventId: event.id } });
      await prisma.passEvent.delete({ where: { id: event.id } });
      await prisma.venueSection.deleteMany({ where: { venueId: venue.id } });
      await prisma.venue.delete({ where: { id: venue.id } });
      await prisma.organization.delete({ where: { id: org.id } });
    }
  }, 15000);
});

describe('issuePass / transition — the Pass state machine', () => {
  async function makeOrder(tx) {
    return tx.order.create({
      data: {
        orderNumber: `PS-PASSTEST-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        email: 'pass-test@test.local',
        shipToFullName: 'Test', shipToPhone: '09171234567', shipToAddress: 'x', shipToCity: 'x', shipToProvince: 'x', shipToZipCode: '1000',
        subtotal: 2000, shippingFee: 0, total: 2000,
      },
    });
  }

  it('issuePass creates a Pass row (status issued) and a "created" PassLog entry', () =>
    withRollback(async (tx) => {
      const { event, tier } = await makeVenueEventFixtures(tx);
      const order = await makeOrder(tx);

      const pass = await passRepo.issuePass(
        { orderId: order.id, passEventId: event.id, passTierId: tier.id, price: 300 },
        { client: tx }
      );
      expect(pass.status).toBe('issued');
      expect(pass.qrToken).toBeTruthy();

      const logs = await tx.passLog.findMany({ where: { passId: pass._id } });
      expect(logs).toHaveLength(1);
      expect(logs[0].type).toBe('created');
    }, { timeout: 15000 }), 15000);

  it('transition applies a valid state change and writes a typed PassLog row', () =>
    withRollback(async (tx) => {
      const { event, tier } = await makeVenueEventFixtures(tx);
      const order = await makeOrder(tx);
      const pass = await passRepo.issuePass({ orderId: order.id, passEventId: event.id, passTierId: tier.id, price: 300 }, { client: tx });

      const result = await passRepo.transition(pass._id, 'checked_in', { actor: 'admin', client: tx });
      expect(result).toEqual({ applied: true, fromStatus: 'issued', toStatus: 'checked_in' });

      const updated = await tx.pass.findUnique({ where: { id: pass._id } });
      expect(updated.status).toBe('checked_in');
      expect(updated.checkedInAt).not.toBeNull();

      const logs = await tx.passLog.findMany({ where: { passId: pass._id }, orderBy: { createdAt: 'asc' } });
      expect(logs.map((l) => l.type)).toEqual(['created', 'status_changed']);
      expect(logs[1].fromStatus).toBe('issued');
      expect(logs[1].toStatus).toBe('checked_in');
    }, { timeout: 15000 }), 15000);

  it('rejects an invalid transition (checked_in cannot go back to issued)', () =>
    withRollback(async (tx) => {
      const { event, tier } = await makeVenueEventFixtures(tx);
      const order = await makeOrder(tx);
      const pass = await passRepo.issuePass({ orderId: order.id, passEventId: event.id, passTierId: tier.id, price: 300 }, { client: tx });
      await passRepo.transition(pass._id, 'checked_in', { actor: 'admin', client: tx });

      await expect(passRepo.transition(pass._id, 'issued', { actor: 'admin', client: tx })).rejects.toThrow(
        passRepo.InvalidPassTransitionError
      );
    }, { timeout: 15000 }), 15000);

  it('a second concurrent check-in attempt on the same pass loses the race and no-ops rather than double-logging', async () => {
    const fixtures = await prisma.$transaction(async (tx) => makeVenueEventFixtures(tx));
    const { org, venue, event, tier } = fixtures;
    const order = await prisma.order.create({
      data: {
        orderNumber: `PS-PASSRACE-${Date.now()}`,
        email: 'pass-race@test.local',
        shipToFullName: 'Test', shipToPhone: '09171234567', shipToAddress: 'x', shipToCity: 'x', shipToProvince: 'x', shipToZipCode: '1000',
        subtotal: 300, shippingFee: 0, total: 300,
      },
    });
    const pass = await prisma.$transaction((tx) =>
      passRepo.issuePass({ orderId: order.id, passEventId: event.id, passTierId: tier.id, price: 300 }, { client: tx })
    );

    try {
      const [a, b] = await Promise.allSettled([
        passRepo.transition(pass._id, 'checked_in', { actor: 'admin' }),
        passRepo.transition(pass._id, 'checked_in', { actor: 'admin' }),
      ]);
      const applied = [a, b].filter((r) => r.status === 'fulfilled' && r.value.applied);
      const raceLost = [a, b].filter((r) => r.status === 'fulfilled' && !r.value.applied);
      expect(applied).toHaveLength(1);
      expect(raceLost).toHaveLength(1);
      expect(raceLost[0].value.reason).toBe('race_lost');

      const logs = await prisma.passLog.findMany({ where: { passId: pass._id } });
      expect(logs).toHaveLength(2); // created + exactly one status_changed, never two
    } finally {
      await prisma.passLog.deleteMany({ where: { passId: pass._id } });
      await prisma.pass.delete({ where: { id: pass._id } });
      await prisma.order.delete({ where: { id: order.id } });
      await prisma.passTier.deleteMany({ where: { passEventId: event.id } });
      await prisma.passEvent.delete({ where: { id: event.id } });
      await prisma.venueSection.deleteMany({ where: { venueId: venue.id } });
      await prisma.venue.delete({ where: { id: venue.id } });
      await prisma.organization.delete({ where: { id: org.id } });
    }
  }, 15000);
});
