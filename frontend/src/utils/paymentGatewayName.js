/**
 * Customer-facing display name for a payment gateway identifier
 * (order.paymentMethod / the `gateway` field GET /payment-channels
 * returns) — Phase 5, ePayGames evaluation. A plain title-case of the raw
 * identifier reads fine for "Xendit"/"Maya" but wrong for "epaygames"
 * (→ "Epaygames", not the real "ePayGames" branding), so this is a small,
 * explicit map rather than a generic string transform, with a same-shape
 * fallback for anything not listed.
 */
const GATEWAY_DISPLAY_NAMES = {
  xendit: 'Xendit',
  maya: 'Maya',
  epaygames: 'ePayGames',
};

export function paymentGatewayDisplayName(gateway) {
  if (!gateway) return '';
  return GATEWAY_DISPLAY_NAMES[gateway] || (gateway.charAt(0).toUpperCase() + gateway.slice(1));
}
