import { describe, it, expect, vi, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => { req.user = { _id: 'test-admin', role: 'admin' }; next(); },
  isAdmin: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
}));

const { default: settingsRouter } = await import('../settings.js');

const app = express();
app.use(express.json());
app.use('/api/settings', settingsRouter);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('routes/settings.js', () => {
  it('GET / returns the nested { tryOn, tryOnAd } shape over HTTP, not flat columns', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body.data.tryOn).toHaveProperty('title');
    expect(res.body.data.tryOn).toHaveProperty('productUrl');
    expect(res.body.data.tryOnAd).toHaveProperty('videoUrl');
    expect(res.body.data).not.toHaveProperty('tryOnTitle');
  });

  it('PUT / updates only the submitted sub-fields, preserving the rest, over HTTP', async () => {
    const before = await request(app).get('/api/settings');
    const newTitle = `Test Title ${Date.now()}`;

    const res = await request(app).put('/api/settings').send({ tryOn: { title: newTitle } });
    expect(res.status).toBe(200);
    expect(res.body.data.tryOn.title).toBe(newTitle);
    expect(res.body.data.tryOn.productUrl).toBe(before.body.data.tryOn.productUrl);
    expect(res.body.data.tryOnAd).toEqual(before.body.data.tryOnAd);

    // restore, so this test doesn't permanently change real settings
    await request(app).put('/api/settings').send({ tryOn: { title: before.body.data.tryOn.title } });
  });

  it('GET /venue-pickup returns a safe default when no config exists yet', async () => {
    const res = await request(app).get('/api/settings/venue-pickup');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Either a real config, or the documented fallback shape — never a crash.
    expect(res.body.data).toHaveProperty('enabled');
  });
});
