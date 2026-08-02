import { describe, it, expect, vi, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => { req.user = { _id: 'test-admin', role: 'admin' }; next(); },
  isAdmin: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
}));

const { default: homepageSectionsRouter } = await import('../homepageSections.js');

const app = express();
app.use(express.json());
app.use('/api/homepage-sections', homepageSectionsRouter);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('routes/homepageSections.js', () => {
  it('GET / returns every known section key, self-seeded, in display order', async () => {
    const res = await request(app).get('/api/homepage-sections');
    expect(res.status).toBe(200);
    const keys = res.body.data.map((s) => s.key);
    expect(keys).toEqual(
      expect.arrayContaining(['hero', 'shopBySport', 'marquee', 'featuredProducts', 'featuredTeam', 'partners', 'faq'])
    );
    for (let i = 1; i < res.body.data.length; i++) {
      expect(res.body.data[i].displayOrder).toBeGreaterThanOrEqual(res.body.data[i - 1].displayOrder);
    }
  });

  it('PATCH /:key toggles a single section active flag', async () => {
    const res = await request(app).patch('/api/homepage-sections/faq').send({ active: false });
    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(false);

    // restore
    await request(app).patch('/api/homepage-sections/faq').send({ active: true });
  });

  it('PUT / bulk-updates display order', async () => {
    const before = await request(app).get('/api/homepage-sections');
    const reordered = before.body.data.map((s) => ({ key: s.key, displayOrder: s.displayOrder }));

    const res = await request(app).put('/api/homepage-sections').send({ sections: reordered });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(reordered.length);
  });
});
