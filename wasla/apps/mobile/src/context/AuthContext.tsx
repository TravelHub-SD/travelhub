import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setAuthToken, type ApiUser } from '../api';
import { tokenStorage } from '../storage';

const TOKEN_KEY = 'wasla.token';

type AuthContextValue = {
  user: ApiUser | null;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (data: { name: string; phone: string; password: string; email?: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: { name?: string; email?: string }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // استعادة الجلسة عند الإقلاع، والتحقق من صلاحية التوكن لدى السيرفر
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = await tokenStorage.get(TOKEN_KEY);
        if (!token) return;

        setAuthToken(token);
        const { user: restored } = await api.me();
        if (!cancelled) setUser(restored);
      } catch {
        // توكن منتهٍ أو تالف — نبدأ من شاشة الدخول
        setAuthToken(null);
        await tokenStorage.remove(TOKEN_KEY);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (token: string, nextUser: ApiUser) => {
    setAuthToken(token);
    await tokenStorage.set(TOKEN_KEY, token);
    setUser(nextUser);
  }, []);

  const login = useCallback(
    async (phone: string, password: string) => {
      const { token, user: nextUser } = await api.login({ phone, password });
      await persist(token, nextUser);
    },
    [persist]
  );

  const register = useCallback(
    async (data: { name: string; phone: string; password: string; email?: string }) => {
      const { token, user: nextUser } = await api.register(data);
      await persist(token, nextUser);
    },
    [persist]
  );

  const logout = useCallback(async () => {
    setAuthToken(null);
    await tokenStorage.remove(TOKEN_KEY);
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (data: { name?: string; email?: string }) => {
    const { user: nextUser } = await api.updateProfile(data);
    setUser(nextUser);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, register, logout, updateProfile }),
    [user, isLoading, login, register, logout, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
