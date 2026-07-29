import axios from 'axios';

// In production (Vercel): use the Next.js API proxy route /api/* which forwards to the backend.
// In local dev: use NEXT_PUBLIC_API_URL env var, or fall back to localhost:3001 directly.
const isServer = typeof window === 'undefined';
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL   // Explicitly configured backend URL (e.g. separate Vercel backend)
  : isServer
    ? 'http://localhost:3001'          // Server-side rendering in dev: direct backend call
    : '/api';                          // Client-side on Vercel: use Next.js proxy route

export function getActiveRole(): 'TEACHER' | 'SCHOOL_ADMIN' | 'PARENT' | 'DRIVER' {
  if (typeof window === 'undefined') return 'SCHOOL_ADMIN';
  
  let role = sessionStorage.getItem('active_role') as 'TEACHER' | 'SCHOOL_ADMIN' | 'PARENT' | 'DRIVER' | null;
  if (!role) {
    if (localStorage.getItem('parent_token')) {
      role = 'PARENT';
    } else if (localStorage.getItem('teacher_token') && !localStorage.getItem('admin_token')) {
      role = 'TEACHER';
    } else {
      role = 'SCHOOL_ADMIN';
    }
    sessionStorage.setItem('active_role', role);
  }
  return role;
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  const role = getActiveRole();
  if (role === 'PARENT') return localStorage.getItem('parent_token');
  if (role === 'TEACHER' || role === 'DRIVER') return localStorage.getItem('teacher_token');
  return localStorage.getItem('admin_token');
}

export function getStoredTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  const role = getActiveRole();
  if (role === 'PARENT') return localStorage.getItem('parent_tenantId');
  if (role === 'TEACHER' || role === 'DRIVER') return localStorage.getItem('teacher_tenantId');
  return localStorage.getItem('admin_tenantId');
}

export function getStoredUserPhone(): string | null {
  if (typeof window === 'undefined') return null;
  const role = getActiveRole();
  if (role === 'PARENT') return localStorage.getItem('parent_userPhone');
  if (role === 'TEACHER' || role === 'DRIVER') return localStorage.getItem('teacher_userPhone');
  return localStorage.getItem('admin_userPhone');
}

export function clearStoredAuth() {
  if (typeof window === 'undefined') return;
  const role = getActiveRole();
  if (role === 'PARENT') {
    localStorage.removeItem('parent_token');
    localStorage.removeItem('parent_tenantId');
    localStorage.removeItem('parent_userPhone');
  } else if (role === 'TEACHER' || role === 'DRIVER') {
    localStorage.removeItem('teacher_token');
    localStorage.removeItem('teacher_tenantId');
    localStorage.removeItem('teacher_userPhone');
  } else {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_tenantId');
    localStorage.removeItem('admin_userPhone');
  }
  sessionStorage.removeItem('active_role');
}

export function getTenantFromHostname(): string {
  if (typeof window === 'undefined') return 'demo-school';

  // Prefer stored tenant ID (from successful login) over hostname detection
  const stored = getStoredTenantId();
  if (stored) return stored;

  const hostname = window.location.hostname;
  const hostParts = hostname.split('.');

  const isVercelApp = hostname.includes('vercel.app');
  const isEdutrackDomain = hostname.includes('edutrack.com');
  const isCovenTrackDomain = hostname.includes('edutrack.covenantsynergy.in');

  if (isCovenTrackDomain) {
    if (hostParts.length > 3 && hostParts[0] !== 'www' && hostParts[0] !== 'api') {
      return hostParts[0];
    }
  } else if (isEdutrackDomain) {
    if (hostParts.length > 2 && hostParts[0] !== 'www' && hostParts[0] !== 'app') {
      return hostParts[0];
    }
  } else if (isVercelApp) {
    // Standard Vercel deployment URL (e.g. project-name.vercel.app) has 3 parts.
    // Explicit tenant subdomain (e.g. school1.project-name.vercel.app) has 4 parts.
    if (hostParts.length > 3 && hostParts[0] !== 'www') {
      return hostParts[0];
    }
  } else {
    // Local development (e.g. school1.localhost)
    if (hostParts.length > 1 && hostParts[0] !== 'localhost' && hostParts[0] !== 'www' && isNaN(Number(hostParts[0]))) {
      return hostParts[0];
    }
  }

  return 'demo-school';
}

export const api = axios.create({
  baseURL: BACKEND_URL,
  headers: {
    'Content-Type': 'application/json',
    // X‑Tenant‑ID will be injected dynamically by the request interceptor.
  },
});

// Interceptor to inject JWT Token and correct Tenant ID
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = getStoredToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      // Inject resolved tenant ID
      config.headers['X-Tenant-ID'] = getTenantFromHostname();
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor to handle 401 and redirect to login
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        // Prevent redirect loop if already on auth pages or onboarding
        const path = window.location.pathname;
        if (!path.includes('/auth/login') && !path.includes('/auth/otp') && !path.includes('/auth/callback') && !path.includes('/register-school')) {
          clearStoredAuth();
          window.location.href = '/auth/login';
        }
      }
    }
    return Promise.reject(error);
  }
);
export const updateStudent = (id: string, data: Partial<any>) => api.patch(`/students/${id}`, data);
