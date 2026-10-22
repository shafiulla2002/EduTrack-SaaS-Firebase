'use client';

import React from 'react';
import LoadingSpinner from './LoadingSpinner';

interface StatCardSkeletonProps {
  label?: string;
  variant?: 'stat' | 'setup';
  className?: string;
}

export default function StatCardSkeleton({
  label,
  variant = 'stat',
  className = '',
}: StatCardSkeletonProps) {
  if (variant === 'setup') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className={`bg-slate-50/80 border border-slate-200/60 p-4 rounded-xl flex items-center gap-4 animate-pulse ${className}`}
      >
        <div className="w-12 h-12 rounded-xl bg-slate-200/80 flex items-center justify-center shrink-0">
          <LoadingSpinner size="xs" variant="slate" />
        </div>
        <div className="space-y-2 flex-1">
          <div className="h-3 w-20 bg-slate-200/80 rounded" />
          <div className="h-4 w-28 bg-slate-200/80 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`inline-flex items-center gap-2 ${className}`}
    >
      <div className="h-7 w-16 bg-slate-200/70 rounded-lg animate-pulse flex items-center justify-center">
        <LoadingSpinner size="xs" variant="brand" />
      </div>
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
}
