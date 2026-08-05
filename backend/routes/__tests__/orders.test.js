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
  // Real value (Maya's real, verified 1-hour session), not mocked away —
  // the dual-write tests below assert a real computed expiresAt exists.
  getSessionDurationMs: vi.fn().mockReturnValue(60 * 60 * 1000),
}));

vi.mock('../../services/emailService.js', () => ({
  sendOrderConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentPendingEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentFailedEmail: vi.fn().mockResolvedValue(undefined),
  sendOrderStatusEmail: vi.fn().mockResolvedValue(undefined),
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
  emailService.sendPaymentPendingEmail.mockResolvedValue(undefined);
  emailService.sendPaymentFailedEmail.mockResolvedValue(undefined);
  emailService.sendOrderStatusEmail.mockResolvedValue(undefined);
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
    expect(order.orderStatus).toBe('failed_payment'); // Payment Platform Redesign, Phase 2 — previously left untouched
    expect(emailService.sendOrderConfirmationEmail).not.toHaveBeenCalled();
    // Payment Platform Redesign, Phase 6 — 'failed', not 'expired' — a real
    // gateway rejection, not a lapsed session.
    expect(emailService.sendPaymentFailedEmail).toHaveBeenCalledWith(
      order.email, expect.objectContaining({ orderNumber }), 'failed'
    );
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
    expect(order.orderStatus).toBe('paid'); // Payment Platform Redesign, Phase 2 — was 'confirmed'
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

  it('resolves an order from a requestReferenceNumber carrying mayaGateway.js\'s attempt-unique "#" suffix', async () => {
    const product = await makeProduct({ name: 'HashSuffixWebhook' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_hash', redirectUrl: 'https://pay.example/chk_hash' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const { orderNumber } = createRes.body.data;

    paymentService.getPaymentStatus.mockResolvedValueOnce({ status: 'succeeded' });
    const res = await request(app).post('/api/orders/webhooks/maya').send({
      requestReferenceNumber: `${orderNumber}#1785950000000`,
      status: 'PAYMENT_SUCCESS',
    });
    expect(res.status).toBe(200);

    const order = await prisma.order.findUnique({ where: { orderNumber } });
    expect(order.paymentStatus).toBe('paid');
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

describe('Payment dual-write (Payment Platform Redesign, Phase 1)', () => {
  it('order creation writes a matching pending Payment row alongside the legacy Order fields', async () => {
    const product = await makeProduct({ name: 'DualWriteCreate' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_dualwrite', redirectUrl: 'https://pay.example/chk_dualwrite' });

    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const order = await prisma.order.findUnique({ where: { orderNumber: createRes.body.data.orderNumber } });

    // The Payment write is fire-and-forget relative to the response —
    // poll briefly rather than assuming it's already committed.
    let payment = null;
    for (let i = 0; i < 20; i++) {
      payment = await prisma.payment.findFirst({ where: { orderId: order.id } });
      if (payment) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(payment).not.toBeNull();
    expect(payment.provider).toBe('maya');
    expect(payment.status).toBe('pending');
    expect(payment.checkoutReference).toBe(order.mayaPaymentId);
    expect(payment.checkoutUrl).toBe(order.mayaCheckoutUrl);
    expect(payment.expiresAt).not.toBeNull(); // computed at creation — Maya never returns one
  }, 15000);

  it('a resolved payment leaves Order.paymentStatus and the matching Payment.status in agreement', async () => {
    const product = await makeProduct({ name: 'DualWriteResolve' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_dualwrite_resolve', redirectUrl: 'https://pay.example/chk_dualwrite_resolve' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const { orderNumber } = createRes.body.data;

    paymentService.getPaymentStatus.mockResolvedValueOnce({ status: 'succeeded' });
    await request(app).post(`/api/orders/${orderNumber}/verify-payment`);

    const order = await prisma.order.findUnique({ where: { orderNumber } });
    expect(order.paymentStatus).toBe('paid');

    let payment = null;
    for (let i = 0; i < 20; i++) {
      payment = await prisma.payment.findFirst({ where: { orderId: order.id }, orderBy: { createdAt: 'desc' } });
      if (payment?.status === 'succeeded') break;
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(payment.status).toBe('succeeded');
    expect(payment.paidAt).not.toBeNull();
  }, 15000);
});

describe('Order status granularity (Payment Platform Redesign, Phase 2)', () => {
  it('a new order defaults to awaiting_payment, not the old processing default', async () => {
    const product = await makeProduct({ name: 'DefaultStatus' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_default_status', redirectUrl: 'https://pay.example/chk_default_status' });

    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const order = await prisma.order.findUnique({ where: { orderNumber: createRes.body.data.orderNumber } });
    expect(order.orderStatus).toBe('awaiting_payment');
    // Payment Platform Redesign, Phase 6 — the only email that used to fire
    // was on success; a still-pending order (the normal case) got silence.
    expect(emailService.sendPaymentPendingEmail).toHaveBeenCalledWith(
      order.email, expect.objectContaining({ orderNumber: order.orderNumber })
    );
  }, 15000);

  it('an expired checkout session marks the order expired, distinct from a failed one', async () => {
    const product = await makeProduct({ name: 'ExpiredStatus' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_expired_status', redirectUrl: 'https://pay.example/chk_expired_status' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const { orderNumber } = createRes.body.data;

    paymentService.getPaymentStatus.mockResolvedValueOnce({ status: 'expired' });
    await request(app).post(`/api/orders/${orderNumber}/verify-payment`);

    const order = await prisma.order.findUnique({ where: { orderNumber } });
    expect(order.paymentStatus).toBe('failed'); // PaymentStatus stays the coarser 2-state-terminal vocabulary
    expect(order.orderStatus).toBe('expired'); // OrderStatus carries the real distinction
    // Payment Platform Redesign, Phase 6 — 'expired' reason, distinct copy
    // from a real gateway failure ("session expired" vs "didn't go through").
    expect(emailService.sendPaymentFailedEmail).toHaveBeenCalledWith(
      order.email, expect.objectContaining({ orderNumber }), 'expired'
    );
  }, 20000);

  it('PATCH /:id/status 400s on an orderStatus value outside the valid set, and never touches the order', async () => {
    const product = await makeProduct({ name: 'InvalidStatus' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_invalid_status', redirectUrl: 'https://pay.example/chk_invalid_status' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const order = await prisma.order.findUnique({ where: { orderNumber: createRes.body.data.orderNumber } });

    const res = await request(app).patch(`/api/orders/${order.id}/status`).send({ orderStatus: 'not_a_real_status' });
    expect(res.status).toBe(400);

    const unchanged = await prisma.order.findUnique({ where: { id: order.id } });
    expect(unchanged.orderStatus).toBe(order.orderStatus);
  }, 15000);

  it('PATCH /:id/status rejects the legacy "confirmed" value — nothing may set it again', async () => {
    const product = await makeProduct({ name: 'LegacyStatus' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_legacy_status', redirectUrl: 'https://pay.example/chk_legacy_status' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const order = await prisma.order.findUnique({ where: { orderNumber: createRes.body.data.orderNumber } });

    const res = await request(app).patch(`/api/orders/${order.id}/status`).send({ orderStatus: 'confirmed' });
    expect(res.status).toBe(400);
  }, 15000);
});

describe('Fit Check bonus grants (Phase 2)', () => {
  it("grants the first-purchase bonus when a registered user's order resolves to paid, but only once", async () => {
    const buyer = await prisma.user.create({
      data: { email: `bonus-first-purchase-${Date.now()}@test.local`, firstName: 'Bonus', lastName: 'Buyer' },
    });
    createdUserIds.push(buyer.id);

    const product = await makeProduct({ name: 'FirstPurchaseBonus' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_fp', redirectUrl: 'https://pay.example/chk_fp' });
    const createRes = await request(app)
      .post('/api/orders')
      .set('x-test-userid', buyer.id)
      .send(validOrderPayload(product));

    paymentService.getPaymentStatus.mockResolvedValueOnce({ status: 'succeeded' });
    await request(app)
      .post(`/api/orders/${createRes.body.data.orderNumber}/verify-payment`)
      .set('x-test-userid', buyer.id);

    // Fire-and-forget, same pattern as the guest-migration/email-verified
    // bonus tests — poll briefly rather than assuming it's already committed.
    let grant = null;
    for (let i = 0; i < 20; i++) {
      grant = await prisma.bonusFitCheckGrant.findFirst({ where: { userId: buyer.id, reason: 'first_purchase' } });
      if (grant) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(grant).not.toBeNull();
    expect(grant.amount).toBeGreaterThan(0);

    // A second paid order for the same buyer must not grant a second time —
    // grantEventBonus's own once-per-user idempotency, not an order-history
    // query, is what makes this correctly "first purchase only."
    const product2 = await makeProduct({ name: 'SecondPurchase' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_fp2', redirectUrl: 'https://pay.example/chk_fp2' });
    const createRes2 = await request(app)
      .post('/api/orders')
      .set('x-test-userid', buyer.id)
      .send(validOrderPayload(product2));
    paymentService.getPaymentStatus.mockResolvedValueOnce({ status: 'succeeded' });
    await request(app)
      .post(`/api/orders/${createRes2.body.data.orderNumber}/verify-payment`)
      .set('x-test-userid', buyer.id);
    await new Promise((r) => setTimeout(r, 300));

    const grants = await prisma.bonusFitCheckGrant.findMany({ where: { userId: buyer.id, reason: 'first_purchase' } });
    expect(grants).toHaveLength(1);
  }, 40000);

  it('a guest checkout (no account) never grants a first-purchase bonus', async () => {
    const product = await makeProduct({ name: 'GuestNoBonus' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_guest_bonus', redirectUrl: 'https://pay.example/chk_guest_bonus' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product)); // no x-test-userid — a guest order

    paymentService.getPaymentStatus.mockResolvedValueOnce({ status: 'succeeded' });
    const res = await request(app).post(`/api/orders/${createRes.body.data.orderNumber}/verify-payment`);
    await new Promise((r) => setTimeout(r, 300));

    expect(res.body.data.paymentStatus).toBe('paid');
    const order = await prisma.order.findUnique({ where: { orderNumber: createRes.body.data.orderNumber } });
    expect(order.userId).toBeNull(); // nothing to grant against — grantEventBonus is never even reachable
  }, 20000);
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
    // Payment Platform Redesign, Phase 3 — the latest Payment attempt's
    // customer-safe fields, nested alongside the order.
    expect(res.body.data.payment).toMatchObject({ provider: 'maya', status: 'pending', checkoutUrl: 'https://pay.example/chk_guest' });
    expect(res.body.data.payment.expiresAt).not.toBeNull();
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

describe('POST /orders/:orderNumber/pay — resume or regenerate checkout (Payment Platform Redesign, Phase 3)', () => {
  it('resumes an existing still-valid session without creating a new Payment row', async () => {
    const product = await makeProduct({ name: 'PayResume' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_resume', redirectUrl: 'https://pay.example/chk_resume' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const { orderNumber } = createRes.body.data;
    const order = await prisma.order.findUnique({ where: { orderNumber } });
    const before = await prisma.payment.count({ where: { orderId: order.id } });

    const res = await request(app).post(`/api/orders/${orderNumber}/pay`);
    expect(res.status).toBe(200);
    expect(res.body.data.checkoutUrl).toBe('https://pay.example/chk_resume');
    expect(res.body.data.resumed).toBe(true);
    expect(paymentService.createCheckoutSession).toHaveBeenCalledTimes(1); // only order creation's own call

    const after = await prisma.payment.count({ where: { orderId: order.id } });
    expect(after).toBe(before); // no new attempt row written
  }, 15000);

  it('regenerates a new session once the existing one has expired, writing a new Payment row', async () => {
    const product = await makeProduct({ name: 'PayRegenerate' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_old', redirectUrl: 'https://pay.example/chk_old' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const { orderNumber } = createRes.body.data;
    const order = await prisma.order.findUnique({ where: { orderNumber } });

    // Force the existing attempt into the past — same effect as its real 1-hour Maya window elapsing.
    await prisma.payment.updateMany({ where: { orderId: order.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_new', redirectUrl: 'https://pay.example/chk_new' });
    const res = await request(app).post(`/api/orders/${orderNumber}/pay`);
    expect(res.status).toBe(200);
    expect(res.body.data.checkoutUrl).toBe('https://pay.example/chk_new');
    expect(res.body.data.resumed).toBe(false);

    const payments = await prisma.payment.findMany({ where: { orderId: order.id }, orderBy: { createdAt: 'asc' } });
    expect(payments).toHaveLength(2); // the customer never rebuilds their cart — this is a new attempt, not a lost order
    expect(payments[1].checkoutReference).toBe('chk_new');

    const updatedOrder = await prisma.order.findUnique({ where: { orderNumber } });
    expect(updatedOrder.mayaPaymentId).toBe('chk_new'); // legacy field kept in sync, Phase 1's dual-write coexistence
  }, 15000);

  it('400s when the order is already paid', async () => {
    const product = await makeProduct({ name: 'PayAlreadyPaid' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_paid', redirectUrl: 'https://pay.example/chk_paid' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const { orderNumber } = createRes.body.data;

    paymentService.getPaymentStatus.mockResolvedValueOnce({ status: 'succeeded' });
    await request(app).post(`/api/orders/${orderNumber}/verify-payment`);

    const res = await request(app).post(`/api/orders/${orderNumber}/pay`);
    expect(res.status).toBe(400);
  }, 15000);

  it('400s when the order has been cancelled', async () => {
    const product = await makeProduct({ name: 'PayCancelled' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_cancel', redirectUrl: 'https://pay.example/chk_cancel' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const { orderNumber } = createRes.body.data;
    const order = await prisma.order.findUnique({ where: { orderNumber } });

    await prisma.order.update({ where: { id: order.id }, data: { orderStatus: 'cancelled' } });

    const res = await request(app).post(`/api/orders/${orderNumber}/pay`);
    expect(res.status).toBe(400);
  }, 15000);

  it('404s for an unknown order number', async () => {
    const res = await request(app).post('/api/orders/PS-NOSUCHORDER/pay');
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
    // Payment Platform Redesign, Phase 6 — one parameterized email for
    // every admin-driven fulfillment transition.
    expect(emailService.sendOrderStatusEmail).toHaveBeenCalledWith(
      order.email, expect.objectContaining({ orderNumber: order.orderNumber }), 'shipped'
    );
  }, 15000);

  it('PATCH /:id/status does not email when orderStatus is unchanged (courier/tracking-only update)', async () => {
    const product = await makeProduct({ name: 'AdminStatusUnchanged' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_admin2', redirectUrl: 'https://pay.example/chk_admin2' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const order = await prisma.order.findUnique({ where: { orderNumber: createRes.body.data.orderNumber } });
    emailService.sendOrderStatusEmail.mockClear();

    const res = await request(app)
      .patch(`/api/orders/${order.id}/status`)
      .send({ orderStatus: order.orderStatus, courier: 'J&T' });
    expect(res.status).toBe(200);
    expect(emailService.sendOrderStatusEmail).not.toHaveBeenCalled();
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

describe('GET /orders/:orderNumber/events — the Admin Order Timeline', () => {
  it('records created + payment_pending on a successful order, ascending by time', async () => {
    const product = await makeProduct({ name: 'EventsCreated' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_evt1', redirectUrl: 'https://pay.example/chk_evt1' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const { orderNumber } = createRes.body.data;

    const res = await request(app).get(`/api/orders/${orderNumber}/events`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((e) => e.type)).toEqual(['created', 'payment_pending']);
    expect(res.body.data[0].actor).toBe('system'); // guest, no req.user
    for (let i = 1; i < res.body.data.length; i++) {
      expect(new Date(res.body.data[i].createdAt).getTime()).toBeGreaterThanOrEqual(new Date(res.body.data[i - 1].createdAt).getTime());
    }
  }, 15000);

  it('records a payment_failed event when gateway checkout creation fails', async () => {
    const product = await makeProduct({ name: 'EventsGatewayFail' });
    paymentService.createCheckoutSession.mockRejectedValueOnce(new Error('Maya is down'));
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const { orderNumber } = createRes.body;

    const res = await request(app).get(`/api/orders/${orderNumber}/events`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((e) => e.type)).toEqual(['created', 'payment_failed']);
  }, 15000);

  it('records webhook_received + payment_succeeded with actor "webhook" on a genuine webhook', async () => {
    const product = await makeProduct({ name: 'EventsWebhookSuccess' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_evt2', redirectUrl: 'https://pay.example/chk_evt2' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const { orderNumber } = createRes.body.data;

    paymentService.getPaymentStatus.mockResolvedValueOnce({ status: 'succeeded' });
    await request(app).post('/api/orders/webhooks/maya').send({ requestReferenceNumber: orderNumber, status: 'PAYMENT_SUCCESS' });

    const res = await request(app).get(`/api/orders/${orderNumber}/events`);
    expect(res.body.data.map((e) => e.type)).toEqual(['created', 'payment_pending', 'webhook_received', 'payment_succeeded']);
    expect(res.body.data.at(-1).actor).toBe('webhook');
  }, 15000);

  it('records a status_updated event attributed to the admin who made the change', async () => {
    const product = await makeProduct({ name: 'EventsAdminUpdate' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_evt3', redirectUrl: 'https://pay.example/chk_evt3' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const { orderNumber } = createRes.body.data;
    const order = await prisma.order.findUnique({ where: { orderNumber } });

    await request(app)
      .patch(`/api/orders/${order.id}/status`)
      .set('x-test-userid', 'test-user')
      .set('x-test-role', 'admin')
      .send({ orderStatus: 'shipped', courier: 'LBC', trackingNumber: 'TRACK1' });

    const res = await request(app).get(`/api/orders/${orderNumber}/events`);
    const statusEvent = res.body.data.find((e) => e.type === 'status_updated');
    expect(statusEvent.actor).toBe('admin');
    expect(statusEvent.actorUser._id).toBe('test-user');
    expect(statusEvent.message).toMatch(/status: awaiting_payment → shipped/); // Payment Platform Redesign, Phase 2 — was 'processing'
  }, 15000);

  it('does not record a status_updated event when nothing actually changed', async () => {
    const product = await makeProduct({ name: 'EventsAdminNoop' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_evt4', redirectUrl: 'https://pay.example/chk_evt4' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const { orderNumber } = createRes.body.data;
    const order = await prisma.order.findUnique({ where: { orderNumber } });

    await request(app)
      .patch(`/api/orders/${order.id}/status`)
      .set('x-test-userid', 'test-user')
      .set('x-test-role', 'admin')
      .send({ orderStatus: order.orderStatus });

    const res = await request(app).get(`/api/orders/${orderNumber}/events`);
    expect(res.body.data.some((e) => e.type === 'status_updated')).toBe(false);
  }, 20000);

  it('404s for an unknown order number', async () => {
    const res = await request(app).get('/api/orders/PS-NOSUCHORDER/events');
    expect(res.status).toBe(404);
  });
});
