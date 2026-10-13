import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

/**
 * Stage 2, Step 3 — POST /admin/refunds/:id/adjust.
 *
 * Real requirePermission middleware (only authenticate mocked), so the
 * refunds.manage authorization is proven, and the real DB drives the ceiling,
 * audit-event and concurrency behavior.
 */
let currentUser;

vi.mock('../../middleware/auth.js', async () => {
  const actual = await vi.importActual('../../middleware/auth.js');
  return {
    ...actual,
    authenticate: (req, res, next) => { req.user = currentUser; next(); },
  };
});

const { default: refundsRouter } = await import('../refunds.js');

const app = express();
app.use(express.json());
app.use('/api/admin/refunds', refundsRouter);

const MARKER = `RefundAdjustTest${Date.now()}`;
const FINANCE_ID = `${MARKER}-finance`;

function asFinance() {
  currentUser = { _id: FINANCE_ID, role: 'admin', staffProfile: { department: 'finance', active: true, permissions: [] } };
}
function asSupport() {
  currentUser = { _id: `${MARKER}-support`, role: 'admin', staffProfile: { department: 'support', active: true, permissions: [] } };
}

beforeAll(async () => {
  await prisma.user.create({
    data: { id: FINANCE_ID, email: `${FINANCE_ID}@test.local`, firstName: 'Fin', lastName: 'Ance', role: 'admin' },
  });
}, 45000);

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: FINANCE_ID } });
  await prisma.$disconnect();
});

beforeEach(() => asFinance());

async function makeReturnFixture({
  price = 500, quantity = 2, discountAmount = 0, shippingFee = 0,
  refundAmount, refundStatus = 'pending', returnItemQuantity = quantity,
} = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const product = await prisma.product.create({
    data: {
      name: `${MARKER} ${suffix}`, slug: `refund-adjust-${suffix}`, description: 'x',
      price, category: 'jersey', sport: 'basketball', images: [], active: true,
      totalStock: 99, sizes: { create: [{ size: 'M', stock: 99 }] },
    },
  });
  const subtotal = price * quantity;
  const order = await prisma.order.create({
    data: {
      orderNumber: `PS-${MARKER}-${suffix}`, email: 'refund-adjust@example.com',
      shipToFullName: 'Test Buyer', shipToPhone: '09171234567', shipToAddress: '1 St',
      shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
      subtotal, shippingFee, discountAmount, total: subtotal - discountAmount + shippingFee,
      paymentStatus: 'paid', orderStatus: 'delivered',
      items: { create: [{ productId: product.id, name: product.name, price, quantity, size: 'M', image: 'x.jpg' }] },
    },
    include: { items: true },
  });
  const payment = await prisma.payment.create({
    data: { orderId: order.id, provider: 'epaygames', status: 'succeeded', paidAt: new Date() },
  });
  const returnRequest = await prisma.returnRequest.create({
    data: {
      orderId: order.id, reason: 'Wrong size', status: 'refund_pending',
      items: { create: [{ orderItemId: order.items[0].id, quantity: returnItemQuantity }] },
    },
    include: { items: true },
  });
  const refund = await prisma.refund.create({
    data: {
      orderId: order.id, paymentId: payment.id, returnRequestId: returnRequest.id,
      amount: refundAmount ?? (subtotal - discountAmount), reason: 'Return test', status: refundStatus,
    },
  });
  return { product, order, payment, returnRequest, refund };
}

async function makeCancelFixture({ total = 1000, refundAmount, refundStatus = 'pending' } = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const order = await prisma.order.create({
    data: {
      orderNumber: `PS-${MARKER}-C-${suffix}`, email: 'refund-adjust-cancel@example.com',
      shipToFullName: 'Test Buyer', shipToPhone: '09171234567', shipToAddress: '1 St',
      shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
      subtotal: total, shippingFee: 0, discountAmount: 0, total,
      paymentStatus: 'paid', orderStatus: 'cancelled',
    },
  });
  const payment = await prisma.payment.create({
    data: { orderId: order.id, provider: 'epaygames', status: 'succeeded', paidAt: new Date() },
  });
  const refund = await prisma.refund.create({
    data: { orderId: order.id, paymentId: payment.id, amount: refundAmount ?? total, reason: 'Order cancelled', status: refundStatus },
  });
  return { order, payment, refund };
}

