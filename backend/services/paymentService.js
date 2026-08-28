import * as mayaGateway from './gateways/mayaGateway.js';
import * as xenditGateway from './gateways/xenditGateway.js';
import * as epaygamesGateway from './gateways/epaygamesGateway.js';
import * as xenditFees from '../lib/payments/xenditFees.js';
import logger from '../lib/logger.js';

/**
 * The internal interface routes/orders.js talks to — never a specific
 * gateway's SDK/API shape directly. Xendit is the primary gateway as of
 * ADR-010; Maya stays registered through the transition window so any
 * order already mid-checkout on it still resolves correctly. Adding
 * another gateway (Stripe, PayMongo...) means writing one more module
 * matching this same two-function shape and adding one line to GATEWAYS
 * below — nothing above this layer needs to change.
 *
 * Every gateway module must implement:
 *   createCheckoutSession(order) -> { paymentReference, redirectUrl }
 *   getPaymentStatus(paymentReference) -> { status: 'pending'|'succeeded'|'failed'|'expired', raw }
 *
 * `status` is gateway-agnostic and is what applyPaymentResolution (routes/
 * orders.js) branches on — `raw` carries the gateway's own untouched
 * response for logging/debugging, never for business decisions.
 *
 * "Issue Refund" and "Handle Webhook" are named in the interface this is
 * meant to eventually cover but have no real implementation to abstract
 * yet: there's no refund flow anywhere in the platform, and Maya's own
 * webhook has no verifiable signature scheme (see routes/orders.js's
 * webhook handler comment) — its handling is a thin, Maya-specific
 * "treat the POST as a wake-up signal, then call getPaymentStatus"
 * shim that lives in the route itself. Deliberately not stubbed here
 * with no real behavior behind them; add them alongside their first
 * actual caller rather than speculatively now.
 */
const GATEWAYS = {
  maya: mayaGateway,
  xendit: xenditGateway,
  epaygames: epaygamesGateway,
};

function resolveGateway(name) {
  const gateway = GATEWAYS[name];
  if (!gateway) throw new Error(`Unsupported payment gateway: ${name}`);
  return gateway;
}

/**
 * Payment Channel + Fee Dispatch (Phase 4, ePayGames evaluation) —
 * getChannels/calculateFee for each gateway, kept separate from GATEWAYS
 * above rather than added as new exports on xenditGateway.js/mayaGateway.js
 * themselves (both explicitly out of scope to modify this phase).
 *
 * - epaygames: its own real methods, unchanged since Phase 2 — a live,
 *   per-merchant channel catalog and a live fee-calculation call, since
 *   there's no static table to fall back to even if there wanted to be one.
 * - xendit: wraps lib/payments/xenditFees.js's existing CHANNELS constant
 *   and calculateGatewayFee exactly as they already are — same channel
 *   codes, same fee formula, same placeholder-rate caveat that file's own
 *   header comment already documents. Nothing here changes what Xendit
 *   checkout actually costs or which channels it offers.
 * - maya: Maya's own hosted checkout page is where a customer actually
 *   picks GCash/card/etc., AFTER redirect — unlike Xendit's PusoStore-side
 *   channel selection before redirect. There has never been a per-channel
 *   catalog or a disclosed fee for Maya anywhere in this codebase, so this
 *   is a single generic channel representing that one hosted flow, with a
 *   fee of 0 — the minimal compatible shape the generic checkout code
 *   needs, not an invented fee schedule.
 */
const CHANNEL_PROVIDERS = {
  epaygames: epaygamesGateway,
  xendit: {
    async getChannels() {
      return xenditFees.CHANNELS.map((channel) => ({ code: channel.code, label: channel.label }));
    },
    async calculateFee(channelCode, amount) {
      return xenditFees.calculateGatewayFee(channelCode, amount); // throws on an unrecognized channel, unchanged
    },
  },
  maya: {
    async getChannels() {
      return [{ code: 'MAYA_CHECKOUT', label: 'Maya Checkout' }];
    },
    async calculateFee(channelCode) {
      if (channelCode !== 'MAYA_CHECKOUT') {
        throw new Error(`Unknown payment channel for maya: ${channelCode}`);
      }
      return 0;
    },
  },
};

function resolveChannelProvider(name) {
  const provider = CHANNEL_PROVIDERS[name];
  if (!provider) throw new Error(`Unsupported payment gateway: ${name}`);
  return provider;
}

export async function createCheckoutSession(order) {
  const gatewayName = order.paymentMethod || 'maya';
  const gateway = resolveGateway(gatewayName);
  const start = Date.now();
  try {
    const session = await gateway.createCheckoutSession(order);
    logger.info(
      { orderNumber: order.orderNumber, gateway: gatewayName, processingTimeMs: Date.now() - start },
      'Checkout session created'
    );
    return session;
  } catch (error) {
    logger.error(
      { err: error, orderNumber: order.orderNumber, gateway: gatewayName, processingTimeMs: Date.now() - start },
      'Checkout session creation failed'
    );
    throw error;
  }
}

export async function getPaymentStatus(paymentReference, gatewayName = 'maya') {
  const gateway = resolveGateway(gatewayName);
  return gateway.getPaymentStatus(paymentReference);
}

/**
 * How long a freshly created checkout session is valid for, per gateway —
 * used to compute and store Payment.expiresAt at creation time, since no
 * gateway implemented so far returns an expiration in its own response
 * (confirmed for Maya; see mayaGateway.js's SESSION_DURATION_MS comment).
 * Falls back to null (no known/enforced expiry) for a gateway that hasn't
 * declared one, rather than guessing a duration.
 */
export function getSessionDurationMs(gatewayName = 'maya') {
  const gateway = resolveGateway(gatewayName);
  return gateway.SESSION_DURATION_MS ?? null;
}

// Enterprise Fulfillment Blueprint, Phase 2 — the "Issue Refund" half of
// this interface, finally called for real (routes/refunds.js).
export async function issueRefund(providerPaymentReference, amount, reason, gatewayName = 'maya') {
  const gateway = resolveGateway(gatewayName);
  if (!gateway.issueRefund) {
    throw new Error(`Gateway "${gatewayName}" does not support refunds`);
  }
  return gateway.issueRefund(providerPaymentReference, amount, reason);
}

// Phase 4 (ePayGames evaluation) — the customer-safe channel list for
// whichever gateway is asked for, so generic checkout code (and the
// routes/paymentChannels.js endpoint the frontend calls) never needs to
// import a specific gateway's fee table directly.
export async function getChannels(gatewayName) {
  const provider = resolveChannelProvider(gatewayName);
  return provider.getChannels();
}

// The fee for one channel/amount, normalized to a plain number regardless
// of whether the underlying implementation returns one directly (Xendit's
// local formula, Maya's fixed 0) or a richer object (ePayGames' live
// Calculate Total w/ Fee response, which also carries subtotal/total/raw —
// only .fee is a generic checkout concern; that endpoint's own richer
// shape is still available to anything calling epaygamesGateway directly).
export async function calculateFee(gatewayName, channelCode, amount) {
  const provider = resolveChannelProvider(gatewayName);
  const result = await provider.calculateFee(channelCode, amount);
  return typeof result === 'number' ? result : result.fee;
}

export default { createCheckoutSession, getPaymentStatus, getSessionDurationMs, issueRefund, getChannels, calculateFee };
