import axios from 'axios';
import logger from '../lib/logger.js';
import Sentry from '../lib/sentry.js';

const MAYA_API_URL = process.env.MAYA_SANDBOX === 'true'
  ? 'https://pg-sandbox.paymaya.com'
  : 'https://pg.maya.ph';

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

export const createCheckout = async (order) => {
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
      requestReferenceNumber: order.orderNumber,
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
      checkoutId: response.data.checkoutId,
      redirectUrl: response.data.redirectUrl
    };
  } catch (error) {
    logger.error({ err: error }, 'Maya checkout error');
    Sentry.captureException(error);
    throw new Error(error.response?.data?.message || 'Failed to create checkout session');
  }
};

export const getCheckoutStatus = async (checkoutId) => {
  try {
    const response = await axios.get(
      `${MAYA_API_URL}/checkout/v1/checkouts/${checkoutId}`,
      {
        headers: {
          'Authorization': getSecretAuthHeader()
        }
      }
    );

    return response.data;
  } catch (error) {
    logger.error({ err: error }, 'Maya status check error');
    Sentry.captureException(error);
    throw new Error('Failed to retrieve checkout status');
  }
};

export const verifyWebhook = (webhookData) => {
  return webhookData && webhookData.status === 'PAYMENT_SUCCESS';
};

export default {
  createCheckout,
  getCheckoutStatus,
  verifyWebhook
};
