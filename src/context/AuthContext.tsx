import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';

export interface AuthUser {
  uid: string;
  email: string;
  username?: string;
  displayName?: string;
  color?: string;
  emoji?: string;
  parentModeEnabled?: boolean;
  availability?: Record<string, string[]>;
}

interface AuthContextValue {
  authUser: AuthUser | null;
  loading: boolean;
  login: (googleCredential: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading]   = useState(true);

  const refreshAuth = useCallback(async () => {
    try {
      const u = await apiFetch<AuthUser>('/api/auth/me');
      setAuthUser(u);
    } catch {
      setAuthUser(null);
    }
  }, []);

  useEffect(() => {
    refreshAuth().finally(() => setLoading(false));
  }, [refreshAuth]);

  const login = useCallback(async (googleCredential: string) => {
    const u = await apiFetch<AuthUser>('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ credential: googleCredential }),
    });
    setAuthUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setAuthUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ authUser, loading, login, logout, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
