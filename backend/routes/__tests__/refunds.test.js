import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import prisma from '../../lib/prisma.js';

vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => { req.user = { _id: 'test-admin', role: 'admin' }; next(); },
  isAdmin: (req, res, next) => next(),
}));

vi.mock('../../services/paymentService.js', () => ({ issueRefund: vi.fn() }));

const { default: refundsRouter } = await import('../refunds.js');
const paymentService = await import('../../services/paymentService.js');

const app = express();
app.use(express.json());
app.use('/api/admin/refunds', refundsRouter);

const MARKER = `RefundRouteTest${Date.now()}`;

beforeEach(() => {
  vi.clearAllMocks();
});

async function makeOrderWithRefund({ providerPaymentReference = 'maya-pay-ref-1' } = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const order = await prisma.order.create({
    data: {
      orderNumber: `PS-${MARKER}-${suffix}`,
      email: 'refund-route-test@example.com',
      shipToFullName: 'Test Buyer', shipToPhone: '09171234567', shipToAddress: '1 St',
      shipToCity: 'QC', shipToProvince: 'Metro Manila', shipToZipCode: '1100',
      subtotal: 500, total: 500,
      paymentStatus: 'paid', orderStatus: 'delivered',
    },
  });

  const payment = await prisma.payment.create({
    data: { orderId: order.id, provider: 'maya', status: 'succeeded', paidAt: new Date(), providerPaymentReference },
  });

  const refund = await prisma.refund.create({
    data: { orderId: order.id, paymentId: payment.id, amount: 500, reason: 'test' },
  });

  return { order, payment, refund };
}

async function cleanup({ order, payment }) {
  await prisma.refund.deleteMany({ where: { orderId: order.id } });
  await prisma.payment.delete({ where: { id: payment.id } });
  await prisma.order.delete({ where: { id: order.id } });
}

describe('POST /admin/refunds/:id/process', () => {
  it('issues a real refund and marks Order.paymentStatus refunded on success', async () => {
    const fixture = await makeOrderWithRefund();
    const { order, refund } = fixture;
    try {
      paymentService.issueRefund.mockResolvedValueOnce({ providerRefundReference: 'maya-refund-1', status: 'succeeded' });

      const res = await request(app).post(`/api/admin/refunds/${refund.id}/process`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('succeeded');
      expect(res.body.data.providerRefundReference).toBe('maya-refund-1');

      const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
      expect(updatedOrder.paymentStatus).toBe('refunded');

      expect(paymentService.issueRefund).toHaveBeenCalledWith('maya-pay-ref-1', 500, 'test', 'maya');
    } finally {
      await cleanup(fixture);
    }
  }, 20000);

  it('marks the refund failed and leaves Order.paymentStatus untouched when no providerPaymentReference exists', async () => {
    const fixture = await makeOrderWithRefund({ providerPaymentReference: null });
    const { order, refund } = fixture;
    try {
      const res = await request(app).post(`/api/admin/refunds/${refund.id}/process`);
      expect(res.status).toBe(422);

      const updatedRefund = await prisma.refund.findUnique({ where: { id: refund.id } });
      expect(updatedRefund.status).toBe('failed');

      const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
      expect(updatedOrder.paymentStatus).toBe('paid'); // unchanged

      expect(paymentService.issueRefund).not.toHaveBeenCalled();
    } finally {
      await cleanup(fixture);
    }
  }, 20000);

  it('marks the refund failed when the gateway call itself throws', async () => {
    const fixture = await makeOrderWithRefund();
    const { refund } = fixture;
    try {
      paymentService.issueRefund.mockRejectedValueOnce(new Error('Maya is down'));

      const res = await request(app).post(`/api/admin/refunds/${refund.id}/process`);
      expect(res.status).toBe(502);

      const updatedRefund = await prisma.refund.findUnique({ where: { id: refund.id } });
      expect(updatedRefund.status).toBe('failed');
    } finally {
      await cleanup(fixture);
    }
  }, 20000);

  it('rejects processing a refund that is not pending', async () => {
    const fixture = await makeOrderWithRefund();
    const { refund } = fixture;
    await prisma.refund.update({ where: { id: refund.id }, data: { status: 'succeeded' } });
    try {
      const res = await request(app).post(`/api/admin/refunds/${refund.id}/process`);
      expect(res.status).toBe(400);
      expect(paymentService.issueRefund).not.toHaveBeenCalled();
    } finally {
      await cleanup(fixture);
    }
  }, 20000);

  it('404s for a non-existent refund', async () => {
    const res = await request(app).post('/api/admin/refunds/00000000-0000-0000-0000-000000000000/process');
    expect(res.status).toBe(404);
  });
});
