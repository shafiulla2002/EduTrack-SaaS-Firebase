'use client';

import React from 'react';
import PencilSpinner from './PencilSpinner';

interface SectionLoaderProps {
  title?: string;
  message?: string;
  minHeight?: string;
  className?: string;
  spinnerSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export default function SectionLoader({
  title = 'Loading...',
  message,
  minHeight = 'min-h-[220px]',
  className = '',
  spinnerSize = 'md',
}: SectionLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`w-full flex flex-col items-center justify-center p-8 text-center bg-white/80 rounded-2xl ${minHeight} ${className}`}
    >
      <PencilSpinner size={spinnerSize} />
      <h4 className="font-bold text-slate-800 text-sm mt-3 tracking-wide">{title}</h4>
      {message && <p className="text-xs text-slate-500 font-medium mt-1 max-w-sm">{message}</p>}
      <span className="sr-only">{title}</span>
    </div>
  );
}
