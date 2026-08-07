import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => { req.user = { _id: 'test-admin', role: 'admin' }; next(); },
  isAdmin: (req, res, next) => next(),
  requirePermission: () => (req, res, next) => next(),
  requireAnyPermission: () => (req, res, next) => next(),
}));

const { default: couriersRouter } = await import('../couriers.js');

const app = express();
app.use(express.json());
app.use('/api/admin/couriers', couriersRouter);

describe('GET /admin/couriers', () => {
  it('self-heals the default manual account and lists it', async () => {
    const res = await request(app).get('/api/admin/couriers');
    expect(res.status).toBe(200);
    expect(res.body.data.some((a) => a.courierName === 'manual')).toBe(true);
  });
});

describe('POST /admin/couriers', () => {
  it('rejects a courierName with no matching courierService gateway', async () => {
    const res = await request(app).post('/api/admin/couriers').send({ courierName: 'jnt', displayName: 'J&T Express' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no matching courierService gateway/);
  });

  it('rejects creating a duplicate account for an already-registered courierName', async () => {
    await prisma.courierAccount.deleteMany({ where: { courierName: 'manual', displayName: { not: 'Manual / Self-Arranged' } } });
    const res = await request(app).post('/api/admin/couriers').send({ courierName: 'manual', displayName: 'Manual (duplicate)' });
    expect(res.status).toBe(409);
  });
});
