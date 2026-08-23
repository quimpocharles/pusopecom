import { CheckIcon } from '@heroicons/react/24/solid';

// A customer-facing delivery progression for a Merchandise order, derived
// ONLY from the order's coarse customer-facing `orderStatus` — the same
// state every order email/notification already reads, never an invented
// Shipment sub-state.
//
//   Order Placed -> Paid -> Packed -> Shipped -> Delivered
//
// 'packed' shares the "Packed" step with 'processing' on purpose: from a
// fan's point of view those are the same wait, not two different moments.
// Deliberately a lightweight inline stepper (a row of labelled dots), not a
// full-screen timeline — it sits inside an order card where the point is to
// answer "where is it?" at a glance.
const STEPS = [
  { key: 'placed', label: 'Placed' },
  { key: 'paid', label: 'Paid' },
  { key: 'packed', label: 'Packed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
];

// Which step index an orderStatus corresponds to. Terminal states that do
// not belong on the happy path are handled separately below.
const ORDER_STATUS_STEP_INDEX = {
  awaiting_payment: 0,
  paid: 1,
  processing: 2,
  packed: 2,
  shipped: 3,
  delivered: 4,
  returned: 4,
  confirmed: 1, // legacy — no new order reaches this
};

// Terminal / exceptional statuses that should not be drawn as a partial
// happy-path progression, which would misleadingly imply the order is still
// moving toward delivery.
const TERMINAL_LABELS = {
  cancelled: 'Cancelled',
  expired: 'Payment Session Expired',
  failed_payment: 'Payment Failed',
};

const DeliveryProgress = ({ orderStatus }) => {
  if (TERMINAL_LABELS[orderStatus]) {
    return (
      <p className="text-sm font-semibold text-rose-600">{TERMINAL_LABELS[orderStatus]}</p>
    );
  }

  const currentIndex = ORDER_STATUS_STEP_INDEX[orderStatus] ?? 0;

  return (
    <ol className="flex items-center w-full" aria-label="Delivery status">
      {STEPS.map((step, i) => {
        const done = i <= currentIndex;
        const isLast = i === STEPS.length - 1;
        return (
          <li key={step.key} className={`flex items-center ${isLast ? '' : 'flex-1'}`}>
            <div className="flex flex-col items-center gap-1 min-w-0">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  done ? 'bg-ink-900 text-white' : 'bg-ink-200/50 border border-ink-200 text-ink-500'
                }`}
              >
                {done && <CheckIcon className="w-3.5 h-3.5" />}
              </span>
              <span className={`text-editorial-caption text-center leading-tight ${done ? 'text-ink-900 font-semibold' : 'text-ink-500'}`}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <span className={`flex-1 h-px mx-1 -mt-4 ${i < currentIndex ? 'bg-ink-900' : 'bg-ink-200'}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
};

export default DeliveryProgress;
