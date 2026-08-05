import axios from 'axios';
import logger from '../../lib/logger.js';
import Sentry from '../../lib/sentry.js';

/**
 * Maya's own implementation of the gateway interface paymentService.js
 * defines — createCheckoutSession(order) and getPaymentStatus(reference)
 * with the exact shapes documented there. Moved from the former
 * services/mayaService.js verbatim except for the two return shapes,
 * which are now gateway-agnostic (paymentReference instead of Maya's own
 * checkoutId; a normalized status instead of Maya's PAYMENT_* vocabulary).
 */

const MAYA_API_URL = process.env.MAYA_SANDBOX === 'true'
  ? 'https://pg-sandbox.paymaya.com'
  : 'https://pg.maya.ph';

// Maya's Checkout API returns no expiration field on the session it
// creates, and developers.maya.ph documents session validity as a fixed,
// non-configurable 1 hour — verified directly against their docs before
// this was hardcoded here. Payment.expiresAt is computed from this at
// checkout-session creation time, never read off a Maya response.
export const SESSION_DURATION_MS = 60 * 60 * 1000;

const getAuthHeader = () => {
  const publicKey = process.env.MAYA_PUBLIC_KEY;
  const auth = Buffer.from(`${publicKey}:`).toString('base64');
  return `Basic ${auth}`;
};

const getSecretAuthHeader = () => {
  const secretKey = process.env.MAYA_SECRET_KEY;
  const auth = Buffer.from(`${secretKey}:`).toString('base64');
  return `Basic ${auth}`;
};

// Maya's own status vocabulary, normalized to the four-state one every
// gateway module reports through paymentService.js. Anything Maya returns
// that isn't one of the two explicit terminal states below is treated as
// still pending — the same fallthrough applyPaymentResolution (routes/
// orders.js) always had, just made an explicit table instead of an
// implicit else-branch.
const STATUS_MAP = {
  PAYMENT_SUCCESS: 'succeeded',
  PAYMENT_FAILED: 'failed',
  PAYMENT_EXPIRED: 'expired',
};

function normalizeStatus(mayaStatus) {
  return STATUS_MAP[mayaStatus] || 'pending';
}

export async function createCheckoutSession(order) {
  try {
    const checkoutData = {
      totalAmount: {
        value: order.total,
        currency: 'PHP'
      },
      buyer: {
        firstName: order.shippingAddress.fullName.split(' ')[0],
        lastName: order.shippingAddress.fullName.split(' ').slice(1).join(' ') || '',
        contact: {
          phone: order.shippingAddress.phone,
          email: order.email
        },
        shippingAddress: {
          firstName: order.shippingAddress.fullName.split(' ')[0],
          lastName: order.shippingAddress.fullName.split(' ').slice(1).join(' ') || '',
          phone: order.shippingAddress.phone,
          line1: order.shippingAddress.address,
          line2: '',
          city: order.shippingAddress.city,
          state: order.shippingAddress.province,
          zipCode: order.shippingAddress.zipCode,
          countryCode: 'PH'
        }
      },
      items: order.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        code: item.product.toString(),
        description: `${item.name} - Size: ${item.size}`,
        amount: {
          value: item.price
        },
        totalAmount: {
          value: item.price * item.quantity
        }
      })),
      redirectUrl: {
        success: `${process.env.FRONTEND_URL}/order/${order.orderNumber}?payment=success`,
        failure: `${process.env.FRONTEND_URL}/order/${order.orderNumber}?payment=failed`,
        cancel: `${process.env.FRONTEND_URL}/checkout?payment=cancelled`
      },
      // Unique per checkout attempt, not just per order. Reusing the bare
      // order number on every "Generate New Payment Link" regeneration
      // (Payment Platform Redesign, Phase 3) was reproduced handing back a
      // reference to the SAME underlying Maya checkout session as the
      // original attempt — which, being the one that already lapsed, sends
      // the customer straight to Maya's "Invalid Request... already
      // expired" page instead of a genuinely new, live session. The order
      // number is still the prefix (parsed back out in routes/orders.js's
      // webhook handler via requestReferenceNumber.split('#')[0]), so
      // reconciliation is unaffected — Maya just can never conflate two
      // different attempts as the same request again.
      requestReferenceNumber: `${order.orderNumber}#${Date.now()}`,
      metadata: {
        orderNumber: order.orderNumber,
        userId: order.user?.toString() || 'guest'
      }
    };

    const response = await axios.post(
      `${MAYA_API_URL}/checkout/v1/checkouts`,
      checkoutData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader()
        }
      }
    );

    return {
      paymentReference: response.data.checkoutId,
      redirectUrl: response.data.redirectUrl
    };
  } catch (error) {
    logger.error({ err: error, orderNumber: order.orderNumber, gateway: 'maya' }, 'Maya checkout error');
    Sentry.captureException(error);
    throw new Error(error.response?.data?.message || 'Failed to create checkout session');
  }
}

export async function getPaymentStatus(paymentReference) {
  try {
    const response = await axios.get(
      `${MAYA_API_URL}/checkout/v1/checkouts/${paymentReference}`,
      {
        headers: {
          'Authorization': getSecretAuthHeader()
        }
      }
    );

    return {
      status: normalizeStatus(response.data.paymentStatus),
      raw: response.data,
    };
  } catch (error) {
    logger.error({ err: error, paymentReference, gateway: 'maya' }, 'Maya status check error');
    Sentry.captureException(error);
    throw new Error('Failed to retrieve checkout status');
  }
}

export default {
  createCheckoutSession,
  getPaymentStatus,
  SESSION_DURATION_MS,
};
