import { describe, it, expect, vi, beforeEach } from 'vitest';

// Focused registry test — confirms epaygames slots into the GATEWAYS
// dispatch cleanly and that adding it changed nothing about how Maya/Xendit
// already resolve, without exercising any gateway's real HTTP calls.
vi.mock('../gateways/mayaGateway.js', () => ({
  createCheckoutSession: vi.fn().mockResolvedValue({ paymentReference: 'maya-ref', redirectUrl: 'https://maya.example/1' }),
  getPaymentStatus: vi.fn().mockResolvedValue({ status: 'pending', raw: {} }),
  issueRefund: vi.fn().mockResolvedValue({ providerRefundReference: 'r1', status: 'succeeded' }),
  SESSION_DURATION_MS: 60 * 60 * 1000,
}));
vi.mock('../gateways/xenditGateway.js', () => ({
  createCheckoutSession: vi.fn().mockResolvedValue({ paymentReference: 'xendit-ref', redirectUrl: 'https://xendit.example/1' }),
  getPaymentStatus: vi.fn().mockResolvedValue({ status: 'pending', raw: {} }),
  issueRefund: vi.fn().mockResolvedValue({ providerRefundReference: 'r2', status: 'succeeded' }),
  SESSION_DURATION_MS: 60 * 60 * 1000,
}));
vi.mock('../gateways/epaygamesGateway.js', () => ({
  createCheckoutSession: vi.fn().mockResolvedValue({ paymentReference: 'epaygames-ref', redirectUrl: 'https://epaygames.example/1' }),
  getPaymentStatus: vi.fn().mockResolvedValue({ status: 'pending', raw: {} }),
  issueRefund: vi.fn().mockRejectedValue(new Error('ePayGames does not document a refund endpoint')),
  // Phase 4 — paymentService.js's channel/fee dispatch calls these two
  // directly on the same epaygamesGateway module object it already uses
  // for everything else, so this mock needs them too, or a dispatch call
  // would throw "not a function" the moment any Phase 4 test runs.
  getChannels: vi.fn().mockResolvedValue([{ code: 'PAYMAYA_QR', name: 'Maya', slug: 'paymaya', logo: 'https://cdn.eplayment.co/x.jpg', isDisabled: false }]),
  calculateFee: vi.fn().mockResolvedValue({ subtotal: 1000, fee: 0, total: 1000, raw: {} }),
  SESSION_DURATION_MS: 60 * 60 * 1000,
}));

