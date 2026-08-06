import axios from 'axios';

export const DEFAULT_PRODUCTION_API_URL = 'https://edutrack.covenantsynergy.in/api';

export function getApiUrl(): string {
  // If explicitly configured and valid (not fly.dev placeholder)
  if (
    process.env.NEXT_PUBLIC_API_URL &&
    !process.env.NEXT_PUBLIC_API_URL.includes('edutrack-saas-backend.fly.dev')
  ) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (typeof window !== 'undefined') {
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';
    if (isLocalhost) {
      return 'http://localhost:3001';
    }
    // In production Vercel deployment: use live backend API https://edutrack.covenantsynergy.in/api
    return DEFAULT_PRODUCTION_API_URL;
  }

  return 'http://localhost:3001';
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
