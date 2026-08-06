import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => { req.user = { _id: 'test-staff-admin', role: 'admin' }; next(); },
  isAdmin: (req, res, next) => next(),
}));

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
  await prisma.user.upsert({
    where: { id: 'test-staff-admin' },
    create: { id: 'test-staff-admin', email: `staff-route-actor-${Date.now()}@test.local`, firstName: 'Actor', lastName: 'Tester', role: 'admin' },
    update: {},
  });
  targetAdmin = await prisma.user.create({
    data: { email: `${MARKER}@test.local`, firstName: 'Target', lastName: 'Admin', role: 'admin' },
  });
}, 15000);

afterAll(async () => {
  await prisma.staffProfile.deleteMany({ where: { userId: { in: [targetAdmin.id, 'test-staff-admin'] } } });
  await prisma.user.delete({ where: { id: targetAdmin.id } });
  await prisma.user.delete({ where: { id: 'test-staff-admin' } });
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
      department: 'support', title: 'Support Lead', permissions: ['can_refund', 'can_view_finance'],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.department).toBe('support');
    expect(res.body.data.permissions).toEqual(['can_refund', 'can_view_finance']);
    expect(res.body.data.updatedByUserId).toBe('test-staff-admin');

    // GET reflects it now
    const list = await request(app).get('/api/admin/staff');
    const row = list.body.data.find((s) => s.userId === targetAdmin.id);
    expect(row.staffProfile.department).toBe('support');
  });
});
