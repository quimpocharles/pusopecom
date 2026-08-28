import express from 'express';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';
import * as paymentService from '../services/paymentService.js';
import * as siteSettingsRepository from '../repositories/siteSettingsRepository.js';

/**
 * Phase 4 (ePayGames evaluation) — Checkout's own channel/fee source of
 * truth. Backend/Gateway → GET /payment-channels → Checkout.jsx, rather
 * than the frontend keeping a second, manually-synced copy of whichever
 * gateway's channel list. Never exposes gateway credentials/tokens/
 * internal config — only what the checkout UI needs to render a channel
 * picker and preview its fee.
 */
const router = express.Router();

// An explicit allowlist, not just "whatever paymentService.resolveGateway
// happens to have registered" — resolveGateway would already reject an
// unknown name, but this is the one place a client can pick a gateway by
// string, so it stays deliberately closed rather than implicitly
// widening every time a new internal-only gateway is added to GATEWAYS.
const PUBLIC_GATEWAYS = new Set(['xendit', 'maya', 'epaygames']);

async function resolveRequestedGateway(req) {
  const { gateway } = req.query;
  if (gateway === undefined) {
    // The customer-facing checkout never picks a gateway itself — it
    // always reflects whichever one orders are actually being created
    // against right now, the same siteSettingsRepository lookup routes/
    // orders.js's own order-creation route already makes.
    const { payment } = await siteSettingsRepository.get();
    return payment.defaultPaymentGateway;
  }
  if (typeof gateway !== 'string' || !PUBLIC_GATEWAYS.has(gateway)) {
    return null;
  }
  return gateway;
}

// GET /api/payment-channels?gateway=xendit (gateway optional — defaults to
// whichever one is currently active)
router.get('/', async (req, res) => {
  try {
    const gateway = await resolveRequestedGateway(req);
    if (!gateway) {
      return res.status(400).json({ success: false, message: 'Unknown or unsupported payment gateway' });
    }

    const rawChannels = await paymentService.getChannels(gateway);
    // Normalized here, at the HTTP boundary, rather than in paymentService.js
    // or any gateway module — Xendit's/Maya's wrappers already return
    // {code, label}, but epaygamesGateway.getChannels() (Phase 2, untouched)
    // returns {code, name, slug, logo, isDisabled}, matching ePayGames' own
    // documented field names. Checkout.jsx only ever needs one consistent
    // shape regardless of which gateway is active.
    const channels = rawChannels.map((channel) => ({ code: channel.code, label: channel.label ?? channel.name }));
    res.json({ success: true, data: { gateway, channels } });
  } catch (error) {
    logger.error({ err: error, gateway: req.query.gateway }, 'Payment channels lookup error');
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve payment channels' });
  }
});

// GET /api/payment-channels/calculate?channel=CARD&amount=599[&gateway=xendit]
router.get('/calculate', async (req, res) => {
  try {
    const gateway = await resolveRequestedGateway(req);
    if (!gateway) {
      return res.status(400).json({ success: false, message: 'Unknown or unsupported payment gateway' });
    }

    const { channel } = req.query;
    const amount = Number(req.query.amount);
    if (typeof channel !== 'string' || !channel.trim()) {
      return res.status(400).json({ success: false, message: 'A payment channel is required' });
    }
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ success: false, message: 'A valid amount is required' });
    }

    const fee = await paymentService.calculateFee(gateway, channel, amount);
    const total = Math.round((amount + fee) * 100) / 100;
    res.json({ success: true, data: { gateway, channel, amount, fee, total } });
  } catch (error) {
    // An unrecognized channel for this gateway (calculateFee's own
    // validation) surfaces the same way a real transport failure would —
    // both are "can't safely price this right now," and this endpoint
    // must never guess a fee of 0 for either case. The authoritative check
    // still happens again at real order-creation time either way.
    logger.warn({ err: error, gateway: req.query.gateway, channel: req.query.channel }, 'Payment fee calculation rejected');
    res.status(400).json({ success: false, message: error.message || 'Failed to calculate fee for this channel' });
  }
});

export default router;
