// frontend/src/app/attendance/student-report/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import React, { Suspense } from 'react';

function RedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const studentId = searchParams.get('studentId') || '';
    
    // Construct target URL
    let target = '/attendance/dashboard?view=monthly';
    if (studentId) target += `&studentId=${encodeURIComponent(studentId)}`;
    
    router.replace(target);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-400 flex items-center justify-center flex-col gap-3">
      <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Redirecting to Unified Report Dashboard...</p>
    </div>
  );
}

export default function StudentAttendanceReport() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 text-slate-400 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    }>
      <RedirectContent />
    </Suspense>
  );
}
