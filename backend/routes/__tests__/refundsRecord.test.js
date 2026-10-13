import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

/**
 * Stage 1 — manual refund recording (POST /admin/refunds/:id/record).
 *
 * Deliberately exercises the real requirePermission middleware (only
 * authenticate is mocked, the same convention as shipmentsPermissions.test.js)
 * so authorization for `refunds.manage` is proven rather than assumed, while
 * the business-logic tests below drive the real DB for state, audit-event,
 * duplicate and over-refund behavior.
 */
let currentUser;

vi.mock('../../middleware/auth.js', async () => {
  const actual = await vi.importActual('../../middleware/auth.js');
  return {
    ...actual,
    authenticate: (req, res, next) => { req.user = currentUser; next(); },
  };
});

const { default: refundsRouter } = await import('../refunds.js');

const app = express();
app.use(express.json());
app.use('/api/admin/refunds', refundsRouter);

const MARKER = `RefundRecordTest${Date.now()}`;

// Real user rows — OrderEvent.actorUserId is a FK to users.id, so any user
// that actually records a refund must exist. Denied attempts write nothing.
const FINANCE_ID = `${MARKER}-finance`;
const OVERRIDE_ID = `${MARKER}-override`;

function asFinance() {
  currentUser = { _id: FINANCE_ID, role: 'admin', staffProfile: { department: 'finance', active: true, permissions: [] } };
}
function asSupportWithoutRefundPermission() {
  currentUser = { _id: `${MARKER}-support`, role: 'admin', staffProfile: { department: 'support', active: true, permissions: [] } };
}
function asScanner() {
  currentUser = { _id: `${MARKER}-scanner`, role: 'admin', staffProfile: { department: 'scanner', active: true, permissions: [] } };
}
function asSupportWithRefundOverride() {
  currentUser = { _id: OVERRIDE_ID, role: 'admin', staffProfile: { department: 'support', active: true, permissions: ['refunds.manage'] } };
}

beforeAll(async () => {
  await prisma.user.create({
    data: { id: FINANCE_ID, email: `${FINANCE_ID}@test.local`, firstName: 'Fin', lastName: 'Ance', role: 'admin' },
  });
  await prisma.user.create({
    data: { id: OVERRIDE_ID, email: `${OVERRIDE_ID}@test.local`, firstName: 'Over', lastName: 'Ride', role: 'admin' },
  });
}, 20000);

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [FINANCE_ID, OVERRIDE_ID] } } });
  await prisma.$disconnect();
});

async function makeFixture({ total = 500, refundAmount = 500, refundStatus = 'pending', priorSucceeded = [] } = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const order = await prisma.order.create({
    data: {
      orderNumber: `PS-${MARKER}-${suffix}`,
      email: 'refund-record-test@example.com',
      shipToFullName: 'Test Buyer', shipToPhone: '09171234567', shipToAddress: '1 St',
      shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
      subtotal: total, total,
      paymentStatus: 'paid', orderStatus: 'delivered',
    },
  });

  const payment = await prisma.payment.create({
    data: { orderId: order.id, provider: 'epaygames', status: 'succeeded', paidAt: new Date() },
  });

  const refund = await prisma.refund.create({
    data: { orderId: order.id, paymentId: payment.id, amount: refundAmount, reason: 'test', status: refundStatus },
  });

  for (const amount of priorSucceeded) {
    // eslint-disable-next-line no-await-in-loop
    await prisma.refund.create({
      data: { orderId: order.id, amount, reason: 'prior', status: 'succeeded', processedAt: new Date() },
    });
  }

  return { order, payment, refund };
}

async function cleanup({ order }) {
  await prisma.orderEvent.deleteMany({ where: { orderId: order.id } });
  await prisma.refund.deleteMany({ where: { orderId: order.id } });
  await prisma.payment.deleteMany({ where: { orderId: order.id } });
  await prisma.order.delete({ where: { id: order.id } });
}

async function recordEventCount(orderId) {
  return prisma.orderEvent.count({ where: { orderId, type: 'refund_recorded' } });
}

beforeEach(() => {
  asFinance(); // default actor; individual tests override where authorization is under test
});

