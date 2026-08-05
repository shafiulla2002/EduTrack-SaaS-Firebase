'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Save, CheckCircle, Clock, X, UserX, UserCheck, Search,
  Calendar, ChevronDown, RotateCcw, BarChart3, Eye, RefreshCw
} from 'lucide-react';
import { api } from '@/lib/api';
import Link from 'next/link';
import { dispatchSchoolSetupUpdated } from '@/lib/events';
import { toLocalDateString, isBefore, formatDateDDMMYYYY } from '@/lib/date';
import DatePickerInput from '@/components/DatePickerInput';

interface Teacher {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  designation: string;
}

interface ClassSection {
  id: string;
  class: {
    id: string;
    name: string;
  };
  section: {
    id: string;
    name: string;
  };
}

interface Student {
  id: string;
  rollNo: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export default function AttendancePage() {
  // Phase 1: Setup
  const [showSetup, setShowSetup] = useState(true);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classSections, setClassSections] = useState<ClassSection[]>([]);
  
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedClassSectionId, setSelectedClassSectionId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(() => toLocalDateString());

  // Phase 2: Live Attendance Tracking
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<Record<string, boolean>>({}); // student.id -> isAbsent (true=absent, false=present)
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [filter, setFilter] = useState<'All' | 'Present' | 'Absent'>('All');
  const [sessionExists, setSessionExists] = useState(false);

