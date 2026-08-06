// Enterprise Fulfillment Blueprint, Phase 2 — mirrors shipmentStatus.js's
// pattern for ReturnRequest's own state machine (returnRequestRepository.
// RETURN_TRANSITIONS on the backend).

export const RETURN_STATUS_LABELS = {
  requested: 'Requested',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  return_shipped: 'Return Shipped',
  received: 'Received',
  inspected: 'Inspected',
  refund_pending: 'Refund Pending',
  refunded: 'Refunded',
  closed: 'Closed',
};

export const RETURN_STATUS_COLORS = {
  requested: 'bg-orange-100 text-orange-800',
  under_review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  return_shipped: 'bg-indigo-100 text-indigo-800',
  received: 'bg-violet-100 text-violet-800',
  inspected: 'bg-purple-100 text-purple-800',
  refund_pending: 'bg-amber-100 text-amber-800',
  refunded: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
};

export const returnStatusLabel = (status) => RETURN_STATUS_LABELS[status] || status;

// The queue tabs a Support/Finance operator actually filters by — mirrors
// the GENERIC_TRANSITIONS set on routes/returns.js plus the terminal states.
export const RETURN_QUEUES = [
  'requested', 'under_review', 'approved', 'return_shipped',
  'received', 'refund_pending', 'refunded', 'rejected', 'closed',
];

// One-click "advance to next" for the happy path only — anything branching
// (reject, or the /inspect endpoint's own two-step transition) is a
// dedicated action, not a generic "next" button.
export const NEXT_STATUS = {
  requested: 'under_review',
  under_review: 'approved',
  approved: 'return_shipped',
  return_shipped: 'received',
};
