'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  CheckCircle2,
  Clock,
  UserX,
  TrendingUp,
  Search,
  Filter,
  Calendar,
  QrCode,
  Download,
  RefreshCw,
  MapPin,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { api, fastGet } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { PencilSpinner, TableSkeleton, EmptyState, ErrorState } from '@/components/loading';
import DatePickerInput from '@/components/DatePickerInput';
import { formatDateDDMMYYYY } from '@/lib/date';

export default function AdminTeacherAttendancePage() {
  const { showToast } = useToast();

  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [data, setData] = useState<{
    date: string;
    kpis: {
      totalTeachers: number;
      presentCount: number;
      lateCount: number;
      absentCount: number;
      attendanceRate: number;
    };
    teachers: any[];
  }>({
    date: new Date().toISOString().split('T')[0],
    kpis: {
      totalTeachers: 0,
      presentCount: 0,
      lateCount: 0,
      absentCount: 0,
      attendanceRate: 0,
    },
    teachers: [],
  });

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      if (date) params.append('date', date);
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);
      if (departmentFilter && departmentFilter !== 'ALL') params.append('department', departmentFilter);
      if (search) params.append('search', search);

      const res = await api.get(`/teacher-attendance/admin/today?${params.toString()}`);
      setData(res.data);
    } catch (err: any) {
      console.error('Failed to load teacher attendance:', err);
      setError(true);
      showToast('Failed to load teacher attendance data', 'error');
    } finally {
      setLoading(false);
    }
  }, [date, statusFilter, departmentFilter, search]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const handleExportCsv = () => {
    if (!data.teachers || data.teachers.length === 0) {
      showToast('No records to export', 'error');
      return;
    }

    const headers = ['Teacher Name', 'Employee ID', 'Designation', 'Department', 'Status', 'Check-in Time', 'Scan Source'];
    const rows = data.teachers.map((t) => [
      `"${t.name || ''}"`,
      `"${t.employeeId || ''}"`,
      `"${t.designation || ''}"`,
      `"${t.department || ''}"`,
      `"${t.status || 'ABSENT'}"`,
      `"${t.checkInTime ? new Date(t.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}"`,
      `"${t.scanSource || 'N/A'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Teacher_Attendance_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported attendance report to CSV!', 'success');
  };

  const kpis = data?.kpis || {
    totalTeachers: 0,
    presentCount: 0,
    lateCount: 0,
    absentCount: 0,
    attendanceRate: 0,
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#2E5BFF]" />
            Teacher Attendance Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor daily teacher check-in times, late arrivals, absences, and QR security.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/teachers/attendance/qr"
            className="px-4 py-2.5 bg-[#2E5BFF] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
          >
            <QrCode className="w-4 h-4" />
            Attendance QR Code
          </Link>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export CSV
          </button>

          <button
            onClick={loadAttendance}
            className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Teachers</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-800">{kpis.totalTeachers}</span>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Registered staff</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Present On Time</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-600">{kpis.presentCount}</span>
            <p className="text-[11px] text-emerald-500 font-medium mt-0.5">Checked-in on time</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-amber-100 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Late Arrivals</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-amber-600">{kpis.lateCount}</span>
            <p className="text-[11px] text-amber-500 font-medium mt-0.5">After grace threshold</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-rose-100 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Absent</span>
            <UserX className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-rose-600">{kpis.absentCount}</span>
            <p className="text-[11px] text-rose-400 font-medium mt-0.5">Not marked yet</p>
          </div>
        </div>

        <div className="col-span-2 lg:col-span-1 bg-gradient-to-tr from-slate-900 to-slate-800 text-white rounded-2xl p-4 shadow-md flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Attendance Rate</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-400">{kpis.attendanceRate}%</span>
            <p className="text-[11px] text-slate-400 font-light mt-0.5">Present + Late %</p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Selector */}
          <div className="w-44">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:border-[#2E5BFF] focus:outline-none"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:border-[#2E5BFF] focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="PRESENT">Present</option>
            <option value="LATE">Late</option>
            <option value="ABSENT">Absent</option>
          </select>

          {/* Department Filter */}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:border-[#2E5BFF] focus:outline-none"
          >
            <option value="ALL">All Departments</option>
            <option value="Teaching">Teaching Staff</option>
            <option value="Non-Teaching">Non-Teaching Staff</option>
          </select>
        </div>

        {/* Live Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search teacher or ID..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#2E5BFF] focus:outline-none"
          />
        </div>
      </div>

      {/* Teachers Attendance Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <TableSkeleton
              headers={['Teacher', 'Employee ID', 'Department / Designation', 'Check-in Time', 'Status', 'Scan Source']}
              rows={6}
              loadingLabel="Loading teacher attendance records..."
            />
          ) : error ? (
            <ErrorState
              title="Failed to load attendance"
              message="Could not retrieve attendance records for the selected date."
              onRetry={loadAttendance}
            />
          ) : data.teachers.length === 0 ? (
            <EmptyState
              title="No teacher records found"
              description="No teachers matched your current filter criteria."
            />
          ) : (
            <table className="w-full border-collapse text-left min-w-[700px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-3.5">Teacher</th>
                  <th className="px-4 py-3.5">Employee ID</th>
                  <th className="px-4 py-3.5">Designation / Role</th>
                  <th className="px-4 py-3.5">Check-in Time</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-600">
                {data.teachers.map((t) => {
                  const isPresent = t.status === 'PRESENT';
                  const isLate = t.status === 'LATE';
                  const isAbsent = t.status === 'ABSENT' || !t.status;

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Teacher Profile */}
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs select-none shadow-xs">
                            {t.name ? t.name.charAt(0).toUpperCase() : 'T'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 text-[13px]">{t.name}</div>
                            <div className="text-[11px] text-slate-400">{t.phone || t.email || 'No contact'}</div>
                          </div>
                        </div>
                      </td>

                      {/* Employee ID */}
                      <td className="px-4 py-3.5 font-mono text-slate-600 font-semibold">
                        {t.employeeId || '—'}
                      </td>

                      {/* Designation */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-700">{t.designation || 'Teacher'}</div>
                        <div className="text-[11px] text-slate-400">{t.department}</div>
                      </td>

                      {/* Check-in Time */}
                      <td className="px-4 py-3.5 font-mono">
                        {t.checkInTime ? (
                          <span className="font-bold text-slate-800">
                            {new Date(t.checkInTime).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Not checked in</span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="px-4 py-3.5">
                        {isPresent && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            PRESENT
                          </span>
                        )}
                        {isLate && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            LATE
                          </span>
                        )}
                        {isAbsent && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            ABSENT
                          </span>
                        )}
                      </td>

                      {/* Scan Source */}
                      <td className="px-6 py-3.5 text-right font-mono text-[11px] text-slate-400">
                        {t.scanSource ? (
                          <span className="inline-flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-500" />
                            {t.scanSource === 'IN_APP_SCANNER'
                              ? 'App Scanner'
                              : t.scanSource === 'MOBILE_CAMERA_DEEP_LINK'
                              ? 'Camera Deep Link'
                              : t.scanSource}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
