import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => {
    req.user = { _id: req.headers['x-test-userid'] || 'test-admin', role: 'admin' };
    next();
  },
  isAdmin: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(), // guest by default — no req.user
}));

const { router: returnsRouter, adminRouter: adminReturnsRouter } = await import('../returns.js');

const app = express();
app.use(express.json());
app.use('/api/returns', returnsRouter);
app.use('/api/admin/returns', adminReturnsRouter);

const MARKER = `ReturnRouteTest${Date.now()}`;

// staffUserId/reviewedByUserId/initiatedByUserId/actorUserId are all real
// FKs to User — same fixture pattern shipments.test.js already establishes
// for its mocked 'test-admin' actor.
beforeAll(async () => {
  await prisma.user.upsert({
    where: { id: 'test-admin' },
    create: { id: 'test-admin', email: `return-route-admin-${Date.now()}@test.local`, firstName: 'Admin', lastName: 'Tester', role: 'admin' },
    update: {},
  });
}, 15000);

async function makePaidOrder({ quantity = 2, startingStock = 10, shipmentStatus = 'delivered' } = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const product = await prisma.product.create({
    data: {
      name: `${MARKER} ${suffix}`, slug: `return-route-test-${suffix}`, description: 'x',
      price: 500, category: 'jersey', sport: 'basketball', images: [], active: true,
      totalStock: startingStock - quantity,
      sizes: { create: [{ size: 'M', stock: startingStock - quantity }] },
    },
  });

  const order = await prisma.order.create({
    data: {
      orderNumber: `PS-${MARKER}-${suffix}`,
      email: 'return-route-test@example.com',
      shipToFullName: 'Test Buyer', shipToPhone: '09171234567', shipToAddress: '1 St',
      shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
      subtotal: 500 * quantity, total: 500 * quantity,
      paymentStatus: 'paid', orderStatus: 'delivered',
      items: { create: [{ productId: product.id, name: product.name, price: 500, quantity, size: 'M', image: 'x.jpg' }] },
    },
    include: { items: true },
  });

  const payment = await prisma.payment.create({
    data: { orderId: order.id, provider: 'maya', status: 'succeeded', paidAt: new Date(), providerPaymentReference: 'maya-pay-ref-1' },
  });

  const shipment = shipmentStatus
    ? await prisma.shipment.create({ data: { orderId: order.id, status: shipmentStatus } })
    : null;

  return { product, order, payment, shipment };
}

async function cleanup({ product, order, payment, shipment }) {
  await prisma.returnItem.deleteMany({ where: { returnRequest: { orderId: order.id } } });
  await prisma.returnRequest.deleteMany({ where: { orderId: order.id } });
  await prisma.stockAdjustment.deleteMany({ where: { relatedOrderId: order.id } });
  await prisma.refund.deleteMany({ where: { orderId: order.id } });
  if (shipment) {
    await prisma.shipmentEvent.deleteMany({ where: { shipmentId: shipment.id } });
    await prisma.shipment.deleteMany({ where: { orderId: order.id } });
  }
  await prisma.payment.delete({ where: { id: payment.id } });
  await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
  await prisma.order.delete({ where: { id: order.id } });
  await prisma.product.delete({ where: { id: product.id } });
}

describe('POST /returns — customer-facing return request', () => {
  it('creates a ReturnRequest for a paid order and mirrors the Shipment into return_requested', async () => {
    const fixture = await makePaidOrder();
    const { order, shipment } = fixture;
    try {
      const res = await request(app).post('/api/returns').send({
        orderNumber: order.orderNumber,
        reason: 'Wrong size',
        items: [{ orderItemId: order.items[0].id, quantity: 2 }],
      });
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('requested');
      expect(res.body.data.items).toHaveLength(1);

      const updatedShipment = await prisma.shipment.findUnique({ where: { id: shipment.id } });
      expect(updatedShipment.status).toBe('return_requested');
    } finally {
      await cleanup(fixture);
    }
  }, 20000);

  it('rejects a return for an order that is not paid', async () => {
    const fixture = await makePaidOrder();
    const { order } = fixture;
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'pending' } });
    try {
      const res = await request(app).post('/api/returns').send({
        orderNumber: order.orderNumber,
        reason: 'Wrong size',
        items: [{ orderItemId: order.items[0].id, quantity: 1 }],
      });
      expect(res.status).toBe(400);
    } finally {
      await cleanup(fixture);
    }
  }, 20000);

  it('rejects an orderItemId that does not belong to the given order', async () => {
    const fixture = await makePaidOrder();
    const { order } = fixture;
    try {
      const res = await request(app).post('/api/returns').send({
        orderNumber: order.orderNumber,
        reason: 'Wrong size',
        items: [{ orderItemId: '00000000-0000-0000-0000-000000000000', quantity: 1 }],
      });
      expect(res.status).toBe(400);
    } finally {
      await cleanup(fixture);
    }
  }, 20000);

  it('404s for an unknown order number', async () => {
    const res = await request(app).post('/api/returns').send({
      orderNumber: 'PS-DOES-NOT-EXIST', reason: 'Wrong size', items: [{ orderItemId: 'x', quantity: 1 }],
    });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /admin/returns/:id/status', () => {
  it('advances requested -> under_review -> approved -> return_shipped -> received', async () => {
    const fixture = await makePaidOrder();
    const { order } = fixture;
    try {
      const created = await request(app).post('/api/returns').send({
        orderNumber: order.orderNumber, reason: 'Damaged', items: [{ orderItemId: order.items[0].id, quantity: 1 }],
      });
      const id = created.body.data._id;

      for (const status of ['under_review', 'approved', 'return_shipped', 'received']) {
        const res = await request(app).patch(`/api/admin/returns/${id}/status`).send({ status });
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe(status);
      }
    } finally {
      await cleanup(fixture);
    }
  }, 45000); // 4 sequential transitions, each several round trips against the test Railway DB

  it('rejects an illegal jump (requested straight to received)', async () => {
    const fixture = await makePaidOrder();
    const { order } = fixture;
    try {
      const created = await request(app).post('/api/returns').send({
        orderNumber: order.orderNumber, reason: 'Damaged', items: [{ orderItemId: order.items[0].id, quantity: 1 }],
      });
      const id = created.body.data._id;

      const res = await request(app).patch(`/api/admin/returns/${id}/status`).send({ status: 'received' });
      expect(res.status).toBe(400);
    } finally {
      await cleanup(fixture);
    }
  }, 20000);
});

