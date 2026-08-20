/**
 * Xendit's processing fee is passed to the customer, not absorbed — see
 * ADR-010 (docs/decisions/0000-decision-log.md). The fee genuinely differs
 * per payment channel (a card costs materially more to process than QR Ph),
 * so it's computed per channel rather than one blended surcharge — a flat
 * rate applied to every channel would overcharge the cheaper ones relative
 * to actual cost, which is both dishonest to the fan and a real risk under
 * BSP's "surcharge must not be grossly disproportionate to actual cost"
 * disclosure rule.
 *
 * These rates are placeholders pulled from Xendit's publicly published
 * Philippines pricing, NOT PusoStore's actual contracted merchant-agreement
 * rate card — replace with the real negotiated rates from the Xendit
 * dashboard before going live. Same "verify the provider's real behavior,
 * don't assume the spec" discipline ADR-008 already applied to Maya's
 * session duration.
 */

export const CHANNELS = Object.freeze([
  { code: 'GCASH', label: 'GCash', feeType: 'percent', percent: 0.02 },
  { code: 'MAYA', label: 'Maya', feeType: 'percent', percent: 0.02 },
  { code: 'CARD', label: 'Credit/Debit Card', feeType: 'percent_plus_flat', percent: 0.029, flatAmount: 15 },
  { code: 'APPLE_PAY', label: 'Apple Pay', feeType: 'percent', percent: 0.02 },
  { code: 'QRPH', label: 'QR Ph', feeType: 'percent', percent: 0.007 },
]);
// BANK_TRANSFER removed (2026-08-20) — its channel code (VIRTUAL_ACCOUNT) was
// a guess that Xendit's live account rejected outright ("Channel(s)
// VIRTUAL_ACCOUNT are not available"), and unlike CARD's wrong-code fix,
// there's no single confirmed replacement: the Xendit dashboard lists PH
// bank transfer per-bank (BPI, RCBC, UBP), not as one generic channel, so
// this was a structural mismatch, not just a wrong string. Re-add once the
// real per-bank channel codes are confirmed.

const CHANNELS_BY_CODE = Object.freeze(
  Object.fromEntries(CHANNELS.map((channel) => [channel.code, channel]))
);

export function getChannel(channelCode) {
  return CHANNELS_BY_CODE[channelCode] ?? null;
}

export function isValidChannel(channelCode) {
  return channelCode in CHANNELS_BY_CODE;
}

/**
 * The processing fee for a given channel, computed against `baseAmount`
 * (subtotal + shippingFee - discountAmount — the total *before* the fee
 * itself is added, never a moving target that includes its own fee).
 * Rounded to the nearest centavo, same precision every other money value
 * in this codebase is displayed/stored at.
 *
 * @param {string} channelCode
 * @param {number} baseAmount
 * @returns {number}
 */
export function calculateGatewayFee(channelCode, baseAmount) {
  const channel = getChannel(channelCode);
  if (!channel) throw new Error(`Unknown payment channel: ${channelCode}`);

  let fee;
  switch (channel.feeType) {
    case 'percent':
      fee = baseAmount * channel.percent;
      break;
    case 'flat':
      fee = channel.flatAmount;
      break;
    case 'percent_plus_flat':
      fee = baseAmount * channel.percent + channel.flatAmount;
      break;
    default:
      throw new Error(`Unknown fee type for channel ${channelCode}: ${channel.feeType}`);
  }

  return Math.round(fee * 100) / 100;
}

export default { CHANNELS, getChannel, isValidChannel, calculateGatewayFee };
