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

  updateOrderStatus: async (orderId, { orderStatus, trackingNumber, courier }) => {
    const response = await api.patch(`/orders/${orderId}/status`, {
      orderStatus,
      ...(trackingNumber !== undefined && { trackingNumber }),
      ...(courier !== undefined && { courier })
    });
    return response.data;
  },

  verifyPayment: async (orderNumber) => {
    const response = await api.post(`/orders/${orderNumber}/verify-payment`);
    return response.data;
  },

  exportOrdersCSV: async (period = 'all') => {
    const response = await api.get('/orders/admin/export', {
      params: { period },
      responseType: 'blob'
    });

    const d = new Date();
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const datePrefix = `${yy}${mm}${dd}`;

    const labelMap = {
      daily: 'Daily Transaction Report',
      weekly: 'Weekly Transaction Report',
      monthly: 'Monthly Transaction Report',
      yearly: 'Annual Transaction Report',
      all: 'Transaction Report'
    };
    const label = labelMap[period] || 'Transaction Report';

    const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${datePrefix} - ${label}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
};

export default orderService;
