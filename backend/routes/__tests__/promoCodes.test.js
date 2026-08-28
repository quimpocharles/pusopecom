import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

// authenticate/isAdmin are mocked so each test can control req.user's
// staffProfile directly; requirePermission/requireAnyPermission are the
// REAL implementations (lib/permissions.js) — this is what actually proves
// the new event-picker endpoint is gated by PROMOTIONS_MANAGE specifically,
// not a mock that would just rubber-stamp every request regardless.
let currentUser = { _id: 'test-admin', role: 'admin', staffProfile: null };

vi.mock('../../middleware/auth.js', async () => {
  const actual = await vi.importActual('../../middleware/auth.js');
  return {
    ...actual,
    authenticate: (req, res, next) => { req.user = currentUser; next(); },
    isAdmin: (req, res, next) => next(),
    optionalAuth: (req, res, next) => { req.user = currentUser; next(); },
  };
});

const { default: promoCodesRouter } = await import('../promoCodes.js');

const app = express();
app.use(express.json());
app.use('/api/promo-codes', promoCodesRouter);

const MARKER = `PromoCodesTest${Date.now()}`;
let orgId;
let venueId;
let eventId;
let secondEventId;
let eventName;
const createdPromoCodeIds = [];

beforeAll(async () => {
  const org = await prisma.organization.create({
    data: { name: `${MARKER} Org`, slug: `${MARKER.toLowerCase()}-org`, kind: 'institution' },
  });
  orgId = org.id;

  const venue = await prisma.venue.create({
    data: { name: `${MARKER} Venue`, slug: `${MARKER.toLowerCase()}-venue`, address: '1 St', city: 'Pasay' },
  });
  venueId = venue.id;

  eventName = `${MARKER} Game`;
  const event = await prisma.passEvent.create({
    data: {
      name: eventName,
      slug: `${MARKER.toLowerCase()}-game`,
      organizationId: orgId,
      venueId,
      teamNames: [],
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 90000000),
    },
  });
  eventId = event.id;

  const secondEvent = await prisma.passEvent.create({
    data: {
      name: `${MARKER} Game 2`,
      slug: `${MARKER.toLowerCase()}-game-2`,
      organizationId: orgId,
      venueId,
      teamNames: [],
      startsAt: new Date(Date.now() + 96400000),
      endsAt: new Date(Date.now() + 100000000),
    },
  });
  secondEventId = secondEvent.id;
});

afterAll(async () => {
  await prisma.promoCodePassEvent.deleteMany({ where: { passEventId: { in: [eventId, secondEventId] } } });
  await prisma.promoCode.deleteMany({ where: { id: { in: createdPromoCodeIds } } });
  await prisma.passEvent.delete({ where: { id: eventId } }).catch(() => {});
  await prisma.passEvent.delete({ where: { id: secondEventId } }).catch(() => {});
  await prisma.venue.delete({ where: { id: venueId } }).catch(() => {});
  await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
  await prisma.$disconnect();
});

function asMarketing() {
  currentUser = { _id: 'admin-marketing', role: 'admin', staffProfile: { department: 'marketing', permissions: [] } };
}
// Has passes.manage explicitly but NOT promotions.manage — proves the
// picker endpoint doesn't accept PASSES_MANAGE as a substitute.
function asPassesManagerOnly() {
  currentUser = { _id: 'admin-passes-only', role: 'admin', staffProfile: { department: 'warehouse', permissions: ['passes.manage'] } };
}

describe('GET /promo-codes/admin/events — picker endpoint', () => {
  it('14. returns events (id/name/venue/date only) for a user with PROMOTIONS_MANAGE', async () => {
    asMarketing();
    const res = await request(app).get('/api/promo-codes/admin/events');
    expect(res.status).toBe(200);
    const found = res.body.data.find((e) => e._id === eventId);
    expect(found).toBeTruthy();
    expect(found.name).toBe(eventName);
    expect(found.venueName).toBe(`${MARKER} Venue`);
    expect(found.startsAt).toBeTruthy();
    // Only the picker's fields — no organization/tiers/other management data.
    expect(found).not.toHaveProperty('organization');
    expect(found).not.toHaveProperty('tiers');
  }, 10000);

  it('15. rejects a user who only has PASSES_MANAGE, not PROMOTIONS_MANAGE', async () => {
    asPassesManagerOnly();
    const res = await request(app).get('/api/promo-codes/admin/events');
    expect(res.status).toBe(403);
  });
});

describe('POST/PUT /promo-codes — EVENT scope', () => {
  it('16. creates a promo code with event targets', async () => {
    asMarketing();
    const res = await request(app).post('/api/promo-codes').send({
      code: `${MARKER}-EVT16`,
      discountType: 'PERCENTAGE',
      scope: 'EVENT',
      percentOff: 10,
      passEventIds: [eventId],
    });
    expect(res.status).toBe(201);
    createdPromoCodeIds.push(res.body.data._id);
    expect(res.body.data.scope).toBe('EVENT');
    expect(res.body.data.passEvents).toHaveLength(1);
    expect(res.body.data.passEvents[0].passEventId).toBe(eventId);
  }, 10000);

  it('17. updates a promo code\'s event targets (replace-all, mirrors setProducts)', async () => {
    asMarketing();
    const createRes = await request(app).post('/api/promo-codes').send({
      code: `${MARKER}-EVT17`,
      discountType: 'FIXED_AMOUNT',
      scope: 'EVENT',
      amountOff: 50,
      passEventIds: [eventId],
    });
    createdPromoCodeIds.push(createRes.body.data._id);

    const updateRes = await request(app).put(`/api/promo-codes/${createRes.body.data._id}`).send({
      code: `${MARKER}-EVT17`,
      discountType: 'FIXED_AMOUNT',
      scope: 'EVENT',
      amountOff: 75,
      passEventIds: [secondEventId],
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.amountOff).toBe(75);
    // Replace-all, not additive — only the new set remains.
    expect(updateRes.body.data.passEvents).toHaveLength(1);
    expect(updateRes.body.data.passEvents[0].passEventId).toBe(secondEventId);
  }, 10000);

  it('18. existing product-scoped create/update behavior is unchanged by EVENT scope existing', async () => {
    asMarketing();
    const res = await request(app).post('/api/promo-codes').send({
      code: `${MARKER}-PROD18`,
      discountType: 'PERCENTAGE',
      scope: 'PRODUCT',
      percentOff: 5,
      productIds: [], // still rejected — a PRODUCT-scope code requires at least one product, same as before
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/product/i);
  });

  it('rejects an EVENT-scope code with no events selected — same shape as the existing PRODUCT-scope requirement', async () => {
    asMarketing();
    const res = await request(app).post('/api/promo-codes').send({
      code: `${MARKER}-NOEVT`,
      discountType: 'PERCENTAGE',
      scope: 'EVENT',
      percentOff: 5,
      passEventIds: [],
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/event/i);
  });
});
