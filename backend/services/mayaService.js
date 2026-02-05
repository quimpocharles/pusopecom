import axios from 'axios';

const MAYA_API_URL = process.env.NODE_ENV === 'production'
  ? 'https://pg.maya.ph'
  : 'https://pg-sandbox.paymaya.com';

const getAuthHeader = () => {
  const publicKey = process.env.MAYA_PUBLIC_KEY;
  const auth = Buffer.from(`${publicKey}:`).toString('base64');
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
          value: item.price,
          details: {
            subtotal: item.price * item.quantity
          }
        },
        totalAmount: {
          value: item.price * item.quantity,
          details: {
            subtotal: item.price * item.quantity
          }
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
    console.error('Maya checkout error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to create checkout session');
  }
};

export const getCheckoutStatus = async (checkoutId) => {
  try {
    const response = await axios.get(
      `${MAYA_API_URL}/checkout/v1/checkouts/${checkoutId}`,
      {
        headers: {
          'Authorization': getAuthHeader()
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Maya status check error:', error.response?.data || error.message);
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
