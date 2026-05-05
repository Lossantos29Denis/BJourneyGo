import { storage } from '@/utils/storage';
import { getToken, setToken, clearTokens, login as apiLogin, register as apiRegister, me as apiMe } from '@/lib/api'
import React, { createContext, useContext, useEffect, useState } from 'react';

type User = {
  id: string;
  email: string;
  username: string;
  role?: string;
  scannerEnabled?: boolean;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadUser(); }, []);

  const loadUser = async () => {
    try {
      const cachedRaw = await storage.getItem('@user')
      const cachedUser = cachedRaw ? JSON.parse(cachedRaw) : null

      const token = await getToken()
      if (token) {
        const json = await apiMe()
        const u = json.user
        if (u) {
          // normalize to local user shape: provide 'username' for UI
          const scannerEnabled = Boolean(u.scannerEnabled)
          const roleFromApi = String(u.role || '')
          const role = roleFromApi === 'USER' && scannerEnabled
            ? 'scanner'
            : roleFromApi === 'SCANNER'
              ? 'scanner'
              : roleFromApi
          const local = { id: u.id, email: u.email, username: u.name || u.email, role, scannerEnabled }
          await storage.setItem('@user', JSON.stringify(local))
          setUser(local)
        }
      }
    } catch (error) {
      const err: any = error
      const message = String(err?.message || '')
      const shouldResetSession = err?.status === 401 || message.toLowerCase().includes('invalid token')

      if (shouldResetSession) {
        await clearTokens()
        await storage.removeItem('@user')
        setUser(null)
        console.warn('Session restored with cleanup: invalid token was removed.')
      } else {
        console.warn('Session restore skipped:', message || 'unknown error')
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const resp = await apiLogin(email, password)
    const token = resp.token
    if (!token) throw new Error('no token received')
    await setToken(token)
    const me = await apiMe()
    const u = me.user
    if (u) {
      const scannerEnabled = Boolean(resp?.scannerEnabled || u.scannerEnabled)
      const roleFromApi = String(resp?.role || u.role || '')
      const role = roleFromApi === 'USER' && scannerEnabled
        ? 'scanner'
        : roleFromApi === 'SCANNER'
          ? 'scanner'
          : roleFromApi
      const local = { id: u.id, email: u.email, username: u.name || u.email, role, scannerEnabled }
      await storage.setItem('@user', JSON.stringify(local))
      setUser(local)
    }
  };

  const register = async (username: string, email: string, password: string) => {
    const resp = await apiRegister(email, password, username)
    return resp
  };

  // refresh user when app becomes active to pick up server-side changes (e.g., name updated in web)
  useEffect(() => {
    const subscription = (evt: any) => {
      if (evt === 'active') {
        loadUser()
      }
    }
    // dynamic import to avoid importing AppState on web build issues
    try {
      // @ts-ignore
      const { AppState } = require('react-native')
      const listener = AppState.addEventListener ? AppState.addEventListener('change', (s: string) => { if (s === 'active') loadUser() }) : AppState.addEventListener('change', (s: string) => { if (s === 'active') loadUser() })
      return () => {
        try { listener.remove && listener.remove() } catch (e) {}
      }
    } catch (e) {
      return
    }
  }, [])

  const logout = async () => {
    await clearTokens()
    await storage.removeItem('@user')
    setUser(null)
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
