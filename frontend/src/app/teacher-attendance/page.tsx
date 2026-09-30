'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Building,
  UserCheck,
  ShieldCheck,
  Loader2,
  LogIn,
  ArrowRight,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { api, getStoredToken, getActiveRole } from '@/lib/api';

function TeacherAttendanceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [state, setState] = useState<'CHECKING_AUTH' | 'NOT_LOGGED_IN' | 'VALIDATING' | 'SUCCESS' | 'ERROR'>('CHECKING_AUTH');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successData, setSuccessData] = useState<any>(null);

  useEffect(() => {
    if (!token) {
      setState('ERROR');
      setErrorMessage('No attendance QR token provided in the URL. Please scan a valid CS EduTrack QR code.');
      return;
    }

    // Preserve token in session storage
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pending_attendance_token', token);
    }

    const authToken = getStoredToken();
    const activeRole = getActiveRole();

    if (!authToken || (activeRole !== 'TEACHER' && activeRole !== 'SCHOOL_ADMIN')) {
      setState('NOT_LOGGED_IN');
      return;
    }

    // User is logged in -> proceed with verification
    markAttendance(token);
  }, [token]);

  const markAttendance = async (qrToken: string) => {
    setState('VALIDATING');
    setErrorMessage('');

    // Try to obtain geolocation
    let lat: number | undefined;
    let lng: number | undefined;

    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 6000,
            enableHighAccuracy: true,
          });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (e) {
        console.warn('Geolocation capture skipped or denied');
      }
    }

    try {
      const payload: any = {
        token: qrToken,
        scanSource: 'MOBILE_CAMERA_DEEP_LINK',
      };
      if (lat != null && lng != null) {
        payload.latitude = lat;
        payload.longitude = lng;
      }

      const res = await api.post('/teacher-attendance/scan', payload);
      const data = res.data;

      if (data.success) {
        setSuccessData(data);
        setState('SUCCESS');
        // Clear pending token
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('pending_attendance_token');
        }
      } else {
        setState('ERROR');
        setErrorMessage(data.message || 'Attendance verification failed.');
      }
    } catch (err: any) {
      console.error('Deep link attendance scan error:', err);
      setState('ERROR');
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Unable to connect to the server. Please try again.';
      setErrorMessage(msg);
    }
  };

  const handleLoginRedirect = () => {
    const returnUrl = `/teacher-attendance?token=${encodeURIComponent(token)}`;
    router.push(`/auth/login?portal=teacher&returnUrl=${encodeURIComponent(returnUrl)}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-slate-950 via-slate-900 to-[#0F172A] flex flex-col items-center justify-center p-4 text-white">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 text-slate-800 animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="flex flex-col items-center text-center pb-6 border-b border-slate-100">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#2E5BFF] flex items-center justify-center font-black text-xl shadow-xs mb-3">
            ET
          </div>
          <h1 className="text-lg font-black text-slate-900">CS EduTrack Teacher Attendance</h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Automated Mobile Check-in Verification</p>
        </div>

        {/* Dynamic Body States */}
        <div className="py-6 flex flex-col items-center text-center">
          {state === 'CHECKING_AUTH' && (
            <div className="py-8 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-[#2E5BFF] animate-spin" />
              <p className="text-xs font-semibold text-slate-500">Checking credentials...</p>
            </div>
          )}

          {state === 'NOT_LOGGED_IN' && (
            <div className="py-2 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 text-[#2E5BFF] flex items-center justify-center mx-auto">
                <LogIn className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-800">Teacher Login Required</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  Please log in with your registered mobile phone number to record your attendance.
                </p>
              </div>

              <button
                onClick={handleLoginRedirect}
                className="w-full py-3.5 bg-[#2E5BFF] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                Log In to Confirm Attendance
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {state === 'VALIDATING' && (
            <div className="py-8 flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#2E5BFF] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Verifying School & Token...</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Validating tenant security and recording your attendance...
                </p>
              </div>
            </div>
          )}

          {state === 'SUCCESS' && successData && (
            <div className="space-y-4 w-full">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 ${
                    successData.attendance?.status === 'LATE'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {successData.attendance?.status || 'PRESENT'}
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  {successData.alreadyMarked ? 'Attendance Already Marked' : 'Attendance Verified!'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{successData.message}</p>
              </div>

              {/* Receipt Details Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2.5 text-xs text-slate-600">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                  <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-blue-500" /> Teacher
                  </span>
                  <span className="font-bold text-slate-800">{successData.attendance?.teacherName || 'Teacher'}</span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                  <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-blue-500" /> School
                  </span>
                  <span className="font-bold text-slate-800 truncate max-w-[180px]">
                    {successData.attendance?.schoolName || 'CS EduTrack'}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                  <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-500" /> Timestamp
                  </span>
                  <span className="font-mono font-bold text-slate-800">
                    {successData.attendance?.checkInTime
                      ? new Date(successData.attendance.checkInTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Today'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Verification
                  </span>
                  <span className="font-bold text-emerald-600">Server Verified</span>
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <Link
                  href="/dashboard"
                  className="w-full py-3 bg-[#2E5BFF] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all"
                >
                  Open Teacher Dashboard
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/dashboard/my-attendance"
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center transition-colors"
                >
                  View Attendance History
                </Link>
              </div>
            </div>
          )}

          {state === 'ERROR' && (
            <div className="py-2 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">Attendance Verification Failed</h3>
                <p className="text-xs text-rose-600 mt-1 leading-relaxed max-w-xs mx-auto font-medium">
                  {errorMessage || 'This QR code could not be verified.'}
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => markAttendance(token)}
                  className="flex-1 py-2.5 bg-[#2E5BFF] hover:bg-blue-600 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Try Again
                </button>
                <Link
                  href="/dashboard"
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center"
                >
                  Dashboard
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="pt-4 border-t border-slate-100 text-center text-[11px] text-slate-400 font-mono">
          CS EduTrack • Multi-Tenant Attendance Security
        </div>
      </div>
    </div>
  );
}

export default function TeacherAttendanceDeepLinkPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      }
    >
      <TeacherAttendanceContent />
    </Suspense>
  );
}
