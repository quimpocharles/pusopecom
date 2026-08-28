import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

// Launch-readiness audit, Users-list visibility fix — dedicated, focused
// file separate from the existing routes/__tests__/auth.test.js (not run
// here), which exercises the real JWT chain but doesn't vary staffProfile
// department. Same controllable-currentUser convention this session
// already established (promoCodes.test.js, settingsPaymentGateway.test.js,
// reportsArchivePermissions.test.js): only authenticate/isAdmin are
// mocked, requirePermission stays real.

let currentUser = { _id: 'users-visibility-test-admin', role: 'admin', staffProfile: null };

vi.mock('../../middleware/auth.js', async () => {
  const actual = await vi.importActual('../../middleware/auth.js');
  return {
    ...actual,
    authenticate: (req, res, next) => { req.user = currentUser; next(); },
    isAdmin: (req, res, next) => next(),
  };
});

const { default: authRouter } = await import('../auth.js');

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

const MARKER = `UsersVisibilityTest${Date.now()}`;
const createdUserIds = [];

function asExecutive() {
  currentUser = { _id: 'users-visibility-test-admin', role: 'admin', staffProfile: { department: 'executive', permissions: [] } };
}
function asBootstrapNoProfile() {
  currentUser = { _id: 'users-visibility-test-admin', role: 'admin', staffProfile: null };
}
function asSupport() {
  currentUser = { _id: 'users-visibility-test-admin', role: 'admin', staffProfile: { department: 'support', permissions: [] } };
}

beforeAll(async () => {
  const customer = await prisma.user.create({
    data: { email: `${MARKER}-customer@test.local`, firstName: 'Customer', lastName: MARKER, role: 'customer' },
  });
  const admin = await prisma.user.create({
    data: { email: `${MARKER}-admin@test.local`, firstName: 'Staffer', lastName: MARKER, role: 'admin' },
  });
  createdUserIds.push(customer.id, admin.id);
}, 15000);

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

function emails(res) {
  return res.body.data.map((u) => u.email);
}

describe('GET /api/auth/admin/users — visibility by caller department', () => {
  it('1. executive can list both customers and admins', async () => {
    asExecutive();

    const customerRes = await request(app).get('/api/auth/admin/users').query({ role: 'customer', search: MARKER });
    expect(customerRes.status).toBe(200);
    expect(emails(customerRes)).toContain(`${MARKER}-customer@test.local`);

    const adminRes = await request(app).get('/api/auth/admin/users').query({ role: 'admin', search: MARKER });
    expect(adminRes.status).toBe(200);
    expect(emails(adminRes)).toContain(`${MARKER}-admin@test.local`);
  }, 20000);

  it('2. support can list customers', async () => {
    asSupport();
    const res = await request(app).get('/api/auth/admin/users').query({ role: 'customer', search: MARKER });
    expect(res.status).toBe(200);
    expect(emails(res)).toContain(`${MARKER}-customer@test.local`);
  }, 20000);

  it('3. support requesting ?role=admin is still forced to customer-only results', async () => {
    asSupport();
    const res = await request(app).get('/api/auth/admin/users').query({ role: 'admin', search: MARKER });
    expect(res.status).toBe(200);
    expect(emails(res)).toContain(`${MARKER}-customer@test.local`);
    expect(emails(res)).not.toContain(`${MARKER}-admin@test.local`);
  }, 20000);

  it('4. support cannot retrieve admin rows through any alternate role query value', async () => {
    asSupport();
    for (const role of ['admin', 'ADMIN', 'Admin', '']) {
      const res = await request(app).get('/api/auth/admin/users').query({ role, search: MARKER });
      expect(res.status).toBe(200);
      expect(emails(res)).not.toContain(`${MARKER}-admin@test.local`);
    }
  }, 20000);

  it('5. a non-executive caller cannot bypass this with a crafted array-style role query param', async () => {
    asSupport();
    // Express's default (qs) query parser turns role[]=admin into
    // req.query.role = ['admin'] — a truthy, non-'customer' value the
    // original code would have passed straight into the where clause.
    const res = await request(app).get('/api/auth/admin/users').query('role[]=admin&search=' + encodeURIComponent(MARKER));
    expect(res.status).toBe(200);
    expect(emails(res)).not.toContain(`${MARKER}-admin@test.local`);
  }, 20000);

  it('a caller with no StaffProfile at all (bootstrap rule) is treated as executive, not restricted', async () => {
    asBootstrapNoProfile();
    const res = await request(app).get('/api/auth/admin/users').query({ role: 'admin', search: MARKER });
    expect(res.status).toBe(200);
    expect(emails(res)).toContain(`${MARKER}-admin@test.local`);
  }, 20000);

  it('8. scanner/order_management/warehouse/marketing/operations/finance all still 403 (unchanged — none hold users.view)', async () => {
    const deniedDepartments = ['scanner', 'order_management', 'warehouse', 'marketing', 'operations', 'finance'];
    for (const department of deniedDepartments) {
      currentUser = { _id: 'users-visibility-test-admin', role: 'admin', staffProfile: { department, permissions: [] } };
      const res = await request(app).get('/api/auth/admin/users');
      expect(res.status).toBe(403);
    }
  }, 20000);

  it('6 & 7. pagination and server-side search still work, unchanged', async () => {
    asExecutive();
    const res = await request(app).get('/api/auth/admin/users').query({ search: MARKER, limit: 1 });
    expect(res.status).toBe(200);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 1, total: expect.any(Number), pages: expect.any(Number) });
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(2); // the two fixture users
    expect(res.body.data.length).toBe(1); // limit respected

    // a limit far above MAX_LIMIT is clamped, not honored
    const clamped = await request(app).get('/api/auth/admin/users').query({ search: MARKER, limit: 100000 });
    expect(clamped.body.pagination.limit).toBe(100);
  }, 20000);
});
