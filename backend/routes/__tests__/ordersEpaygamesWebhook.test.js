import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import prisma from '../../lib/prisma.js';

// Phase 3 — a small, dedicated file for the ePayGames webhook route only,
// deliberately separate from the large orders.test.js (which this phase's
// instructions say not to run). Every fixture here uses a direct Order
// insert (the same fast-fixture pattern the test-optimization pass already
// proved for this exact router — no product, no full checkout, no gateway
// call), since these tests are entirely about webhook resolution logic,
// not the checkout transaction itself.

vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => next(),
  isAdmin: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
  requirePermission: () => (req, res, next) => next(),
  requireAnyPermission: () => (req, res, next) => next(),
}));

vi.mock('../../services/paymentService.js', () => ({
  createCheckoutSession: vi.fn(),
  getPaymentStatus: vi.fn(),
  getSessionDurationMs: vi.fn().mockReturnValue(60 * 60 * 1000),
}));

vi.mock('../../services/emailService.js', () => ({
  sendOrderConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentPendingEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentFailedEmail: vi.fn().mockResolvedValue(undefined),
  sendOrderStatusEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../lib/orderConfirmationEmail.js', () => ({
  sendOrderConfirmation: vi.fn().mockResolvedValue(undefined),
}));

const { default: ordersRouter } = await import('../orders.js');
const paymentService = await import('../../services/paymentService.js');
const confirmationEmail = await import('../../lib/orderConfirmationEmail.js');

const app = express();
app.use(express.json());
app.use('/api/orders', ordersRouter);

const MARKER = `EpaygamesWebhookTest${Date.now()}`;
const SIGNATURE_KEY = 'test-epaygames-signature-key';
process.env.EPAYGAMES_SIGNATURE_KEY = SIGNATURE_KEY;
// NODE_ENV is 'test' (see .env.test) — epaygamesWebhookVerify's IP
// allowlist is already fully covered by its own unit test and is skipped
// entirely outside production, same as mayaWebhookIpAllowlist.js's own
// documented bypass. These tests focus on what the IP check can't cover:
// signature validity plus the route's own authenticated-lookup behavior.

const createdOrderIds = [];

async function makeOrderFixture(overrides = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const orderNumber = `PS-${MARKER}-${suffix}`;
  const order = await prisma.order.create({
    data: {
      orderNumber,
      email: `${MARKER}@test.local`,
      shipToFullName: 'Fixture Buyer',
      shipToPhone: '09171234567',
      shipToAddress: '1 St',
      shipToCity: 'QC',
      shipToProvince: 'Metro Manila',
      shipToZipCode: '1100',
      subtotal: 500,
      shippingFee: 99,
      total: 599,
      paymentStatus: 'pending',
      orderStatus: 'awaiting_payment',
      paymentMethod: 'epaygames',
      paymentChannel: 'GCASH',
      // Must be prefixed with the real orderNumber — the webhook route
      // parses everything before the first '__' back out as the order
      // number to look up. '__' (not Xendit/Maya's shared '#') —
      // epaygamesGateway.js switched to this delimiter 2026-08-28 after a
      // real sandbox call confirmed a '#' in reference_no breaks
      // ePayGames' own hosted-checkout page (deferred/load 500s).
      mayaPaymentId: `${orderNumber}__${crypto.randomBytes(4).toString('hex')}`,
      mayaCheckoutUrl: 'https://l-stg.epayg.link/fixture',
      ...overrides,
    },
  });
  createdOrderIds.push(order.id);
  return order;
}

// '@' per ePayGames' documented format ("100@EPLKZT2OH319WBEF") — confirmed
// against two real sandbox webhook deliveries 2026-08-28. Was '|', which
// never validated a single real delivery (see epaygamesWebhookVerify.js).
function signedPayload({ referenceNo, amount = 599, status = 'completed' }) {
  const signature = crypto.createHmac('sha256', SIGNATURE_KEY).update(`${amount}@${referenceNo}`).digest('hex');
  return { data: { reference_no: referenceNo, amount, status, signature } };
}

