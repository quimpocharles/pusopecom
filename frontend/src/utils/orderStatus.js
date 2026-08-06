// Payment Platform Redesign, Phase 2 — a single source for order-status
// labels/colors, consolidating what used to be four separately hardcoded
// copies (AdminOrders.jsx, AdminOrderDetail.jsx, AdminDashboard.jsx, and a
// naive .charAt(0).toUpperCase() in Locker.jsx that would have rendered
// "Awaiting_payment" once multi-word statuses existed).
//
//   awaiting_payment -> paid -> processing -> packed -> shipped -> delivered
//                                                                 -> returned
//           -> failed_payment / expired / cancelled
//
// 'confirmed' is included only so old rows/reports render a real label
// instead of the raw enum string — no new order ever reaches it again
// (superseded by 'paid'), and it's deliberately left out of
// ORDER_STATUS_OPTIONS so no admin UI can set it going forward.

export const ORDER_STATUS_LABELS = {
  awaiting_payment: 'Awaiting Payment',
  paid: 'Paid',
  processing: 'Processing',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  returned: 'Returned',
  cancelled: 'Cancelled',
  expired: 'Expired',
  failed_payment: 'Failed Payment',
  confirmed: 'Confirmed', // legacy
};

export const ORDER_STATUS_COLORS = {
  awaiting_payment: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-blue-100 text-blue-800',
  processing: 'bg-indigo-100 text-indigo-800',
  packed: 'bg-violet-100 text-violet-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  returned: 'bg-orange-100 text-orange-800',
  cancelled: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-800',
  failed_payment: 'bg-rose-100 text-rose-800',
  confirmed: 'bg-blue-100 text-blue-800', // legacy
};

export const orderStatusLabel = (status) => ORDER_STATUS_LABELS[status] || status;

// What an admin may set directly on an Order via the generic status
// dropdown — as of the Enterprise Fulfillment Blueprint's Phase 1, this is
// only the payment-side states. Every post-payment fulfillment state
// (processing/packed/shipped/delivered/cancelled/returned) now lives
// exclusively in the Shipment queue (see AdminShipments.jsx) — Order's own
// orderStatus is *derived* from Shipment.status there, not independently
// edited, so the two can never silently disagree. Still valid values for
// display everywhere — ORDER_STATUS_LABELS/COLORS above keep every one of
// them — just not selectable through this dropdown anymore.
export const ORDER_STATUS_OPTIONS = ['awaiting_payment', 'paid', 'expired', 'failed_payment'];

// Every real status *except* legacy 'confirmed' — for read-only contexts
// (the AdminOrders list's filter dropdown) where showing "shipped" or
// "cancelled" as something to filter BY is exactly right, even though
// neither is settable through ORDER_STATUS_OPTIONS above anymore.
export const ORDER_STATUS_FILTER_OPTIONS = Object.keys(ORDER_STATUS_LABELS).filter((s) => s !== 'confirmed');
