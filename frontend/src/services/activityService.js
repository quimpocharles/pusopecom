import api from './api';

const SESSION_KEY = 'puso-session-id';

const getSessionId = () => {
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
