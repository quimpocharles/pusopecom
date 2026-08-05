import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

// Unlike every other route test file, middleware/auth.js is NOT mocked here
// — this suite is the one place that actually exercises the real
// authenticate/isAdmin/optionalAuth chain end-to-end (register, log in,
// carry the real JWT into protected routes), since verifying that chain
// itself is step 4's entire point.
vi.mock('../../services/emailService.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

const { default: authRouter } = await import('../auth.js');
const emailService = await import('../../services/emailService.js');

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

const testEmails = [];
const uniqueEmail = (label) => {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  testEmails.push(email);
  return email;
};

afterAll(async () => {
  // Address rows cascade-delete with their user (onDelete: Cascade).
  await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
  await prisma.$disconnect();
});

describe('routes/auth.js', () => {
  describe('register -> verify -> login', () => {
    const email = uniqueEmail('register-flow');
    const password = 'correct-horse-battery';

    it('POST /register creates an unverified user and sends a verification email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email, password, firstName: 'Juan', lastName: 'Dela Cruz' });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe(email);
      expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(email, 'Juan', expect.any(String));
    }, 15000);

    it('POST /login rejects before the email is verified', async () => {
      const res = await request(app).post('/api/auth/login').send({ email, password });
      expect(res.status).toBe(403);
      expect(res.body.emailVerified).toBe(false);
    }, 15000);

    it('GET /verify-email with the token from registration, then POST /login succeeds and returns a usable JWT', async () => {
      const token = emailService.sendVerificationEmail.mock.calls[0][2];

      const verifyRes = await request(app).get(`/api/auth/verify-email?token=${token}`);
      expect(verifyRes.status).toBe(200);

      const loginRes = await request(app).post('/api/auth/login').send({ email, password });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.token).toBeTypeOf('string');
      expect(loginRes.body.user.email).toBe(email);
      expect(loginRes.body.user).not.toHaveProperty('password');

      const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${loginRes.body.token}`);
      expect(meRes.status).toBe(200);
      expect(meRes.body.user.email).toBe(email);
      expect(meRes.body.user).not.toHaveProperty('password'); // sanitize() ran inside authenticate
    }, 15000);

    it('POST /login locks the account after 5 wrong passwords, matching the original lockout threshold', async () => {
      for (let i = 0; i < 4; i++) {
        const res = await request(app).post('/api/auth/login').send({ email, password: 'wrong' });
        expect(res.status).toBe(401);
        expect(res.body.accountLocked).toBeUndefined();
      }
      const fifth = await request(app).post('/api/auth/login').send({ email, password: 'wrong' });
      expect(fifth.status).toBe(401);
      expect(fifth.body.accountLocked).toBe(true);

      const withCorrectPassword = await request(app).post('/api/auth/login').send({ email, password });
      expect(withCorrectPassword.status).toBe(403);
      expect(withCorrectPassword.body.accountLocked).toBe(true);
    }, 20000);
  });

  describe('Fit Check guest session migration', () => {
    it('re-parents a guest\'s Fit Checks into the new account on registration', async () => {
      const suffix = Date.now();
      const sessionId = `test-guest-session-${suffix}`;
      const product = await prisma.product.create({
        data: {
          name: 'Auth Migration Test Jersey',
          slug: `auth-migration-test-jersey-${suffix}`,
          description: 'fixture',
          price: 500,
          category: 'jersey',
          sport: 'basketball',
          images: [],
          active: true,
        },
      });
      const guestTryOn = await prisma.tryOnLog.create({
        data: { sessionId, productId: product.id, productName: product.name, success: true, provider: 'test' },
      });

      const email = uniqueEmail('guest-migration');
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email, password: 'correct-horse-battery', firstName: 'Bea', lastName: 'Reyes', sessionId });
      expect(res.status).toBe(201);

      // Migration runs fire-and-forget after the response — poll briefly
      // rather than assuming it's already committed.
      let migrated = null;
      for (let i = 0; i < 20; i++) {
        migrated = await prisma.tryOnLog.findUnique({ where: { id: guestTryOn.id } });
        if (migrated.userId) break;
        await new Promise((r) => setTimeout(r, 100));
      }

      expect(migrated.userId).toBe(res.body.user.id);
      expect(migrated.sessionId).toBeNull();

      await prisma.tryOnLog.delete({ where: { id: guestTryOn.id } });
      await prisma.product.delete({ where: { id: product.id } });
    }, 15000);

    it('never re-parents a row a different account already claimed', async () => {
      const suffix = Date.now();
      const sessionId = `test-guest-session-claimed-${suffix}`;

      const otherUser = await prisma.user.create({
        data: { email: uniqueEmail('other-owner'), firstName: 'Other', lastName: 'Owner' },
      });
      const alreadyClaimed = await prisma.tryOnLog.create({
        data: { sessionId, userId: otherUser.id, productName: 'Already Claimed', success: true, provider: 'test' },
      });

      const email = uniqueEmail('guest-migration-conflict');
      await request(app)
        .post('/api/auth/register')
        .send({ email, password: 'correct-horse-battery', firstName: 'Cruz', lastName: 'Santos', sessionId });

      await new Promise((r) => setTimeout(r, 300)); // let the fire-and-forget migration attempt run
      const untouched = await prisma.tryOnLog.findUnique({ where: { id: alreadyClaimed.id } });
      expect(untouched.userId).toBe(otherUser.id); // still the original owner, not silently reassigned

      await prisma.tryOnLog.delete({ where: { id: alreadyClaimed.id } });
    }, 15000);
  });

  describe('Fit Check bonus grants (Phase 2)', () => {
    it('GET /verify-email grants the email-verified bonus exactly once', async () => {
      const email = uniqueEmail('bonus-email-verified');
      await request(app)
        .post('/api/auth/register')
        .send({ email, password: 'correct-horse-battery', firstName: 'Bonus', lastName: 'Verify' });
      const token = emailService.sendVerificationEmail.mock.calls.at(-1)[2];

      const verifyRes = await request(app).get(`/api/auth/verify-email?token=${token}`);
      expect(verifyRes.status).toBe(200);

      // Fire-and-forget, same as the guest migration above — poll briefly.
      let grant = null;
      for (let i = 0; i < 20; i++) {
        grant = await prisma.bonusFitCheckGrant.findFirst({ where: { user: { email }, reason: 'email_verified' } });
        if (grant) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      expect(grant).not.toBeNull();
      expect(grant.amount).toBeGreaterThan(0);

      // Re-verifying (e.g. a stale link opened twice) must never double-grant.
      await request(app).get(`/api/auth/verify-email?token=${token}`);
      await new Promise((r) => setTimeout(r, 300));
      const grants = await prisma.bonusFitCheckGrant.findMany({ where: { user: { email }, reason: 'email_verified' } });
      expect(grants).toHaveLength(1);
    }, 15000);

    it('PUT /complete-profile grants the profile-complete bonus only once both phone and an address are present', async () => {
      const email = uniqueEmail('bonus-profile-complete');
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({ email, password: 'correct-horse-battery', firstName: 'Bonus', lastName: 'Profile' });
      const token = emailService.sendVerificationEmail.mock.calls.at(-1)[2];
      await request(app).get(`/api/auth/verify-email?token=${token}`);
      const loginRes = await request(app).post('/api/auth/login').send({ email, password: 'correct-horse-battery' });
      const auth = `Bearer ${loginRes.body.token}`;
      const userId = registerRes.body.user.id;

      // Phone only — not a complete profile yet, no bonus.
      await request(app).put('/api/auth/complete-profile').set('Authorization', auth).send({ phone: '09171234567' });
      await new Promise((r) => setTimeout(r, 300));
      expect(await prisma.bonusFitCheckGrant.findFirst({ where: { userId, reason: 'profile_complete' } })).toBeNull();

      // Now add the address too — profile is genuinely complete.
      await request(app)
        .put('/api/auth/complete-profile')
        .set('Authorization', auth)
        .send({
          address: {
            fullName: 'Bonus Profile', phone: '09171234567', country: 'Philippines',
            address: '123 Test St', city: 'Quezon City', province: 'Metro Manila', zipCode: '1100', isDefault: true,
          },
        });

      let grant = null;
      for (let i = 0; i < 20; i++) {
        grant = await prisma.bonusFitCheckGrant.findFirst({ where: { userId, reason: 'profile_complete' } });
        if (grant) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      expect(grant).not.toBeNull();
    }, 15000);
  });

  describe('forgot-password -> reset-password', () => {
    it('resets the password, clears the lockout, and lets the new password log in', async () => {
      const email = uniqueEmail('reset-flow');
      const oldPassword = 'original-password';
      const newPassword = 'brand-new-password';

      await request(app).post('/api/auth/register').send({ email, password: oldPassword, firstName: 'Maria', lastName: 'Santos' });
      const verifyToken = emailService.sendVerificationEmail.mock.calls.at(-1)[2];
      await request(app).get(`/api/auth/verify-email?token=${verifyToken}`);

      const forgotRes = await request(app).post('/api/auth/forgot-password').send({ email });
      expect(forgotRes.status).toBe(200);
      const resetToken = emailService.sendPasswordResetEmail.mock.calls.at(-1)[2];

      const resetRes = await request(app).post('/api/auth/reset-password').send({ token: resetToken, password: newPassword });
      expect(resetRes.status).toBe(200);

      const oldLoginRes = await request(app).post('/api/auth/login').send({ email, password: oldPassword });
      expect(oldLoginRes.status).toBe(401);

      const newLoginRes = await request(app).post('/api/auth/login').send({ email, password: newPassword });
      expect(newLoginRes.status).toBe(200);
    }, 20000);

    it('POST /forgot-password returns success even for an unknown email, without leaking whether it exists', async () => {
      const res = await request(app).post('/api/auth/forgot-password').send({ email: 'definitely-not-registered@test.local' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /reset-password rejects an unknown or expired token', async () => {
      const res = await request(app).post('/api/auth/reset-password').send({ token: 'not-a-real-token', password: 'whatever123' });
      expect(res.status).toBe(400);
    });
  });

  describe('addresses', () => {
    let token;
    let otherToken;

    beforeAll(async () => {
      const email = uniqueEmail('address-owner');
      const otherEmail = uniqueEmail('address-attacker');

      await request(app).post('/api/auth/register').send({ email, password: 'password123', firstName: 'Owner', lastName: 'User' });
      const ownerVerifyToken = emailService.sendVerificationEmail.mock.calls.at(-1)[2];
      await request(app).get(`/api/auth/verify-email?token=${ownerVerifyToken}`);
      const ownerLogin = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
      token = ownerLogin.body.token;

      await request(app).post('/api/auth/register').send({ email: otherEmail, password: 'password123', firstName: 'Other', lastName: 'User' });
      const otherVerifyToken = emailService.sendVerificationEmail.mock.calls.at(-1)[2];
      await request(app).get(`/api/auth/verify-email?token=${otherVerifyToken}`);
      const otherLogin = await request(app).post('/api/auth/login').send({ email: otherEmail, password: 'password123' });
      otherToken = otherLogin.body.token;
    }, 20000);

    const address = {
      fullName: 'Owner User',
      phone: '09171234567',
      address: '123 Rizal St',
      city: 'Quezon City',
      province: 'Metro Manila',
      zipCode: '1100',
      isDefault: true,
    };

    it('POST /addresses adds an address for the authenticated user', async () => {
      const res = await request(app).post('/api/auth/addresses').set('Authorization', `Bearer ${token}`).send(address);
      expect(res.status).toBe(200);
      expect(res.body.addresses).toHaveLength(1);
      expect(res.body.addresses[0]._id).toBeTypeOf('string');
    }, 15000);

    it('PUT /addresses/:id from a different user 404s and leaves the address untouched (ownership check)', async () => {
      const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      const addressId = me.body.user.addresses[0]._id;

      const res = await request(app)
        .put(`/api/auth/addresses/${addressId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ city: 'Hijacked City' });
      expect(res.status).toBe(404);

      const meAfter = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(meAfter.body.user.addresses[0].city).toBe('Quezon City');
    }, 15000);

    it('PUT /addresses/:id updates the address for its actual owner', async () => {
      const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      const addressId = me.body.user.addresses[0]._id;

      const res = await request(app)
        .put(`/api/auth/addresses/${addressId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ city: 'Makati City' });
      expect(res.status).toBe(200);
      expect(res.body.addresses[0].city).toBe('Makati City');
    }, 15000);

    it('DELETE /addresses/:id from a different user 404s, then the real owner can delete it', async () => {
      const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      const addressId = me.body.user.addresses[0]._id;

      const wrongDelete = await request(app).delete(`/api/auth/addresses/${addressId}`).set('Authorization', `Bearer ${otherToken}`);
      expect(wrongDelete.status).toBe(404);

      const rightDelete = await request(app).delete(`/api/auth/addresses/${addressId}`).set('Authorization', `Bearer ${token}`);
      expect(rightDelete.status).toBe(200);
      expect(rightDelete.body.addresses).toHaveLength(0);
    }, 15000);
  });

  describe('Google OAuth', () => {
    const googleEmail = () => uniqueEmail('google-oauth');

    it('POST /google creates a new user from a first-time Google login', async () => {
      const email = googleEmail();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ sub: `google-${Date.now()}`, email, given_name: 'Gil', family_name: 'Puyat', picture: 'https://example.com/avatar.jpg' }),
      }));

      const res = await request(app).post('/api/auth/google').send({ credential: 'fake-google-credential' });
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(email);
      expect(res.body.user.authProvider).toBe('google');
      expect(res.body.user.emailVerified).toBe(true);

      vi.unstubAllGlobals();
    }, 15000);

    it('POST /google logs an existing user back in and updates their avatar', async () => {
      const email = googleEmail();
      const googleId = `google-${Date.now()}`;

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ sub: googleId, email, given_name: 'Gil', family_name: 'Puyat', picture: 'https://example.com/first.jpg' }),
      }));
      const firstRes = await request(app).post('/api/auth/google').send({ credential: 'fake' });
      const firstToken = firstRes.body.token;

      // jwt's `iat` claim only has second-level granularity, and it's the
      // only field that varies between these two tokens — without this,
      // two logins landing in the same wall-clock second produce identical
      // tokens and the "fresh token" assertion below flakes.
      await new Promise((r) => setTimeout(r, 1100));

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ sub: googleId, email, given_name: 'Gil', family_name: 'Puyat', picture: 'https://example.com/second.jpg' }),
      }));
      const secondRes = await request(app).post('/api/auth/google').send({ credential: 'fake' });

      expect(secondRes.status).toBe(200);
      expect(secondRes.body.user.email).toBe(email);
      expect(secondRes.body.token).not.toBe(firstToken); // a fresh token each login, same underlying user
      expect(secondRes.body.user.avatar).toBe('https://example.com/second.jpg');

      vi.unstubAllGlobals();
    }, 15000);

    it('POST /google fails cleanly when Google rejects the token', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
      const res = await request(app).post('/api/auth/google').send({ credential: 'invalid' });
      expect(res.status).toBe(401);
      vi.unstubAllGlobals();
    });
  });

  describe('admin/users', () => {
    let adminToken;
    let customerToken;

    beforeAll(async () => {
      const adminEmail = uniqueEmail('admin-user');
      const customerEmail = uniqueEmail('customer-user');

      await request(app).post('/api/auth/register').send({ email: adminEmail, password: 'password123', firstName: 'Admin', lastName: 'User' });
      const adminVerifyToken = emailService.sendVerificationEmail.mock.calls.at(-1)[2];
      await request(app).get(`/api/auth/verify-email?token=${adminVerifyToken}`);
      await prisma.user.update({ where: { email: adminEmail }, data: { role: 'admin' } });
      const adminLogin = await request(app).post('/api/auth/login').send({ email: adminEmail, password: 'password123' });
      adminToken = adminLogin.body.token;

      await request(app).post('/api/auth/register').send({ email: customerEmail, password: 'password123', firstName: 'Regular', lastName: 'Customer' });
      const customerVerifyToken = emailService.sendVerificationEmail.mock.calls.at(-1)[2];
      await request(app).get(`/api/auth/verify-email?token=${customerVerifyToken}`);
      const customerLogin = await request(app).post('/api/auth/login').send({ email: customerEmail, password: 'password123' });
      customerToken = customerLogin.body.token;
    }, 20000);

    it('rejects a non-admin with 403', async () => {
      const res = await request(app).get('/api/auth/admin/users').set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('lets an admin list users, paginated, with sensitive fields stripped', async () => {
      const res = await request(app).get('/api/auth/admin/users?limit=5').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
      expect(res.body.pagination).toHaveProperty('total');
      for (const user of res.body.data) {
        expect(user).not.toHaveProperty('password');
        expect(user).not.toHaveProperty('verificationToken');
      }
    }, 15000);

    it('filters by search term across name and email', async () => {
      const res = await request(app)
        .get(`/api/auth/admin/users?search=${encodeURIComponent('Admin')}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.some((u) => u.firstName === 'Admin')).toBe(true);
    }, 15000);
  });
});
