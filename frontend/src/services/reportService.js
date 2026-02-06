import api from './api';

export const reportService = {
  getSalesReport: async (params = {}) => {
    const response = await api.get('/reports/sales', { params });
    return response.data;
  },

  getProductsReport: async (params = {}) => {
    const response = await api.get('/reports/products', { params });
    return response.data;
  },

  getOrdersReport: async (params = {}) => {
    const response = await api.get('/reports/orders', { params });
    return response.data;
  },

  getCustomersReport: async (params = {}) => {
    const response = await api.get('/reports/customers', { params });
    return response.data;
  },

  getTryOnReport: async (params = {}) => {
    const response = await api.get('/reports/tryon', { params });
    return response.data;
  }
};

export default reportService;