describe('POST /admin/returns/:id/inspect — the coordinated reversal', () => {
  it('restores stock for a sellable item and creates a pending Refund linked to the return', async () => {
    const fixture = await makePaidOrder({ quantity: 2, startingStock: 10 });
    const { product, order } = fixture;
    try {
      const created = await request(app).post('/api/returns').send({
        orderNumber: order.orderNumber, reason: 'Wrong size', items: [{ orderItemId: order.items[0].id, quantity: 2 }],
      });
      const id = created.body.data._id;
      const returnItemId = created.body.data.items[0]._id;

      await request(app).patch(`/api/admin/returns/${id}/status`).send({ status: 'under_review' });
      await request(app).patch(`/api/admin/returns/${id}/status`).send({ status: 'approved' });
      await request(app).patch(`/api/admin/returns/${id}/status`).send({ status: 'return_shipped' });
      await request(app).patch(`/api/admin/returns/${id}/status`).send({ status: 'received' });

      const res = await request(app).post(`/api/admin/returns/${id}/inspect`).send({
        items: [{ returnItemId, condition: 'sellable' }],
      });
      expect(res.status).toBe(200);
      expect(res.body.data.returnRequest.status).toBe('refund_pending');
      expect(res.body.data.refund.status).toBe('pending');
      expect(res.body.data.refund.amount).toBe(1000); // 500 * 2
      expect(res.body.data.refund.returnRequestId).toBe(id);

      const size = await prisma.productSize.findFirst({ where: { productId: product.id, size: 'M' } });
      expect(size.stock).toBe(10); // fully restored

      const adjustment = await prisma.stockAdjustment.findFirst({ where: { relatedOrderId: order.id } });
      expect(adjustment.type).toBe('returned');
      expect(adjustment.quantityDelta).toBe(2);
    } finally {
      await cleanup(fixture);
    }
  }, 45000); // 4 sequential transitions + the inspect transaction, each several round trips against the test Railway DB

  it('quarantines an unsellable item — no stock restoration, zero-delta adjustment', async () => {
    const fixture = await makePaidOrder({ quantity: 1, startingStock: 10 });
    const { product, order } = fixture;
    try {
      const created = await request(app).post('/api/returns').send({
        orderNumber: order.orderNumber, reason: 'Damaged', items: [{ orderItemId: order.items[0].id, quantity: 1 }],
      });
      const id = created.body.data._id;
      const returnItemId = created.body.data.items[0]._id;

      await request(app).patch(`/api/admin/returns/${id}/status`).send({ status: 'under_review' });
      await request(app).patch(`/api/admin/returns/${id}/status`).send({ status: 'approved' });
      await request(app).patch(`/api/admin/returns/${id}/status`).send({ status: 'return_shipped' });
      await request(app).patch(`/api/admin/returns/${id}/status`).send({ status: 'received' });

      const sizeBefore = await prisma.productSize.findFirst({ where: { productId: product.id, size: 'M' } });

      const res = await request(app).post(`/api/admin/returns/${id}/inspect`).send({
        items: [{ returnItemId, condition: 'unsellable' }],
      });
      expect(res.status).toBe(200);

      const sizeAfter = await prisma.productSize.findFirst({ where: { productId: product.id, size: 'M' } });
      expect(sizeAfter.stock).toBe(sizeBefore.stock); // unchanged — never silently restocked

      const adjustment = await prisma.stockAdjustment.findFirst({ where: { relatedOrderId: order.id } });
      expect(adjustment.type).toBe('quarantine');
      expect(adjustment.quantityDelta).toBe(0);
    } finally {
      await cleanup(fixture);
    }
  }, 45000);

  it('rejects an invalid condition value', async () => {
    const fixture = await makePaidOrder({ quantity: 1 });
    const { order } = fixture;
    try {
      const created = await request(app).post('/api/returns').send({
        orderNumber: order.orderNumber, reason: 'Damaged', items: [{ orderItemId: order.items[0].id, quantity: 1 }],
      });
      const id = created.body.data._id;
      const returnItemId = created.body.data.items[0]._id;
      await request(app).patch(`/api/admin/returns/${id}/status`).send({ status: 'under_review' });
      await request(app).patch(`/api/admin/returns/${id}/status`).send({ status: 'approved' });
      await request(app).patch(`/api/admin/returns/${id}/status`).send({ status: 'return_shipped' });
      await request(app).patch(`/api/admin/returns/${id}/status`).send({ status: 'received' });

      const res = await request(app).post(`/api/admin/returns/${id}/inspect`).send({
        items: [{ returnItemId, condition: 'mint' }],
      });
      expect(res.status).toBe(400);
    } finally {
      await cleanup(fixture);
    }
  }, 45000);
});
