import axios from 'axios';

const DEFAULT_API_URL = 'http://127.0.0.1:8000/api';

function normalizeBackendUrl(value?: string) {
  if (!value) {
    return DEFAULT_API_URL;
  }

  return value
    .trim()
    .replace(/^http:\/\/0\.0\.0\.0/, 'http://127.0.0.1')
    .replace(/\/$/, '');
}

export const apiClient = axios.create({
  baseURL: normalizeBackendUrl(process.env.NEXT_PUBLIC_MY_BACKEND_API),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
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
