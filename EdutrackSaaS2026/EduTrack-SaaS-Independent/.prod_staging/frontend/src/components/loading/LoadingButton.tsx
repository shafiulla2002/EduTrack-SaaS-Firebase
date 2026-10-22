'use client';

import React from 'react';
import LoadingSpinner from './LoadingSpinner';

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
  spinnerVariant?: 'brand' | 'white' | 'slate' | 'emerald' | 'amber' | 'rose';
  children: React.ReactNode;
}

export default function LoadingButton({
  isLoading = false,
  loadingText,
  icon,
  spinnerVariant = 'white',
  disabled,
  children,
  className = '',
  ...rest
}: LoadingButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      className={`relative inline-flex items-center justify-center gap-2 transition-all select-none disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    >
      {isLoading ? (
        <>
          <LoadingSpinner size="xs" variant={spinnerVariant} />
          <span>{loadingText || children}</span>
        </>
      ) : (
        <>
          {icon && <span className="shrink-0">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
}
