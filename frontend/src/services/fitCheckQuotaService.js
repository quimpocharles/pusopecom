import api from './api';
import { getSessionId } from './activityService';
import useAuthStore from '../store/authStore';

// GET /api/tryon/quota lives outside the authenticate-gated /api/account/*
// router on purpose — a guest's own 1/day allowance has to be visible
// before they've ever logged in, so this can't require a token the way
// the rest of accountService's endpoints do.
export const fitCheckQuotaService = {
  getQuota: async () => {
    const isAuthenticated = useAuthStore.getState().isAuthenticated;
    const params = isAuthenticated ? {} : { sessionId: getSessionId() };
    const response = await api.get('/tryon/quota', { params });
    return response.data;
  },
};

export default fitCheckQuotaService;
