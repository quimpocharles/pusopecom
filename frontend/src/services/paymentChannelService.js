import api from './api';

/**
 * Phase 4 (ePayGames evaluation) — Checkout no longer maintains its own
 * hardcoded copy of the gateway's channel list/fee formula (that used to
 * live in utils/paymentChannels.js, a manually-kept mirror of backend/lib/
 * payments/xenditFees.js). Both the available channels and the fee for a
 * selected one now come from the backend, which already knows which
 * gateway is actually active (siteSettingsRepository.defaultPaymentGateway)
 * and dispatches to that gateway's own real channel/fee source —
 * Xendit's static table, Maya's single generic channel, or ePayGames' live
 * API. This service doesn't need to know or care which one that is.
 */
const paymentChannelService = {
  // GET /payment-channels — channels for whichever gateway is currently active.
  getChannels: async () => {
    const response = await api.get('/payment-channels');
    return response.data; // { success, data: { gateway, channels: [{code, label}] } }
  },

  // GET /payment-channels/calculate — the authoritative fee for one channel/amount.
  calculateFee: async ({ channel, amount }) => {
    const response = await api.get('/payment-channels/calculate', { params: { channel, amount } });
    return response.data; // { success, data: { gateway, channel, amount, fee, total } }
  },
};

export default paymentChannelService;
