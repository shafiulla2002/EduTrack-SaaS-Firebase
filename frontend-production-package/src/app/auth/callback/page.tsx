'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useTenant } from '../../providers/TenantContext';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useTenant();
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('Securing your session...');

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setError('Authorization session missing. Please try logging in again.');
      setTimeout(() => {
        router.push('/auth/login');
      }, 2000);
      return;
    }

    let isMounted = true;

    async function exchangeCode() {
      try {
        setStatusMsg('Exchanging credentials...');
        const response = await api.post('/auth/exchange-code', { code });
        const { access_token, user } = response.data;

        if (!isMounted) return;

        setStatusMsg('Initializing dashboard context...');
        const role = user.role;

        if (role === 'TEACHER' || role === 'STAFF' || role === 'DRIVER') {
          localStorage.setItem('teacher_token', access_token);
          localStorage.setItem('teacher_tenantId', user.tenantId);
          if (user.phone) {
            localStorage.setItem('teacher_userPhone', user.phone);
          }
          sessionStorage.setItem('active_role', role === 'DRIVER' ? 'DRIVER' : 'TEACHER');
          
          try {
            await refresh();
          } catch (e) {
            console.error('Failed to pre-fetch teacher school profile:', e);
          }

          setStatusMsg('Authenticated! Redirecting to Teacher Dashboard...');
          setTimeout(() => {
            if (role === 'DRIVER') {
              router.push('/dashboard/transport-tracker');
            } else {
              router.push('/dashboard');
            }
          }, 800);
        } else if (role === 'PARENT') {
          localStorage.setItem('parent_token', access_token);
          localStorage.setItem('parent_tenantId', user.tenantId);
          if (user.phone) {
            localStorage.setItem('parent_userPhone', user.phone);
          }
          sessionStorage.setItem('active_role', 'PARENT');

          try {
            await refresh();
          } catch (e) {
            console.error('Failed to pre-fetch parent school profile:', e);
          }

          setStatusMsg('Authenticated! Redirecting to Parent Portal...');
          setTimeout(() => {
            router.push('/parent');
          }, 800);
        } else {
          localStorage.setItem('admin_token', access_token);
          localStorage.setItem('admin_tenantId', user.tenantId);
          if (user.phone) {
            localStorage.setItem('admin_userPhone', user.phone);
          }
          sessionStorage.setItem('active_role', 'SCHOOL_ADMIN');

          try {
            await refresh();
          } catch (e) {
            console.error('Failed to pre-fetch admin school profile:', e);
          }

          setStatusMsg('Authenticated! Redirecting to Dashboard...');
          setTimeout(() => {
            router.push('/dashboard');
          }, 800);
        }
      } catch (err: any) {
        console.error('Code exchange failure:', err);
        if (!isMounted) return;
        
        let msg = 'Authentication failed. The code may be expired or invalid.';
        if (err.response?.data?.message) {
          msg = err.response.data.message;
        }
        setError(msg);
        setTimeout(() => {
          router.push('/auth/login');
        }, 3000);
      }
    }

    exchangeCode();

    return () => {
      isMounted = false;
    };
  }, [searchParams, router, refresh]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Decorative Ornaments */}
      <div className="absolute top-[20%] left-[10%] w-[300px] h-[300px] rounded-full bg-brand-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[10%] w-[300px] h-[300px] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md z-10 text-center">
        <div className="glass-card p-8 rounded-3xl border border-slate-900/50 bg-slate-900/40 backdrop-blur-xl space-y-6">
          {error ? (
            <>
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto animate-pulse">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white">Authentication Error</h2>
                <p className="text-slate-400 text-sm leading-relaxed font-light">{error}</p>
              </div>
              <p className="text-xs text-slate-500 animate-pulse">Redirecting back to login page...</p>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mx-auto relative">
                <Loader2 className="w-7 h-7 animate-spin" />
              </div>
              <div className="space-y-2 animate-pulse">
                <h2 className="text-xl font-bold text-white">Completing Sign-In</h2>
                <p className="text-slate-400 text-sm leading-relaxed font-light">{statusMsg}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-slate-100 flex justify-center items-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
