import axios from 'axios';

export function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';
    if (isLocalhost) {
      return 'http://localhost:3001';
    }
    // In production Vercel deployment: ALWAYS use same-origin relative /api route.
    // Same-Origin requests eliminate browser CORS checks completely!
    return '/api';
  }

  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
}

export const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  config.baseURL = getApiUrl();
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});
