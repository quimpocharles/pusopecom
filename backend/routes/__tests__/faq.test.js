import { describe, it, expect, vi, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => { req.user = { _id: 'test-admin', role: 'admin' }; next(); },
  isAdmin: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
  requirePermission: () => (req, res, next) => next(),
  requireAnyPermission: () => (req, res, next) => next(),
}));

const { default: faqRouter } = await import('../faq.js');

const app = express();
app.use(express.json());
app.use('/api/faq', faqRouter);

let createdId;

afterAll(async () => {
  if (createdId) {
    await prisma.fAQItem.delete({ where: { id: createdId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe('routes/faq.js', () => {
  it('POST / creates an FAQ item', async () => {
    const res = await request(app).post('/api/faq').send({
      question: 'Do you ship internationally?',
      answer: 'Yes, worldwide.',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.question).toBe('Do you ship internationally?');
    createdId = res.body.data._id;
  });

  it('GET / returns only active items, ordered by displayOrder', async () => {
    const res = await request(app).get('/api/faq');
    expect(res.status).toBe(200);
    expect(res.body.data.some((f) => f._id === createdId)).toBe(true);
    for (let i = 1; i < res.body.data.length; i++) {
      expect(res.body.data[i].displayOrder).toBeGreaterThanOrEqual(res.body.data[i - 1].displayOrder);
    }
  });

  it('GET /admin/all includes inactive items', async () => {
    await request(app).delete(`/api/faq/${createdId}`);
    const res = await request(app).get('/api/faq/admin/all');
    expect(res.status).toBe(200);
    expect(res.body.data.some((f) => f._id === createdId)).toBe(true);

    const publicRes = await request(app).get('/api/faq');
    expect(publicRes.body.data.some((f) => f._id === createdId)).toBe(false);
  });

  it('PUT /:id on a nonexistent id returns 404', async () => {
    const res = await request(app).put('/api/faq/00000000-0000-0000-0000-000000000000').send({ answer: 'x' });
    expect(res.status).toBe(404);
  });
});
