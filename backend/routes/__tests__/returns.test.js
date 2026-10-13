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
  requirePermission: () => (req, res, next) => next(),
  requireAnyPermission: () => (req, res, next) => next(),
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

async function makePaidOrder({ quantity = 2, itemQuantities, startingStock = 10, shipmentStatus = 'delivered' } = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const quantities = itemQuantities ?? [quantity];
  const purchasedQuantity = quantities.reduce((sum, itemQuantity) => sum + itemQuantity, 0);
  const product = await prisma.product.create({
    data: {
      name: `${MARKER} ${suffix}`, slug: `return-route-test-${suffix}`, description: 'x',
      price: 500, category: 'jersey', sport: 'basketball', images: [], active: true,
      totalStock: startingStock - purchasedQuantity,
      sizes: { create: [{ size: 'M', stock: startingStock - purchasedQuantity }] },
    },
  });

  const order = await prisma.order.create({
    data: {
      orderNumber: `PS-${MARKER}-${suffix}`,
      email: 'return-route-test@example.com',
      shipToFullName: 'Test Buyer', shipToPhone: '09171234567', shipToAddress: '1 St',
      shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
      subtotal: 500 * purchasedQuantity, total: 500 * purchasedQuantity,
      paymentStatus: 'paid', orderStatus: 'delivered',
      items: { create: quantities.map((itemQuantity) => ({ productId: product.id, name: product.name, price: 500, quantity: itemQuantity, size: 'M', image: 'x.jpg' })) },
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

async function expectNoReturnSideEffects({ product, order, shipment }) {
  const [returnRequests, returnItems, refunds, adjustments, size, currentShipment] = await Promise.all([
    prisma.returnRequest.count({ where: { orderId: order.id } }),
    prisma.returnItem.count({ where: { returnRequest: { orderId: order.id } } }),
    prisma.refund.count({ where: { orderId: order.id } }),
    prisma.stockAdjustment.count({ where: { relatedOrderId: order.id } }),
    prisma.productSize.findFirst({ where: { productId: product.id, size: 'M' } }),
    shipment ? prisma.shipment.findUnique({ where: { id: shipment.id } }) : null,
  ]);
  expect(returnRequests).toBe(0);
  expect(returnItems).toBe(0);
  expect(refunds).toBe(0);
  expect(adjustments).toBe(0);
  expect(size.stock).toBe(product.totalStock);
  if (currentShipment) expect(currentShipment.status).toBe('delivered');
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

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['fractional', 1.5],
    ['excessively large', Number.MAX_SAFE_INTEGER],
  ])('rejects a %s return quantity without any return, stock, refund, or shipment side effect', async (_label, quantity) => {
    const fixture = await makePaidOrder();
    const { order } = fixture;
    try {
      const res = await request(app).post('/api/returns').send({
        orderNumber: order.orderNumber,
        reason: 'Wrong size',
        items: [{ orderItemId: order.items[0].id, quantity }],
      });
      expect(res.status).toBe(400);
      await expectNoReturnSideEffects(fixture);
    } finally {
      await cleanup(fixture);
    }
  }, 20000);

  it('rejects duplicate order item entries without creating a partial return request', async () => {
    const fixture = await makePaidOrder();
    const { order } = fixture;
    try {
      const res = await request(app).post('/api/returns').send({
        orderNumber: order.orderNumber,
        reason: 'Wrong size',
        items: [
          { orderItemId: order.items[0].id, quantity: 1 },
          { orderItemId: order.items[0].id, quantity: 1 },
        ],
      });
      expect(res.status).toBe(400);
      await expectNoReturnSideEffects(fixture);
    } finally {
      await cleanup(fixture);
    }
  }, 20000);

  it('counts eligibility by product, size, and color across separate purchased order items', async () => {
    const fixture = await makePaidOrder({ itemQuantities: [1, 1] });
    const { order } = fixture;
    try {
      const first = await request(app).post('/api/returns').send({
        orderNumber: order.orderNumber,
        reason: 'Wrong size',
        items: [{ orderItemId: order.items[0].id, quantity: 1 }],
      });
      expect(first.status).toBe(201);

      const second = await request(app).post('/api/returns').send({
        orderNumber: order.orderNumber,
        reason: 'Wrong size',
        items: [{ orderItemId: order.items[1].id, quantity: 2 }],
      });
      expect(second.status).toBe(400);
      expect(await prisma.returnRequest.count({ where: { orderId: order.id } })).toBe(1);
    } finally {
      await cleanup(fixture);
    }
  }, 30000);

  it('serializes concurrent return requests so only one can reserve the remaining eligibility', async () => {
    const fixture = await makePaidOrder();
    const { order } = fixture;
    try {
      const payload = {
        orderNumber: order.orderNumber,
        reason: 'Wrong size',
        items: [{ orderItemId: order.items[0].id, quantity: 2 }],
      };
      const [first, second] = await Promise.all([
        request(app).post('/api/returns').send(payload),
        request(app).post('/api/returns').send(payload),
      ]);
      expect([first.status, second.status].sort((a, b) => a - b)).toEqual([201, 400]);

      const returnItems = await prisma.returnItem.findMany({ where: { returnRequest: { orderId: order.id } } });
      expect(returnItems).toHaveLength(1);
      expect(returnItems[0].quantity).toBe(2);
    } finally {
      await cleanup(fixture);
    }
  }, 30000);

  it('releases eligibility when a return request is rejected', async () => {
    const fixture = await makePaidOrder();
    const { order } = fixture;
    try {
      const first = await request(app).post('/api/returns').send({
        orderNumber: order.orderNumber,
        reason: 'Wrong size',
        items: [{ orderItemId: order.items[0].id, quantity: 2 }],
      });
      expect(first.status).toBe(201);

      const rejected = await request(app).patch(`/api/admin/returns/${first.body.data._id}/status`).send({ status: 'rejected' });
      expect(rejected.status).toBe(200);

      const second = await request(app).post('/api/returns').send({
        orderNumber: order.orderNumber,
        reason: 'Wrong size',
        items: [{ orderItemId: order.items[0].id, quantity: 2 }],
      });
      expect(second.status).toBe(201);
    } finally {
      await cleanup(fixture);
    }
  }, 30000);

  it('return_items_quantity_check rejects a direct negative ReturnItem insert', async () => {
    const fixture = await makePaidOrder();
    const { order } = fixture;
    try {
      const returnRequest = await prisma.returnRequest.create({ data: { orderId: order.id, reason: 'Wrong size' } });
      await expect(
        prisma.returnItem.create({ data: { returnRequestId: returnRequest.id, orderItemId: order.items[0].id, quantity: -1 } })
      ).rejects.toThrow();
    } finally {
      await cleanup(fixture);
    }
  }, 20000);
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

// ── Stage 2, Step 2 — attributable refund pricing and safeguards ──────────

// A discounted-order fixture: one or more products, an explicit discountAmount
// (the checkout total is assumed = subtotal - discount), an optional real
// PromoCode row (so the scope-resolution repository path is exercised), and an
// optional shipment.
async function makeDiscountedPaidOrder({
  productsSpec = [{ price: 500, quantities: [1] }],
  discountAmount = 0,
  promo = null,
  shipmentStatus = 'delivered',
} = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const products = [];
  const itemCreates = [];
  let subtotal = 0;

  for (const spec of productsSpec) {
    const product = await prisma.product.create({
      data: {
        name: `${MARKER} D ${suffix}`, slug: `return-discount-test-${suffix}-${products.length}`, description: 'x',
        price: spec.price, category: 'jersey', sport: 'basketball', images: [], active: true,
        totalStock: 99, sizes: { create: [{ size: 'M', stock: 99 }] },
      },
    });
    products.push(product);
    for (const quantity of spec.quantities) {
      itemCreates.push({ productId: product.id, name: product.name, price: spec.price, quantity, size: 'M', image: 'x.jpg' });
      subtotal += spec.price * quantity;
    }
  }

  const promoCode = promo
    ? await prisma.promoCode.create({
        data: {
          code: `RETURNTEST-${suffix}`,
          discountType: promo.discountType,
          scope: promo.scope,
          percentOff: promo.percentOff ?? null,
          amountOff: promo.amountOff ?? null,
          ...(promo.productIndexes
            ? { products: { create: promo.productIndexes.map((index) => ({ productId: products[index].id })) } }
            : {}),
        },
      })
    : null;

  const order = await prisma.order.create({
    data: {
      orderNumber: `PS-${MARKER}-D-${suffix}`, email: 'return-discount-test@example.com',
      shipToFullName: 'Test Buyer', shipToPhone: '09171234567', shipToAddress: '1 St',
      shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
      subtotal, discountAmount, total: subtotal - discountAmount,
      promoCodeId: promoCode?.id ?? null,
      paymentStatus: 'paid', orderStatus: 'delivered',
      items: { create: itemCreates },
    },
    include: { items: true },
  });

  const payment = await prisma.payment.create({
    data: { orderId: order.id, provider: 'epaygames', status: 'succeeded', paidAt: new Date() },
  });
  const shipment = shipmentStatus
    ? await prisma.shipment.create({ data: { orderId: order.id, status: shipmentStatus } })
    : null;

  return { products, promoCode, order, payment, shipment };
}

async function cleanupDiscounted({ products, promoCode, order, payment, shipment }) {
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
  for (const product of products) {
    // eslint-disable-next-line no-await-in-loop
    await prisma.product.delete({ where: { id: product.id } });
  }
  if (promoCode) await prisma.promoCode.delete({ where: { id: promoCode.id } });
}

async function advanceToReceived(order, items) {
  const created = await request(app).post('/api/returns').send({
    orderNumber: order.orderNumber, reason: 'Wrong size', items,
  });
  const id = created.body.data._id;
  for (const status of ['under_review', 'approved', 'return_shipped', 'received']) {
    // eslint-disable-next-line no-await-in-loop
    await request(app).patch(`/api/admin/returns/${id}/status`).send({ status });
  }
  return { id, returnItems: created.body.data.items };
}

async function inspectReturn(id, returnItemId, condition = 'sellable') {
  return request(app).post(`/api/admin/returns/${id}/inspect`).send({ items: [{ returnItemId, condition }] });
}

describe('Stage 2 — inspection prices refunds at the attributable amount', () => {
  it('prices a discounted full return at list price minus the line discount', async () => {
    const fixture = await makeDiscountedPaidOrder({
      productsSpec: [{ price: 500, quantities: [3] }],
      discountAmount: 300,
      promo: { discountType: 'PERCENTAGE', scope: 'ORDER' },
    });
    const { order } = fixture;
    try {
      const { id, returnItems } = await advanceToReceived(order, [{ orderItemId: order.items[0].id, quantity: 3 }]);
      const res = await inspectReturn(id, returnItems[0]._id);
      expect(res.status).toBe(200);
      expect(res.body.data.refund.amount).toBe(1200); // 1500 list - 300 discount, not 1500
    } finally {
      await cleanupDiscounted(fixture);
    }
  }, 60000);

  it('floors a partial discounted return to centavos', async () => {
    const fixture = await makeDiscountedPaidOrder({
      productsSpec: [{ price: 500, quantities: [3] }],
      discountAmount: 300,
      promo: { discountType: 'PERCENTAGE', scope: 'ORDER' },
    });
    const { order } = fixture;
    try {
      const { id, returnItems } = await advanceToReceived(order, [{ orderItemId: order.items[0].id, quantity: 2 }]);
      const res = await inspectReturn(id, returnItems[0]._id);
      expect(res.status).toBe(200);
      expect(res.body.data.refund.amount).toBe(800); // floor(1200 * 2/3)
    } finally {
      await cleanupDiscounted(fixture);
    }
  }, 60000);

  it('bears a PRODUCT-scope discount only on the matching line', async () => {
    const fixture = await makeDiscountedPaidOrder({
      productsSpec: [{ price: 500, quantities: [1] }, { price: 500, quantities: [1] }],
      discountAmount: 250,
      promo: { discountType: 'PERCENTAGE', scope: 'PRODUCT', productIndexes: [0] },
    });
    const { order } = fixture;
    try {
      const discountedItem = order.items.find((item) => item.productId === fixture.products[0].id);
      const { id, returnItems } = await advanceToReceived(order, [{ orderItemId: discountedItem.id, quantity: 1 }]);
      const res = await inspectReturn(id, returnItems[0]._id);
      expect(res.status).toBe(200);
      expect(res.body.data.refund.amount).toBe(250); // 500 list - the 250 discount that targeted this product
    } finally {
      await cleanupDiscounted(fixture);
    }
  }, 60000);
});

describe('Stage 2 — inspection lifecycle and safeguards', () => {
  it('mirrors the Shipment returned -> refund_pending on inspection', async () => {
    const fixture = await makeDiscountedPaidOrder({ productsSpec: [{ price: 500, quantities: [1] }] });
    const { order, shipment } = fixture;
    try {
      const { id, returnItems } = await advanceToReceived(order, [{ orderItemId: order.items[0].id, quantity: 1 }]);
      const before = await prisma.shipment.findUnique({ where: { id: shipment.id } });
      expect(before.status).toBe('returned');

      const res = await inspectReturn(id, returnItems[0]._id);
      expect(res.status).toBe(200);

      const after = await prisma.shipment.findUnique({ where: { id: shipment.id } });
      expect(after.status).toBe('refund_pending');
    } finally {
      await cleanupDiscounted(fixture);
    }
  }, 60000);

  it('still creates the refund when the order has no Shipment (mirror logs and skips)', async () => {
    const fixture = await makeDiscountedPaidOrder({ productsSpec: [{ price: 500, quantities: [1] }], shipmentStatus: null });
    const { order } = fixture;
    try {
      const { id, returnItems } = await advanceToReceived(order, [{ orderItemId: order.items[0].id, quantity: 1 }]);
      const res = await inspectReturn(id, returnItems[0]._id);
      expect(res.status).toBe(200);
      expect(res.body.data.refund.amount).toBe(500);
    } finally {
      await cleanupDiscounted(fixture);
    }
  }, 60000);

  it('rejects inspection (409) when the order already has a cancellation-origin refund, without side effects', async () => {
    const fixture = await makeDiscountedPaidOrder({ productsSpec: [{ price: 500, quantities: [1] }] });
    const { order } = fixture;
    try {
      // A full cancellation refund recorded as succeeded, with no return link.
      await prisma.refund.create({
        data: { orderId: order.id, amount: 500, reason: 'Order cancelled', status: 'succeeded', processedAt: new Date() },
      });

      const { id, returnItems } = await advanceToReceived(order, [{ orderItemId: order.items[0].id, quantity: 1 }]);
      const res = await inspectReturn(id, returnItems[0]._id);
      expect(res.status).toBe(409);

      // The transaction rolled back — the return is still 'received' and no
      // second refund was created.
      const currentReturn = await prisma.returnRequest.findUnique({ where: { id } });
      expect(currentReturn.status).toBe('received');
      expect(await prisma.refund.count({ where: { orderId: order.id } })).toBe(1);
    } finally {
      await cleanupDiscounted(fixture);
    }
  }, 60000);
});

describe('Stage 2 — inspection requires a complete, valid item set (regression)', () => {
  async function twoItemReturn(order) {
    const { id, returnItems } = await advanceToReceived(order, [
      { orderItemId: order.items[0].id, quantity: 1 },
      { orderItemId: order.items[1].id, quantity: 1 },
    ]);
    const byOrderItem = new Map(returnItems.map((ri) => [ri.orderItemId, ri]));
    return { id, first: byOrderItem.get(order.items[0].id), second: byOrderItem.get(order.items[1].id) };
  }

  it('rejects a partial inspection and creates no refund for uninspected items', async () => {
    const fixture = await makeDiscountedPaidOrder({ productsSpec: [{ price: 500, quantities: [1] }, { price: 500, quantities: [1] }] });
    const { order, shipment } = fixture;
    try {
      const { id, first } = await twoItemReturn(order);
      // Only the first of the two items is inspected.
      const res = await request(app).post(`/api/admin/returns/${id}/inspect`)
        .send({ items: [{ returnItemId: first._id, condition: 'sellable' }] });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/every item/i);

      // Nothing mutated — no refund, return still received, shipment unchanged,
      // no stock adjustment for the (un)inspected item, order payment untouched.
      expect(await prisma.refund.count({ where: { orderId: order.id } })).toBe(0);
      expect((await prisma.returnRequest.findUnique({ where: { id } })).status).toBe('received');
      expect(await prisma.stockAdjustment.count({ where: { relatedOrderId: order.id } })).toBe(0);
      expect((await prisma.order.findUnique({ where: { id: order.id } })).paymentStatus).toBe('paid');
      if (shipment) expect((await prisma.shipment.findUnique({ where: { id: shipment.id } })).status).toBe('returned');
    } finally {
      await cleanupDiscounted(fixture);
    }
  }, 60000);

  it('creates the correct refund for a complete valid inspection of all items', async () => {
    const fixture = await makeDiscountedPaidOrder({ productsSpec: [{ price: 500, quantities: [1] }, { price: 300, quantities: [1] }] });
    const { order } = fixture;
    try {
      const { id, first, second } = await twoItemReturn(order);
      const res = await request(app).post(`/api/admin/returns/${id}/inspect`)
        .send({ items: [
          { returnItemId: first._id, condition: 'sellable' },
          { returnItemId: second._id, condition: 'damaged' },
        ] });
      expect(res.status).toBe(200);
      expect(res.body.data.refund.amount).toBe(800); // 500 + 300, one item each
    } finally {
      await cleanupDiscounted(fixture);
    }
  }, 60000);

  it('rejects duplicate, unknown, or over-quantity entries before any state change', async () => {
    const fixture = await makeDiscountedPaidOrder({ productsSpec: [{ price: 500, quantities: [1] }, { price: 500, quantities: [1] }] });
    const { order } = fixture;
    try {
      const { id, first, second } = await twoItemReturn(order);
      const url = `/api/admin/returns/${id}/inspect`;

      const dup = await request(app).post(url).send({ items: [
        { returnItemId: first._id, condition: 'sellable' },
        { returnItemId: first._id, condition: 'damaged' },
      ] });
      expect(dup.status).toBe(400);
      expect(dup.body.message).toMatch(/more than once/i);

      const unknown = await request(app).post(url).send({ items: [
        { returnItemId: first._id, condition: 'sellable' },
        { returnItemId: 'not-a-real-item', condition: 'sellable' },
      ] });
      expect(unknown.status).toBe(400);
      expect(unknown.body.message).toMatch(/not found/i);

      const overQuantity = await request(app).post(url).send({ items: [
        { returnItemId: first._id, condition: 'sellable', quantity: 5 },
        { returnItemId: second._id, condition: 'sellable' },
      ] });
      expect(overQuantity.status).toBe(400);
      expect(overQuantity.body.message).toMatch(/quantity/i);

      // Every attempt rejected: no refund, still received, nothing restocked.
      expect(await prisma.refund.count({ where: { orderId: order.id } })).toBe(0);
      expect((await prisma.returnRequest.findUnique({ where: { id } })).status).toBe('received');
      expect(await prisma.stockAdjustment.count({ where: { relatedOrderId: order.id } })).toBe(0);
    } finally {
      await cleanupDiscounted(fixture);
    }
  }, 60000);

  it('returns a controlled 409 for an unresolvable return without mutating state', async () => {
    const fixture = await makeDiscountedPaidOrder({ productsSpec: [{ price: 500, quantities: [1] }] });
    const { order, shipment } = fixture;
    try {
      const { id, returnItems } = await advanceToReceived(order, [{ orderItemId: order.items[0].id, quantity: 1 }]);
      // Corrupt the stored return item's quantity beyond the purchased amount so
      // it can no longer be priced (attributableReturnAmount throws).
      await prisma.returnItem.update({ where: { id: returnItems[0]._id }, data: { quantity: order.items[0].quantity + 1 } });

      const res = await request(app).post(`/api/admin/returns/${id}/inspect`)
        .send({ items: [{ returnItemId: returnItems[0]._id, condition: 'sellable' }] });
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/cannot be established|no longer resolve/i);

      expect(await prisma.refund.count({ where: { orderId: order.id } })).toBe(0);
      expect((await prisma.returnRequest.findUnique({ where: { id } })).status).toBe('received');
      expect(await prisma.stockAdjustment.count({ where: { relatedOrderId: order.id } })).toBe(0);
      expect((await prisma.order.findUnique({ where: { id: order.id } })).paymentStatus).toBe('paid');
      if (shipment) expect((await prisma.shipment.findUnique({ where: { id: shipment.id } })).status).toBe('returned');
    } finally {
      await cleanupDiscounted(fixture);
    }
  }, 60000);
});

