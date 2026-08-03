import api from './api';

export const accountService = {
  getDashboard: async () => {
    const response = await api.get('/account/dashboard');
    return response.data;
  },

  getOrders: async (params = {}) => {
    const response = await api.get('/account/orders', { params });
    return response.data;
  },

  getOrderByNumber: async (orderNumber) => {
    const response = await api.get(`/account/orders/${orderNumber}`);
    return response.data;
  },

  getTryOns: async (params = {}) => {
    const response = await api.get('/account/try-ons', { params });
    return response.data;
  },

  getTryOnById: async (id) => {
    const response = await api.get(`/account/try-ons/${id}`);
    return response.data;
  },

  getWishlist: async (params = {}) => {
    const response = await api.get('/account/wishlist', { params });
    return response.data;
  },

  addWishlistItem: async (productId) => {
    const response = await api.post(`/account/wishlist/${productId}`);
    return response.data;
  },

  removeWishlistItem: async (productId) => {
    const response = await api.delete(`/account/wishlist/${productId}`);
    return response.data;
  },

  getOrganizations: async () => {
    const response = await api.get('/account/organizations');
    return response.data;
  },

  getAddresses: async (params = {}) => {
    const response = await api.get('/account/addresses', { params });
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get('/account/profile');
    return response.data;
  },

  updateProfile: async (data) => {
    const response = await api.put('/account/profile', data);
    return response.data;
  },

  getNotifications: async (params = {}) => {
    const response = await api.get('/account/notifications', { params });
    return response.data;
  },

  markNotificationsRead: async (ids) => {
    const response = await api.patch('/account/notifications/read', ids ? { ids } : {});
    return response.data;
  },

  getSecurity: async () => {
    const response = await api.get('/account/security');
    return response.data;
  },
};

export default accountService;
