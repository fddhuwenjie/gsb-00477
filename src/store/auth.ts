import { create } from 'zustand';
import type { User } from '../../shared/types.js';
import { api } from '../lib/api.js';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('auth_token'),
  loading: false,

  login: async (username, password) => {
    set({ loading: true });
    try {
      const data = await api.auth.login(username, password);
      localStorage.setItem('auth_token', data.token);
      set({ user: data.user, token: data.token, loading: false });
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  logout: async () => {
    try {
      await api.auth.logout();
    } catch {}
    localStorage.removeItem('auth_token');
    set({ user: null, token: null });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      set({ user: null });
      return;
    }
    try {
      const user = await api.auth.me();
      set({ user, token });
    } catch {
      localStorage.removeItem('auth_token');
      set({ user: null, token: null });
    }
  },
}));
