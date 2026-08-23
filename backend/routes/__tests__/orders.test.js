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
  requirePermission: () => (req, res, next) => next(),
  requireAnyPermission: () => (req, res, next) => next(),
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
vi.mock('../../lib/orderConfirmationEmail.js', () => ({
  sendOrderConfirmation: vi.fn().mockResolvedValue(undefined),
}));

const { default: ordersRouter } = await import('../orders.js');
const paymentService = await import('../../services/paymentService.js');
const emailService = await import('../../services/emailService.js');
const confirmationEmail = await import('../../lib/orderConfirmationEmail.js');

const app = express();
app.use(express.json());
app.use('/api/orders', ordersRouter);

const MARKER = `OrderRouteTest${Date.now()}`;
// xenditWebhookVerify (middleware/xenditWebhookVerify.js) reads this at
// request time — set once for the whole file, same as any other real
// config value these webhook tests need.
process.env.XENDIT_WEBHOOK_TOKEN = 'test-xendit-webhook-token';
const createdProductIds = [];
const createdUserIds = [];
const createdOwnedOrderIds = [];

async function makeProduct(overrides = {}) {
  // `name` is derived from overrides.name before the spread below, so
  // ...overrides must not be allowed to clobber it back to the bare,
  // unprefixed value — that previously stripped the MARKER prefix off
  // every test product's name (e.g. 'Decrement' instead of
  // 'OrderRouteTest<ts> Decrement'), leaving orphaned rows with no visual
  // marker if a run never reached afterAll's cleanup.
  const { name: nameOverride, ...restOverrides } = overrides;
  const product = await prisma.product.create({
    data: {
      name: `${MARKER} ${nameOverride || 'Product'}`,
      slug: `order-route-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      description: 'x',
      price: 500,
      category: 'jersey',
      sport: 'basketball',
      images: ['https://example.com/img.jpg'],
      active: true,
      totalStock: 10,
      sizes: { create: [{ size: 'M', stock: 10 }] },
      ...restOverrides,
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
    // Chosen in our own checkout UI before redirect (ADR-010) — required
    // on every order so the exact gateway fee for the channel charged is
    // always known and disclosed, never a blended guess.
    paymentChannel: 'GCASH',
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

// Creates a user-owned order directly (no gateway call) for ownership tests.
// Every order number here carries this file's MARKER so cleanup can find it.
async function makeOwnedOrder({ userId, email = `owned-${Date.now()}@test.local` } = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const order = await prisma.order.create({
    data: {
      orderNumber: `PS-MARKEROWN-${suffix}`,
      userId,
      email,
      shipToFullName: 'Owned Buyer',
      shipToPhone: '09171234567',
      shipToAddress: '1 St',
      shipToCity: 'QC',
      shipToProvince: 'Metro Manila',
      shipToZipCode: '1100',
      subtotal: 500,
      total: 599,
      paymentStatus: 'pending',
      orderStatus: 'awaiting_payment',
    },
  });
  createdOwnedOrderIds.push(order.id);
  return order;
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
  await prisma.order.deleteMany({ where: { id: { in: createdOwnedOrderIds } } });
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
    // 500 + 99 + GCash's 2% gateway fee (validOrderPayload's default
    // channel), not the client's fabricated 1.
    expect(order.total).toBe(599 + 11.98);
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

describe('POST /orders — quantity validation (Finding #3 remediation)', () => {
  it('400s a negative quantity, with zero side effects: no Order, no OrderItem, no payment session, no stock/totalStock/totalSold mutation', async () => {
    const product = await makeProduct({ name: 'NegativeQuantity' });
    const beforeSize = await prisma.productSize.findFirst({ where: { productId: product.id, size: 'M' } });
    const beforeProduct = await prisma.product.findUnique({ where: { id: product.id } });

    const res = await request(app).post('/api/orders').send(validOrderPayload(product, { quantity: -1 }));
    expect(res.status).toBe(400);
    expect(paymentService.createCheckoutSession).not.toHaveBeenCalled();

    const orderItems = await prisma.orderItem.findMany({ where: { productId: product.id } });
    expect(orderItems).toHaveLength(0);

    const afterSize = await prisma.productSize.findFirst({ where: { productId: product.id, size: 'M' } });
    expect(afterSize.stock).toBe(beforeSize.stock);
    const afterProduct = await prisma.product.findUnique({ where: { id: product.id } });
    expect(afterProduct.totalStock).toBe(beforeProduct.totalStock);
    expect(afterProduct.totalSold).toBe(beforeProduct.totalSold);
  });

  it('400s a zero quantity', async () => {
    const product = await makeProduct({ name: 'ZeroQuantity' });
    const res = await request(app).post('/api/orders').send(validOrderPayload(product, { quantity: 0 }));
    expect(res.status).toBe(400);
    expect(paymentService.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('400s a fractional quantity', async () => {
    const product = await makeProduct({ name: 'FractionalQuantity' });
    const res = await request(app).post('/api/orders').send(validOrderPayload(product, { quantity: 1.5 }));
    expect(res.status).toBe(400);
    expect(paymentService.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('400s a quantity above the MAX_ITEM_QUANTITY technical ceiling', async () => {
    const product = await makeProduct({ name: 'ExcessiveQuantity' });
    const res = await request(app).post('/api/orders').send(validOrderPayload(product, { quantity: 1001 }));
    expect(res.status).toBe(400);
    expect(paymentService.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('accepts a valid multi-unit quantity, decrementing stock and pricing the subtotal correctly', async () => {
    const product = await makeProduct({ name: 'ValidMultiUnit', sizes: { create: [{ size: 'M', stock: 10 }] } });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_valid_multi', redirectUrl: 'https://pay.example/chk_valid_multi' });

    const res = await request(app).post('/api/orders').send(validOrderPayload(product, { quantity: 3 }));
    expect(res.status).toBe(201);

    const size = await prisma.productSize.findFirst({ where: { productId: product.id, size: 'M' } });
    expect(size.stock).toBe(7); // 10 - 3

    const order = await prisma.order.findUnique({ where: { orderNumber: res.body.data.orderNumber } });
    expect(order.subtotal).toBe(1500); // 500 * 3
  }, 15000);

  it('merges duplicate (product, size, color) line items into a single reservation, priced and decremented exactly once for the combined quantity', async () => {
    const product = await makeProduct({ name: 'DuplicateLineMerge', sizes: { create: [{ size: 'M', stock: 10 }] } });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_dup', redirectUrl: 'https://pay.example/chk_dup' });

    const payload = validOrderPayload(product);
    payload.items = [
      { product: product.id, name: product.name, quantity: 2, size: 'M' },
      { product: product.id, name: product.name, quantity: 3, size: 'M' },
    ];
    const res = await request(app).post('/api/orders').send(payload);
    expect(res.status).toBe(201);

    const size = await prisma.productSize.findFirst({ where: { productId: product.id, size: 'M' } });
    expect(size.stock).toBe(5); // 10 - (2 + 3), one atomic reservation, not two racing partial ones

    const order = await prisma.order.findUnique({
      where: { orderNumber: res.body.data.orderNumber },
      include: { items: true },
    });
    expect(order.items).toHaveLength(1); // merged into a single OrderItem row
    expect(order.items[0].quantity).toBe(5);
    expect(order.subtotal).toBe(2500); // 500 * 5, priced once as the merged quantity
  }, 15000);

  it('the exploit from the security investigation: pairing a real quantity with a same-variant negative-quantity line is rejected outright, with zero side effects', async () => {
    const product = await makeProduct({ name: 'PoCNegativeOffset', sizes: { create: [{ size: 'M', stock: 10 }] } });
    const beforeSize = await prisma.productSize.findFirst({ where: { productId: product.id, size: 'M' } });
    const beforeProduct = await prisma.product.findUnique({ where: { id: product.id } });

    const payload = validOrderPayload(product);
    payload.items = [
      { product: product.id, name: product.name, quantity: 1, size: 'M' },
      { product: product.id, name: product.name, quantity: -1, size: 'M' },
    ];
    const res = await request(app).post('/api/orders').send(payload);
    expect(res.status).toBe(400);
    expect(paymentService.createCheckoutSession).not.toHaveBeenCalled();

    const orderItems = await prisma.orderItem.findMany({ where: { productId: product.id } });
    expect(orderItems).toHaveLength(0);

    const afterSize = await prisma.productSize.findFirst({ where: { productId: product.id, size: 'M' } });
    expect(afterSize.stock).toBe(beforeSize.stock);
    const afterProduct = await prisma.product.findUnique({ where: { id: product.id } });
    expect(afterProduct.totalStock).toBe(beforeProduct.totalStock);
    expect(afterProduct.totalSold).toBe(beforeProduct.totalSold);
  });

  it('400s when merging duplicate lines pushes the combined quantity above MAX_ITEM_QUANTITY, even though each individual line was within bounds', async () => {
    const product = await makeProduct({ name: 'DuplicateOverflow' });
    const payload = validOrderPayload(product);
    payload.items = [
      { product: product.id, name: product.name, quantity: 600, size: 'M' },
      { product: product.id, name: product.name, quantity: 600, size: 'M' },
    ];
    const res = await request(app).post('/api/orders').send(payload);
    expect(res.status).toBe(400);
    expect(paymentService.createCheckoutSession).not.toHaveBeenCalled();
  });
});

describe('POST /orders — Xendit gateway fee (ADR-010)', () => {
  it('computes the gateway fee for the chosen channel and folds it into total, subtotal + shippingFee - discount + fee', async () => {
    const product = await makeProduct({ name: 'GatewayFeeCard' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_fee', redirectUrl: 'https://pay.example/chk_fee' });

    const res = await request(app).post('/api/orders').send({ ...validOrderPayload(product), paymentChannel: 'CARD' });
    expect(res.status).toBe(201);

    const order = await prisma.order.findUnique({ where: { orderNumber: res.body.data.orderNumber } });
    // product 500 + NCR flat shipping 99 = 599 base; CARD is 2.9% + ₱15
    const expectedFee = Math.round((599 * 0.029 + 15) * 100) / 100;
    expect(order.paymentChannel).toBe('CARD');
    expect(order.gatewayFeeAmount).toBe(expectedFee);
    expect(order.total).toBe(599 + expectedFee);
  }, 15000);

  it('ignores a client-supplied gatewayFeeAmount and recomputes it server-side', async () => {
    const product = await makeProduct({ name: 'GatewayFeeIgnoreClient' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_fee2', redirectUrl: 'https://pay.example/chk_fee2' });

    const res = await request(app)
      .post('/api/orders')
      .send({ ...validOrderPayload(product), paymentChannel: 'APPLE_PAY', gatewayFeeAmount: 0, total: 1 });
    expect(res.status).toBe(201);

    const order = await prisma.order.findUnique({ where: { orderNumber: res.body.data.orderNumber } });
    expect(order.gatewayFeeAmount).toBe(11.98); // real APPLE_PAY fee (2% of 599), not the client's fabricated 0
    expect(order.total).toBe(599 + 11.98);
  }, 15000);

  it('400s for an order with no recognized payment channel — never silently defaults to one', async () => {
    const product = await makeProduct({ name: 'NoPaymentChannel' });
    const payload = validOrderPayload(product);
    delete payload.paymentChannel;

    const res = await request(app).post('/api/orders').send(payload);
    expect(res.status).toBe(400);
    expect(paymentService.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('400s for an unrecognized payment channel code', async () => {
    const product = await makeProduct({ name: 'BadPaymentChannel' });
    const res = await request(app).post('/api/orders').send({ ...validOrderPayload(product), paymentChannel: 'BITCOIN' });
    expect(res.status).toBe(400);
  });
});

describe('POST /orders — Pass (event admission) checkout, always separate from Merchandise (ADR-011 addendum)', () => {
  const createdOrgIds = [];
  const createdVenueIds = [];
  const createdEventIds = [];

  async function makePassFixture() {
    const org = await prisma.organization.create({ data: { name: `${MARKER} Org`, slug: `${MARKER.toLowerCase()}-org-${Date.now()}-${Math.random().toString(36).slice(2)}`, kind: 'institution' } });
    const venue = await prisma.venue.create({ data: { name: `${MARKER} Arena`, slug: `${MARKER.toLowerCase()}-arena-${Date.now()}-${Math.random().toString(36).slice(2)}`, address: '1 St', city: 'Pasay' } });
    const section = await prisma.venueSection.create({ data: { venueId: venue.id, name: 'GA' } });
    const event = await prisma.passEvent.create({
      data: { name: `${MARKER} Game`, slug: `${MARKER.toLowerCase()}-game-${Date.now()}-${Math.random().toString(36).slice(2)}`, organizationId: org.id, venueId: venue.id, startsAt: new Date(Date.now() + 86400000), endsAt: new Date(Date.now() + 90000000) },
    });
    const tier = await prisma.passTier.create({ data: { passEventId: event.id, venueSectionId: section.id, name: 'GA', price: 300, capacity: 5, sold: 0 } });
    createdOrgIds.push(org.id); createdVenueIds.push(venue.id); createdEventIds.push(event.id);
    return { org, venue, section, event, tier };
  }

  // A Pass is never shipped — only contact info, no address/city/province/
  // zip at all (Order.shipTo* is nullable exactly for this).
  function passOnlyPayload(tier, quantity = 1) {
    return {
      email: 'buyer@test.local',
      items: [],
      passes: [{ passTierId: tier.id, quantity }],
      paymentChannel: 'GCASH',
      shippingAddress: { fullName: 'Juan Dela Cruz', phone: '09171234567' },
    };
  }

  afterAll(async () => {
    await prisma.passLog.deleteMany({ where: { pass: { passEventId: { in: createdEventIds } } } });
    await prisma.pass.deleteMany({ where: { passEventId: { in: createdEventIds } } });
    await prisma.passTier.deleteMany({ where: { passEventId: { in: createdEventIds } } });
    await prisma.passEvent.deleteMany({ where: { id: { in: createdEventIds } } });
    await prisma.venueSection.deleteMany({ where: { venueId: { in: createdVenueIds } } });
    await prisma.venue.deleteMany({ where: { id: { in: createdVenueIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
  });

  it('rejects an order that mixes Merchandise items and Passes', async () => {
    const product = await makeProduct({ name: 'MixedOrderRejected' });
    const { tier } = await makePassFixture();

    const payload = { ...validOrderPayload(product), passes: [{ passTierId: tier.id, quantity: 1 }] };
    const res = await request(app).post('/api/orders').send(payload);
    expect(res.status).toBe(400);
    expect(paymentService.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('accepts a Pass-only order with no shipping address fields at all — no items, no address, no city, no province, no zip', async () => {
    const { tier } = await makePassFixture();
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_passonly', redirectUrl: 'https://pay.example/chk_passonly' });

    const res = await request(app).post('/api/orders').send(passOnlyPayload(tier));
    expect(res.status).toBe(201);

    const order = await prisma.order.findUnique({ where: { orderNumber: res.body.data.orderNumber } });
    expect(order.shipToAddress).toBeNull();
    expect(order.shipToCity).toBeNull();
    expect(order.shipToProvince).toBeNull();
    expect(order.shipToZipCode).toBeNull();
    expect(order.shippingFee).toBe(0);

    const passes = await prisma.pass.findMany({ where: { orderId: order.id } });
    expect(passes).toHaveLength(1);
    expect(passes[0].status).toBe('issued');
  }, 15000);

  it('400s an order with neither items nor passes', async () => {
    const res = await request(app).post('/api/orders').send({
      email: 'buyer@test.local',
      items: [],
      shippingRegion: '13',
      paymentChannel: 'GCASH',
      shippingAddress: { fullName: 'Juan Dela Cruz', phone: '09171234567', address: '123 Rizal St', city: 'Quezon City', province: 'Metro Manila', zipCode: '1100' },
    });
    expect(res.status).toBe(400);
  });

  it.each([
    ['negative number', -1],
    ['zero', 0],
    ['fractional number', 1.5],
    ['numeric Infinity string', 'Infinity'],
    ['numeric NaN string', 'NaN'],
    ['JSON Infinity value', Infinity],
    ['JSON NaN value', NaN],
    ['unsafe integer', Number.MAX_SAFE_INTEGER + 1],
    ['capacity-exceeding safe integer', 1000000],
  ])('rejects a %s Pass quantity before creating Passes, reserving capacity, or starting payment', async (_label, quantity) => {
    const { tier } = await makePassFixture();
    const res = await request(app).post('/api/orders').send(passOnlyPayload(tier, quantity));
    expect(res.status).toBe(400);
    expect(paymentService.createCheckoutSession).not.toHaveBeenCalled();

    const [updatedTier, passes] = await Promise.all([
      prisma.passTier.findUnique({ where: { id: tier.id } }),
      prisma.pass.findMany({ where: { passTierId: tier.id } }),
    ]);
    expect(updatedTier.sold).toBe(0);
    expect(passes).toHaveLength(0);
  }, 15000);

  it('accepts a numeric string Pass quantity after parsing it to a safe integer', async () => {
    const { tier } = await makePassFixture();
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_pass_string_quantity', redirectUrl: 'https://pay.example/chk_pass_string_quantity' });

    const res = await request(app).post('/api/orders').send(passOnlyPayload(tier, '2'));
    expect(res.status).toBe(201);

    const order = await prisma.order.findUnique({ where: { orderNumber: res.body.data.orderNumber } });
    const [updatedTier, passes] = await Promise.all([
      prisma.passTier.findUnique({ where: { id: tier.id } }),
      prisma.pass.findMany({ where: { orderId: order.id } }),
    ]);
    expect(updatedTier.sold).toBe(2);
    expect(passes).toHaveLength(2);
    expect(order.subtotal).toBe(600);
  }, 15000);

  it('defaults an omitted Pass quantity to one', async () => {
    const { tier } = await makePassFixture();
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_pass_default_quantity', redirectUrl: 'https://pay.example/chk_pass_default_quantity' });

    const payload = passOnlyPayload(tier);
    delete payload.passes[0].quantity;
    const res = await request(app).post('/api/orders').send(payload);
    expect(res.status).toBe(201);

    const order = await prisma.order.findUnique({ where: { orderNumber: res.body.data.orderNumber } });
    expect(await prisma.pass.count({ where: { orderId: order.id } })).toBe(1);
  }, 15000);

  it('aggregates duplicate tier lines before the capacity pre-check', async () => {
    const { tier } = await makePassFixture();
    const payload = passOnlyPayload(tier, 3);
    payload.passes.push({ passTierId: tier.id, quantity: 3 });

    const res = await request(app).post('/api/orders').send(payload);
    expect(res.status).toBe(400);
    expect(paymentService.createCheckoutSession).not.toHaveBeenCalled();
    expect((await prisma.passTier.findUnique({ where: { id: tier.id } })).sold).toBe(0);
  }, 15000);

  it('merges two positive same-tier lines into one reservation, sold/capacity updated exactly once for the combined quantity', async () => {
    const { tier } = await makePassFixture();
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_pass_dup_pos', redirectUrl: 'https://pay.example/chk_pass_dup_pos' });

    const payload = passOnlyPayload(tier, 2);
    payload.passes.push({ passTierId: tier.id, quantity: 3 });

    const res = await request(app).post('/api/orders').send(payload);
    expect(res.status).toBe(201);

    const order = await prisma.order.findUnique({ where: { orderNumber: res.body.data.orderNumber } });
    const [updatedTier, passes] = await Promise.all([
      prisma.passTier.findUnique({ where: { id: tier.id } }),
      prisma.pass.findMany({ where: { orderId: order.id } }),
    ]);
    expect(updatedTier.sold).toBe(5); // 2 + 3, aggregated once, not two racing decrements
    expect(updatedTier.capacity).toBe(5);
    expect(passes).toHaveLength(5); // one Pass per unit of the aggregated quantity
    expect(order.subtotal).toBe(1500); // 300 * 5, priced once as the merged quantity
  }, 15000);

  it('releasing a failed order\'s payment restores tier capacity and cancels the Pass, same trigger as stock release', async () => {
    const { tier } = await makePassFixture();
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_release_ga', redirectUrl: 'https://pay.example/chk_release_ga' });

    const createRes = await request(app).post('/api/orders').send(passOnlyPayload(tier));
    const { orderNumber } = createRes.body.data;

    const soldTier = await prisma.passTier.findUnique({ where: { id: tier.id } });
    expect(soldTier.sold).toBe(1);

    paymentService.getPaymentStatus.mockResolvedValueOnce({ status: 'failed' });
    await request(app).post('/api/orders/webhooks/maya').send({ requestReferenceNumber: orderNumber, status: 'PAYMENT_FAILED' });

    const releasedTier = await prisma.passTier.findUnique({ where: { id: tier.id } });
    expect(releasedTier.sold).toBe(0);

    const order = await prisma.order.findUnique({ where: { orderNumber } });
    const pass = await prisma.pass.findFirst({ where: { orderId: order.id } });
    expect(pass.status).toBe('cancelled');
  }, 25000);

  // Regression test: orderRepository.create()'s own returned object is
  // fetched (include: { passes: true }) BEFORE the Pass rows exist — they're
  // issued via separate queries afterward, unlike Merchandise's OrderItems
  // which nest inside the same .create() call. This meant the immediate
  // gateway-failure path (releaseStock(order) called on the SAME `order`
  // object returned from the transaction, no re-fetch) saw a permanently
  // stale-empty order.passes and silently released nothing — found live via
  // manual verification against a real (unmocked) gateway failure, since
  // every other release test above exercises the webhook path instead,
  // which already re-fetches the order fresh and was never affected.
  it('releases a Pass reservation when gateway checkout session creation fails immediately — same request, no webhook involved', async () => {
    const { tier } = await makePassFixture();
    paymentService.createCheckoutSession.mockRejectedValueOnce(new Error('Xendit is down'));

    const res = await request(app).post('/api/orders').send(passOnlyPayload(tier));
    expect(res.status).toBe(500);

    const releasedTier = await prisma.passTier.findUnique({ where: { id: tier.id } });
    expect(releasedTier.sold).toBe(0); // released, not left permanently decremented

    const order = await prisma.order.findUnique({ where: { orderNumber: res.body.orderNumber } });
    const pass = await prisma.pass.findFirst({ where: { orderId: order.id } });
    expect(pass.status).toBe('cancelled');
  }, 25000);
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
    expect(confirmationEmail.sendOrderConfirmation).not.toHaveBeenCalled();
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
    expect(confirmationEmail.sendOrderConfirmation).toHaveBeenCalledTimes(1);

    // Pending-Payment Email UX Revision — the normal-purchase scenario:
    // checkout immediately followed by payment must produce exactly one
    // email (confirmation), never "Complete Your Payment" too.
    expect(emailService.sendPaymentPendingEmail).not.toHaveBeenCalled();

    const shippingEvent = await prisma.shippingEvent.findFirst({ where: { orderId: orderNumber } });
    expect(shippingEvent).not.toBeNull();

    // idempotent — a duplicate webhook delivery (Maya's own retry
    // behavior, or a race with /verify-payment) must not re-send the email
    const second = await request(app).post('/api/orders/webhooks/maya').send({ requestReferenceNumber: orderNumber, status: 'PAYMENT_SUCCESS' });
    expect(second.status).toBe(200);
    expect(confirmationEmail.sendOrderConfirmation).toHaveBeenCalledTimes(1);
  }, 20000);

  it('a confirmation-email failure does not change the paid outcome (email is fire-and-forget)', async () => {
    const product = await makeProduct({ name: 'EmailFailIsolation' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_iso', redirectUrl: 'https://pay.example/chk_iso' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const { orderNumber } = createRes.body.data;

    paymentService.getPaymentStatus.mockResolvedValue({ status: 'succeeded' });
    // Phase 6's confirmation email is fire-and-forget with a .catch: an SMTP
    // failure must never roll back the payment or fail the webhook ack. The
    // email throwing here is exactly the case the .catch exists for.
    confirmationEmail.sendOrderConfirmation.mockRejectedValueOnce(new Error('SMTP down'));

    const res = await request(app).post('/api/orders/webhooks/maya').send({ requestReferenceNumber: orderNumber, status: 'PAYMENT_SUCCESS' });
    expect(res.status).toBe(200);

    const order = await prisma.order.findUnique({ where: { orderNumber } });
    expect(order.paymentStatus).toBe('paid'); // unchanged by the email failure
    expect(order.orderStatus).toBe('paid');
  }, 30000);

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

describe('POST /orders/webhooks/xendit — token-verified, payload trusted directly (ADR-010)', () => {
  it('rejects a webhook with a missing/invalid x-callback-token before ever touching the order', async () => {
    const product = await makeProduct({ name: 'XenditNoToken' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_xno', redirectUrl: 'https://pay.example/chk_xno' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const { orderNumber } = createRes.body.data;

    const res = await request(app)
      .post('/api/orders/webhooks/xendit')
      .set('x-callback-token', 'wrong-token')
      .send({ event: 'payment_session.completed', data: { reference_id: orderNumber } });
    expect(res.status).toBe(403);

    const order = await prisma.order.findUnique({ where: { orderNumber } });
    expect(order.paymentStatus).toBe('pending'); // untouched
  }, 15000);

  it('a token-verified payment_session.completed event marks the order paid, trusting the payload directly (no re-pull)', async () => {
    const product = await makeProduct({ name: 'XenditCompleted' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_xok', redirectUrl: 'https://pay.example/chk_xok' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const { orderNumber } = createRes.body.data;

    const res = await request(app)
      .post('/api/orders/webhooks/xendit')
      .set('x-callback-token', 'test-xendit-webhook-token')
      .send({ event: 'payment_session.completed', data: { reference_id: orderNumber } });
    expect(res.status).toBe(200);

    // The whole point of decision #3 (ADR-010) — status comes straight from
    // the verified payload's event name, never a getPaymentStatus re-pull.
    expect(paymentService.getPaymentStatus).not.toHaveBeenCalled();

    const order = await prisma.order.findUnique({ where: { orderNumber } });
    expect(order.paymentStatus).toBe('paid');
    expect(order.orderStatus).toBe('paid');
  }, 15000);

  it('a duplicate token-verified payment_session.completed webhook is idempotent — one shipment, one confirmation email', async () => {
    const product = await makeProduct({ name: 'XenditDuplicate' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_xdup', redirectUrl: 'https://pay.example/chk_xdup' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const { orderNumber } = createRes.body.data;
    const order = await prisma.order.findUnique({ where: { orderNumber } });

    const send = () => request(app)
      .post('/api/orders/webhooks/xendit')
      .set('x-callback-token', 'test-xendit-webhook-token')
      .send({ event: 'payment_session.completed', data: { reference_id: orderNumber } });

    expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(200); // Maya/Xendit retry/delivery duplicate

    // tryResolvePayment only transitions from 'pending', so a re-delivery is a no-op.
    const afterOrder = await prisma.order.findUnique({ where: { orderNumber } });
    expect(afterOrder.paymentStatus).toBe('paid');

    const [shipments, shipmentsEvents] = await Promise.all([
      prisma.shipment.count({ where: { orderId: order.id } }),
      prisma.shipmentEvent.count({ where: { shipment: { orderId: order.id } } }),
    ]);
    expect(shipments).toBe(1); // not one per duplicate webhook
    expect(shipmentsEvents).toBe(1);

    // Confirmation email sent exactly once — the second delivery does not re-send.
    expect(confirmationEmail.sendOrderConfirmation).toHaveBeenCalledTimes(1);
  }, 20000);

  it('a payment_session.expired event marks the order failed and restores stock', async () => {
    const product = await makeProduct({ name: 'XenditExpired' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_xexp', redirectUrl: 'https://pay.example/chk_xexp' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const { orderNumber } = createRes.body.data;

    const beforeSize = await prisma.productSize.findFirst({ where: { productId: product.id, size: 'M' } });
    expect(beforeSize.stock).toBe(9);

    const res = await request(app)
      .post('/api/orders/webhooks/xendit')
      .set('x-callback-token', 'test-xendit-webhook-token')
      .send({ event: 'payment_session.expired', data: { reference_id: orderNumber } });
    expect(res.status).toBe(200);

    const order = await prisma.order.findUnique({ where: { orderNumber } });
    expect(order.paymentStatus).toBe('failed');

    const afterSize = await prisma.productSize.findFirst({ where: { productId: product.id, size: 'M' } });
    expect(afterSize.stock).toBe(10); // released, same as Maya's failure path
  }, 15000);

  it('resolves an order from a reference_id carrying xenditGateway.js\'s attempt-unique "#" suffix', async () => {
    const product = await makeProduct({ name: 'XenditHashSuffix' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_xhash', redirectUrl: 'https://pay.example/chk_xhash' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const { orderNumber } = createRes.body.data;

    const res = await request(app)
      .post('/api/orders/webhooks/xendit')
      .set('x-callback-token', 'test-xendit-webhook-token')
      .send({ event: 'payment_session.completed', data: { reference_id: `${orderNumber}#a1b2c3d4e5f6` } });
    expect(res.status).toBe(200);

    const order = await prisma.order.findUnique({ where: { orderNumber } });
    expect(order.paymentStatus).toBe('paid');
  }, 15000);

  it('silently acknowledges a webhook for an unknown order, without erroring', async () => {
    const res = await request(app)
      .post('/api/orders/webhooks/xendit')
      .set('x-callback-token', 'test-xendit-webhook-token')
      .send({ event: 'payment_session.completed', data: { reference_id: 'PS-NOSUCHORDER' } });
    expect(res.status).toBe(200);
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
    expect(payment.provider).toBe('xendit'); // primary gateway as of ADR-010
    expect(payment.status).toBe('pending');
    expect(payment.checkoutReference).toBe(order.mayaPaymentId);
    expect(payment.checkoutUrl).toBe(order.mayaCheckoutUrl);
    expect(payment.expiresAt).not.toBeNull(); // computed at creation — neither gateway returns one
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
    // Pending-Payment Email UX Revision — "Complete Your Payment" no
    // longer fires synchronously at checkout (that's what produced the
    // back-to-back pending+confirmed emails for a customer who paid
    // immediately). It's now sent only by the delayed reminder sweep, once
    // an order has genuinely stalled — see
    // lib/__tests__/sendPaymentReminders.test.js.
    expect(emailService.sendPaymentPendingEmail).not.toHaveBeenCalled();
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
    expect(res.body.data.payment).toMatchObject({ provider: 'xendit', status: 'pending', checkoutUrl: 'https://pay.example/chk_guest' });
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

describe('Order ownership enforcement — unauthenticated request to a user-owned order (P0)', () => {
  it('GET /:orderNumber 403s an unauthenticated request to a user-owned order', async () => {
    const order = await makeOwnedOrder({ userId: 'test-user' });
    const res = await request(app).get(`/api/orders/${order.orderNumber}`);
    expect(res.status).toBe(403);
  });

  it('POST /:orderNumber/pay 403s an unauthenticated request to a user-owned order before creating any session', async () => {
    const order = await makeOwnedOrder({ userId: 'test-user' });
    const res = await request(app).post(`/api/orders/${order.orderNumber}/pay`);
    expect(res.status).toBe(403);
    expect(paymentService.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('POST /:orderNumber/verify-payment 403s an unauthenticated request to a user-owned order before polling', async () => {
    const order = await makeOwnedOrder({ userId: 'test-user', email: 'owned-verify@test.local' });
    const res = await request(app).post(`/api/orders/${order.orderNumber}/verify-payment`);
    expect(res.status).toBe(403);
    expect(paymentService.getPaymentStatus).not.toHaveBeenCalled();
  });

  it('GET /:orderNumber still allows a guest (ownerless) order without authentication', async () => {
    const order = await makeOwnedOrder({ userId: null });
    const res = await request(app).get(`/api/orders/${order.orderNumber}`);
    expect(res.status).toBe(200);
  });

  it('all three endpoints allow the owner and an admin, and deny a different authenticated user', async () => {
    const order = await makeOwnedOrder({ userId: 'test-user' });
    const orderNumber = order.orderNumber;
    paymentService.createCheckoutSession.mockResolvedValue({ paymentReference: 'chk_owner', redirectUrl: 'https://pay.example/chk_owner' });

    // Owner
    expect((await request(app).get(`/api/orders/${orderNumber}`).set('x-test-userid', 'test-user')).status).toBe(200);
    // Admin
    expect((await request(app).get(`/api/orders/${orderNumber}`).set('x-test-userid', 'admin-user').set('x-test-role', 'admin')).status).toBe(200);
    // Different logged-in user
    expect((await request(app).get(`/api/orders/${orderNumber}`).set('x-test-userid', 'someone-else')).status).toBe(403);

    // /pay: owner ok, admin ok, different user denied
    expect((await request(app).post(`/api/orders/${orderNumber}/pay`).set('x-test-userid', 'test-user')).status).toBe(200);
    expect((await request(app).post(`/api/orders/${orderNumber}/pay`).set('x-test-userid', 'admin-user').set('x-test-role', 'admin')).status).toBe(200);
    expect((await request(app).post(`/api/orders/${orderNumber}/pay`).set('x-test-userid', 'someone-else')).status).toBe(403);
  }, 20000);
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
  // Enterprise Fulfillment Blueprint, Phase 1 — this endpoint's scope
  // narrowed to payment-side statuses only; every post-payment fulfillment
  // value (processing/packed/shipped/delivered/cancelled/returned) and
  // courier/trackingNumber all moved to routes/shipments.js, covered in
  // shipments.test.js. These tests now assert the narrower reality:
  // rejecting a value this endpoint no longer owns, and silently ignoring
  // courier/trackingNumber if sent (never reading or applying them).
  it('PATCH /:id/status updates a payment-side orderStatus value', async () => {
    const product = await makeProduct({ name: 'AdminStatusUpdate' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_admin', redirectUrl: 'https://pay.example/chk_admin' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const order = await prisma.order.findUnique({ where: { orderNumber: createRes.body.data.orderNumber } });

    const res = await request(app)
      .patch(`/api/orders/${order.id}/status`)
      .send({ orderStatus: 'expired', trackingNumber: 'TRACK123', courier: 'LBC' });
    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe('expired');
    // Sent but never read by this endpoint anymore — no longer applied.
    expect(res.body.data.trackingNumber).toBeFalsy();
    expect(res.body.data.courier).toBeFalsy();
  }, 15000);

  it('PATCH /:id/status rejects a fulfillment-side value — that only exists behind routes/shipments.js now', async () => {
    const product = await makeProduct({ name: 'AdminStatusFulfillmentRejected' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_admin_reject', redirectUrl: 'https://pay.example/chk_admin_reject' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const order = await prisma.order.findUnique({ where: { orderNumber: createRes.body.data.orderNumber } });

    for (const status of ['processing', 'packed', 'shipped', 'delivered', 'cancelled', 'returned']) {
      const res = await request(app).patch(`/api/orders/${order.id}/status`).send({ orderStatus: status });
      expect(res.status).toBe(400);
    }

    const unchanged = await prisma.order.findUnique({ where: { id: order.id } });
    expect(unchanged.orderStatus).toBe('awaiting_payment');
  }, 15000);

  it('PATCH /:id/status does not email — sendOrderStatusEmail only ever covers fulfillment values, all outside this endpoint\'s scope now', async () => {
    const product = await makeProduct({ name: 'AdminStatusUnchanged' });
    paymentService.createCheckoutSession.mockResolvedValueOnce({ paymentReference: 'chk_admin2', redirectUrl: 'https://pay.example/chk_admin2' });
    const createRes = await request(app).post('/api/orders').send(validOrderPayload(product));
    const order = await prisma.order.findUnique({ where: { orderNumber: createRes.body.data.orderNumber } });
    emailService.sendOrderStatusEmail.mockClear();

    const res = await request(app)
      .patch(`/api/orders/${order.id}/status`)
      .send({ orderStatus: 'failed_payment' });
    expect(res.status).toBe(200);
    expect(emailService.sendOrderStatusEmail).not.toHaveBeenCalled();
  }, 15000);

  it('PATCH /:id/status 404s for a non-existent order', async () => {
    const res = await request(app).patch('/api/orders/00000000-0000-0000-0000-000000000000/status').send({ orderStatus: 'expired' });
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
      .send({ orderStatus: 'expired' });

    const res = await request(app).get(`/api/orders/${orderNumber}/events`);
    const statusEvent = res.body.data.find((e) => e.type === 'status_updated');
    expect(statusEvent.actor).toBe('admin');
    expect(statusEvent.actorUser._id).toBe('test-user');
    // Enterprise Fulfillment Blueprint, Phase 1 — 'expired', not 'shipped':
    // fulfillment-side values are no longer settable through this endpoint.
    expect(statusEvent.message).toMatch(/status: awaiting_payment → expired/);
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
