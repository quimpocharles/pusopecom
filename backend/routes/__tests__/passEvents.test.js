import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => { req.user = { _id: 'test-admin', role: 'admin' }; next(); },
  isAdmin: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
  requirePermission: () => (req, res, next) => next(),
  requireAnyPermission: () => (req, res, next) => next(),
}));

const { default: passEventsRouter } = await import('../passEvents.js');

const app = express();
app.use(express.json());
app.use('/api/pass-events', passEventsRouter);

const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const dayAfterTomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

let institutionOrgId;
let leagueOrgId;
let venueId;
const createdEventIds = [];

beforeAll(async () => {
  const institutionOrg = await prisma.organization.create({
    data: { name: 'Test Institution Org — passEvents.test.js', slug: `test-institution-org-${Date.now()}`, kind: 'institution' },
  });
  institutionOrgId = institutionOrg.id;

  const leagueOrg = await prisma.organization.create({
    data: { name: 'Test League Org — passEvents.test.js', slug: `test-league-org-${Date.now()}`, kind: 'league' },
  });
  leagueOrgId = leagueOrg.id;

  const venue = await prisma.venue.create({
    data: { name: 'Test Venue — passEvents.test.js', slug: `test-venue-${Date.now()}`, address: '1 Test St', city: 'Quezon City' },
  });
  venueId = venue.id;
});

afterAll(async () => {
  for (const id of createdEventIds) {
    await prisma.passEvent.delete({ where: { id } }).catch(() => {});
  }
  await prisma.venue.delete({ where: { id: venueId } }).catch(() => {});
  await prisma.organization.delete({ where: { id: institutionOrgId } }).catch(() => {});
  await prisma.organization.delete({ where: { id: leagueOrgId } }).catch(() => {});
  await prisma.$disconnect();
});

function baseEventPayload(overrides = {}) {
  return {
    name: 'Test Event', slug: `test-event-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    organizationId: institutionOrgId, teamNames: [], venueId,
    startsAt: tomorrow, endsAt: dayAfterTomorrow, active: true, images: [],
    ...overrides,
  };
}

// The route itself now rejects a past startsAt on POST, so a historical
// fixture (an event that has already happened) has to be seeded straight
// into the DB, bypassing the route — exactly like a real already-past
// event that existed before this validation shipped.
async function createHistoricalEvent() {
  const event = await prisma.passEvent.create({
    data: {
      name: 'Historical Test Event', slug: `historical-test-event-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      organizationId: institutionOrgId, teamNames: [], venueId,
      startsAt: new Date(twoWeeksAgo), endsAt: new Date(oneWeekAgo), active: true, images: [],
    },
  });
  createdEventIds.push(event.id);
  return event;
}

describe('routes/passEvents.js — date validation', () => {
  it('1. POST rejects a start date before today', async () => {
    const res = await request(app).post('/api/pass-events').send(baseEventPayload({ startsAt: yesterday }));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/start date/i);
  });

  it('2. POST accepts a valid (future) start date', async () => {
    const res = await request(app).post('/api/pass-events').send(baseEventPayload());
    expect(res.status).toBe(201);
    createdEventIds.push(res.body.data._id);
  });

  it('3. POST rejects an end date before the start date', async () => {
    const res = await request(app).post('/api/pass-events').send(
      baseEventPayload({ startsAt: dayAfterTomorrow, endsAt: tomorrow })
    );
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/end date/i);
  });

  it('4. POST accepts an end date equal to the start date', async () => {
    const res = await request(app).post('/api/pass-events').send(
      baseEventPayload({ startsAt: tomorrow, endsAt: tomorrow })
    );
    expect(res.status).toBe(201);
    createdEventIds.push(res.body.data._id);
  });

  it('5. PUT applies the same date validation as create (changing a future start to a past one is rejected)', async () => {
    const createRes = await request(app).post('/api/pass-events').send(baseEventPayload());
    createdEventIds.push(createRes.body.data._id);

    const res = await request(app)
      .put(`/api/pass-events/${createRes.body.data._id}`)
      .send(baseEventPayload({ startsAt: yesterday }));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/start date/i);
  });

  it('rejects an invalid (unparseable) date string rather than persisting it', async () => {
    const res = await request(app).post('/api/pass-events').send(baseEventPayload({ startsAt: 'not-a-date' }));
    expect(res.status).toBe(400);
  });
});

