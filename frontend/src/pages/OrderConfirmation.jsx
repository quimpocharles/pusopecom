import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { CheckIcon, ExclamationTriangleIcon, XMarkIcon, DocumentArrowDownIcon, ClipboardDocumentIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import Layout from '../components/layout/Layout';
import LoadingSpinner from '../components/common/LoadingSpinner';
import OrderTimeline from '../components/orders/OrderTimeline';
import CompletePaymentButton from '../components/orders/CompletePaymentButton';
import orderService from '../services/orderService';
import useCartStore from '../store/cartStore';
import usePassCartStore from '../store/passCartStore';
import { toTitleCase } from '../utils/text';
import { orderStatusLabel } from '../utils/orderStatus';
import { downloadOrderSummaryPdf } from '../utils/orderPdf';
import usePaymentCountdown from '../hooks/usePaymentCountdown';

const SUPPORT_EMAIL = 'support@pusopilipinas.com';

// Payment Platform Redesign, Phase 3 — every state a customer can land on
// this page in gets its own honest copy. "Customers should never ask
// 'what do I do now?'" is the whole point: a failed or expired payment
// reads as recoverable ("try again", "generate a new link"), never as a
// dead-end failed purchase — the order itself was never lost.
const HERO_CONTENT = {
  paid: {
    title: 'Order Confirmed!',
    tone: 'success',
    body: "Thank you for your order. We'll send you a confirmation email shortly.",
  },
  awaiting_payment: {
    title: 'Complete Your Payment',
    tone: 'pending',
    body: 'Your order is saved and your items are reserved — just finish payment to lock it in.',
  },
  failed_payment: {
    title: "Payment Didn't Go Through",
    tone: 'pending',
    body: "No problem — your order is still here. Try completing payment again below.",
  },
  expired: {
    title: 'Your Payment Session Expired',
    tone: 'pending',
    body: "Your order wasn't lost — generate a new payment link to finish checking out.",
  },
  cancelled: {
    title: 'Order Cancelled',
    tone: 'cancelled',
    body: 'This order has been cancelled. Contact support if this seems wrong.',
  },
};
// Every other status (processing/packed/shipped/delivered/returned) means
// payment already succeeded — same "paid" hero, the Order Timeline below
// is what actually communicates further progress.
const heroFor = (order) => HERO_CONTENT[order.orderStatus] || HERO_CONTENT.paid;

const InfoRow = ({ label, value }) => (
  <div className="flex justify-between gap-4 text-sm">
    <dt className="text-gray-500">{label}</dt>
    <dd className="font-medium text-gray-900 text-right">{value}</dd>
  </div>
);

const OrderConfirmation = () => {
  const { orderNumber } = useParams();
  const [searchParams] = useSearchParams();
  const paymentStatusParam = searchParams.get('payment');

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        // If returning from Maya with success, verify payment status first
        if (paymentStatusParam === 'success') {
          await orderService.verifyPayment(orderNumber).catch(() => {});
        }

        const response = await orderService.getOrderByNumber(orderNumber);
        setOrder(response.data);

        // Clear cart after successful payment
        if (paymentStatusParam === 'success' || response.data.paymentStatus === 'paid') {
          useCartStore.getState().clearCart();
          usePassCartStore.getState().clear();
        }
      } catch (err) {
        setError('Order not found');
      } finally {
        setLoading(false);
      }
    };

    if (orderNumber) {
      fetchOrder();
    }
  }, [orderNumber, paymentStatusParam]);

  const paymentExpiresAt = order?.payment?.status === 'pending' ? order.payment.expiresAt : null;
  const { formatted: timeRemaining, isExpired: countdownExpired } = usePaymentCountdown(paymentExpiresAt);

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

  const hero = heroFor(order);
  // Cancelled orders and already-paid orders are the only two states with
  // nothing left to pay — every other state (including failed/expired) is
  // exactly what this redesign exists to make recoverable.
  const canPay = order.paymentStatus !== 'paid' && order.orderStatus !== 'cancelled';

  const handleCopyOrderNumber = async () => {
    try {
      await navigator.clipboard.writeText(order.orderNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser — silently no-op
      // rather than showing an error for a low-stakes convenience action.
    }
  };

  return (
    <Layout>
      <div className="container-custom py-12">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Hero + primary CTA */}
          <div className={`card p-8 text-center ${
            hero.tone === 'success' ? 'bg-green-50' : hero.tone === 'cancelled' ? 'bg-red-50' : 'bg-yellow-50'
          }`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              hero.tone === 'success' ? 'bg-green-100' : hero.tone === 'cancelled' ? 'bg-red-100' : 'bg-yellow-100'
            }`}>
              {hero.tone === 'success' && <CheckIcon className="w-8 h-8 text-green-600" />}
              {hero.tone === 'cancelled' && <XMarkIcon className="w-8 h-8 text-red-600" />}
              {hero.tone === 'pending' && <ExclamationTriangleIcon className="w-8 h-8 text-yellow-600" />}
            </div>
            <h1 className="text-2xl font-bold mb-2">{hero.title}</h1>
            <p className="text-gray-600">{hero.body}</p>

            {canPay && (
              <div className="mt-6 flex flex-col items-center">
                <CompletePaymentButton orderNumber={order.orderNumber} payment={order.payment} />
              </div>
            )}
          </div>

          {/* Payment Information + Order Timeline */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card p-6">
              <h2 className="font-bold mb-4">Payment Information</h2>
              <dl className="space-y-3">
                <InfoRow label="Payment Method" value={toTitleCase(order.paymentMethod)} />
                <InfoRow label="Payment Status" value={toTitleCase(order.paymentStatus)} />
                <InfoRow label="Order Status" value={orderStatusLabel(order.orderStatus)} />
                <InfoRow label="Order Date" value={new Date(order.createdAt).toLocaleString('en-PH')} />
                {paymentExpiresAt && (
                  <>
                    <InfoRow label="Payment Expiration" value={new Date(paymentExpiresAt).toLocaleString('en-PH')} />
                    <InfoRow label="Time Remaining" value={countdownExpired ? 'Expired' : timeRemaining} />
                  </>
                )}
                <InfoRow label="Order Number" value={order.orderNumber} />
                {/* Enterprise Fulfillment Blueprint, Phase 1 — captured by
                    admin since Payment Platform Redesign shipped, never
                    rendered anywhere in the customer's own order view until
                    now (a Fulfillment Audit finding). */}
                {order.courier && <InfoRow label="Courier" value={order.courier} />}
                {order.trackingNumber && <InfoRow label="Tracking Number" value={order.trackingNumber} />}
              </dl>
            </div>

            <div className="card p-6">
              <h2 className="font-bold mb-4">Order Timeline</h2>
              <OrderTimeline orderStatus={order.orderStatus} />
            </div>
          </div>

          {/* Order Details */}
          <div className="card p-8">
            <h2 className="text-xl font-bold mb-4">Order Details</h2>

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
                    <p className="font-semibold">{toTitleCase(item.name)}</p>
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

          {/* Secondary actions */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/products" className="btn-outline">
              Continue Shopping
            </Link>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Order ${order.orderNumber}`)}`}
              className="btn-outline inline-flex items-center gap-1.5"
            >
              <EnvelopeIcon className="w-4 h-4" />
              Contact Support
            </a>
            <button onClick={() => downloadOrderSummaryPdf(order)} className="btn-outline inline-flex items-center gap-1.5">
              <DocumentArrowDownIcon className="w-4 h-4" />
              Download Order Summary (PDF)
            </button>
            <button onClick={handleCopyOrderNumber} className="btn-outline inline-flex items-center gap-1.5">
              <ClipboardDocumentIcon className="w-4 h-4" />
              {copied ? 'Copied!' : 'Copy Order Number'}
            </button>
            {/* Enterprise Fulfillment Blueprint, Phase 2 — self-service
                returns only apply to a paid order; the backend enforces the
                same rule (routes/returns.js), this just avoids offering a
                dead-end action. */}
            {order.paymentStatus === 'paid' && (
              <Link to={`/order/${order.orderNumber}/return`} className="btn-outline">
                Request a Return
              </Link>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default OrderConfirmation;
