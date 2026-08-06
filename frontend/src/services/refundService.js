import api from './api';

// Enterprise Fulfillment Blueprint, Phase 2 — the Refund queue (created
// from either a Shipment cancellation or a Return inspection) and the
// route that actually issues the money movement against the gateway.
export const refundService = {
  getRefunds: async (params = {}) => {
    const response = await api.get('/admin/refunds', { params });
    return response.data;
  },

  getRefund: async (id) => {
    const response = await api.get(`/admin/refunds/${id}`);
    return response.data;
  },

  process: async (id) => {
    const response = await api.post(`/admin/refunds/${id}/process`);
    return response.data;
  },
};

export default refundService;
