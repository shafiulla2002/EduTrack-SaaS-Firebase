'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { api, getStoredToken, getStoredTenantId, clearStoredAuth } from '@/lib/api';

export default function OnboardingRouterPage() {
  const router = useRouter();

  useEffect(() => {
    const checkStatus = async () => {
      const token = getStoredToken();
      const tenantId = getStoredTenantId();

      if (!token || !tenantId) {
        router.push('/auth/login');
        return;
      }

      try {
        // Retrieve tenant setup status from backend
        const response = await api.get('/tenant/setup-status');
        const data = response.data;
        
        // Go directly to Dashboard
        router.push('/dashboard');
      } catch (err) {
        console.error('Onboarding status check failed:', err);
        // Clear corrupt storage and send to login
        clearStoredAuth();
        router.push('/auth/login');
      }
    };

    checkStatus();
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center">
      <div className="text-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-brand-500 mx-auto" />
        <h2 className="text-xl font-bold text-white tracking-tight">Loading Portal</h2>
        <p className="text-slate-500 text-xs font-light">
          Please wait while we resolve your session and secure tenant environment...
        </p>
      </div>
    </main>
  );
}
