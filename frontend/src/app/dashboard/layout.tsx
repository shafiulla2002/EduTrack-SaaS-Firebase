'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTenant } from '../providers/TenantContext';
import { useTheme } from '../providers/ThemeContext';
import ToastProvider from '@/components/Toast';
import { clearStoredAuth, api } from '@/lib/api';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { schoolName, schoolType, adminName, logoUrl, currentUser, loading } = useTenant();

  const [unreadAnnCount, setUnreadAnnCount] = useState(0);

  const fetchUnreadAnnouncements = async () => {
    if (currentUser?.role !== 'TEACHER') return;
    try {
      const res = await api.get('/teacher-portal/announcements');
      const list = res.data || [];
      const unread = list.filter((ann: any) => {
        const readStatus = Array.isArray(ann.readStatus) ? ann.readStatus : [];
        return !readStatus.includes(currentUser.id);
      }).length;
      setUnreadAnnCount(unread);
    } catch (err) {
      console.error('Failed to fetch announcements:', err);
    }
  };

  useEffect(() => {
    fetchUnreadAnnouncements();
    const interval = setInterval(fetchUnreadAnnouncements, 15000);
    return () => clearInterval(interval);
  }, [currentUser?.id]);

  useEffect(() => {
    window.addEventListener('announcementRead', fetchUnreadAnnouncements);
    return () => window.removeEventListener('announcementRead', fetchUnreadAnnouncements);
  }, [currentUser?.id]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0F172A] flex flex-col items-center justify-center text-white z-[99999]">
        <div className="flex flex-col items-center gap-6 animate-pulse">
          <div className="w-14 h-14 border-4 border-t-[#2E5BFF] border-r-indigo-500 border-b-purple-500 border-l-slate-800 rounded-full animate-spin"></div>
          <div className="text-center mt-2">
            <h2 className="text-sm font-bold tracking-widest text-slate-100 uppercase font-sans">EduTrack SaaS Platform</h2>
            <p className="text-[11px] text-slate-400 font-semibold mt-1">Securing tenant environment & credentials...</p>
          </div>
        </div>
      </div>
    );
  }

  // Categories as defined in eduProDashboard.html
  const adminNavSections = [
    {
      title: 'Main',
      items: [
        {
          name: 'Dashboard',
          href: '/dashboard',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
          ),
        },
        {
          name: 'Students',
          href: '/dashboard/students',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          ),
        },
        {
          name: 'School Staff',
          href: '/dashboard/staff',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <polyline points="17 11 19 13 23 9"></polyline>
            </svg>
          ),
        },
        {
          name: 'Teacher & Class Management',
          href: '/dashboard/teachers',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
              <path d="M9 22v-4h6v4"></path>
              <path d="M8 6h.01"></path>
              <path d="M16 6h.01"></path>
              <path d="M8 10h.01"></path>
              <path d="M16 10h.01"></path>
              <path d="M8 14h.01"></path>
              <path d="M16 14h.01"></path>
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Admissions',
      items: [
        {
          name: 'New Admission',
          href: '/dashboard/admissions',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <line x1="20" y1="8" x2="20" y2="14"></line>
              <line x1="17" y1="11" x2="23" y2="11"></line>
            </svg>
          ),
        },
        {
          name: 'Promote Students',
          href: '/dashboard/promotions',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
              <polyline points="17 6 23 6 23 12"></polyline>
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Financials',
      items: [
        {
          name: 'Fee Management',
          href: '/dashboard/billing',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
              <line x1="1" y1="10" x2="23" y2="10"></line>
            </svg>
          ),
        },
        {
          name: 'Expense Management',
          href: '/dashboard/expenses',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z"></path>
              <path d="M16 8h-6"></path>
              <path d="M16 12H8"></path>
              <path d="M16 16H8"></path>
            </svg>
          ),
        },
        {
          name: 'Fee Setup / Price Book',
          href: '/dashboard/billing/setup',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path>
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Academics',
      items: [
        {
          name: 'Grades & Marks',
          href: '/dashboard/grades',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="7"></circle>
              <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
            </svg>
          ),
        },
        {
          name: 'Enter Marks',
          href: '/dashboard/exams',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          ),
        },
        {
          name: 'Attendance',
          href: '/attendance/dashboard',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          ),
        },
        {
          name: 'Exam Schedule',
          href: '/dashboard/exams/schedule',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          ),
        },
        {
          name: 'Leave Requests',
          href: '/dashboard/leave-mgmt',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2"></line>
              <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2"></line>
              <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2"></line>
            </svg>
          ),
        },
        {
          name: 'Announcements',
          href: '/dashboard/announcements-mgmt',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          ),
        },
        {
          name: 'Complaint Box',
          href: '/complaint-box',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline>
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
            </svg>
          ),
        },
        {
          name: 'Transport Tracking',
          href: '/dashboard/transport',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="3" width="22" height="13" rx="2" ry="2"></rect>
              <line x1="16" y1="8" x2="20" y2="8"></line>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
          ),
        },
        {
          name: 'School Setup',
          href: '/dashboard/settings',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          ),
        },
      ],
    },
  ];

  const teacherNavSections = [
    {
      title: 'Portal',
      items: [
        {
          name: 'Dashboard',
          href: '/dashboard',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
          ),
        },
        {
          name: 'My Classes',
          href: '/dashboard/my-classes',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          ),
        },
        {
          name: 'Attendance',
          href: '/dashboard/attendance-mgmt',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          ),
        },
        {
          name: 'Enter Marks',
          href: '/dashboard/marks-mgmt',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          ),
        },
        {
          name: 'Timetable',
          href: '/dashboard/my-timetable',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
              <path d="M9 22v-4h6v4"></path>
            </svg>
          ),
        },
        {
          name: 'Homework',
          href: '/dashboard/homework',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
          ),
        },
        {
          name: 'Announcements',
          href: '/dashboard/announcements-mgmt',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          ),
        },
        {
          name: 'Student Progress',
          href: '/dashboard/student-progress',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
              <polyline points="17 6 23 6 23 12"></polyline>
            </svg>
          ),
        },
        {
          name: 'Leave Request',
          href: '/dashboard/leave-mgmt',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          ),
        },
        {
          name: 'Complaint Box',
          href: '/dashboard/complaints',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline>
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
            </svg>
          ),
        },
        {
          name: 'Calendar',
          href: '/dashboard/calendar',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          ),
        },
        {
          name: 'Reports',
          href: '/dashboard/reports-mgmt',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
              <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
            </svg>
          ),
        },
        {
          name: 'My Profile',
          href: '/dashboard/profile',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          ),
        },
        {
          name: 'Salary & Payslips',
          href: '/dashboard/salary',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <line x1="12" y1="10" x2="12" y2="10" />
              <line x1="12" y1="14" x2="12" y2="14" />
              <path d="M16 10h-2v4h2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 10h2v4H8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ),
        },
      ],
    },
  ];

  const driverNavSections = [
    {
      title: 'Transport Duty',
      items: [
        {
          name: 'Transport Tracker',
          href: '/dashboard/transport-tracker',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="3" width="22" height="13" rx="2" ry="2"></rect>
              <line x1="16" y1="8" x2="20" y2="8"></line>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
          ),
        },
        {
          name: 'My Profile',
          href: '/dashboard/profile',
          svg: (
            <svg className="icon-svg" viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          ),
        },
      ],
    },
  ];

  const isDriver = currentUser?.role === 'DRIVER' || currentUser?.staffProfile?.staffRole === 'Driver' || currentUser?.staffProfile?.designation?.toLowerCase().includes('driver');

  const navSections = isDriver
    ? driverNavSections
    : (currentUser?.role === 'TEACHER' ? teacherNavSections : adminNavSections);

  return (
    <ToastProvider>
    <div className="min-h-screen bg-slate-50 text-slate-800 flex font-sans overflow-x-hidden">
      {/* Sidebar - Fix position matching .sidebar in LWC CSS */}
      <aside className="hidden lg:block w-[280px] bg-white border-r border-slate-200 h-screen fixed top-0 left-0 overflow-y-auto z-50 py-6 select-none shadow-sm print:hidden">
        {/* Sidebar Nav section blocks */}
        <nav className="space-y-6 px-4">
          {navSections.map((section) => (
            <div key={section.title}>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] font-medium transition-all min-h-[44px] ${
                        isActive
                          ? 'bg-blue-50 text-[#2E5BFF] font-semibold'
                          : 'text-slate-500 hover:text-blue-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="shrink-0 w-5 h-5 flex items-center justify-center">
                        {item.svg}
                      </span>
                      <span className="truncate">{item.name}</span>
                      {item.name === 'Announcements' && currentUser?.role === 'TEACHER' && unreadAnnCount > 0 && (
                        <span className="ml-auto bg-rose-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full">
                          {unreadAnnCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main panel viewport - Match margin-left from LWC sidebar */}
      <div className="flex-1 flex flex-col min-h-screen lg:pl-[280px] print:pl-0 w-full min-w-0">
        {/* Top bar matching top-bar of LWC */}
        <header className="h-[72px] bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-40 shadow-sm print:hidden">
          <div className="flex items-center gap-3">
            {/* Mobile Menu trigger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
              aria-label="Open navigation menu"
            >
              <svg className="w-6 h-6 stroke-slate-700 dark:stroke-slate-300" viewBox="0 0 24 24" fill="none">
                <line x1="3" y1="12" x2="21" y2="12" strokeWidth="2" strokeLinecap="round" />
                <line x1="3" y1="6" x2="21" y2="6" strokeWidth="2" strokeLinecap="round" />
                <line x1="3" y1="18" x2="21" y2="18" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            {/* Mobile Logo & School Name */}
            <div className="flex lg:hidden items-center gap-2">
              <div className="w-[42px] h-[42px] bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200 shrink-0 overflow-hidden">
                {logoUrl ? (
                  <img src={logoUrl} alt={schoolName} className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-[24px] h-[24px] stroke-[#2E5BFF] fill-none" viewBox="0 0 24 24">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" strokeWidth="2"></path>
                    <path d="M6 12v5c3 3 9 3 12 0v-5" strokeWidth="2"></path>
                  </svg>
                )}
              </div>
              <h1 className="font-extrabold text-[12px] sm:text-[14px] text-indigo-900 leading-none uppercase tracking-wide truncate max-w-[120px] sm:max-w-none">
                {schoolName}
              </h1>
            </div>

            {/* Salesforce search box style - Desktop only */}
            <div className="hidden lg:flex relative items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 w-[240px] xl:w-[320px] focus-within:border-[#2E5BFF] focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all">
              <svg className="w-4 h-4 stroke-slate-400 fill-none mr-2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" strokeWidth="2"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2"></line>
              </svg>
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none text-[13px] font-medium text-slate-800 outline-none w-full placeholder-slate-400"
              />
              <span className="text-[10px] text-slate-400 select-none ml-2">⌘K</span>
            </div>
          </div>

          {/* Center: logo and school name (Desktop/Tablet only) */}
          <div className="hidden lg:flex items-center gap-2 px-4 text-center">
            <div className="w-[52px] h-[52px] bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200 shrink-0 overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt={schoolName} className="w-full h-full object-cover" />
              ) : (
                <svg className="w-[30px] h-[30px] stroke-[#2E5BFF] fill-none" viewBox="0 0 24 24">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" strokeWidth="2"></path>
                  <path d="M6 12v5c3 3 9 3 12 0v-5" strokeWidth="2"></path>
                </svg>
              )}
            </div>
            <div className="text-left">
              <h1 className="font-extrabold text-[14px] text-indigo-900 leading-none uppercase tracking-wide">
                {schoolName}
              </h1>
              <p className="text-[9px] text-slate-400 font-bold tracking-wider uppercase mt-0.5">
                {schoolType || 'Building Excellence for Futures'}
              </p>
            </div>
          </div>

          {/* User Profile widget */}
          <div className="flex items-center gap-4">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center border border-slate-200 dark:border-slate-700"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <svg className="w-5 h-5 stroke-current fill-none" viewBox="0 0 24 24">
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
                <svg className="w-5 h-5 stroke-current fill-none" viewBox="0 0 24 24">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
              )}
            </button>
            {/* Notification Bell Dropdown */}
            <NotificationBell />
            <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-xl hover:bg-slate-50 cursor-pointer min-h-[44px]">
              <div className="text-right hidden sm:block">
                <p className="text-[13px] font-semibold text-slate-800 leading-none">{currentUser?.name || adminName}</p>
                <p className="text-[11px] text-slate-400 font-medium mt-1">{currentUser?.role === 'SCHOOL_ADMIN' ? 'Admin' : (currentUser?.role || 'User')}</p>
              </div>
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name || adminName}
                  className="w-9 h-9 rounded-xl object-cover border border-slate-200"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-500 text-white flex items-center justify-center font-bold text-sm select-none">
                  {(currentUser?.name || adminName).split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <button
              onClick={() => {
                clearStoredAuth();
                window.location.href = '/auth/login';
              }}
              className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 text-[12px] sm:text-[13px] font-semibold text-red-600 bg-red-50/50 hover:bg-red-50 rounded-xl transition-all border border-red-100/80 min-h-[38px] cursor-pointer"
              title="Logout"
            >
              <svg className="w-4 h-4 stroke-red-600 fill-none" viewBox="0 0 24 24">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                <polyline points="16 17 21 12 16 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></polyline>
                <line x1="21" y1="12" x2="9" y2="12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></line>
              </svg>
              <span className="inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Page content panel viewport */}
        <main className={`p-4 sm:p-8 print:p-0 print:max-w-none print:m-0 flex-1 max-w-7xl w-full mx-auto min-w-0 ${
          currentUser?.role === 'TEACHER' || currentUser?.role === 'SCHOOL_ADMIN' ? 'pb-24 lg:pb-8' : ''
        }`}>
          {children}
        </main>
      </div>

      {/* Mobile Drawer Overlay Backdrop & Drawer with transitions */}
      <div
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[100] lg:hidden transition-opacity duration-300 ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileOpen(false)}
      >
        <div
          className={`w-[280px] bg-white h-full py-6 pb-24 select-none overflow-y-auto flex flex-col justify-between transition-transform duration-300 ease-in-out transform ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div>
            <div className="flex items-center gap-3 px-6 mb-6">
              <div className="w-[48px] h-[48px] bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200 shrink-0 overflow-hidden">
                {logoUrl ? (
                  <img src={logoUrl} alt={schoolName} className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-[28px] h-[28px] stroke-[#2E5BFF] fill-none" viewBox="0 0 24 24">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" strokeWidth="2"></path>
                    <path d="M6 12v5c3 3 9 3 12 0v-5" strokeWidth="2"></path>
                  </svg>
                )}
              </div>
              <div>
                <h1 className="font-extrabold text-[14px] text-indigo-900 leading-none uppercase tracking-wide">
                  {schoolName}
                </h1>
              </div>
            </div>

            {/* User Profile widget inside Drawer */}
            <div className="flex items-center gap-3 px-4 py-3 mx-4 mb-6 bg-slate-50 rounded-2xl border border-slate-100/80">
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name || adminName}
                  className="w-10 h-10 rounded-xl object-cover border border-slate-200"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-500 text-white flex items-center justify-center font-bold text-sm select-none shrink-0">
                  {(currentUser?.name || adminName).split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-slate-800 leading-tight truncate">{currentUser?.name || adminName}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                  {currentUser?.role === 'SCHOOL_ADMIN' ? 'Admin' : (currentUser?.role === 'TEACHER' ? 'Teacher' : (currentUser?.role || 'User'))}
                </p>
              </div>
            </div>

            <nav className="space-y-6 px-4">
              {navSections.map((section) => (
                <div key={section.title}>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
                    {section.title}
                  </div>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] font-medium transition-all min-h-[44px] ${
                            isActive
                              ? 'bg-blue-50 text-[#2E5BFF] font-semibold'
                              : 'text-slate-500 hover:text-blue-600 hover:bg-slate-50'
                          }`}
                        >
                          <span className="shrink-0 w-5 h-5 flex items-center justify-center">
                            {item.svg}
                          </span>
                          <span className="truncate">{item.name}</span>
                          {item.name === 'Announcements' && currentUser?.role === 'TEACHER' && unreadAnnCount > 0 && (
                            <span className="ml-auto bg-rose-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full">
                              {unreadAnnCount}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
          {/* Mobile Logout Button */}
          <div className="px-6 pt-4 pb-20 border-t border-slate-100">
            <button
              onClick={() => {
                clearStoredAuth();
                window.location.href = '/auth/login';
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-[14px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <svg className="w-5 h-5 stroke-red-600 fill-none" viewBox="0 0 24 24">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                <polyline points="16 17 21 12 16 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></polyline>
                <line x1="21" y1="12" x2="9" y2="12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></line>
              </svg>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Navigation Bar for Teachers on Mobile/Tablet */}
      {currentUser?.role === 'TEACHER' && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 h-16 flex items-center justify-around z-50 px-2 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] print:hidden">
          <Link href="/dashboard" className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${pathname === '/dashboard' ? 'text-[#2E5BFF] font-semibold' : 'text-slate-500'}`}>
            <svg className="w-5 h-5 stroke-current fill-none" viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <span>Home</span>
          </Link>
          <Link href="/dashboard/attendance-mgmt" className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${pathname.startsWith('/dashboard/attendance-mgmt') ? 'text-[#2E5BFF] font-semibold' : 'text-slate-500'}`}>
            <svg className="w-5 h-5 stroke-current fill-none" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span>Attendance</span>
          </Link>
          <Link href="/dashboard/marks-mgmt" className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${pathname.startsWith('/dashboard/marks-mgmt') ? 'text-[#2E5BFF] font-semibold' : 'text-slate-500'}`}>
            <svg className="w-5 h-5 stroke-current fill-none" viewBox="0 0 24 24">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
            <span>Marks</span>
          </Link>
          <Link href="/dashboard/my-timetable" className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${pathname.startsWith('/dashboard/my-timetable') ? 'text-[#2E5BFF] font-semibold' : 'text-slate-500'}`}>
            <svg className="w-5 h-5 stroke-current fill-none" viewBox="0 0 24 25">
              <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
              <path d="M9 22v-4h6v4"></path>
            </svg>
            <span>Timetable</span>
          </Link>
          <Link href="/dashboard/profile" className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${pathname.startsWith('/dashboard/profile') ? 'text-[#2E5BFF] font-semibold' : 'text-slate-500'}`}>
            <svg className="w-5 h-5 stroke-current fill-none" viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span>Profile</span>
          </Link>
        </div>
      )}

      {/* Sticky Bottom Navigation Bar for School Admins on Mobile/Tablet */}
      {currentUser?.role === 'SCHOOL_ADMIN' && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 h-16 flex items-center justify-around z-50 px-2 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] print:hidden">
          <Link href="/dashboard" className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${pathname === '/dashboard' ? 'text-[#2E5BFF] font-semibold' : 'text-slate-500'}`}>
            <svg className="w-5 h-5 stroke-current fill-none" viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <span>Home</span>
          </Link>
          <Link href="/dashboard/students" className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${pathname.startsWith('/dashboard/students') ? 'text-[#2E5BFF] font-semibold' : 'text-slate-500'}`}>
            <svg className="w-5 h-5 stroke-current fill-none" viewBox="0 0 24 24">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeWidth="2"></path>
              <circle cx="9" cy="7" r="4" strokeWidth="2"></circle>
            </svg>
            <span>Students</span>
          </Link>
          <Link href="/dashboard/billing" className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${pathname.startsWith('/dashboard/billing') ? 'text-[#2E5BFF] font-semibold' : 'text-slate-500'}`}>
            <svg className="w-5 h-5 stroke-current fill-none" viewBox="0 0 24 24">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" strokeWidth="2"></rect>
              <line x1="1" y1="10" x2="23" y2="10" strokeWidth="2"></line>
            </svg>
            <span>Fees</span>
          </Link>
          <Link href="/dashboard/staff" className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${pathname.startsWith('/dashboard/staff') ? 'text-[#2E5BFF] font-semibold' : 'text-slate-500'}`}>
            <svg className="w-5 h-5 stroke-current fill-none" viewBox="0 0 24 24">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeWidth="2"></path>
              <circle cx="8.5" cy="7" r="4" strokeWidth="2"></circle>
            </svg>
            <span>Staff</span>
          </Link>
          <button onClick={() => setMobileOpen(true)} className="flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors text-slate-500 cursor-pointer">
            <svg className="w-5 h-5 stroke-current fill-none" viewBox="0 0 24 24">
              <line x1="3" y1="12" x2="21" y2="12" strokeWidth="2" strokeLinecap="round" />
              <line x1="3" y1="6" x2="21" y2="6" strokeWidth="2" strokeLinecap="round" />
              <line x1="3" y1="18" x2="21" y2="18" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>Menu</span>
          </button>
        </div>
      )}
    </div>
    </ToastProvider>
  );
}
function parseLeaveRequestMessage(message: string) {
  let leaveType = '';
  let fromDate = '';
  let toDate = '';
  let reason = '';
  let leaveRequestId = '';

  if (!message) return { leaveType, fromDate, toDate, reason, leaveRequestId };

  const idMatch = message.match(/LeaveRequestId:\s*([a-zA-Z0-9\-]+)/i);
  if (idMatch) leaveRequestId = idMatch[1].trim();

  const typeMatch = message.match(/Type:\s*(.*?)(?=\s+From:|\n|$)/i);
  if (typeMatch) leaveType = typeMatch[1].trim();

  const fromMatch = message.match(/From:\s*([^\s\n]+)/i);
  if (fromMatch) fromDate = fromMatch[1].trim().split('T')[0];

  const toMatch = message.match(/To:\s*([^\s\n]+)/i);
  if (toMatch) toDate = toMatch[1].trim().split('T')[0];

  const reasonMatch = message.match(/Reason:\s*(.*?)(?=\s*LeaveRequestId:|\n|$)/i);
  if (reasonMatch) reason = reasonMatch[1].trim();

  // Fallback for line by line parsing if regex produced empty fields
  if (!leaveRequestId || !leaveType) {
    const lines = message.split('\n');
    lines.forEach(line => {
      if (line.includes('LeaveRequestId:')) leaveRequestId = line.split('LeaveRequestId:')[1].trim();
      if (line.includes('Type:')) leaveType = line.split('Type:')[1].trim();
      if (line.includes('From:')) fromDate = line.split('From:')[1].trim().split('T')[0];
      if (line.includes('To:')) toDate = line.split('To:')[1].trim().split('T')[0];
      if (line.includes('Reason:')) reason = line.split('Reason:')[1].trim();
    });
  }

  return { leaveType, fromDate, toDate, reason, leaveRequestId };
}

function parseComplaintMessage(message: string) {
  let complaintId = '';
  let parentName = '';
  let title = '';
  let category = '';

  if (!message) return { complaintId, parentName, title, category };

  const idMatch = message.match(/ComplaintId:\s*([a-zA-Z0-9\-]+)/i);
  if (idMatch) complaintId = idMatch[1].trim();

  const parentMatch = message.match(/Parent\s+(.*?)\s+submitted/i);
  if (parentMatch) parentName = parentMatch[1].trim();

  const categoryMatch = message.match(/\(Category:\s*(.*?)\)/i);
  if (categoryMatch) category = categoryMatch[1].trim();

  const titleMatch = message.match(/complaint:\s*["']?(.*?)["']?\s*\(/i) || message.match(/submitted a complaint:\s*["']?(.*?)["']?/i);
  if (titleMatch) title = titleMatch[1].trim();

  return { complaintId, parentName, title, category };
}

function NotificationComplaintItem({ notification, details, onRead, onRefresh, onDelete }: { notification: any, details: any, onRead: () => void, onRefresh: () => void, onDelete: (id: string) => void }) {
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAction = async (status: 'IN_PROGRESS' | 'RESOLVED', defaultReply: string) => {
    if (!details.complaintId) return;
    loading; // suppress unused check
    setLoading(true);
    try {
      await api.patch(`/complaint-box/parent-complaints/${details.complaintId}/status`, {
        status,
        adminReply: reply || defaultReply,
      });
      await onRead();
      await onRefresh();
    } catch (err) {
      console.error('Failed to update complaint status:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`p-4 hover:bg-slate-50 transition-colors flex flex-col gap-2 ${!notification.isRead ? 'bg-amber-50/20 font-semibold' : ''}`}>
      <div className="flex justify-between items-start gap-2">
        <span className="text-slate-800 font-extrabold text-xs">
          {notification.title}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {!notification.isRead && (
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(notification.id);
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Delete notification"
          >
            <svg className="w-3.5 h-3.5 stroke-current fill-none" viewBox="0 0 24 24">
              <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
            </svg>
          </button>
        </div>
      </div>

      <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 space-y-1 text-[11px] font-medium text-slate-600">
        {details.parentName && <div><strong className="text-slate-500 font-bold">Parent:</strong> {details.parentName}</div>}
        {details.category && <div><strong className="text-slate-500 font-bold">Category:</strong> {details.category}</div>}
        {details.title && <div><strong className="text-slate-500 font-bold">Concern:</strong> "{details.title}"</div>}
      </div>

      {!notification.isRead && details.complaintId ? (
        <div className="space-y-2 mt-1">
          <input
            type="text"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type positive response to parent..."
            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] font-normal text-slate-800 outline-none focus:border-blue-500"
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleAction('IN_PROGRESS', 'Acknowledged. We are actively investigating your concern.')}
              disabled={loading}
              className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-extrabold cursor-pointer transition-colors shadow-xs"
            >
              Acknowledge &amp; Investigate
            </button>
            <button
              onClick={() => handleAction('RESOLVED', 'Thank you for your feedback! The issue has been resolved.')}
              disabled={loading}
              className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-extrabold cursor-pointer transition-colors shadow-xs"
            >
              Resolve &amp; Send Feedback
            </button>
          </div>
        </div>
      ) : (
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mt-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
          Processed &amp; Archived
        </div>
      )}
      <span className="text-[9px] text-slate-400 font-mono mt-0.5">
        {new Date(notification.createdAt).toLocaleDateString()}
      </span>
    </div>
  );
}

function NotificationBell() {
  const { currentUser } = useTenant();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!currentUser?.id) return;
    try {
      const res = await api.get(`/communications/user/${currentUser.id}`);
      setNotifications(res.data || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [currentUser?.id]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && window.innerWidth < 640) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

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

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/communications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const handleClearRead = async () => {
    if (!currentUser?.id) return;
    try {
      await api.post(`/communications/clear-read/${currentUser.id}`);
      setNotifications(prev => prev.filter(n => !n.isRead));
    } catch (err) {
      console.error('Failed to clear read notifications:', err);
    }
  };

  const unreadCount = currentUser?.role === 'SCHOOL_ADMIN'
    ? notifications.filter(n => !n.isRead && (n.type === 'LEAVE_APPROVAL' || n.title?.toLowerCase().includes('leave') || n.message?.includes('LeaveRequestId:'))).length
    : notifications.filter(n => !n.isRead).length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center border border-slate-200"
        title="View Notifications"
      >
        <svg className="w-5 h-5 stroke-current fill-none" viewBox="0 0 24 24">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
        </svg>
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
            <div className="flex items-center gap-2">
              {notifications.some(n => n.isRead) && (
                <button
                  onClick={handleClearRead}
                  className="text-[10px] text-red-600 dark:text-red-900 hover:text-red-800 dark:hover:text-black font-bold bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded transition-colors cursor-pointer border border-red-100 dark:border-red-300"
                >
                  Clear Read
                </button>
              )}
              {unreadCount > 0 && (
                <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  {unreadCount} Unread
                </span>
              )}
            </div>
          </div>
          
          <div className="overflow-y-auto divide-y divide-slate-100 max-h-[calc(100vh-160px)] sm:max-h-80 pb-20 sm:pb-4">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-400 font-medium">
                No notifications yet.
              </div>
            ) : (
              notifications.map(n => {
                const isLeaveNotification = n.type === 'LEAVE_APPROVAL' || (n.message && n.message.includes('LeaveRequestId:')) || (n.title && n.title.toLowerCase().includes('leave application'));
                
                if (isLeaveNotification) {
                  const details = parseLeaveRequestMessage(n.message || '');
                  return (
                    <div
                      key={n.id}
                      className={`p-4 hover:bg-slate-50 transition-colors flex flex-col gap-2 ${
                        !n.isRead ? 'bg-blue-50/20 font-semibold' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-slate-800 font-extrabold text-xs">
                          {n.title}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {!n.isRead && (
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
                          )}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              handleDelete(n.id);
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Delete notification"
                          >
                            <svg className="w-3.5 h-3.5 stroke-current fill-none" viewBox="0 0 24 24">
                              <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 space-y-1 text-[11px] font-medium text-slate-600">
                        {details.leaveType && <div><strong className="text-slate-500 font-bold">Leave Type:</strong> {details.leaveType}</div>}
                        {(details.fromDate || details.toDate) && <div><strong className="text-slate-500 font-bold">Dates:</strong> {details.fromDate} to {details.toDate}</div>}
                        {details.reason && <div className="whitespace-pre-wrap"><strong className="text-slate-500 font-bold">Reason:</strong> {details.reason}</div>}
                      </div>

                      {!n.isRead && details.leaveRequestId ? (
                        <div className="flex gap-2 mt-1">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await api.patch(`/teacher-portal/leave/${details.leaveRequestId}/status`, {
                                  status: 'Approved',
                                  comments: 'Approved via Notification Center'
                                });
                                await handleMarkAsRead(n.id);
                                await fetchNotifications();
                              } catch (err) {
                                console.error('Approval failed:', err);
                              }
                            }}
                            className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
                          >
                            Approve
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await api.patch(`/teacher-portal/leave/${details.leaveRequestId}/status`, {
                                  status: 'Rejected',
                                  comments: 'Rejected via Notification Center'
                                });
                                await handleMarkAsRead(n.id);
                                await fetchNotifications();
                              } catch (err) {
                                console.error('Rejection failed:', err);
                              }
                            }}
                            className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                          Processed &amp; Archived
                        </div>
                      )}
                      <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  );
                }

                const isComplaintNotification = n.type === 'COMPLAINT_UPDATE' || (n.message && n.message.includes('ComplaintId:')) || (n.title && n.title.toLowerCase().includes('complaint'));

                if (isComplaintNotification) {
                  const details = parseComplaintMessage(n.message || '');
                  return (
                    <NotificationComplaintItem
                      key={n.id}
                      notification={n}
                      details={details}
                      onRead={() => handleMarkAsRead(n.id)}
                      onRefresh={fetchNotifications}
                      onDelete={handleDelete}
                    />
                  );
                }

                return (
                  <div
                    key={n.id}
                    onClick={async () => {
                      if (!n.isRead) {
                        await handleMarkAsRead(n.id);
                      }
                      setIsOpen(false);
                      if (n.type === 'LEAVE_APPROVAL' || n.title?.toLowerCase().includes('leave')) {
                        const details = parseLeaveRequestMessage(n.message || '');
                        if (details.leaveRequestId) {
                          window.location.href = `/dashboard/leave-mgmt?id=${details.leaveRequestId}`;
                        } else {
                          window.location.href = '/dashboard/leave-mgmt';
                        }
                      } else if (n.type === 'COMPLAINT_UPDATE' || n.title?.toLowerCase().includes('complaint')) {
                        window.location.href = '/dashboard/complaints';
                      } else {
                        window.location.href = '/dashboard/announcements-mgmt';
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
                      <div className="flex items-center gap-2 shrink-0">
                        {!n.isRead && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1" />
                        )}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            handleDelete(n.id);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Delete notification"
                        >
                          <svg className="w-3.5 h-3.5 stroke-current fill-none" viewBox="0 0 24 24">
                            <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                    <p className="text-slate-500 font-normal leading-relaxed">
                      {n.message}
                    </p>
                    <span className="text-[9px] text-slate-400 mt-1 font-mono">
                      {new Date(n.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
