import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

// requirePermission is the real implementation (via importActual), not a
// stub — the mocked actor below has no staffProfile, so the bootstrap rule
// (no StaffProfile = executive) is what lets it through settings.security
// .manage. Since the launch-readiness founder-only fix, staff.js also
// requires the actor's id to be one of the hardcoded founder ids — the
// bootstrap rule alone is no longer sufficient for THIS router specifically
// — so the mocked actor id must be a real founder id for these
// (otherwise-unrelated) tests to exercise anything past that gate. See
// routes/__tests__/staffFounderAuthorization.test.js for the dedicated
// founder-authorization coverage itself.
const FOUNDER_ACTOR_ID = '8b30ff12-5e33-4553-b6a6-9bad88752a17'; // quimpo.charles@gmail.com

vi.mock('../../middleware/auth.js', async () => {
  const actual = await vi.importActual('../../middleware/auth.js');
  return {
    ...actual,
    authenticate: (req, res, next) => { req.user = { _id: FOUNDER_ACTOR_ID, role: 'admin' }; next(); },
    isAdmin: (req, res, next) => next(),
  };
});

const { default: staffRouter } = await import('../staff.js');

const app = express();
app.use(express.json());
app.use('/api/admin/staff', staffRouter);

const MARKER = `StaffRouteTest${Date.now()}`;
let targetAdmin;

// The first real route ever wired to StaffProfile — no fixture convention
// exists yet for it, so this establishes one: a real admin-role User (the
// list target) plus the mocked actor's own User row (staffUserId/
// updatedByUserId are real FKs).
beforeAll(async () => {
  // Upserted, never deleted — same persistent-fixture treatment this
  // codebase already gives 'test-admin' elsewhere (settings.test.js,
  // reports.test.js). This id is also managed by
  // staffFounderAuthorization.test.js; both files only ever upsert it, so
  // running concurrently in separate workers is safe — neither ever
  // deletes a row the other might still be relying on.
  await prisma.user.upsert({
    where: { id: FOUNDER_ACTOR_ID },
    create: { id: FOUNDER_ACTOR_ID, email: `staff-route-actor-${Date.now()}@test.local`, firstName: 'Actor', lastName: 'Tester', role: 'admin' },
    update: {},
  });
  targetAdmin = await prisma.user.create({
    data: { email: `${MARKER}@test.local`, firstName: 'Target', lastName: 'Admin', role: 'admin' },
  });
}, 15000);

afterAll(async () => {
  await prisma.staffProfile.deleteMany({ where: { userId: targetAdmin.id } });
  await prisma.user.delete({ where: { id: targetAdmin.id } });
});

describe('GET /admin/staff', () => {
  it('lists every admin-role user, including ones with no StaffProfile yet', async () => {
    const res = await request(app).get('/api/admin/staff');
    expect(res.status).toBe(200);
    const row = res.body.data.find((s) => s.userId === targetAdmin.id);
    expect(row).toBeTruthy();
    expect(row.staffProfile).toBeNull();
  });
});

describe('PATCH /admin/staff/:userId', () => {
  it('rejects a missing or invalid department', async () => {
    const missing = await request(app).patch(`/api/admin/staff/${targetAdmin.id}`).send({ permissions: ['can_assign'] });
    expect(missing.status).toBe(400);

    const invalid = await request(app).patch(`/api/admin/staff/${targetAdmin.id}`).send({ department: 'not-a-real-department' });
    expect(invalid.status).toBe(400);
  });

  it('404s for a userId that is not an admin-role user', async () => {
    const customer = await prisma.user.create({ data: { email: `${MARKER}-customer@test.local`, firstName: 'C', lastName: 'D', role: 'customer' } });
    try {
      const res = await request(app).patch(`/api/admin/staff/${customer.id}`).send({ department: 'support' });
      expect(res.status).toBe(404);
    } finally {
      await prisma.user.delete({ where: { id: customer.id } });
    }
  });

  it('upserts department + permissions, and records who made the change', async () => {
    const res = await request(app).patch(`/api/admin/staff/${targetAdmin.id}`).send({
      department: 'support', title: 'Support Lead', permissions: ['returns.approve', 'reports.finance.view'],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.department).toBe('support');
    expect(res.body.data.permissions).toEqual(['returns.approve', 'reports.finance.view']);
    expect(res.body.data.updatedByUserId).toBe(FOUNDER_ACTOR_ID);

    // GET reflects it now
    const list = await request(app).get('/api/admin/staff');
    const row = list.body.data.find((s) => s.userId === targetAdmin.id);
    expect(row.staffProfile.department).toBe('support');
  });

  it('accepts the two launch-readiness departments (scanner, order_management)', async () => {
    const scannerRes = await request(app).patch(`/api/admin/staff/${targetAdmin.id}`).send({ department: 'scanner' });
    expect(scannerRes.status).toBe(200);
    expect(scannerRes.body.data.department).toBe('scanner');

    const orderMgmtRes = await request(app).patch(`/api/admin/staff/${targetAdmin.id}`).send({ department: 'order_management' });
    expect(orderMgmtRes.status).toBe(200);
    expect(orderMgmtRes.body.data.department).toBe('order_management');
  });

  it('rejects a permission string outside the defined vocabulary', async () => {
    const res = await request(app).patch(`/api/admin/staff/${targetAdmin.id}`).send({
      department: 'support', permissions: ['can_assign_totally_made_up'],
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('can_assign_totally_made_up');
  });
});

describe('GET /admin/staff/permissions', () => {
  it('serves the same vocabulary lib/permissions.js enforces, plus department defaults', async () => {
    const res = await request(app).get('/api/admin/staff/permissions');
    expect(res.status).toBe(200);
    expect(res.body.data.permissions).toContain('reports.finance.view');
    expect(res.body.data.departmentDefaults.warehouse).toContain('products.view');
    expect(res.body.data.departmentDefaults.executive).toEqual(['*']);
    expect(res.body.data.departmentDefaults.scanner).toEqual(['passes.checkin']);
    expect(res.body.data.departmentDefaults.order_management).toEqual(['orders.view', 'orders.manage', 'fulfillment.status_manage']);
  });
});
