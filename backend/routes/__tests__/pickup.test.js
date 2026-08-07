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

const { default: pickupRouter } = await import('../pickup.js');

const app = express();
app.use(express.json());
app.use('/api/admin/pickup', pickupRouter);

afterAll(async () => {
  await prisma.$disconnect();
});

const validSlot = {
  venueName: 'Test Venue',
  venueAddress: '123 Test St',
  pickupDate: '2026-08-01',
  pickupHours: '3:00 PM - 9:00 PM',
  pickupStartTime: '15:00',
};

describe('routes/pickup.js', () => {
  it('PUT / rejects a slot missing a required field with a specific message, before touching the database', async () => {
    const res = await request(app)
      .put('/api/admin/pickup')
      .send({ enabled: true, deadlineHours: 6, slots: [{ ...validSlot, venueName: '' }] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/venue name is required/i);
  });

  it('PUT / then GET / round-trips a full config, including nested slots with their own _id', async () => {
    const putRes = await request(app)
      .put('/api/admin/pickup')
      .send({ enabled: true, deadlineHours: 8, slots: [validSlot] });

    expect(putRes.status).toBe(200);
    expect(putRes.body.data.enabled).toBe(true);
    expect(putRes.body.data.deadlineHours).toBe(8);
    expect(putRes.body.data.slots).toHaveLength(1);
    expect(putRes.body.data.slots[0]._id).toBeTypeOf('string');
    expect(putRes.body.data.slots[0].venueName).toBe('Test Venue');

    const getRes = await request(app).get('/api/admin/pickup');
    expect(getRes.body.data.slots).toHaveLength(1);
    expect(getRes.body.data.slots[0].venueName).toBe('Test Venue');
  }, 15000); // upsert() is 3 sequential round trips inside one transaction (delete slots, update config, recreate slots) — slower than a single write, same latency margin as the Product race test

  it('PUT / replaces slots wholesale — a second PUT with fewer slots removes the old ones, not merges', async () => {
    await request(app)
      .put('/api/admin/pickup')
      .send({ enabled: true, deadlineHours: 6, slots: [validSlot, { ...validSlot, venueName: 'Second Venue' }] });

    const res = await request(app)
      .put('/api/admin/pickup')
      .send({ enabled: true, deadlineHours: 6, slots: [validSlot] });

    expect(res.body.data.slots).toHaveLength(1);
    expect(res.body.data.slots[0].venueName).toBe('Test Venue');
  }, 15000); // same 3-round-trip transaction, called twice
});
