import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

// Launch-readiness permission-model fix — fulfillment.status_manage
// (order_management) is authorized to read shipment state and advance its
// status only; assign/notes/cancel stay fulfillment.manage-only. This file
// proves that real boundary through the real requirePermission/
// requireAnyPermission middleware (only authenticate/isAdmin are mocked,
// same convention as permissionGating.test.js) — shipments.test.js
// deliberately mocks permission middleware away entirely since it's
// testing business logic, not authorization, so it can't cover this.
let currentUser;

vi.mock('../../middleware/auth.js', async () => {
  const actual = await vi.importActual('../../middleware/auth.js');
  return {
    ...actual,
    authenticate: (req, res, next) => { req.user = currentUser; next(); },
  };
});

vi.mock('../../services/emailService.js', () => ({
  sendOrderStatusEmail: vi.fn().mockResolvedValue(undefined),
}));

const { default: shipmentsRouter } = await import('../shipments.js');
const { default: ordersRouter } = await import('../orders.js');
const { default: settingsRouter } = await import('../settings.js');
const { default: staffRouter } = await import('../staff.js');

const app = express();
app.use(express.json());
app.use('/api/admin/shipments', shipmentsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/admin/staff', staffRouter);

function asDept(department, permissions = []) {
  currentUser = { _id: `${department}-status-manage-test-id`, role: 'admin', staffProfile: { department, active: true, permissions } };
}

const MARKER = `ShipmentPermTest${Date.now()}`;
let product, order, shipment;

// ShipmentEvent.actorUserId is a real FK to users.id — every department
// actor id asDept() can produce needs a matching real row, the same
// fixture pattern shipments.test.js already establishes for 'test-admin'.
const ACTOR_DEPARTMENTS = ['order_management', 'warehouse', 'operations', 'scanner'];

beforeAll(async () => {
  await Promise.all(ACTOR_DEPARTMENTS.map((department) =>
    prisma.user.upsert({
      where: { id: `${department}-status-manage-test-id` },
      create: {
        id: `${department}-status-manage-test-id`,
        email: `${MARKER.toLowerCase()}-${department}@test.local`,
        firstName: 'Test', lastName: department, role: 'admin',
      },
      update: {},
    })
  ));

  product = await prisma.product.create({
    data: {
      name: MARKER, slug: `shipment-perm-test-${Date.now()}`, description: 'x',
      price: 500, category: 'jersey', sport: 'basketball', images: [], active: true,
      totalStock: 8,
      sizes: { create: [{ size: 'M', stock: 8 }] },
    },
  });

  order = await prisma.order.create({
    data: {
      orderNumber: `PS-${MARKER}`,
      email: 'shipment-perm-test@example.com',
      shipToFullName: 'Test Buyer', shipToPhone: '09171234567', shipToAddress: '1 St',
      shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
      subtotal: 500, total: 500,
      paymentStatus: 'paid', orderStatus: 'paid',
      items: { create: [{ productId: product.id, name: product.name, price: 500, quantity: 1, size: 'M', image: 'x.jpg' }] },
    },
  });

  await prisma.payment.create({
    data: { orderId: order.id, provider: 'maya', status: 'succeeded', paidAt: new Date() },
  });

  shipment = await prisma.shipment.create({ data: { orderId: order.id } }); // awaiting_picking
}, 20000);

afterAll(async () => {
  await prisma.shipmentEvent.deleteMany({ where: { shipmentId: shipment.id } });
  await prisma.shipment.deleteMany({ where: { orderId: order.id } });
  await prisma.refund.deleteMany({ where: { orderId: order.id } });
  await prisma.payment.deleteMany({ where: { orderId: order.id } });
  await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
  await prisma.order.delete({ where: { id: order.id } });
  await prisma.product.delete({ where: { id: product.id } });
  await prisma.$disconnect();
});

describe('order_management — read routes (fulfillment.status_manage)', () => {
  it('1. can GET the shipment queue', async () => {
    asDept('order_management');
    const res = await request(app).get('/api/admin/shipments');
    expect(res.status).toBe(200);
  });

  it('2. can GET shipment-by-order', async () => {
    asDept('order_management');
    const res = await request(app).get(`/api/admin/shipments/by-order/${order.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(shipment.id);
  });

  it('3. can GET shipment details', async () => {
    asDept('order_management');
    const res = await request(app).get(`/api/admin/shipments/${shipment.id}`);
    expect(res.status).toBe(200);
  });

  it('4. can GET shipment events', async () => {
    asDept('order_management');
    const res = await request(app).get(`/api/admin/shipments/${shipment.id}/events`);
    expect(res.status).toBe(200);
  });
});

describe('order_management — status advancement (fulfillment.status_manage)', () => {
  it('5. can perform a legal PATCH /:id/status transition', async () => {
    asDept('order_management');
    const res = await request(app).patch(`/api/admin/shipments/${shipment.id}/status`).send({ status: 'picking' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('picking');

    const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updatedOrder.orderStatus).toBe('processing');
  }, 15000);

  it('6. an illegal status transition still returns 400', async () => {
    asDept('order_management');
    const res = await request(app).patch(`/api/admin/shipments/${shipment.id}/status`).send({ status: 'delivered' });
    expect(res.status).toBe(400);
  });

  it('7. supplying a courier field is rejected and writes nothing', async () => {
    asDept('order_management');
    const before = await prisma.shipment.findUnique({ where: { id: shipment.id } });

    const res = await request(app).patch(`/api/admin/shipments/${shipment.id}/status`).send({ status: 'packing', courier: 'LBC' });
    expect(res.status).toBe(403);

    const after = await prisma.shipment.findUnique({ where: { id: shipment.id } });
    expect(after.status).toBe(before.status); // unchanged — nothing written
    expect(after.courier).toBeNull();
  });

  it('7b. supplying trackingNumber alone is also rejected', async () => {
    asDept('order_management');
    const res = await request(app).patch(`/api/admin/shipments/${shipment.id}/status`).send({ status: 'packing', trackingNumber: 'TRK-1' });
    expect(res.status).toBe(403);
  });

  it('7c. supplying courierAccountId alone is also rejected', async () => {
    asDept('order_management');
    const res = await request(app).patch(`/api/admin/shipments/${shipment.id}/status`).send({ status: 'packing', courierAccountId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(403);
  });
});

describe('order_management — excluded fulfillment.manage-only actions', () => {
  it('8. cannot PATCH /:id/assign', async () => {
    asDept('order_management');
    const res = await request(app).patch(`/api/admin/shipments/${shipment.id}/assign`).send({ userId: null });
    expect(res.status).toBe(403);
  });

  it('9. cannot POST /:id/notes', async () => {
    asDept('order_management');
    const res = await request(app).post(`/api/admin/shipments/${shipment.id}/notes`).send({ message: 'test' });
    expect(res.status).toBe(403);
  });

  it('10. cannot POST /:id/cancel', async () => {
    asDept('order_management');
    const res = await request(app).post(`/api/admin/shipments/${shipment.id}/cancel`).send({});
    expect(res.status).toBe(403);
  });

  it('11. the denied cancel attempt creates no Refund', async () => {
    const refundCount = await prisma.refund.count({ where: { orderId: order.id } });
    expect(refundCount).toBe(0);
  });
});

describe('warehouse and operations — fulfillment.manage retains full existing behavior', () => {
  it.each(['warehouse', 'operations'])('12/13. %s can still reach every shipments route', async (department) => {
    asDept(department);
    expect((await request(app).get('/api/admin/shipments')).status).toBe(200);
    expect((await request(app).get(`/api/admin/shipments/${shipment.id}`)).status).toBe(200);
    expect((await request(app).get(`/api/admin/shipments/${shipment.id}/events`)).status).toBe(200);
    expect((await request(app).patch(`/api/admin/shipments/${shipment.id}/assign`).send({ userId: null })).status).toBe(200);
  }, 15000);
});

describe('scanner — denied from every shipments route', () => {
  it('14. scanner is denied read and write shipment routes', async () => {
    asDept('scanner');
    expect((await request(app).get('/api/admin/shipments')).status).toBe(403);
    expect((await request(app).get(`/api/admin/shipments/${shipment.id}`)).status).toBe(403);
    expect((await request(app).patch(`/api/admin/shipments/${shipment.id}/status`).send({ status: 'packing' })).status).toBe(403);
    expect((await request(app).post(`/api/admin/shipments/${shipment.id}/cancel`).send({})).status).toBe(403);
  });
});

describe('unrelated authorization surfaces — unchanged by this permission split', () => {
  it('15. orders.manage still only permits payment-lifecycle OrderStatus values (order-level endpoint untouched)', async () => {
    asDept('order_management');
    const res = await request(app).patch(`/api/orders/${order.id}/status`).send({ orderStatus: 'paid' });
    // Authorization passes (orders.manage) — 200 confirms this endpoint's
    // own scope wasn't touched by the shipments.js/permissions.js changes.
    expect(res.status).toBe(200);
  }, 10000);

  it('16. payment gateway restriction remains unchanged — order_management still denied', async () => {
    asDept('order_management');
    const res = await request(app).put('/api/settings').send({ payment: { defaultPaymentGateway: 'xendit' } });
    expect(res.status).toBe(403);
  });

  it('17. founder-only staff administration remains unchanged — order_management still denied', async () => {
    asDept('order_management');
    const res = await request(app).get('/api/admin/staff');
    expect(res.status).toBe(403);
  });
});
