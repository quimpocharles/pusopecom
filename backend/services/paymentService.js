import * as mayaGateway from './gateways/mayaGateway.js';
import logger from '../lib/logger.js';

/**
 * The internal interface routes/orders.js talks to — never a specific
 * gateway's SDK/API shape directly. Maya is the only gateway implemented
 * today; adding another (Stripe, PayMongo, Xendit...) means writing one
 * more module matching this same two-function shape and adding one line
 * to GATEWAYS below — nothing above this layer needs to change.
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
};

function resolveGateway(name) {
  const gateway = GATEWAYS[name];
  if (!gateway) throw new Error(`Unsupported payment gateway: ${name}`);
  return gateway;
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

export default { createCheckoutSession, getPaymentStatus, getSessionDurationMs, issueRefund };