  // Load initial options
  useEffect(() => {
    const loadSetupData = async () => {
      try {
        setLoading(true);
        const [teachersRes, classSectionsRes] = await Promise.all([
          api.get('/complaint-box/teachers'), // returns staff profiles with user details
          api.get('/academics/class-sections'),
        ]);

        setTeachers(teachersRes.data);
        setClassSections(classSectionsRes.data);

        if (teachersRes.data.length > 0) {
          setSelectedTeacherId(teachersRes.data[0].id);
        }
        if (classSectionsRes.data.length > 0) {
          setSelectedClassSectionId(classSectionsRes.data[0].id);
        }
      } catch (err) {
        console.error('Failed to load setup options:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSetupData();
  }, []);

  // Fetch session & students once class section and date are confirmed
  const loadAttendanceSession = async () => {
    if (!selectedClassSectionId || !attendanceDate) return;
    try {
      setLoading(true);
      setIsSuccess(false);

      // Load students in this class section
      const studentsRes = await api.get(`/complaint-box/students-by-class/${selectedClassSectionId}`);
      const studentsList = studentsRes.data;
      setStudents(studentsList);

      // Load existing session data
      const sessionRes = await api.get('/attendance/session', {
        params: { classSectionId: selectedClassSectionId, date: attendanceDate }
      });

      const session = sessionRes.data;
      const initialRecords: Record<string, boolean> = {};

      studentsList.forEach((student: Student) => {
        initialRecords[student.id] = false; // default present
      });

      if (session.sessionExists) {
        setSessionExists(true);
        session.absentIds.forEach((studentId: string) => {
          initialRecords[studentId] = true; // mark absent
        });
      } else {
        setSessionExists(false);
      }

      setRecords(initialRecords);

      // Mark read-only if date is in the past and no session exists (or customize logic)
      const todayStr = toLocalDateString();
      setIsReadOnly(isBefore(attendanceDate, todayStr) && !session.sessionExists);

      setShowSetup(false);
    } catch (err) {
      console.error('Failed to load attendance session:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentClick = (studentId: string) => {
    if (isReadOnly || isSuccess) return;
    setRecords(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  const stats = useMemo(() => {
    const total = students.length;
    const absent = students.filter(s => records[s.id]).length;
    return { total, present: total - absent, absent };
  }, [students, records]);

  const displayedStudents = useMemo(() => {
    if (filter === 'Present') return students.filter(s => !records[s.id]);
    if (filter === 'Absent') return students.filter(s => records[s.id]);
    return students;
  }, [students, records, filter]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const absentStudentIds = Object.keys(records).filter(id => records[id]);
      
      await api.post('/attendance/save', {
        classSectionId: selectedClassSectionId,
        date: attendanceDate,
        teacherId: selectedTeacherId,
        presentCount: stats.present,
        absentCount: stats.absent,
        totalStudents: stats.total,
        absentStudentIds,
      });

      setIsSuccess(true);
      dispatchSchoolSetupUpdated();
    } catch (err) {
      console.error('Failed to save attendance:', err);
      alert('Error occurred while saving attendance records.');
    } finally {
      setLoading(false);
    }
  };

  const activeClassSection = classSections.find(cs => cs.id === selectedClassSectionId);
  const activeTeacher = teachers.find(t => t.id === selectedTeacherId);

  // ─── SETUP SCREEN ───────────────────────────────────────────
  if (showSetup) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="w-full max-w-md glass-panel p-6 rounded-2xl shadow-xl space-y-6">
          <div className="text-center">
            <Calendar className="w-12 h-12 text-brand-500 mx-auto" />
            <h2 className="text-xl font-bold text-white mt-3">Attendance Session Setup</h2>
            <p className="text-slate-400 text-xs mt-1">Select class-section, date, and advisor to load roster</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1">Select Class / Section</label>
              <select
                value={selectedClassSectionId}
                onChange={(e) => setSelectedClassSectionId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none"
              >
                {classSections.map((cs) => (
                  <option key={cs.id} value={cs.id}>
                    {cs.class.name} — {cs.section.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1">Select Teacher / Advisor</label>
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none"
              >
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.user.name} ({t.designation || 'Teacher'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1">Attendance Date</label>
              <DatePickerInput
                value={attendanceDate}
                onChange={setAttendanceDate}
              />
            </div>

            <button
              onClick={loadAttendanceSession}
              disabled={loading || !selectedClassSectionId || !selectedTeacherId}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-brand-500/10 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Load Student Roster →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── ATTENDANCE TRACKER SCREEN ───────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-900 pb-5">
        <div>
          <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
            Attendance Tracker
          </h2>
          <p className="text-slate-400 text-xs font-light mt-1">
            Managing attendance roster for {activeClassSection ? `${activeClassSection.class.name} — ${activeClassSection.section.name}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/attendance/report"
            className="px-3.5 py-2.5 rounded-xl border border-slate-850 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-850 font-bold text-xs flex items-center gap-2 transition-all"
          >
            <BarChart3 className="w-3.5 h-3.5 text-brand-400" />
            Calendar Sheet Reports
          </Link>
          <button
            onClick={() => setShowSetup(true)}
            className="px-3.5 py-2.5 rounded-xl border border-slate-850 bg-slate-900 text-slate-350 hover:text-white hover:bg-slate-850 font-bold text-xs transition-all"
          >
            Change Settings
          </button>
        </div>
      </div>

      {/* Advisor Banner */}
      <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-850 rounded-xl px-4 py-3">
        <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center text-xs font-bold border border-brand-500/20">
          AT
        </div>
        <div>
          <span className="text-xs font-bold text-slate-200">Advisor: {activeTeacher?.user.name}</span>
          <span className="text-[10px] text-slate-500 ml-3">Date: {formatDateDDMMYYYY(attendanceDate)}</span>
          {sessionExists && (
            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded ml-3">
              Loaded from database
            </span>
          )}
        </div>
      </div>

      {/* Stats Filter Cards */}
      <div className="grid grid-cols-3 gap-4">
        {([
          { key: 'All' as const, label: 'Total Roster', value: stats.total, color: 'brand' },
          { key: 'Present' as const, label: 'Present', value: stats.present, color: 'emerald' },
          { key: 'Absent' as const, label: 'Absent', value: stats.absent, color: 'rose' },
        ]).map(stat => (
          <button
            key={stat.key}
            onClick={() => setFilter(stat.key)}
            className={`glass-panel p-4 text-left transition-all ${
              filter === stat.key 
                ? 'border-brand-500/50 ring-2 ring-brand-500/10 bg-brand-500/5' 
                : 'hover:border-slate-800'
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{stat.label}</div>
            <div className="text-2xl font-extrabold text-slate-200 mt-1">{stat.value}</div>
          </button>
        ))}
      </div>

      {/* Success Card or Student List */}
      {isSuccess ? (
        <div className="glass-panel p-8 text-center space-y-4 shadow-xl max-w-md mx-auto">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xl mx-auto border border-emerald-500/20">
            ✓
          </div>
          <h3 className="text-xl font-extrabold text-white">Attendance Saved!</h3>
          <p className="text-sm text-slate-400">
            {activeClassSection?.class.name} — {activeClassSection?.section.name} · {formatDateDDMMYYYY(attendanceDate)}
          </p>
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-850">
              <span className="text-[10px] text-slate-500 font-bold block">Total</span>
              <span className="text-base font-extrabold text-white">{stats.total}</span>
            </div>
            <div className="bg-emerald-500/5 p-2.5 rounded-xl border border-emerald-500/10">
              <span className="text-[10px] text-emerald-400 font-bold block">Present</span>
              <span className="text-base font-extrabold text-emerald-450">{stats.present}</span>
            </div>
            <div className="bg-rose-500/5 p-2.5 rounded-xl border border-rose-500/10">
              <span className="text-[10px] text-rose-400 font-bold block">Absent</span>
              <span className="text-base font-extrabold text-rose-455">{stats.absent}</span>
            </div>
          </div>
          <button
            onClick={() => setIsSuccess(false)}
            className="mt-4 px-6 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-350 hover:text-white hover:bg-slate-800 text-xs font-bold transition-all"
          >
            Modify Records
          </button>
        </div>
      ) : (
        <>
          {displayedStudents.length === 0 ? (
            <div className="glass-panel p-12 text-center text-slate-500 space-y-3">
              <UserX className="w-10 h-10 mx-auto opacity-30" />
              <p className="font-semibold text-sm">No students found matching current filters</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-xs text-slate-500 font-semibold flex items-center justify-between">
                <span>
                  {isReadOnly ? 'Read-Only View (Historical Session)' : 'Tap a student card to toggle attendance'}
                </span>
                <span className="font-mono text-slate-400">{displayedStudents.length} Students Listed</span>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {displayedStudents.map((student) => {
                  const isAbsent = records[student.id];
                  const initials = student.user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <div
                      key={student.id}
                      onClick={() => handleStudentClick(student.id)}
                      className={`glass-panel p-4 text-center transition-all cursor-pointer border-2 ${
                        isAbsent
                          ? 'bg-rose-500/5 border-rose-500/30 hover:border-rose-500/50'
                          : 'bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/50'
                      } ${isReadOnly ? 'opacity-70 cursor-default' : ''}`}
                    >
                      <div
                        className={`w-10 h-10 rounded-full mx-auto flex items-center justify-center text-white text-xs font-bold mb-2 ${
                          isAbsent ? 'bg-rose-600' : 'bg-emerald-600'
                        }`}
                      >
                        {initials}
                      </div>
                      <div className="text-xs font-bold text-slate-200 truncate">{student.user.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">{student.rollNo || '—'}</div>
                      <div className={`text-[9px] font-bold mt-2 px-2 py-0.5 rounded-full inline-block ${
                        isAbsent
                          ? 'bg-rose-500/20 text-rose-350'
                          : 'bg-emerald-500/20 text-emerald-350'
                      }`}>
                        {isAbsent ? 'Absent' : 'Present'}
                      </div>
                    </div>
                  );
                })}
              </div>

              {!isReadOnly && (
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-brand-500/10 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Submit Attendance
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
