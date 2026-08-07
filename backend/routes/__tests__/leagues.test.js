import { describe, it, expect, vi, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

// middleware/auth.js still calls the old Mongoose User.findById() —
// migrating it is step 4, deliberately after these low-risk routes.
// Mocked out entirely here; verifying auth itself belongs to step 4.
vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => { req.user = { _id: 'test-admin', role: 'admin' }; next(); },
  isAdmin: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
  requirePermission: () => (req, res, next) => next(),
  requireAnyPermission: () => (req, res, next) => next(),
}));

const { default: leaguesRouter } = await import('../leagues.js');

const app = express();
app.use(express.json());
app.use('/api/leagues', leaguesRouter);

const createdIds = [];
afterAll(async () => {
  await prisma.league.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.$disconnect();
});

describe('routes/leagues.js', () => {
  it('GET / returns only active leagues, filtered by sport as an array-containment check', async () => {
    const active = await prisma.league.create({
      data: { name: `Test Active League ${Date.now()}`, sports: ['basketball'], teams: [], active: true },
    });
    const inactive = await prisma.league.create({
      data: { name: `Test Inactive League ${Date.now()}`, sports: ['basketball'], teams: [], active: false },
    });
    const wrongSport = await prisma.league.create({
      data: { name: `Test Volleyball League ${Date.now()}`, sports: ['volleyball'], teams: [], active: true },
    });
    createdIds.push(active.id, inactive.id, wrongSport.id);

    const res = await request(app).get('/api/leagues').query({ sport: 'basketball' });
    expect(res.status).toBe(200);
    const names = res.body.data.map((l) => l.name);
    expect(names).toContain(active.name);
    expect(names).not.toContain(inactive.name); // inactive excluded
    expect(names).not.toContain(wrongSport.name); // wrong sport excluded
  });

  it('POST / creates a league and returns 201 with the created record shaped with _id', async () => {
    const res = await request(app)
      .post('/api/leagues')
      .send({ name: `Test Create League ${Date.now()}`, sports: ['basketball'], teams: ['Team A'] });

    expect(res.status).toBe(201);
    expect(res.body.data._id).toBeTypeOf('string');
    createdIds.push(res.body.data._id);
  });

  it('POST / returns 400 with a specific message on a duplicate league name (P2002 translated)', async () => {
    const name = `Test Duplicate League ${Date.now()}`;
    const first = await request(app).post('/api/leagues').send({ name, sports: ['basketball'], teams: [] });
    createdIds.push(first.body.data._id);

    const dupe = await request(app).post('/api/leagues').send({ name, sports: ['volleyball'], teams: [] });
    expect(dupe.status).toBe(400);
    expect(dupe.body.message).toMatch(/already exists/i);
  });

  it('PUT /:id returns 404 (not a 500) for a non-existent league — P2025 translated correctly', async () => {
    const res = await request(app)
      .put('/api/leagues/00000000-0000-0000-0000-000000000000')
      .send({ name: 'Does not matter' });
    expect(res.status).toBe(404);
  });

  it('DELETE /:id soft-deletes (active: false), not a real row delete', async () => {
    const league = await prisma.league.create({
      data: { name: `Test Soft Delete League ${Date.now()}`, sports: ['basketball'], teams: [], active: true },
    });
    createdIds.push(league.id);

    const res = await request(app).delete(`/api/leagues/${league.id}`);
    expect(res.status).toBe(200);

    const stillExists = await prisma.league.findUnique({ where: { id: league.id } });
    expect(stillExists).not.toBeNull();
    expect(stillExists.active).toBe(false);
  });
});
