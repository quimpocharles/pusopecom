import api from './api';

export const productService = {
  getProducts: async (params = {}) => {
    const response = await api.get('/products', { params });
    return response.data;
  },

  getProductBySlug: async (slug) => {
    const response = await api.get(`/products/${slug}`);
    return response.data;
  },

  getFeaturedProducts: async () => {
    const response = await api.get('/products', { params: { featured: true, limit: 8 } });
    return response.data;
  },

  getSearchSuggestions: async (q) => {
    const response = await api.get('/products/search/suggestions', { params: { q } });
    return response.data;
  },

  searchProducts: async (searchTerm, filters = {}) => {
    const response = await api.get('/products', {
      params: {
        search: searchTerm,
        ...filters
      }
    });
    return response.data;
  },

  // Admin functions
  createProduct: async (productData) => {
    const response = await api.post('/products', productData);
    return response.data;
  },

  updateProduct: async (id, productData) => {
    const response = await api.put(`/products/${id}`, productData);
    return response.data;
  },

  deleteProduct: async (id) => {
    const response = await api.delete(`/products/${id}`);
    return response.data;
  },

  getProductStats: async () => {
    const response = await api.get('/products/admin/stats');
    return response.data;
  },

  getAdminProducts: async (params = {}) => {
    const response = await api.get('/products/admin/all', { params });
    return response.data;
  },

  getProductById: async (id) => {
    const response = await api.get(`/products/admin/${id}`);
    return response.data;
  },

  // Reviews
  getReviews: async (slug, params = {}) => {
    const response = await api.get(`/products/${slug}/reviews`, { params });
    return response.data;
  },

  createReview: async (slug, reviewData) => {
    const response = await api.post(`/products/${slug}/reviews`, reviewData);
    return response.data;
  },
};

export default productService;
