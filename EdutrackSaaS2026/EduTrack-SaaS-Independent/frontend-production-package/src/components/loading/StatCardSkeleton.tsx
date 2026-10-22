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
        className={`bg-slate-50/80 border border-slate-200/60 p-2.5 sm:p-4 rounded-xl flex flex-col justify-between h-full min-h-[116px] sm:min-h-0 sm:flex-row sm:items-center sm:gap-4 animate-pulse min-w-0 ${className}`}
      >
        <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-slate-200/80 flex items-center justify-center shrink-0">
          <LoadingSpinner size="xs" variant="slate" />
        </div>
        <div className="space-y-1.5 flex-1 mt-2 sm:mt-0 w-full min-w-0">
          <div className="h-2.5 sm:h-3 w-16 sm:w-20 bg-slate-200/80 rounded" />
          <div className="h-3 sm:h-4 w-20 sm:w-28 bg-slate-200/80 rounded" />
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
