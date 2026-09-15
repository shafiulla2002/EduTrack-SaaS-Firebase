'use client';

import React, { useState, useEffect } from 'react';
import { useParent } from './ParentContext';
import { api } from '@/lib/api';
import Link from 'next/link';
import {
  Users,
  Calendar,
  BookOpen,
  CreditCard,
  Bell,
  ArrowRight,
  TrendingUp,
  MapPin,
  Clock,
  Loader2,
  FileCheck,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export default function ParentDashboard() {
  const { children, selectedChild, setSelectedChildId } = useParent();
  const [stats, setStats] = useState<any>({
    totalChildren: 0,
    todayAttendance: 'N/A',
    homeworkPending: 0,
    pendingFees: 0,
    upcomingExams: 0,
    announcements: [],
    notifications: [],
  });
  const [childDashboard, setChildDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    try {
      const tenantId = localStorage.getItem('parent_tenantId') || 'demo-school';
      const res = await api.get('/parent-portal/dashboard');
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch parent dashboard stats:', err);
    }
  };

  const fetchChildDashboard = async (childId: string) => {
    try {
      setLoading(true);
      const res = await api.get(`/parent-portal/children/${childId}/dashboard`);
      setChildDashboard(res.data);
    } catch (err) {
      console.error('Failed to fetch child dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Fallback polling every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [children]);

  useEffect(() => {
    if (!selectedChild) return;
    fetchChildDashboard(selectedChild.id);

    // Refresh when tab/window gains focus
    const handleFocus = () => {
      fetchStats();
      fetchChildDashboard(selectedChild.id);
    };
    window.addEventListener('focus', handleFocus);

    // Fallback polling every 30 seconds
    const interval = setInterval(() => {
      fetchChildDashboard(selectedChild.id);
    }, 30000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [selectedChild]);

  // Listen to switcher events
  useEffect(() => {
    const handleChildChange = (e: any) => {
      fetchChildDashboard(e.detail);
      fetchStats();
    };
    window.addEventListener('parentChildChanged', handleChildChange);
    return () => window.removeEventListener('parentChildChanged', handleChildChange);
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Roster */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Family Dashboard
          </h1>
          <p className="text-slate-500 text-sm font-normal mt-1">
            Overview of all your children studying at the school. Click a student card below to switch profiles.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 px-3.5 py-2 rounded-2xl shadow-sm">
          <Users className="w-5 h-5 text-[#2E5BFF]" />
          <span className="text-xs font-semibold text-slate-600">
            Children linked: <strong className="text-slate-900 text-sm ml-0.5">{children.length}</strong>
          </span>
        </div>
      </div>

      {/* Aggregate Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm flex flex-col justify-between hover:border-[#2E5BFF]/30 transition-all">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Attendance Today</p>
            <h3 className="text-base font-black text-slate-800 mt-1">{stats.todayAttendance}</h3>
            {stats.todayAttendance === 'Attendance Not Taken Yet' && (
              <span className="text-[9px] font-bold text-amber-600 block mt-0.5">Waiting for Teacher Submission</span>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm flex flex-col justify-between hover:border-amber-500/30 transition-all">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 mb-4">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pending Homework</p>
            <h3 className="text-lg font-black text-slate-800 mt-1">{stats.homeworkPending} Assignments</h3>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm flex flex-col justify-between hover:border-rose-500/30 transition-all">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 mb-4">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pending Fees</p>
            <h3 className="text-lg font-black text-slate-800 mt-1">₹{Number(stats.pendingFees).toLocaleString('en-IN')}</h3>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm flex flex-col justify-between hover:border-indigo-500/30 transition-all">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Upcoming Exams</p>
            <h3 className="text-lg font-black text-slate-800 mt-1">{stats.upcomingExams} Schedules</h3>
          </div>
        </div>
      </div>

      {/* Linked Children Roster Cards */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Linked Children</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {children.map((child) => {
            const isSelected = selectedChild && child.id === selectedChild.id;
            return (
              <button
                key={child.id}
                onClick={() => setSelectedChildId(child.id)}
                className={`w-full bg-white p-6 rounded-3xl flex flex-col justify-between hover:scale-[1.01] hover:border-blue-500/30 transition-all shadow-sm text-left border relative overflow-hidden group ${
                  isSelected ? 'border-blue-500 bg-blue-50/10 ring-2 ring-blue-500/10' : 'border-slate-200'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-0 right-0 bg-blue-600 text-white font-bold text-[9px] uppercase px-3 py-1 rounded-bl-xl tracking-wider">
                    Selected
                  </div>
                )}
                
                <div className="flex gap-4">
                  {child.avatarUrl ? (
                    <img
                      src={child.avatarUrl}
                      alt={child.name}
                      className="w-12 h-12 rounded-2xl object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-black text-base select-none">
                      {child.name[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 text-base group-hover:text-slate-900 transition-colors truncate">
                      {child.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-light mt-0.5">
                      Class {child.class} • Sec {child.section}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-6 border-t border-slate-100 pt-4 text-xs text-slate-500">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Roll Number</span>
                    <strong className="text-slate-700">{child.rollNo}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Relationship</span>
                    <strong className="text-slate-700">{child.relationship}</strong>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Child Overview Dashboard Details */}
      {selectedChild && (
        <div className="space-y-6">
          <div className="border-t border-slate-250 pt-8 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              Academic Overview: <strong className="text-[#2E5BFF] font-black">{selectedChild.name}</strong>
            </h2>
            {loading && <Loader2 className="w-5 h-5 animate-spin text-[#2E5BFF]" />}
          </div>

          {childDashboard && !loading && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Performance Indicator Ring & Actions */}
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-6 flex flex-col justify-between h-full">
                <div className="space-y-4">
                  <div className="text-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Attendance Rate</span>
                    <div className="relative w-28 h-28 mx-auto mt-4 flex items-center justify-center">
                      {childDashboard.metrics.hasAttendanceData && childDashboard.metrics.attendancePercentage !== null ? (
                        <>
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <path
                              className="text-slate-100"
                              strokeWidth="2.5"
                              stroke="currentColor"
                              fill="transparent"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <path
                              className="text-[#2E5BFF]"
                              strokeDasharray={`${childDashboard.metrics.attendancePercentage}, 100`}
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              stroke="currentColor"
                              fill="transparent"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                          </svg>
                          <div className="absolute text-center">
                            <span className="text-2xl font-black text-slate-800">{childDashboard.metrics.attendancePercentage}%</span>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full rounded-full border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center p-2">
                          <span className="text-sm font-bold text-slate-400">N/A</span>
                          <span className="text-[9px] text-slate-400 font-medium leading-tight">No Records Yet</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {childDashboard.metrics.todayAttendanceSubmitted ? (
                    <div className="text-center pt-1">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Today's Status: </span>
                      <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                        childDashboard.metrics.todayAttendanceStatus === 'PRESENT' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                        childDashboard.metrics.todayAttendanceStatus === 'ABSENT' ? 'bg-rose-50 text-rose-600 border border-rose-200' :
                        childDashboard.metrics.todayAttendanceStatus === 'LATE' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-blue-50 text-blue-600 border border-blue-200'
                      }`}>
                        {childDashboard.metrics.todayAttendanceStatus}
                      </span>
                    </div>
                  ) : (
                    <div className="text-center pt-1">
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 inline-block">
                        Attendance Not Taken Yet
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-2 text-center text-xs">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <span className="text-[9px] text-slate-400 font-semibold block uppercase">Due Fees</span>
                      <strong className="text-slate-700 text-sm">₹{Number(childDashboard.metrics.pendingFees).toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <span className="text-[9px] text-slate-400 font-semibold block uppercase">Pending Hwk</span>
                      <strong className="text-slate-700 text-sm">{childDashboard.metrics.pendingHomework} Tasks</strong>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <Link
                    href="/parent/profile"
                    className="w-full flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 hover:border-slate-350 rounded-2xl text-xs font-semibold text-slate-600 hover:text-slate-800 transition-all cursor-pointer"
                  >
                    <span>View Student Profile</span>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </Link>
                  <Link
                    href="/parent/fees"
                    className="w-full flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 hover:border-slate-350 rounded-2xl text-xs font-semibold text-slate-600 hover:text-slate-800 transition-all cursor-pointer"
                  >
                    <span>Manage Ledgers & Fees</span>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </Link>
                </div>
              </div>

              {/* Homework due */}
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="font-bold text-sm text-slate-800">Active Homeworks</h3>
                  <Link href="/parent/homework" className="text-[10px] text-blue-600 hover:text-blue-700 font-bold uppercase">
                    View All
                  </Link>
                </div>
                <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                  {childDashboard.metrics.pendingHomework === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-500">
                      <CheckCircle className="w-8 h-8 text-slate-300 mb-2" />
                      <p className="text-xs font-light">All caught up! No pending homework.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="font-bold text-blue-600">Mathematics</span>
                          <span className="text-slate-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> Due Tomorrow
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-700">Algebra Quadratic Equations Worksheet</h4>
                        <p className="text-[11px] text-slate-500 font-light truncate">Solve problems 1 to 15 in notebook.</p>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="font-bold text-indigo-600">Science</span>
                          <span className="text-slate-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> Due in 3 days
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-700">Photosynthesis Experiment Model</h4>
                        <p className="text-[11px] text-slate-500 font-light truncate">Bring model along with observation chart.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Exam & Marks Card */}
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="font-bold text-sm text-slate-800">Recent Exam Results</h3>
                  <Link href="/parent/exams" className="text-[10px] text-blue-600 hover:text-blue-700 font-bold uppercase">
                    Report Card
                  </Link>
                </div>
                <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                  {childDashboard.recentMarks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-500">
                      <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
                      <p className="text-xs font-light">No exam marks entered yet.</p>
                    </div>
                  ) : (
                    childDashboard.recentMarks.map((mark: any) => {
                      const marksVal = Number(mark.marksObtained);
                      const isPassing = marksVal >= 50;
                      return (
                        <div key={mark.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-100">
                          <div>
                            <span className="text-[9px] text-slate-400 font-semibold uppercase">{mark.exam.name}</span>
                            <h4 className="text-xs font-bold text-slate-700 mt-0.5">{mark.subject.name}</h4>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs font-black ${isPassing ? 'text-blue-600' : 'text-rose-500'}`}>
                              {marksVal} Marks
                            </span>
                            <span className="text-[9px] text-slate-400 block font-light">Grade B+</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}
