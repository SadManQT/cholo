import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import * as authApi from '../api/auth.api';
import { setUnauthorizedHandler } from '../api/client';
import * as meApi from '../api/me.api';
import type { User } from '../types/user.types';
import { AuthContext } from './auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
  }, []);

  useEffect(() => {
    meApi
      .getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function loadFullProfile() {
    const me = await meApi.getMe();
    setUser(me);
    return me;
  }

  async function login(phone: string, password: string) {
    await authApi.login(phone, password);
    return loadFullProfile();
  }

  async function verifyOtp(phone: string, otp: string) {
    await authApi.verifyOtp(phone, otp);
    return loadFullProfile();
  }

  async function logout() {
    await authApi.logout();
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, verifyOtp, refreshUser: loadFullProfile, logout }}>{children}</AuthContext.Provider>;
}