function sendWebhook(payload) {
  return request(app).post('/api/orders/webhooks/epaygames').send(payload);
}

beforeEach(() => {
  // vi.clearAllMocks() only clears call history, not the mockReturnValue
  // set once in the vi.mock() factory above — getSessionDurationMs stays
  // primed across tests without needing to be re-set here.
  vi.clearAllMocks();
});

afterAll(async () => {
  await prisma.shipmentEvent.deleteMany({ where: { shipment: { orderId: { in: createdOrderIds } } } });
  await prisma.shipment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
  await prisma.orderEvent.deleteMany({ where: { orderId: { in: createdOrderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
  await prisma.$disconnect();
});

describe('POST /orders/webhooks/epaygames — signature wiring (unit coverage in epaygamesWebhookVerify.test.js; this just confirms the route mounts it)', () => {
  it('403s a request with no valid signature before ever looking up the order', async () => {
    const order = await makeOrderFixture();
    const res = await sendWebhook({ data: { reference_no: order.mayaPaymentId, amount: 599, status: 'completed', signature: 'not-valid' } });
    expect(res.status).toBe(403);
    expect(paymentService.getPaymentStatus).not.toHaveBeenCalled();

    const unchanged = await prisma.order.findUnique({ where: { id: order.id } });
    expect(unchanged.paymentStatus).toBe('pending');
  }, 10000);
});

describe('POST /orders/webhooks/epaygames — WEBHOOK ≠ PROOF OF PAYMENT', () => {
  it('a valid signature claiming success is NOT enough — resolution follows the authenticated lookup, not the webhook body', async () => {
    const order = await makeOrderFixture();
    // The webhook body itself claims failure; the authenticated lookup
    // says otherwise. Only the lookup may decide.
    paymentService.getPaymentStatus.mockResolvedValueOnce({ status: 'succeeded', raw: { reference_no: order.mayaPaymentId, amount: 599 } });

    const res = await sendWebhook(signedPayload({ referenceNo: order.mayaPaymentId, status: 'cancelled' }));
    expect(res.status).toBe(200);

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.paymentStatus).toBe('paid'); // driven by the lookup, not the forged body status
    expect(paymentService.getPaymentStatus).toHaveBeenCalledWith(order.mayaPaymentId, 'epaygames');
  }, 10000);

  it('a forged webhook body claiming success does NOT mark the order paid unless the lookup confirms it', async () => {
    const order = await makeOrderFixture();
    paymentService.getPaymentStatus.mockResolvedValueOnce({ status: 'failed', raw: { reference_no: order.mayaPaymentId, amount: 599 } });

    const res = await sendWebhook(signedPayload({ referenceNo: order.mayaPaymentId, status: 'completed' }));
    expect(res.status).toBe(200);

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.paymentStatus).toBe('failed');
  }, 10000);
});

describe('POST /orders/webhooks/epaygames — amount and reference verification', () => {
  it('rejects resolution when the looked-up amount does not match the order total — order stays unresolved', async () => {
    const order = await makeOrderFixture({ total: 599 });
    paymentService.getPaymentStatus.mockResolvedValueOnce({ status: 'succeeded', raw: { reference_no: order.mayaPaymentId, amount: 1.0 } });

    const res = await sendWebhook(signedPayload({ referenceNo: order.mayaPaymentId }));
    expect(res.status).toBe(200);

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.paymentStatus).toBe('pending'); // never resolved
    expect(confirmationEmail.sendOrderConfirmation).not.toHaveBeenCalled();

    const shipments = await prisma.shipment.count({ where: { orderId: order.id } });
    expect(shipments).toBe(0);
  }, 10000);

  it('accepts a looked-up amount that matches after rounding to centavos, not exact float equality', async () => {
    const order = await makeOrderFixture({ total: 599 });
    paymentService.getPaymentStatus.mockResolvedValueOnce({ status: 'succeeded', raw: { reference_no: order.mayaPaymentId, amount: 599.0000000001 } });

    const res = await sendWebhook(signedPayload({ referenceNo: order.mayaPaymentId }));
    expect(res.status).toBe(200);

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.paymentStatus).toBe('paid');
  }, 10000);

  it('rejects resolution when the looked-up transaction reference does not match the order\'s stored reference', async () => {
    const order = await makeOrderFixture();
    paymentService.getPaymentStatus.mockResolvedValueOnce({ status: 'succeeded', raw: { reference_no: 'some-other-transaction__zzz', amount: 599 } });

    const res = await sendWebhook(signedPayload({ referenceNo: order.mayaPaymentId }));
    expect(res.status).toBe(200);

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.paymentStatus).toBe('pending');
  }, 10000);

  it('a valid, correctly-signed webhook for one order can never resolve a different order sharing an order-number prefix', async () => {
    const orderA = await makeOrderFixture();
    const orderB = await makeOrderFixture();
    // Attacker (or a genuine bug) sends orderB's reference_no signed
    // correctly, but the lookup for THAT reference returns transaction A's data.
    paymentService.getPaymentStatus.mockResolvedValueOnce({ status: 'succeeded', raw: { reference_no: orderA.mayaPaymentId, amount: 599 } });

    const res = await sendWebhook(signedPayload({ referenceNo: orderB.mayaPaymentId }));
    expect(res.status).toBe(200);

    const updatedA = await prisma.order.findUnique({ where: { id: orderA.id } });
    const updatedB = await prisma.order.findUnique({ where: { id: orderB.id } });
    expect(updatedA.paymentStatus).toBe('pending'); // never targeted by this webhook at all
    expect(updatedB.paymentStatus).toBe('pending'); // reference mismatch — rejected
  }, 10000);
});

