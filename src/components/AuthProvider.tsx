import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiGet, apiPost, clearAuthToken, getAuthToken, setAuthToken } from '../api/client';
import type { AuthUser } from '../api/types';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  bootstrap: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  const clearSession = useCallback(() => {
    clearAuthToken();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  useEffect(() => {
    if (!getAuthToken()) {
      setStatus('unauthenticated');
      return;
    }
    apiGet<AuthUser>('/auth/me')
      .then((me) => {
        setUser(me);
        setStatus('authenticated');
      })
      .catch(() => clearSession());
  }, [clearSession]);

  useEffect(() => {
    window.addEventListener('auth:unauthorized', clearSession);
    return () => window.removeEventListener('auth:unauthorized', clearSession);
  }, [clearSession]);

  const applySession = (result: { token: string; user: AuthUser }) => {
    setAuthToken(result.token);
    setUser(result.user);
    setStatus('authenticated');
  };

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiPost<{ token: string; user: AuthUser }>('/auth/login', { email, password });
    applySession(result);
  }, []);

  const bootstrap = useCallback(async (email: string, password: string) => {
    const result = await apiPost<{ token: string; user: AuthUser }>('/auth/bootstrap', { email, password });
    applySession(result);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiPost('/auth/logout');
    } catch {
      // Da igual si falla en el servidor (token ya expirado, red caída):
      // igual limpiamos la sesión local.
    }
    clearSession();
  }, [clearSession]);

  return (
    <AuthContext.Provider value={{ status, user, login, bootstrap, logout }}>{children}</AuthContext.Provider>
  );
}
