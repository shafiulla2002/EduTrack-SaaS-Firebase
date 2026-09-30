'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  UserCheck,
  Building,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  QrCode,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { PencilSpinner, TableSkeleton, EmptyState, ErrorState } from '@/components/loading';
import TeacherQrScannerModal from '@/components/TeacherQrScannerModal';
import { useTenant } from '@/app/providers/TenantContext';

export default function TeacherMyAttendancePage() {
  const { schoolName } = useTenant();
  const { showToast } = useToast();

  const [month, setMonth] = useState<string>(() => new Date().toISOString().substring(0, 7)); // "YYYY-MM"
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);

  const [todayStatus, setTodayStatus] = useState<{
    marked: boolean;
    attendance: any;
    todayDate: string;
  }>({
    marked: false,
    attendance: null,
    todayDate: new Date().toISOString().split('T')[0],
  });

  const [historyData, setHistoryData] = useState<{
    month: string;
    teacher: { name: string; employeeId?: string; designation?: string };
    summary: {
      totalDaysMarked: number;
      presentDays: number;
      lateDays: number;
      halfDays: number;
      leaveDays: number;
      attendancePercentage: number;
    };
    records: any[];
  }>({
    month: new Date().toISOString().substring(0, 7),
    teacher: { name: 'Teacher' },
    summary: {
      totalDaysMarked: 0,
      presentDays: 0,
      lateDays: 0,
      halfDays: 0,
      leaveDays: 0,
      attendancePercentage: 100,
    },
    records: [],
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [todayRes, historyRes] = await Promise.all([
        api.get('/teacher-attendance/my-today'),
        api.get(`/teacher-attendance/my-history?month=${month}`),
      ]);
      setTodayStatus(todayRes.data);
      setHistoryData(historyRes.data);
    } catch (err: any) {
      console.error('Failed to load my attendance:', err);
      setError(true);
      showToast('Failed to load attendance history', 'error');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleScanSuccess = (data: any) => {
    showToast(data.message || 'Attendance recorded successfully!', 'success');
    loadData();
  };

  const changeMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(date.toISOString().substring(0, 7));
  };

  const summary = historyData?.summary || {
    totalDaysMarked: 0,
    presentDays: 0,
    lateDays: 0,
    halfDays: 0,
    leaveDays: 0,
    attendancePercentage: 100,
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-[#2E5BFF]" />
            My Attendance Portal
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            View today's check-in status and your personal monthly attendance logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="px-4 py-2.5 bg-[#2E5BFF] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            Scan Attendance QR
          </button>

          <button
            onClick={loadData}
            className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Today's Hero Check-in Status Card */}
      <div className="bg-gradient-to-tr from-slate-900 via-slate-850 to-slate-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-slate-700/50">
        <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-blue-500/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Today • {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              {todayStatus.marked && (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    todayStatus.attendance?.status === 'LATE'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  <ShieldCheck className="w-3 h-3" />
                  {todayStatus.attendance?.status || 'PRESENT'}
                </span>
              )}
            </div>

            <h2 className="text-2xl font-black tracking-tight text-white">
              {todayStatus.marked
                ? `Checked in at ${new Date(todayStatus.attendance.checkInTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : 'Attendance Not Marked Yet'}
            </h2>

            <p className="text-xs text-slate-300 font-light">
              {todayStatus.marked
                ? `Your attendance has been verified for ${schoolName || 'the school'}.`
                : 'Scan the school attendance QR code at the entrance to record your arrival.'}
            </p>
          </div>

          <div>
            {todayStatus.marked ? (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Verified for Today
              </div>
            ) : (
              <button
                onClick={() => setIsScannerOpen(true)}
                className="px-6 py-3 bg-[#2E5BFF] hover:bg-blue-600 text-white font-bold text-xs rounded-2xl shadow-lg shadow-blue-500/30 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                <QrCode className="w-4 h-4" />
                Mark Attendance Now
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Monthly KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Attendance %</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-800">{summary.attendancePercentage}%</span>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Present + Late</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Present Days</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-600">{summary.presentDays}</span>
            <p className="text-[11px] text-emerald-500 font-medium mt-0.5">On-time check-ins</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-amber-100 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Late Days</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-amber-600">{summary.lateDays}</span>
            <p className="text-[11px] text-amber-500 font-medium mt-0.5">After grace threshold</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Leave Days</span>
            <Calendar className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-blue-600">{summary.leaveDays}</span>
            <p className="text-[11px] text-blue-400 font-medium mt-0.5">Approved leaves</p>
          </div>
        </div>
      </div>

      {/* Month Navigation & Attendance Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#2E5BFF]" />
            Monthly Attendance History
          </h3>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1">
            <button
              onClick={() => changeMonth(-1)}
              className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-800 px-2 min-w-[90px] text-center font-mono">
              {month}
            </span>
            <button
              onClick={() => changeMonth(1)}
              className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <TableSkeleton
              headers={['Date', 'Check-in Time', 'Status', 'Scan Source']}
              rows={5}
              loadingLabel="Loading attendance history..."
            />
          ) : error ? (
            <ErrorState
              title="Failed to load history"
              message="Could not retrieve attendance records for this month."
              onRetry={loadData}
            />
          ) : historyData.records.length === 0 ? (
            <EmptyState
              title="No attendance records this month"
              description="Your daily QR check-in records will appear here."
            />
          ) : (
            <table className="w-full border-collapse text-left min-w-[500px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Check-in Time</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Verification Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-600">
                {historyData.records.map((r) => {
                  const isPresent = r.status === 'PRESENT';
                  const isLate = r.status === 'LATE';

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {new Date(r.date).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">
                        {r.checkInTime
                          ? new Date(r.checkInTime).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {isPresent && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            PRESENT
                          </span>
                        )}
                        {isLate && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            LATE
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[11px] text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-500" />
                          {r.scanSource === 'IN_APP_SCANNER'
                            ? 'App Scanner'
                            : r.scanSource === 'MOBILE_CAMERA_DEEP_LINK'
                            ? 'Camera Deep Link'
                            : r.scanSource || 'Verified'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* QR Scanner Modal */}
      <TeacherQrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onAttendanceSuccess={handleScanSuccess}
      />
    </div>
  );
}
