'use client';

import React from 'react';

interface PencilSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  label?: string;
  showLabel?: boolean;
}

const SIZE_MAP: Record<string, number> = {
  xs: 20,
  sm: 28,
  md: 40,
  lg: 56,
  xl: 72,
};

export default function PencilSpinner({
  size = 'md',
  className = '',
  label = 'Loading...',
  showLabel = false,
}: PencilSpinnerProps) {
  const pixelSize = SIZE_MAP[size] || 40;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`inline-flex flex-col items-center justify-center gap-2 ${className}`}
    >
      <style>{`
        @keyframes edu-pencil-spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        .edu-pencil-rotating {
          animation: edu-pencil-spin 1.2s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
          transform-origin: center center;
        }
      `}</style>
      
      <svg
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="edu-pencil-rotating shrink-0 select-none"
        aria-hidden="true"
      >
        {/* Subtle drawn circle trail behind the pencil tip */}
        <path
          d="M 50 14 A 36 36 0 1 1 20 68"
          stroke="#93c5fd"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="4 3"
          opacity="0.6"
        />

        {/* Outer Shadow / Glow */}
        <circle cx="50" cy="50" r="36" stroke="#2563eb" strokeWidth="1" opacity="0.1" />

        {/* ── Curved Pencil Body (Main Arc) ── */}
        <path
          d="M 32 78 A 36 36 0 1 1 84 42"
          stroke="#2563eb"
          strokeWidth="14"
          strokeLinecap="butt"
        />
        {/* Pencil body highlight ridge */}
        <path
          d="M 34 76 A 36 36 0 1 1 82 43"
          stroke="#60a5fa"
          strokeWidth="4"
          strokeLinecap="butt"
        />
        {/* Pencil body dark shade ridge */}
        <path
          d="M 29 80 A 36 36 0 0 1 48 86"
          stroke="#1d4ed8"
          strokeWidth="3.5"
          strokeLinecap="butt"
        />

        {/* ── Eraser & Ferrule (Back End at ~32, 78) ── */}
        <g transform="translate(32, 78) rotate(-130)">
          {/* Metal Ferrule */}
          <rect x="-7" y="-2" width="14" height="6" rx="1" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
          <line x1="-7" y1="0.5" x2="7" y2="0.5" stroke="#64748b" strokeWidth="0.8" />
          <line x1="-7" y1="2.5" x2="7" y2="2.5" stroke="#64748b" strokeWidth="0.8" />
          {/* Blue Eraser */}
          <path d="M -6.5 4 C -6.5 8, 6.5 8, 6.5 4 Z" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="0.8" />
        </g>

        {/* ── Sharpened Wood Cone & Lead Tip (Front End at ~84, 42) ── */}
        <g transform="translate(84, 42) rotate(42)">
          {/* Wood Cone */}
          <polygon points="-7,0 7,0 0,14" fill="#fde047" stroke="#ca8a04" strokeWidth="0.8" />
          <polygon points="-4,0 4,0 0,10" fill="#fef08a" />
          {/* Graphite Lead Tip */}
          <polygon points="-2.5,9 2.5,9 0,15" fill="#0f172a" />
        </g>
      </svg>

      {showLabel && (
        <span className="text-xs font-semibold text-slate-600 animate-pulse tracking-wide">
          {label}
        </span>
      )}
      <span className="sr-only">{label}</span>
    </div>
  );
}