describe('POST /orders/webhooks/epaygames — status outcomes (Phase 2 normalization, not re-implemented here)', () => {
  it('failed transaction resolves the order to failed', async () => {
    const order = await makeOrderFixture();
    paymentService.getPaymentStatus.mockResolvedValueOnce({ status: 'failed', raw: { reference_no: order.mayaPaymentId, amount: 599 } });

    await sendWebhook(signedPayload({ referenceNo: order.mayaPaymentId }));

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.paymentStatus).toBe('failed');
    expect(updated.orderStatus).toBe('failed_payment');
  }, 10000);

  it('expired transaction resolves the order to expired', async () => {
    const order = await makeOrderFixture();
    paymentService.getPaymentStatus.mockResolvedValueOnce({ status: 'expired', raw: { reference_no: order.mayaPaymentId, amount: 599 } });

    await sendWebhook(signedPayload({ referenceNo: order.mayaPaymentId }));

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.paymentStatus).toBe('failed'); // coarse PaymentStatus vocabulary
    expect(updated.orderStatus).toBe('expired'); // OrderStatus carries the real distinction
  }, 10000);

  it('pending transaction leaves the order pending, untouched', async () => {
    const order = await makeOrderFixture();
    paymentService.getPaymentStatus.mockResolvedValueOnce({ status: 'pending', raw: { reference_no: order.mayaPaymentId, amount: 599 } });

    const res = await sendWebhook(signedPayload({ referenceNo: order.mayaPaymentId, status: 'pending' }));
    expect(res.status).toBe(200);

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.paymentStatus).toBe('pending');
    expect(updated.orderStatus).toBe('awaiting_payment');
  }, 10000);

  it('an unrecognized/unmapped status is never treated as paid', async () => {
    const order = await makeOrderFixture();
    paymentService.getPaymentStatus.mockResolvedValueOnce({ status: 'some_unexpected_value', raw: { reference_no: order.mayaPaymentId, amount: 599 } });

    await sendWebhook(signedPayload({ referenceNo: order.mayaPaymentId }));

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.paymentStatus).toBe('pending');
  }, 10000);
});

describe('POST /orders/webhooks/epaygames — lookup failure', () => {
  it('leaves the order unresolved and acknowledges safely when the ePayGames status lookup itself fails', async () => {
    const order = await makeOrderFixture();
    paymentService.getPaymentStatus.mockRejectedValueOnce(new Error('ePayGames API timeout'));

    const res = await sendWebhook(signedPayload({ referenceNo: order.mayaPaymentId }));
    expect(res.status).toBe(200); // acknowledged, not a 500 — same "ack safely, don't force a retry storm" shape as the other gateways

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.paymentStatus).toBe('pending');
  }, 10000);
});

