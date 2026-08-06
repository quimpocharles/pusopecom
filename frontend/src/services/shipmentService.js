import api from './api';

// Enterprise Fulfillment Blueprint, Phase 1 — the staff-facing Shipment
// queue's API client, distinct from orderService: Order is customer-facing,
// Shipment never is (see the header comment on routes/shipments.js).
export const shipmentService = {
  getShipments: async (params = {}) => {
    const response = await api.get('/admin/shipments', { params });
    return response.data;
  },

  getShipment: async (id) => {
    const response = await api.get(`/admin/shipments/${id}`);
    return response.data;
  },

  getShipmentByOrder: async (orderId) => {
    const response = await api.get(`/admin/shipments/by-order/${orderId}`);
    return response.data;
  },

  getShipmentEvents: async (id) => {
    const response = await api.get(`/admin/shipments/${id}/events`);
    return response.data;
  },

  transitionStatus: async (id, { status, courier, trackingNumber }) => {
    const response = await api.patch(`/admin/shipments/${id}/status`, {
      status,
      ...(courier !== undefined && { courier }),
      ...(trackingNumber !== undefined && { trackingNumber }),
    });
    return response.data;
  },

  assign: async (id, userId) => {
    const response = await api.patch(`/admin/shipments/${id}/assign`, { userId });
    return response.data;
  },

  addNote: async (id, message) => {
    const response = await api.post(`/admin/shipments/${id}/notes`, { message });
    return response.data;
  },

  // The only route with real consequences (stock release + a Refund row) —
  // never just another status value, see routes/shipments.js.
  cancel: async (id, reason) => {
    const response = await api.post(`/admin/shipments/${id}/cancel`, { reason });
    return response.data;
  },
};

export default shipmentService;
