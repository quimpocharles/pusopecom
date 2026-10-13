import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';
import { PERMISSIONS } from '../../lib/permissions.js';

// F6 follow-up — GET /api/admin/returns and GET /api/admin/returns/:id were
// widened from requirePermission(RETURNS_VIEW) to
// requireAnyPermission(RETURNS_VIEW, REFUNDS_VIEW), mirroring refunds.js's
// own GET routes, so a Finance-only profile (refunds.manage, no
// returns.view) that the F6 frontend/route change already admits to
// /admin/returns can actually populate the queue and open the refund
// modal. returns.test.js mocks requirePermission/requireAnyPermission away
// entirely (it's testing business logic, not authorization), so it can't
// cover this — this file uses the REAL middleware, same convention as
// reportsArchivePermissions.test.js / shipmentsPermissions.test.js (only
// authenticate is mocked, to make req.user's staffProfile controllable).

let currentUser;

vi.mock('../../middleware/auth.js', async () => {
  const actual = await vi.importActual('../../middleware/auth.js');
  return {
    ...actual,
    authenticate: (req, res, next) => { req.user = currentUser; next(); },
    isAdmin: (req, res, next) => next(),
  };
});

const { adminRouter: adminReturnsRouter } = await import('../returns.js');

const app = express();
app.use(express.json());
app.use('/api/admin/returns', adminReturnsRouter);

function asDept(department, permissions = []) {
  currentUser = { _id: 'returns-perm-test-admin', role: 'admin', staffProfile: { department, active: true, permissions } };
}

const MARKER = `ReturnsPermTest${Date.now()}`;
let product, order, returnRequest;

beforeAll(async () => {
  await prisma.user.upsert({
    where: { id: 'returns-perm-test-admin' },
    create: { id: 'returns-perm-test-admin', email: `${MARKER.toLowerCase()}@test.local`, firstName: 'Admin', lastName: 'Tester', role: 'admin' },
    update: {},
  });

  product = await prisma.product.create({
    data: {
      name: MARKER, slug: `returns-perm-test-${Date.now()}`, description: 'x',
      price: 500, category: 'jersey', sport: 'basketball', images: [], active: true,
      totalStock: 8, sizes: { create: [{ size: 'M', stock: 8 }] },
    },
  });

  order = await prisma.order.create({
    data: {
      orderNumber: `PS-${MARKER}`,
      email: 'returns-perm-test@example.com',
      shipToFullName: 'Test Buyer', shipToPhone: '09171234567', shipToAddress: '1 St',
      shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
      subtotal: 500, total: 500, paymentStatus: 'paid', orderStatus: 'delivered',
      items: { create: [{ productId: product.id, name: product.name, price: 500, quantity: 1, size: 'M', image: 'x.jpg' }] },
    },
  });

  returnRequest = await prisma.returnRequest.create({ data: { orderId: order.id, reason: 'Wrong size' } });
}, 20000);

afterAll(async () => {
  await prisma.returnItem.deleteMany({ where: { returnRequestId: returnRequest.id } });
  await prisma.returnRequest.delete({ where: { id: returnRequest.id } });
  await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
  await prisma.order.delete({ where: { id: order.id } });
  await prisma.product.delete({ where: { id: product.id } });
  await prisma.$disconnect();
}, 20000);

describe('GET /api/admin/returns and /:id — requireAnyPermission(RETURNS_VIEW, REFUNDS_VIEW)', () => {
  it('1. a user with RETURNS_VIEW (support dept) retains access to both the list and detail', async () => {
    asDept('support'); // DEPARTMENT_DEFAULTS.support includes RETURNS_VIEW, no REFUNDS_*

    const list = await request(app).get('/api/admin/returns');
    expect(list.status).toBe(200);

    const detail = await request(app).get(`/api/admin/returns/${returnRequest.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data._id).toBe(returnRequest.id);
  });

  it('2. a Finance-only user (refunds.manage, no returns.view) can now access the list and detail', async () => {
    // warehouse holds neither RETURNS_VIEW nor any refunds.* permission by
    // default; the explicit override grants refunds.manage only — the
    // exact "Finance-only" persona F6 targets. refunds.manage implies
    // refunds.view (same-resource .manage->.view), which is what the
    // widened check actually accepts.
    asDept('warehouse', [PERMISSIONS.REFUNDS_MANAGE]);

    const list = await request(app).get('/api/admin/returns');
    expect(list.status).toBe(200);

    const detail = await request(app).get(`/api/admin/returns/${returnRequest.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data._id).toBe(returnRequest.id);
  });

  it('3. a user granted refunds.view directly (not via .manage) also passes', async () => {
    asDept('warehouse', [PERMISSIONS.REFUNDS_VIEW]);

    const list = await request(app).get('/api/admin/returns');
    expect(list.status).toBe(200);

    const detail = await request(app).get(`/api/admin/returns/${returnRequest.id}`);
    expect(detail.status).toBe(200);
  });

  it('4. a user with neither permission is denied on both routes', async () => {
    asDept('warehouse'); // no override — no RETURNS_VIEW, no refunds.*

    const list = await request(app).get('/api/admin/returns');
    expect(list.status).toBe(403);

    const detail = await request(app).get(`/api/admin/returns/${returnRequest.id}`);
    expect(detail.status).toBe(403);
  });

  it('5. mutating return operations are unaffected — a Finance-only (refunds.manage) user still cannot approve/inspect a return', async () => {
    asDept('warehouse', [PERMISSIONS.REFUNDS_MANAGE]);

    const statusChange = await request(app)
      .patch(`/api/admin/returns/${returnRequest.id}/status`)
      .send({ status: 'approved' });
    expect(statusChange.status).toBe(403);

    const inspect = await request(app)
      .post(`/api/admin/returns/${returnRequest.id}/inspect`)
      .send({ items: [] });
    expect(inspect.status).toBe(403);
  });

  it('6. mutating return operations still work for a user with returns.approve (unchanged behavior)', async () => {
    asDept('support'); // DEPARTMENT_DEFAULTS.support includes RETURNS_APPROVE

    const statusChange = await request(app)
      .patch(`/api/admin/returns/${returnRequest.id}/status`)
      .send({ status: 'under_review' });
    expect(statusChange.status).not.toBe(403);
  });
});
