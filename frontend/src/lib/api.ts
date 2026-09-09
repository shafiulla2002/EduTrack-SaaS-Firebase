import axios from 'axios';

// In production (Vercel): use the Next.js API proxy route /api/* which forwards to the backend.
// In local dev: use NEXT_PUBLIC_API_URL env var, or fall back to localhost:3001 directly.
const isServer = typeof window === 'undefined';
const isProd = process.env.NODE_ENV === 'production';
const DEFAULT_PROD_API = 'https://api.edutrackapplication.covenantsynergy.in';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL
  : isProd
    ? DEFAULT_PROD_API
    : isServer
      ? (process.env.BACKEND_INTERNAL_URL || 'http://localhost:3001')
      : 'http://localhost:3001';

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

let memoizedToken: { role: string; token: string | null } | null = null;
let memoizedTenantId: { role: string; tenantId: string | null } | null = null;

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  const role = getActiveRole();
  if (memoizedToken && memoizedToken.role === role) {
    return memoizedToken.token;
  }
  let token: string | null = null;
  if (role === 'PARENT') token = localStorage.getItem('parent_token');
  else if (role === 'TEACHER' || role === 'DRIVER') token = localStorage.getItem('teacher_token');
  else token = localStorage.getItem('admin_token');
  memoizedToken = { role, token };
  return token;
}

