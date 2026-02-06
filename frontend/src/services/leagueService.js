import api from './api';

export const leagueService = {
  getLeagues: async (params = {}) => {
    const response = await api.get('/leagues', { params });
    return response.data;
  },

  getAdminLeagues: async () => {
    const response = await api.get('/leagues/admin/all');
    return response.data;
  },

  createLeague: async (data) => {
    const response = await api.post('/leagues', data);
    return response.data;
  },

  updateLeague: async (id, data) => {
    const response = await api.put(`/leagues/${id}`, data);
    return response.data;
  },

  deleteLeague: async (id) => {
    const response = await api.delete(`/leagues/${id}`);
    return response.data;
  }
};

export default leagueService;
