import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { env } from '../config/env';
import type { ApiSuccess } from '../types/api.types';

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler;
}

export const apiClient = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

const SKIP_REFRESH_PATHS = ['/auth/login', '/auth/register', '/auth/verify-otp', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password'];

function shouldAttemptRefresh(url: string | undefined) {
  return url !== undefined && !SKIP_REFRESH_PATHS.some((path) => url.includes(path));
}

let refreshPromise: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
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