export function getStoredTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  const role = getActiveRole();
  if (memoizedTenantId && memoizedTenantId.role === role) {
    return memoizedTenantId.tenantId;
  }
  let tid = role === 'PARENT' ? localStorage.getItem('parent_tenantId') :
            (role === 'TEACHER' || role === 'DRIVER') ? localStorage.getItem('teacher_tenantId') :
            localStorage.getItem('admin_tenantId');
  if (!tid) {
    // Convenience fallback: extract tenantId from the user's stored token
    const token = getStoredToken();
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          if (payload.tenantId && typeof payload.tenantId === 'string') {
            const extractedTenantId: string = payload.tenantId;
            tid = extractedTenantId;
            // Save to localStorage to avoid repeating JWT decode
            if (role === 'PARENT') localStorage.setItem('parent_tenantId', extractedTenantId);
            else if (role === 'TEACHER' || role === 'DRIVER') localStorage.setItem('teacher_tenantId', extractedTenantId);
            else localStorage.setItem('admin_tenantId', extractedTenantId);
          }
        }
      } catch {}
    }
  }
  memoizedTenantId = { role, tenantId: tid || null };
  return tid || null;
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
  memoizedToken = null;
  memoizedTenantId = null;
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
  
  if (
    hostname === 'edutrackapplication.covenantsynergy.in' ||
    hostname === 'api.edutrackapplication.covenantsynergy.in' ||
    hostname === 'edutrack.covenantsynergy.in'
  ) {
    return '';
  } else if (hostname.endsWith('.edutrackapplication.covenantsynergy.in') || hostname.endsWith('.edutrack.covenantsynergy.in')) {
    const parts = hostname.replace('.edutrackapplication.covenantsynergy.in', '').replace('.edutrack.covenantsynergy.in', '').split('.');
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

// ── In-Flight Request Deduplication & Tenant-Scoped SWR Cache ─────────────
const inFlightRequests = new Map<string, Promise<any>>();
const lookupCache = new Map<string, { data: any; expiresAt: number; cachedAt: number }>();

export function invalidateLookupCache(tenantId?: string, urlPrefix?: string) {
  const tid = tenantId || getTenantFromHostname() || getStoredTenantId() || '';
  if (urlPrefix) {
    lookupCache.forEach((_, key) => {
      if ((!tid || key.startsWith(`${tid}:`)) && key.includes(urlPrefix)) {
        lookupCache.delete(key);
      }
    });
  } else if (tid) {
    lookupCache.forEach((_, key) => {
      if (key.startsWith(`${tid}:`)) {
        lookupCache.delete(key);
      }
    });
  } else {
    lookupCache.clear();
  }
}

export function invalidateCachePrefix(prefix: string) {
  const tid = getTenantFromHostname() || getStoredTenantId() || '';
  invalidateLookupCache(tid, prefix);
}

// Interceptor to handle responses, 401s, and targeted auto-invalidation on mutations
api.interceptors.response.use(
  (response) => {
    // Automatically purge targeted cached data on state-mutating requests (POST, PUT, PATCH, DELETE)
    const method = response.config.method?.toUpperCase();
    if (method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const url = response.config.url || '';
      const tid = getTenantFromHostname() || getStoredTenantId() || '';
      
      // Determine affected cache domain
      if (url.includes('/students') || url.includes('/admissions') || url.includes('/promotions')) {
        invalidateLookupCache(tid, '/students');
        invalidateLookupCache(tid, '/dashboard/summary');
      } else if (url.includes('/billing') || url.includes('/invoices') || url.includes('/payments')) {
        invalidateLookupCache(tid, '/billing');
        invalidateLookupCache(tid, '/dashboard/summary');
      } else if (url.includes('/teachers') || url.includes('/staff') || url.includes('/timetable')) {
        invalidateLookupCache(tid, '/teachers');
        invalidateLookupCache(tid, '/timetable');
        invalidateLookupCache(tid, '/dashboard/summary');
      } else if (url.includes('/attendance')) {
        invalidateLookupCache(tid, '/attendance');
        invalidateLookupCache(tid, '/dashboard/summary');
      } else if (url.includes('/expenses')) {
        invalidateLookupCache(tid, '/expenses');
        invalidateLookupCache(tid, '/dashboard/summary');
      } else if (url.includes('/exams') || url.includes('/exam-config') || url.includes('/grades')) {
        invalidateLookupCache(tid, '/exams');
        invalidateLookupCache(tid, '/grades');
        invalidateLookupCache(tid, '/dashboard/summary');
      } else if (url.includes('/leave')) {
        invalidateLookupCache(tid, '/leave');
        invalidateLookupCache(tid, '/dashboard/summary');
      } else if (url.includes('/announcements')) {
        invalidateLookupCache(tid, '/announcements');
      } else {
        // Fallback: purge module cache while preserving static metadata
        invalidateLookupCache(tid, url);
        invalidateLookupCache(tid, '/dashboard/summary');
      }
    }
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
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

// Invalidate on school setup update events
if (typeof window !== 'undefined') {
  window.addEventListener('schoolSetupUpdated', () => {
    const tid = getTenantFromHostname() || getStoredTenantId() || '';
    invalidateLookupCache(tid, '/dashboard/summary');
    invalidateLookupCache(tid, '/tenant/setup-status');
  });
}

export interface FastGetOptions<T = any> {
  ttlMs?: number;
  onRevalidate?: (freshData: T) => void;
  forceRefresh?: boolean;
}

/**
 * Fast SWR (Stale-While-Revalidate) GET request engine:
 * 1. If cached data exists in memory, returns immediately in 0ms without UI delay.
 * 2. Concurrently in the background, fetches fresh data from the server.
 * 3. Calls `onRevalidate` with fresh data if changes are detected, keeping UI 100% accurate.
 */
export async function fastGet<T = any>(
  url: string,
  config?: any,
  options: FastGetOptions<T> = {}
): Promise<{ data: T; isFromCache: boolean }> {
  const { ttlMs = 60000, onRevalidate, forceRefresh = false } = options;
  const tenantId = getTenantFromHostname() || getStoredTenantId() || 'global';
  const paramStr = config?.params ? JSON.stringify(config.params) : '';
  const cacheKey = `${tenantId}:${url}:${paramStr}`;

  const cached = lookupCache.get(cacheKey);
  const now = Date.now();

  // Background fetch helper with deduplication
  const fetchFresh = (): Promise<{ data: T }> => {
    const flightKey = `${tenantId}:flight:${url}:${paramStr}`;
    if (inFlightRequests.has(flightKey)) {
      return inFlightRequests.get(flightKey)!;
    }

    const promise = api.get<T>(url, config)
      .then((res) => {
        const freshData = res.data;
        lookupCache.set(cacheKey, {
          data: freshData,
          expiresAt: Date.now() + ttlMs,
          cachedAt: Date.now(),
        });

        if (onRevalidate && cached) {
          try {
            if (JSON.stringify(freshData) !== JSON.stringify(cached.data)) {
              onRevalidate(freshData);
            }
          } catch {
            onRevalidate(freshData);
          }
        }
        return res;
      })
      .finally(() => {
        inFlightRequests.delete(flightKey);
      });

    inFlightRequests.set(flightKey, promise);
    return promise;
  };

  // If valid cache exists and not forced refresh, return cached data immediately and revalidate in background
  if (!forceRefresh && cached && cached.expiresAt > now) {
    // Non-blocking background revalidation if data is older than 5 seconds
    if (now - cached.cachedAt > 5000) {
      fetchFresh().catch(() => {});
    }
    return { data: cached.data, isFromCache: true };
  }

  // If stale cache exists, return it immediately while fetching fresh data
  if (!forceRefresh && cached) {
    fetchFresh().catch(() => {});
    return { data: cached.data, isFromCache: true };
  }

  // Cold cache: await network request
  const freshRes = await fetchFresh();
  return { data: freshRes.data, isFromCache: false };
}

/**
 * Legacy cachedGet for backward compatibility.
 */
export async function cachedGet<T = any>(
  url: string,
  config?: any,
  ttlMs = 60000
): Promise<{ data: T }> {
  const result = await fastGet<T>(url, config, { ttlMs });
  return { data: result.data };
}

export const swrGet = fastGet;
