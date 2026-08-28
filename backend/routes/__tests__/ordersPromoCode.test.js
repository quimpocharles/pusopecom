import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';
import * as siteSettingsRepository from '../../repositories/siteSettingsRepository.js';
import * as promoCodeRepository from '../../repositories/promoCodeRepository.js';

// Dedicated, focused file for EVENT-scope promo-code checkout integration —
// deliberately separate from the large orders.test.js (not run here), same
// precedent ordersEpaygamesWebhook.test.js already established for this
// router. Mocks mirror orders.test.js's own shape exactly.

vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => { req.user = { _id: 'test-user', role: 'customer' }; next(); },
  isAdmin: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
  requirePermission: () => (req, res, next) => next(),
  requireAnyPermission: () => (req, res, next) => next(),
}));

vi.mock('../../services/paymentService.js', () => ({
  createCheckoutSession: vi.fn().mockResolvedValue({ paymentReference: 'chk_1', redirectUrl: 'https://pay.example/chk_1' }),
  getPaymentStatus: vi.fn(),
  getSessionDurationMs: vi.fn().mockReturnValue(60 * 60 * 1000),
  calculateFee: vi.fn().mockResolvedValue(0),
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

const app = express();
app.use(express.json());
app.use('/api/orders', ordersRouter);

const MARKER = `OrdersPromoTest${Date.now()}`;
const createdProductIds = [];
const createdOrgIds = [];
const createdVenueIds = [];
const createdEventIds = [];
const createdPromoCodeIds = [];

async function makeProduct(overrides = {}) {
  const product = await prisma.product.create({
    data: {
      name: `${MARKER} Product`,
      slug: `${MARKER.toLowerCase()}-product-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      description: 'x', price: 500, category: 'jersey', sport: 'basketball',
      images: ['https://example.com/img.jpg'], active: true, totalStock: 10,
      sizes: { create: [{ size: 'M', stock: 10 }] },
      ...overrides,
    },
  });
  createdProductIds.push(product.id);
  return product;
}

async function makePassFixture(overrides = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const org = await prisma.organization.create({ data: { name: `${MARKER} Org`, slug: `${MARKER.toLowerCase()}-org-${suffix}`, kind: 'institution' } });
  const venue = await prisma.venue.create({ data: { name: `${MARKER} Arena`, slug: `${MARKER.toLowerCase()}-arena-${suffix}`, address: '1 St', city: 'Pasay' } });
  const section = await prisma.venueSection.create({ data: { venueId: venue.id, name: 'GA' } });
  const event = await prisma.passEvent.create({
    data: { name: `${MARKER} Game`, slug: `${MARKER.toLowerCase()}-game-${suffix}`, organizationId: org.id, venueId: venue.id, startsAt: new Date(Date.now() + 86400000), endsAt: new Date(Date.now() + 90000000) },
  });
  const tier = await prisma.passTier.create({ data: { passEventId: event.id, venueSectionId: section.id, name: 'GA', price: 300, capacity: 5, sold: 0, ...overrides } });
  createdOrgIds.push(org.id); createdVenueIds.push(venue.id); createdEventIds.push(event.id);
  return { org, venue, section, event, tier };
}

// Goes through the real repository (not a raw prisma insert) so
// normalizeCode's uppercasing and setPassEvents's real replace-all path are
// both exercised exactly as production create() would.
async function makeEventPromo({ code, passEventIds, discountType = 'PERCENTAGE', percentOff = 10, amountOff = null }) {
  const promo = await promoCodeRepository.create({
    code, discountType, scope: 'EVENT',
    percentOff: discountType === 'PERCENTAGE' ? percentOff : null,
    amountOff: discountType === 'FIXED_AMOUNT' ? amountOff : null,
    active: true,
    passEventIds,
  });
  createdPromoCodeIds.push(promo._id);
  return promo;
}

function passOnlyPayload(tier, overrides = {}) {
  return {
    email: 'buyer@test.local',
    items: [],
    passes: [{ passTierId: tier.id, quantity: 1 }],
    paymentChannel: 'GCASH',
    shippingAddress: { fullName: 'Juan Dela Cruz', phone: '09171234567' },
    ...overrides,
  };
}

beforeAll(async () => {
  // Deterministic regardless of whatever gateway this DB's site-settings
  // singleton currently defaults to — paymentService is fully mocked above
  // either way, but pinning this keeps the fixture obviously stable.
  await siteSettingsRepository.update({ payment: { defaultPaymentGateway: 'xendit' } });
});

afterEach(async () => {
  await siteSettingsRepository.update({ payment: { defaultPaymentGateway: 'xendit' } });
});

afterAll(async () => {
  await prisma.promoCodePassEvent.deleteMany({ where: { promoCodeId: { in: createdPromoCodeIds } } });
  await prisma.promoCode.deleteMany({ where: { id: { in: createdPromoCodeIds } } });
  await prisma.passLog.deleteMany({ where: { pass: { passEventId: { in: createdEventIds } } } });
  await prisma.pass.deleteMany({ where: { passEventId: { in: createdEventIds } } });
  await prisma.passTier.deleteMany({ where: { passEventId: { in: createdEventIds } } });
  await prisma.passEvent.deleteMany({ where: { id: { in: createdEventIds } } });
  await prisma.venueSection.deleteMany({ where: { venueId: { in: createdVenueIds } } });
  await prisma.venue.deleteMany({ where: { id: { in: createdVenueIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
  await prisma.orderItem.deleteMany({ where: { product: { id: { in: createdProductIds } } } });
  await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
  await prisma.$disconnect();
});

describe('POST /orders — EVENT-scope promo codes', () => {
  it('10. an eligible Pass gets the expected server-computed discount', async () => {
    const { event, tier } = await makePassFixture();
    const promo = await makeEventPromo({ code: `${MARKER}-EVT10`, passEventIds: [event.id], percentOff: 20 });

    const res = await request(app).post('/api/orders').send(passOnlyPayload(tier, { promoCode: promo.code }));
    expect(res.status).toBe(201);

    const order = await prisma.order.findUnique({ where: { orderNumber: res.body.data.orderNumber } });
    expect(order.discountAmount).toBe(60); // 20% of 300
    expect(order.subtotal).toBe(300);
  }, 45000);

  it('11. an ineligible Pass (different event) rejects the promo code outright — order is not created', async () => {
    const { tier } = await makePassFixture(); // event A
    const { event: otherEvent } = await makePassFixture(); // event B — the promo targets THIS one
    const promo = await makeEventPromo({ code: `${MARKER}-EVT11`, passEventIds: [otherEvent.id] });

    const res = await request(app).post('/api/orders').send(passOnlyPayload(tier, { promoCode: promo.code }));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/doesn't apply/i);
  }, 30000);

  it('an EVENT-scope promo never discounts merchandise — rejected outright against a merch-only order', async () => {
    const product = await makeProduct();
    const { event } = await makePassFixture();
    const promo = await makeEventPromo({ code: `${MARKER}-EVTMERCH`, passEventIds: [event.id] });

    const res = await request(app).post('/api/orders').send({
      email: 'buyer@test.local',
      items: [{ product: product.id, name: product.name, quantity: 1, size: 'M' }],
      shippingRegion: '13',
      paymentChannel: 'GCASH',
      shippingAddress: { fullName: 'Juan Dela Cruz', phone: '09171234567', address: '1 St', city: 'QC', province: 'Metro Manila', zipCode: '1100' },
      promoCode: promo.code,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/doesn't apply/i);
  }, 30000);

  it('12. client cannot bypass eligibility by injecting a discountAmount directly — server recomputes it from real data', async () => {
    const { event, tier } = await makePassFixture();
    const promo = await makeEventPromo({ code: `${MARKER}-EVT12`, passEventIds: [event.id], percentOff: 10 });

    const res = await request(app).post('/api/orders').send({
      ...passOnlyPayload(tier, { promoCode: promo.code }),
      discountAmount: 99999, // attempted client-side override — must be ignored
      subtotal: 1, // attempted client-side override — must be ignored
    });
    expect(res.status).toBe(201);

    const order = await prisma.order.findUnique({ where: { orderNumber: res.body.data.orderNumber } });
    expect(order.subtotal).toBe(300); // real tier price, not the injected 1
    expect(order.discountAmount).toBe(30); // real 10% of 300, not the injected 99999
  }, 30000);

  it('13. existing mixed-order rejection remains unchanged with an EVENT-scope promo in play', async () => {
    const product = await makeProduct();
    const { event, tier } = await makePassFixture();
    const promo = await makeEventPromo({ code: `${MARKER}-EVT13`, passEventIds: [event.id] });

    const res = await request(app).post('/api/orders').send({
      email: 'buyer@test.local',
      items: [{ product: product.id, name: product.name, quantity: 1, size: 'M' }],
      passes: [{ passTierId: tier.id, quantity: 1 }],
      promoCode: promo.code,
      paymentChannel: 'GCASH',
      shippingAddress: { fullName: 'Juan Dela Cruz', phone: '09171234567', address: '1 St', city: 'QC', province: 'Metro Manila', zipCode: '1100' },
    });
    expect(res.status).toBe(400);
    // Express-validator's aggregated response (see orders.js's validation-
    // failure handler) — the real per-field message lives in `errors`, not
    // the generic top-level `message`.
    expect(JSON.stringify(res.body.errors)).toMatch(/cannot mix/i);
  }, 30000);
});
