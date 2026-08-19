import api from './api';

const venueService = {
  getAll: async () => {
    const response = await api.get('/admin/venues');
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/admin/venues/${id}`);
    return response.data;
  },

  create: async (data) => {
    const response = await api.post('/admin/venues', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.put(`/admin/venues/${id}`, data);
    return response.data;
  },

  remove: async (id) => {
    const response = await api.delete(`/admin/venues/${id}`);
    return response.data;
  },

  createSection: async (venueId, data) => {
    const response = await api.post(`/admin/venues/${venueId}/sections`, data);
    return response.data;
  },

  updateSection: async (sectionId, data) => {
    const response = await api.put(`/admin/venues/sections/${sectionId}`, data);
    return response.data;
  },

  removeSection: async (sectionId) => {
    const response = await api.delete(`/admin/venues/sections/${sectionId}`);
    return response.data;
  },
};

export default venueService;
