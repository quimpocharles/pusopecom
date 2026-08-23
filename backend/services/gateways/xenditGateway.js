import axios from 'axios';
import crypto from 'crypto';
import logger from '../../lib/logger.js';
import Sentry from '../../lib/sentry.js';

/**
 * Xendit's implementation of the gateway interface paymentService.js
 * defines — createCheckoutSession(order) and getPaymentStatus(reference)
 * with the exact shapes documented there. Uses the Payment Sessions API
 * (PAYMENT_LINK mode — a Xendit-hosted redirect checkout, the closest match
 * to how mayaGateway.js already works) rather than the older Invoices API.
 *
 * Unlike Maya, there is one API base URL for both environments — sandbox
 * vs. live is entirely which key prefix XENDIT_SECRET_KEY has
 * (xnd_development_... vs xnd_production_...), not a separate hostname.
 *
 * Endpoint path and response field names verified against
 * docs.xendit.co/apidocs/create-session (2026-08-20) — the initial write
 * guessed `/v3/sessions`, which 404'd against a live account; the real
 * path is `/sessions`. Response field names (payment_session_id,
 * payment_link_url, status) were already correct.
 */

const XENDIT_API_URL = 'https://api.xendit.co';

// Xendit's own default is 30 minutes; explicitly overridden here for UX
// parity with the "resume/regenerate" window customers already expect from
// Maya's fixed 1-hour session (the threshold routes/orders.js's
// `/:orderNumber/pay` route checks Payment.expiresAt against).
export const SESSION_DURATION_MS = 60 * 60 * 1000;

const getAuthHeader = () => {
  const secretKey = process.env.XENDIT_SECRET_KEY;
  const auth = Buffer.from(`${secretKey}:`).toString('base64');
  return `Basic ${auth}`;
};

// Our internal channel codes (lib/payments/xenditFees.js) mapped to
// Xendit's own channel_code vocabulary. GCASH and CARDS confirmed against
// a live account (2026-08-20) — CARD was originally guessed as CREDIT_CARD,
// which Xendit rejected ("channel(s) CREDIT_CARD are not available"); the
// real code is CARDS. BANK_TRANSFER (guessed as VIRTUAL_ACCOUNT) was
// removed outright rather than re-guessed — Xendit rejected that too, and
// the dashboard shows PH bank transfer per-bank (BPI/RCBC/UBP), not as one
// generic channel, so it needs real per-bank codes, not just a fixed
// string. APPLE_PAY is a fresh, unverified guess — confirm it against a
// live checkout attempt before trusting it; MAYA/QRPH remain unverified
// placeholders too.
const CHANNEL_CODE_MAP = {
  GCASH: 'GCASH',
  MAYA: 'PAYMAYA',
  CARD: 'CARDS',
  APPLE_PAY: 'APPLE_PAY',
  QRPH: 'QRPH',
};

// Xendit's Payment Session status vocabulary, normalized to the four-state
// one every gateway module reports through paymentService.js — same
// fallthrough-to-pending convention mayaGateway.js's STATUS_MAP uses.
const STATUS_MAP = {
  COMPLETED: 'succeeded',
  EXPIRED: 'expired',
  CANCELED: 'failed',
};

function normalizeStatus(xenditStatus) {
  return STATUS_MAP[xenditStatus] || 'pending';
}

// Xendit requires E.164 (+63917...); every other part of the platform
// stores/collects PH mobile numbers in local format (09171234567).
function toE164PH(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.startsWith('63')) return `+${digits}`;
  if (digits.startsWith('0')) return `+63${digits.slice(1)}`;
  return `+63${digits}`;
}

