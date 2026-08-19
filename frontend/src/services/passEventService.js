import api from './api';

const passEventService = {
  getUpcoming: async (params) => {
    const response = await api.get('/pass-events', { params });
    return response.data;
  },

  getBySlug: async (slug) => {
    const response = await api.get(`/pass-events/${slug}`);
    return response.data;
  },

  getSectionSeats: async (eventId, sectionId) => {
    const response = await api.get(`/pass-events/${eventId}/sections/${sectionId}/seats`);
    return response.data;
  },

  holdSeat: async (eventId, seatId) => {
    const response = await api.post(`/pass-events/${eventId}/seats/${seatId}/hold`);
    return response.data;
  },

  releaseSeat: async (eventId, seatId, holdToken) => {
    const response = await api.delete(`/pass-events/${eventId}/seats/${seatId}/hold`, { data: { holdToken } });
    return response.data;
  },

  getMyPasses: async () => {
    const response = await api.get('/pass-events/my/passes');
    return response.data;
  },

  getAll: async () => {
    const response = await api.get('/pass-events/admin/all');
    return response.data;
  },

  getByIdAdmin: async (id) => {
    const response = await api.get(`/pass-events/admin/${id}`);
    return response.data;
  },

  create: async (data) => {
    const response = await api.post('/pass-events', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.put(`/pass-events/${id}`, data);
    return response.data;
  },

  remove: async (id) => {
    const response = await api.delete(`/pass-events/${id}`);
    return response.data;
  },

  createTier: async (eventId, data) => {
    const response = await api.post(`/pass-events/${eventId}/tiers`, data);
    return response.data;
  },

  updateTier: async (tierId, data) => {
    const response = await api.put(`/pass-events/tiers/${tierId}`, data);
    return response.data;
  },

  removeTier: async (tierId) => {
    const response = await api.delete(`/pass-events/tiers/${tierId}`);
    return response.data;
  },

  lookupPass: async (qrToken) => {
    const response = await api.get(`/pass-events/passes/lookup/${qrToken}`);
    return response.data;
  },

  checkinPass: async (passId, gate) => {
    const response = await api.post(`/pass-events/passes/${passId}/checkin`, gate ? { gate } : {});
    return response.data;
  },
};

export default passEventService;
