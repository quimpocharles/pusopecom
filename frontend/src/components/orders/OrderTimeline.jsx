import PropTypes from 'prop-types';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/solid';

// Payment Platform Redesign, Phase 3 — "customers should instantly
// understand where they are in the fulfillment process." A fixed 5-step
// happy path, checked based on the order's *current* orderStatus alone —
// no per-step timestamps needed for that, so this reads nothing from
// OrderEvent. 'packed' shares the "Preparing Order" step with 'processing'
// on purpose: from a fan's point of view those are the same wait, not two
// different moments worth their own row.
const STEPS = [
  { key: 'created', label: 'Order Created' },
  { key: 'paid', label: 'Payment Received' },
  { key: 'processing', label: 'Preparing Order' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
];

const STATUS_STEP_INDEX = {
  awaiting_payment: 0,
  paid: 1,
  processing: 2,
  packed: 2,
  shipped: 3,
  delivered: 4,
  returned: 4,
  confirmed: 1, // legacy — no new order reaches this
};

// Statuses that break the happy path entirely — shown as their own single
// marker instead of a partially-checked step list, which would otherwise
// misleadingly imply the order is still progressing toward delivery.
const EXCEPTION_LABELS = {
  cancelled: 'Order Cancelled',
  expired: 'Payment Session Expired',
  failed_payment: 'Payment Failed',
};

const OrderTimeline = ({ orderStatus }) => {
  if (EXCEPTION_LABELS[orderStatus]) {
    return (
      <div className="flex items-center gap-3 py-2">
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
          <XMarkIcon className="w-4 h-4" />
        </span>
        <span className="text-sm font-medium text-gray-900">{EXCEPTION_LABELS[orderStatus]}</span>
      </div>
    );
  }

  const currentIndex = STATUS_STEP_INDEX[orderStatus] ?? 0;

  return (
    <ol className="space-y-0">
      {STEPS.map((step, i) => {
        const done = i <= currentIndex;
        const isLast = i === STEPS.length - 1;
        return (
          <li key={step.key} className="relative pl-8 pb-6 last:pb-0">
            {!isLast && (
              <span className={`absolute left-[11px] top-6 bottom-0 w-px ${done ? 'bg-primary-600' : 'bg-gray-200'}`} />
            )}
            <span
              className={`absolute left-0 top-0 w-6 h-6 rounded-full flex items-center justify-center ${
                done ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-400 border border-gray-300'
              }`}
            >
              {done && <CheckIcon className="w-3.5 h-3.5" />}
            </span>
            <p className={`text-sm font-medium leading-6 ${done ? 'text-gray-900' : 'text-gray-400'}`}>
              {step.label}
            </p>
          </li>
        );
      })}
    </ol>
  );
};

OrderTimeline.propTypes = {
  orderStatus: PropTypes.string.isRequired,
};

export default OrderTimeline;
