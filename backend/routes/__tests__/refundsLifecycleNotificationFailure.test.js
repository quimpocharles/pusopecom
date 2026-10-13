import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

/**
 * Stage 2, Step 5 — a failing notification must not misrepresent the committed
 * refund: the recording still succeeds and the lifecycle writes still apply.
 */
let currentUser;

vi.mock('../../middleware/auth.js', async () => {
  const actual = await vi.importActual('../../middleware/auth.js');
  return { ...actual, authenticate: (req, res, next) => { req.user = currentUser; next(); } };
});

// Every notification write fails.
vi.mock('../../repositories/notificationRepository.js', async () => {
  const actual = await vi.importActual('../../repositories/notificationRepository.js');
  return { ...actual, create: vi.fn(() => Promise.reject(new Error('notification service down'))) };
});

const { default: refundsRouter } = await import('../refunds.js');

const app = express();
app.use(express.json());
app.use('/api/admin/refunds', refundsRouter);

const MARKER = `RefundNotifyFail${Date.now()}`;
const ACTOR_ID = `${MARKER}-actor`;
const CUSTOMER_ID = `${MARKER}-customer`;

beforeAll(async () => {
  await prisma.user.create({ data: { id: ACTOR_ID, email: `${ACTOR_ID}@test.local`, firstName: 'Fin', lastName: 'Ance', role: 'admin' } });
  await prisma.staffProfile.create({ data: { userId: ACTOR_ID, department: 'finance', active: true, permissions: [] } });
  await prisma.user.create({ data: { id: CUSTOMER_ID, email: `${CUSTOMER_ID}@test.local`, firstName: 'Cus', lastName: 'Tomer', role: 'customer' } });
}, 20000);

let shared;
beforeAll(async () => {
  const suffix = `${Date.now()}`;
  const org = await prisma.organization.create({ data: { name: `${MARKER} Org`, slug: `${MARKER.toLowerCase()}-org-${suffix}`, kind: 'institution' } });
  const venue = await prisma.venue.create({ data: { name: `${MARKER} Arena`, slug: `${MARKER.toLowerCase()}-arena-${suffix}`, address: '1 St', city: 'Pasay' } });
  const section = await prisma.venueSection.create({ data: { venueId: venue.id, name: 'GA' } });
  const event = await prisma.passEvent.create({ data: { name: `${MARKER} Game`, slug: `${MARKER.toLowerCase()}-game-${suffix}`, organizationId: org.id, venueId: venue.id, startsAt: new Date(Date.now() + 86400000), endsAt: new Date(Date.now() + 90000000) } });
  const tier = await prisma.passTier.create({ data: { passEventId: event.id, venueSectionId: section.id, name: 'GA', price: 500, capacity: 50, sold: 0 } });
  shared = { org, venue, section, event, tier };
}, 20000);

afterAll(async () => {
  await prisma.passLog.deleteMany({ where: { pass: { passEventId: shared.event.id } } });
  await prisma.pass.deleteMany({ where: { passEventId: shared.event.id } });
  await prisma.passTier.deleteMany({ where: { passEventId: shared.event.id } });
  await prisma.passEvent.delete({ where: { id: shared.event.id } });
  await prisma.venueSection.deleteMany({ where: { venueId: shared.venue.id } });
  await prisma.venue.delete({ where: { id: shared.venue.id } });
  await prisma.organization.delete({ where: { id: shared.org.id } });
  await prisma.staffProfile.deleteMany({ where: { userId: ACTOR_ID } });
  await prisma.user.deleteMany({ where: { id: { in: [ACTOR_ID, CUSTOMER_ID] } } });
  await prisma.$disconnect();
});

beforeEach(() => {
  // Two different actor ids so each test's event/pass rows are unambiguous.
  currentUser = { _id: ACTOR_ID, role: 'admin', staffProfile: { department: 'finance', active: true, permissions: [] } };
});

describe('refund completion — notification failure does not misrepresent the committed refund', () => {
  it('records the refund and completes the lifecycle even when notifications fail', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const order = await prisma.order.create({
      data: {
        orderNumber: `PS-${MARKER}-${suffix}`, email: 'notify-fail@example.com',
        shipToFullName: 'Test Buyer', shipToPhone: '09171234567', shipToAddress: '1 St',
        shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
        subtotal: 1000, shippingFee: 0, discountAmount: 0, total: 1000,
        userId: CUSTOMER_ID, paymentStatus: 'paid', orderStatus: 'cancelled',
      },
    });
    const payment = await prisma.payment.create({ data: { orderId: order.id, provider: 'epaygames', status: 'succeeded', paidAt: new Date() } });
    const checkedInPass = await prisma.pass.create({ data: { orderId: order.id, passEventId: shared.event.id, passTierId: shared.tier.id, price: 500, status: 'checked_in' } });
    const refund = await prisma.refund.create({ data: { orderId: order.id, paymentId: payment.id, amount: 1000, reason: 'cancelled', status: 'pending' } });

    try {
      const res = await request(app).post(`/api/admin/refunds/${refund.id}/record`).send({ confirmCompleted: true, externalAmount: 1000 });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('succeeded');
      expect(res.body.data.lifecycle.passExceptions).toHaveLength(1); // the checked-in pass

      expect((await prisma.refund.findUnique({ where: { id: refund.id } })).status).toBe('succeeded');
      expect((await prisma.order.findUnique({ where: { id: order.id } })).paymentStatus).toBe('refunded');
      expect(await prisma.orderEvent.count({ where: { orderId: order.id, type: 'refund_recorded' } })).toBe(1);
    } finally {
      await prisma.passLog.deleteMany({ where: { pass: { orderId: order.id } } });
      await prisma.pass.deleteMany({ where: { orderId: order.id } });
      await prisma.orderEvent.deleteMany({ where: { orderId: order.id } });
      await prisma.refund.deleteMany({ where: { orderId: order.id } });
      await prisma.payment.deleteMany({ where: { orderId: order.id } });
      await prisma.order.delete({ where: { id: order.id } });
    }
  }, 30000);
});
