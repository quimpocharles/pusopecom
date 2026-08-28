import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

// Launch-readiness audit, "Send Password Setup Email" — dedicated focused
// file. authenticate/isAdmin are mocked (controllable currentUser, same
// convention as staffFounderAuthorization.test.js) so the 403 matrix is
// fast and DB-free; requireFounder stays real (imported via
// vi.importActual from middleware/auth.js — the same shared function
// routes/staff.js now also imports, not a second copy). /login,
// /forgot-password, and /reset-password never call authenticate at all
// (they identify the caller via credentials or a reset token instead), so
// mocking authenticate here has no effect on the real end-to-end cycle
// test 16 exercises.
vi.mock('../../services/emailService.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

let currentUser;

vi.mock('../../middleware/auth.js', async () => {
  const actual = await vi.importActual('../../middleware/auth.js');
  return {
    ...actual,
    authenticate: (req, res, next) => { req.user = currentUser; next(); },
    isAdmin: (req, res, next) => next(),
  };
});

const { default: authRouter } = await import('../auth.js');
const emailService = await import('../../services/emailService.js');

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

const MARKER = `SendPasswordSetupTest${Date.now()}`;
const OLD_FOUNDER_ID = '8b30ff12-5e33-4553-b6a6-9bad88752a17'; // quimpo.charles@gmail.com
const NEW_FOUNDER_ID = 'e682f916-44b1-48ab-971b-799836608c87'; // charles.quimpo@pusostore.com
const CHRIS_ID = 'chris-quimpo-test-id'; // executive, deliberately not a founder id

let dormantAdmin;
let customerUser;
const createdUserIds = [];

function asOldFounder() {
  currentUser = { _id: OLD_FOUNDER_ID, role: 'admin', staffProfile: { department: 'executive', permissions: [] } };
}
function asChris() {
  currentUser = { _id: CHRIS_ID, role: 'admin', staffProfile: { department: 'executive', permissions: [] } };
}
function asDepartment(department) {
  currentUser = { _id: `${department}-test-id`, role: 'admin', staffProfile: { department, permissions: [] } };
}

beforeAll(async () => {
  // Real FK targets for updatedByUserId-style attribution elsewhere in
  // this router's shared fixtures — upserted, never deleted, same
  // persistent-fixture convention staff.test.js and
  // staffFounderAuthorization.test.js already use for these exact ids.
  await prisma.user.upsert({
    where: { id: OLD_FOUNDER_ID },
    create: { id: OLD_FOUNDER_ID, email: `${MARKER.toLowerCase()}-old-founder@test.local`, firstName: 'Old', lastName: 'Founder', role: 'admin' },
    update: {},
  });
  await prisma.user.upsert({
    where: { id: NEW_FOUNDER_ID },
    create: { id: NEW_FOUNDER_ID, email: `${MARKER.toLowerCase()}-new-founder@test.local`, firstName: 'New', lastName: 'Founder', role: 'admin' },
    update: {},
  });

  // Shaped exactly like the real provisioned staff accounts: emailVerified
  // true, no password, no googleId.
  dormantAdmin = await prisma.user.create({
    data: { email: `${MARKER.toLowerCase()}-dormant-admin@test.local`, firstName: 'Dormant', lastName: 'Admin', role: 'admin', emailVerified: true },
  });
  customerUser = await prisma.user.create({
    data: { email: `${MARKER.toLowerCase()}-customer@test.local`, firstName: 'A', lastName: 'Customer', role: 'customer' },
  });
  createdUserIds.push(dormantAdmin.id, customerUser.id);
}, 20000);

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/auth/admin/send-password-setup', () => {
  it('1. the founder can trigger a setup email for a dormant admin', async () => {
    asOldFounder();
    const res = await request(app).post('/api/auth/admin/send-password-setup').send({ userId: dormantAdmin.id });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('2. Chris (executive, not a founder id) gets 403', async () => {
    asChris();
    const res = await request(app).post('/api/auth/admin/send-password-setup').send({ userId: dormantAdmin.id });
    expect(res.status).toBe(403);
    expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('3. operations gets 403', async () => {
    asDepartment('operations');
    const res = await request(app).post('/api/auth/admin/send-password-setup').send({ userId: dormantAdmin.id });
    expect(res.status).toBe(403);
  });

  it('4. marketing gets 403', async () => {
    asDepartment('marketing');
    const res = await request(app).post('/api/auth/admin/send-password-setup').send({ userId: dormantAdmin.id });
    expect(res.status).toBe(403);
  });

  it('5. scanner gets 403', async () => {
    asDepartment('scanner');
    const res = await request(app).post('/api/auth/admin/send-password-setup').send({ userId: dormantAdmin.id });
    expect(res.status).toBe(403);
  });

  it('6. order_management gets 403', async () => {
    asDepartment('order_management');
    const res = await request(app).post('/api/auth/admin/send-password-setup').send({ userId: dormantAdmin.id });
    expect(res.status).toBe(403);
  });

  it('7. a customer target returns 404, not an email', async () => {
    asOldFounder();
    const res = await request(app).post('/api/auth/admin/send-password-setup').send({ userId: customerUser.id });
    expect(res.status).toBe(404);
    expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('8. an unknown target id returns 404', async () => {
    asOldFounder();
    const res = await request(app).post('/api/auth/admin/send-password-setup').send({ userId: 'not-a-real-user-id' });
    expect(res.status).toBe(404);
  });

  it('9. the correct target email is passed to sendPasswordResetEmail', async () => {
    asOldFounder();
    await request(app).post('/api/auth/admin/send-password-setup').send({ userId: dormantAdmin.id });
    expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(dormantAdmin.email, dormantAdmin.firstName, expect.any(String));
  });

  it('10 & 11 & 12. the response is exactly {success, message} — no token/url/password field, and the actual secret value never appears in it', async () => {
    asOldFounder();
    const res = await request(app).post('/api/auth/admin/send-password-setup').send({ userId: dormantAdmin.id });

    // Shape check: only success/message keys exist at all — no token/url/
    // password field could be present under any name.
    expect(Object.keys(res.body).sort()).toEqual(['message', 'success']);
    expect(typeof res.body.message).toBe('string');

    // The message legitimately contains the word "password" (a
    // human-readable "Password setup email sent to ..." confirmation) —
    // what must never appear is the actual generated secret itself.
    const realToken = emailService.sendPasswordResetEmail.mock.calls.at(-1)[2];
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain(realToken);
    expect(raw).not.toMatch(/reset-password\?token=/i);
  });

  it('13. two consecutive triggers invalidate the first token', async () => {
    asOldFounder();
    await request(app).post('/api/auth/admin/send-password-setup').send({ userId: dormantAdmin.id });
    const firstToken = emailService.sendPasswordResetEmail.mock.calls[0][2];

    await request(app).post('/api/auth/admin/send-password-setup').send({ userId: dormantAdmin.id });
    const secondToken = emailService.sendPasswordResetEmail.mock.calls[1][2];

    expect(firstToken).not.toBe(secondToken);

    // The first token no longer resolves through the real reset-password route.
    const staleReset = await request(app).post('/api/auth/reset-password').send({ token: firstToken, password: 'whatever-1' });
    expect(staleReset.status).toBe(400);

    // The second (current) token does.
    const freshReset = await request(app).post('/api/auth/reset-password').send({ token: secondToken, password: 'a-real-password-123' });
    expect(freshReset.status).toBe(200);
  }, 20000);

  it('14. an email-send failure returns 500 and does not report success', async () => {
    asOldFounder();
    emailService.sendPasswordResetEmail.mockRejectedValueOnce(new Error('MXroute API request failed'));
    const res = await request(app).post('/api/auth/admin/send-password-setup').send({ userId: dormantAdmin.id });
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('17. structured log includes actorUserId and targetUserId, never a secret', async () => {
    const logger = (await import('../../lib/logger.js')).default;
    const infoSpy = vi.spyOn(logger, 'info');
    asOldFounder();

    await request(app).post('/api/auth/admin/send-password-setup').send({ userId: dormantAdmin.id });

    const call = infoSpy.mock.calls.find(([, msg]) => msg === 'Password setup email triggered');
    expect(call).toBeTruthy();
    expect(call[0]).toMatchObject({ actorUserId: OLD_FOUNDER_ID, targetUserId: dormantAdmin.id });
    const serialized = JSON.stringify(call[0]);
    expect(serialized).not.toMatch(/password/i);
    expect(serialized).not.toMatch(/token/i);

    infoSpy.mockRestore();
  });
});

describe('15. existing POST /forgot-password behavior is unchanged', () => {
  it('still returns the same anti-enumeration response for an unknown email, and sends a real reset email for a known one', async () => {
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: `${MARKER.toLowerCase()}-nobody@test.local` });
    expect(unknown.status).toBe(200);
    expect(unknown.body.message).toMatch(/if an account exists/i);
    expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();

    const known = await request(app).post('/api/auth/forgot-password').send({ email: dormantAdmin.email });
    expect(known.status).toBe(200);
    expect(known.body.message).toMatch(/if an account exists/i);
    expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(dormantAdmin.email, dormantAdmin.firstName, expect.any(String));
  }, 20000);
});

describe('16. a freshly provisioned dormant admin can complete the full cycle', () => {
  it('trigger setup -> receive reset email -> reset password -> log in successfully', async () => {
    const freshAdmin = await prisma.user.create({
      data: { email: `${MARKER.toLowerCase()}-fresh-cycle@test.local`, firstName: 'Fresh', lastName: 'Cycle', role: 'admin', emailVerified: true },
    });
    createdUserIds.push(freshAdmin.id);

    asOldFounder();
    const triggerRes = await request(app).post('/api/auth/admin/send-password-setup').send({ userId: freshAdmin.id });
    expect(triggerRes.status).toBe(200);

    const [emailedTo, , realToken] = emailService.sendPasswordResetEmail.mock.calls.at(-1);
    expect(emailedTo).toBe(freshAdmin.email);

    const resetRes = await request(app).post('/api/auth/reset-password').send({ token: realToken, password: 'a-real-chosen-password-1' });
    expect(resetRes.status).toBe(200);

    const loginRes = await request(app).post('/api/auth/login').send({ email: freshAdmin.email, password: 'a-real-chosen-password-1' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeTruthy();
    expect(loginRes.body.user.email).toBe(freshAdmin.email);
  }, 25000);
});
