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
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <span className="font-extrabold text-white text-xl tracking-tight">ET</span>
          </div>
          <span className="font-bold text-xl bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
            EduTrack <span className="text-brand-400 font-medium text-sm px-1.5 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20 ml-1">SaaS</span>
          </span>
        </div>

        <button
          onClick={() => setSupportModalOpen(true)}
          className="px-5 py-2 rounded-xl text-sm font-semibold glass-panel text-slate-300 hover:text-white transition-all cursor-pointer"
        >
          Contact Support
        </button>
      </header>


      {/* Main Content */}
      <section className="flex-1 max-w-7xl mx-auto px-6 flex flex-col justify-center items-center text-center py-12 z-10">
        <div className="max-w-3xl">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
            School Management{' '}
            <span className="bg-gradient-to-r from-brand-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Redefined.
            </span>
          </h1>
          <p className="text-slate-400 text-lg md:text-xl mb-12 max-w-2xl mx-auto font-light leading-relaxed">
            Welcome to the independent multi-tenant portal for EduTrack. Log in to access your modules, manage classes, and track scholastic reports.
          </p>
        </div>

        {/* Roles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl mt-4">
          {roles.map((role, idx) => {
            const Icon = role.icon;
            return (
              <Link
                key={idx}
                href={`/auth/login?portal=${role.portal}`}
                className="glass-card p-6 rounded-2xl text-left flex gap-5 cursor-pointer relative group"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${role.color} flex items-center justify-center text-white shrink-0 shadow-md group-hover:scale-105 transition-transform`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-slate-200 group-hover:text-white transition-colors flex items-center gap-1.5">
                    {role.title}
                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </h3>
                  <p className="text-slate-400 text-sm mt-1.5 font-light leading-relaxed">
                    {role.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-6 text-center border-t border-slate-900/50 z-10">
        <p className="text-slate-500 text-xs font-light">
          &copy; {new Date().getFullYear()} Covenant Synergy Private Limited. All rights reserved. EduTrack is a registered trademark.
        </p>
      </footer>

      {supportModalOpen && (
        <ContactSupportModal onClose={() => setSupportModalOpen(false)} />
      )}
    </main>
  );
}

