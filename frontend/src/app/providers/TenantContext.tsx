'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { api, getStoredToken, getStoredTenantId, getActiveRole } from '@/lib/api';
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

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [schoolName, setSchoolName] = useState('');
  const [schoolType, setSchoolType] = useState('');
  const [adminName, setAdminName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupStats, setSetupStats] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return getStoredToken();
    }
    return null;
  });
  const pathname = usePathname();
  const [showLockPopup, setShowLockPopup] = useState(false);

  const isSubscriptionActive = !token || loading || !subscription || (
    subscription.status === 'ACTIVE' ||
    subscription.status === 'PAST_DUE' ||
    new Date(subscription.expiryDate).getTime() + (3 * 24 * 60 * 60 * 1000) >= Date.now()
  );

  // Register Axios response interceptor to handle 402 status codes globally
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 402) {
          console.warn('Axios Interceptor: 402 Payment Required detected. Triggering subscription renewal popup.');
          setShowLockPopup(true);
        }
        return Promise.reject(error);
      }
    );
    return () => {
      api.interceptors.response.eject(interceptor);
    };
  }, []);

  const fetchTenantData = async () => {
    const currentToken = typeof window !== 'undefined' ? getStoredToken() : null;
    if (!currentToken) {
      try {
        const response = await api.get('/tenant/public-branding');
        const data = response.data;
        if (data) {
          setSchoolName(data.name || "");
          setSchoolType(data.subtitle || "School");
          setAdminName(data.name || "");
          setLogoUrl(data.logoUrl || null);
          if (typeof window !== 'undefined' && data.id) {
            const role = getActiveRole();
            if (role === 'TEACHER') {
              localStorage.setItem('teacher_tenantId', data.id);
            } else if (role === 'PARENT') {
              localStorage.setItem('parent_tenantId', data.id);
            } else {
              localStorage.setItem('admin_tenantId', data.id);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch public tenant branding:', err);
        setSchoolName("");
        setSchoolType("");
        setAdminName("");
        setLogoUrl(null);
      } finally {
        setSetupStats(null);
        setCurrentUser(null);
        setSubscription(null);
        setLoading(false);
      }
      return;
    }

    try {
      const response = await api.get('/tenant/setup-status');
      const data = response.data;
      setSetupStats(data);
      setCurrentUser(data.currentUser || null);
      setSubscription(data.subscription || null);
      
      if (typeof window !== 'undefined' && data.currentUser?.role) {
        if (data.currentUser.role === 'TEACHER') {
          sessionStorage.setItem('active_role', 'TEACHER');
        } else if (data.currentUser.role === 'SCHOOL_ADMIN') {
          sessionStorage.setItem('active_role', 'SCHOOL_ADMIN');
        } else if (data.currentUser.role === 'PARENT') {
          sessionStorage.setItem('active_role', 'PARENT');
        }
      }
      
      const setupObj = data.setup;
      if (setupObj) {
        setSchoolName(setupObj.schoolName || "");
        setSchoolType(setupObj.schoolType || "");
        setAdminName(setupObj.adminName || "");
        setLogoUrl(setupObj.schoolLogo || null);
        if (typeof window !== 'undefined' && setupObj.tenantId) {
          const role = getActiveRole();
          if (role === 'TEACHER') {
            localStorage.setItem('teacher_tenantId', setupObj.tenantId);
          } else if (role === 'PARENT') {
            localStorage.setItem('parent_tenantId', setupObj.tenantId);
          } else {
            localStorage.setItem('admin_tenantId', setupObj.tenantId);
          }
        }
      } else {
        setSchoolName("");
        setSchoolType("");
        setAdminName("");
        setLogoUrl(null);
      }
    } catch (err) {
      console.error('Failed to fetch tenant setup status:', err);
      setSchoolName("");
      setSchoolType("");
      setAdminName("");
      setLogoUrl(null);
      setCurrentUser(null);
      setSubscription(null);
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

  // Background polling to sync data dynamically across multiple users
  useEffect(() => {
    if (!token) return;

    let previousStats: any = null;

    const interval = setInterval(async () => {
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
    }, 5000); // Check every 5 seconds

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
