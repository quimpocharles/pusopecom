import api from './api';

const fitCheckCampaignService = {
  getCampaigns: async () => {
    const response = await api.get('/fit-check-campaigns');
    return response.data;
  },

  createCampaign: async (data) => {
    const response = await api.post('/fit-check-campaigns', data);
    return response.data;
  },

  updateCampaign: async (id, data) => {
    const response = await api.put(`/fit-check-campaigns/${id}`, data);
    return response.data;
  },

  deleteCampaign: async (id) => {
    const response = await api.delete(`/fit-check-campaigns/${id}`);
    return response.data;
  },

  // Public read — the "Unlimited Fit Checks — Sponsored by X" badge on a product page.
  getActiveForProduct: async (productId) => {
    const response = await api.get(`/tryon/campaigns/active-for-product/${productId}`);
    return response.data;
  },
};

export default fitCheckCampaignService;
