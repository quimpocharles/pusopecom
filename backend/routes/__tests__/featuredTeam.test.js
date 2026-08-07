import { describe, it, expect, vi, afterAll } from 'vitest';
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

const { default: featuredTeamRouter } = await import('../featuredTeam.js');

const app = express();
app.use(express.json());
app.use('/api/featured-team', featuredTeamRouter);

const createdIds = [];

afterAll(async () => {
  await prisma.featuredTeam.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.$disconnect();
});

describe('routes/featuredTeam.js — CRUD', () => {
  it('POST / creates a featured team', async () => {
    const res = await request(app).post('/api/featured-team').send({
      team: 'Test University', description: 'x', backgroundColor: '#123456',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.team).toBe('Test University');
    createdIds.push(res.body.data._id);
  });

  it('GET / lists all (admin)', async () => {
    const res = await request(app).get('/api/featured-team');
    expect(res.status).toBe(200);
    expect(res.body.data.some((t) => t._id === createdIds[0])).toBe(true);
  });

  it('PUT /:id updates fields', async () => {
    const res = await request(app).put(`/api/featured-team/${createdIds[0]}`).send({ headline: 'New Headline' });
    expect(res.status).toBe(200);
    expect(res.body.data.headline).toBe('New Headline');
  });

  it('DELETE /:id soft-deletes (sets active=false), 404s for unknown id', async () => {
    const res = await request(app).delete(`/api/featured-team/${createdIds[0]}`);
    expect(res.status).toBe(200);
    const team = await prisma.featuredTeam.findUnique({ where: { id: createdIds[0] } });
    expect(team.active).toBe(false);

    const notFound = await request(app).delete('/api/featured-team/00000000-0000-0000-0000-000000000000');
    expect(notFound.status).toBe(404);
  });
});

describe('routes/featuredTeam.js — GET /active scheduling', () => {
  const scheduledIds = [];
  // findActive() picks one real row across the whole (shared, live) table —
  // asserting "returns null" globally would be wrong whenever real seeded
  // data exists, the same class of mistake the footer.test.js singleton
  // fix addressed. Deactivate whatever's really active for this describe
  // block, and restore it afterward, rather than assuming the table starts
  // empty.
  let previouslyActiveIds = [];

  afterAll(async () => {
    await prisma.featuredTeam.deleteMany({ where: { id: { in: scheduledIds } } });
    if (previouslyActiveIds.length > 0) {
      await prisma.featuredTeam.updateMany({ where: { id: { in: previouslyActiveIds } }, data: { active: true } });
    }
  });

  it('excludes inactive/expired/future teams, returns the current in-window one', async () => {
    const inactive = await request(app).post('/api/featured-team').send({ team: 'Inactive Team', active: false });
    const expired = await request(app).post('/api/featured-team').send({ team: 'Expired Team', endDate: '2020-01-01' });
    const future = await request(app).post('/api/featured-team').send({ team: 'Future Team', startDate: '2099-01-01' });
    const current = await request(app).post('/api/featured-team').send({ team: 'Current Team' });
    scheduledIds.push(inactive.body.data._id, expired.body.data._id, future.body.data._id, current.body.data._id);

    const res = await request(app).get('/api/featured-team/active');
    expect(res.status).toBe(200);
    expect(res.body.data.team).toBe('Current Team');
  }, 15000);

  it('returns null when nothing is active/in-window', async () => {
    const currentlyActive = await prisma.featuredTeam.findMany({ where: { active: true }, select: { id: true } });
    previouslyActiveIds = currentlyActive.map((t) => t.id);
    await prisma.featuredTeam.updateMany({ where: { active: true }, data: { active: false } });

    const res = await request(app).get('/api/featured-team/active');
    expect(res.body.data).toBeNull();
  });
});
