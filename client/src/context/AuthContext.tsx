import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import * as authApi from '../api/auth.api';
import { setUnauthorizedHandler } from '../api/client';
import * as meApi from '../api/me.api';
import type { User } from '../types/user.types';
import { AuthContext } from './auth';
import { language, setLanguage, storedLanguage } from '../i18n';

// A language picked on this device wins and is saved to the profile; otherwise the profile's choice applies
// (which reloads the page once into that language).
function syncLanguage(me: User) {
  const chosenHere = storedLanguage();
  if (chosenHere && chosenHere !== me.preferredLanguage) {
    meApi.updateMe({ preferredLanguage: chosenHere }).catch(() => {});
  } else if (!chosenHere && me.preferredLanguage !== language) {
    setLanguage(me.preferredLanguage);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
  }, []);

  useEffect(() => {
    meApi
      .getMe()
      .then((me) => {
        setUser(me);
        syncLanguage(me);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function loadFullProfile() {
    const me = await meApi.getMe();
    setUser(me);
    syncLanguage(me);
    return me;
  }

  async function login(phone: string, password: string) {
    const challenge = await authApi.login(phone, password);
    return challenge ?? loadFullProfile();
  }

  async function completeTwoFactor(challengeToken: string, code: string) {
    await authApi.loginTwoFactor(challengeToken, code);
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

  return <AuthContext.Provider value={{ user, loading, login, completeTwoFactor, verifyOtp, refreshUser: loadFullProfile, logout }}>{children}</AuthContext.Provider>;
}
