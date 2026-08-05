import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { Panel } from '../ui';
import CompletePaymentButton from '../orders/CompletePaymentButton';

// Payment Platform Redesign, Phase 5 — "Resume Checkout," the one
// always-first priority in My PUSO Home per the original spec's ordering.
// Rendered above the feed, not as a feed moment: recency sorting is the
// wrong model for "you are about to lose your reserved stock," so this is
// its own module, sorted by soonest-expiring first (see
// accountRepository.getHomeFeed's pendingPayments).
//
// yellow-50/100/600 matches OrderConfirmation's own "pending" hero tone
// (Phase 3) — the same visual vocabulary for "payment still needed"
// wherever it appears, not a second one invented for this module.
const ResumeCheckoutCard = ({ orderNumber, total, payment }) => (
  <Panel padding="p-4" className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 !bg-yellow-50 !border-yellow-200">
    <div className="flex-1 min-w-0">
      <span className="badge bg-yellow-100 text-yellow-800 mb-1.5">Resume Checkout</span>
      <p className="font-semibold text-gray-900 text-sm">
        Order <Link to={`/order/${orderNumber}`} className="underline hover:no-underline">#{orderNumber}</Link>
      </p>
      <p className="text-sm text-gray-500">₱{Number(total).toFixed(2)} — payment still needed</p>
    </div>
    <CompletePaymentButton orderNumber={orderNumber} payment={payment} className="sm:flex-shrink-0" />
  </Panel>
);

ResumeCheckoutCard.propTypes = {
  orderNumber: PropTypes.string.isRequired,
  total: PropTypes.number.isRequired,
  payment: PropTypes.shape({
    status: PropTypes.string,
    expiresAt: PropTypes.string,
    checkoutUrl: PropTypes.string,
  }),
};

const ResumeCheckoutModule = ({ pendingPayments }) => {
  if (!pendingPayments?.length) return null;

  return (
    <div className="space-y-3">
      {pendingPayments.map((p) => (
        <ResumeCheckoutCard key={p.orderNumber} orderNumber={p.orderNumber} total={p.total} payment={p.payment} />
      ))}
    </div>
  );
};

ResumeCheckoutModule.propTypes = {
  pendingPayments: PropTypes.arrayOf(
    PropTypes.shape({
      orderNumber: PropTypes.string.isRequired,
      total: PropTypes.number.isRequired,
    })
  ),
};

export default ResumeCheckoutModule;
