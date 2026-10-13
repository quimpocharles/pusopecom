import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

/**
 * Stage 2, Step 4 — recording hardening (POST /admin/refunds/:id/record):
 * externalAmount equality, both ceilings, the per-return duplicate guard,
 * correction-note authority, length caps, concurrency, and rollback on a
 * failed refund_recorded write.
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

const MARKER = `RefundRecordHardening${Date.now()}`;
const FINANCE_ID = `${MARKER}-finance`;

function asFinance() {
  currentUser = { _id: FINANCE_ID, role: 'admin', staffProfile: { department: 'finance', active: true, permissions: [] } };
}

beforeAll(async () => {
  await prisma.user.create({
    data: { id: FINANCE_ID, email: `${FINANCE_ID}@test.local`, firstName: 'Fin', lastName: 'Ance', role: 'admin' },
  });
}, 20000);

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: FINANCE_ID } });
  await prisma.$disconnect();
});

beforeEach(() => asFinance());

async function makeReturnFixture({
  price = 500, quantity = 2, discountAmount = 0, shippingFee = 0,
  refundAmount, refundStatus = 'pending', returnQuantity = quantity, returnStatus = 'refund_pending',
} = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const product = await prisma.product.create({
    data: {
      name: `${MARKER} ${suffix}`, slug: `refund-hardening-${suffix}`, description: 'x',
      price, category: 'jersey', sport: 'basketball', images: [], active: true,
      totalStock: 99, sizes: { create: [{ size: 'M', stock: 99 }] },
    },
  });
  const subtotal = price * quantity;
  const order = await prisma.order.create({
    data: {
      orderNumber: `PS-${MARKER}-${suffix}`, email: 'refund-hardening@example.com',
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
      orderId: order.id, reason: 'Wrong size', status: returnStatus,
      items: { create: [{ orderItemId: order.items[0].id, quantity: returnQuantity }] },
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
      orderNumber: `PS-${MARKER}-C-${suffix}`, email: 'refund-hardening-cancel@example.com',
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

// One order, two separate return requests each covering the full line (qty 2),
// each with its own pending refund — for the multi-refund concurrency ceiling
// test. Each return's own attributable is 1000, so the order-wide remaining
// capacity (1000 − prior succeeded) is what bounds the second recording.
async function makeTwoReturnFixture({ shippingFee = 150, refundAmount = 600 } = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const product = await prisma.product.create({
    data: {
      name: `${MARKER} two ${suffix}`, slug: `refund-hardening-two-${suffix}`, description: 'x',
      price: 500, category: 'jersey', sport: 'basketball', images: [], active: true,
      totalStock: 99, sizes: { create: [{ size: 'M', stock: 99 }] },
    },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: `PS-${MARKER}-T-${suffix}`, email: 'refund-hardening-two@example.com',
      shipToFullName: 'Test Buyer', shipToPhone: '09171234567', shipToAddress: '1 St',
      shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
      subtotal: 1000, shippingFee, discountAmount: 0, total: 1000 + shippingFee,
      paymentStatus: 'paid', orderStatus: 'delivered',
      items: { create: [{ productId: product.id, name: product.name, price: 500, quantity: 2, size: 'M', image: 'x.jpg' }] },
    },
    include: { items: true },
  });
  const payment = await prisma.payment.create({
    data: { orderId: order.id, provider: 'epaygames', status: 'succeeded', paidAt: new Date() },
  });
  const returnA = await prisma.returnRequest.create({
    data: { orderId: order.id, reason: 'a', status: 'refund_pending', items: { create: [{ orderItemId: order.items[0].id, quantity: 2 }] } },
  });
  const returnB = await prisma.returnRequest.create({
    data: { orderId: order.id, reason: 'b', status: 'refund_pending', items: { create: [{ orderItemId: order.items[0].id, quantity: 2 }] } },
  });
  const refundA = await prisma.refund.create({ data: { orderId: order.id, paymentId: payment.id, returnRequestId: returnA.id, amount: refundAmount, reason: 'a', status: 'pending' } });
  const refundB = await prisma.refund.create({ data: { orderId: order.id, paymentId: payment.id, returnRequestId: returnB.id, amount: refundAmount, reason: 'b', status: 'pending' } });
  return { product, order, payment, returns: [returnA, returnB], refunds: [refundA, refundB] };
}

// One order (line 500 × 2 → total/attributable 1000) with two return requests on
// the same line, one unit each (each return's own attributable is 500). Return
// A's refund is succeeded; return B holds a pending refund for `secondRefundAmount`.
// Proves a return refund is bounded by its OWN return's attributable value, not
// merely the order-wide one (order-wide remaining here is 700).
async function makeTwoReturnCeilingFixture({ firstRefundAmount = 300, secondRefundAmount } = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const product = await prisma.product.create({
    data: {
      name: `${MARKER} ceil ${suffix}`, slug: `refund-ceiling-${suffix}`, description: 'x',
      price: 500, category: 'jersey', sport: 'basketball', images: [], active: true,
      totalStock: 99, sizes: { create: [{ size: 'M', stock: 99 }] },
    },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: `PS-${MARKER}-CEIL-${suffix}`, email: 'refund-ceiling@example.com',
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
// refund (return A, full line) plus a pending return refund (return B, full
// line). The processing refund's capacity must not be double-spent.
async function makeProcessingReturnFixture({ processingAmount = 600, pendingAmount } = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const product = await prisma.product.create({
    data: {
      name: `${MARKER} proc ${suffix}`, slug: `refund-processing-${suffix}`, description: 'x',
      price: 500, category: 'jersey', sport: 'basketball', images: [], active: true,
      totalStock: 99, sizes: { create: [{ size: 'M', stock: 99 }] },
    },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: `PS-${MARKER}-PROC-${suffix}`, email: 'refund-processing@example.com',
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

// Order (total 1000, cancelled) with a `processing` cancellation refund plus a
// pending cancellation refund.
async function makeProcessingCancelFixture({ processingAmount = 1000, pendingAmount } = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const order = await prisma.order.create({
    data: {
      orderNumber: `PS-${MARKER}-PC-${suffix}`, email: 'refund-processing-cancel@example.com',
      shipToFullName: 'Test Buyer', shipToPhone: '09171234567', shipToAddress: '1 St',
      shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
      subtotal: 1000, shippingFee: 0, discountAmount: 0, total: 1000,
      paymentStatus: 'paid', orderStatus: 'cancelled',
    },
  });
  const payment = await prisma.payment.create({ data: { orderId: order.id, provider: 'epaygames', status: 'succeeded', paidAt: new Date() } });
  const refundA = await prisma.refund.create({ data: { orderId: order.id, paymentId: payment.id, amount: processingAmount, reason: 'processing cancel', status: 'processing', processedAt: new Date() } });
  const refundB = await prisma.refund.create({ data: { orderId: order.id, paymentId: payment.id, amount: pendingAmount, reason: 'pending cancel', status: 'pending' } });
  return { order, payment, refundA, refundB };
}

// One return (line 500 × 2, attributable 1000) carrying BOTH a `processing`
// refund and a pending refund on the same returnRequestId — the ambiguous
// live-claim case that must be refused rather than guessed.
async function makeSameReturnProcessingFixture({ processingAmount = 300, pendingAmount = 500 } = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const product = await prisma.product.create({
    data: {
      name: `${MARKER} same ${suffix}`, slug: `refund-same-${suffix}`, description: 'x',
      price: 500, category: 'jersey', sport: 'basketball', images: [], active: true,
      totalStock: 99, sizes: { create: [{ size: 'M', stock: 99 }] },
    },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: `PS-${MARKER}-SAME-${suffix}`, email: 'refund-same@example.com',
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

// Order (total 1000, cancelled) with a `processing` cancellation refund plus two
// pending cancellation refunds — for the processing-aware concurrency race.
async function makeProcessingCancelRaceFixture({ processingAmount = 600, eachPending = 400 } = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const order = await prisma.order.create({
    data: {
      orderNumber: `PS-${MARKER}-PCR-${suffix}`, email: 'refund-processing-race@example.com',
      shipToFullName: 'Test Buyer', shipToPhone: '09171234567', shipToAddress: '1 St',
      shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
      subtotal: 1000, shippingFee: 0, discountAmount: 0, total: 1000,
      paymentStatus: 'paid', orderStatus: 'cancelled',
    },
  });
  const payment = await prisma.payment.create({ data: { orderId: order.id, provider: 'epaygames', status: 'succeeded', paidAt: new Date() } });
  await prisma.refund.create({ data: { orderId: order.id, paymentId: payment.id, amount: processingAmount, reason: 'processing', status: 'processing', processedAt: new Date() } });
  const refundA = await prisma.refund.create({ data: { orderId: order.id, paymentId: payment.id, amount: eachPending, reason: 'a', status: 'pending' } });
  const refundB = await prisma.refund.create({ data: { orderId: order.id, paymentId: payment.id, amount: eachPending, reason: 'b', status: 'pending' } });
  return { order, payment, refunds: [refundA, refundB] };
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

function record(refundId, body) {
  return request(app).post(`/api/admin/refunds/${refundId}/record`).send(body);
}

async function recordedEvents(orderId) {
  return prisma.orderEvent.count({ where: { orderId, type: 'refund_recorded' } });
}

describe('record hardening — externalAmount', () => {
  it('requires externalAmount', async () => {
    const fixture = await makeReturnFixture({ refundAmount: 1000 });
    try {
      const res = await record(fixture.refund.id, { confirmCompleted: true });
      expect(res.status).toBe(400);
      expect((await prisma.refund.findUnique({ where: { id: fixture.refund.id } })).status).toBe('pending');
      expect(await recordedEvents(fixture.order.id)).toBe(0);
    } finally {
      await cleanup(fixture);
    }
  }, 20000);

  it('rejects a centavo mismatch between externalAmount and the refund amount', async () => {
    const fixture = await makeReturnFixture({ refundAmount: 1000 });
    try {
      const res = await record(fixture.refund.id, { confirmCompleted: true, externalAmount: 999.99 });
      expect(res.status).toBe(400);
      expect((await prisma.refund.findUnique({ where: { id: fixture.refund.id } })).status).toBe('pending');
      expect(await recordedEvents(fixture.order.id)).toBe(0);
    } finally {
      await cleanup(fixture);
    }
  }, 20000);
});

describe('record hardening — ceilings', () => {
  it('rejects a return refund above the attributable merchandise ceiling (below the order-level one) with 422', async () => {
    // subtotal 1000, shipping 150 → total 1150, attributable 1000.
    const fixture = await makeReturnFixture({ shippingFee: 150, refundAmount: 1100 });
    try {
      const res = await record(fixture.refund.id, { confirmCompleted: true, externalAmount: 1100 });
      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/returned items/i);
      expect((await prisma.refund.findUnique({ where: { id: fixture.refund.id } })).status).toBe('pending');
      expect(await recordedEvents(fixture.order.id)).toBe(0);
    } finally {
      await cleanup(fixture);
    }
  }, 20000);

  it('rejects a cancellation refund above the order-level ceiling with 422', async () => {
    const fixture = await makeCancelFixture({ total: 1000, refundAmount: 1200 });
    try {
      const res = await record(fixture.refund.id, { confirmCompleted: true, externalAmount: 1200 });
      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/amount actually paid/i);
      expect((await prisma.refund.findUnique({ where: { id: fixture.refund.id } })).status).toBe('pending');
    } finally {
      await cleanup(fixture);
    }
  }, 20000);
});

describe('record hardening — guards and validation', () => {
  it('rejects a second success for the same returnRequestId (409)', async () => {
    const fixture = await makeReturnFixture({ refundAmount: 500 });
    try {
      // A prior succeeded refund already exists for this return; the pending
      // refund on the same return must not also record.
      await prisma.refund.update({ where: { id: fixture.refund.id }, data: { status: 'succeeded', processedAt: new Date() } });
      const extra = await prisma.refund.create({
        data: { orderId: fixture.order.id, returnRequestId: fixture.returnRequest.id, amount: 500, reason: 'dup', status: 'pending' },
      });

      const res = await record(extra.id, { confirmCompleted: true, externalAmount: 500 });
      expect(res.status).toBe(409);
      expect(await prisma.refund.count({ where: { returnRequestId: fixture.returnRequest.id, status: 'succeeded' } })).toBe(1);
    } finally {
      await cleanup(fixture);
    }
  }, 20000);

  it('caps providerReference at 255 and note at 1000 characters', async () => {
    const fixture = await makeReturnFixture({ refundAmount: 500 });
    try {
      expect((await record(fixture.refund.id, { confirmCompleted: true, externalAmount: 500, providerReference: 'x'.repeat(256) })).status)
        .toBe(400);
      expect((await record(fixture.refund.id, { confirmCompleted: true, externalAmount: 500, note: 'y'.repeat(1001) })).status)
        .toBe(400);
      expect((await prisma.refund.findUnique({ where: { id: fixture.refund.id } })).status).toBe('pending');
      expect(await recordedEvents(fixture.order.id)).toBe(0);
    } finally {
      await cleanup(fixture);
    }
  }, 20000);

  it('records once and rejects a retry for the same return (no duplicate success)', async () => {
    const fixture = await makeReturnFixture({ refundAmount: 500 });
    try {
      const first = await record(fixture.refund.id, { confirmCompleted: true, externalAmount: 500 });
      expect(first.status).toBe(200);
      const retry = await record(fixture.refund.id, { confirmCompleted: true, externalAmount: 500 });
      expect(retry.status).toBe(409);
      expect(await prisma.refund.count({ where: { returnRequestId: fixture.returnRequest.id, status: 'succeeded' } })).toBe(1);
      expect(await recordedEvents(fixture.order.id)).toBe(1);
    } finally {
      await cleanup(fixture);
    }
  }, 20000);
});

describe('record hardening — atomicity', () => {
  it('rolls back the refund status update when the refund_recorded event write fails', async () => {
    const fixture = await makeReturnFixture({ refundAmount: 500 });
    try {
      // OrderEvent.actorUserId is a real FK to users.id — pointing it at a
      // non-existent user makes the event insert fail inside the transaction,
      // after the refund update has already run.
      currentUser = { _id: '00000000-0000-0000-0000-000000000000', role: 'admin', staffProfile: { department: 'finance', active: true, permissions: [] } };

      const res = await record(fixture.refund.id, { confirmCompleted: true, externalAmount: 500 });
      expect(res.status).toBe(500);

      const after = await prisma.refund.findUnique({ where: { id: fixture.refund.id } });
      expect(after.status).toBe('pending'); // rolled back
      expect(after.processedAt).toBeNull();
      expect(await recordedEvents(fixture.order.id)).toBe(0);
    } finally {
      await cleanup(fixture);
    }
  }, 20000);
});

describe('record hardening — concurrency', () => {
  it('two different pending refunds on one order cannot both record past the attributable ceiling', async () => {
    // total 1150, attributable 1000; each refund 600 → 600 + 600 > 1000.
    const fixture = await makeTwoReturnFixture({ shippingFee: 150, refundAmount: 600 });
    try {
      const [a, b] = await Promise.all([
        record(fixture.refunds[0].id, { confirmCompleted: true, externalAmount: 600 }),
        record(fixture.refunds[1].id, { confirmCompleted: true, externalAmount: 600 }),
      ]);
      expect([a.status, b.status].sort((x, y) => x - y)).toEqual([200, 422]);
      expect(await prisma.refund.count({ where: { orderId: fixture.order.id, status: 'succeeded' } })).toBe(1);
      expect(await recordedEvents(fixture.order.id)).toBe(1);
    } finally {
      await cleanup(fixture);
    }
  }, 30000);

  it('an adjustment racing a recording never leaves a succeeded refund whose amount differs from the declared external amount', async () => {
    const fixture = await makeCancelFixture({ total: 1000, refundAmount: 1000 });
    try {
      const [adjustRes, recordRes] = await Promise.all([
        request(app).post(`/api/admin/refunds/${fixture.refund.id}/adjust`)
          .send({ externalPayment: 'none', amount: 600, reason: 'race adjust' }),
        record(fixture.refund.id, { confirmCompleted: true, externalAmount: 1000 }),
      ]);
      expect([200, 409]).toContain(adjustRes.status);
      expect([200, 400]).toContain(recordRes.status);

      const final = await prisma.refund.findUnique({ where: { id: fixture.refund.id } });
      if (final.status === 'succeeded') {
        // The recording only ever succeeds when the declared amount matched the
        // authoritative amount under the lock — so a succeeded refund's amount
        // is exactly the externalAmount that was validated.
        expect(recordRes.status).toBe(200);
        expect(final.amount).toBe(1000);
        expect(await recordedEvents(fixture.order.id)).toBe(1);
      } else {
        // The adjustment landed first, changing the amount so the recording's
        // now-stale externalAmount was rejected.
        expect(final.status).toBe('pending');
        expect(final.amount).toBe(600);
        expect(recordRes.status).toBe(400);
        expect(await recordedEvents(fixture.order.id)).toBe(0);
      }
    } finally {
      await cleanup(fixture);
    }
  }, 30000);
});

describe('record hardening — per-return attributable ceiling (multiple returns)', () => {
  it("rejects a refund above the return's OWN attributable value and records one at that value", async () => {
    // Return B's own attributable is 500 (one of two units). Return A already
    // succeeded 300, so the order-wide remaining is 700 — the 600 rejection is
    // specifically the per-return bound, not the order-wide one.
    const over = await makeTwoReturnCeilingFixture({ secondRefundAmount: 600 });
    try {
      const res = await record(over.refundB.id, { confirmCompleted: true, externalAmount: 600 });
      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/returned items/i);
      // Only return A's pre-existing succeeded refund exists; nothing recorded.
      expect(await prisma.refund.count({ where: { orderId: over.order.id, status: 'succeeded' } })).toBe(1);
      expect(await recordedEvents(over.order.id)).toBe(0);
    } finally {
      await cleanup(over);
    }

    // A valid independent return at its own attributable value records cleanly.
    const ok = await makeTwoReturnCeilingFixture({ secondRefundAmount: 500 });
    try {
      const res = await record(ok.refundB.id, { confirmCompleted: true, externalAmount: 500 });
      expect(res.status).toBe(200);
      expect((await prisma.refund.findUnique({ where: { id: ok.refundB.id } })).status).toBe('succeeded');
    } finally {
      await cleanup(ok);
    }
  }, 60000);
});

describe('record hardening — processing refunds consume capacity (F3)', () => {
  it('blocks a cancellation refund whose order capacity is committed to a processing refund', async () => {
    const fixture = await makeProcessingCancelFixture({ processingAmount: 1000, pendingAmount: 500 });
    try {
      const res = await record(fixture.refundB.id, { confirmCompleted: true, externalAmount: 500 });
      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/amount actually paid/i);
      expect(await prisma.refund.count({ where: { orderId: fixture.order.id, status: 'succeeded' } })).toBe(0);
    } finally {
      await cleanup(fixture);
    }
  }, 30000);

  it('bounds a return refund by the capacity left after a processing return refund', async () => {
    const over = await makeProcessingReturnFixture({ processingAmount: 600, pendingAmount: 500 });
    try {
      expect((await record(over.refundB.id, { confirmCompleted: true, externalAmount: 500 })).status).toBe(422);
    } finally {
      await cleanup(over);
    }

    const ok = await makeProcessingReturnFixture({ processingAmount: 600, pendingAmount: 400 });
    try {
      expect((await record(ok.refundB.id, { confirmCompleted: true, externalAmount: 400 })).status).toBe(200);
    } finally {
      await cleanup(ok);
    }
  }, 60000);

  it('refuses to record a refund whose own return already has a processing refund (409)', async () => {
    const fixture = await makeSameReturnProcessingFixture();
    try {
      const res = await record(fixture.refundB.id, { confirmCompleted: true, externalAmount: 500 });
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/processing/i);
      expect((await prisma.refund.findUnique({ where: { id: fixture.refundB.id } })).status).toBe('pending');
    } finally {
      await cleanup(fixture);
    }
  }, 30000);
});

describe('record hardening — processing-aware concurrency', () => {
  it('two concurrent records cannot both consume the capacity a processing refund leaves', async () => {
    const fixture = await makeProcessingCancelRaceFixture({ processingAmount: 600, eachPending: 400 });
    try {
      const [a, b] = await Promise.all([
        record(fixture.refunds[0].id, { confirmCompleted: true, externalAmount: 400 }),
        record(fixture.refunds[1].id, { confirmCompleted: true, externalAmount: 400 }),
      ]);
      expect([a.status, b.status].sort((x, y) => x - y)).toEqual([200, 422]);
      expect(await prisma.refund.count({ where: { orderId: fixture.order.id, status: 'succeeded' } })).toBe(1);
    } finally {
      await cleanup(fixture);
    }
  }, 30000);
});
