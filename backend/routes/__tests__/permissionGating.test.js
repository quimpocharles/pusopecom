import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Route-level proof that requirePermission()/requireAnyPermission() are
// actually wired into real routers, not just unit-tested in isolation —
// mocks authenticate to inject a controllable req.user per request while
// exercising the real middleware chain and real route handlers.
let mockUser = { role: 'admin', staffProfile: null };

vi.mock('../../middleware/auth.js', async () => {
  const actual = await vi.importActual('../../middleware/auth.js');
  return {
    ...actual,
    authenticate: (req, res, next) => { req.user = mockUser; next(); },
  };
});

const { default: reportsRouter } = await import('../reports.js');
const { default: campaignsRouter } = await import('../campaigns.js');
const { default: staffRouter } = await import('../staff.js');

const app = express();
app.use(express.json());
app.use('/api/reports', reportsRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/admin/staff', staffRouter);

describe('reports.js — per-workspace permission gating', () => {
  it('marketing: allowed fit-check, denied finance', async () => {
    mockUser = { role: 'admin', staffProfile: { department: 'marketing', permissions: [] } };
    expect((await request(app).get('/api/reports/fit-check')).status).not.toBe(403);
    expect((await request(app).get('/api/reports/finance')).status).toBe(403);
  }, 20000);

  it('finance: allowed finance, denied organizations', async () => {
    mockUser = { role: 'admin', staffProfile: { department: 'finance', permissions: [] } };
    expect((await request(app).get('/api/reports/finance')).status).not.toBe(403);
    expect((await request(app).get('/api/reports/organizations')).status).toBe(403);
  }, 20000);

  it('operations: allowed both orders and shipping under the shared reports.operations.view permission', async () => {
    mockUser = { role: 'admin', staffProfile: { department: 'operations', permissions: [] } };
    expect((await request(app).get('/api/reports/orders')).status).not.toBe(403);
    expect((await request(app).get('/api/reports/shipping')).status).not.toBe(403);
  }, 20000);

  it('executive: allowed everything, including notifications-gated recipients config', async () => {
    mockUser = { role: 'admin', staffProfile: { department: 'executive', permissions: [] } };
    expect((await request(app).get('/api/reports/finance')).status).not.toBe(403);
    expect((await request(app).get('/api/reports/recipients')).status).not.toBe(403);
  }, 20000);

  it('an admin with no StaffProfile at all is treated as executive (bootstrap rule)', async () => {
    mockUser = { role: 'admin', staffProfile: null };
    expect((await request(app).get('/api/reports/finance')).status).not.toBe(403);
  }, 20000);
});

describe('campaigns.js — single-permission router gating', () => {
  it('denies a department without campaigns.manage', async () => {
    mockUser = { role: 'admin', staffProfile: { department: 'finance', permissions: [] } };
    expect((await request(app).get('/api/campaigns')).status).toBe(403);
  }, 20000);

  it('allows marketing, which holds campaigns.manage', async () => {
    mockUser = { role: 'admin', staffProfile: { department: 'marketing', permissions: [] } };
    expect((await request(app).get('/api/campaigns')).status).not.toBe(403);
  }, 20000);
});

describe('staff.js — executive-only settings.security.manage gate', () => {
  it('denies every non-executive department, including operations which holds many other permissions', async () => {
    mockUser = { role: 'admin', staffProfile: { department: 'operations', permissions: [] } };
    expect((await request(app).get('/api/admin/staff')).status).toBe(403);
  }, 20000);

  it('allows executive', async () => {
    mockUser = { role: 'admin', staffProfile: { department: 'executive', permissions: [] } };
    expect((await request(app).get('/api/admin/staff/permissions')).status).not.toBe(403);
  }, 20000);
});