describe('routes/passEvents.js — editing a historical event (start date already before today)', () => {
  it('1. creating a NEW event with a past start date is still rejected (unaffected by the historical-edit exemption)', async () => {
    const res = await request(app).post('/api/pass-events').send(baseEventPayload({ startsAt: twoWeeksAgo }));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/start date/i);
  });

  it('2. PUT with the start date left exactly as persisted is allowed, even though it is in the past', async () => {
    const event = await createHistoricalEvent();

    const res = await request(app).put(`/api/pass-events/${event.id}`).send(baseEventPayload({
      startsAt: event.startsAt.toISOString(), endsAt: event.endsAt.toISOString(),
    }));
    expect(res.status).toBe(200);
  });

  it('3. PUT changing the start date to a DIFFERENT past date is rejected', async () => {
    const event = await createHistoricalEvent();

    const res = await request(app).put(`/api/pass-events/${event.id}`).send(baseEventPayload({
      startsAt: yesterday, endsAt: event.endsAt.toISOString(),
    }));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/start date/i);
  });

  it('4. PUT changing the start date to today/future is allowed', async () => {
    const event = await createHistoricalEvent();

    const res = await request(app).put(`/api/pass-events/${event.id}`).send(baseEventPayload({
      startsAt: tomorrow, endsAt: dayAfterTomorrow,
    }));
    expect(res.status).toBe(200);
  });

  it('5. end date before start date is rejected on an edit of a historical event too', async () => {
    const event = await createHistoricalEvent();

    const res = await request(app).put(`/api/pass-events/${event.id}`).send(baseEventPayload({
      startsAt: event.startsAt.toISOString(), endsAt: threeWeeksAgo, // before the (unchanged) start
    }));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/end date/i);
  });

  it('6. end date equal to the (unchanged, historical) start date is allowed', async () => {
    const event = await createHistoricalEvent();

    const res = await request(app).put(`/api/pass-events/${event.id}`).send(baseEventPayload({
      startsAt: event.startsAt.toISOString(), endsAt: event.startsAt.toISOString(),
    }));
    expect(res.status).toBe(200);
  });
});

describe('routes/passEvents.js — organization.kind is returned (the field the admin edit form needs to tell a League-bridge Organization apart from a real one)', () => {
  let institutionEventId;
  let leagueEventId;

  beforeAll(async () => {
    const institutionRes = await request(app).post('/api/pass-events').send(baseEventPayload({ organizationId: institutionOrgId }));
    institutionEventId = institutionRes.body.data._id;
    createdEventIds.push(institutionEventId);

    const leagueRes = await request(app).post('/api/pass-events').send(baseEventPayload({ organizationId: leagueOrgId }));
    leagueEventId = leagueRes.body.data._id;
    createdEventIds.push(leagueEventId);
  });

  it('GET /admin/:id includes organization.kind', async () => {
    const res = await request(app).get(`/api/pass-events/admin/${institutionEventId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.organization.kind).toBe('institution');

    const leagueRes = await request(app).get(`/api/pass-events/admin/${leagueEventId}`);
    expect(leagueRes.body.data.organization.kind).toBe('league');
  });

  it('GET /admin/all includes organization.kind for every event (the list the edit form\'s "Edit" button hydrates from)', async () => {
    const res = await request(app).get('/api/pass-events/admin/all');
    expect(res.status).toBe(200);
    const institutionEvent = res.body.data.find((e) => e._id === institutionEventId);
    const leagueEvent = res.body.data.find((e) => e._id === leagueEventId);
    expect(institutionEvent.organization.kind).toBe('institution');
    expect(leagueEvent.organization.kind).toBe('league');
  });
});
