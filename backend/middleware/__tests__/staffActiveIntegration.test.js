import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../../lib/prisma.js';
import { authenticate, isAdmin } from '../auth.js';

// Launch-readiness audit, Fix 3 — the one thing permissionMiddleware.test.js
// can't prove with a hand-built req.user: that authenticate() re-fetches
// StaffProfile fresh from the DB on every request, so an already-issued JWT
// is denied on its very next use once that admin's StaffProfile.active is
// flipped to false — with no re-login and no new token involved. This is a
// real end-to-end request through the REAL authenticate + isAdmin chain
// (neither mocked), against the real dev/test database.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'staff-active-integration-test-secret';

const app = express();
app.get('/protected', authenticate, isAdmin, (req, res) => res.json({ success: true }));

const MARKER = `StaffActiveIntegration${Date.now()}`;
let userId;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { email: `${MARKER}@test.local`, firstName: 'Staff', lastName: 'Active', role: 'admin' },
  });
  userId = user.id;
  await prisma.staffProfile.create({ data: { userId, department: 'operations', active: true } });
}, 15000);

afterAll(async () => {
  await prisma.staffProfile.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

function tokenFor(uid) {
  return jwt.sign({ userId: uid, email: `${MARKER}@test.local` }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

describe('StaffProfile.active — already-issued JWT', () => {
  it('11 & 12 & 14. the SAME unchanged token grants access while active, is denied the moment active=false, and regains access if reactivated', async () => {
    const token = tokenFor(userId);

    const whileActive = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(whileActive.status).toBe(200);

    await prisma.staffProfile.update({ where: { userId }, data: { active: false } });

    // Same token, never reissued, never re-logged-in.
    const whileInactive = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(whileInactive.status).toBe(403);
    expect(whileInactive.body.message).toMatch(/deactivated/i);

    await prisma.staffProfile.update({ where: { userId }, data: { active: true } });

    const reactivated = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(reactivated.status).toBe(200);
  }, 20000);

  it('an admin with no StaffProfile at all is unaffected by this check (bootstrap rule, real DB round trip)', async () => {
    const bootstrapUser = await prisma.user.create({
      data: { email: `${MARKER}-bootstrap@test.local`, firstName: 'No', lastName: 'Profile', role: 'admin' },
    });
    try {
      const token = tokenFor(bootstrapUser.id);
      const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    } finally {
      await prisma.user.deleteMany({ where: { id: bootstrapUser.id } });
    }
  }, 15000);
});
