import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
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

// SiteSettings.updatedByUserId is a real FK to User — same fixture pattern
// this codebase already established elsewhere for a mocked admin actor.
beforeAll(async () => {
  await prisma.user.upsert({
    where: { id: 'test-admin' },
    create: { id: 'test-admin', email: `settings-route-admin-${Date.now()}@test.local`, firstName: 'Admin', lastName: 'Tester', role: 'admin' },
    update: {},
  });
}, 15000);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('routes/settings.js', () => {
  it('GET / returns the nested { tryOnAd } shape over HTTP, not flat columns, and no dead tryOn group', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body.data.tryOnAd).toHaveProperty('videoUrl');
    expect(res.body.data).not.toHaveProperty('tryOnTitle');
    expect(res.body.data).not.toHaveProperty('tryOn');
  });

  it('GET / includes fitCheck, distinct from tryOnAd (config, not homepage teaser content)', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.body.data.fitCheck).toMatchObject({
      dailyLimitGuest: expect.any(Number),
      dailyLimitRegistered: expect.any(Number),
      dailyLimitPremium: expect.any(Number),
      guestRetentionHours: expect.any(Number),
    });
  });

  it('PUT / updates fitCheck without touching tryOnAd, and vice versa', async () => {
    const before = await request(app).get('/api/settings');

    const res = await request(app).put('/api/settings').send({ fitCheck: { dailyLimitRegistered: 7 } });
    expect(res.status).toBe(200);
    expect(res.body.data.fitCheck.dailyLimitRegistered).toBe(7);
    expect(res.body.data.fitCheck.dailyLimitGuest).toBe(before.body.data.fitCheck.dailyLimitGuest);
    expect(res.body.data.tryOnAd).toEqual(before.body.data.tryOnAd);

    // restore, so this test doesn't permanently change real settings —
    // lib/fitCheckQuota.js's default assumption (5/day) depends on this.
    await request(app).put('/api/settings').send({ fitCheck: { dailyLimitRegistered: before.body.data.fitCheck.dailyLimitRegistered } });
  });

  it('PUT / updates only the submitted sub-fields, preserving the rest, over HTTP', async () => {
    const before = await request(app).get('/api/settings');
    const newButtonText = `Test Button ${Date.now()}`;

    const res = await request(app).put('/api/settings').send({ tryOnAd: { buttonText: newButtonText } });
    expect(res.status).toBe(200);
    expect(res.body.data.tryOnAd.buttonText).toBe(newButtonText);
    expect(res.body.data.tryOnAd.videoUrl).toBe(before.body.data.tryOnAd.videoUrl);
    expect(res.body.data.fitCheck).toEqual(before.body.data.fitCheck);

    // restore, so this test doesn't permanently change real settings
    await request(app).put('/api/settings').send({ tryOnAd: { buttonText: before.body.data.tryOnAd.buttonText } });
  });

  it('PUT / records who made the change, never trusting a client-sent value', async () => {
    const res = await request(app).put('/api/settings').send({
      fitCheck: { dailyLimitRegistered: 5 },
      updatedByUserId: 'someone-else-entirely', // must be ignored — server derives this from req.user
    });
    expect(res.status).toBe(200);
    expect(res.body.data.updatedBy).toMatchObject({ firstName: 'Admin', lastName: 'Tester' });
  });

  it('GET / includes payment (Payment Platform Redesign, Phase 4), distinct from fitCheck', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.body.data.payment).toMatchObject({
      orderExpirationEnabled: expect.any(Boolean),
      orderRetentionHours: expect.any(Number),
    });
  });

  it('PUT / updates payment without touching fitCheck/tryOnAd, and vice versa', async () => {
    const before = await request(app).get('/api/settings');

    const res = await request(app).put('/api/settings').send({ payment: { orderRetentionHours: 24 } });
    expect(res.status).toBe(200);
    expect(res.body.data.payment.orderRetentionHours).toBe(24);
    expect(res.body.data.payment.orderExpirationEnabled).toBe(before.body.data.payment.orderExpirationEnabled);
    expect(res.body.data.fitCheck).toEqual(before.body.data.fitCheck);

    // restore, so this test doesn't permanently change real settings —
    // lib/expireStaleOrders.js's default assumption (48h) depends on this.
    await request(app).put('/api/settings').send({ payment: { orderRetentionHours: before.body.data.payment.orderRetentionHours } });
  });

  it('GET /venue-pickup returns a safe default when no config exists yet', async () => {
    const res = await request(app).get('/api/settings/venue-pickup');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Either a real config, or the documented fallback shape — never a crash.
    expect(res.body.data).toHaveProperty('enabled');
  });
});
