import { useState } from 'react';
import PropTypes from 'prop-types';
import orderService from '../../services/orderService';
import usePaymentCountdown from '../../hooks/usePaymentCountdown';

// "Complete Payment / Generate New Payment Link" (Payment Platform
// Redesign, Phase 3). Every click is a real server round trip — never a
// client-cached checkoutUrl — because only Payment.expiresAt on the
// backend can say whether a session is still valid; this component's own
// countdown (usePaymentCountdown, shared with the Payment Information
// panel's "Time Remaining" field) is a display aid, not the source of
// truth it decides from. Shared with My PUSO's Resume Checkout module
// (Phase 5), which is why this lives as its own component rather than
// inline in OrderConfirmation.
const CompletePaymentButton = ({ orderNumber, payment, className = '', onRedirecting }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const expiresAt = payment?.status === 'pending' ? payment.expiresAt : null;
  const { isExpired, formatted: countdown } = usePaymentCountdown(expiresAt);

  const handleClick = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await orderService.payOrder(orderNumber);
      onRedirecting?.();
      window.location.href = res.data.checkoutUrl;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to open payment. Please try again.');
      setLoading(false);
    }
  };

  const label = loading
    ? 'Redirecting to payment…'
    : !expiresAt || isExpired
    ? 'Generate New Payment Link'
    : 'Complete Payment';

  return (
    <div className={className}>
      <button onClick={handleClick} disabled={loading} className="btn-primary w-full sm:w-auto disabled:opacity-60">
        {label}
      </button>
      {countdown && (
        <p className="text-sm text-gray-500 mt-2">
          Complete payment within <span className="font-semibold text-gray-700">{countdown}</span> before your payment session expires.
        </p>
      )}
      {isExpired && !loading && (
        <p className="text-sm text-amber-600 mt-2">Your payment session has expired — generate a new one to continue.</p>
      )}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
};

CompletePaymentButton.propTypes = {
  orderNumber: PropTypes.string.isRequired,
  payment: PropTypes.shape({
    status: PropTypes.string,
    expiresAt: PropTypes.string,
    checkoutUrl: PropTypes.string,
  }),
  className: PropTypes.string,
  onRedirecting: PropTypes.func,
};

export default CompletePaymentButton;
