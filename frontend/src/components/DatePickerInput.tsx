'use client';

import React from 'react';
import { Calendar } from 'lucide-react';
import { formatDateDDMMYYYY } from '@/lib/date';

interface DatePickerInputProps {
  value: string; // ISO YYYY-MM-DD string
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
  name?: string;
}

export default function DatePickerInput({
  value,
  onChange,
  className = '',
  disabled = false,
  min,
  max,
  placeholder = 'Select Date',
  required = false,
  id,
  name,
}: DatePickerInputProps) {
  const displayFormatted = value ? formatDateDDMMYYYY(value) : placeholder;

  return (
    <div className="relative w-full">
      <div
        className={`flex items-center justify-between px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-100 text-sm font-semibold shadow-xs select-none transition-colors ${
          disabled ? 'opacity-60 bg-slate-100 dark:bg-slate-950 cursor-not-allowed' : 'hover:border-[#2E5BFF] focus-within:ring-2 focus-within:ring-[#2E5BFF]/20'
        } ${className}`}
      >
        <span className={value ? 'text-slate-800 dark:text-slate-100 font-mono font-bold' : 'text-slate-400 font-normal'}>
          {displayFormatted}
        </span>
        <Calendar className="w-4 h-4 text-slate-400 shrink-0 ml-2 pointer-events-none" />
      </div>
      <input
        type="date"
        id={id}
        name={name}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        min={min}
        max={max}
        required={required}
        aria-label={placeholder}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
      />
    </div>
  );
}
