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
  const [schoolName, setSchoolName] = useState<string>('');
  const [schoolType, setSchoolType] = useState<string>('School');
  const [adminName, setAdminName] = useState<string>('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [setupStats, setSetupStats] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const pathname = usePathname();
  const [showLockPopup, setShowLockPopup] = useState(false);

  // Safe client hydration: hydrate stored authentication & tenant cache post-mount
  useEffect(() => {
    const currentToken = getStoredToken();
    if (currentToken) {
      setToken(currentToken);
    }

    const cachedData = getInitialTenantCache();
    if (cachedData) {
      applyTenantData(cachedData);
    } else {
      const storedSchool = typeof window !== 'undefined' ? (sessionStorage.getItem('otp_schoolName') || localStorage.getItem('stored_school_name')) : '';
      if (storedSchool) setSchoolName(storedSchool);

      const storedType = typeof window !== 'undefined' ? (localStorage.getItem('stored_school_type') || 'School') : 'School';
      if (storedType) setSchoolType(storedType);

      const storedAdmin = typeof window !== 'undefined' ? (
        localStorage.getItem('admin_userName') || 
        localStorage.getItem('teacher_userName') || 
        localStorage.getItem('parent_userName') || ''
      ) : '';
      if (storedAdmin) setAdminName(storedAdmin);

      const storedLogo = typeof window !== 'undefined' ? (sessionStorage.getItem('otp_logoUrl') || localStorage.getItem('stored_school_logo') || null) : null;
      if (storedLogo) setLogoUrl(storedLogo);

      if (typeof window !== 'undefined') {
        const rawUser = localStorage.getItem('stored_current_user');
        if (rawUser) {
          try { setCurrentUser(JSON.parse(rawUser)); } catch {}
        }
      }
    }
  }, []);

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

  // Centralized school-setup-updated listener handles event-driven refreshes
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
