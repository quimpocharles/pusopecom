// Same "single source, not N hardcoded copies" reasoning as orderStatus.js —
// extracted once OrderConfirmation.jsx needed the same labels/colors
// Locker.jsx's LockerPasses already had inline.

export const PASS_STATUS_LABELS = {
  issued: 'Ready',
  checked_in: 'Checked In',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export const PASS_STATUS_STYLES = {
  issued: 'text-green-600',
  checked_in: 'text-blue-600',
  cancelled: 'text-gray-400',
  refunded: 'text-gray-400',
};

export const passStatusLabel = (status) => PASS_STATUS_LABELS[status] || status;
export const passStatusStyle = (status) => PASS_STATUS_STYLES[status] || 'text-gray-500';