// One order (line 500 × 2 → total/attributable 1000) with two return requests on
// the same line, one unit each (each return's own attributable is 500). Return
// A's refund is succeeded; return B holds a pending refund for `secondRefundAmount`.
async function makeTwoReturnCeilingFixture({ firstRefundAmount = 300, secondRefundAmount } = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const product = await prisma.product.create({
    data: {
      name: `${MARKER} ceil ${suffix}`, slug: `refund-adjust-ceil-${suffix}`, description: 'x',
      price: 500, category: 'jersey', sport: 'basketball', images: [], active: true,
      totalStock: 99, sizes: { create: [{ size: 'M', stock: 99 }] },
    },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: `PS-${MARKER}-CEIL-${suffix}`, email: 'refund-adjust-ceil@example.com',
      shipToFullName: 'Test Buyer', shipToPhone: '09171234567', shipToAddress: '1 St',
      shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
      subtotal: 1000, shippingFee: 0, discountAmount: 0, total: 1000,
      paymentStatus: 'paid', orderStatus: 'delivered',
      items: { create: [{ productId: product.id, name: product.name, price: 500, quantity: 2, size: 'M', image: 'x.jpg' }] },
    },
    include: { items: true },
  });
  const payment = await prisma.payment.create({ data: { orderId: order.id, provider: 'epaygames', status: 'succeeded', paidAt: new Date() } });
  const returnA = await prisma.returnRequest.create({ data: { orderId: order.id, reason: 'a', status: 'refund_pending', items: { create: [{ orderItemId: order.items[0].id, quantity: 1 }] } } });
  const returnB = await prisma.returnRequest.create({ data: { orderId: order.id, reason: 'b', status: 'refund_pending', items: { create: [{ orderItemId: order.items[0].id, quantity: 1 }] } } });
  const refundA = await prisma.refund.create({ data: { orderId: order.id, paymentId: payment.id, returnRequestId: returnA.id, amount: firstRefundAmount, reason: 'a', status: 'succeeded', processedAt: new Date(), providerRefundReference: 'ceil-a' } });
  const refundB = await prisma.refund.create({ data: { orderId: order.id, paymentId: payment.id, returnRequestId: returnB.id, amount: secondRefundAmount, reason: 'b', status: 'pending' } });
  return { product, order, payment, returnA, returnB, refundA, refundB };
}

// Order (line 500 × 2 → total/attributable 1000) with a `processing` return
// refund (return A, full line) plus a pending return refund (return B, full line).
async function makeProcessingReturnFixture({ processingAmount = 600, pendingAmount } = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const product = await prisma.product.create({
    data: {
      name: `${MARKER} proc ${suffix}`, slug: `refund-adjust-proc-${suffix}`, description: 'x',
      price: 500, category: 'jersey', sport: 'basketball', images: [], active: true,
      totalStock: 99, sizes: { create: [{ size: 'M', stock: 99 }] },
    },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: `PS-${MARKER}-PROC-${suffix}`, email: 'refund-adjust-proc@example.com',
      shipToFullName: 'Test Buyer', shipToPhone: '09171234567', shipToAddress: '1 St',
      shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
      subtotal: 1000, shippingFee: 0, discountAmount: 0, total: 1000,
      paymentStatus: 'paid', orderStatus: 'delivered',
      items: { create: [{ productId: product.id, name: product.name, price: 500, quantity: 2, size: 'M', image: 'x.jpg' }] },
    },
    include: { items: true },
  });
  const payment = await prisma.payment.create({ data: { orderId: order.id, provider: 'epaygames', status: 'succeeded', paidAt: new Date() } });
  const returnA = await prisma.returnRequest.create({ data: { orderId: order.id, reason: 'a', status: 'refund_pending', items: { create: [{ orderItemId: order.items[0].id, quantity: 2 }] } } });
  const returnB = await prisma.returnRequest.create({ data: { orderId: order.id, reason: 'b', status: 'refund_pending', items: { create: [{ orderItemId: order.items[0].id, quantity: 2 }] } } });
  const refundA = await prisma.refund.create({ data: { orderId: order.id, paymentId: payment.id, returnRequestId: returnA.id, amount: processingAmount, reason: 'a', status: 'processing', processedAt: new Date() } });
  const refundB = await prisma.refund.create({ data: { orderId: order.id, paymentId: payment.id, returnRequestId: returnB.id, amount: pendingAmount, reason: 'b', status: 'pending' } });
  return { product, order, payment, returnA, returnB, refundA, refundB };
}

