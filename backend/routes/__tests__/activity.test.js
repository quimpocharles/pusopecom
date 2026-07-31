import { describe, it, expect, vi, afterAll, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => next(),
  isAdmin: (req, res, next) => next(),
  optionalAuth: (req, res, next) => { req.user = { _id: 'test-user-activity' }; next(); },
}));

const { default: activityRouter } = await import('../activity.js');

const app = express();
app.use(express.json());
app.use('/api/activity', activityRouter);

let testProduct;
beforeAll(async () => {
  // UserActivity.userId is a real foreign key now (Mongoose's `ref` never
  // enforced this) — the mocked optionalAuth below sets req.user._id to
  // this exact literal, so a matching User row has to actually exist or
  // every write 500s on a foreign-key violation, not a bug in the route.
  await prisma.user.upsert({
    where: { id: 'test-user-activity' },
    create: { id: 'test-user-activity', email: 'activity-test@test.local', firstName: 'Activity', lastName: 'Tester' },
    update: {},
  });
  testProduct = await prisma.product.create({
    data: {
      name: `Activity Test Product ${Date.now()}`,
      slug: `activity-test-${Date.now()}`,
      description: 'x', price: 500, category: 'jersey', sport: 'basketball', images: [], totalViews: 0,
    },
  });
});

afterAll(async () => {
  await prisma.userActivity.deleteMany({ where: { productId: testProduct.id } });
  await prisma.product.delete({ where: { id: testProduct.id } });
  await prisma.user.delete({ where: { id: 'test-user-activity' } });
  await prisma.$disconnect();
});

describe('routes/activity.js', () => {
  it('POST /view requires productId', async () => {
    const res = await request(app).post('/api/activity/view').send({});
    expect(res.status).toBe(400);
  });

  it('POST /view returns 404 for a product that does not exist', async () => {
    const res = await request(app)
      .post('/api/activity/view')
      .send({ productId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(404);
  });

  it('POST /view logs the activity (with userId, not the Mongoose "user" field name) and increments totalViews', async () => {
    const res = await request(app).post('/api/activity/view').send({ productId: testProduct.id });
    expect(res.status).toBe(200);

    const logged = await prisma.userActivity.findFirst({ where: { productId: testProduct.id, type: 'view' } });
    expect(logged).not.toBeNull();
    expect(logged.userId).toBe('test-user-activity');
    expect(logged.category).toBe(testProduct.category);
    expect(logged.sport).toBe(testProduct.sport);

    const updated = await prisma.product.findUnique({ where: { id: testProduct.id } });
    expect(updated.totalViews).toBe(1);
  }, 15000); // 4 sequential round trips; newly flaky under today's elevated Railway latency (verified via a direct SELECT 1 timing check, not a code issue)

  it('POST /search requires a non-empty query', async () => {
    const empty = await request(app).post('/api/activity/search').send({ query: '   ' });
    expect(empty.status).toBe(400);

    const missing = await request(app).post('/api/activity/search').send({});
    expect(missing.status).toBe(400);
  });

  it('POST /search logs a trimmed query', async () => {
    const res = await request(app).post('/api/activity/search').send({ query: '  Gilas jersey  ' });
    expect(res.status).toBe(200);

    const logged = await prisma.userActivity.findFirst({
      where: { type: 'search', userId: 'test-user-activity' },
      orderBy: { timestamp: 'desc' },
    });
    expect(logged.query).toBe('Gilas jersey');
  });
});
