import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getApiToken, setApiToken, clearApiToken } from './services/dataService';

interface AdminUser {
  email: string;
  displayName: string;
  role: 'super_admin' | 'admin';
  allowedTabs: string[];
}

interface AuthContextType {
  user: AdminUser | null;
  profile: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = 'tkm_admin_session';
const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000;   // 8 ชั่วโมง
const IDLE_TIMEOUT_MS    = 30 * 60 * 1000;         // 30 นาที idle

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doLogout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    clearApiToken();
    setUser(null);
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(doLogout, IDLE_TIMEOUT_MS);
  }, [doLogout]);

  // โหลด session จาก localStorage
  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
          doLogout();
        } else {
          const { expiresAt: _, ...adminUser } = parsed;
          setUser(adminUser);
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    setLoading(false);
  }, []);

  // ติด idle listener เมื่อ login อยู่
  useEffect(() => {
    if (!user) {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      return;
    }
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }));
    resetIdleTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [user, resetIdleTimer]);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }
    const { token, user: u } = await res.json();
    setApiToken(token);
    const adminUser: AdminUser = { email: u.email, displayName: u.name, role: u.role || 'admin', allowedTabs: u.allowedTabs || [] };
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      ...adminUser,
      expiresAt: Date.now() + SESSION_TIMEOUT_MS,
    }));
    setUser(adminUser);
  };

  const logout = async () => {
    try {
      const token = getApiToken();
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      }
    } catch { /* ไม่ block logout ถ้า network fail */ }
    doLogout();
  };

  return (
    <AuthContext.Provider value={{ user, profile: user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
