'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Shield, BookOpen, GraduationCap, Users, ArrowRight } from 'lucide-react';
import ContactSupportModal from '@/components/ContactSupportModal';

export default function LandingPage() {
  const [supportModalOpen, setSupportModalOpen] = useState(false);

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
      {/* Dynamic Background Blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-brand-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-3.5 sm:py-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <img 
            src="/cs-edutrack-logo.jpg" 
            alt="CS EduTrack Logo" 
            className="h-10 sm:h-12 w-auto object-contain rounded-xl shadow-md" 
          />
          <div className="flex flex-col text-left">
            <span className="font-extrabold text-base sm:text-lg text-white tracking-tight">
              CS EduTrack
            </span>
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium">
              by Covenant Synergy Private Limited
            </span>
          </div>
        </div>

        <button
          onClick={() => setSupportModalOpen(true)}
          className="px-3.5 py-1.5 sm:px-5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold glass-panel text-slate-300 hover:text-white transition-all cursor-pointer"
        >
          Contact Support
        </button>
      </header>

      {/* Main Content */}
      <section className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 flex flex-col justify-center items-center text-center py-4 sm:py-12 z-10">
        <div className="max-w-3xl">
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-extrabold tracking-tight mb-3 sm:mb-6">
            School Management{' '}
            <span className="bg-gradient-to-r from-brand-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Redefined.
            </span>
          </h1>
          <p className="text-slate-400 text-xs sm:text-lg md:text-xl mb-4 sm:mb-12 max-w-2xl mx-auto font-light leading-relaxed">
            Welcome to CS EduTrack. Log in to access your role-based portal, manage academic schedules, track attendance, and process scholastic reports.
          </p>
        </div>

        {/* Roles Grid */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-6 w-full max-w-4xl mt-2 sm:mt-4">
          {roles.map((role, idx) => {
            const Icon = role.icon;
            return (
              <Link
                key={idx}
                href={`/auth/login?portal=${role.portal}`}
                className="glass-card p-3 sm:p-6 rounded-2xl text-left flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-5 cursor-pointer relative group h-full justify-between"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-5 w-full">
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
      </section>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 border-t border-slate-900/50 z-10 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-[11px] sm:text-xs font-light">
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

