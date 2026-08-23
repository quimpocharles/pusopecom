import { describe, it, expect, vi, afterEach } from 'vitest';
import prisma from '../../lib/prisma.js';

vi.mock('../../services/emailService.js', () => ({
  sendOrderConfirmationEmail: vi.fn(),
}));

const { sendOrderConfirmation } = await import('../orderConfirmationEmail.js');
const emailService = await import('../../services/emailService.js');
const createdOrderIds = [];

async function createEligibleOrder() {
  const order = await prisma.order.create({
    data: {
      orderNumber: `PS-CONCURRENCY-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      email: 'claim-test@example.invalid',
      shipToFullName: 'Claim Test',
      shipToPhone: '09170000000',
      subtotal: 100,
      shippingFee: 0,
      total: 100,
      paymentMethod: 'xendit',
      paymentStatus: 'paid',
      orderStatus: 'paid',
      createdAt: new Date(Date.now() - 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 60 * 60 * 1000),
    },
  });
  createdOrderIds.push(order.id);
  return { _id: order.id, orderNumber: order.orderNumber, email: order.email, passes: [] };
}

afterEach(async () => {
  vi.clearAllMocks();
  if (createdOrderIds.length) {
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds.splice(0) } } });
  }
});

describe('confirmation email concurrency', () => {
  it('allows only the claim owner to send and records one success marker', async () => {
    const order = await createEligibleOrder();
    let releaseSend;
    let sendStartedResolve;
    const sendGate = new Promise((resolve) => { releaseSend = resolve; });
    const sendStarted = new Promise((resolve) => { sendStartedResolve = resolve; });
    emailService.sendOrderConfirmationEmail.mockImplementation(async () => {
      sendStartedResolve();
      await sendGate;
    });

    const first = sendOrderConfirmation(order);
    const second = sendOrderConfirmation(order);
    await sendStarted;
    releaseSend();

    // Which concurrent caller wins the atomic DB claim is non-deterministic
    // (both claims race over separate pool connections), so the results are
    // asserted as a set, not in caller order: exactly one owner sends, the
    // other skips.
    const results = await Promise.all([first, second]);
    expect([...results].sort()).toEqual(['sent', 'skipped']);
    expect(emailService.sendOrderConfirmationEmail).toHaveBeenCalledTimes(1);

    const saved = await prisma.order.findUnique({ where: { id: order._id } });
    expect(saved.confirmationEmailSentAt).toBeTruthy();
    expect(saved.confirmationEmailClaimedAt).toBeNull();
  }, 30000);
});
