import api from './api';

const SESSION_KEY = 'puso-session-id';

// Exported — this is the same client-generated guest identity Fit Check's
// daily quota now uses (lib/fitCheckQuota.js on the backend) to key an
// unauthenticated visitor's allowance, not just activity logging.
export const getSessionId = () => {
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
};

export const activityService = {
  trackView: (productId) => {
    api.post('/activity/view', { productId, sessionId: getSessionId() }).catch(() => {});
  },

  trackSearch: (query) => {
    api.post('/activity/search', { query, sessionId: getSessionId() }).catch(() => {});
  }
};

export default activityService;
