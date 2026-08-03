import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

// Same convention as routes/__tests__/orders.test.js — authenticate reads
// req.user from test headers rather than a real JWT, so these tests can
// simulate two different real customers without needing the login flow.
// The property under test is real ownership/isolation logic in the routes
// and repositories, not the auth middleware itself (that's a separate
// concern, untested here on purpose, same as every other route test file).
vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => {
    req.user = { _id: req.headers['x-test-userid'], role: 'customer' };
    next();
  },
}));

const { default: accountRouter } = await import('../account.js');
const { authenticate } = await import('../../middleware/auth.js');

// account.js itself applies no auth middleware — server.js mounts
// `authenticate` once at the router level (see the comment in account.js),
// so the test app must do the same to match real request handling.
const app = express();
app.use(express.json());
app.use('/api/account', authenticate, accountRouter);

const agentAs = (userId) => {
  const wrap = (method, path) => request(app)[method](path).set('x-test-userid', userId);
  return {
    get: (path) => wrap('get', path),
    post: (path) => wrap('post', path),
    delete: (path) => wrap('delete', path),
    patch: (path) => wrap('patch', path),
    put: (path) => wrap('put', path),
  };
};

let userA, userB, product, orderA, orderB, wishlistA, notificationA, notificationB, tryOnA;

beforeAll(async () => {
  const suffix = Date.now();

  [userA, userB] = await Promise.all([
    prisma.user.create({
      data: { email: `acct-test-a-${suffix}@example.com`, firstName: 'Ann', lastName: 'Aquino' },
    }),
    prisma.user.create({
      data: { email: `acct-test-b-${suffix}@example.com`, firstName: 'Ben', lastName: 'Bautista' },
    }),
  ]);

  product = await prisma.product.create({
    data: {
      name: 'Account Test Jersey',
      slug: `account-test-jersey-${suffix}`,
      description: 'fixture',
      price: 999,
      category: 'jersey',
      sport: 'basketball',
      images: ['https://example.com/img.jpg'],
      active: true,
    },
  });

  const baseOrder = {
    email: 'fixture@example.com',
    shipToFullName: 'Fixture Name',
    shipToPhone: '09171234567',
    shipToAddress: '123 Test St',
    shipToCity: 'Quezon City',
    shipToProvince: 'Metro Manila',
    shipToZipCode: '1100',
    subtotal: 999,
    total: 999,
  };

  [orderA, orderB] = await Promise.all([
    prisma.order.create({ data: { ...baseOrder, orderNumber: `TEST-ACCT-${suffix}-A`, userId: userA.id } }),
    prisma.order.create({ data: { ...baseOrder, orderNumber: `TEST-ACCT-${suffix}-B`, userId: userB.id } }),
  ]);

  wishlistA = await prisma.wishlist.create({ data: { userId: userA.id, productId: product.id } });

  [notificationA, notificationB] = await Promise.all([
    prisma.notification.create({
      data: { userId: userA.id, type: 'order', title: 'Order shipped', body: 'Your order is on the way.' },
    }),
    prisma.notification.create({
      data: { userId: userB.id, type: 'order', title: 'Order shipped', body: 'Your order is on the way.' },
    }),
  ]);

  tryOnA = await prisma.tryOnLog.create({
    data: { userId: userA.id, productName: product.name, success: true, provider: 'test' },
  });
});

afterAll(async () => {
  await prisma.tryOnLog.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
  await prisma.notification.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
  await prisma.wishlist.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
  await prisma.order.deleteMany({ where: { id: { in: [orderA.id, orderB.id] } } });
  await prisma.product.delete({ where: { id: product.id } });
  await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
  await prisma.$disconnect();
});

