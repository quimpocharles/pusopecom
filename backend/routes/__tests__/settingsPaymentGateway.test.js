import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

// Launch-readiness audit, Fix 1 — dedicated, focused file for the new
// payment.defaultPaymentGateway restriction, deliberately separate from the
// existing settings.test.js (not run here), which fully mocks
// requireAnyPermission and so never exercises real authorization. This
// file uses the REAL requireAnyPermission (only authenticate/isAdmin are
// mocked, to make req.user's staffProfile controllable per test) — same
// convention this codebase already established in
// routes/__tests__/promoCodes.test.js.

let currentUser = { _id: 'settings-gw-test-admin', role: 'admin', staffProfile: null };

vi.mock('../../middleware/auth.js', async () => {
  const actual = await vi.importActual('../../middleware/auth.js');
  return {
    ...actual,
    authenticate: (req, res, next) => { req.user = currentUser; next(); },
    isAdmin: (req, res, next) => next(),
  };
});

const { default: settingsRouter } = await import('../settings.js');

const app = express();
app.use(express.json());
app.use('/api/settings', settingsRouter);

const MARKER = `SettingsGwTest${Date.now()}`;

function asExecutive() {
  currentUser = { _id: 'settings-gw-test-admin', role: 'admin', staffProfile: { department: 'executive', permissions: [] } };
}
function asOperations() {
  currentUser = { _id: 'settings-gw-test-admin', role: 'admin', staffProfile: { department: 'operations', permissions: [] } };
}
function asMarketing() {
  currentUser = { _id: 'settings-gw-test-admin', role: 'admin', staffProfile: { department: 'marketing', permissions: [] } };
}

beforeAll(async () => {
  // SiteSettings.updatedByUserId is a real FK to User — same fixture
  // pattern settings.test.js already established for a mocked admin actor.
  await prisma.user.upsert({
    where: { id: 'settings-gw-test-admin' },
    create: { id: 'settings-gw-test-admin', email: `${MARKER}@test.local`, firstName: 'Gateway', lastName: 'Tester', role: 'admin' },
    update: {},
  });
}, 15000);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('PUT /api/settings — payment.defaultPaymentGateway restriction', () => {
  it('1. Executive can submit payment.defaultPaymentGateway (authorization passes through)', async () => {
    asExecutive();
    const before = await request(app).get('/api/settings');
    const currentGateway = before.body.data.payment.defaultPaymentGateway;

    // Round-trips the SAME value that's already stored — proves the
    // permission gate lets an executive through with the field present,
    // without this test itself ever changing the live gateway.
    const res = await request(app).put('/api/settings').send({ payment: { defaultPaymentGateway: currentGateway } });
    expect(res.status).toBe(200);
    expect(res.body.data.payment.defaultPaymentGateway).toBe(currentGateway);
  }, 15000);

  it('2. Operations cannot change payment.defaultPaymentGateway', async () => {
    asOperations();
    const before = await request(app).get('/api/settings');

    const res = await request(app).put('/api/settings').send({ payment: { defaultPaymentGateway: 'maya' } });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/settings\.integrations\.manage/i);

    const after = await request(app).get('/api/settings');
    expect(after.body.data.payment.defaultPaymentGateway).toBe(before.body.data.payment.defaultPaymentGateway);
  }, 15000);

  it('3. Marketing cannot change payment.defaultPaymentGateway', async () => {
    asMarketing();
    const before = await request(app).get('/api/settings');

    const res = await request(app).put('/api/settings').send({ payment: { defaultPaymentGateway: 'maya' } });
    expect(res.status).toBe(403);

    const after = await request(app).get('/api/settings');
    expect(after.body.data.payment.defaultPaymentGateway).toBe(before.body.data.payment.defaultPaymentGateway);
  }, 15000);

  it('4. Operations can still update legitimate Commerce settings it owns (payment.orderRetentionHours, no gateway key)', async () => {
    asOperations();
    const before = await request(app).get('/api/settings');

    const res = await request(app).put('/api/settings').send({ payment: { orderRetentionHours: 30 } });
    expect(res.status).toBe(200);
    expect(res.body.data.payment.orderRetentionHours).toBe(30);
    expect(res.body.data.payment.defaultPaymentGateway).toBe(before.body.data.payment.defaultPaymentGateway);

    // restore
    await request(app).put('/api/settings').send({ payment: { orderRetentionHours: before.body.data.payment.orderRetentionHours } });
  }, 15000);

  it('5. Marketing can still update legitimate Fit Check settings it owns', async () => {
    asMarketing();
    const before = await request(app).get('/api/settings');

    const res = await request(app).put('/api/settings').send({ fitCheck: { dailyLimitRegistered: 9 } });
    expect(res.status).toBe(200);
    expect(res.body.data.fitCheck.dailyLimitRegistered).toBe(9);

    // restore
    await request(app).put('/api/settings').send({ fitCheck: { dailyLimitRegistered: before.body.data.fitCheck.dailyLimitRegistered } });
  }, 15000);

  it('6. a crafted request mixing a legitimate field with defaultPaymentGateway is rejected outright — no partial application', async () => {
    asOperations();
    const before = await request(app).get('/api/settings');

    const res = await request(app).put('/api/settings').send({
      payment: { orderRetentionHours: 999, defaultPaymentGateway: 'epaygames' },
    });
    expect(res.status).toBe(403);

    // Neither field was applied — the whole request was rejected, not
    // silently stripped-and-processed.
    const after = await request(app).get('/api/settings');
    expect(after.body.data.payment.orderRetentionHours).toBe(before.body.data.payment.orderRetentionHours);
    expect(after.body.data.payment.defaultPaymentGateway).toBe(before.body.data.payment.defaultPaymentGateway);
  }, 15000);
});
