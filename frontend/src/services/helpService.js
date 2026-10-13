import api from './api';

const helpService = {
  getCategories: async () => {
    const response = await api.get('/admin/help/categories');
    return response.data;
  },

  getArticles: async (params = {}) => {
    const response = await api.get('/admin/help/articles', { params });
    return response.data;
  },

  getArticle: async (slug) => {
    const response = await api.get(`/admin/help/articles/${slug}`);
    return response.data;
  },
};

export default helpService;