describe('POST /orders/webhooks/epaygames — duplicate webhook idempotency (structural reference: the existing Xendit duplicate-webhook test)', () => {
  it('first webhook resolves once (one shipment, one shipment event, one confirmation email); a duplicate does nothing further', async () => {
    const order = await makeOrderFixture();
    paymentService.getPaymentStatus.mockResolvedValue({ status: 'succeeded', raw: { reference_no: order.mayaPaymentId, amount: 599 } });

    const payload = signedPayload({ referenceNo: order.mayaPaymentId });
    expect((await sendWebhook(payload)).status).toBe(200);
    expect((await sendWebhook(payload)).status).toBe(200); // duplicate delivery

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.paymentStatus).toBe('paid');

    const [shipments, shipmentEvents] = await Promise.all([
      prisma.shipment.count({ where: { orderId: order.id } }),
      prisma.shipmentEvent.count({ where: { shipment: { orderId: order.id } } }),
    ]);
    expect(shipments).toBe(1);
    expect(shipmentEvents).toBe(1);
    expect(confirmationEmail.sendOrderConfirmation).toHaveBeenCalledTimes(1);

    // The order-level guard (paymentStatus already 'paid') short-circuits
    // before ever calling the gateway again — no second authenticated pull.
    expect(paymentService.getPaymentStatus).toHaveBeenCalledTimes(1);
  }, 10000);

  it('an already-paid order silently acknowledges a later webhook without any side effects', async () => {
    const order = await makeOrderFixture({ paymentStatus: 'paid', orderStatus: 'paid' });

    const res = await sendWebhook(signedPayload({ referenceNo: order.mayaPaymentId }));
    expect(res.status).toBe(200);
    expect(paymentService.getPaymentStatus).not.toHaveBeenCalled();
  }, 10000);
});

describe('POST /orders/webhooks/epaygames — structural edge cases', () => {
  it('silently acknowledges a webhook for an unknown order, without erroring', async () => {
    const res = await sendWebhook(signedPayload({ referenceNo: 'PS-NOSUCHORDER__zzz' }));
    expect(res.status).toBe(200);
    expect(paymentService.getPaymentStatus).not.toHaveBeenCalled();
  });

  it('resolves an order from a reference_no carrying the attempt-unique "__" suffix', async () => {
    const order = await makeOrderFixture();
    paymentService.getPaymentStatus.mockResolvedValueOnce({ status: 'succeeded', raw: { reference_no: order.mayaPaymentId, amount: 599 } });

    const res = await sendWebhook(signedPayload({ referenceNo: order.mayaPaymentId }));
    expect(res.status).toBe(200);

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated.paymentStatus).toBe('paid');
  }, 10000);

  // Regression test (2026-08-28): a '#'-delimited reference is no longer
  // ePayGames' own convention (epaygamesGateway.js now generates '__') —
  // this proves the webhook route's order-number parsing has actually
  // moved to '__' rather than still accepting '#' as a happy coincidence.
  it('does NOT parse a legacy "#"-delimited reference correctly — confirms the route has actually moved to "__", not just accepting both', async () => {
    const order = await makeOrderFixture();
    const legacyHashReference = `${order.orderNumber}#deadbeef0000`;
    paymentService.getPaymentStatus.mockResolvedValueOnce({ status: 'succeeded', raw: { reference_no: legacyHashReference, amount: 599 } });

    const res = await sendWebhook(signedPayload({ referenceNo: legacyHashReference }));
    expect(res.status).toBe(200);
    // Splitting `${orderNumber}#deadbeef0000` on '__' yields the whole
    // string, not the real order number, so no matching order is found.
    expect(paymentService.getPaymentStatus).not.toHaveBeenCalled();

    const unchanged = await prisma.order.findUnique({ where: { id: order.id } });
    expect(unchanged.paymentStatus).toBe('pending');
  }, 10000);
});
