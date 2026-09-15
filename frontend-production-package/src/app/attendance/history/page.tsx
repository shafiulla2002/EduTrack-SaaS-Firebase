// frontend/src/app/attendance/history/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Calendar, RefreshCw, AlertCircle, ArrowLeft, ExternalLink, ChevronRight, UserCheck, Shield } from 'lucide-react';
import Link from 'next/link';
import { formatDisplayDate } from '@/lib/date';

export default function AttendanceHistory() {
  const [sessions, setSessions] = useState([] as any[]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/attendance/history');
      setSessions(res.data || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load attendance history logs.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-brand-400 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">
                Attendance Session Logs
              </h1>
              <p className="text-xs text-slate-400 mt-1">Replicates Salesforce LWC historical sessions log list</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link 
              href="/attendance/dashboard" 
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700/50 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Dashboard
            </Link>
            <Link 
              href="/attendance/entry" 
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-brand-500/15 flex items-center gap-1"
            >
              + New Session
            </Link>
          </div>
        </header>

        {/* Info Banner */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-850 flex items-start gap-3">
          <Shield className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-slate-250">LWC Interactive Records</h4>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              Clicking a session date opens the Attendance Tracker loaded with that class, section, date, and pre-selected teacher records. Past session lists represent immutable audit logs.
            </p>
          </div>
        </div>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm">Querying historical ledger...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-950/80 border border-rose-900 text-rose-300 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-450 shrink-0" />
            <span className="text-xs font-semibold">{error}</span>
          </div>
        )}

        {!isLoading && !error && (
          <div className="bg-slate-850 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-900/40">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">All Submitted Sessions</h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/20 text-slate-400 font-bold uppercase tracking-wide">
                    <th className="px-6 py-3.5">Session Date</th>
                    <th className="px-6 py-3.5">Class / Section</th>
                    <th className="px-6 py-3.5">Teacher Advisor</th>
                    <th className="px-6 py-3.5 text-center">Present</th>
                    <th className="px-6 py-3.5 text-center">Absent</th>
                    <th className="px-6 py-3.5 text-center">Roster Total</th>
                    <th className="px-6 py-3.5 text-center">Rate</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {sessions.map(s => {
                    const rate = s.totalStudents > 0 ? Math.round((s.presentCount / s.totalStudents) * 100) : 0;
                    const rateClass = rate >= 90 ? 'text-emerald-400 bg-emerald-950/20 border-emerald-900/30' : rate >= 75 ? 'text-amber-400 bg-amber-950/20 border-amber-900/30' : 'text-rose-400 bg-rose-950/20 border-rose-900/30';
                    
                    return (
                      <tr key={s.id} className="hover:bg-slate-800/40 transition-colors group">
                        <td className="px-6 py-4 font-bold text-white whitespace-nowrap">
                          <Link 
                            href={`/attendance/entry?classVal=${encodeURIComponent(s.classSection?.class?.name || '')}&sectionVal=${encodeURIComponent(s.classSection?.section?.name || '')}&dateVal=${encodeURIComponent(s.date)}&teacherId=${encodeURIComponent(s.teacherId || '')}`}
                            className="text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1"
                          >
                            {formatDisplayDate(s.date)}
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-200">
                          Class {s.classSection?.class?.name} • Section {s.classSection?.section?.name}
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-350 flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                          {s.teacherName}
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-emerald-400 bg-emerald-950/5">
                          {s.presentCount}
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-rose-400 bg-rose-950/5">
                          {s.absentCount}
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-slate-300">
                          {s.totalStudents}
                        </td>
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          <span className={`inline-block px-2.5 py-1 rounded-xl text-[10px] font-extrabold border ${rateClass}`}>
                            {rate}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <Link 
                            href={`/attendance/entry?classVal=${encodeURIComponent(s.classSection?.class?.name || '')}&sectionVal=${encodeURIComponent(s.classSection?.section?.name || '')}&dateVal=${encodeURIComponent(s.date)}&teacherId=${encodeURIComponent(s.teacherId || '')}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-750 font-bold tracking-tight transition-all"
                          >
                            Open Tracker
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {sessions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-16 text-center text-slate-500 font-semibold uppercase tracking-wider">
                        No attendance sessions recorded in database.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
