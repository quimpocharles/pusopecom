import api from './api';

const partnerLogoService = {
  getLogos: async () => {
    const response = await api.get('/partner-logos');
    return response.data;
  },

  getAllLogos: async () => {
    const response = await api.get('/partner-logos/admin/all');
    return response.data;
  },

  createLogo: async (data) => {
    const response = await api.post('/partner-logos', data);
    return response.data;
  },

  updateLogo: async (id, data) => {
    const response = await api.put(`/partner-logos/${id}`, data);
    return response.data;
  },

  deleteLogo: async (id) => {
    const response = await api.delete(`/partner-logos/${id}`);
    return response.data;
  },
};

export default partnerLogoService;
