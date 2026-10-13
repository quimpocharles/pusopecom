import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

/**
 * Stage 2, Step 5 — refund lifecycle completion inside the recording
 * transaction, plus the post-commit notifications.
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

const MARKER = `RefundLifecycle${Date.now()}`;
const ACTOR_ID = `${MARKER}-actor`; // Finance staffer: records AND receives exception notices
const CUSTOMER_ID = `${MARKER}-customer`;

function asActor() {
  currentUser = { _id: ACTOR_ID, role: 'admin', staffProfile: { department: 'finance', active: true, permissions: [] } };
}

let shared; // { org, venue, section, event, tier }

beforeAll(async () => {
  await prisma.user.create({
    data: { id: ACTOR_ID, email: `${ACTOR_ID}@test.local`, firstName: 'Fin', lastName: 'Ance', role: 'admin' },
  });
  await prisma.staffProfile.create({ data: { userId: ACTOR_ID, department: 'finance', active: true, permissions: [] } });
  await prisma.user.create({
    data: { id: CUSTOMER_ID, email: `${CUSTOMER_ID}@test.local`, firstName: 'Cus', lastName: 'Tomer', role: 'customer' },
  });

  const suffix = `${Date.now()}`;
  const org = await prisma.organization.create({ data: { name: `${MARKER} Org`, slug: `${MARKER.toLowerCase()}-org-${suffix}`, kind: 'institution' } });
  const venue = await prisma.venue.create({ data: { name: `${MARKER} Arena`, slug: `${MARKER.toLowerCase()}-arena-${suffix}`, address: '1 St', city: 'Pasay' } });
  const section = await prisma.venueSection.create({ data: { venueId: venue.id, name: 'GA' } });
  const event = await prisma.passEvent.create({
    data: { name: `${MARKER} Game`, slug: `${MARKER.toLowerCase()}-game-${suffix}`, organizationId: org.id, venueId: venue.id, startsAt: new Date(Date.now() + 86400000), endsAt: new Date(Date.now() + 90000000) },
  });
  const tier = await prisma.passTier.create({ data: { passEventId: event.id, venueSectionId: section.id, name: 'GA', price: 500, capacity: 50, sold: 0 } });
  const product = await prisma.product.create({
    data: {
      name: `${MARKER} Jersey`, slug: `${MARKER.toLowerCase()}-jersey-${suffix}`, description: 'x',
      price: 500, category: 'jersey', sport: 'basketball', images: [], active: true,
      totalStock: 100, sizes: { create: [{ size: 'M', stock: 100 }] },
    },
  });
  shared = { org, venue, section, event, tier, product };
}, 30000);

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { userId: { in: [ACTOR_ID, CUSTOMER_ID] } } });
  await prisma.staffProfile.deleteMany({ where: { userId: ACTOR_ID } });
  await prisma.user.deleteMany({ where: { id: { in: [ACTOR_ID, CUSTOMER_ID] } } });
  await prisma.passTier.deleteMany({ where: { passEventId: shared.event.id } });
  await prisma.passEvent.delete({ where: { id: shared.event.id } });
  await prisma.venueSection.deleteMany({ where: { venueId: shared.venue.id } });
  await prisma.venue.delete({ where: { id: shared.venue.id } });
  await prisma.organization.delete({ where: { id: shared.org.id } });
  await prisma.product.delete({ where: { id: shared.product.id } });
  await prisma.$disconnect();
});

beforeEach(() => asActor());

async function makeOrder({ userId = null, total = 1000, orderStatus = 'cancelled', withItem = false } = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const order = await prisma.order.create({
    data: {
      orderNumber: `PS-${MARKER}-${suffix}`, email: 'refund-lifecycle@example.com',
      shipToFullName: 'Test Buyer', shipToPhone: '09171234567', shipToAddress: '1 St',
      shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
      subtotal: total, shippingFee: 0, discountAmount: 0, total,
      userId, paymentStatus: 'paid', orderStatus,
      ...(withItem
        ? { items: { create: [{ productId: shared.product.id, name: 'Jersey', price: 500, quantity: 2, size: 'M', image: 'x.jpg' }] } }
        : {}),
    },
    include: { items: true },
  });
  const payment = await prisma.payment.create({ data: { orderId: order.id, provider: 'epaygames', status: 'succeeded', paidAt: new Date() } });
  return { order, payment };
}

async function makeRefund({ order, amount, returnRequestId = null, status = 'pending' }) {
  return prisma.refund.create({ data: { orderId: order.id, returnRequestId, amount, reason: 'test', status } });
}

async function makePass(order, status) {
  return prisma.pass.create({
    data: { orderId: order.id, passEventId: shared.event.id, passTierId: shared.tier.id, price: 500, status },
  });
}

// Return-origin fixture: an order with an item, a refund_pending return, a
// Shipment (status configurable) and a linked pending refund.
async function makeReturnRefund({ refundAmount = 400, shipmentStatus = 'refund_pending', returnStatus = 'refund_pending', total = 1000 } = {}) {
  const { order, payment } = await makeOrder({ total, orderStatus: 'delivered', withItem: true });
  const returnRequest = await prisma.returnRequest.create({
    data: { orderId: order.id, reason: 'Wrong size', status: returnStatus, items: { create: [{ orderItemId: order.items[0].id, quantity: 1 }] } },
  });
  const shipment = shipmentStatus
    ? await prisma.shipment.create({ data: { orderId: order.id, status: shipmentStatus } })
    : null;
  const refund = await makeRefund({ order, amount: refundAmount, returnRequestId: returnRequest.id });
  return { order, payment, returnRequest, shipment, refund };
}

async function cleanup(fixture) {
  const { order } = fixture;
  await prisma.notification.deleteMany({ where: { userId: { in: [ACTOR_ID, CUSTOMER_ID] } } });
  await prisma.passLog.deleteMany({ where: { pass: { orderId: order.id } } });
  await prisma.pass.deleteMany({ where: { orderId: order.id } });
  await prisma.orderEvent.deleteMany({ where: { orderId: order.id } });
  await prisma.returnItem.deleteMany({ where: { returnRequest: { orderId: order.id } } });
  await prisma.returnRequest.deleteMany({ where: { orderId: order.id } });
  await prisma.stockAdjustment.deleteMany({ where: { relatedOrderId: order.id } });
  await prisma.refund.deleteMany({ where: { orderId: order.id } });
  await prisma.shipmentEvent.deleteMany({ where: { shipment: { orderId: order.id } } });
  await prisma.shipment.deleteMany({ where: { orderId: order.id } });
  await prisma.payment.deleteMany({ where: { orderId: order.id } });
  await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
  await prisma.order.delete({ where: { id: order.id } });
}

function record(refundId, body) {
  return request(app).post(`/api/admin/refunds/${refundId}/record`).send(body);
}

async function recordedEvent(orderId) {
  return prisma.orderEvent.findFirst({ where: { orderId, type: 'refund_recorded' } });
}

describe('refund completion — cancellation refunds, Order status and Passes', () => {
  it('marks the order refunded and refunds eligible issued passes', async () => {
    const { order } = await makeOrder({ total: 1000 });
    const refund = await makeRefund({ order, amount: 1000 });
    const orderFixture = { order };
    try {
      const passA = await makePass(order, 'issued');
      const passB = await makePass(order, 'issued');

      const res = await record(refund.id, { confirmCompleted: true, externalAmount: 1000 });
      expect(res.status).toBe(200);
      expect(res.body.data.lifecycle.paymentStatusSetTo).toBe('refunded');
      expect(res.body.data.lifecycle.passesRefunded).toBe(2);
      expect(res.body.data.lifecycle.passExceptions).toEqual([]);

      const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
      expect(updatedOrder.paymentStatus).toBe('refunded');
      expect((await prisma.pass.findUnique({ where: { id: passA.id } })).status).toBe('refunded');
      expect((await prisma.pass.findUnique({ where: { id: passB.id } })).status).toBe('refunded');

      const event = await recordedEvent(order.id);
      expect(event.metadata.lifecycle.paymentStatusSetTo).toBe('refunded');
      expect(event.metadata.lifecycle.passesRefunded).toBe(2);
    } finally {
      await cleanup(orderFixture);
    }
  }, 30000);

  it('never auto-refunds a checked-in pass — it is reported as an exception and Finance is notified', async () => {
    const { order } = await makeOrder({ total: 1000 });
    const refund = await makeRefund({ order, amount: 1000 });
    try {
      const issued = await makePass(order, 'issued');
      const checkedIn = await makePass(order, 'checked_in');

      const res = await record(refund.id, { confirmCompleted: true, externalAmount: 1000 });
      expect(res.status).toBe(200);
      expect(res.body.data.lifecycle.passesRefunded).toBe(1);

      const exceptions = res.body.data.lifecycle.passExceptions;
      expect(exceptions).toHaveLength(1);
      expect(exceptions[0].passId).toBe(checkedIn.id);
      expect(exceptions[0].status).toBe('checked_in');

      expect((await prisma.pass.findUnique({ where: { id: issued.id } })).status).toBe('refunded');
      expect((await prisma.pass.findUnique({ where: { id: checkedIn.id } })).status).toBe('checked_in'); // untouched

      const event = await recordedEvent(order.id);
      expect(event.metadata.lifecycle.passExceptions).toHaveLength(1);

      const notice = await prisma.notification.findFirst({
        where: { userId: ACTOR_ID, title: 'Pass refund exception' },
      });
      expect(notice).not.toBeNull();
      expect(notice.body).toContain(order.orderNumber);
    } finally {
      await cleanup({ order });
    }
  }, 30000);
});

describe('refund completion — return refunds, Order/ReturnRequest/Shipment', () => {
  it('leaves a partial return refund with the order still paid, and completes the return and shipment', async () => {
    const fixture = await makeReturnRefund({ refundAmount: 400, total: 1000 });
    try {
      const res = await record(fixture.refund.id, { confirmCompleted: true, externalAmount: 400 });
      expect(res.status).toBe(200);
      expect(res.body.data.lifecycle.paymentStatusSetTo).toBe('paid');
      expect(res.body.data.lifecycle.returnRequest).toBe('refunded');
      expect(res.body.data.lifecycle.shipment).toBe('refunded');

      expect((await prisma.order.findUnique({ where: { id: fixture.order.id } })).paymentStatus).toBe('paid');
      expect((await prisma.returnRequest.findUnique({ where: { id: fixture.returnRequest.id } })).status).toBe('refunded');
      expect((await prisma.shipment.findUnique({ where: { id: fixture.shipment.id } })).status).toBe('refunded');
    } finally {
      await cleanup(fixture);
    }
  }, 30000);

  it('records the refund while flagging unexpected ReturnRequest and Shipment states', async () => {
    const fixture = await makeReturnRefund({ refundAmount: 400, total: 1000, returnStatus: 'received', shipmentStatus: 'returned' });
    try {
      const res = await record(fixture.refund.id, { confirmCompleted: true, externalAmount: 400 });
      expect(res.status).toBe(200); // the money record is never rolled back for a lifecycle state mismatch
      expect(res.body.data.status).toBe('succeeded');
      expect(res.body.data.lifecycle.returnRequest).toBe('skipped:received');
      expect(res.body.data.lifecycle.shipment).toBe('skipped:returned');

      // Neither unexpected-state record was mutated.
      expect((await prisma.returnRequest.findUnique({ where: { id: fixture.returnRequest.id } })).status).toBe('received');
      expect((await prisma.shipment.findUnique({ where: { id: fixture.shipment.id } })).status).toBe('returned');
      expect(await recordedEvent(fixture.order.id)).not.toBeNull();
    } finally {
      await cleanup(fixture);
    }
  }, 30000);
});

describe('refund completion — notifications', () => {
  it('notifies the customer once and does not duplicate it on a retry', async () => {
    const { order } = await makeOrder({ userId: CUSTOMER_ID, total: 1000 });
    const refund = await makeRefund({ order, amount: 1000 });
    try {
      const first = await record(refund.id, { confirmCompleted: true, externalAmount: 1000 });
      expect(first.status).toBe(200);

      expect(await prisma.notification.count({ where: { userId: CUSTOMER_ID, title: 'Refund completed' } })).toBe(1);

      const retry = await record(refund.id, { confirmCompleted: true, externalAmount: 1000 });
      expect(retry.status).toBe(409);
      expect(await prisma.notification.count({ where: { userId: CUSTOMER_ID, title: 'Refund completed' } })).toBe(1);
    } finally {
      await cleanup({ order });
    }
  }, 30000);

  it('does not notify a guest order', async () => {
    const { order } = await makeOrder({ userId: null, total: 1000 });
    const refund = await makeRefund({ order, amount: 1000 });
    try {
      const res = await record(refund.id, { confirmCompleted: true, externalAmount: 1000 });
      expect(res.status).toBe(200);
      expect(await prisma.notification.count({ where: { title: 'Refund completed', body: { contains: order.orderNumber } } })).toBe(0);
    } finally {
      await cleanup({ order });
    }
  }, 30000);
});
