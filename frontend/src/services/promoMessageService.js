import api from './api';

const promoMessageService = {
  getMessages: async (placement) => {
    const response = await api.get('/promo-messages', { params: { placement } });
    return response.data;
  },

  getAllMessages: async () => {
    const response = await api.get('/promo-messages/admin/all');
    return response.data;
  },

  createMessage: async (data) => {
    const response = await api.post('/promo-messages', data);
    return response.data;
  },

  updateMessage: async (id, data) => {
    const response = await api.put(`/promo-messages/${id}`, data);
    return response.data;
  },

  deleteMessage: async (id) => {
    const response = await api.delete(`/promo-messages/${id}`);
    return response.data;
  },
};

export default promoMessageService;
