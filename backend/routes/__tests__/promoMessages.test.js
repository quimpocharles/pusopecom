import { describe, it, expect, vi, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => { req.user = { _id: 'test-admin', role: 'admin' }; next(); },
  isAdmin: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
}));

const { default: promoMessagesRouter } = await import('../promoMessages.js');

const app = express();
app.use(express.json());
app.use('/api/promo-messages', promoMessagesRouter);

let createdId;

afterAll(async () => {
  if (createdId) {
    await prisma.promoMessage.delete({ where: { id: createdId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe('routes/promoMessages.js', () => {
  it('POST / creates a promo message', async () => {
    const res = await request(app).post('/api/promo-messages').send({
      placement: 'marquee',
      text: 'Free shipping on orders ₱2,000 and above',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.placement).toBe('marquee');
    createdId = res.body.data._id;
  });

  it('GET /?placement=marquee returns only that placement, active only', async () => {
    const res = await request(app).get('/api/promo-messages').query({ placement: 'marquee' });
    expect(res.status).toBe(200);
    expect(res.body.data.every((m) => m.placement === 'marquee')).toBe(true);
    expect(res.body.data.some((m) => m._id === createdId)).toBe(true);
  });

  it('GET /?placement=announcement excludes the marquee-only message just created', async () => {
    const res = await request(app).get('/api/promo-messages').query({ placement: 'announcement' });
    expect(res.status).toBe(200);
    expect(res.body.data.some((m) => m._id === createdId)).toBe(false);
  });

  it('GET /admin/all includes inactive messages', async () => {
    await request(app).delete(`/api/promo-messages/${createdId}`);
    const res = await request(app).get('/api/promo-messages/admin/all');
    expect(res.status).toBe(200);
    expect(res.body.data.some((m) => m._id === createdId)).toBe(true);
  });

  it('PUT /:id on a nonexistent id returns 404', async () => {
    const res = await request(app).put('/api/promo-messages/00000000-0000-0000-0000-000000000000').send({ text: 'x' });
    expect(res.status).toBe(404);
  });
});
