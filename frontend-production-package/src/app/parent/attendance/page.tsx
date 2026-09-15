'use client';

import React, { useState, useEffect } from 'react';
import { useParent } from '../ParentContext';
import { api } from '@/lib/api';
import { Calendar as CalendarIcon, CheckCircle, AlertCircle, Clock, Info } from 'lucide-react';

export default function AttendancePage() {
  const { selectedChild } = useParent();
  const [attendance, setAttendance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAttendance = async (childId: string) => {
    try {
      setLoading(true);
      const res = await api.get(`/parent-portal/children/${childId}/attendance`);
      setAttendance(res.data);
    } catch (err) {
      console.error('Failed to fetch attendance records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedChild) return;
    fetchAttendance(selectedChild.id);

    // Refresh when tab/window gains focus
    const handleFocus = () => {
      fetchAttendance(selectedChild.id);
    };
    window.addEventListener('focus', handleFocus);

    // Fallback polling every 30 seconds
    const interval = setInterval(() => {
      fetchAttendance(selectedChild.id);
    }, 30000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [selectedChild]);

  // Listen to switcher events
  useEffect(() => {
    const handleChildChange = (e: any) => {
      fetchAttendance(e.detail);
    };
    window.addEventListener('parentChildChanged', handleChildChange);
    return () => window.removeEventListener('parentChildChanged', handleChildChange);
  }, []);

  if (!selectedChild) {
    return (
      <div className="text-slate-500 text-sm text-center py-12">
        Please select a child to view attendance records.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-t-[#2E5BFF] border-r-[#2E5BFF] border-b-transparent border-l-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const summary = attendance?.summary || { total: 0, present: 0, absent: 0, late: 0, excused: 0, attendanceRate: null, hasAttendanceData: false, todayAttendanceSubmitted: false };
  const records = attendance?.records || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            Attendance Log: <span className="text-[#2E5BFF] font-extrabold">{selectedChild.name}</span>
          </h2>
          <p className="text-slate-500 text-xs mt-1 font-light">Monitor monthly attendance, late checkins, and absenteeism rates.</p>
        </div>
      </div>

      {!summary.todayAttendanceSubmitted && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3 text-amber-800 text-xs font-semibold">
          <Clock className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <span className="font-bold block">Attendance Not Taken Yet</span>
            <span className="text-[11px] font-normal text-amber-700">Today's attendance has not been submitted by the teacher yet. Waiting for teacher submission.</span>
          </div>
        </div>
      )}

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-2xl text-center shadow-sm">
          <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Attendance Rate</span>
          <h4 className="text-2xl font-black text-[#2E5BFF] mt-1.5">
            {summary.hasAttendanceData && summary.attendanceRate !== null ? `${summary.attendanceRate}%` : 'N/A'}
          </h4>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-2xl text-center shadow-sm">
          <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Total Session</span>
          <h4 className="text-2xl font-black text-slate-700 mt-1.5">{summary.total}</h4>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-2xl text-center shadow-sm">
          <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Present</span>
          <h4 className="text-2xl font-black text-emerald-600 mt-1.5">{summary.present}</h4>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-2xl text-center shadow-sm">
          <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Late</span>
          <h4 className="text-2xl font-black text-amber-600 mt-1.5">{summary.late}</h4>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-2xl text-center shadow-sm col-span-2 sm:col-span-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Absent</span>
          <h4 className="text-2xl font-black text-rose-600 mt-1.5">{summary.absent}</h4>
        </div>
      </div>

      {/* Detailed logs */}
      <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-4">
        <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
          <CalendarIcon className="w-4.5 h-4.5 text-[#2E5BFF]" />
          Attendance History
        </h3>
        
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-center">
            <Info className="w-10 h-10 text-slate-300 mb-2" />
            <p className="text-xs font-light">No attendance sessions registered for this child yet.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {records.map((rec: any) => {
              let badgeColor = 'bg-emerald-50 border-emerald-100 text-emerald-700';
              let Icon = CheckCircle;
              if (rec.status === 'ABSENT') {
                badgeColor = 'bg-rose-50 border-rose-100 text-rose-700';
                Icon = AlertCircle;
              } else if (rec.status === 'LATE') {
                badgeColor = 'bg-amber-50 border-amber-100 text-amber-700';
                Icon = Clock;
              } else if (rec.status === 'EXCUSED') {
                badgeColor = 'bg-blue-50 border-blue-100 text-blue-700';
                Icon = Info;
              }

              return (
                <div
                  key={rec.id}
                  className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-slate-300 transition-all gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${badgeColor.split(' ')[0]} ${badgeColor.split(' ')[1]}`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-700">
                        {new Date(rec.date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-light mt-0.5">Taken by: {rec.markedBy}</p>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-lg border text-[9px] font-bold uppercase tracking-wider ${badgeColor}`}>
                    {rec.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
