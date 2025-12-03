import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface MemberPermission {
  id: string;
  userId: string;
  companyIds: string[];
  canSeeInventory: boolean;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  email: string;
  role: 'admin' | 'member';
  canSeeInventory?: boolean;
  permissions?: MemberPermission;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  loadPermissions: () => Promise<void>;
  refreshUserMetadata: () => Promise<void>;
}

export const useAuth = create<AuthState>((set: any) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  checkAuth: async () => {
    try {
      // First try to refresh the session to get the latest user metadata
      const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
      let session = refreshedSession;
      
      // If refresh fails, fallback to getSession
      if (!session) {
        const { data } = await supabase.auth.getSession();
        session = data.session;
      }
      
      if (session?.user) {
        const user: User = {
          id: session.user.id,
          email: session.user.email || '',
          role: (session.user.user_metadata?.role || 'member') as 'admin' | 'member',
          canSeeInventory: session.user.user_metadata?.canSeeInventory || false,
        };
        
        console.log('👤 User authenticated:', {
          email: user.email,
          role: user.role,
          canSeeInventory: user.canSeeInventory,
          metadata: session.user.user_metadata
        });
        
        set({ user, isAuthenticated: true, isLoading: false });
        
        // Sync with localStorage for compatibility
        localStorage.setItem('userRole', user.role);
        localStorage.setItem('userEmail', user.email);
        localStorage.setItem('userId', user.id);

        // Load permissions for members
        if (user.role === 'member') {
          try {
            const response = await fetch(`/api/permissions/${user.id}`);
            if (response.ok) {
              const permissions = await response.json();
              set({
                user: {
                  ...user,
                  permissions,
                },
              });
            }
          } catch (error) {
            console.error('Failed to load permissions:', error);
          }
        }
      } else {
        console.log('❌ No session found');
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
          canSeeInventory: data.user.user_metadata?.canSeeInventory || false,
        };
        
        console.log('✅ Login successful:', {
          email: user.email,
          role: user.role,
          canSeeInventory: user.canSeeInventory,
          metadata: data.user.user_metadata
        });
        
        set({ user, isAuthenticated: true });
        
        // Sync with localStorage
        localStorage.setItem('userRole', user.role);
        localStorage.setItem('userEmail', user.email);
        localStorage.setItem('userId', user.id);

        // Load permissions for members immediately after login
        if (user.role === 'member') {
          try {
            const response = await fetch(`/api/permissions/${user.id}`);
            if (response.ok) {
              const permissions = await response.json();
              console.log('✅ Permissions loaded on login:', permissions);
              set({
                user: {
                  ...user,
                  permissions,
                },
                isAuthenticated: true,
              });
            }
          } catch (error) {
            console.error('Failed to load permissions on login:', error);
          }
        }
      }

      return {};
    } catch (error: any) {
      return { error: error.message || 'Login failed' };
    }
  },

  logout: async () => {
    console.log('🚪 Logging out...');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
      } else {
        console.log('✅ Supabase signout successful');
      }
    } catch (error) {
      console.error('❌ Logout exception:', error);
    } finally {
      console.log('🧹 Clearing auth state and redirecting...');
      set({ user: null, isAuthenticated: false });
      localStorage.removeItem('userRole');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userId');
      localStorage.clear(); // Clear all localStorage
      window.location.href = '/login';
    }
  },

  loadPermissions: async () => {
    const state = useAuth.getState();
    if (!state.user || state.user.role === 'admin') {
      // Admins don't need permissions loaded
      return;
    }

    try {
      const response = await fetch(`/api/permissions/${state.user.id}`);
      if (response.ok) {
        const permissions = await response.json();
        set({
          user: {
            ...state.user,
            permissions,
          },
        });
      }
    } catch (error) {
      console.error('Failed to load permissions:', error);
    }
  },

  refreshUserMetadata: async () => {
    try {
      // Force refresh the session to get updated user metadata
      const { data: { session } } = await supabase.auth.refreshSession();
      
      if (session?.user) {
        const state = useAuth.getState();
        const user: User = {
          id: session.user.id,
          email: session.user.email || '',
          role: (session.user.user_metadata?.role || 'member') as 'admin' | 'member',
          canSeeInventory: session.user.user_metadata?.canSeeInventory || false,
          permissions: state.user?.permissions, // Preserve existing permissions
        };
        
        console.log('🔄 User metadata refreshed:', {
          email: user.email,
          role: user.role,
          canSeeInventory: user.canSeeInventory,
        });
        
        set({ user, isAuthenticated: true });
        
        // Sync with localStorage
        localStorage.setItem('userRole', user.role);
        localStorage.setItem('userEmail', user.email);
        localStorage.setItem('userId', user.id);
      }
    } catch (error) {
      console.error('Failed to refresh user metadata:', error);
    }
  },
}));
