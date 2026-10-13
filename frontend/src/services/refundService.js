import api from './api';

/**
 * Refund queue + the manual-refund workflow. ePayGames is the platform's only
 * integrated gateway and exposes no automated refund/reversal API, so a refund
 * is completed by staff out-of-band and RECORDED here — this service never
 * initiates a refund. An amount is corrected (before payment, or as a bounded
 * reconciliation) through `adjust`.
 */
export const refundService = {
  getRefunds: async (params = {}) => {
    const response = await api.get('/admin/refunds', { params });
    return response.data;
  },

  getRefund: async (id) => {
    const response = await api.get(`/admin/refunds/${id}`);
    return response.data;
  },

  // Record an externally-completed refund. `externalAmount` must equal the
  // refund's current amount exactly — the backend rejects a mismatch rather
  // than changing it. A `note` is required when correcting a `failed` refund.
  record: async (id, { confirmCompleted, externalAmount, providerReference, note }) => {
    const response = await api.post(`/admin/refunds/${id}/record`, {
      confirmCompleted,
      externalAmount,
      ...(providerReference ? { providerReference } : {}),
      ...(note ? { note } : {}),
    });
    return response.data;
  },

  // Adjust a PENDING/FAILED refund's amount. Does not initiate a refund and
  // cannot exceed the refundable ceiling: `externalPayment: 'none'` is the
  // normal pre-payment correction (recompute or explicit amount); the
  // 'already_sent' mode only reconciles to an amount that already left.
  adjust: async (id, body) => {
    const response = await api.post(`/admin/refunds/${id}/adjust`, body);
    return response.data;
  },
};

export default refundService;
