import { apiClient, setAccessToken } from './client';
import type { ApiSuccess } from '../types/api.types';
import type { Gender, Role } from '../types/user.types';

interface SessionUser {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  roles: Role[];
}

type LoginResult =
  | { accessToken: string; user: SessionUser; twoFactorRequired?: undefined }
  | { twoFactorRequired: true; challengeToken: string };

/** Returns a challenge token when the account needs an authenticator code, otherwise signs in. */
export async function login(phone: string, password: string): Promise<{ challengeToken: string } | null> {
  const { data } = await apiClient.post<ApiSuccess<LoginResult>>('/auth/login', { phone, password });
  if (data.data.twoFactorRequired) return { challengeToken: data.data.challengeToken };
  setAccessToken(data.data.accessToken);
  return null;
}

export async function loginTwoFactor(challengeToken: string, code: string): Promise<void> {
  const { data } = await apiClient.post<ApiSuccess<{ accessToken: string }>>('/auth/login/2fa', { challengeToken, code });
  setAccessToken(data.data.accessToken);
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
  setAccessToken(null);
}

interface RegisterInput {
  fullName: string;
  phone: string;
  password: string;
  gender?: Gender;
  referralCode?: string;
}

export async function register(input: RegisterInput): Promise<{ userId: string }> {
  const { data } = await apiClient.post<ApiSuccess<{ userId: string }>>('/auth/register', input);
  return data.data;
}

export async function verifyOtp(phone: string, otp: string): Promise<SessionUser> {
  const { data } = await apiClient.post<ApiSuccess<{ accessToken: string; user: SessionUser }>>(
    '/auth/verify-otp',
    { phone, otp, purpose: 'signup' },
  );
  setAccessToken(data.data.accessToken);
  return data.data.user;
}

export async function resendOtp(phone: string): Promise<void> {
  await apiClient.post('/auth/resend-otp', { phone, purpose: 'signup' });
}

export async function requestPasswordReset(phone: string): Promise<void> {
  await apiClient.post('/auth/forgot-password', { phone });
}

export async function verifyPasswordResetCode(phone: string, otp: string): Promise<string> {
  const { data } = await apiClient.post<ApiSuccess<{ resetToken: string }>>('/auth/forgot-password/verify', { phone, otp });
  return data.data.resetToken;
}

export async function resetPassword(resetToken: string, newPassword: string, confirmPassword: string): Promise<void> {
  await apiClient.post('/auth/reset-password', { resetToken, newPassword, confirmPassword });
}
