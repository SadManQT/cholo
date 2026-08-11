import { apiClient, setAccessToken } from './client';
import type { ApiSuccess } from '../types/api.types';
import type { Gender, Role } from '../types/user.types';

// server/src/services/auth.service.js's toPublicUser() — deliberately
// lighter than the full User (types/user.types.ts): login/verifyOtp only
// need enough to mint a session, AuthContext fetches the full profile via
// meApi.getMe() right after.
interface SessionUser {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  roles: Role[];
}

export async function login(phone: string, password: string): Promise<SessionUser> {
  const { data } = await apiClient.post<ApiSuccess<{ accessToken: string; user: SessionUser }>>(
    '/auth/login',
    { phone, password },
  );
  // api/ owns tokens (doc 11 §9) — the caller only ever sees `user`.
  setAccessToken(data.data.accessToken);
  return data.data.user;
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
}

// doc 08-09-10 §4: 201 + {userId} — no session yet, the phone still has to
// be verified. Nothing to store in api/client.ts's token here.
export async function register(input: RegisterInput): Promise<{ userId: string }> {
  const { data } = await apiClient.post<ApiSuccess<{ userId: string }>>('/auth/register', input);
  return data.data;
}

// server/src/validators/auth.schema.js's verifyOtpSchema: purpose is
// currently literal 'signup' — the only purpose this endpoint accepts.
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
