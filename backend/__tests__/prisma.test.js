import { describe, it, expect } from 'vitest';

describe('lib/prisma singleton', () => {
  it('returns the same PrismaClient instance on repeated imports', async () => {
    const first = (await import('../lib/prisma.js')).default;
    const second = (await import('../lib/prisma.js')).default;
    expect(first).toBe(second);
  });

  it('is a PrismaClient with the expected model delegates for every schema model', async () => {
    const prisma = (await import('../lib/prisma.js')).default;
    // Not a live DB call — just confirms the generated client actually
    // exposes a delegate for every model in schema.prisma, which fails
    // fast if the client generation and schema ever drift apart.
    const expectedDelegates = [
      'user', 'address', 'product', 'productSize', 'productColor',
      'productColorSize', 'order', 'orderItem', 'league', 'review',
      'shippingEvent', 'siteSettings', 'tryOnLog', 'userActivity',
      'venuePickupConfig', 'pickupSlot',
    ];
    for (const delegate of expectedDelegates) {
      expect(prisma[delegate]).toBeDefined();
    }
  });
});
