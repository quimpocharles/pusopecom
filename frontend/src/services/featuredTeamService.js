import api from './api';

const featuredTeamService = {
  getActiveTeam: async () => {
    const response = await api.get('/featured-team/active');
    return response.data;
  },

  getTeams: async () => {
    const response = await api.get('/featured-team');
    return response.data;
  },

  createTeam: async (data) => {
    const response = await api.post('/featured-team', data);
    return response.data;
  },

  updateTeam: async (id, data) => {
    const response = await api.put(`/featured-team/${id}`, data);
    return response.data;
  },

  deleteTeam: async (id) => {
    const response = await api.delete(`/featured-team/${id}`);
    return response.data;
  },
};

export default featuredTeamService;