// One return (line 500 × 2, attributable 1000) carrying BOTH a `processing`
// refund and a pending refund on the same returnRequestId.
async function makeSameReturnProcessingFixture({ processingAmount = 300, pendingAmount = 500 } = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const product = await prisma.product.create({
    data: {
      name: `${MARKER} same ${suffix}`, slug: `refund-adjust-same-${suffix}`, description: 'x',
      price: 500, category: 'jersey', sport: 'basketball', images: [], active: true,
      totalStock: 99, sizes: { create: [{ size: 'M', stock: 99 }] },
    },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: `PS-${MARKER}-SAME-${suffix}`, email: 'refund-adjust-same@example.com',
      shipToFullName: 'Test Buyer', shipToPhone: '09171234567', shipToAddress: '1 St',
      shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
      subtotal: 1000, shippingFee: 0, discountAmount: 0, total: 1000,
      paymentStatus: 'paid', orderStatus: 'delivered',
      items: { create: [{ productId: product.id, name: product.name, price: 500, quantity: 2, size: 'M', image: 'x.jpg' }] },
    },
    include: { items: true },
  });
  const payment = await prisma.payment.create({ data: { orderId: order.id, provider: 'epaygames', status: 'succeeded', paidAt: new Date() } });
  const returnRequest = await prisma.returnRequest.create({ data: { orderId: order.id, reason: 'same', status: 'refund_pending', items: { create: [{ orderItemId: order.items[0].id, quantity: 2 }] } } });
  const refundA = await prisma.refund.create({ data: { orderId: order.id, paymentId: payment.id, returnRequestId: returnRequest.id, amount: processingAmount, reason: 'processing', status: 'processing', processedAt: new Date() } });
  const refundB = await prisma.refund.create({ data: { orderId: order.id, paymentId: payment.id, returnRequestId: returnRequest.id, amount: pendingAmount, reason: 'pending', status: 'pending' } });
  return { product, order, payment, returnRequest, refundA, refundB };
}

async function cleanup(fixture) {
  const { order } = fixture;
  await prisma.orderEvent.deleteMany({ where: { orderId: order.id } });
  await prisma.returnItem.deleteMany({ where: { returnRequest: { orderId: order.id } } });
  await prisma.returnRequest.deleteMany({ where: { orderId: order.id } });
  await prisma.stockAdjustment.deleteMany({ where: { relatedOrderId: order.id } });
  await prisma.refund.deleteMany({ where: { orderId: order.id } });
  await prisma.payment.deleteMany({ where: { orderId: order.id } });
  await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
  await prisma.order.delete({ where: { id: order.id } });
  if (fixture.product) await prisma.product.delete({ where: { id: fixture.product.id } });
}

async function adjust(refundId, body) {
  return request(app).post(`/api/admin/refunds/${refundId}/adjust`).send(body);
}

async function adjustEvents(orderId) {
  return prisma.orderEvent.findMany({ where: { orderId, type: 'refund_adjusted' } });
}

