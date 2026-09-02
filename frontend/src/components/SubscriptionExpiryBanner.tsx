'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, Clock, CreditCard } from 'lucide-react';
import { useTenant } from '@/app/providers/TenantContext';

export function SubscriptionExpiryBanner() {
  const { subscription, currentUser } = useTenant();

  if (!subscription || !currentUser) return null;

  // Only show banner for SCHOOL_ADMIN or ADMIN
  const isAdmin = currentUser.role === 'SCHOOL_ADMIN' || currentUser.role === 'ADMIN';
  if (!isAdmin) return null;

  const now = Date.now();
  const expiryDate = subscription.expiryDate ? new Date(subscription.expiryDate).getTime() : now + 365 * 86400000;
  const daysRemaining = Math.max(0, Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24)));
  const isExpired = now > expiryDate;
  const isExpiringSoon = !isExpired && daysRemaining <= 3;

  if (!isExpired && !isExpiringSoon) return null;

  if (isExpired) {
    return (
      <div className="w-full bg-rose-600 text-white px-4 py-3 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold z-40 border-b border-rose-700">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-200 animate-pulse" />
          <span>
            <strong>Subscription Expired — Read-Only Mode:</strong> Your school's EduTrack subscription has expired. The application is currently in read-only mode. Please renew your subscription to restore full access.
          </span>
        </div>
        <Link
          href="/dashboard/settings/subscription"
          className="shrink-0 px-3.5 py-1.5 rounded-xl bg-white text-rose-700 font-extrabold hover:bg-rose-50 transition-all flex items-center gap-1.5 shadow-xs"
        >
          <CreditCard className="w-3.5 h-3.5" /> Renew Subscription
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full bg-amber-500 text-slate-950 px-4 py-2.5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold z-40 border-b border-amber-600">
      <div className="flex items-center gap-2.5">
        <Clock className="w-4 h-4 shrink-0 text-slate-950" />
        <span>
          <strong>Subscription Expiry Warning:</strong> Your EduTrack subscription will expire in <strong>{daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}</strong> ({new Date(expiryDate).toLocaleDateString('en-IN')}). Please renew your subscription to continue using all features.
        </span>
      </div>
      <Link
        href="/dashboard/settings/subscription"
        className="shrink-0 px-3.5 py-1.5 rounded-xl bg-slate-950 text-white font-extrabold hover:bg-slate-900 transition-all flex items-center gap-1.5 shadow-xs"
      >
        <CreditCard className="w-3.5 h-3.5 text-amber-400" /> Renew Subscription
      </Link>
    </div>
  );
}
