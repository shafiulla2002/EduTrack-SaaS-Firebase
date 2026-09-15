'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | 'full';
  footer?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  closeOnOverlay?: boolean;
  closeOnEscape?: boolean;
  children?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

// Global body scroll lock state tracking
let scrollLockCount = 0;
let originalOverflow = '';
let originalPaddingRight = '';

const getFocusableElements = (container: HTMLElement) => {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]'
    )
  ).filter((el) => el.getAttribute('tabindex') !== '-1');
};

const lockScroll = () => {
  if (typeof window === 'undefined') return;
  if (scrollLockCount === 0) {
    originalOverflow = document.body.style.overflow;
    originalPaddingRight = document.body.style.paddingRight;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.overflow = 'hidden';
  }
  scrollLockCount++;
};

const unlockScroll = () => {
  if (typeof window === 'undefined') return;
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = originalOverflow;
    document.body.style.paddingRight = originalPaddingRight;
  }
};

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'md',
  footer,
  loading = false,
  error = null,
  onRetry,
  closeOnOverlay = true,
  closeOnEscape = true,
  children,
  className = '',
  bodyClassName = '',
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const [animate, setAnimate] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Mount logic with delay for CSS scale & fade animations
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      const timer = setTimeout(() => setAnimate(true), 10);
      return () => clearTimeout(timer);
    } else {
      setAnimate(false);
      const timer = setTimeout(() => setMounted(false), 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      lockScroll();
      return () => {
        unlockScroll();
      };
    }
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
    }
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, closeOnEscape, onClose]);

  // Accessibility: Focus trapping & restoration
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;

      const timer = setTimeout(() => {
        if (modalRef.current) {
          const focusable = getFocusableElements(modalRef.current);
          if (focusable.length > 0) {
            focusable[0].focus();
          } else {
            modalRef.current.focus();
          }
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen && previousFocusRef.current) {
      const timer = setTimeout(() => {
        previousFocusRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab' && modalRef.current) {
      const focusable = getFocusableElements(modalRef.current);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          last.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    }
  };

  if (!mounted) return null;

  // Size mapping
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
    full: 'max-w-[95vw] h-[92vh]',
  };

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      className={`fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 transition-opacity duration-200 ease-in-out ${
        animate ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(6px)' }}
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop overlay click handler */}
      <div
        className="absolute inset-0 cursor-default"
        onClick={() => {
          if (closeOnOverlay) onClose();
        }}
      />

      {/* Modal Dialog Card Container */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`w-full max-h-[88vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col shadow-2xl relative overflow-hidden my-auto outline-none z-10 transform transition-all duration-200 ease-in-out ${
          sizeClasses[size]
        } ${animate ? 'scale-100 opacity-100' : 'scale-95 opacity-0'} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        {(title || Boolean(onClose)) && (
          <div className="p-4 sm:p-5 bg-slate-900 text-white flex justify-between items-center shrink-0 border-b border-slate-800 select-none">
            <div>
              {title && (
                <h3 id="modal-title" className="font-extrabold text-sm sm:text-base leading-tight">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-slate-400 text-[10px] sm:text-xs mt-0.5 font-medium truncate max-w-xs sm:max-w-md">
                  {subtitle}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer text-slate-400 hover:text-white"
              aria-label="Close modal"
              title="Close (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Modal Body Container */}
        <div className={`flex-1 overflow-y-auto p-4 sm:p-6 text-slate-800 dark:text-slate-200 ${bodyClassName}`}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-9 h-9 text-[#2E5BFF] animate-spin" />
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Loading details...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8 px-4 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-100 dark:border-rose-900/50 max-w-md mx-auto space-y-3">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
              <h4 className="font-bold text-slate-800 dark:text-white text-sm">Unable to Load Details</h4>
              <p className="text-xs text-rose-600 dark:text-rose-400 leading-relaxed">{error}</p>
              <div className="flex items-center justify-center gap-2 pt-2">
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="px-4 py-2 bg-[#2E5BFF] hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Retry
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-300 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            children
          )}
        </div>

        {/* Sticky Footer Action Bar */}
        {footer && !loading && (
          <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
