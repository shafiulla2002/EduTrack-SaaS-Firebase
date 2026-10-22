'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LegacyDriverPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect drivers to the integrated Staff Portal Transport Tracker
    router.replace('/dashboard/transport-tracker');
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white font-sans">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-3xl shadow-lg shadow-blue-500/30 animate-pulse">
          🚌
        </div>
        <h1 className="text-xl font-bold">Redirecting to Staff Portal...</h1>
        <p className="text-xs text-slate-400 font-medium">
          Driver duty tracking is now integrated into the standard Staff Portal.
        </p>
      </div>
    </div>
  );
}