describe('POST /admin/refunds/:id/adjust — recompute and explicit adjustments', () => {
  it('recomputes an overstated pending return refund down to the attributable amount, with audit metadata', async () => {
    // subtotal 1000, no discount → attributable 1000; stored refund is overstated at 2000.
    const fixture = await makeReturnFixture({ refundAmount: 2000 });
    try {
      const res = await adjust(fixture.refund.id, { externalPayment: 'none', recompute: true, reason: 'corrected to attributable value' });
      expect(res.status).toBe(200);
      expect(res.body.data.amount).toBe(1000);

      const events = await adjustEvents(fixture.order.id);
      expect(events).toHaveLength(1);
      expect(events[0].actor).toBe('admin');
      expect(events[0].actorUserId).toBe(FINANCE_ID);
      expect(events[0].metadata.fromAmount).toBe(2000);
      expect(events[0].metadata.toAmount).toBe(1000);
      expect(events[0].metadata.reason).toBe('corrected to attributable value');
      expect(events[0].metadata.externalPayment).toBe('none');
      expect(events[0].metadata.recomputed).toBe(true);
    } finally {
      await cleanup(fixture);
    }
  }, 45000);

  it('accepts a valid explicit amount within the ceiling', async () => {
    const fixture = await makeReturnFixture({ refundAmount: 1000 });
    try {
      const res = await adjust(fixture.refund.id, { externalPayment: 'none', amount: 600, reason: 'goodwill partial' });
      expect(res.status).toBe(200);
      expect(res.body.data.amount).toBe(600);

      const events = await adjustEvents(fixture.order.id);
      expect(events).toHaveLength(1);
      expect(events[0].metadata.toAmount).toBe(600);
      expect(events[0].metadata.recomputed).toBe(false);
      expect(events[0].metadata.externalPayment).toBe('none');
    } finally {
      await cleanup(fixture);
    }
  }, 45000);

  it('rejects an explicit amount above the attributable ceiling and writes nothing', async () => {
    const fixture = await makeReturnFixture({ refundAmount: 1000 });
    try {
      const res = await adjust(fixture.refund.id, { externalPayment: 'none', amount: 1200, reason: 'too much' });
      expect(res.status).toBe(422);
      expect((await prisma.refund.findUnique({ where: { id: fixture.refund.id } })).amount).toBe(1000);
      expect(await adjustEvents(fixture.order.id)).toHaveLength(0);
    } finally {
      await cleanup(fixture);
    }
  }, 45000);

  it('rejects an adjustment that changes nothing', async () => {
    const fixture = await makeReturnFixture({ refundAmount: 1000 });
    try {
      const res = await adjust(fixture.refund.id, { externalPayment: 'none', amount: 1000, reason: 'no change' });
      expect(res.status).toBe(409);
      expect(await adjustEvents(fixture.order.id)).toHaveLength(0);
    } finally {
      await cleanup(fixture);
    }
  }, 45000);
});

describe('POST /admin/refunds/:id/adjust — already_sent reconciliation', () => {
  it('sets the amount to the declared external amount within the ceiling and audits the mode', async () => {
    const fixture = await makeReturnFixture({ refundAmount: 1000 });
    try {
      const res = await adjust(fixture.refund.id, { externalPayment: 'already_sent', externalAmount: 900, reason: 'bank statement confirms 900' });
      expect(res.status).toBe(200);
      expect(res.body.data.amount).toBe(900);

      const events = await adjustEvents(fixture.order.id);
      expect(events).toHaveLength(1);
      expect(events[0].metadata.externalPayment).toBe('already_sent');
      expect(events[0].metadata.externalAmount).toBe(900);
      expect(events[0].metadata.recomputed).toBe(false);
    } finally {
      await cleanup(fixture);
    }
  }, 45000);

  it('cannot exceed the ceiling via already_sent (not a general override)', async () => {
    const fixture = await makeReturnFixture({ refundAmount: 1000 });
    try {
      const res = await adjust(fixture.refund.id, { externalPayment: 'already_sent', externalAmount: 1500, reason: 'over' });
      expect(res.status).toBe(422);
      expect((await prisma.refund.findUnique({ where: { id: fixture.refund.id } })).amount).toBe(1000);
      expect(await adjustEvents(fixture.order.id)).toHaveLength(0);
    } finally {
      await cleanup(fixture);
    }
  }, 45000);

  it('requires externalAmount and a reason, and rejects mixing in amount/recompute', async () => {
    const fixture = await makeReturnFixture({ refundAmount: 1000 });
    try {
      expect((await adjust(fixture.refund.id, { externalPayment: 'already_sent', reason: 'x' })).status).toBe(400);
      expect((await adjust(fixture.refund.id, { externalPayment: 'already_sent', externalAmount: 900 })).status).toBe(400);
      expect((await adjust(fixture.refund.id, { externalPayment: 'already_sent', externalAmount: 900, amount: 800, reason: 'x' })).status).toBe(400);
      expect((await adjust(fixture.refund.id, { externalPayment: 'already_sent', externalAmount: 900, recompute: true, reason: 'x' })).status).toBe(400);
      expect(await adjustEvents(fixture.order.id)).toHaveLength(0);
    } finally {
      await cleanup(fixture);
    }
  }, 45000);
});

