import { createContext, useContext } from 'react';
import type { User } from '../types/user.types';

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<User>;
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
