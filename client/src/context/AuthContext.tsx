import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import * as authApi from '../api/auth.api';
import { setUnauthorizedHandler } from '../api/client';
import * as meApi from '../api/me.api';
import type { User } from '../types/user.types';
import { AuthContext } from './auth';

// doc 11 §11: Cholo needs "exactly these two" app-wide contexts — this is
// one of them.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // api/client.ts's response interceptor calls this when a refresh
    // conclusively fails (session over, not just "this one request 401'd")
    // — the one path back into React state from outside it.
    setUnauthorizedHandler(() => setUser(null));
  }, []);

  useEffect(() => {
    // The access token lives only in memory (api/client.ts) — a fresh page
    // load has none. Calling getMe() with no token 401s immediately, which
    // is exactly what drives api/client.ts's interceptor to try the
    // httpOnly refresh cookie automatically: if a real session exists, this
    // silently restores it; if not, the 401 from /auth/refresh itself just
    // means "not logged in", not an error.
    meApi
      .getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // One canonical User shape app-wide (types/user.types.ts) — fetched fresh
  // rather than trusting login's/verify-otp's own lighter response shape,
  // so every consumer of useAuth().user sees the same fields (wallet,
  // photoUrl, …) regardless of which of the two ways a session started.
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

  return <AuthContext.Provider value={{ user, loading, login, verifyOtp, logout }}>{children}</AuthContext.Provider>;
}