describe('POST /admin/refunds/:id/adjust — ceilings and eligibility', () => {
  it('bounds a cancellation (non-return) refund by the order-level ceiling', async () => {
    const fixture = await makeCancelFixture({ total: 1000, refundAmount: 1000 });
    try {
      const ok = await adjust(fixture.refund.id, { externalPayment: 'none', amount: 800, reason: 'partial goodwill' });
      expect(ok.status).toBe(200);
      expect(ok.body.data.amount).toBe(800);

      const tooBig = await adjust(fixture.refund.id, { externalPayment: 'none', amount: 1200, reason: 'over' });
      expect(tooBig.status).toBe(422);
    } finally {
      await cleanup(fixture);
    }
  }, 45000);

  it('adjusts a failed refund but rejects succeeded and processing refunds, immutably', async () => {
    const failed = await makeReturnFixture({ refundAmount: 1000, refundStatus: 'failed' });
    const succeeded = await makeReturnFixture({ refundAmount: 1000, refundStatus: 'succeeded' });
    const processing = await makeReturnFixture({ refundAmount: 1000, refundStatus: 'processing' });
    try {
      expect((await adjust(failed.refund.id, { externalPayment: 'none', amount: 500, reason: 'correction' })).status).toBe(200);

      const succeededRes = await adjust(succeeded.refund.id, { externalPayment: 'none', amount: 500, reason: 'nope' });
      expect(succeededRes.status).toBe(409);
      expect((await prisma.refund.findUnique({ where: { id: succeeded.refund.id } })).amount).toBe(1000);
      expect(await adjustEvents(succeeded.order.id)).toHaveLength(0);

      const processingRes = await adjust(processing.refund.id, { externalPayment: 'none', amount: 500, reason: 'nope' });
      expect(processingRes.status).toBe(409);
    } finally {
      await cleanup(failed);
      await cleanup(succeeded);
      await cleanup(processing);
    }
  }, 30000);

  it('rejects recompute on a cancellation refund and malformed "none" bodies', async () => {
    const cancel = await makeCancelFixture({ total: 1000, refundAmount: 1000 });
    const ret = await makeReturnFixture({ refundAmount: 1000 });
    try {
      expect((await adjust(cancel.refund.id, { externalPayment: 'none', recompute: true, reason: 'x' })).status).toBe(400);
      expect((await adjust(ret.refund.id, { externalPayment: 'none', reason: 'x' })).status).toBe(400); // neither recompute nor amount
      expect((await adjust(ret.refund.id, { externalPayment: 'none', recompute: true, amount: 500, reason: 'x' })).status).toBe(400); // both
      expect((await adjust(ret.refund.id, { externalPayment: 'bogus', amount: 500, reason: 'x' })).status).toBe(400); // bad mode
      expect((await adjust(ret.refund.id, { externalPayment: 'none', amount: 500 })).status).toBe(400); // no reason
    } finally {
      await cleanup(cancel);
      await cleanup(ret);
    }
  }, 45000);
});

describe('POST /admin/refunds/:id/adjust — authorization', () => {
  it('denies support without refunds.manage (403) and writes nothing', async () => {
    const fixture = await makeReturnFixture({ refundAmount: 1000 });
    try {
      asSupport();
      const res = await adjust(fixture.refund.id, { externalPayment: 'none', amount: 500, reason: 'x' });
      expect(res.status).toBe(403);
      expect((await prisma.refund.findUnique({ where: { id: fixture.refund.id } })).amount).toBe(1000);
    } finally {
      await cleanup(fixture);
    }
  }, 45000);
});

