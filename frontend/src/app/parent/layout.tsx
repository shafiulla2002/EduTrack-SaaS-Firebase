'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ParentProvider, useParent } from './ParentContext';
import { useTenant } from '../providers/TenantContext';
import { useTheme } from '../providers/ThemeContext';
import ToastProvider from '@/components/Toast';
import { api, clearStoredAuth } from '@/lib/api';
import {
  Home,
  User,
  BookOpen,
  CreditCard,
  Bell,
  Calendar,
  MessageSquare,
  FileText,
  AlertTriangle,
  Bus,
  LogOut,
  ChevronDown,
  GraduationCap
} from 'lucide-react';

function ParentLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { logoUrl, schoolName, schoolType, subscription } = useTenant();
  const { children: childrenList, selectedChild, setSelectedChildId } = useParent();
  const [showSwitcher, setShowSwitcher] = useState(false);

  const isSubscriptionBlocked = subscription && (
    subscription.status === 'EXPIRED' ||
    subscription.status === 'CANCELLED' ||
    new Date(subscription.expiryDate).getTime() + (3 * 24 * 60 * 60 * 1000) < Date.now()
  );

  const handleLogout = () => {
    clearStoredAuth();
    window.location.href = '/auth/login';
  };

  if (isSubscriptionBlocked) {
    return (
      <div className="fixed inset-0 bg-[#0F172A] flex flex-col items-center justify-center text-white z-[99999] px-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-500">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-100 font-sans tracking-wide">Portal Suspended</h2>
          <p className="text-sm text-slate-400 mt-3 leading-relaxed">
            Your school's EduTrack subscription has expired. Access to the Parent Portal has been temporarily suspended. Please contact the school administration for support.
          </p>
          <button
            onClick={handleLogout}
            className="mt-8 w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-2xl transition-all shadow-lg cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>
    );
  }

  const isPrintReceiptPage = pathname?.includes('/parent/fees/receipts/');
  if (isPrintReceiptPage) {
    return <div className="bg-white min-h-screen text-slate-800 font-sans">{children}</div>;
  }

  const navigationItems = [
    { name: 'Dashboard', href: '/parent', icon: Home, isBottom: true },
    { name: 'Student Profile', href: '/parent/profile', icon: User, isBottom: true },
    { name: 'Homework', href: '/parent/homework', icon: BookOpen, isBottom: true },
    { name: 'Fees & Invoices', href: '/parent/fees', icon: CreditCard, isBottom: true },
    { name: 'Announcements', href: '/parent/announcements', icon: Bell, isBottom: true },
    { name: 'Exams & Marks', href: '/parent/exams', icon: GraduationCap, isBottom: false },
    { name: 'Calendar & Schedule', href: '/parent/calendar', icon: Calendar, isBottom: false },
    { name: 'Messages & Chat', href: '/parent/chat', icon: MessageSquare, isBottom: false },
    { name: 'Leave Application', href: '/parent/leave', icon: FileText, isBottom: false },
    { name: 'Complaint Box', href: '/parent/complaints', icon: AlertTriangle, isBottom: false },
    { name: 'Transport Tracker', href: '/parent/transport', icon: Bus, isBottom: false },
  ];



  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans select-none overflow-x-hidden relative pb-16 lg:pb-0">
      {/* Header */}
      <header className="h-[72px] bg-white border-b border-slate-200 sticky top-0 z-40 flex items-center justify-between px-4 lg:px-8 shrink-0 shadow-sm">
        {/* Left End: Static Parent branding on desktop, School branding on mobile */}
        <div className="flex items-center gap-2.5">
          {/* Desktop static Parent Portal Brand */}
          <div className="hidden md:flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/10">
              <span className="font-extrabold text-white text-base tracking-tight">ET</span>
            </div>
            <div className="text-left">
              <h1 className="font-extrabold text-xs text-indigo-900 uppercase tracking-wider leading-none">EduTrack</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Parent Portal</p>
            </div>
          </div>

          {/* Mobile dynamic School Brand */}
          <div className="flex md:hidden items-center gap-2">
            <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0 overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt={schoolName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-xs">
                  <svg className="w-4 h-4 stroke-white fill-none" viewBox="0 0 24 24">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" strokeWidth="2"></path>
                    <path d="M6 12v5c3 3 9 3 12 0v-5" strokeWidth="2"></path>
                  </svg>
                </div>
              )}
            </div>
            <div className="text-left max-w-[130px] xs:max-w-[170px] sm:max-w-[240px]">
              <h1 className="font-extrabold text-[11px] sm:text-[13px] text-indigo-900 leading-none uppercase tracking-wide truncate">
                {schoolName || 'EduTrack'}
              </h1>
              <p className="text-[8px] text-slate-500 font-bold tracking-wider uppercase mt-0.5 truncate">
                Parent Portal
              </p>
            </div>
          </div>
        </div>

        {/* Center: Dynamic School branding (Desktop/Tablet only) */}
        <div className="hidden md:flex items-center gap-2.5 px-4 text-center">
          <div className="w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0 overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt={schoolName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-500/10">
                <svg className="w-5 h-5 stroke-white fill-none" viewBox="0 0 24 24">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" strokeWidth="2"></path>
                  <path d="M6 12v5c3 3 9 3 12 0v-5" strokeWidth="2"></path>
                </svg>
              </div>
            )}
          </div>
          <div className="text-left max-w-[200px] lg:max-w-[350px] xl:max-w-[450px]">
            <h1 className="font-extrabold text-[12px] sm:text-[14px] text-indigo-900 leading-none uppercase tracking-wide truncate">
              {schoolName || 'EduTrack'}
            </h1>
            <p className="text-[9px] text-slate-500 font-bold tracking-wider uppercase mt-0.5 truncate">
              Parent Portal {schoolName ? '• ' + (schoolType || 'Powered by Covenant Synergy') : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Child Switcher Dropdown */}
          {selectedChild && (
            <div className="relative">
              <button
                onClick={() => setShowSwitcher(!showSwitcher)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 hover:text-[#2E5BFF] hover:border-blue-300 hover:bg-blue-50/20 transition-all cursor-pointer min-h-[36px]"
              >
                {selectedChild.avatarUrl ? (
                  <img
                    src={selectedChild.avatarUrl}
                    alt={selectedChild.name}
                    className="w-5 h-5 rounded-full object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 text-white flex items-center justify-center font-bold text-[10px]">
                    {selectedChild.name[0]}
                  </div>
                )}
                <span className="max-w-[80px] sm:max-w-[120px] truncate">{selectedChild.name}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${showSwitcher ? 'rotate-180' : ''}`} />
              </button>

              {showSwitcher && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSwitcher(false)} />
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-50 animate-fade-in space-y-1">
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-3 py-1.5">
                      Switch Student
                    </div>
                    {childrenList.map((child) => (
                      <button
                        key={child.id}
                        onClick={() => {
                          setSelectedChildId(child.id);
                          setShowSwitcher(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all ${
                          child.id === selectedChild.id
                            ? 'bg-blue-50 border border-blue-100 text-[#2E5BFF]'
                            : 'border border-transparent hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {child.avatarUrl ? (
                          <img
                            src={child.avatarUrl}
                            alt={child.name}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
                            {child.name[0]}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{child.name}</p>
                          <p className="text-[10px] text-slate-500 font-light truncate">
                            {child.class} - {child.section}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Parent Notification Bell */}
          <ParentNotificationBell />

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center border border-slate-200 dark:border-slate-700"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >

            {theme === 'dark' ? (
              <svg className="w-4 h-4 stroke-current fill-none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="5" strokeWidth="2"></circle>
                <line x1="12" y1="1" x2="12" y2="3" strokeWidth="2" strokeLinecap="round"></line>
                <line x1="12" y1="21" x2="12" y2="23" strokeWidth="2" strokeLinecap="round"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" strokeWidth="2" strokeLinecap="round"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" strokeWidth="2" strokeLinecap="round"></line>
                <line x1="1" y1="12" x2="3" y2="12" strokeWidth="2" strokeLinecap="round"></line>
                <line x1="21" y1="12" x2="23" y2="12" strokeWidth="2" strokeLinecap="round"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" strokeWidth="2" strokeLinecap="round"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" strokeWidth="2" strokeLinecap="round"></line>
              </svg>
            ) : (
              <svg className="w-4 h-4 stroke-current fill-none" viewBox="0 0 24 24">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
            )}
          </button>

          <button
            onClick={handleLogout}
            className="hidden lg:flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-red-600 hover:bg-red-50 hover:border-red-100 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="flex-1 flex w-full relative min-w-0">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-[260px] bg-white border-r border-slate-200 h-[calc(100vh-72px)] fixed top-[72px] left-0 overflow-y-auto py-6 px-4 select-none shadow-sm z-30">
          <nav className="space-y-6">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-3">
                Core Modules
              </div>
              <div className="space-y-1.5">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-blue-50 border border-blue-100 text-[#2E5BFF] font-semibold'
                          : 'text-slate-500 hover:text-blue-600 hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <Icon className="w-4.5 h-4.5 shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>
        </aside>

        {/* Content Panel */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 bg-slate-50 lg:pl-[260px]">
          {children}
        </main>
      </div>

      {/* Sticky Bottom Navigation for Mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 h-16 flex items-center justify-around z-50 px-2 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] shrink-0">
        {navigationItems.filter(item => item.isBottom).map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1.5 text-[10px] font-bold transition-all px-2.5 py-1 ${
                isActive ? 'text-[#2E5BFF]' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.name.split(' ')[0]}</span>
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center justify-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
        >
          <LogOut className="w-5 h-5 text-red-500" />
          <span>Exit</span>
        </button>
      </div>
    </div>
  );
}

function ParentNotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/communications/user-notifications');
      setNotifications(res.data || []);
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.post(`/communications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center border border-slate-200"
        title="View Notifications"
      >
        <Bell className="w-4 h-4 text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-extrabold leading-none text-white transform translate-x-1/3 -translate-y-1/3 bg-rose-600 rounded-full shadow-xs">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-20 sm:top-auto sm:mt-2 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[9999] overflow-hidden text-slate-800 animate-in fade-in slide-in-from-top-1 max-h-[calc(100vh-90px)] sm:max-h-[80vh]">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-150 flex justify-between items-center">
            <span className="font-extrabold text-xs text-slate-700 uppercase tracking-wide">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded">
                {unreadCount} Unread
              </span>
            )}
          </div>
          
          <div className="overflow-y-auto divide-y divide-slate-100 max-h-[calc(100vh-160px)] sm:max-h-80">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-400 font-medium">
                No notifications yet.
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={async () => {
                    if (!n.isRead) {
                      await handleMarkAsRead(n.id);
                    }
                    setIsOpen(false);
                    if (n.type === 'LEAVE_APPROVAL') {
                      window.location.href = '/parent/leave';
                    } else if (n.type === 'COMPLAINT_UPDATE') {
                      window.location.href = '/parent/complaints';
                    } else {
                      window.location.href = '/parent/announcements';
                    }
                  }}
                  className={`p-3.5 hover:bg-slate-50 cursor-pointer text-xs transition-colors flex flex-col gap-1 ${
                    !n.isRead ? 'bg-blue-50/20 font-semibold' : ''
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className={`text-slate-800 font-bold ${!n.isRead ? 'text-blue-700' : ''}`}>
                      {n.title}
                    </span>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-slate-500 font-normal leading-relaxed whitespace-pre-wrap">
                    {n.message}
                  </p>
                  <span className="text-[9px] text-slate-400 mt-1 font-mono">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ParentProvider>
        <ParentLayoutContent>{children}</ParentLayoutContent>
      </ParentProvider>
    </ToastProvider>
  );
}

