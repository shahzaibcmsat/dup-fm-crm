import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface User {
  id: string;
  email: string;
  role: 'admin' | 'member';
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ error?: string }>;
}

export const useAuth = create<AuthState>((set: any) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  checkAuth: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const user: User = {
          id: session.user.id,
          email: session.user.email || '',
          role: (session.user.user_metadata?.role || 'member') as 'admin' | 'member',
        };
        
        set({ user, isAuthenticated: true, isLoading: false });
        
        // Sync with localStorage for compatibility
        localStorage.setItem('userRole', user.role);
        localStorage.setItem('userEmail', user.email);
        localStorage.setItem('userId', user.id);
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
        localStorage.removeItem('userRole');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userId');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        const user: User = {
          id: data.user.id,
          email: data.user.email || '',
          role: (data.user.user_metadata?.role || 'member') as 'admin' | 'member',
        };
        
        set({ user, isAuthenticated: true });
        
        // Sync with localStorage
        localStorage.setItem('userRole', user.role);
        localStorage.setItem('userEmail', user.email);
        localStorage.setItem('userId', user.id);
      }

      return {};
    } catch (error: any) {
      return { error: error.message || 'Login failed' };
    }
  },

  logout: async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      set({ user: null, isAuthenticated: false });
      localStorage.removeItem('userRole');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userId');
      window.location.href = '/login';
    }
  },
}));