describe('POST /admin/refunds/:id/record — authorization', () => {
  it('finance (refunds.manage by default) may record', async () => {
    const fixture = await makeFixture();
    try {
      const res = await request(app)
        .post(`/api/admin/refunds/${fixture.refund.id}/record`)
        .send({ confirmCompleted: true, externalAmount: 500, providerReference: 'EPG-1' });
      expect(res.status).toBe(200);
    } finally {
      await cleanup(fixture);
    }
  }, 20000);

  it('support without an explicit override is denied (403) and writes nothing', async () => {
    const fixture = await makeFixture();
    try {
      asSupportWithoutRefundPermission();
      const res = await request(app)
        .post(`/api/admin/refunds/${fixture.refund.id}/record`)
        .send({ confirmCompleted: true });
      expect(res.status).toBe(403);
      expect((await prisma.refund.findUnique({ where: { id: fixture.refund.id } })).status).toBe('pending');
      expect(await recordEventCount(fixture.order.id)).toBe(0);
    } finally {
      await cleanup(fixture);
    }
  }, 20000);

  it('scanner is denied (403)', async () => {
    const fixture = await makeFixture();
    try {
      asScanner();
      const res = await request(app)
        .post(`/api/admin/refunds/${fixture.refund.id}/record`)
        .send({ confirmCompleted: true });
      expect(res.status).toBe(403);
    } finally {
      await cleanup(fixture);
    }
  }, 20000);

  it('an explicit refunds.manage override grants access even outside Finance', async () => {
    const fixture = await makeFixture();
    try {
      asSupportWithRefundOverride();
      const res = await request(app)
        .post(`/api/admin/refunds/${fixture.refund.id}/record`)
        .send({ confirmCompleted: true, externalAmount: 500 });
      expect(res.status).toBe(200);
    } finally {
      await cleanup(fixture);
    }
  }, 20000);
});