const paymentService = await import('../paymentService.js');
const mayaGateway = await import('../gateways/mayaGateway.js');
const xenditGateway = await import('../gateways/xenditGateway.js');
const epaygamesGateway = await import('../gateways/epaygamesGateway.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('paymentService — gateway registry (Xendit ↔ Maya ↔ ePayGames)', () => {
  it('dispatches to epaygamesGateway when an order\'s paymentMethod is "epaygames"', async () => {
    const order = { orderNumber: 'PS-1', paymentMethod: 'epaygames' };
    const result = await paymentService.createCheckoutSession(order);

    expect(epaygamesGateway.createCheckoutSession).toHaveBeenCalledWith(order);
    expect(xenditGateway.createCheckoutSession).not.toHaveBeenCalled();
    expect(mayaGateway.createCheckoutSession).not.toHaveBeenCalled();
    expect(result).toEqual({ paymentReference: 'epaygames-ref', redirectUrl: 'https://epaygames.example/1' });
  });

  it('still dispatches to xenditGateway unchanged when paymentMethod is "xendit"', async () => {
    await paymentService.createCheckoutSession({ orderNumber: 'PS-2', paymentMethod: 'xendit' });
    expect(xenditGateway.createCheckoutSession).toHaveBeenCalledTimes(1);
    expect(epaygamesGateway.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('still defaults to maya, unchanged, when paymentMethod is absent', async () => {
    await paymentService.createCheckoutSession({ orderNumber: 'PS-3' });
    expect(mayaGateway.createCheckoutSession).toHaveBeenCalledTimes(1);
  });

  it('getPaymentStatus and getSessionDurationMs both resolve epaygames correctly', async () => {
    await paymentService.getPaymentStatus('ref-1', 'epaygames');
    expect(epaygamesGateway.getPaymentStatus).toHaveBeenCalledWith('ref-1');

    expect(paymentService.getSessionDurationMs('epaygames')).toBe(60 * 60 * 1000);
  });

  it('issueRefund surfaces epaygamesGateway\'s own unsupported-refund rejection rather than swallowing it', async () => {
    await expect(paymentService.issueRefund('ref-1', 500, 'REQUESTED_BY_CUSTOMER', 'epaygames'))
      .rejects.toThrow('ePayGames does not document a refund endpoint');
  });

  it('rejects an unsupported gateway name, unchanged behavior', async () => {
    await expect(paymentService.createCheckoutSession({ orderNumber: 'PS-4', paymentMethod: 'not-a-real-gateway' }))
      .rejects.toThrow('Unsupported payment gateway');
  });
});

describe('paymentService — channel/fee dispatch (Phase 4, ePayGames evaluation)', () => {
  it('Xendit getChannels returns the exact existing catalog from lib/payments/xenditFees.js, unchanged', async () => {
    const channels = await paymentService.getChannels('xendit');
    expect(channels).toEqual([
      { code: 'GCASH', label: 'GCash' },
      { code: 'MAYA', label: 'Maya' },
      { code: 'CARD', label: 'Credit/Debit Card' },
      { code: 'APPLE_PAY', label: 'Apple Pay' },
      { code: 'QRPH', label: 'QR Ph' },
    ]);
  });

  it('Maya getChannels returns its one generic hosted-checkout channel, not an invented catalog', async () => {
    const channels = await paymentService.getChannels('maya');
    expect(channels).toEqual([{ code: 'MAYA_CHECKOUT', label: 'Maya Checkout' }]);
  });

  it('ePayGames getChannels dispatches to epaygamesGateway\'s own real, unmodified method', async () => {
    const channels = await paymentService.getChannels('epaygames');
    expect(epaygamesGateway.getChannels).toHaveBeenCalledTimes(1);
    expect(channels).toEqual([{ code: 'PAYMAYA_QR', name: 'Maya', slug: 'paymaya', logo: 'https://cdn.eplayment.co/x.jpg', isDisabled: false }]);
  });

  it('Xendit calculateFee produces the exact existing fee formula, unchanged — CARD is 2.9% + ₱15', async () => {
    const fee = await paymentService.calculateFee('xendit', 'CARD', 599);
    expect(fee).toBe(Math.round((599 * 0.029 + 15) * 100) / 100);
  });

  it('Maya calculateFee is always 0 — no fee was ever disclosed or charged for Maya anywhere in this codebase', async () => {
    const fee = await paymentService.calculateFee('maya', 'MAYA_CHECKOUT', 599);
    expect(fee).toBe(0);
  });

  it('Maya calculateFee rejects any channel other than its one generic channel', async () => {
    await expect(paymentService.calculateFee('maya', 'GCASH', 599)).rejects.toThrow('Unknown payment channel for maya');
  });

  it('ePayGames calculateFee dispatches to epaygamesGateway\'s own method and normalizes its object response down to a plain fee number', async () => {
    const fee = await paymentService.calculateFee('epaygames', 'PAYMAYA_QR', 1000);
    expect(epaygamesGateway.calculateFee).toHaveBeenCalledWith('PAYMAYA_QR', 1000);
    expect(fee).toBe(0); // .fee extracted from the mocked {subtotal, fee, total, raw} object
  });

  it('rejects an unknown gateway for both getChannels and calculateFee, matching resolveGateway\'s existing error', async () => {
    await expect(paymentService.getChannels('not-a-real-gateway')).rejects.toThrow('Unsupported payment gateway');
    await expect(paymentService.calculateFee('not-a-real-gateway', 'ANY', 100)).rejects.toThrow('Unsupported payment gateway');
  });

  it('Xendit calculateFee rejects an unrecognized channel code — never silently returns a fee of 0', async () => {
    await expect(paymentService.calculateFee('xendit', 'BITCOIN', 599)).rejects.toThrow('Unknown payment channel: BITCOIN');
  });
});
