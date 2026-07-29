'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Phone, ArrowRight, Loader2, AlertCircle, ArrowLeft, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useTenant } from '../../providers/TenantContext';
import { auth } from '@/lib/firebase';
import { signInWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';
import { setConfirmationResult, setSavedPhone } from '@/lib/firebaseAuthStore';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const portal = searchParams.get('portal') || 'admin';
  const { refresh } = useTenant();

  // Redirect to central Auth Hub if we are on a subdomain
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const hostParts = hostname.split('.');
      const isVercelApp = hostname.includes('vercel.app');
      const isEdutrackDomain = hostname.includes('edutrack.com');
      const isCovenTrackDomain = hostname.includes('edutrack.covenantsynergy.in');
      
      let isSubdomain = false;
      let tenant = '';
      
      if (isCovenTrackDomain) {
        if (hostParts.length > 3 && hostParts[0] !== 'www' && hostParts[0] !== 'api') {
          isSubdomain = true;
          tenant = hostParts[0];
        }
      } else if (isEdutrackDomain) {
        if (hostParts.length > 2 && hostParts[0] !== 'www' && hostParts[0] !== 'app') {
          isSubdomain = true;
          tenant = hostParts[0];
        }
      } else if (isVercelApp) {
        if (hostParts.length > 3) {
          isSubdomain = true;
          tenant = hostParts[0];
        }
      } else {
        // Localhost: school1.localhost -> length = 2, localhost -> length = 1
        if (hostParts.length > 1 && !hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
          isSubdomain = true;
          tenant = hostParts[0];
        }
      }

      if (isSubdomain && tenant) {
        // Redirect to central Auth Hub
        const authHubUrl = process.env.NEXT_PUBLIC_AUTH_HUB_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://edutrack.covenantsynergy.in');
        const returnUrl = window.location.href.replace('/auth/login', '/auth/callback');
        window.location.href = `${authHubUrl}/auth/login?portal=${portal}&tenant=${tenant}&returnUrl=${encodeURIComponent(returnUrl)}`;
      }
    }
  }, [portal]);

  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notFoundInfo, setNotFoundInfo] = useState<{ isNotFound: boolean; portal: string; message: string } | null>(null);

  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && !recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {
            // reCAPTCHA solved
          }
        });
      } catch (err) {
        console.error('Failed to initialize RecaptchaVerifier:', err);
      }
    }
    return () => {
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch (e) {}
        recaptchaVerifierRef.current = null;
      }
    };
  }, []);

  const portalTitle = 
    portal === 'teacher' ? 'Teacher Portal' :
    portal === 'parent' ? 'Parent Portal' :
    portal === 'student' ? 'Student Desk' :
    'School Administrator';

  const portalSubtitle = 
    portal === 'teacher' ? 'Enter your registered mobile phone number to access the Teacher Portal.' :
    portal === 'parent' ? 'Enter your registered mobile phone number to access the Parent Portal.' :
    portal === 'student' ? 'Enter your registered mobile phone number to access the Student Desk.' :
    'Enter your mobile phone number to log in or register a new school.';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotFoundInfo(null);

    // Basic mobile number validation
    const cleanedPhone = phone.trim().replace(/[\s\-()]/g, '');
    if (!cleanedPhone || cleanedPhone.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    // Check if session is already active for this phone number and matching role
    const adminToken = localStorage.getItem('admin_token');
    const adminPhone = localStorage.getItem('admin_userPhone');
    const teacherToken = localStorage.getItem('teacher_token');
    const teacherPhone = localStorage.getItem('teacher_userPhone');
    const parentToken = localStorage.getItem('parent_token');
    const parentPhone = localStorage.getItem('parent_userPhone');

    let matchingToken = null;
    let matchingRole = '';

    const normCleaned = cleanedPhone.slice(-10);

    if (portal === 'admin' && adminToken && adminPhone) {
      const normCached = adminPhone.replace(/\D/g, '').slice(-10);
      if (normCleaned === normCached) {
        matchingToken = adminToken;
        matchingRole = 'SCHOOL_ADMIN';
      }
    } else if (portal === 'teacher' && teacherToken && teacherPhone) {
      const normCached = teacherPhone.replace(/\D/g, '').slice(-10);
      if (normCleaned === normCached) {
        matchingToken = teacherToken;
        matchingRole = 'TEACHER';
      }
    } else if ((portal === 'parent' || portal === 'student') && parentToken && parentPhone) {
      const normCached = parentPhone.replace(/\D/g, '').slice(-10);
      if (normCleaned === normCached) {
        matchingToken = parentToken;
        matchingRole = 'PARENT';
      }
    }

    if (matchingToken) {
      setLoading(true);
      try {
        await api.get('/auth/profile', {
          headers: {
            'Authorization': `Bearer ${matchingToken}`
          }
        });
        
        sessionStorage.setItem('active_role', matchingRole);
        
        try {
          await refresh();
        } catch (e) {
          console.error('Failed to pre-fetch school profile:', e);
        }

        if (matchingRole === 'PARENT') {
          router.push('/parent');
        } else {
          router.push('/dashboard');
        }
        return;
      } catch (err) {
        if (matchingRole === 'TEACHER') {
          localStorage.removeItem('teacher_token');
          localStorage.removeItem('teacher_tenantId');
          localStorage.removeItem('teacher_userPhone');
        } else if (matchingRole === 'PARENT') {
          localStorage.removeItem('parent_token');
          localStorage.removeItem('parent_tenantId');
          localStorage.removeItem('parent_userPhone');
        } else {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_tenantId');
          localStorage.removeItem('admin_userPhone');
        }
      } finally {
        setLoading(false);
      }
    }

    setLoading(true);
    try {
      // Step 1: Backend Phone & Role verification (also registers rate limit)
      const response = await api.post('/auth/send-otp', { phone: cleanedPhone, portal });
      const data = response.data;

      if (data.notFound) {
        if (data.redirectToRegister) {
          router.push(`/register-school?phone=${encodeURIComponent(cleanedPhone)}`);
          return;
        }
        setNotFoundInfo({
          isNotFound: true,
          portal: data.portal || portal,
          message: data.message || `${portalTitle} account not found. Please contact your School Administrator.`
        });
        return;
      }

      const schoolName = data?.schoolName || '';
      const logoUrl = data?.logoUrl || '';

      sessionStorage.setItem('otp_schoolName', schoolName);
      sessionStorage.setItem('otp_logoUrl', logoUrl);

      // Step 2: Trigger Firebase Phone Authentication
      if (!recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
            size: 'invisible',
          });
        } catch (err) {
          console.error('Failed to instantiate RecaptchaVerifier:', err);
        }
      }

      let formattedPhone = cleanedPhone;
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = `+91${formattedPhone}`;
      }

      const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifierRef.current!);
      setConfirmationResult(confirmationResult);
      setSavedPhone(cleanedPhone);

      const tenant = searchParams.get('tenant') || '';
      const returnUrl = searchParams.get('returnUrl') || '';
      let otpUrl = `/auth/otp?phone=${encodeURIComponent(cleanedPhone)}&portal=${encodeURIComponent(portal)}`;
      if (tenant) otpUrl += `&tenant=${encodeURIComponent(tenant)}`;
      if (returnUrl) otpUrl += `&returnUrl=${encodeURIComponent(returnUrl)}`;
      router.push(otpUrl);
    } catch (err: any) {
      console.error('Send OTP error:', err);
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch (e) {}
        recaptchaVerifierRef.current = null;
      }
      let userFriendlyMessage = 'Failed to send OTP. Please try again.';
      if (err.code === 'auth/invalid-phone-number') {
        userFriendlyMessage = 'Invalid mobile number format.';
      } else if (err.code === 'auth/quota-exceeded') {
        userFriendlyMessage = 'SMS quota exceeded. Please try again tomorrow.';
      } else if (err.code === 'auth/too-many-requests') {
        userFriendlyMessage = 'Too many requests. Please wait a few minutes before trying again.';
      } else if (err.response?.data?.message) {
        userFriendlyMessage = err.response.data.message;
      } else if (err.message) {
        userFriendlyMessage = err.message;
      }
      setError(userFriendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  if (notFoundInfo?.isNotFound) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 relative overflow-hidden">
        <div className="absolute top-[20%] left-[10%] w-[300px] h-[300px] rounded-full bg-brand-500/10 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[20%] right-[10%] w-[300px] h-[300px] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />

        <div className="w-full max-w-md z-10">
          <div className="glass-card p-8 rounded-3xl border border-slate-900/50 bg-slate-900/40 backdrop-blur-xl text-center space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {portal === 'teacher' ? 'Teacher Account Not Found' : 'Parent Account Not Found'}
              </h2>
              <p className="text-slate-300 text-sm mt-3 leading-relaxed font-light">
                {notFoundInfo.message}
              </p>
            </div>
            <button
              onClick={() => {
                setNotFoundInfo(null);
                setPhone('');
                setError('');
              }}
              className="w-full py-3 px-4 bg-gradient-to-r from-brand-600 to-indigo-600 text-white rounded-xl font-semibold text-sm hover:from-brand-500 hover:to-indigo-500 shadow-lg shadow-brand-500/15 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Background Ornaments */}
      <div className="absolute top-[20%] left-[10%] w-[300px] h-[300px] rounded-full bg-brand-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[10%] w-[300px] h-[300px] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />

      {/* Main Card */}
      <div className="w-full max-w-md z-10">
        <div className="flex flex-col items-center justify-center mb-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20 mb-3">
            <span className="font-extrabold text-white text-xl tracking-tight">ET</span>
          </div>
          <h1 className="font-black text-2xl bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent tracking-tight max-w-sm">
            EduTrack Application
          </h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
            Powered By Covenant Synergy
          </p>
        </div>

        <div className="glass-card p-8 rounded-3xl border border-slate-900/50 bg-slate-900/40 backdrop-blur-xl relative">
          <div className="flex justify-between items-center mb-6">
            <Link href="/" className="text-xs font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Portal Selection
            </Link>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 uppercase tracking-wider">
              {portalTitle}
            </span>
          </div>

          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-white tracking-tight">{portalTitle}</h2>
            <p className="text-slate-400 text-sm mt-1.5 font-light">
              {portalSubtitle}
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs mb-5">
              <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="phone" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Mobile Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Phone className="w-4.5 h-4.5" />
                </div>
                <input
                  type="tel"
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="block w-full pl-11 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm transition-all font-light"
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-brand-600 to-indigo-600 text-white rounded-xl font-semibold text-sm hover:from-brand-500 hover:to-indigo-500 shadow-lg shadow-brand-500/15 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-950 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending OTP...
                </>
              ) : (
                <>
                  Get OTP Code
                  <ArrowRight className="w-4.5 h-4.5" />
                </>
              )}
            </button>
          </form>
          <div id="recaptcha-container"></div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-slate-100 flex justify-center items-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
