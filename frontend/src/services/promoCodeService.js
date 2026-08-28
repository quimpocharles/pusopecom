import api from './api';

const promoCodeService = {
  validateCode: async ({ code, items, passes, subtotal, shippingFee, email }) => {
    const response = await api.post('/promo-codes/validate', { code, items, passes, subtotal, shippingFee, email });
    return response.data;
  },

  getAll: async () => {
    const response = await api.get('/promo-codes/admin/all');
    return response.data;
  },

  // Lightweight event list for the "Applies To" event picker (EVENT scope) —
  // gated by PROMOTIONS_MANAGE server-side, not PASSES_MANAGE.
  getEvents: async () => {
    const response = await api.get('/promo-codes/admin/events');
    return response.data;
  },

  create: async (data) => {
    const response = await api.post('/promo-codes', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.put(`/promo-codes/${id}`, data);
    return response.data;
  },

  remove: async (id) => {
    const response = await api.delete(`/promo-codes/${id}`);
    return response.data;
  },
};

export default promoCodeService;
