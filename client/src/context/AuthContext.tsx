import { isAxiosError } from 'axios';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import * as authApi from '../api/auth.api';
import { setUnauthorizedHandler } from '../api/client';
import * as meApi from '../api/me.api';
import type { User } from '../types/user.types';
import { AuthContext } from './auth';
import { language, setLanguage, storedLanguage } from '../i18n';

function syncLanguage(me: User) {
  const chosenHere = storedLanguage();
  if (chosenHere && chosenHere !== me.preferredLanguage) {
    meApi.updateMe({ preferredLanguage: chosenHere }).catch(() => {});
  } else if (!chosenHere && me.preferredLanguage !== language) {
    setLanguage(me.preferredLanguage);
  }
}

const STARTUP_RETRIES = 12;
const STARTUP_RETRY_MS = 5_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      for (let attempt = 0; ; attempt += 1) {
        try {
          const me = await meApi.getMe();
          if (cancelled) return;
          setUser(me);
          syncLanguage(me);
          break;
        } catch (error) {
          const status = isAxiosError(error) ? error.response?.status : undefined;
          const waking = status === undefined || status === 502 || status === 503 || status === 504;
          if (cancelled) return;
          if (!waking || attempt >= STARTUP_RETRIES) {
            setUser(null);
            break;
          }
          await new Promise((resolve) => window.setTimeout(resolve, STARTUP_RETRY_MS));
        }
      }
      if (!cancelled) setLoading(false);
    }
    void bootstrap();
    return () => { cancelled = true; };
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
