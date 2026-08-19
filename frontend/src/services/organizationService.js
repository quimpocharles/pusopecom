import api from './api';

const organizationService = {
  getAll: async () => {
    const response = await api.get('/organizations/admin/list');
    return response.data;
  },

  getTeams: async (organizationId) => {
    const response = await api.get(`/organizations/admin/${organizationId}/teams`);
    return response.data;
  },
};

export default organizationService;
