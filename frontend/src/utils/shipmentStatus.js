// Enterprise Fulfillment Blueprint, Phase 1 — one source for Shipment
// status labels/colors/queue grouping, the same pattern orderStatus.js
// already established for Order.

export const SHIPMENT_STATUS_LABELS = {
  awaiting_picking: 'Awaiting Picking',
  picking: 'Picking',
  packing: 'Packing',
  quality_check: 'Quality Check',
  ready_for_courier: 'Ready for Courier',
  courier_scheduled: 'Courier Scheduled',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  completed: 'Completed',
  return_requested: 'Return Requested',
  return_approved: 'Return Approved',
  returned: 'Returned',
  refund_pending: 'Refund Pending',
  refunded: 'Refunded',
  cancelled: 'Cancelled',
  exception: 'Exception',
};

export const SHIPMENT_STATUS_COLORS = {
  awaiting_picking: 'bg-yellow-100 text-yellow-800',
  picking: 'bg-blue-100 text-blue-800',
  packing: 'bg-indigo-100 text-indigo-800',
  quality_check: 'bg-violet-100 text-violet-800',
  ready_for_courier: 'bg-purple-100 text-purple-800',
  courier_scheduled: 'bg-purple-100 text-purple-800',
  picked_up: 'bg-teal-100 text-teal-800',
  in_transit: 'bg-teal-100 text-teal-800',
  out_for_delivery: 'bg-cyan-100 text-cyan-800',
  delivered: 'bg-green-100 text-green-800',
  completed: 'bg-green-100 text-green-800',
  return_requested: 'bg-orange-100 text-orange-800',
  return_approved: 'bg-orange-100 text-orange-800',
  returned: 'bg-orange-100 text-orange-800',
  refund_pending: 'bg-amber-100 text-amber-800',
  refunded: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
  exception: 'bg-rose-100 text-rose-800',
};

export const shipmentStatusLabel = (status) => SHIPMENT_STATUS_LABELS[status] || status;

// The "next step" queues an operator advances through day to day — mirrors
// shipmentRepository.SHIPMENT_TRANSITIONS' adjacency map on the backend,
// but only the forward-happy-path subset relevant to a queue filter bar.
// Return/refund sub-states are deliberately not queue-bar tabs yet — Phase
// 2 gives them their own dedicated Returns view instead of crowding this one.
export const SHIPMENT_QUEUES = [
  'awaiting_picking', 'picking', 'packing', 'quality_check',
  'ready_for_courier', 'courier_scheduled', 'picked_up', 'in_transit',
  'out_for_delivery', 'delivered', 'exception',
];

// What an operator can advance a shipment to directly from the queue view's
// quick-action button — the single next stage in the happy path, not the
// full adjacency map (an operator moving one order at a time picks "next,"
// not "jump to any legal state"; the full transition set is still reachable
// via the status dropdown on the order detail page).
export const NEXT_STATUS = {
  awaiting_picking: 'picking',
  picking: 'packing',
  packing: 'quality_check',
  quality_check: 'ready_for_courier',
  ready_for_courier: 'courier_scheduled',
  courier_scheduled: 'picked_up',
  picked_up: 'in_transit',
  in_transit: 'out_for_delivery',
  out_for_delivery: 'delivered',
  delivered: 'completed',
};
