import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { CheckIcon, ExclamationTriangleIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon, DocumentArrowDownIcon, ClipboardDocumentIcon, EnvelopeIcon, ClockIcon } from '@heroicons/react/24/outline';
import Layout from '../components/layout/Layout';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PassTicket from '../components/locker/PassTicket';
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

// Post-Payment Processing UX — a customer who just redirected back with
// ?payment=success has already paid; the only thing genuinely pending is
// our own confirmation catching up (webhook delivery / gateway sync),
// typically seconds, not minutes. POLL_INTERVAL_MS/MAX_POLL_ATTEMPTS give
// that a real chance to resolve (~20s total) before falling back to a
// neutral "taking longer" state — reusing the existing verify-payment
// endpoint (a real authenticated pull against the gateway, same one
// /verify-payment already made available for this exact reconciliation)
// rather than inventing a new one or a fake progress indicator.
const POLL_INTERVAL_MS = 2500;
const MAX_POLL_ATTEMPTS = 8;

const InfoRow = ({ label, value }) => (
  <div className="flex justify-between gap-4 text-sm">
    <dt className="text-gray-500">{label}</dt>
    <dd className="font-medium text-gray-900 text-right">{value}</dd>
  </div>
);

// Substitutes for the hero card while a just-completed payment is still
// being confirmed — deliberately calm/blue, never the yellow "act now"
// tone the same card uses for a genuinely unpaid order. role="status" +
// aria-live/aria-busy so assistive tech announces the state without
// depending on the spinner being visually noticed; the step list is
// itself the "meaningful status text," not just decoration.
const ProcessingCard = () => (
  <div
    className="card p-8 text-center bg-blue-50"
    role="status"
    aria-live="polite"
    aria-busy="true"
    aria-label="Payment processing status"
  >
    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-blue-100">
      <span
        className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"
        aria-hidden="true"
      />
    </div>
    <h1 className="text-2xl font-bold mb-2">Processing Your Payment</h1>
    <p className="text-gray-600">We&rsquo;re confirming your payment. This may take a few moments.</p>

    <ul className="mt-6 max-w-xs mx-auto space-y-3 text-left">
      <li className="flex items-center gap-3 text-sm">
        <CheckIcon className="w-5 h-5 text-green-600 flex-shrink-0" aria-hidden="true" />
        <span className="text-gray-700">Payment submitted <span className="text-gray-400">&mdash; Received</span></span>
      </li>
      <li className="flex items-center gap-3 text-sm">
        <span
          className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin flex-shrink-0"
          aria-hidden="true"
        />
        <span className="text-gray-900 font-medium">Verifying payment <span className="text-gray-400 font-normal">&mdash; Please wait</span></span>
      </li>
      <li className="flex items-center gap-3 text-sm">
        <span className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" aria-hidden="true" />
        <span className="text-gray-400">Order confirmation &mdash; Almost done</span>
      </li>
    </ul>

    <p className="text-sm text-gray-500 mt-6">
      Please don&rsquo;t close this page. We&rsquo;ll update your order automatically.
    </p>
  </div>
);

