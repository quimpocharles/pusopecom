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

const { default: partnerLogosRouter } = await import('../partnerLogos.js');

const app = express();
app.use(express.json());
app.use('/api/partner-logos', partnerLogosRouter);

const createdIds = [];

afterAll(async () => {
  await prisma.partnerLogo.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.$disconnect();
});

describe('routes/partnerLogos.js', () => {
  it('POST / creates a logo', async () => {
    const res = await request(app).post('/api/partner-logos').send({
      name: 'Test League', logoUrl: 'https://res.cloudinary.com/test.png', priority: 1,
    });
    expect(res.status).toBe(201);
    createdIds.push(res.body.data._id);
  });

  it('GET / returns only active logos, ordered by priority desc', async () => {
    const low = await request(app).post('/api/partner-logos').send({ name: 'Low', logoUrl: 'x.png', priority: 0 });
    const high = await request(app).post('/api/partner-logos').send({ name: 'High', logoUrl: 'x.png', priority: 10 });
    const inactive = await request(app).post('/api/partner-logos').send({ name: 'Inactive', logoUrl: 'x.png', active: false });
    createdIds.push(low.body.data._id, high.body.data._id, inactive.body.data._id);

    const res = await request(app).get('/api/partner-logos');
    expect(res.status).toBe(200);
    const ids = res.body.data.map((l) => l._id);
    expect(ids).not.toContain(inactive.body.data._id);
    expect(ids.indexOf(high.body.data._id)).toBeLessThan(ids.indexOf(low.body.data._id));
  }, 15000);

  it('GET /admin/all includes inactive logos', async () => {
    const res = await request(app).get('/api/partner-logos/admin/all');
    expect(res.status).toBe(200);
    expect(res.body.data.some((l) => l.name === 'Inactive')).toBe(true);
  });

  it('PUT /:id updates fields, DELETE soft-deletes', async () => {
    const put = await request(app).put(`/api/partner-logos/${createdIds[0]}`).send({ destinationUrl: 'https://example.com' });
    expect(put.status).toBe(200);
    expect(put.body.data.destinationUrl).toBe('https://example.com');

    const del = await request(app).delete(`/api/partner-logos/${createdIds[0]}`);
    expect(del.status).toBe(200);
    const logo = await prisma.partnerLogo.findUnique({ where: { id: createdIds[0] } });
    expect(logo.active).toBe(false);
  });
});