export async function createCheckoutSession(order) {
  try {
    const channelCode = CHANNEL_CODE_MAP[order.paymentChannel];
    if (!channelCode) {
      throw new Error(`Unrecognized payment channel: ${order.paymentChannel}`);
    }

    const sessionData = {
      reference_id: `${order.orderNumber}#${crypto.randomBytes(6).toString('hex')}`,
      currency: 'PHP',
      amount: order.total,
      country: 'PH',
      session_type: 'PAY',
      mode: 'PAYMENT_LINK',
      customer: {
        type: 'INDIVIDUAL',
        // Xendit's Sessions API creates a Customer record inline from this
        // object and rejects a reference_id it's already seen — scoped to
        // order.user, the same signed-in customer's second-ever order would
        // collide with their first. Order-scoped instead, since nothing
        // here needs a persistent Xendit customer profile reused across
        // orders yet (that's recurring/Membership billing, not built).
        reference_id: `${order.user?.toString() || 'guest'}-${order.orderNumber}`,
        email: order.email,
        mobile_number: toE164PH(order.shippingAddress.phone),
        individual_detail: {
          given_names: order.shippingAddress.fullName.split(' ')[0],
          surname: order.shippingAddress.fullName.split(' ').slice(1).join(' ') || order.shippingAddress.fullName.split(' ')[0],
        },
      },
      items: order.items.map((item) => ({
        reference_id: item.product.toString(),
        name: item.name,
        quantity: item.quantity,
        net_unit_amount: item.price,
        type: 'PHYSICAL_PRODUCT',
        category: 'Merchandise',
      })),
      allowed_payment_channels: [channelCode],
      success_return_url: `${process.env.FRONTEND_URL}/order/${order.orderNumber}?payment=success`,
      cancel_return_url: `${process.env.FRONTEND_URL}/checkout?payment=cancelled`,
      expires_at: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
      metadata: {
        orderNumber: order.orderNumber,
        userId: order.user?.toString() || 'guest',
      },
    };

    const response = await axios.post(`${XENDIT_API_URL}/sessions`, sessionData, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: getAuthHeader(),
      },
    });

    return {
      paymentReference: response.data.payment_session_id,
      redirectUrl: response.data.payment_link_url,
    };
  } catch (error) {
    logger.error({ err: error, orderNumber: order.orderNumber, gateway: 'xendit' }, 'Xendit checkout error');
    Sentry.captureException(error);
    throw new Error(error.response?.data?.message || 'Failed to create checkout session');
  }
}

export async function getPaymentStatus(paymentReference) {
  try {
    const response = await axios.get(`${XENDIT_API_URL}/sessions/${paymentReference}`, {
      headers: {
        Authorization: getAuthHeader(),
      },
    });

    return {
      status: normalizeStatus(response.data.status),
      raw: response.data,
    };
  } catch (error) {
    logger.error({ err: error, paymentReference, gateway: 'xendit' }, 'Xendit status check error');
    Sentry.captureException(error);
    throw new Error('Failed to retrieve checkout status');
  }
}

/**
 * Refunds a settled payment by its Xendit payment_id (Payment.
 * providerPaymentReference here, not the session id). `reason` is mapped to
 * Xendit's enum, defaulting to REQUESTED_BY_CUSTOMER — the same "customer
 * return" default mayaGateway.js's issueRefund already uses.
 */
const REFUND_REASONS = new Set(['FRAUDULENT', 'DUPLICATE', 'REQUESTED_BY_CUSTOMER', 'CANCELLATION', 'OTHERS']);

export async function issueRefund(providerPaymentReference, amount, reason) {
  try {
    const normalizedReason = REFUND_REASONS.has(reason) ? reason : 'REQUESTED_BY_CUSTOMER';

    const response = await axios.post(
      `${XENDIT_API_URL}/refunds`,
      {
        payment_request_id: providerPaymentReference,
        reference_id: `refund-${providerPaymentReference}-${crypto.randomBytes(6).toString('hex')}`,
        currency: 'PHP',
        amount,
        reason: normalizedReason,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: getAuthHeader(),
        },
      }
    );

    return {
      providerRefundReference: response.data.id,
      status: response.data.status === 'SUCCEEDED' ? 'succeeded' : 'processing',
      raw: response.data,
    };
  } catch (error) {
    logger.error({ err: error, providerPaymentReference, gateway: 'xendit' }, 'Xendit refund error');
    Sentry.captureException(error);
    throw new Error(error.response?.data?.message || 'Failed to issue refund');
  }
}

export default {
  createCheckoutSession,
  getPaymentStatus,
  issueRefund,
  SESSION_DURATION_MS,
};