describe('routes/account.js — Customer Portal API', () => {
  it('GET /dashboard returns only the requesting user\'s counts, matching real fixture data', async () => {
    const res = await agentAs(userA.id).get('/api/account/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.data.stats.orders).toBe(1);
    expect(res.body.data.stats.wishlist).toBe(1);
    expect(res.body.data.stats.tryOns).toBe(1);
    expect(res.body.data.profile._id).toBe(userA.id);
    expect(res.body.data.recommendations).toEqual([]);
  });

  it('GET /orders only returns the requesting user\'s orders (cross-user isolation)', async () => {
    const res = await agentAs(userA.id).get('/api/account/orders');
    expect(res.status).toBe(200);
    expect(res.body.data.map((o) => o._id)).toContain(orderA.id);
    expect(res.body.data.map((o) => o._id)).not.toContain(orderB.id);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 10 });
  });

  it('GET /orders/:orderNumber 404s when the order belongs to a different user', async () => {
    const res = await agentAs(userA.id).get(`/api/account/orders/${orderB.orderNumber}`);
    expect(res.status).toBe(404);
  });

  it('GET /orders/:orderNumber succeeds for the order\'s own owner', async () => {
    const res = await agentAs(userB.id).get(`/api/account/orders/${orderB.orderNumber}`);
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(orderB.id);
  });

  it('GET /try-ons only returns the requesting user\'s try-on history', async () => {
    const resA = await agentAs(userA.id).get('/api/account/try-ons');
    const resB = await agentAs(userB.id).get('/api/account/try-ons');
    expect(resA.body.data.map((t) => t._id)).toContain(tryOnA.id);
    expect(resB.body.data.map((t) => t._id)).not.toContain(tryOnA.id);
  });

  it('wishlist add is idempotent and scoped per user', async () => {
    const addAgain = await agentAs(userA.id).post(`/api/account/wishlist/${product.id}`);
    expect(addAgain.status).toBe(201);

    const count = await prisma.wishlist.count({ where: { userId: userA.id, productId: product.id } });
    expect(count).toBe(1); // still one row, not duplicated

    const resB = await agentAs(userB.id).get('/api/account/wishlist');
    expect(resB.body.data).toHaveLength(0); // userB never added anything
  });

  it('wishlist remove only affects the requesting user\'s row', async () => {
    const res = await agentAs(userA.id).delete(`/api/account/wishlist/${product.id}`);
    expect(res.status).toBe(200);

    const remaining = await prisma.wishlist.count({ where: { userId: userA.id, productId: product.id } });
    expect(remaining).toBe(0);

    // restore for dashboard test isolation in case test order changes
    await prisma.wishlist.create({ data: { userId: userA.id, productId: product.id } }).catch(() => {});
  });

  it('GET /notifications only returns the requesting user\'s notifications', async () => {
    const res = await agentAs(userA.id).get('/api/account/notifications');
    expect(res.body.data.map((n) => n._id)).toContain(notificationA.id);
    expect(res.body.data.map((n) => n._id)).not.toContain(notificationB.id);
  });

  it('PATCH /notifications/read cannot mark another user\'s notification as read', async () => {
    const res = await agentAs(userA.id).patch('/api/account/notifications/read').send({ ids: [notificationB.id] });
    expect(res.status).toBe(200);
    expect(res.body.data.updated).toBe(0);

    const stillUnread = await prisma.notification.findUnique({ where: { id: notificationB.id } });
    expect(stillUnread.read).toBe(false);
  });

  it('PATCH /notifications/read marks the requesting user\'s own notification as read', async () => {
    const res = await agentAs(userA.id).patch('/api/account/notifications/read').send({ ids: [notificationA.id] });
    expect(res.body.data.updated).toBe(1);

    const updated = await prisma.notification.findUnique({ where: { id: notificationA.id } });
    expect(updated.read).toBe(true);
    expect(updated.readAt).not.toBeNull();
  });

  it('GET /organizations returns an empty array when no purchases are org-linked (no fake data)', async () => {
    const res = await agentAs(userA.id).get('/api/account/organizations');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('GET /profile and GET /security return real fields for the requesting user only', async () => {
    const profile = await agentAs(userA.id).get('/api/account/profile');
    expect(profile.body.data._id).toBe(userA.id);
    expect(profile.body.data.email).toBe(userA.email);

    const security = await agentAs(userA.id).get('/api/account/security');
    expect(security.body.data.authProvider).toBe('local');
    expect(security.body.data).not.toHaveProperty('activeSessions'); // not built yet — honestly absent
  });

  it('PUT /profile updates only the requesting user', async () => {
    const res = await agentAs(userA.id).put('/api/account/profile').send({ firstName: 'Annette', lastName: 'Aquino' });
    expect(res.status).toBe(200);
    expect(res.body.data.firstName).toBe('Annette');

    const untouched = await prisma.user.findUnique({ where: { id: userB.id } });
    expect(untouched.firstName).toBe('Ben');
  });
});
