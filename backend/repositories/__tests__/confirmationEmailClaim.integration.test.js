import { describe, it, expect, afterEach } from 'vitest';
import prisma from '../../lib/prisma.js';
import {
  claimConfirmationEmailDelivery,
  releaseConfirmationEmailClaim,
  markConfirmationEmailSent,
} from '../orderRepository.js';

const createdOrderIds = [];

async function createPaidOrder(paymentStatus = 'paid') {
  const order = await prisma.order.create({
    data: {
      orderNumber: `PS-CLAIM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      email: 'claim-test@example.invalid',
      shipToFullName: 'Claim Test',
      shipToPhone: '09170000000',
      subtotal: 100,
      shippingFee: 0,
      total: 100,
      paymentMethod: 'xendit',
      paymentStatus,
      orderStatus: paymentStatus === 'paid' ? 'paid' : 'failed_payment',
      createdAt: new Date(Date.now() - 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 60 * 60 * 1000),
    },
  });
  createdOrderIds.push(order.id);
  return order;
}

afterEach(async () => {
  if (createdOrderIds.length) {
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds.splice(0) } } });
  }
});

describe('confirmation email claim lease', () => {
  it('allows only one of two concurrent workers to claim an order', async () => {
    const order = await createPaidOrder();
    const staleBefore = new Date();
    const [first, second] = await Promise.all([
      claimConfirmationEmailDelivery(order.id, { claimedAt: new Date(), staleBefore }),
      claimConfirmationEmailDelivery(order.id, { claimedAt: new Date(Date.now() + 1), staleBefore }),
    ]);

    expect([first, second].filter(Boolean)).toHaveLength(1);
  }, 30000);

  it('blocks a fresh claim and allows a stale claim to be reclaimed', async () => {
    const order = await createPaidOrder();
    const now = new Date();
    const freshClaim = new Date(now.getTime() - 1 * 60 * 1000);
    const staleBefore = new Date(now.getTime() - 15 * 60 * 1000);

    await expect(claimConfirmationEmailDelivery(order.id, {
      claimedAt: freshClaim,
      staleBefore,
    })).resolves.toBe(true);
    await expect(claimConfirmationEmailDelivery(order.id, {
      claimedAt: now,
      staleBefore,
    })).resolves.toBe(false);
    await prisma.order.update({
      where: { id: order.id },
      data: { confirmationEmailClaimedAt: new Date(now.getTime() - 16 * 60 * 1000) },
    });
    await expect(claimConfirmationEmailDelivery(order.id, {
      claimedAt: now,
      staleBefore,
    })).resolves.toBe(true);
  }, 30000);

  it('does not claim failed orders and sent markers block further claims', async () => {
    const failed = await createPaidOrder('failed');
    const failedClaim = await claimConfirmationEmailDelivery(failed.id, {
      claimedAt: new Date(),
      staleBefore: new Date(),
    });
    expect(failedClaim).toBe(false);

    const paid = await createPaidOrder();
    const claimedAt = new Date();
    expect(await claimConfirmationEmailDelivery(paid.id, { claimedAt, staleBefore: new Date() })).toBe(true);
    expect(await markConfirmationEmailSent(paid.id, { claimedAt })).toBe(true);
    expect(await claimConfirmationEmailDelivery(paid.id, { claimedAt: new Date(), staleBefore: new Date() })).toBe(false);
  }, 30000);

  it('releases a failed attempt so the next worker can reclaim it', async () => {
    const order = await createPaidOrder();
    const claimedAt = new Date();
    expect(await claimConfirmationEmailDelivery(order.id, { claimedAt, staleBefore: new Date() })).toBe(true);
    expect(await releaseConfirmationEmailClaim(order.id, { claimedAt })).toBe(true);
    expect(await claimConfirmationEmailDelivery(order.id, { claimedAt: new Date(), staleBefore: new Date() })).toBe(true);
  }, 30000);
});
