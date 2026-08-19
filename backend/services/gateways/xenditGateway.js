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
 * The exact endpoint path/response field names below were built from
 * Xendit's public docs (docs.xendit.co/apidocs/create-session,
 * .../get-session) but not verified against a live account at write time —
 * confirm both against a real Xendit sandbox account (Dashboard > API
 * Reference) before treating this as final. XENDIT_API_URL is a single
 * constant for exactly this reason: one place to correct if the path is
 * wrong.
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
// Xendit's own channel_code vocabulary — confirm each of these against the
// Dashboard's channel list before going live; GCASH and CARD are
// well-documented, the rest are best-available-source placeholders.
const CHANNEL_CODE_MAP = {
  GCASH: 'GCASH',
  MAYA: 'PAYMAYA',
  CARD: 'CREDIT_CARD',
  BANK_TRANSFER: 'VIRTUAL_ACCOUNT',
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
        reference_id: order.user?.toString() || `guest-${order.orderNumber}`,
        email: order.email,
        mobile_number: order.shippingAddress.phone,
        individual_detail: {
          given_names: order.shippingAddress.fullName.split(' ')[0],
          surname: order.shippingAddress.fullName.split(' ').slice(1).join(' ') || order.shippingAddress.fullName.split(' ')[0],
        },
      },
      items: order.items.map((item) => ({
        reference_id: item.product.toString(),
        name: item.name,
        quantity: item.quantity,
        price: item.price,
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

    const response = await axios.post(`${XENDIT_API_URL}/v3/sessions`, sessionData, {
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
    const response = await axios.get(`${XENDIT_API_URL}/v3/sessions/${paymentReference}`, {
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
