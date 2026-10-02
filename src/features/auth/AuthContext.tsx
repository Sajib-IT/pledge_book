// src/features/auth/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type { Profile, UserRole } from '../../types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole;
  isOwner: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  registerUser: (params: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    role?: UserRole;
  }) => Promise<{ success: boolean; error?: string; requiresEmailConfirmation?: boolean }>;
  logout: () => Promise<void>;
  switchDemoRole: (role: UserRole) => void;
  isMockMode: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Demo profiles for local development / testing without live Supabase
const DEMO_OWNER_PROFILE: Profile = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Haji Mohammad Rafiq',
  role: 'owner',
  phone: '01711000001',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const DEMO_STAFF_PROFILE: Profile = {
  id: '00000000-0000-0000-0000-000000000002',
  name: 'Tanvir Ahmed',
  role: 'staff',
  phone: '01812000002',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isMockMode, setIsMockMode] = useState<boolean>(!isSupabaseConfigured);

  const fetchProfile = async (userId: string, userMetadata?: any) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        console.warn('Profile not found in profiles table:', error);
        // Fallback profile if trigger hasn't run or table empty
        const fallbackProfile: Profile = {
          id: userId,
          name: userMetadata?.name || userMetadata?.full_name || 'User',
          role: (userMetadata?.role || 'owner') as UserRole,
          phone: userMetadata?.phone || null,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setProfile(fallbackProfile);
        return;
      }
      setProfile(data);
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Initialize with demo owner profile
      const savedMock = localStorage.getItem('mock_user_role') as UserRole || 'owner';
      const initialProfile = savedMock === 'owner' ? DEMO_OWNER_PROFILE : DEMO_STAFF_PROFILE;
      setProfile(initialProfile);
      setUser({
        id: initialProfile.id,
        email: initialProfile.role === 'owner' ? 'owner@pledgebook.bd' : 'staff@pledgebook.bd',
        app_metadata: {},
        user_metadata: { name: initialProfile.name },
        aud: 'authenticated',
        created_at: initialProfile.created_at,
      } as unknown as User);
      setIsLoading(false);
      setIsMockMode(true);
      return;
    }

    // Live Supabase Auth state listener
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.user_metadata);
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.user_metadata);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (emailOrPhone: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    if (isMockMode) {
      const isOwnerLogin = emailOrPhone.includes('owner') || emailOrPhone.includes('rafiq') || pass === 'owner';
      const chosen = isOwnerLogin ? DEMO_OWNER_PROFILE : DEMO_STAFF_PROFILE;
      setProfile(chosen);
      setUser({
        id: chosen.id,
        email: emailOrPhone,
        app_metadata: {},
        user_metadata: { name: chosen.name },
        aud: 'authenticated',
        created_at: chosen.created_at,
      } as unknown as User);
      localStorage.setItem('mock_user_role', chosen.role);
      return { success: true };
    }

    try {
      const cleanInput = emailOrPhone.trim();
      const credentials = cleanInput.includes('@')
        ? { email: cleanInput, password: pass }
        : { phone: cleanInput, password: pass };

      const { data, error } = await supabase.auth.signInWithPassword(credentials as any);

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        await fetchProfile(data.user.id, data.user.user_metadata);
      }
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown login error';
      return { success: false, error: msg };
    }
  };

  const registerUser = async (params: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    role?: UserRole;
  }): Promise<{ success: boolean; error?: string; requiresEmailConfirmation?: boolean }> => {
    if (isMockMode) {
      const newProfile: Profile = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mock-${Date.now()}`,
        name: params.name.trim(),
        role: params.role || 'owner',
        phone: params.phone?.trim() || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setProfile(newProfile);
      setUser({
        id: newProfile.id,
        email: params.email.trim(),
        app_metadata: {},
        user_metadata: { name: newProfile.name, phone: newProfile.phone },
        aud: 'authenticated',
        created_at: newProfile.created_at,
      } as unknown as User);
      localStorage.setItem('mock_user_role', newProfile.role);
      return { success: true, requiresEmailConfirmation: false };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: params.email.trim(),
        password: params.password,
        options: {
          data: {
            name: params.name.trim(),
            full_name: params.name.trim(),
            phone: params.phone?.trim() || null,
            role: params.role || 'owner',
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.session && data.user) {
        setSession(data.session);
        setUser(data.user);
        await fetchProfile(data.user.id, data.user.user_metadata);
        return { success: true, requiresEmailConfirmation: false };
      } else if (data.user && !data.session) {
        return { success: true, requiresEmailConfirmation: true };
      }

      return { success: true, requiresEmailConfirmation: false };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown registration error';
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    if (isMockMode) {
      setUser(null);
      setProfile(null);
      return;
    }
    await supabase.auth.signOut();
  };

  const switchDemoRole = (role: UserRole) => {
    const next = role === 'owner' ? DEMO_OWNER_PROFILE : DEMO_STAFF_PROFILE;
    setProfile(next);
    setUser({
      id: next.id,
      email: `${role}@pledgebook.bd`,
      app_metadata: {},
      user_metadata: { name: next.name },
      aud: 'authenticated',
      created_at: next.created_at,
    } as unknown as User);
    localStorage.setItem('mock_user_role', role);
  };

  const role: UserRole = profile?.role ?? 'staff';
  const isOwner = role === 'owner';

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        isOwner,
        isLoading,
        login,
        registerUser,
        logout,
        switchDemoRole,
        isMockMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
