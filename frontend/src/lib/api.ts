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
  let tid = role === 'PARENT' ? localStorage.getItem('parent_tenantId') :
            (role === 'TEACHER' || role === 'DRIVER') ? localStorage.getItem('teacher_tenantId') :
            localStorage.getItem('admin_tenantId');
  if (tid) return tid;

  // Convenience fallback: extract tenantId from the user's stored token
  const token = getStoredToken();
  if (token) {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.tenantId) {
          return payload.tenantId;
        }
      }
    } catch {}
  }
  return null;
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

const PLATFORM_HOSTS = new Set([
  'www',
  'api',
  'app',
  'localhost',
  'edutrack-frontend-live',
  'edutrack-frontend',
  'edutrack-platform',
  'edu-track-saa-s-orcin',
  'edutrack-saas',
  'edutrack-saas-independent',
]);

export function getTenantFromHostname(): string {
  if (typeof window === 'undefined') return '';

  // Prefer stored tenant ID (from successful login) over hostname detection
  const stored = getStoredTenantId();
  if (stored) return stored;

  const hostname = window.location.hostname;
  
  if (hostname === 'edutrack.covenantsynergy.in' || hostname === 'api-edutrack.covenantsynergy.in') {
    return '';
  } else if (hostname.endsWith('.edutrack.covenantsynergy.in')) {
    const parts = hostname.replace('.edutrack.covenantsynergy.in', '').split('.');
    const sub = parts[parts.length - 1];
    if (!PLATFORM_HOSTS.has(sub)) {
      return sub;
    }
  } else if (hostname === 'edutrack.com' || hostname === 'www.edutrack.com' || hostname === 'app.edutrack.com') {
    return '';
  } else if (hostname.endsWith('.edutrack.com')) {
    const parts = hostname.replace('.edutrack.com', '').split('.');
    const sub = parts[parts.length - 1];
    if (!PLATFORM_HOSTS.has(sub)) {
      return sub;
    }
  } else if (hostname.endsWith('.vercel.app')) {
    const parts = hostname.replace('.vercel.app', '').split('.');
    if (parts.length > 1 && !PLATFORM_HOSTS.has(parts[0])) {
      return parts[0];
    }
  } else {
    const parts = hostname.split('.');
    if (parts.length > 1 && !PLATFORM_HOSTS.has(parts[0]) && isNaN(Number(parts[0]))) {
      return parts[0];
    }
  }

  return '';
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
      // Inject resolved tenant ID if present
      const tenantId = getTenantFromHostname();
      if (tenantId) {
        config.headers['X-Tenant-ID'] = tenantId;
      }
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

// ── In-Flight Request Deduplication & Tenant-Scoped Lookup Cache ─────────────
const inFlightRequests = new Map<string, Promise<any>>();
const lookupCache = new Map<string, { data: any; expiresAt: number }>();

export function invalidateLookupCache(tenantId?: string) {
  if (tenantId) {
    lookupCache.forEach((_, key) => {
      if (key.startsWith(`${tenantId}:`)) {
        lookupCache.delete(key);
      }
    });
  } else {
    lookupCache.clear();
  }
}

/**
 * Perform a GET request with in-flight deduplication and tenant-scoped caching for static lookup data.
 */
export async function cachedGet<T = any>(
  url: string,
  config?: any,
  ttlMs = 0
): Promise<{ data: T }> {
  const tenantId = getTenantFromHostname() || getStoredTenantId() || 'global';
  const paramStr = config?.params ? JSON.stringify(config.params) : '';
  const cacheKey = `${tenantId}:${url}:${paramStr}`;

  if (ttlMs > 0) {
    const cached = lookupCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { data: cached.data };
    }
  }

  // Deduplicate simultaneous in-flight requests
  const flightKey = `${tenantId}:flight:${url}:${paramStr}`;
  if (inFlightRequests.has(flightKey)) {
    return inFlightRequests.get(flightKey)!;
  }

  const promise = api.get<T>(url, config)
    .then((res) => {
      if (ttlMs > 0) {
        lookupCache.set(cacheKey, {
          data: res.data,
          expiresAt: Date.now() + ttlMs,
        });
      }
      return res;
    })
    .finally(() => {
      inFlightRequests.delete(flightKey);
    });

  inFlightRequests.set(flightKey, promise);
  return promise;
}
