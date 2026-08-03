import api from './api';

const footerService = {
  getFooter: async () => {
    const response = await api.get('/footer');
    return response.data;
  },

  updateSettings: async (data) => {
    const response = await api.put('/footer/settings', data);
    return response.data;
  },

  // Links
  getAllLinks: async () => {
    const response = await api.get('/footer/links/admin/all');
    return response.data;
  },
  createLink: async (data) => (await api.post('/footer/links', data)).data,
  updateLink: async (id, data) => (await api.put(`/footer/links/${id}`, data)).data,
  deleteLink: async (id) => (await api.delete(`/footer/links/${id}`)).data,

  // Social links
  getAllSocialLinks: async () => {
    const response = await api.get('/footer/social/admin/all');
    return response.data;
  },
  createSocialLink: async (data) => (await api.post('/footer/social', data)).data,
  updateSocialLink: async (id, data) => (await api.put(`/footer/social/${id}`, data)).data,
  deleteSocialLink: async (id) => (await api.delete(`/footer/social/${id}`)).data,

  // Payment icons
  getAllPaymentIcons: async () => {
    const response = await api.get('/footer/payment-icons/admin/all');
    return response.data;
  },
  createPaymentIcon: async (data) => (await api.post('/footer/payment-icons', data)).data,
  updatePaymentIcon: async (id, data) => (await api.put(`/footer/payment-icons/${id}`, data)).data,
  deletePaymentIcon: async (id) => (await api.delete(`/footer/payment-icons/${id}`)).data,
};

export default footerService;
