'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { api, fastGet, getStoredToken, getStoredTenantId, getActiveRole } from '@/lib/api';
import { useSchoolSetupUpdate } from '@/lib/events';

interface TenantContextType {
  schoolName: string;
  schoolType: string;
  adminName: string;
  logoUrl: string | null;
  loading: boolean;
  setupStats: any;
  currentUser: any;
  subscription: {
    plan: string;
    status: string;
    expiryDate: string;
    features: string[];
  } | null;
  isSubscriptionActive: boolean;
  showLockPopup: boolean;
  setShowLockPopup: (show: boolean) => void;
  refresh: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

function getInitialTenantCache() {
  if (typeof window === 'undefined') return null;
  try {
    const tid = getStoredTenantId();
    if (tid) {
      const raw = sessionStorage.getItem(`edutrack_swr:${tid}:/tenant/setup-status:`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.data && parsed.tenantId === tid) {
          return parsed.data;
        }
      }
      const rawLocal = localStorage.getItem(`edutrack_tenant_cache_${tid}`);
      if (rawLocal) {
        return JSON.parse(rawLocal);
      }
    }
  } catch {}
  return null;
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [initialData] = useState(() => getInitialTenantCache());

  const [schoolName, setSchoolName] = useState<string>(() => {
    return initialData?.setup?.schoolName || 
           initialData?.tenantName || 
           initialData?.tenant?.schoolName || 
           (typeof window !== 'undefined' ? (sessionStorage.getItem('otp_schoolName') || localStorage.getItem('stored_school_name') || '') : '');
  });

  const [schoolType, setSchoolType] = useState<string>(() => {
    return initialData?.setup?.schoolType || 
           initialData?.tenant?.schoolType || 
           (typeof window !== 'undefined' ? (localStorage.getItem('stored_school_type') || 'School') : 'School');
  });

  const [adminName, setAdminName] = useState<string>(() => {
    return initialData?.setup?.adminName || 
           initialData?.currentUser?.name || 
           (typeof window !== 'undefined' ? (
             localStorage.getItem('admin_userName') || 
             localStorage.getItem('teacher_userName') || 
             localStorage.getItem('parent_userName') || ''
           ) : '');
  });

