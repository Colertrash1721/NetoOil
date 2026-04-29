import axios from 'axios';

const DEFAULT_API_URL = 'http://127.0.0.1:8000/api';

function normalizeBackendUrl(value?: string) {
  const currentHostApiUrl =
    typeof window !== 'undefined' && window.location.hostname
      ? `http://${window.location.hostname}:8000/api`
      : DEFAULT_API_URL;

  if (!value) {
    return currentHostApiUrl;
  }

  const normalizedValue = value.trim().replace(/\/$/, '');

  if (/^http:\/\/(0\.0\.0\.0|127\.0\.0\.1|localhost)(?::\d+)?\/api$/.test(normalizedValue)) {
    return currentHostApiUrl;
  }

  return normalizedValue;
}

export const apiClient = axios.create({
  baseURL: normalizeBackendUrl(process.env.NEXT_PUBLIC_MY_BACKEND_API),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  if (typeof window === 'undefined') {
    return config;
  }

  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export function getApiErrorMessage(error: unknown, fallback = 'No se pudo completar la solicitud.') {
  if (!axios.isAxiosError(error)) {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return fallback;
  }

  const payload = error.response?.data;

  if (typeof payload?.message === 'string' && payload.message.trim()) {
    return payload.message;
  }

  if (typeof payload?.detail === 'string' && payload.detail.trim()) {
    return payload.detail;
  }

  if (Array.isArray(payload?.detail) && payload.detail.length > 0) {
    const firstIssue = payload.detail[0];
    if (typeof firstIssue?.msg === 'string' && firstIssue.msg.trim()) {
      return firstIssue.msg;
    }
  }

  return fallback;
}

export function getRealtimeWebSocketUrl(token?: string | null) {
  const baseUrl = normalizeBackendUrl(process.env.NEXT_PUBLIC_MY_BACKEND_API)
    .replace(/^http/, 'ws')
    .replace(/\/api$/, '');
  const query = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${baseUrl}/api/ws/realtime${query}`;
}
