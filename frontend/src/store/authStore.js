import { create } from 'zustand';
import authService from '../services/authService';

const useAuthStore = create((set) => ({
  user: authService.getStoredUser(),
  isAuthenticated: authService.isAuthenticated(),
  loading: false,

  setUser: (user) => {
    set({ user, isAuthenticated: !!user });
  },

  login: async (credentials) => {
    set({ loading: true });
    try {
      const response = await authService.login(credentials);
      set({ user: response.user, isAuthenticated: true, loading: false });
      return response;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  googleLogin: async (credential) => {
    set({ loading: true });
    try {
      const response = await authService.googleLogin(credential);
      set({ user: response.user, isAuthenticated: true, loading: false });
      return response;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  logout: () => {
    authService.logout();
    set({ user: null, isAuthenticated: false });
  },

  refreshUser: async () => {
    try {
      const response = await authService.getCurrentUser();
      set({ user: response.user });
      localStorage.setItem('user', JSON.stringify(response.user));
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }
}));

export default useAuthStore;
