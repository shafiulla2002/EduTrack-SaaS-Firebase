'use client';

import React from 'react';
import PencilSpinner from './PencilSpinner';

interface TableSkeletonProps {
  headers?: string[];
  columns?: number;
  rows?: number;
  loadingLabel?: string;
  loadingMessage?: string;
  className?: string;
  cellWidths?: string[];
  alignments?: ('left' | 'center' | 'right')[];
}

export default function TableSkeleton({
  headers,
  columns = 5,
  rows = 5,
  loadingLabel,
  loadingMessage,
  className = '',
  cellWidths = [],
  alignments = [],
}: TableSkeletonProps) {
  const displayLabel = loadingLabel || loadingMessage || 'Loading records...';
  const effectiveHeaders = headers && headers.length > 0 
    ? headers 
    : Array.from({ length: columns }).map((_, i) => `Column ${i + 1}`);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`w-full overflow-hidden border border-slate-200/80 rounded-xl bg-white shadow-xs relative ${className}`}
    >
      {/* Top subtle status bar with mini PencilSpinner */}
      <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-blue-50/60 to-indigo-50/40 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <PencilSpinner size="xs" />
          <span className="text-[11px] font-bold text-blue-700 tracking-wide">
            {displayLabel}
          </span>
        </div>
        <span className="text-[10px] font-semibold text-slate-400">Please wait...</span>
      </div>

      <div className="overflow-x-auto w-full">
        <table className="w-full border-collapse min-w-[500px]">
          {headers && headers.length > 0 && (
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                {effectiveHeaders.map((header, idx) => (
                  <th
                    key={idx}
                    className={`px-4 py-3 text-${alignments[idx] || 'left'}`}
                    style={{ width: cellWidths[idx] || 'auto' }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-slate-100">
            {Array.from({ length: rows }).map((_, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-50/50 transition-colors">
                {effectiveHeaders.map((_, cIdx) => (
                  <td
                    key={cIdx}
                    className={`px-4 py-3 text-${alignments[cIdx] || 'left'}`}
                  >
                    {cIdx === 0 ? (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-200/70 animate-pulse shrink-0" />
                        <div className="h-3.5 w-28 bg-slate-200/70 rounded-md animate-pulse" />
                      </div>
                    ) : cIdx === effectiveHeaders.length - 1 ? (
                      <div
                        className={`h-3.5 w-20 bg-slate-200/70 rounded-md animate-pulse ${
                          alignments[cIdx] === 'right' ? 'ml-auto' : ''
                        }`}
                      />
                    ) : (
                      <div className="h-3.5 w-24 bg-slate-200/70 rounded-md animate-pulse" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <span className="sr-only">{displayLabel}</span>
    </div>
  );
}
