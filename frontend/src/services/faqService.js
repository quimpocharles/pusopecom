import api from './api';

const faqService = {
  getFaqs: async () => {
    const response = await api.get('/faq');
    return response.data;
  },

  getAllFaqs: async () => {
    const response = await api.get('/faq/admin/all');
    return response.data;
  },

  createFaq: async (data) => {
    const response = await api.post('/faq', data);
    return response.data;
  },

  updateFaq: async (id, data) => {
    const response = await api.put(`/faq/${id}`, data);
    return response.data;
  },

  deleteFaq: async (id) => {
    const response = await api.delete(`/faq/${id}`);
    return response.data;
  },
};

export default faqService;
