import api from './api';

const navigationLinkService = {
  getLinks: async () => {
    const response = await api.get('/navigation-links');
    return response.data;
  },

  getAllLinks: async () => {
    const response = await api.get('/navigation-links/admin/all');
    return response.data;
  },

  createLink: async (data) => {
    const response = await api.post('/navigation-links', data);
    return response.data;
  },

  updateLink: async (id, data) => {
    const response = await api.put(`/navigation-links/${id}`, data);
    return response.data;
  },

  deleteLink: async (id) => {
    const response = await api.delete(`/navigation-links/${id}`);
    return response.data;
  },
};

export default navigationLinkService;
