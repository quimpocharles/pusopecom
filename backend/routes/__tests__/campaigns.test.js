import { describe, it, expect, vi, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => { req.user = { _id: 'test-admin', role: 'admin' }; next(); },
  isAdmin: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
}));

const { default: campaignsRouter } = await import('../campaigns.js');

const app = express();
app.use(express.json());
app.use('/api/campaigns', campaignsRouter);

let createdId;

afterAll(async () => {
  if (createdId) {
    await prisma.campaign.delete({ where: { id: createdId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe('routes/campaigns.js', () => {
  it('POST / creates a campaign', async () => {
    const res = await request(app).post('/api/campaigns').send({
      name: 'Test Campaign',
      headline: 'Game Day Ready',
      featuredOnHomepage: false,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.headline).toBe('Game Day Ready');
    createdId = res.body.data._id;
  });

  it('GET /:id returns the created campaign (admin)', async () => {
    const res = await request(app).get(`/api/campaigns/${createdId}`);
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(createdId);
  });

  it('GET /active returns null when nothing is flagged featuredOnHomepage', async () => {
    const res = await request(app).get('/api/campaigns/active');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it('GET /active returns the campaign once flagged and in-window', async () => {
    await request(app).put(`/api/campaigns/${createdId}`).send({ featuredOnHomepage: true });

    const res = await request(app).get('/api/campaigns/active');
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(createdId);
  });

  it('DELETE /:id soft-deletes (active: false), not a real row delete', async () => {
    const res = await request(app).delete(`/api/campaigns/${createdId}`);
    expect(res.status).toBe(200);

    const row = await prisma.campaign.findUnique({ where: { id: createdId } });
    expect(row).not.toBeNull();
    expect(row.active).toBe(false);
  });

  it('PUT /:id on a nonexistent id returns 404', async () => {
    const res = await request(app).put('/api/campaigns/00000000-0000-0000-0000-000000000000').send({ headline: 'x' });
    expect(res.status).toBe(404);
  });
});
