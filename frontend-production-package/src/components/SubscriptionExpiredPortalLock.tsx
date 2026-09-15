'use client';

import React from 'react';
import { Lock, ShieldAlert } from 'lucide-react';

export function SubscriptionExpiredPortalLock() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md bg-white border border-rose-200 rounded-3xl p-8 shadow-xl space-y-4">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center text-rose-600 mx-auto border-4 border-rose-50">
          <Lock className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Portal Access Restricted</h2>
          <p className="text-sm font-semibold text-rose-600 mt-2 bg-rose-50 py-3 px-4 rounded-2xl border border-rose-100">
            Your school's EduTrack subscription has expired. Please reach out to your school admin.
          </p>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Access to student records, attendance, grades, fees, and communication modules is temporarily locked until your school administrator renews the EduTrack SaaS subscription.
        </p>
        <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-slate-400 font-mono">
          <ShieldAlert className="w-3.5 h-3.5" /> Code: SUBSCRIPTION_EXPIRED
        </div>
      </div>
    </div>
  );
}
