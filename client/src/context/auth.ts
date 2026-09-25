import { createContext, useContext } from 'react';
import type { User } from '../types/user.types';

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** Resolves to the user, or to a challenge when an admin must enter an authenticator code. */
  login: (phone: string, password: string) => Promise<User | { challengeToken: string }>;
  completeTwoFactor: (challengeToken: string, code: string) => Promise<User>;
  verifyOtp: (phone: string, otp: string) => Promise<User>;
  refreshUser: () => Promise<User>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within an AuthProvider');
  return value;
}
