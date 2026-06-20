// src/lib/axios.ts
import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '@/store/authStore';
import type { RefreshResponse } from '@/types/api';

/** Single configured instance used by every feature `api.ts`. */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true, // sends the httpOnly refresh-token cookie
});

// Request interceptor: attach the access token from the auth store.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

// Response interceptor: transparent access-token refresh on a single 401.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    if (error.response?.status === 401 && config && !config._retried) {
      config._retried = true;
      try {
        const { data } = await api.post<RefreshResponse>('/auth/refresh');
        useAuthStore.getState().setToken(data.accessToken);
        config.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(config);
      } catch (refreshError) {
        useAuthStore.getState().clear();
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  },
);
