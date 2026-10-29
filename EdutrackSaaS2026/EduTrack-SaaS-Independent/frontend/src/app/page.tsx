'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, BookOpen, GraduationCap, Users, ArrowRight } from 'lucide-react';
import ContactSupportModal from '@/components/ContactSupportModal';
import { getStoredToken, getActiveRole } from '@/lib/api';
import SuperAdminPortalPage from './dashboard/backup-super-admin/page';

export default function LandingPage() {
  const router = useRouter();
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [isResumingSession, setIsResumingSession] = useState(true);
  const [isSuperAdminHost, setIsSuperAdminHost] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const hostname = window.location.hostname.toLowerCase();
      const search = window.location.search.toLowerCase();
      // If deployed at edutrack-superadmin.vercel.app or contains 'superadmin' in domain
      if (
        hostname.includes('superadmin') ||
        hostname.includes('super-admin') ||
        search.includes('superadmin') ||
        search.includes('portal=superadmin')
      ) {
        setIsSuperAdminHost(true);
        setIsResumingSession(false);
        return;
      }

      const token = getStoredToken();
      if (token) {
        const role = getActiveRole();
        if (role === 'PARENT') {
          router.replace('/parent');
          return;
        } else if (role === 'DRIVER') {
          router.replace('/driver');
          return;
        } else {
          router.replace('/dashboard');
          return;
        }
      }
    } catch {}
    setIsResumingSession(false);
  }, [router]);

  if (isSuperAdminHost) {
    return <SuperAdminPortalPage />;
  }

  if (isResumingSession) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center">
        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
          <img 
            src="/cs-edutrack-logo.jpg" 
            alt="CS EduTrack Logo" 
            className="h-16 w-auto object-contain rounded-2xl shadow-xl shadow-indigo-500/10" 
          />
          <div className="w-8 h-8 border-3 border-t-brand-400 border-r-indigo-400 border-slate-700 rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-medium tracking-wide">Resuming CS EduTrack session...</p>
        </div>
      </main>
    );
  }

  const roles = [
    {
      title: 'School Administrator',
      description: 'Manage admissions, billing, accounts, and overall school operations.',
      icon: Shield,
      color: 'from-purple-500 to-indigo-500',
      portal: 'admin',
    },
    {
      title: 'Teacher Portal',
      description: 'Take attendance, input marks, manage schedules, and coordinate timetables.',
      icon: BookOpen,
      color: 'from-blue-500 to-cyan-500',
      portal: 'teacher',
    },
    {
      title: 'Student Desk',
      description: 'Check class schedules, exam reports, attendance, and library books.',
      icon: GraduationCap,
      color: 'from-emerald-500 to-teal-500',
      portal: 'student',
    },
    {
      title: 'Parent Portal',
      description: 'Track your child\'s grades, review fee statements, and pay invoices.',
      icon: Users,
      color: 'from-amber-500 to-orange-500',
      portal: 'parent',
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between overflow-x-hidden relative">
      {/* Dynamic Background Blobs bounded within container to prevent scroll stretching */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-brand-500/10 blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-[120px]" />
      </div>

      {/* Header with Safe Area Inset Support */}
      <header 
        className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-3 sm:py-6 flex justify-between items-center z-10 box-border gap-2.5 sm:gap-4"
        style={{
          paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))',
          paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
        }}
      >
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <img 
            src="/cs-edutrack-logo.jpg" 
            alt="CS EduTrack Logo" 
            className="h-9 sm:h-12 w-auto object-contain rounded-xl shadow-md shrink-0" 
          />
          <div className="flex flex-col text-left min-w-0">
            <span className="font-extrabold text-sm sm:text-lg text-white tracking-tight leading-snug truncate">
              CS EduTrack
            </span>
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium leading-tight truncate">
              by Covenant Synergy Private Limited
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/super-admin"
            className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold bg-brand-600/20 hover:bg-brand-600/30 text-brand-300 border border-brand-500/30 transition-all cursor-pointer shrink-0 whitespace-nowrap active:scale-95 flex items-center gap-1.5"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Super Admin</span>
          </Link>
          <button
            onClick={() => setSupportModalOpen(true)}
            className="px-3 py-1.5 sm:px-5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold glass-panel text-slate-300 hover:text-white transition-all cursor-pointer shrink-0 whitespace-nowrap active:scale-95"
          >
            Contact Support
          </button>
        </div>
      </header>

      {/* Main Content */}
      <section className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 flex flex-col justify-center items-center text-center py-4 sm:py-12 z-10 w-full box-border">
        <div className="max-w-3xl">
          <h1 className="text-2xl sm:text-5xl md:text-7xl font-extrabold tracking-tight mb-2 sm:mb-6">
            School Management{' '}
            <span className="bg-gradient-to-r from-brand-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Redefined.
            </span>
          </h1>
          <p className="text-slate-400 text-xs sm:text-lg md:text-xl mb-4 sm:mb-10 max-w-2xl mx-auto font-light leading-relaxed px-1 sm:px-0">
            Welcome to CS EduTrack. Log in to access your role-based portal, manage academic schedules, track attendance, and process scholastic reports.
          </p>
        </div>

        {/* Roles Grid */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-6 w-full max-w-4xl mt-1 sm:mt-4">
          {roles.map((role, idx) => {
            const Icon = role.icon;
            return (
              <Link
                key={idx}
                href={`/auth/login?portal=${role.portal}`}
                className="glass-card p-3 sm:p-6 rounded-2xl text-left flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-5 cursor-pointer relative group h-full justify-between min-w-0"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-5 w-full min-w-0">
                  <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-tr ${role.color} flex items-center justify-center text-white shrink-0 shadow-md group-hover:scale-105 transition-transform`}>
                    <Icon className="w-4.5 h-4.5 sm:w-6 sm:h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-xs sm:text-lg text-slate-200 group-hover:text-white transition-colors flex items-center gap-1 leading-tight">
                      <span className="truncate">{role.title}</span>
                      <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all shrink-0 hidden sm:inline-block" />
                    </h3>
                    <p className="text-slate-400 text-[11px] sm:text-sm mt-1 font-light leading-snug line-clamp-3 sm:line-clamp-none">
                      {role.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Super Admin Control Center Access Card */}
        <div className="w-full max-w-4xl mt-4">
          <Link
            href="/dashboard/super-admin"
            className="glass-card p-4 sm:p-5 rounded-2xl border border-brand-500/30 bg-brand-950/20 hover:bg-brand-900/30 text-left flex flex-col sm:flex-row items-center justify-between gap-4 transition-all group shadow-xl"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-brand-500/30">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm sm:text-base text-white group-hover:text-brand-300 transition-colors">
                    EduTrack SaaS Master Super Admin Control Center
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/40">
                    Live Firestore
                  </span>
                </div>
                <p className="text-slate-400 text-xs mt-0.5">
                  Review pending school registration approvals, manage tenant subscriptions, and track platform metrics.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-300 group-hover:translate-x-1 transition-transform shrink-0">
              <span>Open Master Portal</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer 
        className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 border-t border-slate-900/50 z-10 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 text-slate-500 text-[11px] sm:text-xs font-light text-center sm:text-left box-border"
        style={{
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
          paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
        }}
      >
        <p>
          &copy; {new Date().getFullYear()} Covenant Synergy Private Limited. All rights reserved.
        </p>
        <div className="flex items-center gap-4">
          <span className="font-semibold text-slate-300">CS EduTrack</span>
          <span>•</span>
          <Link href="/privacy-policy" className="text-brand-400 hover:text-brand-300 transition-colors underline">
            Privacy Policy
          </Link>
        </div>
      </footer>

      {supportModalOpen && (
        <ContactSupportModal onClose={() => setSupportModalOpen(false)} />
      )}
    </main>
  );
}

