import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

// Launch-readiness audit, founder-only staff administration fix. Same
// controllable-currentUser convention as this session's other permission
// test files: authenticate/isAdmin mocked, requirePermission stays real —
// so this genuinely exercises both the existing settings.security.manage
// gate AND the new founder-ID check layered on top of it, not a stub of
// either.
//
// The two founder IDs below are the real, hardcoded constants
// routes/staff.js checks against — reused verbatim so a change to the
// actual allowlist fails this suite loudly. No real User row with either
// ID needs to exist for these tests: authenticate is mocked, so the actor
// is never looked up from the DB — only PATCH's *target* user needs to be
// a real row.
const OLD_FOUNDER_ID = '8b30ff12-5e33-4553-b6a6-9bad88752a17'; // quimpo.charles@gmail.com
const NEW_FOUNDER_ID = 'e682f916-44b1-48ab-971b-799836608c87'; // charles.quimpo@pusostore.com
const CHRIS_ID = 'chris-quimpo-test-id'; // executive, deliberately NOT a founder ID

let currentUser;

vi.mock('../../middleware/auth.js', async () => {
  const actual = await vi.importActual('../../middleware/auth.js');
  return {
    ...actual,
    authenticate: (req, res, next) => { req.user = currentUser; next(); },
    isAdmin: (req, res, next) => next(),
  };
});

const { default: staffRouter } = await import('../staff.js');

const app = express();
app.use(express.json());
app.use('/api/admin/staff', staffRouter);

const MARKER = `StaffFounderTest${Date.now()}`;
let targetAdmin;

function asOldFounder() {
  currentUser = { _id: OLD_FOUNDER_ID, role: 'admin', staffProfile: { department: 'executive', permissions: [] } };
}
function asNewFounder() {
  currentUser = { _id: NEW_FOUNDER_ID, role: 'admin', staffProfile: { department: 'executive', permissions: [] } };
}
function asChris() {
  currentUser = { _id: CHRIS_ID, role: 'admin', staffProfile: { department: 'executive', permissions: [] } };
}
function asDepartment(department) {
  currentUser = { _id: `${department}-test-id`, role: 'admin', staffProfile: { department, permissions: [] } };
}

beforeAll(async () => {
  // StaffProfile.updatedByUserId is a real FK to User — same fixture
  // pattern this codebase already established (settings.test.js,
  // staff.test.js) for a mocked actor. Upserted, not created outright: in
  // the (unlikely) case this ever runs against a database where these ids
  // already resolve to something else, this only touches its own known
  // test-fixture fields, never anyone else's row shape.
  await prisma.user.upsert({
    where: { id: OLD_FOUNDER_ID },
    create: { id: OLD_FOUNDER_ID, email: `${MARKER}-old-founder@test.local`, firstName: 'Old', lastName: 'Founder', role: 'admin' },
    update: {},
  });
  await prisma.user.upsert({
    where: { id: NEW_FOUNDER_ID },
    create: { id: NEW_FOUNDER_ID, email: `${MARKER}-new-founder@test.local`, firstName: 'New', lastName: 'Founder', role: 'admin' },
    update: {},
  });

  targetAdmin = await prisma.user.create({
    data: { email: `${MARKER}@test.local`, firstName: 'Target', lastName: 'Admin', role: 'admin' },
  });
}, 20000);

afterAll(async () => {
  await prisma.staffProfile.deleteMany({ where: { userId: targetAdmin.id } });
  await prisma.user.delete({ where: { id: targetAdmin.id } });
  await prisma.$disconnect();
});

describe('Staff administration — founder-only authorization', () => {
  it('9. the OLD founder account (quimpo.charles@gmail.com) can access staff administration', async () => {
    asOldFounder();
    const res = await request(app).get('/api/admin/staff');
    expect(res.status).toBe(200);
  });

  it('10. the NEW founder account (charles.quimpo@pusostore.com) can access staff administration', async () => {
    asNewFounder();
    const res = await request(app).get('/api/admin/staff');
    expect(res.status).toBe(200);
  });

  it('11. Chris (executive, not a founder ID) gets 403', async () => {
    asChris();
    const res = await request(app).get('/api/admin/staff');
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/founder/i);
  });

  it('12. operations gets 403', async () => {
    asDepartment('operations');
    const res = await request(app).get('/api/admin/staff');
    expect(res.status).toBe(403);
  });

  it('13. marketing gets 403', async () => {
    asDepartment('marketing');
    const res = await request(app).get('/api/admin/staff');
    expect(res.status).toBe(403);
  });

  it('14. scanner gets 403', async () => {
    asDepartment('scanner');
    const res = await request(app).get('/api/admin/staff');
    expect(res.status).toBe(403);
  });

  it('15. order_management gets 403', async () => {
    asDepartment('order_management');
    const res = await request(app).get('/api/admin/staff');
    expect(res.status).toBe(403);
  });

  it('16. finance/warehouse/support are denied — verified as failing the EXISTING settings.security.manage gate, not just the new founder check (none hold that permission by default)', async () => {
    for (const department of ['finance', 'warehouse', 'support']) {
      asDepartment(department);
      const res = await request(app).get('/api/admin/staff');
      expect(res.status).toBe(403);
      // The generic requirePermission message, not the founder-specific
      // one — confirms these are stopped by the pre-existing gate.
      expect(res.body.message).not.toMatch(/founder/i);
    }
  });

  it('17. the founder can PATCH another staff member\'s department and permissions', async () => {
    asOldFounder();
    const res = await request(app)
      .patch(`/api/admin/staff/${targetAdmin.id}`)
      .send({ department: 'support', permissions: ['reports.finance.view'] });
    expect(res.status).toBe(200);
    expect(res.body.data.department).toBe('support');
    expect(res.body.data.permissions).toEqual(['reports.finance.view']);
  });

  it('18. Chris cannot PATCH even with a crafted direct API request', async () => {
    asChris();
    const res = await request(app)
      .patch(`/api/admin/staff/${targetAdmin.id}`)
      .send({ department: 'executive' }); // attempting to self-promote the target, or anyone, to executive
    expect(res.status).toBe(403);

    // Confirm no partial write happened.
    const stillSupport = await prisma.staffProfile.findUnique({ where: { userId: targetAdmin.id } });
    expect(stillSupport.department).toBe('support');
  });

  it('20. GET /permissions (the vocabulary endpoint) also requires the founder check, not just the router index', async () => {
    asChris();
    const res = await request(app).get('/api/admin/staff/permissions');
    expect(res.status).toBe(403);

    asOldFounder();
    const founderRes = await request(app).get('/api/admin/staff/permissions');
    expect(founderRes.status).toBe(200);
    expect(founderRes.body.data.departmentDefaults.scanner).toEqual(['passes.checkin']);
  });
});