// The bounded-poll fallback. Neutral, not a failure state — a delayed
// webhook is not the same fact as a declined payment, and this card must
// never conflate the two.
const VerificationTimeoutCard = ({ onCheckStatus, checking }) => (
  <div className="card p-8 text-center bg-blue-50" role="status" aria-live="polite">
    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-blue-100">
      <ClockIcon className="w-8 h-8 text-blue-600" aria-hidden="true" />
    </div>
    <h1 className="text-2xl font-bold mb-2">Payment Confirmation Is Taking Longer</h1>
    <p className="text-gray-600">
      We&rsquo;ve received your payment response, but confirmation is taking longer than usual. You don&rsquo;t need to pay again.
    </p>
    <div className="mt-6">
      <button onClick={onCheckStatus} disabled={checking} className="btn-primary disabled:opacity-60">
        {checking ? 'Checking…' : 'Check Order Status'}
      </button>
    </div>
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
  // A carousel shows one Pass at a time (an order can hold several); the
  // visible ticket owns the ref downloadTicketImage snapshots.
  const [activePassIndex, setActivePassIndex] = useState(0);
  const ticketRef = useRef(null);

  // Post-Payment Processing UX — true only during the bounded window right
  // after a ?payment=success redirect, while the order is still (as far as
  // we've read) awaiting_payment. Drives the ProcessingCard substituting
  // for the normal hero so a customer who already paid is never told to
  // "Complete Your Payment." verificationTimedOut is the fallback once
  // MAX_POLL_ATTEMPTS is exhausted — a neutral state, not a failure one.
  const [verifying, setVerifying] = useState(false);
  const [verificationTimedOut, setVerificationTimedOut] = useState(false);
  const [manualRechecking, setManualRechecking] = useState(false);

  useEffect(() => {
    let active = true;
    let pollTimer;

    const applyOrder = (data) => {
      if (!active) return;
      setOrder(data);

      if (paymentStatusParam === 'success' || data.paymentStatus === 'paid') {
        useCartStore.getState().clearCart();
        usePassCartStore.getState().clear();
      }
    };

    // Polls the existing verify-payment endpoint — a real authenticated
    // pull against the gateway, the same mechanism a single reconciliation
    // check already used — instead of leaving the customer looking at
    // "Complete Your Payment" for a payment they already made. Stops the
    // moment the order resolves either way (paid or failed); falls back to
    // a neutral "taking longer" state after MAX_POLL_ATTEMPTS rather than
    // polling indefinitely.
    const pollVerification = async (attempt) => {
      if (!active) return;
      try {
        const verification = await orderService.verifyPayment(orderNumber);
        if (!active) return;
        if (verification?.data?.paymentStatus && verification.data.paymentStatus !== 'pending') {
          const refreshed = await orderService.getOrderByNumber(orderNumber);
          if (!active) return;
          applyOrder(refreshed.data);
          setVerifying(false);
          return;
        }
      } catch {
        // A transient network/gateway hiccup is not the same fact as a
        // failed payment — stay within the poll budget rather than
        // surfacing an error for one missed attempt.
      }

      if (!active) return;
      if (attempt >= MAX_POLL_ATTEMPTS) {
        setVerifying(false);
        setVerificationTimedOut(true);
        return;
      }
      pollTimer = setTimeout(() => pollVerification(attempt + 1), POLL_INTERVAL_MS);
    };

    const fetchOrder = async () => {
      try {
        const response = await orderService.getOrderByNumber(orderNumber);
        applyOrder(response.data);

        // Only a genuinely still-unresolved order (still awaiting_payment)
        // after a successful-looking redirect gets the processing/poll
        // treatment — an order already paid or already failed/expired by
        // the first read goes straight to its normal, permanent hero.
        if (paymentStatusParam === 'success' && response.data.orderStatus === 'awaiting_payment') {
          setVerifying(true);
          setVerificationTimedOut(false);
          pollVerification(1);
        }
      } catch (err) {
        if (active) setError('Order not found');
      } finally {
        if (active) setLoading(false);
      }
    };

    if (orderNumber) {
      setActivePassIndex(0);
      setVerifying(false);
      setVerificationTimedOut(false);
      fetchOrder();
    }

    return () => {
      active = false;
      clearTimeout(pollTimer);
    };
  }, [orderNumber, paymentStatusParam]);

  // Manual fallback offered by VerificationTimeoutCard — one more check
  // against the same safe endpoints, not a new polling loop and not a new
  // payment session.
  const handleCheckOrderStatus = async () => {
    setManualRechecking(true);
    try {
      const verification = await orderService.verifyPayment(orderNumber);
      const refreshed = await orderService.getOrderByNumber(orderNumber);
      setOrder(refreshed.data);
      if (verification?.data?.paymentStatus && verification.data.paymentStatus !== 'pending') {
        setVerificationTimedOut(false);
      }
    } catch {
      // Stays in the "taking longer" state — the customer can press again.
    } finally {
      setManualRechecking(false);
    }
  };

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
  // Pass and Merchandise orders are mutually exclusive (ADR-011 addendum) —
  // a non-empty passes array is enough to tell which this order is.
  const isPassOrder = order.passes?.length > 0;

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
          {/* Hero + primary CTA — a customer mid-verification (or timed out
              waiting on it) sees the calm processing/taking-longer card
              instead of the normal hero, never the "act now" tone the same
              slot uses for a genuinely unpaid order. */}
          {verifying ? (
            <ProcessingCard />
          ) : verificationTimedOut ? (
            <VerificationTimeoutCard onCheckStatus={handleCheckOrderStatus} checking={manualRechecking} />
          ) : (
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
          )}

          {/* Payment Information + Order Timeline — Merchandise only. A
              Pass has no fulfillment pipeline to track (Preparing Order/
              Shipped/Delivered never apply, ADR-011 addendum) and the
              ticket card below already carries its own status/order
              number, so both cards were pure noise on a Pass confirmation. */}
          {!isPassOrder && (
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
          )}

          {isPassOrder ? (
            /* A digital ticket wallet, one Pass at a time. An order can hold
               several Passes (e.g. 4 tickets for a group), so the ticket is
               presented as a carousel — never a tall stack that scatters the
               QRs. Tapping through shows each ticket full-size (gate-scan
               QR), with a "Ticket X of Y" pager and prev/next controls. */
            <div className="space-y-4">
              <div className="relative max-w-sm mx-auto">
                <PassTicket
                  pass={order.passes[activePassIndex]}
                  large
                  ticketRef={ticketRef}
                  orderNumber={order.orderNumber}
                  position={{ index: activePassIndex, total: order.passes.length }}
                />

                {/* Carousel controls — flanking chevrons on desktop, but on
                    mobile they'd translate outside the viewport (the ticket
                    nearly fills a 375px screen), so they stack full-width
                    below instead. */}
                {order.passes.length > 1 && (
                  <>
                    <button
                      onClick={() => setActivePassIndex((i) => (i - 1 + order.passes.length) % order.passes.length)}
                      className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-14 p-2.5 border-2 border-ink-900 bg-white text-ink-900 hover:bg-ink-900 hover:text-white transition-colors"
                      aria-label="Previous ticket"
                    >
                      <ChevronLeftIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setActivePassIndex((i) => (i + 1) % order.passes.length)}
                      className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-14 p-2.5 border-2 border-ink-900 bg-white text-ink-900 hover:bg-ink-900 hover:text-white transition-colors"
                      aria-label="Next ticket"
                    >
                      <ChevronRightIcon className="w-5 h-5" />
                    </button>
                    <div className="sm:hidden mt-3 flex items-center justify-center gap-4">
                      <button
                        onClick={() => setActivePassIndex((i) => (i - 1 + order.passes.length) % order.passes.length)}
                        className="flex items-center gap-1 px-5 py-2.5 border-2 border-ink-900 bg-white text-ink-900 hover:bg-ink-900 hover:text-white transition-colors"
                        aria-label="Previous ticket"
                      >
                        <ChevronLeftIcon className="w-5 h-5" />
                        Prev
                      </button>
                      <button
                        onClick={() => setActivePassIndex((i) => (i + 1) % order.passes.length)}
                        className="flex items-center gap-1 px-5 py-2.5 border-2 border-ink-900 bg-white text-ink-900 hover:bg-ink-900 hover:text-white transition-colors"
                        aria-label="Next ticket"
                      >
                        Next
                        <ChevronRightIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="max-w-sm mx-auto flex justify-between items-center px-1 text-sm text-gray-500">
                <span>Order {order.orderNumber}</span>
                <span className="font-bold text-lg text-ink-900">₱{order.total.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            /* Order Details */
            <div className="card p-8">
              <h2 className="text-xl font-bold mb-4">Order Details</h2>

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
          )}

          {/* Secondary actions — trimmed to what's actually actionable for
              a Pass: PDF summary/order-number-copy/returns are all
              Merchandise concepts (a Return especially — Passes have no
              ReturnRequest flow to send someone to, per the Domain Model). */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to={isPassOrder ? '/events' : '/products'} className="btn-outline">
              {isPassOrder ? 'Browse Events' : 'Continue Shopping'}
            </Link>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Order ${order.orderNumber}`)}`}
              className="btn-outline inline-flex items-center gap-1.5"
            >
              <EnvelopeIcon className="w-4 h-4" />
              Contact Support
            </a>
            {!isPassOrder && (
              <>
                <button onClick={() => downloadOrderSummaryPdf(order)} className="btn-outline inline-flex items-center gap-1.5">
                  <DocumentArrowDownIcon className="w-4 h-4" />
                  Download Order Summary (PDF)
                </button>
                <button onClick={handleCopyOrderNumber} className="btn-outline inline-flex items-center gap-1.5">
                  <ClipboardDocumentIcon className="w-4 h-4" />
                  {copied ? 'Copied!' : 'Copy Order Number'}
                </button>
                {/* Enterprise Fulfillment Blueprint, Phase 2 — self-service
                    returns only apply to a paid order; the backend enforces
                    the same rule (routes/returns.js), this just avoids
                    offering a dead-end action. */}
                {order.paymentStatus === 'paid' && (
                  <Link to={`/order/${order.orderNumber}/return`} className="btn-outline">
                    Request a Return
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default OrderConfirmation;
