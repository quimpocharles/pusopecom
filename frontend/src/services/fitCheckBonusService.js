import api from './api';

// Admin-only Bonus Fit Check operations — routes/tryon.js's /admin/* routes,
// separate from fitCheckQuotaService.js's customer-facing quota read.
export const fitCheckBonusService = {
  getGrants: async (userId) => {
    const response = await api.get(`/tryon/admin/bonus-grants/${userId}`);
    return response.data;
  },
  grantBonus: async ({ userId, amount, note }) => {
    const response = await api.post('/tryon/admin/bonus-grant', { userId, amount, note });
    return response.data;
  },
};

export default fitCheckBonusService;
