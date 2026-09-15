'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  closeOnOverlay?: boolean;
  closeOnEscape?: boolean;
  children: React.ReactNode;
}

// Global scroll lock tracking variables
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

    // Prevent layout shift by adding padding equal to the scrollbar width
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

export default function Drawer({
  open,
  onClose,
  title,
  subtitle,
  size = 'md',
  closeOnOverlay = true,
  closeOnEscape = true,
  children,
}: DrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [animate, setAnimate] = useState(false);

  const drawerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Mount logic with delay for slide animations
  useEffect(() => {
    if (open) {
      setMounted(true);
      const timer = setTimeout(() => setAnimate(true), 10);
      return () => clearTimeout(timer);
    } else {
      setAnimate(false);
      const timer = setTimeout(() => setMounted(false), 300); // Wait for exit animation
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Lock body scroll on active mount
  useEffect(() => {
    if (open) {
      lockScroll();
      return () => {
        unlockScroll();
      };
    }
  }, [open]);

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        onClose();
      }
    };

    if (open) {
      window.addEventListener('keydown', handleEscape);
    }
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open, closeOnEscape, onClose]);

  // Focus trapping and management
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      
      const timer = setTimeout(() => {
        if (drawerRef.current) {
          const focusable = getFocusableElements(drawerRef.current);
          if (focusable.length > 0) {
            focusable[0].focus();
          } else {
            drawerRef.current.focus();
          }
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (!open && previousFocusRef.current) {
      const timer = setTimeout(() => {
        previousFocusRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab' && drawerRef.current) {
      const focusable = getFocusableElements(drawerRef.current);
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

  // Map size classes
  const sizeClasses = {
    sm: 'w-full sm:w-[80vw] md:max-w-sm',
    md: 'w-full sm:w-[80vw] md:max-w-md',
    lg: 'w-full sm:w-[80vw] md:max-w-lg',
    xl: 'w-full sm:w-[80vw] md:max-w-xl',
    '2xl': 'w-full sm:w-[80vw] md:max-w-2xl',
    full: 'w-screen',
  };

  const content = (
    <div
      className={`fixed inset-0 flex justify-end z-[9998] transition-opacity duration-300 ease-in-out ${
        animate ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}
      onKeyDown={handleKeyDown}
    >
      {/* Overlay Backdrop - Click to Close */}
      <div
        className="absolute inset-0 cursor-default"
        onClick={() => {
          if (closeOnOverlay) onClose();
        }}
      />

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        tabIndex={-1}
        className={`w-full h-full bg-white dark:bg-slate-800 flex flex-col shadow-2xl relative overflow-hidden z-[9999] transform transition-transform duration-300 ease-in-out outline-none ${
          sizeClasses[size]
        } ${animate ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Render header only if title is provided */}
        {title && (
          <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900 shrink-0 select-none">
            <div>
              <h3 className="font-black text-slate-900 dark:text-slate-100 text-lg leading-none">{title}</h3>
              {subtitle && (
                <p className="text-xs font-semibold text-[#2E5BFF] dark:text-blue-400 mt-1.5">{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </button>
          </div>
        )}

        {/* Drawer Inner Content */}
        {children}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
