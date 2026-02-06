import api from './api';

export const orderService = {
  createOrder: async (orderData) => {
    const response = await api.post('/orders', orderData);
    return response.data;
  },

  getOrderByNumber: async (orderNumber) => {
    const response = await api.get(`/orders/${orderNumber}`);
    return response.data;
  },

  getUserOrders: async (userId) => {
    const response = await api.get(`/orders/user/${userId}`);
    return response.data;
  },

  // Admin functions
  getOrderStats: async () => {
    const response = await api.get('/orders/admin/stats');
    return response.data;
  },

  getAllOrders: async (params = {}) => {
    const response = await api.get('/orders/admin/all', { params });
    return response.data;
  },

  updateOrderStatus: async (orderId, statusData) => {
    const response = await api.patch(`/orders/${orderId}/status`, statusData);
    return response.data;
  },

  verifyPayment: async (orderNumber) => {
    const response = await api.post(`/orders/${orderNumber}/verify-payment`);
    return response.data;
  }
};

export default orderService;
