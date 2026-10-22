'use client';

import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export default function ErrorState({
  title = 'Unable to load data',
  message = 'An unexpected error occurred while fetching records.',
  onRetry,
  retryLabel = 'Retry',
  className = '',
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`w-full py-10 px-6 flex flex-col items-center justify-center text-center bg-rose-50/40 border border-rose-200/80 rounded-2xl ${className}`}
    >
      <div className="w-10 h-10 rounded-xl bg-rose-100/80 text-rose-600 flex items-center justify-center mb-3">
        <AlertCircle className="w-5 h-5 stroke-[2]" />
      </div>
      <h4 className="text-sm font-bold text-slate-800">{title}</h4>
      <p className="text-xs text-slate-500 font-medium mt-1 max-w-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3.5 px-4 py-1.5 bg-white hover:bg-rose-50 text-rose-600 font-bold text-xs rounded-xl border border-rose-200 shadow-2xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {retryLabel}
        </button>
      )}
    </div>
  );
}
