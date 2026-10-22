'use client';

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Search, Calendar, Info, CheckCircle, 
  X, AlertTriangle, TrendingUp, ChevronLeft, ChevronRight, RefreshCw, UserCheck
} from 'lucide-react';
import { api } from '@/lib/api';
import Link from 'next/link';
import { toLocalDateString } from '@/lib/date';

interface StudentSuggestion {
  id: string;
  rollNo: string | null;
  user: {
    name: string;
    email: string;
  };
  classSection?: {
    class: { name: string };
    section: { name: string };
  };
}

interface AttendanceRecord {
  id: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  attendanceSession: {
    date: string; // ISO String
  };
}

export default function AttendanceReportPage() {
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<StudentSuggestion[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentDetails, setStudentDetails] = useState<any | null>(null);
  
  // Selected Month: YYYY-MM format
  const [selectedMonth, setSelectedMonth] = useState(() => toLocalDateString().slice(0, 7));

  const [loading, setLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  // Fetch student suggestions when search query changes
  useEffect(() => {
    if (search.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSuggestionsLoading(true);
        const res = await api.get('/students', {
          params: { search }
        });
        setSuggestions(res.data);
      } catch (err) {
        console.error('Failed to search students:', err);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  // Load selected student detailed attendance logs
  const loadStudentDetails = async (id: string) => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await api.get(`/students/${id}`);
      setStudentDetails(res.data);
    } catch (err) {
      console.error('Failed to load student details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStudentId) {
      loadStudentDetails(selectedStudentId);
    }
  }, [selectedStudentId]);

  // If no student is selected, try to load first student from database initially
  useEffect(() => {
    const loadFirstStudent = async () => {
      try {
        setLoading(true);
        const res = await api.get('/students');
        if (res.data.length > 0) {
          setSelectedStudentId(res.data[0].id);
        }
      } catch (err) {
        console.error('Failed to get initial student list:', err);
      } finally {
        setLoading(false);
      }
    };
    loadFirstStudent();
  }, []);

  // Generate calendar days for selected month
  const monthDays = React.useMemo(() => {
    if (!selectedMonth) return [];
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr, 10);
    const monthIdx = parseInt(monthStr, 10) - 1; // 0-indexed

    const date = new Date(year, monthIdx, 1);
    const days: { day: number; dateString: string; isWeekend: boolean; status: 'Present' | 'Absent' | 'Future' | 'Weekend' }[] = [];

    // Get number of days in the month
    const totalDays = new Date(year, monthIdx + 1, 0).getDate();
    const todayStr = toLocalDateString();

    for (let day = 1; day <= totalDays; day++) {
      const currentDayDate = new Date(year, monthIdx, day);
      const dateString = toLocalDateString(currentDayDate);
      const dayOfWeek = currentDayDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sun = 0, Sat = 6

      // Check if student has attendance records in DB
      let status: 'Present' | 'Absent' | 'Future' | 'Weekend' = 'Present';

      if (dateString > todayStr) {
        status = 'Future';
      } else if (isWeekend) {
        status = 'Weekend';
      } else if (studentDetails?.attendances) {
        // If an attendance entry exists and status is ABSENT
        const match = studentDetails.attendances.find((att: AttendanceRecord) => {
          const attDate = toLocalDateString(att.attendanceSession.date);
          return attDate === dateString;
        });

        if (match && match.status === 'ABSENT') {
          status = 'Absent';
        }
      }

      days.push({ day, dateString, isWeekend, status });
    }

    return days;
  }, [selectedMonth, studentDetails]);

  // Statistics
  const stats = React.useMemo(() => {
    const presentCount = monthDays.filter(d => d.status === 'Present').length;
    const absentCount = monthDays.filter(d => d.status === 'Absent').length;
    const weekendCount = monthDays.filter(d => d.status === 'Weekend').length;
    const totalSchoolDays = presentCount + absentCount;
    
    const pct = totalSchoolDays > 0 
      ? Math.round((presentCount / totalSchoolDays) * 100) 
      : 100;

    return { presentCount, absentCount, weekendCount, totalSchoolDays, pct };
  }, [monthDays]);

  const monthOptions = React.useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
    return options;
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-900 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/attendance"
            className="p-2.5 rounded-xl border border-slate-850 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-2xl font-extrabold text-white">
              Attendance Calendar Sheets
            </h2>
            <p className="text-slate-400 text-xs font-light mt-1">
              Review monthly calendar attendance trends per student record.
            </p>
          </div>
        </div>
      </div>

      {/* Roster Search Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Search */}
        <div className="relative space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Find Student</label>
          <div className="relative flex items-center bg-slate-900 border border-slate-850 rounded-xl px-3 py-2.5 focus-within:border-brand-500 transition-all">
            <Search className="w-4 h-4 text-slate-500 mr-2" />
            <input
              type="text" 
              placeholder="Search by name..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none text-xs font-semibold text-slate-200 outline-none w-full placeholder-slate-500"
            />
            {suggestionsLoading && <RefreshCw className="w-4 h-4 text-slate-500 animate-spin" />}
          </div>

          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-850 max-h-40 overflow-y-auto">
              {suggestions.map(s => (
                <div
                  key={s.id}
                  onClick={() => {
                    setSelectedStudentId(s.id);
                    setSearch('');
                    setSuggestions([]);
                  }}
                  className="p-2.5 hover:bg-slate-800 cursor-pointer text-xs font-bold text-slate-200"
                >
                  {s.user.name} {s.classSection ? `(${s.classSection.class.name})` : ''}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Month select */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Select Month</label>
          <select
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-slate-200 font-bold bg-slate-900 focus:outline-none focus:border-brand-500"
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && !studentDetails ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <RefreshCw className="w-10 h-10 text-brand-500 animate-spin" />
          <p className="text-slate-400 text-sm">Querying student records...</p>
        </div>
      ) : studentDetails ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* Calendar sheet */}
          <div className="lg:col-span-2 glass-panel p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-900 pb-3">
              <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <Calendar className="w-5 h-5 text-brand-400" />
                Calendar: {studentDetails.user.name}
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                {monthOptions.find(o => o.value === selectedMonth)?.label || selectedMonth}
              </span>
            </div>

            {/* Month Grid */}
            <div className="grid grid-cols-5 sm:grid-cols-7 gap-3 pt-2">
              {monthDays.map((d) => {
                let color = 'bg-slate-900 border-slate-850 text-slate-400';
                if (d.status === 'Present') color = 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400 font-bold';
                else if (d.status === 'Absent') color = 'bg-rose-500/5 border-rose-500/10 text-rose-450 font-bold';
                else if (d.status === 'Future') color = 'bg-slate-900/40 border-slate-900/60 text-slate-600 font-light';
                else if (d.status === 'Weekend') color = 'bg-slate-900/70 border-slate-900 text-slate-500 font-light';

                return (
                  <div
                    key={d.day}
                    className={`h-16 border rounded-xl flex flex-col justify-between p-2.5 text-xs transition-all ${color}`}
                  >
                    <span className="font-bold">{d.day}</span>
                    <span className="text-[8px] font-semibold uppercase self-end tracking-wider">{d.status}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stats card */}
          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-slate-200 border-b border-slate-900 pb-3">Monthly Progression</h3>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                  <span className="text-slate-400 text-[10px] font-bold block">Present Days</span>
                  <span className="text-lg font-black text-emerald-400 block mt-0.5">{stats.presentCount} Days</span>
                </div>
                <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl">
                  <span className="text-slate-400 text-[10px] font-bold block">Absent Days</span>
                  <span className="text-lg font-black text-rose-450 block mt-0.5">{stats.absentCount} Days</span>
                </div>
                <div className="p-3 bg-slate-950 p-3 rounded-xl border border-slate-900">
                  <span className="text-slate-500 text-[10px] font-bold block">School Days</span>
                  <span className="text-lg font-black text-slate-300 block mt-0.5">{stats.totalSchoolDays} Days</span>
                </div>
                <div className="p-3 bg-brand-500/5 border border-brand-500/10 rounded-xl">
                  <span className="text-brand-400 text-[10px] font-bold block">Presence Rate</span>
                  <span className="text-lg font-black text-brand-400 block mt-0.5">{stats.pct}%</span>
                </div>
              </div>

              <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-xl text-xs text-slate-400 leading-relaxed">
                ℹ️ Standard benchmark limits require a minimum of 75% attendance presence rate for final exams eligibility.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-12 text-center text-slate-500 font-medium">
          Please add student records to view monthly attendance logs.
        </div>
      )}
    </div>
  );
}