describe('POST /admin/refunds/:id/record — recording behavior', () => {
  it('records a pending refund, persists the provider reference and writes one refund_recorded event', async () => {
    const fixture = await makeFixture();
    try {
      const res = await request(app)
        .post(`/api/admin/refunds/${fixture.refund.id}/record`)
        .send({ confirmCompleted: true, externalAmount: 500, providerReference: 'EPG-TKT-77' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('succeeded');
      expect(res.body.data.providerRefundReference).toBe('EPG-TKT-77');
      expect(res.body.data.processedAt).not.toBeNull();

      const events = await prisma.orderEvent.findMany({ where: { orderId: fixture.order.id, type: 'refund_recorded' } });
      expect(events).toHaveLength(1);
      expect(events[0].actor).toBe('admin');
      expect(events[0].actorUserId).toBe(FINANCE_ID);
      expect(events[0].metadata.amount).toBe(500);
      expect(events[0].metadata.providerReference).toBe('EPG-TKT-77');
      expect(events[0].metadata.correctedFrom).toBeUndefined();
    } finally {
      await cleanup(fixture);
    }
  }, 20000);

  it('requires explicit confirmation (confirmCompleted: true)', async () => {
    const fixture = await makeFixture();
    try {
      for (const body of [{}, { confirmCompleted: false, providerReference: 'x' }]) {
        // eslint-disable-next-line no-await-in-loop
        const res = await request(app).post(`/api/admin/refunds/${fixture.refund.id}/record`).send(body);
        expect(res.status).toBe(400);
      }
      expect((await prisma.refund.findUnique({ where: { id: fixture.refund.id } })).status).toBe('pending');
      expect(await recordEventCount(fixture.order.id)).toBe(0);
    } finally {
      await cleanup(fixture);
    }
  }, 20000);

  it('404s for a non-existent refund', async () => {
    const res = await request(app)
      .post('/api/admin/refunds/00000000-0000-0000-0000-000000000000/record')
      .send({ confirmCompleted: true });
    expect(res.status).toBe(404);
  });

  it('rejects an already-succeeded refund (409) without writing a second event', async () => {
    const fixture = await makeFixture({ refundStatus: 'pending' });
    try {
      // Record once via the route, then attempt again — the second must not create a second event.
      await request(app).post(`/api/admin/refunds/${fixture.refund.id}/record`).send({ confirmCompleted: true, externalAmount: 500 });
      const res = await request(app).post(`/api/admin/refunds/${fixture.refund.id}/record`).send({ confirmCompleted: true, externalAmount: 500 });
      expect(res.status).toBe(409);
      expect(await recordEventCount(fixture.order.id)).toBe(1);
    } finally {
      await cleanup(fixture);
    }
  }, 20000);

  it('rejects a refund in a non-recordable state (processing → 409)', async () => {
    const fixture = await makeFixture({ refundStatus: 'processing' });
    try {
      const res = await request(app).post(`/api/admin/refunds/${fixture.refund.id}/record`).send({ confirmCompleted: true });
      expect(res.status).toBe(409);
    } finally {
      await cleanup(fixture);
    }
  }, 20000);
});

describe('POST /admin/refunds/:id/record — failed → succeeded correction', () => {
  it('corrects a failed refund only with a note, recording the correction in the audit trail', async () => {
    const fixture = await makeFixture({ refundStatus: 'failed' });
    try {
      const noNote = await request(app).post(`/api/admin/refunds/${fixture.refund.id}/record`).send({ confirmCompleted: true, externalAmount: 500 });
      expect(noNote.status).toBe(400);
      expect((await prisma.refund.findUnique({ where: { id: fixture.refund.id } })).status).toBe('failed');

      const res = await request(app)
        .post(`/api/admin/refunds/${fixture.refund.id}/record`)
        .send({ confirmCompleted: true, externalAmount: 500, note: 'Provider dashboard confirms settlement' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('succeeded');

      const events = await prisma.orderEvent.findMany({ where: { orderId: fixture.order.id, type: 'refund_recorded' } });
      expect(events).toHaveLength(1);
      expect(events[0].metadata.correctedFrom).toBe('failed');
      expect(events[0].metadata.note).toBe('Provider dashboard confirms settlement');
    } finally {
      await cleanup(fixture);
    }
  }, 20000);
});

describe('POST /admin/refunds/:id/record — cumulative over-refund guard', () => {
  it('rejects recording when prior succeeded refunds plus this one exceed the amount paid (422)', async () => {
    const fixture = await makeFixture({ total: 500, refundAmount: 200, priorSucceeded: [400] });
    try {
      const res = await request(app).post(`/api/admin/refunds/${fixture.refund.id}/record`).send({ confirmCompleted: true, externalAmount: 200 });
      expect(res.status).toBe(422);
      expect((await prisma.refund.findUnique({ where: { id: fixture.refund.id } })).status).toBe('pending');
      expect(await recordEventCount(fixture.order.id)).toBe(0);
    } finally {
      await cleanup(fixture);
    }
  }, 20000);

  it('allows a partial refund that stays within the amount paid', async () => {
    const fixture = await makeFixture({ total: 500, refundAmount: 300, priorSucceeded: [200] });
    try {
      const res = await request(app).post(`/api/admin/refunds/${fixture.refund.id}/record`).send({ confirmCompleted: true, externalAmount: 300 });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('succeeded');
    } finally {
      await cleanup(fixture);
    }
  }, 20000);
});

describe('POST /admin/refunds/:id/record — concurrency', () => {
  it('two concurrent recordings of the same refund result in exactly one success and one event', async () => {
    const fixture = await makeFixture();
    try {
      const [a, b] = await Promise.all([
        request(app).post(`/api/admin/refunds/${fixture.refund.id}/record`).send({ confirmCompleted: true, externalAmount: 500 }),
        request(app).post(`/api/admin/refunds/${fixture.refund.id}/record`).send({ confirmCompleted: true, externalAmount: 500 }),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
      expect(await recordEventCount(fixture.order.id)).toBe(1);
      expect((await prisma.refund.findUnique({ where: { id: fixture.refund.id } })).status).toBe('succeeded');
    } finally {
      await cleanup(fixture);
    }
  }, 30000);

  it('two concurrent recordings of different refunds on one order cannot together exceed the amount paid', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const order = await prisma.order.create({
      data: {
        orderNumber: `PS-${MARKER}-${suffix}`,
        email: 'refund-record-race@example.com',
        shipToFullName: 'Test Buyer', shipToPhone: '09171234567', shipToAddress: '1 St',
        shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
        subtotal: 500, total: 500, paymentStatus: 'paid', orderStatus: 'delivered',
      },
    });
    const refundA = await prisma.refund.create({ data: { orderId: order.id, amount: 300, reason: 'a', status: 'pending' } });
    const refundB = await prisma.refund.create({ data: { orderId: order.id, amount: 300, reason: 'b', status: 'pending' } });
    try {
      const [a, b] = await Promise.all([
        request(app).post(`/api/admin/refunds/${refundA.id}/record`).send({ confirmCompleted: true, externalAmount: 300 }),
        request(app).post(`/api/admin/refunds/${refundB.id}/record`).send({ confirmCompleted: true, externalAmount: 300 }),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 422]);
      expect(await recordEventCount(order.id)).toBe(1);
      expect(await prisma.refund.count({ where: { orderId: order.id, status: 'succeeded' } })).toBe(1);
    } finally {
      await cleanup({ order });
    }
  }, 30000);
});