describe('POST /admin/refunds/:id/adjust — concurrency', () => {
  it('two concurrent adjustments of the same refund result in exactly one apply and one event', async () => {
    const fixture = await makeReturnFixture({ refundAmount: 2000 });
    try {
      const body = { externalPayment: 'none', recompute: true, reason: 'concurrent recompute' };
      const [a, b] = await Promise.all([adjust(fixture.refund.id, body), adjust(fixture.refund.id, body)]);
      expect([a.status, b.status].sort((x, y) => x - y)).toEqual([200, 409]);
      expect((await prisma.refund.findUnique({ where: { id: fixture.refund.id } })).amount).toBe(1000);
      expect(await adjustEvents(fixture.order.id)).toHaveLength(1);
    } finally {
      await cleanup(fixture);
    }
  }, 30000);

  it('an adjustment racing a recording never leaves a succeeded refund with a stale amount', async () => {
    // total 1150 (shipping 150), attributable 1000 → ceiling 1000.
    const fixture = await makeReturnFixture({ refundAmount: 1000, shippingFee: 150 });
    try {
      const [adjustRes, recordRes] = await Promise.all([
        adjust(fixture.refund.id, { externalPayment: 'none', amount: 600, reason: 'race adjust' }),
        request(app).post(`/api/admin/refunds/${fixture.refund.id}/record`).send({ confirmCompleted: true, externalAmount: 1000 }),
      ]);
      expect([200, 409]).toContain(adjustRes.status);
      expect([200, 400]).toContain(recordRes.status);

      const finalRefund = await prisma.refund.findUnique({ where: { id: fixture.refund.id } });
      if (finalRefund.status === 'succeeded') {
        // Recording only succeeds when the declared amount matched the
        // authoritative amount under the lock, so the amount is never stale.
        expect(recordRes.status).toBe(200);
        expect(finalRefund.amount).toBe(1000);
      } else {
        // The adjustment landed first, so the recording's now-stale
        // externalAmount was rejected with a mismatch.
        expect(finalRefund.status).toBe('pending');
        expect(finalRefund.amount).toBe(600);
        expect(recordRes.status).toBe(400);
      }
      expect((await adjustEvents(fixture.order.id)).length).toBeLessThanOrEqual(1);
    } finally {
      await cleanup(fixture);
    }
  }, 30000);
});

describe('POST /admin/refunds/:id/adjust — per-return attributable ceiling (multiple returns)', () => {
  it("rejects an adjustment above the return's OWN attributable value and accepts one at it", async () => {
    // Return B's own attributable is 500; order-wide remaining after R1's
    // succeeded 300 is 700 — so the 600 rejection is the per-return bound.
    const over = await makeTwoReturnCeilingFixture({ secondRefundAmount: 1000 });
    try {
      const res = await adjust(over.refundB.id, { externalPayment: 'none', amount: 600, reason: 'over this return' });
      expect(res.status).toBe(422);
      expect((await prisma.refund.findUnique({ where: { id: over.refundB.id } })).amount).toBe(1000);
      expect(await adjustEvents(over.order.id)).toHaveLength(0);
    } finally {
      await cleanup(over);
    }

    const ok = await makeTwoReturnCeilingFixture({ secondRefundAmount: 1000 });
    try {
      const res = await adjust(ok.refundB.id, { externalPayment: 'none', amount: 500, reason: 'exactly this return' });
      expect(res.status).toBe(200);
      expect(res.body.data.amount).toBe(500);
    } finally {
      await cleanup(ok);
    }
  }, 60000);
});

describe('POST /admin/refunds/:id/adjust — processing refunds consume capacity (F3)', () => {
  it('bounds an adjustment by the capacity left after a processing return refund', async () => {
    const over = await makeProcessingReturnFixture({ processingAmount: 600, pendingAmount: 1000 });
    try {
      expect((await adjust(over.refundB.id, { externalPayment: 'none', amount: 500, reason: 'over capacity' })).status).toBe(422);
    } finally {
      await cleanup(over);
    }

    const ok = await makeProcessingReturnFixture({ processingAmount: 600, pendingAmount: 1000 });
    try {
      const res = await adjust(ok.refundB.id, { externalPayment: 'none', amount: 400, reason: 'within capacity' });
      expect(res.status).toBe(200);
      expect(res.body.data.amount).toBe(400);
    } finally {
      await cleanup(ok);
    }
  }, 60000);

  it('refuses to adjust a refund whose own return already has a processing refund (409)', async () => {
    const fixture = await makeSameReturnProcessingFixture({ processingAmount: 300, pendingAmount: 1000 });
    try {
      const res = await adjust(fixture.refundB.id, { externalPayment: 'none', amount: 500, reason: 'ambiguous' });
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/processing/i);
      expect((await prisma.refund.findUnique({ where: { id: fixture.refundB.id } })).amount).toBe(1000);
    } finally {
      await cleanup(fixture);
    }
  }, 30000);
});
