'use client';

import React from 'react';

interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'brand' | 'white' | 'slate' | 'emerald' | 'amber' | 'rose';
  className?: string;
  label?: string;
  showLabel?: boolean;
}

const SIZE_MAP = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-8 h-8',
  xl: 'w-10 h-10',
};

const VARIANT_MAP = {
  brand: 'text-[#2E5BFF]',
  white: 'text-white',
  slate: 'text-slate-500',
  emerald: 'text-emerald-500',
  amber: 'text-amber-500',
  rose: 'text-rose-500',
};

export default function LoadingSpinner({
  size = 'sm',
  variant = 'brand',
  className = '',
  label = 'Loading...',
  showLabel = false,
}: LoadingSpinnerProps) {
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.sm;
  const variantClass = VARIANT_MAP[variant] || VARIANT_MAP.brand;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`inline-flex items-center gap-2 ${className}`}
    >
      <svg
        className={`animate-spin ${sizeClass} ${variantClass} shrink-0`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3.5"
        />
        <path
          className="opacity-90"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {showLabel && (
        <span className="text-xs font-semibold text-slate-600 tracking-wide">
          {label}
        </span>
      )}
      <span className="sr-only">{label}</span>
    </div>
  );
}
