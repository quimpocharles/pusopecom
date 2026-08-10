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

  getSearchSuggestions: async (q, filters = {}) => {
    const response = await api.get('/products/search/suggestions', { params: { q, ...filters } });
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

  getCartRecommendations: async (productIds, limit = 4) => {
    const response = await api.get('/products/recommendations/cart', {
      params: { cartProductIds: productIds.join(','), limit }
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

  hardDeleteProduct: async (id) => {
    const response = await api.delete(`/products/${id}/permanent`);
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

  exportProductsCSV: async () => {
    const response = await api.get('/products/admin/export', { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    const d = new Date();
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    a.download = `${yy}${mm}${dd} - Inventory Report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // Image uploads
  uploadImage: async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  uploadImages: async (files) => {
    const formData = new FormData();
    files.forEach((f) => formData.append('images', f));
    const response = await api.post('/upload/multiple', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
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

  getMyReviewedProductIds: async () => {
    const response = await api.get('/products/reviews/my');
    return response.data;
  },
};

export default productService;
