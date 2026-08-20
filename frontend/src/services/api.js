import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // suppressAuthRedirect: set by background/queued callers (the Pass
    // check-in offline sync queue replaying a check-in) that shouldn't
    // yank the user out to /login mid-session over a stale token — they
    // handle the 401 themselves and surface a "sign in again" prompt
    // in place instead. Every normal foreground call keeps this behavior.
    if (error.response?.status === 401 && !error.config?.suppressAuthRedirect) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
