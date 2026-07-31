import { describe, it, expect, vi, afterAll, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

const testUser = { _id: 'test-reviewer', email: 'reviewer@test.local', firstName: 'Test', lastName: 'Reviewer' };

vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => { req.user = testUser; next(); },
  isAdmin: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
}));

const { default: reviewsRouter } = await import('../reviews.js');

const app = express();
app.use(express.json());
app.use('/api/products', reviewsRouter); // matches server.js's real mount path

let testProduct;
beforeAll(async () => {
  testProduct = await prisma.product.create({
    data: {
      name: `Review Route Test Product ${Date.now()}`,
      slug: `review-route-test-${Date.now()}`,
      description: 'x', price: 500, category: 'jersey', sport: 'basketball', images: [], active: true,
    },
  });
});

afterAll(async () => {
  await prisma.review.deleteMany({ where: { productId: testProduct.id } });
  await prisma.product.delete({ where: { id: testProduct.id } });
  await prisma.$disconnect();
});

describe('routes/reviews.js', () => {
  it('GET /:slug/reviews 404s for an unknown or inactive product slug', async () => {
    const res = await request(app).get('/api/products/not-a-real-slug/reviews');
    expect(res.status).toBe(404);
  });

  it('GET /:slug/reviews returns an empty list with a zeroed rating distribution before any reviews exist', async () => {
    const res = await request(app).get(`/api/products/${testProduct.slug}/reviews`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.summary.distribution).toEqual({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
  });

  it('POST /:slug/reviews rejects an out-of-range rating', async () => {
    const res = await request(app).post(`/api/products/${testProduct.slug}/reviews`).send({ rating: 7 });
    expect(res.status).toBe(400);
  });

  it('POST /:slug/reviews creates a review, then GET reflects it with correct stats and no leaked email', async () => {
    const create = await request(app)
      .post(`/api/products/${testProduct.slug}/reviews`)
      .send({ rating: 5, title: 'Great fit', body: 'Loved it' });

    expect(create.status).toBe(201);
    expect(create.body.data._id).toBeTypeOf('string');
    expect(create.body.data.author).toBe('Test R.'); // firstName + last-initial, matching the original format

    const list = await request(app).get(`/api/products/${testProduct.slug}/reviews`);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).not.toHaveProperty('email'); // privacy: stripped from the public listing
    expect(list.body.summary.avgRating).toBe(5);
    expect(list.body.summary.reviewCount).toBe(1);
    expect(list.body.summary.distribution).toEqual({ 5: 1, 4: 0, 3: 0, 2: 0, 1: 0 });

    // recalcStats side effect actually persisted onto the Product row
    const product = await prisma.product.findUnique({ where: { id: testProduct.id } });
    expect(product.avgRating).toBe(5);
    expect(product.reviewCount).toBe(1);
  }, 15000); // heaviest test in this file: create + recalcStats (aggregate + update) + a full GET (find + count + groupBy) + a verification read — ~7 round trips in one test

  it('POST /:slug/reviews rejects a second review from the same user with a specific message (P2002 translated)', async () => {
    const res = await request(app)
      .post(`/api/products/${testProduct.slug}/reviews`)
      .send({ rating: 3 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already reviewed/i);
  });

  it('GET /reviews/my returns the product ids the current user has reviewed, as bare strings', async () => {
    const res = await request(app).get('/api/products/reviews/my');
    expect(res.status).toBe(200);
    expect(res.body.data).toContain(testProduct.id);
  });
});
