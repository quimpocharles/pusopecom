import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Phase 4 (ePayGames evaluation) — a focused, no-DB route test. Both
// dependencies are mocked directly rather than exercising real gateways or
// the real site_settings table; paymentService's own dispatch logic is
// already covered by services/__tests__/paymentService.test.js.
vi.mock('../../services/paymentService.js', () => ({
  getChannels: vi.fn(),
  calculateFee: vi.fn(),
}));
vi.mock('../../repositories/siteSettingsRepository.js', () => ({
  get: vi.fn(),
}));

const { default: paymentChannelsRouter } = await import('../paymentChannels.js');
const paymentService = await import('../../services/paymentService.js');
const siteSettingsRepository = await import('../../repositories/siteSettingsRepository.js');

const app = express();
app.use(express.json());
app.use('/api/payment-channels', paymentChannelsRouter);

beforeEach(() => {
  vi.clearAllMocks();
  siteSettingsRepository.get.mockResolvedValue({ payment: { defaultPaymentGateway: 'xendit' } });
});

describe('GET /payment-channels', () => {
  it('returns channels for the explicitly requested, supported gateway', async () => {
    paymentService.getChannels.mockResolvedValueOnce([{ code: 'GCASH', label: 'GCash' }]);

    const res = await request(app).get('/api/payment-channels?gateway=epaygames');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ gateway: 'epaygames', channels: [{ code: 'GCASH', label: 'GCash' }] });
    expect(paymentService.getChannels).toHaveBeenCalledWith('epaygames');
  });

  it('normalizes epaygamesGateway\'s real {code, name, ...} shape (Phase 2) down to {code, label} for the frontend — Phase 5 fix', async () => {
    // epaygamesGateway.getChannels() (Phase 2, untouched) returns `name`,
    // not `label`, plus fields (slug/logo/isDisabled) the checkout UI
    // never needs — this is the exact real shape, not a simplified stand-in.
    paymentService.getChannels.mockResolvedValueOnce([
      { code: 'PAYMAYA_QR', name: 'Maya', slug: 'paymaya', logo: 'https://cdn.eplayment.co/x.jpg', isDisabled: false },
      { code: 'GCASH_TRN', name: 'GCash', slug: 'gcash-trn', logo: 'https://cdn.eplayment.co/y.png', isDisabled: false },
    ]);

    const res = await request(app).get('/api/payment-channels?gateway=epaygames');
    expect(res.status).toBe(200);
    expect(res.body.data.channels).toEqual([
      { code: 'PAYMAYA_QR', label: 'Maya' },
      { code: 'GCASH_TRN', label: 'GCash' },
    ]);
  });

  it('defaults to the currently active gateway (site setting) when none is specified in the query', async () => {
    siteSettingsRepository.get.mockResolvedValueOnce({ payment: { defaultPaymentGateway: 'maya' } });
    paymentService.getChannels.mockResolvedValueOnce([{ code: 'MAYA_CHECKOUT', label: 'Maya Checkout' }]);

    const res = await request(app).get('/api/payment-channels');
    expect(res.status).toBe(200);
    expect(res.body.data.gateway).toBe('maya');
    expect(paymentService.getChannels).toHaveBeenCalledWith('maya');
  });

  it('rejects an unknown/unsupported gateway name cleanly — never lets the client pick an arbitrary internal name', async () => {
    const res = await request(app).get('/api/payment-channels?gateway=stripe');
    expect(res.status).toBe(400);
    expect(paymentService.getChannels).not.toHaveBeenCalled();
  });

  it('never exposes gateway credentials or internal config — only whatever paymentService.getChannels itself returns', async () => {
    paymentService.getChannels.mockResolvedValueOnce([{ code: 'GCASH', label: 'GCash' }]);
    const res = await request(app).get('/api/payment-channels?gateway=xendit');
    expect(JSON.stringify(res.body)).not.toMatch(/secret|token|key|password/i);
  });

  it('500s cleanly (without leaking internals) if the gateway dispatch itself throws unexpectedly', async () => {
    paymentService.getChannels.mockRejectedValueOnce(new Error('boom'));
    const res = await request(app).get('/api/payment-channels?gateway=xendit');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /payment-channels/calculate', () => {
  it('returns the fee/total for a valid gateway/channel/amount', async () => {
    paymentService.calculateFee.mockResolvedValueOnce(17.98);

    const res = await request(app).get('/api/payment-channels/calculate?gateway=xendit&channel=CARD&amount=599');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ gateway: 'xendit', channel: 'CARD', amount: 599, fee: 17.98, total: 616.98 });
  });

  it('rejects a missing channel with a 400, never calling calculateFee', async () => {
    const res = await request(app).get('/api/payment-channels/calculate?gateway=xendit&amount=599');
    expect(res.status).toBe(400);
    expect(paymentService.calculateFee).not.toHaveBeenCalled();
  });

  it('rejects a negative or non-numeric amount with a 400', async () => {
    const res = await request(app).get('/api/payment-channels/calculate?gateway=xendit&channel=CARD&amount=-5');
    expect(res.status).toBe(400);
    expect(paymentService.calculateFee).not.toHaveBeenCalled();
  });

  it('rejects an unknown gateway before ever touching paymentService', async () => {
    const res = await request(app).get('/api/payment-channels/calculate?gateway=stripe&channel=CARD&amount=599');
    expect(res.status).toBe(400);
    expect(paymentService.calculateFee).not.toHaveBeenCalled();
  });

  it('400s (not 500) when calculateFee rejects an unsupported channel for the gateway — never guesses a fee of 0', async () => {
    paymentService.calculateFee.mockRejectedValueOnce(new Error('Unknown payment channel: BITCOIN'));
    const res = await request(app).get('/api/payment-channels/calculate?gateway=xendit&channel=BITCOIN&amount=599');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Unknown payment channel/);
  });
});
