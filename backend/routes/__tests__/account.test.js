import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

// GET /home does 2-3 sequential waves of parallel queries (base signals,
// then followed-org products, then a trending fallback if needed) against
// the real remote dev database, plus a real Redis round trip — the default
// 5s test timeout is comfortably enough for every other route in this file
// but flakes on this one under this environment's real network latency.
// Confirmed via isolated re-run: ~16s to genuinely complete, not a hang.
vi.setConfig({ testTimeout: 20000 });

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

let userA, userB, userC, organization, product, orderA, orderB, wishlistA, notificationA, notificationB, tryOnA;

beforeAll(async () => {
  const suffix = Date.now();

  [userA, userB, userC] = await Promise.all([
    prisma.user.create({
      data: { email: `acct-test-a-${suffix}@example.com`, firstName: 'Ann', lastName: 'Aquino' },
    }),
    prisma.user.create({
      data: { email: `acct-test-b-${suffix}@example.com`, firstName: 'Ben', lastName: 'Bautista' },
    }),
    // Genuinely zero activity — no orders, try-ons, wishlist, or follows —
    // the fixture for the Home feed's fallback-filler behavior.
    prisma.user.create({
      data: { email: `acct-test-c-${suffix}@example.com`, firstName: 'Cora', lastName: 'Cruz' },
    }),
  ]);

  organization = await prisma.organization.create({
    data: { name: `Test University ${suffix}`, slug: `test-university-${suffix}`, kind: 'institution' },
  });

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
  const userIds = [userA.id, userB.id, userC.id];
  await prisma.tryOnLog.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.wishlist.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.follow.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.order.deleteMany({ where: { id: { in: [orderA.id, orderB.id] } } });
  await prisma.product.delete({ where: { id: product.id } });
  await prisma.organization.delete({ where: { id: organization.id } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe('routes/account.js — Customer Portal API', () => {
  it('GET /home returns feed moments built from the requesting user\'s own real activity', async () => {
    const res = await agentAs(userA.id).get('/api/account/home');
    expect(res.status).toBe(200);
    expect(res.body.data.profile._id).toBe(userA.id);
    expect(res.body.data.recommendations).toEqual([]);

    const types = res.body.data.feed.map((m) => m.type);
    expect(types).toContain('order');
    expect(types).toContain('fit-check');
    // userB's order/try-on must never leak into userA's feed
    expect(res.body.data.feed.every((m) => !String(m.body).includes(orderB.orderNumber))).toBe(true);
  });

  it('GET /home never returns an empty feed, even for a user with zero real activity', async () => {
    const res = await agentAs(userC.id).get('/api/account/home');
    expect(res.status).toBe(200);
    expect(res.body.data.feed.length).toBeGreaterThan(0);
    // With no real signals, every moment must be the honest trending fallback
    expect(res.body.data.feed.every((m) => m.type === 'trending')).toBe(true);
  });

  it('following a followed organization\'s recent product surfaces it on Home', async () => {
    await agentAs(userA.id).post(`/api/account/following/${organization.id}`);
    const followedProduct = await prisma.product.create({
      data: {
        name: 'Followed Org Test Jersey',
        slug: `followed-org-test-jersey-${Date.now()}`,
        description: 'fixture',
        price: 1200,
        category: 'jersey',
        sport: 'basketball',
        images: ['https://example.com/followed.jpg'],
        active: true,
        organizationId: organization.id,
      },
    });

    const res = await agentAs(userA.id).get('/api/account/home');
    const followingMoment = res.body.data.feed.find((m) => m.type === 'following');
    expect(followingMoment).toBeDefined();
    expect(followingMoment.body).toBe('Followed Org Test Jersey');

    await prisma.product.delete({ where: { id: followedProduct.id } });
    await agentAs(userA.id).delete(`/api/account/following/${organization.id}`);
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

  it('follow is idempotent and scoped per user', async () => {
    const first = await agentAs(userC.id).post(`/api/account/following/${organization.id}`);
    expect(first.status).toBe(201);
    const again = await agentAs(userC.id).post(`/api/account/following/${organization.id}`);
    expect(again.status).toBe(201);

    const count = await prisma.follow.count({ where: { userId: userC.id, organizationId: organization.id } });
    expect(count).toBe(1); // still one row, not duplicated

    const resA = await agentAs(userA.id).get('/api/account/following');
    expect(resA.body.data.map((f) => f.organization._id)).not.toContain(organization.id); // userA never followed it
  });

  it('unfollow only affects the requesting user\'s row', async () => {
    const res = await agentAs(userC.id).delete(`/api/account/following/${organization.id}`);
    expect(res.status).toBe(200);

    const remaining = await prisma.follow.count({ where: { userId: userC.id, organizationId: organization.id } });
    expect(remaining).toBe(0);
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
