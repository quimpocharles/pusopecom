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

const { default: fitCheckCampaignsRouter } = await import('../fitCheckCampaigns.js');

const app = express();
app.use(express.json());
app.use('/api/fit-check-campaigns', fitCheckCampaignsRouter);

let createdId;

afterAll(async () => {
  if (createdId) {
    await prisma.fitCheckCampaign.delete({ where: { id: createdId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe('routes/fitCheckCampaigns.js', () => {
  it('POST / creates a Fit Check campaign', async () => {
    const res = await request(app).post('/api/fit-check-campaigns').send({
      name: 'Test Sponsorship',
      sponsorName: 'Playtime.ph',
      headline: 'Unlimited Fit Checks — on us',
      category: 'jersey',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.sponsorName).toBe('Playtime.ph');
    expect(res.body.data.unlimitedFitChecks).toBe(true); // schema default
    createdId = res.body.data._id;
  });

  it('GET / lists Fit Check campaigns (admin)', async () => {
    const res = await request(app).get('/api/fit-check-campaigns');
    expect(res.status).toBe(200);
    expect(res.body.data.some((c) => c._id === createdId)).toBe(true);
  });

  it('GET /:id returns the created campaign (admin)', async () => {
    const res = await request(app).get(`/api/fit-check-campaigns/${createdId}`);
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(createdId);
  });

  it('GET /:id 404s for an unknown id', async () => {
    const res = await request(app).get('/api/fit-check-campaigns/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('PUT /:id updates only the submitted fields', async () => {
    const res = await request(app).put(`/api/fit-check-campaigns/${createdId}`).send({ priority: 5 });
    expect(res.status).toBe(200);
    expect(res.body.data.priority).toBe(5);
    expect(res.body.data.sponsorName).toBe('Playtime.ph'); // untouched
  });

  it('PUT /:id on a nonexistent id returns 404', async () => {
    const res = await request(app).put('/api/fit-check-campaigns/00000000-0000-0000-0000-000000000000').send({ priority: 1 });
    expect(res.status).toBe(404);
  });

  it('POST /:id/view increments the view counter', async () => {
    const before = await prisma.fitCheckCampaign.findUnique({ where: { id: createdId } });
    const res = await request(app).post(`/api/fit-check-campaigns/${createdId}/view`);
    expect(res.status).toBe(200);
    const after = await prisma.fitCheckCampaign.findUnique({ where: { id: createdId } });
    expect(after.views).toBe(before.views + 1);
  });

  it('POST /:id/view still 200s for an unknown id — a stray ping is not an error', async () => {
    const res = await request(app).post('/api/fit-check-campaigns/00000000-0000-0000-0000-000000000000/view');
    expect(res.status).toBe(200);
  });

  it('GET /:id/analytics returns zeroed analytics for a campaign with no Fit Checks yet', async () => {
    const res = await request(app).get(`/api/fit-check-campaigns/${createdId}/analytics`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      generations: 0,
      successRate: 0,
      uniqueFans: 0,
      purchases: 0,
      revenue: 0,
      topProducts: [],
    });
    expect(res.body.data.views).toBeGreaterThan(0); // the two pings above
  });

  it('GET /:id/analytics 404s for an unknown id', async () => {
    const res = await request(app).get('/api/fit-check-campaigns/00000000-0000-0000-0000-000000000000/analytics');
    expect(res.status).toBe(404);
  });

  it('DELETE /:id soft-deletes (active: false), not a real row delete', async () => {
    const res = await request(app).delete(`/api/fit-check-campaigns/${createdId}`);
    expect(res.status).toBe(200);

    const row = await prisma.fitCheckCampaign.findUnique({ where: { id: createdId } });
    expect(row).not.toBeNull();
    expect(row.active).toBe(false);
  });

  it('DELETE /:id on a nonexistent id returns 404', async () => {
    const res = await request(app).delete('/api/fit-check-campaigns/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});
