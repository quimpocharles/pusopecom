import api from './api';

const pickupService = {
  getPickupConfig: async () => {
    const response = await api.get('/admin/pickup');
    return response.data;
  },

  updatePickupConfig: async (data) => {
    const response = await api.put('/admin/pickup', data);
    return response.data;
  },
};

export default pickupService;
