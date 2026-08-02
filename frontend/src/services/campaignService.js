import api from './api';

const campaignService = {
  getActiveCampaign: async (placement) => {
    const response = await api.get('/campaigns/active', { params: { placement } });
    return response.data;
  },

  getCampaigns: async () => {
    const response = await api.get('/campaigns');
    return response.data;
  },

  createCampaign: async (data) => {
    const response = await api.post('/campaigns', data);
    return response.data;
  },

  updateCampaign: async (id, data) => {
    const response = await api.put(`/campaigns/${id}`, data);
    return response.data;
  },

  deleteCampaign: async (id) => {
    const response = await api.delete(`/campaigns/${id}`);
    return response.data;
  },
};

export default campaignService;
