import api from './api';

const settingsService = {
  getSettings: async () => {
    const response = await api.get('/settings');
    return response.data;
  },

  updateSettings: async (data) => {
    const response = await api.put('/settings', data);
    return response.data;
  },

  getVenuePickup: async () => {
    const response = await api.get('/settings/venue-pickup');
    return response.data;
  },
};

export default settingsService;
