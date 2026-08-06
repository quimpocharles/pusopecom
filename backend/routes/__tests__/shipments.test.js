import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => {
    req.user = { _id: req.headers['x-test-userid'] || 'test-admin', role: 'admin' };
    next();
  },
  isAdmin: (req, res, next) => next(),
}));

vi.mock('../../services/emailService.js', () => ({
  sendOrderStatusEmail: vi.fn().mockResolvedValue(undefined),
}));

const { default: shipmentsRouter } = await import('../shipments.js');
const emailService = await import('../../services/emailService.js');

const app = express();
app.use(express.json());
app.use('/api/admin/shipments', shipmentsRouter);

const MARKER = `ShipmentRouteTest${Date.now()}`;
const cleanup = { productIds: [], orderIds: [] };

// ShipmentEvent.actorUserId is a real FK to users.id — the mocked auth
// middleware's req.user._id ('test-admin') needs a matching real row, the
// same fixture pattern orders.test.js already establishes for its own
// 'test-user'.
beforeAll(async () => {
  await prisma.user.upsert({
    where: { id: 'test-admin' },
    create: { id: 'test-admin', email: `shipment-route-admin-${Date.now()}@test.local`, firstName: 'Admin', lastName: 'Tester', role: 'admin' },
    update: {},
  });
}, 15000);

beforeEach(() => {
  vi.clearAllMocks();
  emailService.sendOrderStatusEmail.mockResolvedValue(undefined);
});

async function makePaidOrderWithShipment({ quantity = 2, startingStock = 10 } = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const product = await prisma.product.create({
    data: {
      name: `${MARKER} ${suffix}`, slug: `shipment-route-test-${suffix}`, description: 'x',
      price: 500, category: 'jersey', sport: 'basketball', images: [], active: true,
      totalStock: startingStock - quantity, // already "reserved" by this order
      sizes: { create: [{ size: 'M', stock: startingStock - quantity }] },
    },
  });
  cleanup.productIds.push(product.id);

  const order = await prisma.order.create({
    data: {
      orderNumber: `PS-${MARKER}-${suffix}`,
      email: 'shipment-cancel-test@example.com',
      shipToFullName: 'Test Buyer', shipToPhone: '09171234567', shipToAddress: '1 St',
      shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
      subtotal: 500 * quantity, total: 500 * quantity,
      paymentStatus: 'paid', orderStatus: 'paid',
      items: { create: [{ productId: product.id, name: product.name, price: 500, quantity, size: 'M', image: 'x.jpg' }] },
    },
  });
  cleanup.orderIds.push(order.id);

  const payment = await prisma.payment.create({
    data: { orderId: order.id, provider: 'maya', status: 'succeeded', paidAt: new Date() },
  });

  const shipment = await prisma.shipment.create({ data: { orderId: order.id } }); // awaiting_picking

  return { product, order, payment, shipment };
}

describe('POST /admin/shipments/:id/cancel — the Fulfillment Audit\'s #1 finding, fixed', () => {
  it('releases reserved stock, records a StockAdjustment, marks the Order cancelled, and creates a pending Refund — atomically', async () => {
    const { product, order, payment, shipment } = await makePaidOrderWithShipment({ quantity: 2, startingStock: 10 });

    try {
      const res = await request(app).post(`/api/admin/shipments/${shipment.id}/cancel`).send({ reason: 'Customer requested' });
      expect(res.status).toBe(200);
      expect(res.body.data.shipment.status).toBe('cancelled');
      expect(res.body.data.refund.status).toBe('pending');
      expect(res.body.data.refund.amount).toBe(order.total);
      expect(res.body.data.refund.paymentId).toBe(payment.id);

      const size = await prisma.productSize.findFirst({ where: { productId: product.id, size: 'M' } });
      expect(size.stock).toBe(10); // fully restored

      const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
      expect(updatedOrder.orderStatus).toBe('cancelled');
      // paymentStatus deliberately untouched — a Refund in 'pending' means
      // money is owed back, not that it's been returned yet (Phase 2).
      expect(updatedOrder.paymentStatus).toBe('paid');

      const adjustment = await prisma.stockAdjustment.findFirst({ where: { relatedOrderId: order.id } });
      expect(adjustment.type).toBe('correction');
      expect(adjustment.quantityDelta).toBe(2);
      expect(adjustment.productSizeId).toBe(size.id);

      expect(emailService.sendOrderStatusEmail).toHaveBeenCalledWith(order.email, expect.objectContaining({ orderNumber: order.orderNumber }), 'cancelled');
    } finally {
      await prisma.stockAdjustment.deleteMany({ where: { relatedOrderId: order.id } });
      await prisma.refund.deleteMany({ where: { orderId: order.id } });
      await prisma.shipmentEvent.deleteMany({ where: { shipmentId: shipment.id } });
      await prisma.shipment.deleteMany({ where: { orderId: order.id } });
      await prisma.payment.delete({ where: { id: payment.id } });
      await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
      await prisma.order.delete({ where: { id: order.id } });
      await prisma.product.delete({ where: { id: product.id } });
    }
  }, 20000);

  it('rejects cancelling a shipment already past the point where cancellation is legal (e.g. delivered)', async () => {
    const { product, order, payment, shipment } = await makePaidOrderWithShipment();
    await prisma.shipment.update({ where: { id: shipment.id }, data: { status: 'delivered' } });

    try {
      const res = await request(app).post(`/api/admin/shipments/${shipment.id}/cancel`).send({});
      expect(res.status).toBe(400);

      // Nothing should have moved — the whole point of the transaction.
      const size = await prisma.productSize.findFirst({ where: { productId: product.id, size: 'M' } });
      expect(size.stock).toBe(8); // unchanged, still "reserved"
      const refundCount = await prisma.refund.count({ where: { orderId: order.id } });
      expect(refundCount).toBe(0);
    } finally {
      await prisma.shipment.deleteMany({ where: { orderId: order.id } });
      await prisma.payment.delete({ where: { id: payment.id } });
      await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
      await prisma.order.delete({ where: { id: order.id } });
      await prisma.product.delete({ where: { id: product.id } });
    }
  }, 20000);

  it('404s for a non-existent shipment', async () => {
    const res = await request(app).post('/api/admin/shipments/00000000-0000-0000-0000-000000000000/cancel').send({});
    expect(res.status).toBe(404);
  });
});