  const [logoUrl, setLogoUrl] = useState<string | null>(() => {
    return initialData?.setup?.schoolLogo || 
           initialData?.tenantLogo || 
           (typeof window !== 'undefined' ? (sessionStorage.getItem('otp_logoUrl') || localStorage.getItem('stored_school_logo') || null) : null);
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [setupStats, setSetupStats] = useState<any>(() => initialData || null);
  const [currentUser, setCurrentUser] = useState<any>(() => {
    if (initialData?.currentUser) return initialData.currentUser;
    if (typeof window !== 'undefined') {
      const rawUser = localStorage.getItem('stored_current_user');
      if (rawUser) {
        try { return JSON.parse(rawUser); } catch {}
      }
    }
    return null;
  });
  const [subscription, setSubscription] = useState<any>(() => initialData?.subscription || null);
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return getStoredToken();
    }
    return null;
  });
  const pathname = usePathname();
  const [showLockPopup, setShowLockPopup] = useState(false);

  const isSubscriptionActive = !token || loading || !subscription || (
    subscription.status === 'ACTIVE' &&
    new Date(subscription.expiryDate).getTime() >= Date.now()
  );

  // Register Axios response interceptor to handle 402/403 subscription expired status codes globally
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && (error.response.status === 402 || error.response.status === 403) && error.response.data?.code === 'SUBSCRIPTION_EXPIRED') {
          console.warn('Axios Interceptor: SUBSCRIPTION_EXPIRED detected.');
          setShowLockPopup(true);
        }
        return Promise.reject(error);
      }
    );
    return () => {
      api.interceptors.response.eject(interceptor);
    };
  }, []);

  const applyTenantData = (data: any) => {
    if (!data) return;
    setSetupStats(data);
    
    if (data.currentUser) {
      setCurrentUser(data.currentUser);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('stored_current_user', JSON.stringify(data.currentUser));
        } catch {}
      }
    }
    
    setSubscription(data.subscription || null);
    
    if (typeof window !== 'undefined' && data.currentUser?.role) {
      if (data.currentUser.role === 'TEACHER') {
        sessionStorage.setItem('active_role', 'TEACHER');
        if (data.currentUser.name) localStorage.setItem('teacher_userName', data.currentUser.name);
      } else if (data.currentUser.role === 'SCHOOL_ADMIN') {
        sessionStorage.setItem('active_role', 'SCHOOL_ADMIN');
        if (data.currentUser.name) localStorage.setItem('admin_userName', data.currentUser.name);
      } else if (data.currentUser.role === 'PARENT') {
        sessionStorage.setItem('active_role', 'PARENT');
        if (data.currentUser.name) localStorage.setItem('parent_userName', data.currentUser.name);
      }
    }
    
    const setupObj = data.setup;
    const resolvedSchoolName = 
      setupObj?.schoolName || 
      setupObj?.tenant?.name || 
      data.tenantName || 
      data.tenant?.name || 
      (typeof window !== 'undefined' ? (sessionStorage.getItem('otp_schoolName') || localStorage.getItem('stored_school_name')) : '') || 
      '';

    const resolvedSchoolType = 
      setupObj?.schoolType || 
      setupObj?.tenant?.subtitle || 
      data.tenant?.subtitle || 
      (typeof window !== 'undefined' ? localStorage.getItem('stored_school_type') : '') || 
      'School';

    const resolvedAdminName = 
      setupObj?.adminName || 
      data.currentUser?.name || 
      (typeof window !== 'undefined' ? (localStorage.getItem('admin_userName') || localStorage.getItem('teacher_userName') || localStorage.getItem('parent_userName')) : '') || 
      '';

    const resolvedLogo = 
      setupObj?.schoolLogo || 
      setupObj?.tenant?.logoUrl || 
      data.tenantLogo || 
      data.tenant?.logoUrl || 
      (typeof window !== 'undefined' ? (sessionStorage.getItem('otp_logoUrl') || localStorage.getItem('stored_school_logo')) : null) || 
      null;

    if (resolvedSchoolName) {
      setSchoolName(resolvedSchoolName);
      if (typeof window !== 'undefined') {
        localStorage.setItem('stored_school_name', resolvedSchoolName);
        sessionStorage.setItem('otp_schoolName', resolvedSchoolName);
      }
    }

    if (resolvedSchoolType) {
      setSchoolType(resolvedSchoolType);
      if (typeof window !== 'undefined') {
        localStorage.setItem('stored_school_type', resolvedSchoolType);
      }
    }

    if (resolvedAdminName) {
      setAdminName(resolvedAdminName);
    }

    if (resolvedLogo !== undefined) {
      setLogoUrl(resolvedLogo);
      if (typeof window !== 'undefined' && resolvedLogo) {
        localStorage.setItem('stored_school_logo', resolvedLogo);
      }
    }

    if (typeof window !== 'undefined') {
      const tid = setupObj?.tenantId || data.tenantId || getStoredTenantId();
      if (tid) {
        const role = getActiveRole();
        if (role === 'TEACHER') {
          localStorage.setItem('teacher_tenantId', tid);
        } else if (role === 'PARENT') {
          localStorage.setItem('parent_tenantId', tid);
        } else {
          localStorage.setItem('admin_tenantId', tid);
        }
        try {
          localStorage.setItem(`edutrack_tenant_cache_${tid}`, JSON.stringify(data));
        } catch {}
      }
    }
  };

  const fetchTenantData = async () => {
    const currentToken = typeof window !== 'undefined' ? getStoredToken() : null;
    if (!currentToken) {
      try {
        const response = await fastGet('/tenant/public-branding', undefined, { ttlMs: 120000 });
        const data = response.data;
        if (data) {
          if (!getStoredToken()) {
            setSchoolName(data.name || "");
            setSchoolType(data.subtitle || "School");
            setAdminName(data.name || "");
            setLogoUrl(data.logoUrl || null);
          }
        }
      } catch (err) {
        if (!getStoredToken()) {
          setSchoolName("");
          setSchoolType("");
          setAdminName("");
          setLogoUrl(null);
        }
      } finally {
        setSetupStats(null);
        setCurrentUser(null);
        setSubscription(null);
        setLoading(false);
      }
      return;
    }

    try {
      const response = await fastGet('/tenant/setup-status', undefined, {
        ttlMs: 60000,
        onRevalidate: (fresh) => {
          if (fresh) applyTenantData(fresh);
        }
      });
      if (response.data) {
        applyTenantData(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch tenant setup status:', err);
    } finally {
      setLoading(false);
    }
  };

  // Sync token from localStorage on routing/pathname changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentToken = getStoredToken();
      if (currentToken !== token) {
        setToken(currentToken);
      }
    }
  }, [pathname, token]);

  // Automatically fetch profile when the token state changes (login, logout, or startup)
  useEffect(() => {
    fetchTenantData();
  }, [token]);

  // Non-blocking intelligent background prefetch of high-value static dropdown metadata (~3.5 KB)
  // Primes the SWR cache so the first click to any module renders with 0ms metadata wait
  useEffect(() => {
    if (!token) return;

    const prefetchMetadata = () => {
      const prefetchUrls = [
        '/academics/academic-years',
        '/academics/classes',
        '/academics/sections',
        '/exams/exam-types',
        '/exams/subjects',
        '/billing/options/years',
        '/billing/options/classes',
      ];

      prefetchUrls.forEach((url) => {
        fastGet(url, undefined, { ttlMs: 120000 }).catch(() => {});
      });
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const handle = (window as any).requestIdleCallback(prefetchMetadata, { timeout: 1000 });
      return () => {
        if ('cancelIdleCallback' in window) {
          (window as any).cancelIdleCallback(handle);
        }
      };
    } else {
      const timer = setTimeout(prefetchMetadata, 250);
      return () => clearTimeout(timer);
    }
  }, [token]);

  // Background polling to sync data dynamically across multiple users
  useEffect(() => {
    if (!token) return;

    let previousStats: any = null;

    const interval = setInterval(async () => {
      // Skip polling if document is hidden to conserve connection pool
      if (typeof document !== 'undefined' && document.hidden) return;

      try {
        const response = await api.get('/tenant/setup-status');
        const data = response.data;
        
        // If stats changed, trigger a local custom event dispatch
        // to update all listening pages automatically.
        if (previousStats) {
          const statsChanged = 
            data.classesCount !== previousStats.classesCount ||
            data.teachersCount !== previousStats.teachersCount ||
            data.studentsCount !== previousStats.studentsCount ||
            data.completionPercentage !== previousStats.completionPercentage ||
            data.subscription?.status !== previousStats.subscription?.status ||
            data.subscription?.plan !== previousStats.subscription?.plan;
            
          if (statsChanged) {
            console.log('[TenantContext] Stats or subscription changed in DB, dispatching updates!');
            setSetupStats(data);
            setSubscription(data.subscription || null);
            const { dispatchSchoolSetupUpdated } = await import('@/lib/events');
            dispatchSchoolSetupUpdated();
          }
        } else {
          // Initialize first comparison baseline
          setSetupStats(data);
          setSubscription(data.subscription || null);
        }
        previousStats = data;
      } catch (err) {
        console.error('Failed background sync of tenant data:', err);
      }
    }, 60000); // Check every 60 seconds

    return () => clearInterval(interval);
  }, [token]);

  // Use the centralized school-setup-updated listener
  useSchoolSetupUpdate(fetchTenantData);

  return (
    <TenantContext.Provider value={{
      schoolName,
      schoolType,
      adminName,
      logoUrl,
      loading,
      setupStats,
      currentUser,
      subscription,
      isSubscriptionActive,
      showLockPopup,
      setShowLockPopup,
      refresh: fetchTenantData
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
