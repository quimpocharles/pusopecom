/**
 * Mirrors backend/lib/payments/xenditFees.js's CHANNELS/calculateGatewayFee
 * exactly — same reasoning as utils/permissions.js mirroring
 * backend/lib/permissions.js: no shared package between frontend and
 * backend, so this is a preview only. The backend recomputes the fee
 * server-side and is the authoritative value actually charged; if you
 * change one file, change both.
 */

export const PAYMENT_CHANNELS = Object.freeze([
  { code: 'GCASH', label: 'GCash', feeType: 'percent', percent: 0.02 },
  { code: 'MAYA', label: 'Maya', feeType: 'percent', percent: 0.02 },
  { code: 'CARD', label: 'Credit/Debit Card', feeType: 'percent_plus_flat', percent: 0.029, flatAmount: 15 },
  { code: 'APPLE_PAY', label: 'Apple Pay', feeType: 'percent', percent: 0.02 },
  { code: 'QRPH', label: 'QR Ph', feeType: 'percent', percent: 0.007 },
]);

export function calculateGatewayFee(channelCode, baseAmount) {
  const channel = PAYMENT_CHANNELS.find((c) => c.code === channelCode);
  if (!channel) return 0;

  switch (channel.feeType) {
    case 'percent':
      return Math.round(baseAmount * channel.percent * 100) / 100;
    case 'flat':
      return channel.flatAmount;
    case 'percent_plus_flat':
      return Math.round((baseAmount * channel.percent + channel.flatAmount) * 100) / 100;
    default:
      return 0;
  }
}
