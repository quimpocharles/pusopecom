import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import LoadingSpinner from '../components/common/LoadingSpinner';
import orderService from '../services/orderService';

const OrderConfirmation = () => {
  const { orderNumber } = useParams();
  const [searchParams] = useSearchParams();
  const paymentStatus = searchParams.get('payment');

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        // If returning from Maya with success, verify payment status first
        if (paymentStatus === 'success') {
          await orderService.verifyPayment(orderNumber).catch(() => {});
        }

        const response = await orderService.getOrderByNumber(orderNumber);
        setOrder(response.data);
      } catch (err) {
        setError('Order not found');
      } finally {
        setLoading(false);
      }
    };

    if (orderNumber) {
      fetchOrder();
    }
  }, [orderNumber, paymentStatus]);

  if (loading) {
    return (
      <Layout>
        <LoadingSpinner />
      </Layout>
    );
  }

  if (error || !order) {
    return (
      <Layout>
        <div className="container-custom py-12 text-center">
          <h1 className="text-2xl font-bold text-gray-700 mb-4">{error || 'Order not found'}</h1>
          <Link to="/" className="btn-primary inline-block">
            Return to Home
          </Link>
        </div>
      </Layout>
    );
  }

  const isPaymentSuccess = paymentStatus === 'success' || order.paymentStatus === 'paid';

  return (
    <Layout>
      <div className="container-custom py-12">
        <div className="max-w-3xl mx-auto">
          {/* Success/Failure Message */}
          <div className={`card p-8 text-center mb-8 ${
            isPaymentSuccess ? 'bg-green-50' : 'bg-yellow-50'
          }`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              isPaymentSuccess ? 'bg-green-100' : 'bg-yellow-100'
            }`}>
              {isPaymentSuccess ? (
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
            </div>
            <h1 className="text-2xl font-bold mb-2">
              {isPaymentSuccess ? 'Order Confirmed!' : 'Payment Pending'}
            </h1>
            <p className="text-gray-600">
              {isPaymentSuccess
                ? 'Thank you for your order. We\'ll send you a confirmation email shortly.'
                : 'Your order has been created but payment is still pending.'}
            </p>
          </div>

          {/* Order Details */}
          <div className="card p-8">
            <h2 className="text-xl font-bold mb-4">Order Details</h2>

            <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b">
              <div>
                <p className="text-sm text-gray-600">Order Number</p>
                <p className="font-semibold">{order.orderNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Order Date</p>
                <p className="font-semibold">
                  {new Date(order.createdAt).toLocaleDateString('en-PH')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Payment Status</p>
                <p className={`font-semibold capitalize ${
                  order.paymentStatus === 'paid' ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {order.paymentStatus}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Order Status</p>
                <p className="font-semibold capitalize">{order.orderStatus}</p>
              </div>
            </div>

            {/* Items */}
            <h3 className="font-bold mb-3">Items</h3>
            <div className="space-y-3 mb-6 pb-6 border-b">
              {order.items.map((item, index) => (
                <div key={index} className="flex gap-4">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-16 h-16 object-cover rounded"
                  />
                  <div className="flex-1">
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-gray-600">
                      Size: {item.size} | Qty: {item.quantity}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      ₱{(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Shipping Address */}
            <h3 className="font-bold mb-3">Shipping Address</h3>
            <div className="mb-6 pb-6 border-b">
              <p>{order.shippingAddress.fullName}</p>
              <p>{order.shippingAddress.phone}</p>
              <p>{order.shippingAddress.address}</p>
              <p>
                {order.shippingAddress.city}, {order.shippingAddress.province}{' '}
                {order.shippingAddress.zipCode}
              </p>
            </div>

            {/* Total */}
            <div className="space-y-2">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>₱{order.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span>₱{order.shippingFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>Total</span>
                <span className="text-primary-600">₱{order.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="text-center mt-8">
            <Link to="/products" className="btn-primary inline-block">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default OrderConfirmation;
