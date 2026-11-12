/**
 * Axios API Client — Phase 0 Production Grade
 *
 * Features:
 * - Injects Bearer access token on every request
 * - On 401: automatically attempts refresh token rotation
 * - On refresh success: retries the original failed request seamlessly
 * - On refresh failure: clears all auth state and redirects to login
 * - Queues concurrent requests during refresh to prevent multiple refresh calls
 */
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  // NOTE: Do NOT set a global Content-Type here.
  // Axios auto-sets 'application/json' for plain objects and
  // 'multipart/form-data' (with correct boundary) for FormData.
});

// ── Token refresh state ────────────────────────────────────────────────────
let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processRefreshQueue(error: unknown, token: string | null = null) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  refreshQueue = [];
}

function clearAuthState() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  // Dispatch a custom event so Redux store can react without a direct dependency
  window.dispatchEvent(new Event('auth:logout'));
  window.location.href = '/login';
}

// ── Request interceptor: inject access token ───────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor: handle 401 with refresh ─────────────────────────
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest: AxiosRequestConfig & { _retry?: boolean } = error.config;

    // Only attempt refresh on 401 from a non-auth endpoint and not already retried
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');

      if (!refreshToken) {
        clearAuthState();
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token: newRefreshToken } = response.data;

        // Store new tokens
        localStorage.setItem('token', access_token);
        if (newRefreshToken) {
          localStorage.setItem('refreshToken', newRefreshToken);
        }

        processRefreshQueue(null, access_token);

        // Retry the original request with the new access token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        processRefreshQueue(refreshError, null);
        clearAuthState();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // 403 = account inactive or insufficient permissions — don't auto-redirect for permission errors
    if (error.response?.status === 403) {
      const detail = error.response?.data?.detail || '';
      // Only redirect if it's an account-inactive error, not a permission error
      if (detail.includes('inactive')) {
        clearAuthState();
      }
    }

    return Promise.reject(error);
  },
);

export default api;
