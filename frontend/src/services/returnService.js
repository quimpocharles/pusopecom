import api from './api';

// Enterprise Fulfillment Blueprint, Phase 2 — customer-facing return
// requests and admin review/inspection, mirroring shipmentService's split
// between the staff-facing and customer-facing surfaces.
export const returnService = {
  // Customer-facing
  create: async ({ orderNumber, reason, description, photos, items }) => {
    const response = await api.post('/returns', { orderNumber, reason, description, photos, items });
    return response.data;
  },

  uploadPhotos: async (files) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('photos', file));
    const response = await api.post('/returns/photos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getMine: async () => {
    const response = await api.get('/returns');
    return response.data;
  },

  getForOrder: async (orderNumber) => {
    const response = await api.get(`/returns/order/${orderNumber}`);
    return response.data;
  },

  // Admin-facing
  getReturns: async (params = {}) => {
    const response = await api.get('/admin/returns', { params });
    return response.data;
  },

  getReturn: async (id) => {
    const response = await api.get(`/admin/returns/${id}`);
    return response.data;
  },

  transitionStatus: async (id, status, resolutionNotes) => {
    const response = await api.patch(`/admin/returns/${id}/status`, {
      status,
      ...(resolutionNotes !== undefined && { resolutionNotes }),
    });
    return response.data;
  },

  inspect: async (id, items) => {
    const response = await api.post(`/admin/returns/${id}/inspect`, { items });
    return response.data;
  },
};

export default returnService;