describe('PATCH /admin/shipments/:id/status — queue-advance action', () => {
  it('advances a legal transition and derives the coarse Order.orderStatus from it, emailing only when that coarse status actually changes', async () => {
    const { order, payment, shipment } = await makePaidOrderWithShipment();

    try {
      // awaiting_picking -> picking: both map to Order.orderStatus 'processing',
      // and the order started at 'paid' — so this first hop DOES change the
      // coarse status (paid -> processing) and should email once.
      const res = await request(app).patch(`/api/admin/shipments/${shipment.id}/status`).send({ status: 'picking' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('picking');

      let updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
      expect(updatedOrder.orderStatus).toBe('processing');
      expect(emailService.sendOrderStatusEmail).toHaveBeenCalledTimes(1);

      // packing -> quality_check both map to 'packed' already once packing
      // is reached; go there first, then confirm quality_check doesn't
      // re-email since the coarse status doesn't actually change.
      await request(app).patch(`/api/admin/shipments/${shipment.id}/status`).send({ status: 'packing' });
      emailService.sendOrderStatusEmail.mockClear();

      await request(app).patch(`/api/admin/shipments/${shipment.id}/status`).send({ status: 'quality_check' });
      updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
      expect(updatedOrder.orderStatus).toBe('packed'); // unchanged from the packing hop
      expect(emailService.sendOrderStatusEmail).not.toHaveBeenCalled();
    } finally {
      await prisma.shipmentEvent.deleteMany({ where: { shipmentId: shipment.id } });
      await prisma.shipment.deleteMany({ where: { orderId: order.id } });
      await prisma.payment.delete({ where: { id: payment.id } });
      await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
      await prisma.order.delete({ where: { id: order.id } });
    }
  }, 20000);

  it('rejects an illegal jump with 400, and rejects "cancelled" specifically — that only ever happens via /cancel', async () => {
    const { order, payment, shipment } = await makePaidOrderWithShipment();

    try {
      const illegal = await request(app).patch(`/api/admin/shipments/${shipment.id}/status`).send({ status: 'delivered' });
      expect(illegal.status).toBe(400);

      const viaGeneric = await request(app).patch(`/api/admin/shipments/${shipment.id}/status`).send({ status: 'cancelled' });
      expect(viaGeneric.status).toBe(400);
    } finally {
      await prisma.shipment.deleteMany({ where: { orderId: order.id } });
      await prisma.payment.delete({ where: { id: payment.id } });
      await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
      await prisma.order.delete({ where: { id: order.id } });
    }
  }, 20000);
});

describe('POST /admin/shipments/:id/notes', () => {
  it('adds a note as a ShipmentEvent, distinct from a status change', async () => {
    const { order, payment, shipment } = await makePaidOrderWithShipment();

    try {
      const res = await request(app).post(`/api/admin/shipments/${shipment.id}/notes`).send({ message: 'Customer asked for gift wrap' });
      expect(res.status).toBe(201);
      expect(res.body.data.type).toBe('note_added');

      const events = await request(app).get(`/api/admin/shipments/${shipment.id}/events`);
      // The fixture creates its Shipment row directly (not through
      // applyPaymentResolution's own fire-and-forget 'created' event), so
      // the note is the only event here — this asserts the note route
      // itself, not the auto-creation flow (covered separately in
      // orders.test.js's Shipment auto-creation smoke test).
      expect(events.body.data.map((e) => e.type)).toEqual(['note_added']);
    } finally {
      await prisma.shipmentEvent.deleteMany({ where: { shipmentId: shipment.id } });
      await prisma.shipment.deleteMany({ where: { orderId: order.id } });
      await prisma.payment.delete({ where: { id: payment.id } });
      await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
      await prisma.order.delete({ where: { id: order.id } });
    }
  }, 15000);
});
