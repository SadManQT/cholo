import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { env } from '../config/env';
import type { ApiSuccess } from '../types/api.types';

// doc 08-09-10 §10 threat table: "Stolen access token — 15-min expiry, the
// blast radius is the design" / "XSS stealing tokens — nothing readable in
// JS-accessible storage; refresh is httpOnly; access lives in memory." A
// plain module-level variable IS "in memory" — no localStorage, no
// sessionStorage. Only this file ever touches it; doc 11 §9's rule is "a
// page never sees a token."
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

// Fired when a session is conclusively over (refresh itself failed) so
// AuthContext can clear its user state — kept as a plain callback rather
// than a third React Context (doc 11 §11: "Cholo needs exactly these two").
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler;
}

// doc 05-06-07 §4.1: "api/ | one HTTP doorway → tokens, errors, retries
// handled once | axios instance, typed endpoint functions | Never:
// components calling axios directly — the cardinal sin."
export const apiClient = axios.create({
  baseURL: env.apiUrl,
  // The refresh cookie is httpOnly + scoped to /api/v1/auth (server's
  // auth.controller.js) and the API runs on a different origin/port than
  // the client in dev — withCredentials is what lets it travel at all,
  // matching the server's own `cors({ credentials: true })` (config/cors.js).
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Endpoints where a 401 means something OTHER than "your access token
// expired" — refreshing and retrying would be semantically wrong (bad
// credentials aren't fixed by a new access token) or, for /auth/refresh
// itself, an infinite loop.
const SKIP_REFRESH_PATHS = ['/auth/login', '/auth/register', '/auth/verify-otp', '/auth/refresh'];

function shouldAttemptRefresh(url: string | undefined) {
  return url !== undefined && !SKIP_REFRESH_PATHS.some((path) => url.includes(path));
}

// doc 08-09-10 §7: refresh ROTATES — the old token is revoked the instant a
// new one is issued, and a SECOND use of that same old token is treated as
// theft (REFRESH_REUSED kills the whole session). If three components each
// fire a request the moment the access token expires, three concurrent 401s
// must NOT each call /auth/refresh — the second one would present an
// already-rotated cookie and trip the reuse guard. Every 401 that arrives
// while a refresh is already in flight awaits this SAME promise instead.
let refreshPromise: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = apiClient
      .post<ApiSuccess<{ accessToken: string }>>('/auth/refresh')
      .then((response) => {
        const newToken = response.data.data.accessToken;
        setAccessToken(newToken);
        return newToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryableConfig | undefined;

    const isUnauthorized = error.response?.status === 401;
    const alreadyRetried = config?._retry === true;
    const eligible = isUnauthorized && config && !alreadyRetried && shouldAttemptRefresh(config.url);

    if (!eligible) {
      // The refresh call itself came back 401 (REFRESH_INVALID/REFRESH_REUSED)
      // — there is no session left to recover. doc 08-09-10 §7: reuse
      // detection means this can also fire for a legitimate user whose
      // token was replayed; either way, the only correct move is to sign
      // out client-side and let them log in again.
      if (isUnauthorized && config?.url?.includes('/auth/refresh')) {
        setAccessToken(null);
        unauthorizedHandler?.();
      }
      return Promise.reject(error);
    }

    config._retry = true;

    try {
      const newAccessToken = await refreshAccessToken();
      config.headers.Authorization = `Bearer ${newAccessToken}`;
      return apiClient(config);
    } catch (refreshError) {
      setAccessToken(null);
      unauthorizedHandler?.();
      return Promise.reject(refreshError);
    }
  },
);
