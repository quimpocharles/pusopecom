import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => {
    req.user = { _id: req.headers['x-test-userid'] || 'test-user', role: req.headers['x-test-role'] || 'customer' };
    next();
  },
  isAdmin: (req, res, next) => next(),
  optionalAuth: (req, res, next) => {
    if (req.headers['x-test-userid']) {
      req.user = { _id: req.headers['x-test-userid'], role: req.headers['x-test-role'] || 'customer' };
    }
    next();
  },
}));

vi.mock('../../services/paymentService.js', () => ({
  createCheckoutSession: vi.fn(),
  getPaymentStatus: vi.fn(),
}));

vi.mock('../../services/emailService.js', () => ({
  sendOrderConfirmationEmail: vi.fn().mockResolvedValue(undefined),
}));

const { default: ordersRouter } = await import('../orders.js');
const paymentService = await import('../../services/paymentService.js');
const emailService = await import('../../services/emailService.js');

const app = express();
app.use(express.json());
app.use('/api/orders', ordersRouter);

const MARKER = `OrderRouteTest${Date.now()}`;
const createdProductIds = [];
const createdUserIds = [];

async function makeProduct(overrides = {}) {
  const product = await prisma.product.create({
    data: {
      name: `${MARKER} ${overrides.name || 'Product'}`,
      slug: `order-route-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      description: 'x',
      price: 500,
      category: 'jersey',
      sport: 'basketball',
      images: ['https://example.com/img.jpg'],
      active: true,
      totalStock: 10,
      sizes: { create: [{ size: 'M', stock: 10 }] },
      ...overrides,
    },
  });
  createdProductIds.push(product.id);
  return product;
}

function validOrderPayload(product, itemOverrides = {}) {
  return {
    email: 'buyer@test.local',
    items: [{ product: product.id, name: product.name, quantity: 1, size: 'M', ...itemOverrides }],
    // Order.shippingRegion (used for the flat-rate lookup) is a distinct
    // top-level field from shippingAddress's own embedded `region` — see
    // the schema comment on Order.shipTo* for why these aren't the same.
    shippingRegion: '13', // NCR — ₱99 flat rate, below the ₱2000 free-shipping threshold
    shippingAddress: {
      fullName: 'Juan Dela Cruz',
      phone: '09171234567',
      address: '123 Rizal St',
      city: 'Quezon City',
      province: 'Metro Manila',
      zipCode: '1100',
    },
  };
}

beforeAll(async () => {
  await prisma.user.upsert({
    where: { id: 'test-user' },
    create: { id: 'test-user', email: `order-route-owner-${Date.now()}@test.local`, firstName: 'Order', lastName: 'Owner' },
    update: {},
  });
  createdUserIds.push('test-user');
}, 15000);

// Call-count assertions (e.g. "createCheckout was never called") would
// otherwise see calls left over from earlier tests in this file — the
// mocked services are shared vi.fn()s across the whole suite.
beforeEach(() => {
  vi.clearAllMocks();
  emailService.sendOrderConfirmationEmail.mockResolvedValue(undefined);
});

afterAll(async () => {
  await prisma.orderItem.deleteMany({ where: { productId: { in: createdProductIds } } });
  await prisma.order.deleteMany({ where: { email: { in: ['buyer@test.local', 'guest@test.local'] } } });
  await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe('POST /orders — stock reservation atomicity', () => {
  it('creates an order and atomically decrements stock', async () => {
    const product = await makeProduct({ name: 'Decrement' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_1', redirectUrl: 'https://pay.example/chk_1' });

    const res = await request(app).post('/api/orders').send(validOrderPayload(product));
    expect(res.status).toBe(201);
    expect(res.body.data.orderNumber).toMatch(/^PS-\d{8}-[A-Z0-9]{6}$/);
    expect(res.body.data.checkoutUrl).toBe('https://pay.example/chk_1');

    const size = await prisma.productSize.findFirst({ where: { productId: product.id, size: 'M' } });
    expect(size.stock).toBe(9); // 10 - 1

    const updatedProduct = await prisma.product.findUnique({ where: { id: product.id } });
    expect(updatedProduct.totalSold).toBe(1);
  }, 15000);

  it('computes shipping fee server-side, ignoring any client-supplied value', async () => {
    const product = await makeProduct({ name: 'ShippingFee' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_2', redirectUrl: 'https://pay.example/chk_2' });

    const payload = validOrderPayload(product);
    const res = await request(app).post('/api/orders').send({ ...payload, shippingFee: 0, total: 1 });
    expect(res.status).toBe(201);

    const order = await prisma.order.findUnique({ where: { orderNumber: res.body.data.orderNumber } });
    expect(order.shippingFee).toBe(99); // NCR flat rate, not the client's fabricated 0
    expect(order.total).toBe(599); // 500 + 99, not the client's fabricated 1
  }, 15000);

  it('rejects insufficient stock and decrements nothing — atomic across the whole order, not per-item', async () => {
    const plentiful = await makeProduct({ name: 'Plentiful', sizes: { create: [{ size: 'M', stock: 10 }] } });
    const scarce = await makeProduct({ name: 'Scarce', sizes: { create: [{ size: 'M', stock: 1 }] } });

    const res = await request(app).post('/api/orders').send({
      ...validOrderPayload(plentiful),
      items: [
        { product: plentiful.id, name: plentiful.name, quantity: 1, size: 'M' },
        { product: scarce.id, name: scarce.name, quantity: 5, size: 'M' }, // exceeds available stock
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/insufficient stock/i);

    // the FIRST item's decrement must have been rolled back too — this is
    // exactly the atomicity bug the original per-item loop had
    const plentifulSize = await prisma.productSize.findFirst({ where: { productId: plentiful.id, size: 'M' } });
    expect(plentifulSize.stock).toBe(10);
    const scarceSize = await prisma.productSize.findFirst({ where: { productId: scarce.id, size: 'M' } });
    expect(scarceSize.stock).toBe(1);

    expect(paymentService.createCheckoutSession).not.toHaveBeenCalled();
  }, 15000);

  it('the actual race: two concurrent orders for the last unit — only one succeeds', async () => {
    const product = await makeProduct({ name: 'RaceCondition', sizes: { create: [{ size: 'M', stock: 1 }] } });
    paymentService.createCheckoutSession.mockResolvedValue({ paymentReference: 'chk_race', redirectUrl: 'https://pay.example/chk_race' });

    const [a, b] = await Promise.allSettled([
      request(app).post('/api/orders').send(validOrderPayload(product)),
      request(app).post('/api/orders').send(validOrderPayload(product)),
    ]);

    const statuses = [a.value.status, b.value.status].sort();
    expect(statuses).toEqual([201, 400]);

    const size = await prisma.productSize.findFirst({ where: { productId: product.id, size: 'M' } });
    expect(size.stock).toBe(0); // never goes negative, exactly one unit taken
  }, 20000);

  it('releases the stock reservation when Maya checkout creation fails', async () => {
    const product = await makeProduct({ name: 'MayaFailure' });
    paymentService.createCheckoutSession.mockRejectedValueOnce(new Error('Maya is down'));

    const res = await request(app).post('/api/orders').send(validOrderPayload(product));
    expect(res.status).toBe(500);
    expect(res.body.orderNumber).toMatch(/^PS-\d{8}-[A-Z0-9]{6}$/);

    const size = await prisma.productSize.findFirst({ where: { productId: product.id, size: 'M' } });
    expect(size.stock).toBe(10); // released, not left permanently decremented

    const order = await prisma.order.findUnique({ where: { orderNumber: res.body.orderNumber } });
    expect(order.paymentStatus).toBe('failed');
  }, 15000);
});

describe('POST /orders — structural validation', () => {
  it('400s for a non-existent or inactive product', async () => {
    const res = await request(app).post('/api/orders').send({
      ...validOrderPayload({ id: '00000000-0000-0000-0000-000000000000' }),
      items: [{ product: '00000000-0000-0000-0000-000000000000', name: 'Ghost', quantity: 1, size: 'M' }],
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/product not found/i);
  });

  it('400s for a color that does not exist on the product', async () => {
    // Needs a real color variant — the route only checks color existence
    // at all when the product actually has color variants, matching the
    // original `item.color && product.colors?.length > 0` condition.
    const product = await makeProduct({
      name: 'NoSuchColor',
      sizes: undefined,
      colors: { create: [{ color: 'Navy', hex: '#000080', sizes: { create: [{ size: 'M', stock: 10 }] } }] },
    });
    const res = await request(app).post('/api/orders').send(validOrderPayload(product, { color: 'Not A Real Color' }));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/color/i);
  });

  it('400s for a size that does not exist on the product', async () => {
    const product = await makeProduct({ name: 'NoSuchSize' });
    const res = await request(app).post('/api/orders').send(validOrderPayload(product, { size: 'XXXL' }));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/insufficient stock/i);
  });

  it('400s on missing required shippingAddress fields', async () => {
    const res = await request(app).post('/api/orders').send({ email: 'buyer@test.local', items: [], shippingAddress: {} });
    expect(res.status).toBe(400);
  });
});

describe('Webhook signature/authenticity — the platform audit\'s critical fix', () => {
  it('a forged webhook body claiming PAYMENT_SUCCESS does NOT mark the order paid unless Maya\'s own API confirms it', async () => {
    const product = await makeProduct({ name: 'ForgedWebhook' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_forge', redirectUrl: 'https://pay.example/chk_forge' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const { orderNumber } = createRes.body.data;

    // The attacker's payload claims success, but the authenticated pull
    // against Maya (mocked here) says otherwise — this is the entire
    // point of not trusting req.body.status directly.
    paymentService.getPaymentStatus.mockResolvedValueOnce({ status: 'failed' });

    const webhookRes = await request(app).post('/api/orders/webhooks/maya').send({
      requestReferenceNumber: orderNumber,
      status: 'PAYMENT_SUCCESS', // forged
    });
    expect(webhookRes.status).toBe(200);

    const order = await prisma.order.findUnique({ where: { orderNumber } });
    expect(order.paymentStatus).toBe('failed'); // driven by the real Maya check, not the forged claim
    expect(emailService.sendOrderConfirmationEmail).not.toHaveBeenCalled();
  }, 15000);

  it('a genuine webhook (real Maya status confirms success) marks the order paid, records a shipping event, and emails once', async () => {
    const product = await makeProduct({ name: 'RealWebhook' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_real', redirectUrl: 'https://pay.example/chk_real' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const { orderNumber } = createRes.body.data;

    paymentService.getPaymentStatus.mockResolvedValue({ status: 'succeeded' });

    const first = await request(app).post('/api/orders/webhooks/maya').send({ requestReferenceNumber: orderNumber, status: 'PAYMENT_SUCCESS' });
    expect(first.status).toBe(200);

    const order = await prisma.order.findUnique({ where: { orderNumber } });
    expect(order.paymentStatus).toBe('paid');
    expect(order.orderStatus).toBe('confirmed');
    expect(emailService.sendOrderConfirmationEmail).toHaveBeenCalledTimes(1);

    const shippingEvent = await prisma.shippingEvent.findFirst({ where: { orderId: orderNumber } });
    expect(shippingEvent).not.toBeNull();

    // idempotent — a duplicate webhook delivery (Maya's own retry
    // behavior, or a race with /verify-payment) must not re-send the email
    const second = await request(app).post('/api/orders/webhooks/maya').send({ requestReferenceNumber: orderNumber, status: 'PAYMENT_SUCCESS' });
    expect(second.status).toBe(200);
    expect(emailService.sendOrderConfirmationEmail).toHaveBeenCalledTimes(1);
  }, 20000);

  it('webhook PAYMENT_FAILED restores stock', async () => {
    const product = await makeProduct({ name: 'WebhookFailRestore' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_fail', redirectUrl: 'https://pay.example/chk_fail' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const { orderNumber } = createRes.body.data;

    const beforeSize = await prisma.productSize.findFirst({ where: { productId: product.id, size: 'M' } });
    expect(beforeSize.stock).toBe(9);

    paymentService.getPaymentStatus.mockResolvedValueOnce({ status: 'failed' });
    const res = await request(app).post('/api/orders/webhooks/maya').send({ requestReferenceNumber: orderNumber, status: 'PAYMENT_FAILED' });
    expect(res.status).toBe(200);

    const afterSize = await prisma.productSize.findFirst({ where: { productId: product.id, size: 'M' } });
    expect(afterSize.stock).toBe(10);
  }, 15000);

  it('silently acknowledges a webhook for an unknown order, without erroring', async () => {
    const res = await request(app).post('/api/orders/webhooks/maya').send({ requestReferenceNumber: 'PS-NOSUCHORDER', status: 'PAYMENT_SUCCESS' });
    expect(res.status).toBe(200);
  });

  it('rejects a webhook with no requestReferenceNumber', async () => {
    const res = await request(app).post('/api/orders/webhooks/maya').send({ status: 'PAYMENT_SUCCESS' });
    expect(res.status).toBe(400);
  });
});

describe('POST /orders/:orderNumber/verify-payment', () => {
  it('resolves a pending order to paid via the authenticated Maya pull', async () => {
    const product = await makeProduct({ name: 'VerifyPaid' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_verify', redirectUrl: 'https://pay.example/chk_verify' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const { orderNumber } = createRes.body.data;

    paymentService.getPaymentStatus.mockResolvedValueOnce({ status: 'succeeded' });
    const res = await request(app).post(`/api/orders/${orderNumber}/verify-payment`);
    expect(res.status).toBe(200);
    expect(res.body.data.paymentStatus).toBe('paid');
  }, 15000);

  it('does not call Maya again once already resolved', async () => {
    const product = await makeProduct({ name: 'VerifyAlreadyResolved' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_ar', redirectUrl: 'https://pay.example/chk_ar' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const { orderNumber } = createRes.body.data;

    paymentService.getPaymentStatus.mockResolvedValueOnce({ status: 'succeeded' });
    await request(app).post(`/api/orders/${orderNumber}/verify-payment`);

    paymentService.getPaymentStatus.mockClear();
    const res = await request(app).post(`/api/orders/${orderNumber}/verify-payment`);
    expect(res.status).toBe(200);
    expect(res.body.data.paymentStatus).toBe('paid');
    expect(paymentService.getPaymentStatus).not.toHaveBeenCalled();
  }, 15000);

  it('404s for an unknown order number', async () => {
    const res = await request(app).post('/api/orders/PS-NOSUCHORDER/verify-payment');
    expect(res.status).toBe(404);
  });
});

describe('GET /orders/:orderNumber — access control', () => {
  it('a guest (no owning user) order is readable by anyone', async () => {
    const product = await makeProduct({ name: 'GuestOrder' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_guest', redirectUrl: 'https://pay.example/chk_guest' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const { orderNumber } = createRes.body.data;

    const res = await request(app).get(`/api/orders/${orderNumber}`);
    expect(res.status).toBe(200);
    expect(res.body.data.orderNumber).toBe(orderNumber);
    expect(res.body.data.items[0].product.name).toBe(product.name); // items.product populated
  }, 15000);

  it('an owned order is forbidden to a different logged-in user, allowed to its owner and to an admin', async () => {
    const product = await makeProduct({ name: 'OwnedOrder' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_owned', redirectUrl: 'https://pay.example/chk_owned' });
    const createRes = await request(app)
      .post('/api/orders')
      .set('x-test-userid', 'test-user')
      .send(validOrderPayload(product));
    const { orderNumber } = createRes.body.data;

    const forbidden = await request(app).get(`/api/orders/${orderNumber}`).set('x-test-userid', 'someone-else');
    expect(forbidden.status).toBe(403);

    const owner = await request(app).get(`/api/orders/${orderNumber}`).set('x-test-userid', 'test-user');
    expect(owner.status).toBe(200);

    const admin = await request(app)
      .get(`/api/orders/${orderNumber}`)
      .set('x-test-userid', 'someone-else')
      .set('x-test-role', 'admin');
    expect(admin.status).toBe(200);
  }, 15000);

  it('404s for a non-existent order number', async () => {
    const res = await request(app).get('/api/orders/PS-NOSUCHORDER');
    expect(res.status).toBe(404);
  });
});

describe('GET /orders/user/:userId', () => {
  it('allows a user to list their own orders, forbids listing someone else\'s', async () => {
    const own = await request(app).get('/api/orders/user/test-user').set('x-test-userid', 'test-user');
    expect(own.status).toBe(200);
    expect(Array.isArray(own.body.data)).toBe(true);

    const forbidden = await request(app).get('/api/orders/user/test-user').set('x-test-userid', 'someone-else');
    expect(forbidden.status).toBe(403);
  });
});

describe('admin order routes', () => {
  it('PATCH /:id/status updates status/tracking/courier', async () => {
    const product = await makeProduct({ name: 'AdminStatusUpdate' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_admin', redirectUrl: 'https://pay.example/chk_admin' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const order = await prisma.order.findUnique({ where: { orderNumber: createRes.body.data.orderNumber } });

    const res = await request(app)
      .patch(`/api/orders/${order.id}/status`)
      .send({ orderStatus: 'shipped', trackingNumber: 'TRACK123', courier: 'LBC' });
    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe('shipped');
    expect(res.body.data.trackingNumber).toBe('TRACK123');
  }, 15000);

  it('PATCH /:id/status 404s for a non-existent order', async () => {
    const res = await request(app).patch('/api/orders/00000000-0000-0000-0000-000000000000/status').send({ orderStatus: 'shipped' });
    expect(res.status).toBe(404);
  });

  it('GET /admin/all lists orders with pagination', async () => {
    const res = await request(app).get('/api/orders/admin/all?limit=5');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toHaveProperty('total');
  });

  it('GET /admin/export returns CSV', async () => {
    const res = await request(app).get('/api/orders/admin/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('Order #');
  });

  it('GET /admin/stats returns revenue/status/low-stock data', async () => {
    const res = await request(app).get('/api/orders/admin/stats');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('totalRevenue');
    expect(res.body.data).toHaveProperty('ordersByStatus');
    expect(res.body.data).toHaveProperty('lowStockProducts');
  });
});
