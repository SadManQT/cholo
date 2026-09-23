import { env } from '../config/env.js';
import * as authService from '../services/auth.service.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

function deviceFromRequest(request) {
  return {
    deviceType: 'web',
    deviceName: null,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent']?.slice(0, 255) ?? null,
  };
}

// In production the client (Vercel) and API (Render) are different sites, so a strict cookie would never
// reach /auth/refresh and every reload would sign the user out. None requires Secure, which production sets.
const COOKIE_SAME_SITE = env.NODE_ENV === 'production' ? 'none' : 'strict';

function setRefreshCookie(response, refreshToken) {
  response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: COOKIE_SAME_SITE,
    path: REFRESH_COOKIE_PATH,
    maxAge: env.REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(response) {
  response.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: COOKIE_SAME_SITE,
    path: REFRESH_COOKIE_PATH,
  });
}

export const register = asyncHandler(async (request, response) => {
  const data = await authService.register(request.body);
  response.status(201).json({ success: true, data });
});

export const verifyOtp = asyncHandler(async (request, response) => {
  const { accessToken, refreshToken, user } = await authService.verifyOtp(
    request.body,
    deviceFromRequest(request),
  );

  setRefreshCookie(response, refreshToken);
  response.json({ success: true, data: { accessToken, user } });
});

export const resendOtp = asyncHandler(async (request, response) => {
  await authService.resendOtp(request.body);
  response.status(204).end();
});

export const login = asyncHandler(async (request, response) => {
  const { accessToken, refreshToken, user } = await authService.login(
    request.body,
    deviceFromRequest(request),
  );

  setRefreshCookie(response, refreshToken);
  response.json({ success: true, data: { accessToken, user } });
});

export const refresh = asyncHandler(async (request, response) => {
  const rawRefreshToken = request.cookies?.[REFRESH_COOKIE_NAME];

  if (!rawRefreshToken) {
    throw new AppError(401, 'REFRESH_INVALID');
  }

  const { accessToken, refreshToken } = await authService.refresh(rawRefreshToken);

  setRefreshCookie(response, refreshToken);
  response.json({ success: true, data: { accessToken } });
});

export const logout = asyncHandler(async (request, response) => {
  await authService.logout(request.user.sessionId);
  clearRefreshCookie(response);
  response.status(204).end();
});

export const logoutAll = asyncHandler(async (request, response) => {
  await authService.logoutAll(request.user.id);
  clearRefreshCookie(response);
  response.status(204).end();
});

export const forgotPassword = asyncHandler(async (request, response) => {
  await authService.requestPasswordReset(request.body);
  response.status(204).end();
});

export const verifyResetCode = asyncHandler(async (request, response) => {
  response.json({ success: true, data: await authService.verifyPasswordResetCode(request.body) });
});

export const resetPassword = asyncHandler(async (request, response) => {
  await authService.resetPassword(request.body);
  response.status(204).end();
});
