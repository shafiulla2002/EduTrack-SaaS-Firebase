'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import BulkImportModal from '@/components/BulkImportModal';
import { api } from '@/lib/api';
import { useSchoolSetupUpdate, dispatchSchoolSetupUpdated } from '@/lib/events';
import { useTenant } from '../providers/TenantContext';
import { BookOpen } from 'lucide-react';

function AdminDashboardOverview() {
  const { setupStats } = useTenant();
  const [admissionsLimit, setAdmissionsLimit] = useState(5);
  const [paymentsLimit, setPaymentsLimit] = useState(5);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const setupStatus = setupStats;
  
  const [stats, setStats] = useState({
    studentsCount: 0,
    teachersCount: 0,
    classesCount: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    netIncome: 0,
    attendanceRate: 0,
    academicAverage: 0,
    pendingLeaveRequests: 0,
    approvedToday: 0,
    rejectedToday: 0,
    trends: {
      students: { value: '0%', isUp: true },
      revenue: { value: '0%', isUp: true },
      attendance: { value: '1.5%', isUp: true },
      academic: { value: '0.8%', isUp: false }
    }
  });
  const [recentAdmissions, setRecentAdmissions] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  const loadDashboardData = useCallback(async () => {
    try {
      const summaryRes = await api.get('/dashboard/summary');

      setStats(summaryRes.data.stats);
      setRecentAdmissions(summaryRes.data.recentAdmissions);
      setRecentPayments(summaryRes.data.recentPayments);
      setChartData(summaryRes.data.chartData);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useSchoolSetupUpdate(loadDashboardData);

  const formatCurrency = (val: number) => {
    return '₹' + val.toLocaleString('en-IN');
  };

  const displayAdmissions = recentAdmissions.slice(0, admissionsLimit);
  const displayPayments = recentPayments.slice(0, paymentsLimit);

  // Calculate max value for chart height scaling
  const maxFinancialVal = Math.max(
    ...chartData.map(d => Math.max(d.feeCollection, d.salaryExpense, d.netRevenue)),
    10000
  );

  return (
    <div className="space-y-6 animate-in">
      {/* Page Header matching LWC layout */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-4">
          <h2 className="text-[28px] font-bold text-slate-900 leading-none">
            Dashboard Overview
          </h2>
          <span className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
            ✨ New Features
          </span>
        </div>
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <Link
            href="/dashboard/billing/setup"
            className="flex-1 sm:flex-none justify-center px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[13px] flex items-center gap-2 transition-all shadow-xs"
          >
            <svg className="w-4 h-4 stroke-slate-500 fill-none" viewBox="0 0 24 24">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            Pricebook Setup
          </Link>
          <Link
            href="/dashboard/admissions"
            className="flex-1 sm:flex-none justify-center px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[13px] flex items-center gap-2 transition-all shadow-xs"
          >
            <svg className="w-4 h-4 stroke-slate-500 fill-none" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            New Admission
          </Link>
          <button
            onClick={() => setIsImportOpen(true)}
            className="w-full sm:w-auto justify-center px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[13px] flex items-center gap-2 transition-all shadow-xs cursor-pointer"
          >
            <svg className="w-4 h-4 stroke-slate-500 fill-none" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Import Students
          </button>
        </div>
      </div>

      {setupStatus && !setupStatus.setupCompleted && showBanner && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm relative">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 stroke-current fill-none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="2"></circle>
                <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2"></line>
                <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2"></line>
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-amber-800 text-sm">School Setup Incomplete</h4>
              <p className="text-amber-700 text-xs mt-0.5 font-light">
                Complete the remaining school profile details to finish activation of your cloud instance.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/setup-checklist"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-amber-500/10 transition-all"
            >
              Complete Setup
            </Link>
            <button
              onClick={() => setShowBanner(false)}
              className="text-amber-400 hover:text-amber-600 transition-colors p-1 cursor-pointer"
            >
              <svg className="w-4 h-4 stroke-current fill-none" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" strokeWidth="2"></line>
                <line x1="6" y1="6" x2="18" y2="18" strokeWidth="2"></line>
              </svg>
            </button>
          </div>
        </div>
      )}

      {setupStatus && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 stroke-blue-600 fill-none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth="2"></circle>
              <polyline points="12 6 12 12 16 14" strokeWidth="2"></polyline>
            </svg>
            Instance Setup Progress
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Completion Rate */}
            <div className="bg-slate-50 border border-slate-200/50 p-4 rounded-xl flex items-center gap-4">
              <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="24" cy="24" r="20" stroke="#e2e8f0" strokeWidth="3.5" fill="transparent" />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="#2563eb"
                    strokeWidth="3.5"
                    fill="transparent"
                    strokeDasharray={`${2 * Math.PI * 20}`}
                    strokeDashoffset={`${2 * Math.PI * 20 * (1 - setupStatus.completionPercentage / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-[11px] font-bold text-slate-700">{setupStatus.completionPercentage}%</span>
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Profile Setup</div>
                <div className="text-xs font-semibold text-slate-800 mt-0.5">
                  {setupStatus.setupCompleted ? 'Completed' : 'Complete Profile'}
                </div>
                {!setupStatus.setupCompleted && (
                  <Link href="/dashboard/setup-checklist" className="text-[11px] text-blue-600 hover:underline font-medium mt-0.5 block">
                    Complete now
                  </Link>
                )}
              </div>
            </div>

            {/* Classes Created */}
            <div className="bg-slate-50 border border-slate-200/50 p-4 rounded-xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg shrink-0">
                {setupStatus.classesCount}
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Classes Created</div>
                <div className="text-xs font-semibold text-slate-800 mt-0.5">
                  {setupStatus.classesCount > 0 ? `${setupStatus.classesCount} Active Class(es)` : 'No classes added'}
                </div>
                <Link href="/dashboard/teachers" className="text-[11px] text-blue-600 hover:underline font-medium mt-0.5 block">
                  Add Classes
                </Link>
              </div>
            </div>

            {/* Teachers Added */}
            <div className="bg-slate-50 border border-slate-200/50 p-4 rounded-xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-lg shrink-0">
                {setupStatus.teachersCount}
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Teachers Added</div>
                <div className="text-xs font-semibold text-slate-800 mt-0.5">
                  {setupStatus.teachersCount > 0 ? `${setupStatus.teachersCount} Faculty Registered` : 'No faculty added'}
                </div>
                <Link href="/dashboard/teachers" className="text-[11px] text-blue-600 hover:underline font-medium mt-0.5 block">
                  Add Teachers
                </Link>
              </div>
            </div>

            {/* Students Added */}
            <div className="bg-slate-50 border border-slate-200/50 p-4 rounded-xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg shrink-0">
                {setupStatus.studentsCount}
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Students Added</div>
                <div className="text-xs font-semibold text-slate-800 mt-0.5">
                  {setupStatus.studentsCount > 0 ? `${setupStatus.studentsCount} Active Student(s)` : 'No students added'}
                </div>
                <Link href="/dashboard/admissions" className="text-[11px] text-blue-600 hover:underline font-medium mt-0.5 block">
                  New Admission
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DYNAMIC KPI STATS GRID - 5 Harmonious Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
        {/* Total Students */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col justify-between h-36 sm:h-40">
          <div className="flex justify-between items-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 stroke-current fill-none" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeWidth="2"></path>
                <circle cx="9" cy="7" r="4" strokeWidth="2"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeWidth="2"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeWidth="2"></path>
              </svg>
            </div>
            <div className={`flex items-center gap-1 text-[10px] sm:text-[12px] font-bold px-2 py-0.5 rounded-md ${stats.trends.students.isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              <svg className="w-3 h-3 stroke-current fill-none" viewBox="0 0 24 24">
                <polyline points={stats.trends.students.isUp ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} strokeWidth="3"></polyline>
              </svg>
              {stats.trends.students.value}
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-[32px] font-extrabold text-slate-800 leading-none">{stats.studentsCount}</div>
            <div className="text-xs sm:text-[14px] text-slate-500 font-semibold mt-1">Total Students</div>
          </div>
          <div className="border-t border-slate-100 pt-2 text-[10px] sm:text-[11px] text-slate-400 font-medium">
            <strong>Real-time</strong> from Org
          </div>
        </div>

        {/* Total Teachers */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col justify-between h-36 sm:h-40">
          <div className="flex justify-between items-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 stroke-current fill-none" viewBox="0 0 24 24">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" strokeWidth="2"></path>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" strokeWidth="2"></path>
              </svg>
            </div>
            <span className="text-[9px] sm:text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 uppercase">Faculty</span>
          </div>
          <div>
            <div className="text-2xl sm:text-[32px] font-extrabold text-slate-800 leading-none">{stats.teachersCount}</div>
            <div className="text-xs sm:text-[14px] text-slate-500 font-semibold mt-1">Total Teachers</div>
          </div>
          <div className="border-t border-slate-100 pt-2 text-[10px] sm:text-[11px] text-slate-400 font-medium">
            <strong>Real-time</strong> from Org
          </div>
        </div>

        {/* Total Classes */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col justify-between h-36 sm:h-40">
          <div className="flex justify-between items-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 stroke-current fill-none" viewBox="0 0 24 24">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeWidth="2"></path>
                <polyline points="9 22 9 12 15 12 15 22" strokeWidth="2"></polyline>
              </svg>
            </div>
            <span className="text-[9px] sm:text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 uppercase">Academics</span>
          </div>
          <div>
            <div className="text-2xl sm:text-[32px] font-extrabold text-slate-800 leading-none">{stats.classesCount}</div>
            <div className="text-xs sm:text-[14px] text-slate-500 font-semibold mt-1">Total Classes</div>
          </div>
          <div className="border-t border-slate-100 pt-2 text-[10px] sm:text-[11px] text-slate-400 font-medium">
            <strong>Real-time</strong> from Org
          </div>
        </div>

        {/* Average Attendance */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col justify-between h-36 sm:h-40">
          <div className="flex justify-between items-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 stroke-current fill-none" viewBox="0 0 24 24">
                <line x1="18" y1="20" x2="18" y2="10" strokeWidth="2"></line>
                <line x1="12" y1="20" x2="12" y2="4" strokeWidth="2"></line>
                <line x1="6" y1="20" x2="6" y2="14" strokeWidth="2"></line>
              </svg>
            </div>
            <div className="flex items-center gap-1 text-[10px] sm:text-[12px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600">
              <svg className="w-3 h-3 stroke-current fill-none" viewBox="0 0 24 24">
                <polyline points="18 15 12 9 6 15" strokeWidth="3"></polyline>
              </svg>
              {stats.trends.attendance.value}
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-[32px] font-extrabold text-slate-800 leading-none">{stats.attendanceRate}%</div>
            <div className="text-xs sm:text-[14px] text-slate-500 font-semibold mt-1">Average Attendance</div>
          </div>
          <div className="border-t border-slate-100 pt-2 text-[10px] sm:text-[11px] text-slate-400 font-medium">
            <strong>Real-time</strong> from Org
          </div>
        </div>

        {/* Central Leave Requests */}
        <Link 
          href="/dashboard/leave-mgmt"
          className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col justify-between h-36 sm:h-40 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer text-left"
        >
          <div className="flex justify-between items-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <svg className="icon-svg w-5 h-5 sm:w-6 sm:h-6 stroke-current fill-none" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2"></line>
                <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2"></line>
                <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2"></line>
              </svg>
            </div>
            {stats.pendingLeaveRequests > 0 && (
              <span className="text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 animate-pulse">
                {stats.pendingLeaveRequests} Pending
              </span>
            )}
          </div>
          <div>
            <div className="text-2xl sm:text-[32px] font-extrabold text-slate-800 leading-none">
              {stats.pendingLeaveRequests || 0}
            </div>
            <div className="text-xs sm:text-[14px] text-slate-500 font-semibold mt-1">Pending Leaves</div>
          </div>
          <div className="border-t border-slate-100 pt-2 flex justify-between text-[9px] sm:text-[10px] text-slate-400 font-semibold uppercase">
            <span>Appr: {stats.approvedToday || 0}</span>
            <span>Rej: {stats.rejectedToday || 0}</span>
          </div>
        </Link>
      </div>

      {/* SECTION GRID - admissions and transaction lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RECENT ADMISSIONS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col justify-between h-[450px]">
          <div>
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
              <div className="text-[16px] font-bold text-slate-800 flex items-center gap-2">
                <svg className="w-5 h-5 stroke-[#2E5BFF] fill-none" viewBox="0 0 24 24">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeWidth="2"></path>
                  <circle cx="9" cy="7" r="4" strokeWidth="2"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeWidth="2"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeWidth="2"></path>
                </svg>
                Recent Admissions
              </div>
              <div className="flex gap-2">
                {admissionsLimit > 5 && (
                  <button
                    onClick={() => setAdmissionsLimit(5)}
                    className="px-3 py-1 bg-slate-50 hover:bg-slate-100 text-slate-500 font-semibold text-[12px] rounded-lg transition-colors border border-slate-200 cursor-pointer"
                  >
                    Show Less
                  </button>
                )}
                {admissionsLimit < recentAdmissions.length && (
                  <button
                    onClick={() => setAdmissionsLimit(prev => prev + 5)}
                    className="px-3 py-1 bg-slate-50 hover:bg-slate-100 text-slate-500 font-semibold text-[12px] rounded-lg transition-colors border border-slate-200 cursor-pointer"
                  >
                    Show More
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto overflow-x-auto max-h-[320px] border border-slate-100 rounded-xl w-full">
              {displayAdmissions.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs italic">No recent admissions found.</div>
              ) : (
                <table className="w-full border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Student</th>
                      <th className="px-4 py-3 text-left">Roll No</th>
                      <th className="px-4 py-3 text-left">Class</th>
                      <th className="px-4 py-3 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[13px] text-slate-600 font-medium">
                    {displayAdmissions.map((adm) => (
                      <tr key={adm.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-500 to-indigo-500 text-white flex items-center justify-center font-bold text-xs select-none">
                              {adm.avatar}
                            </div>
                            <div className="font-semibold text-slate-800">{adm.name}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-mono">{adm.rollNo}</td>
                        <td className="px-4 py-3 text-slate-500">{adm.class}</td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">{adm.joiningDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* RECENT PAYMENTS / TRANSACTIONS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col justify-between h-[450px]">
          <div>
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
              <div className="text-[16px] font-bold text-slate-800 flex items-center gap-2">
                <svg className="w-5 h-5 stroke-[#2E5BFF] fill-none" viewBox="0 0 24 24">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" strokeWidth="2"></rect>
                  <line x1="1" y1="10" x2="23" y2="10" strokeWidth="2"></line>
                </svg>
                Recent Transactions
              </div>
              <div className="flex gap-2">
                {paymentsLimit > 5 && (
                  <button
                    onClick={() => setPaymentsLimit(5)}
                    className="px-3 py-1 bg-slate-50 hover:bg-slate-100 text-slate-500 font-semibold text-[12px] rounded-lg transition-colors border border-slate-200 cursor-pointer"
                  >
                    Show Less
                  </button>
                )}
                {paymentsLimit < recentPayments.length && (
                  <button
                    onClick={() => setPaymentsLimit(prev => prev + 5)}
                    className="px-3 py-1 bg-slate-50 hover:bg-slate-100 text-slate-500 font-semibold text-[12px] rounded-lg transition-colors border border-slate-200 cursor-pointer"
                  >
                    Show More
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto overflow-x-auto max-h-[320px] border border-slate-100 rounded-xl w-full">
              {displayPayments.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs italic">No transactions found.</div>
              ) : (
                <table className="w-full border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-left">Particulars</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[13px] text-slate-600 font-medium">
                    {displayPayments.map((pay) => (
                      <tr key={pay.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border uppercase ${
                            pay.type === 'Fee Payment'
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                              : 'bg-rose-50 text-rose-600 border-rose-100'
                          }`}>
                            {pay.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-800 truncate max-w-[150px]" title={pay.name}>{pay.name}</td>
                        <td className={`px-4 py-3 font-bold font-mono text-right ${
                          pay.type === 'Fee Payment' ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {pay.type === 'Fee Payment' ? '+' : '-'}{formatCurrency(pay.amount)}
                        </td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">{pay.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-[16px] font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-4 mb-4">
          <svg className="w-5 h-5 stroke-[#2E5BFF] fill-none" viewBox="0 0 24 24">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" strokeWidth="2"></polygon>
          </svg>
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <button onClick={() => alert('Dispatched emergency alert SMS to students registry.')} className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-blue-50 hover:text-[#2E5BFF] rounded-xl border border-slate-200 transition-all gap-2 group h-24">
            <svg className="w-6 h-6 stroke-slate-500 group-hover:stroke-[#2E5BFF] fill-none" viewBox="0 0 24 24">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" strokeWidth="2"></rect>
              <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2"></line>
            </svg>
            <span className="text-xs font-bold text-slate-700 group-hover:text-[#2E5BFF]">Send SMS Alert</span>
          </button>

          <button onClick={() => alert('Aggregated academic report card grades. Sent PDFs to guardians.')} className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-blue-50 hover:text-[#2E5BFF] rounded-xl border border-slate-200 transition-all gap-2 group h-24">
            <svg className="w-6 h-6 stroke-slate-500 group-hover:stroke-[#2E5BFF] fill-none" viewBox="0 0 24 24">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" strokeWidth="2"></path>
              <polyline points="22,6 12,13 2,6" strokeWidth="2"></polyline>
            </svg>
            <span className="text-xs font-bold text-slate-700 group-hover:text-[#2E5BFF]">Email Report Card</span>
          </button>

          <Link href="/dashboard/billing" className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-blue-50 hover:text-[#2E5BFF] rounded-xl border border-slate-200 transition-all gap-2 group h-24">
            <svg className="w-6 h-6 stroke-slate-500 group-hover:stroke-[#2E5BFF] fill-none" viewBox="0 0 24 24">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" strokeWidth="2"></rect>
              <line x1="1" y1="10" x2="23" y2="10" strokeWidth="2"></line>
            </svg>
            <span className="text-xs font-bold text-slate-700 group-hover:text-[#2E5BFF]">Process Payment</span>
          </Link>

          <Link href="/dashboard/reports" className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-blue-50 hover:text-[#2E5BFF] rounded-xl border border-slate-200 transition-all gap-2 group h-24">
            <svg className="w-6 h-6 stroke-slate-500 group-hover:stroke-[#2E5BFF] fill-none" viewBox="0 0 24 24">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83" strokeWidth="2"></path>
              <path d="M22 12A10 10 0 0 0 12 2v10z" strokeWidth="2"></path>
            </svg>
            <span className="text-xs font-bold text-slate-700 group-hover:text-[#2E5BFF]">Generate Analytics</span>
          </Link>
        </div>
      </div>

      {/* ROADMAP CARD */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-[16px] font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-4 mb-4">
          <span>✨</span>
          Trending Features & Roadmap
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex gap-3 items-start">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2E5BFF] flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 stroke-current fill-none" viewBox="0 0 24 24">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" strokeWidth="2"></rect>
                <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2"></line>
              </svg>
            </div>
            <div>
              <h4 className="text-[14px] font-bold text-slate-850 flex items-center gap-2">
                Parent Mobile App
                <span className="bg-emerald-50 text-[#00C48C] text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-100">Live Now</span>
              </h4>
              <p className="text-slate-500 text-xs mt-1 font-light leading-relaxed">
                Real-time updates on attendance, grades, and fee payments.
              </p>
            </div>
          </div>

          <div className="flex gap-3 items-start">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#8B5CF6] flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 stroke-current fill-none" viewBox="0 0 24 24">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeWidth="2"></path>
                <circle cx="12" cy="13" r="4" strokeWidth="2"></circle>
              </svg>
            </div>
            <div>
              <h4 className="text-[14px] font-bold text-slate-850 flex items-center gap-2">
                Face Recognition
                <span className="bg-purple-50 text-[#8B5CF6] text-[10px] font-bold px-2 py-0.5 rounded border border-purple-100">Beta</span>
              </h4>
              <p className="text-slate-500 text-xs mt-1 font-light leading-relaxed">
                Automated attendance marking using facial recognition.
              </p>
            </div>
          </div>

          <div className="flex gap-3 items-start">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#00C48C] flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 stroke-current fill-none" viewBox="0 0 24 24">
                <line x1="12" y1="1" x2="12" y2="23" strokeWidth="2"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeWidth="2"></path>
              </svg>
            </div>
            <div>
              <h4 className="text-[14px] font-bold text-slate-850 flex items-center gap-2">
                Auto-Debit Setup
                <span className="bg-indigo-50 text-indigo-500 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-100">Premium</span>
              </h4>
              <p className="text-slate-500 text-xs mt-1 font-light leading-relaxed">
                Automated quarterly fee deduction with UPI autopay.
              </p>
            </div>
          </div>
        </div>
      </div>

      <BulkImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportSuccess={(count) => {
          alert(`Successfully imported ${count} student records!`);
          dispatchSchoolSetupUpdated();
        }}
      />
    </div>
  );
}

function TeacherDashboardView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await api.get('/teacher-portal/dashboard');
        setData(res.data);
      } catch (err) {
        console.error('Failed to load teacher stats:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-4 border-t-blue-600 border-slate-200 rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500">Loading Portal Dashboard...</p>
      </div>
    );
  }

  const statsList = [
    { name: 'Assigned Students', val: data?.stats?.assignedStudents || 0, desc: 'Across all sections', icon: '👥', color: 'from-blue-500 to-indigo-500' },
    { name: 'Attendance Rate', val: `${data?.stats?.attendanceRate || 100}%`, desc: 'Average active rate', icon: '📈', color: 'from-emerald-500 to-teal-500' },
    { name: 'Pending Marks', val: data?.stats?.marksPending || 0, desc: 'Exams awaiting review', icon: '📝', color: 'from-amber-500 to-orange-500' },
    { name: 'Homework Created', val: data?.stats?.homeworkCreated || 0, desc: 'Assignments sent', icon: '📚', color: 'from-pink-500 to-rose-500' },
  ];

  return (
    <div className="space-y-6 max-w-md mx-auto sm:max-w-none">
      {/* Welcome header */}
      <div className="bg-gradient-to-tr from-[#1E293B] to-[#0F172A] p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-[20%] right-[-10%] w-[150px] h-[150px] rounded-full bg-blue-500/10 blur-xl pointer-events-none" />
        <h2 className="text-xl font-bold tracking-tight">Hello Teacher! 👋</h2>
        <p className="text-[13px] text-slate-300 font-light mt-1">Here is your timeline schedule and tasks overview for today.</p>
        
        {/* Today status badges */}
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-700/50">
          <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/30">
            <span className="text-[11px] text-slate-400 font-bold block uppercase">Attendance Pending</span>
            <span className="text-lg font-black text-amber-400">{data?.today?.attendancePending || 0} Classes</span>
          </div>
          <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/30">
            <span className="text-[11px] text-slate-400 font-bold block uppercase">Homework Pending</span>
            <span className="text-lg font-black text-rose-400">{data?.today?.homeworkPending || 0} Active</span>
          </div>
        </div>
      </div>

      {/* Quick Action Grid */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <h3 className="text-[15px] font-bold text-slate-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-3 gap-4">
          <Link href="/dashboard/attendance-mgmt" className="flex flex-col items-center justify-center p-3 hover:bg-slate-50 rounded-2xl transition-all gap-1.5 group cursor-pointer text-center">
            <div className="w-12 h-12 rounded-xl bg-blue-55 text-blue-600 flex items-center justify-center shadow-xs">
              <span className="text-lg">📅</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-600">Attendance</span>
          </Link>
          <Link href="/dashboard/marks-mgmt" className="flex flex-col items-center justify-center p-3 hover:bg-slate-50 rounded-2xl transition-all gap-1.5 group cursor-pointer text-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-55 text-emerald-600 flex items-center justify-center shadow-xs">
              <span className="text-lg">✍️</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-600">Enter Marks</span>
          </Link>
          <Link href="/dashboard/homework" className="flex flex-col items-center justify-center p-3 hover:bg-slate-50 rounded-2xl transition-all gap-1.5 group cursor-pointer text-center">
            <div className="w-12 h-12 rounded-xl bg-purple-55 text-purple-600 flex items-center justify-center shadow-xs">
              <span className="text-lg">📖</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-600">Homework</span>
          </Link>
          <Link href="/dashboard/communication" className="flex flex-col items-center justify-center p-3 hover:bg-slate-50 rounded-2xl transition-all gap-1.5 group cursor-pointer text-center">
            <div className="w-12 h-12 rounded-xl bg-pink-55 text-pink-600 flex items-center justify-center shadow-xs">
              <span className="text-lg">💬</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-600">Messages</span>
          </Link>
          <Link href="/dashboard/my-timetable" className="flex flex-col items-center justify-center p-3 hover:bg-slate-50 rounded-2xl transition-all gap-1.5 group cursor-pointer text-center">
            <div className="w-12 h-12 rounded-xl bg-amber-55 text-amber-600 flex items-center justify-center shadow-xs">
              <span className="text-lg">⏰</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-600">Timetable</span>
          </Link>
          <Link href="/dashboard/calendar" className="flex flex-col items-center justify-center p-3 hover:bg-slate-50 rounded-2xl transition-all gap-1.5 group cursor-pointer text-center">
            <div className="w-12 h-12 rounded-xl bg-teal-55 text-teal-600 flex items-center justify-center shadow-xs">
              <span className="text-lg">🗓️</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-600">Calendar</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {statsList.map((stat, idx) => (
          <div key={idx} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-32">
            <div className="flex justify-between items-center">
              <span className="text-2xl">{stat.icon}</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Metrics</span>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-800 leading-none">{stat.val}</div>
              <div className="text-[12px] font-bold text-slate-600 mt-1">{stat.name}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Today's Classes List */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[15px] font-bold text-slate-800">Today's Class Schedule</h3>
          <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-md">Today</span>
        </div>
        
        {data?.today?.classes?.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs italic">No teaching periods scheduled for today.</div>
        ) : (
          <div className="space-y-3">
            {data?.today?.classes?.map((cls: any) => (
              <div key={cls.id} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-sm text-slate-800">{cls.className}</h4>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{cls.subjectName} • Period {cls.periodNumber}</p>
                  <p className="text-[11px] text-slate-400 font-mono mt-1">{cls.time}</p>
                </div>
                <Link
                  href={`/dashboard/homework?classSectionId=${encodeURIComponent(cls.classSectionId)}&subjectId=${encodeURIComponent(cls.subjectId || '')}&subjectName=${encodeURIComponent(cls.subjectName)}&className=${encodeURIComponent(cls.className)}&periodNumber=${encodeURIComponent(cls.periodNumber || '')}&create=true`}
                  className="px-3.5 py-1.5 bg-[#2E5BFF] hover:bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Assign Homework
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming events / Notice Board */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <h3 className="text-[15px] font-bold text-slate-800 mb-4">Notice Board & Announcements</h3>
        {data?.today?.events?.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs italic">No high-priority announcements at the moment.</div>
        ) : (
          <div className="space-y-4">
            {data?.today?.events?.map((ev: any) => (
              <div key={ev.id} className="border-l-4 border-amber-500 pl-3">
                <h4 className="text-sm font-bold text-slate-800">{ev.title}</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{ev.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import DriverTransportTrackerPage from './transport-tracker/page';

export default function DashboardOverview() {
  const { currentUser } = useTenant();

  const isDriver = currentUser?.role === 'DRIVER' || currentUser?.staffProfile?.staffRole === 'Driver' || currentUser?.staffProfile?.designation?.toLowerCase().includes('driver');

  if (isDriver) {
    return <DriverTransportTrackerPage />;
  }

  if (currentUser?.role === 'TEACHER') {
    return <TeacherDashboardView />;
  }

  return <AdminDashboardOverview />;
}
