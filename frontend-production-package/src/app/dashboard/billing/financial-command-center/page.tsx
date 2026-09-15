'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTenant } from '@/app/providers/TenantContext';
import { api } from '@/lib/api';
import { 
  TrendingUp, TrendingDown, DollarSign, Calendar, Users, 
  Briefcase, Activity, AlertTriangle, CheckCircle, ChevronDown, 
  Filter, Download, Printer, ArrowLeft, ArrowUpRight, ArrowDownLeft,
  ShieldAlert, Sparkles, RefreshCw, X, Search, FileText, Landmark
} from 'lucide-react';

export default function FinancialCommandCenter() {
  const { setupStats, currentUser, schoolName } = useTenant();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [selectedAY, setSelectedAY] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [selectedFeeCategory, setSelectedFeeCategory] = useState('');
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Drill-down Modal States
  const [drilldownType, setDrilldownType] = useState<string | null>(null);
  const [drilldownTitle, setDrilldownTitle] = useState('');
  const [drilldownSearch, setDrilldownSearch] = useState('');

  // Access check
  const hasAccess = 
    currentUser?.role === 'SUPER_ADMIN' ||
    currentUser?.role === 'SCHOOL_ADMIN';

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {};
      if (selectedAY) params.academicYearId = selectedAY;
      if (selectedMonth) params.month = selectedMonth;
      if (selectedClass) params.classId = selectedClass;
      if (selectedSection) params.sectionId = selectedSection;
      if (selectedPaymentMethod) params.paymentMethod = selectedPaymentMethod;
      if (selectedFeeCategory) params.feeCategory = selectedFeeCategory;
      if (selectedExpenseCategory) params.expenseCategory = selectedExpenseCategory;
      if (selectedStatus) params.collectionStatus = selectedStatus;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.get('/billing/financial-command-center', { params });
      setData(res.data);
    } catch (err: any) {
      console.error('Failed to load financial command center data', err);
      setError(err.response?.data?.message || 'Access Denied or Failed to fetch analytics data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasAccess) {
      fetchDashboardData();
    }
  }, [
    selectedAY, selectedMonth, selectedClass, selectedSection, 
    selectedPaymentMethod, selectedFeeCategory, selectedExpenseCategory, 
    selectedStatus, startDate, endDate
  ]);

  if (!hasAccess) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200 rounded-3xl m-6">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-4 animate-bounce" />
        <h2 className="text-xl font-extrabold text-slate-800">Access Denied</h2>
        <p className="text-sm text-slate-500 text-center mt-2 max-w-md">
          Only the school Correspondent, Owner, or Super Admin users are authorized to view the Financial Command Center.
        </p>
        <Link 
          href="/dashboard/billing"
          className="mt-6 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md"
        >
          Return to Billing Office
        </Link>
      </div>
    );
  }

  // Exports
  const handleExportCSV = (type: 'revenue' | 'expenses' | 'dues') => {
    if (!data) return;
    let headers: string[] = [];
    let rows: any[][] = [];
    let filename = '';

    if (type === 'revenue') {
      headers = ['ID', 'Student Name', 'Amount (₹)', 'Date', 'Payment Method'];
      rows = data.activities?.latestPayments?.map((p: any) => [p.id, p.studentName, p.amount, p.date, p.method]) || [];
      filename = 'Revenue_Report';
    } else if (type === 'expenses') {
      headers = ['ID', 'Category', 'Amount (₹)', 'Date', 'Mode'];
      rows = data.activities?.latestExpenses?.map((e: any) => [e.id, e.category, e.amount, e.date, e.mode]) || [];
      filename = 'Expenses_Report';
    } else if (type === 'dues') {
      headers = ['Student ID', 'Student Name', 'Roll No', 'Class', 'Section', 'Total Assigned (₹)', 'Paid (₹)', 'Outstanding (₹)'];
      rows = data.insights?.topPendingStudents?.map((d: any) => [d.studentId, d.studentName, d.rollNo, d.className, d.sectionName, d.totalFee, d.paid, d.pending]) || [];
      filename = 'Outstanding_Dues_Report';
    }

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 animate-in print:bg-white print:p-0">
      
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-full-width {
            width: 100% !important;
            grid-template-cols: 1fr !important;
            box-shadow: none !important;
            border: 1px solid #ccc !important;
          }
        }
      `}</style>

      {/* Sticky Header */}
      <div className="sticky top-0 bg-slate-50/95 backdrop-blur-md z-40 border-b border-slate-200 pb-4 pt-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-widest">
            <Landmark className="w-4 h-4" />
            Executive Financial Suite
          </div>
          <h2 className="text-2xl font-black text-slate-900 mt-1">
            Financial Command Center
          </h2>
          <p className="text-slate-500 text-[11px] font-semibold mt-1">
            Real-time financial cockpit for school owner and correspondents of <span className="text-slate-800 font-extrabold">{schoolName}</span>.
          </p>
        </div>
        <div className="flex gap-2 items-center w-full sm:w-auto overflow-x-auto shrink-0 pb-1 sm:pb-0">
          <Link
            href="/dashboard/billing"
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-250 hover:bg-slate-100 text-slate-650 rounded-xl text-xs font-bold transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Billing Office
          </Link>
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`flex items-center gap-1.5 px-3.5 py-2 border rounded-xl text-xs font-bold transition-all ${
              filtersOpen ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-slate-250 hover:bg-slate-100 text-slate-650 bg-white'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters {filtersOpen ? 'Open' : 'Close'}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-950 text-white hover:bg-slate-900 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Command Dashboard
          </button>
        </div>
      </div>

      {/* Dynamic Collapsible Filter Panel */}
      {filtersOpen && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-4 no-print animate-in fade-in slide-in-from-top-4 duration-250">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Academic Year</label>
            <select
              value={selectedAY}
              onChange={(e) => setSelectedAY(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none"
            >
              <option value="">All Academic Years</option>
              {data?.academicYears?.map((ay: any) => (
                <option key={ay.id} value={ay.id}>{ay.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none"
            >
              <option value="">All Months</option>
              <option value="1">January</option>
              <option value="2">February</option>
              <option value="3">March</option>
              <option value="4">April</option>
              <option value="5">May</option>
              <option value="6">June</option>
              <option value="7">July</option>
              <option value="8">August</option>
              <option value="9">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none"
            >
              <option value="">All Classes</option>
              {data?.classes?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Section</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none"
            >
              <option value="">All Sections</option>
              {data?.sections?.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Payment Method</label>
            <select
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none"
            >
              <option value="">All Methods</option>
              <option value="CASH">Physical Cash</option>
              <option value="UPI">GPay/PhonePe/UPI</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CARD">Card Payment</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Custom Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Custom End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none"
            />
          </div>

          <div className="flex items-end no-print">
            <button
              onClick={() => {
                setSelectedAY('');
                setSelectedMonth('');
                setSelectedClass('');
                setSelectedSection('');
                setSelectedPaymentMethod('');
                setSelectedFeeCategory('');
                setSelectedExpenseCategory('');
                setSelectedStatus('');
                setStartDate('');
                setEndDate('');
              }}
              className="w-full border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-500 rounded-xl py-2 text-xs font-bold transition-all"
            >
              Clear All Filters
            </button>
          </div>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 no-print">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-36 bg-white border border-slate-200 rounded-2xl p-6 space-y-4 animate-pulse">
              <div className="h-3 w-2/3 bg-slate-200 rounded"></div>
              <div className="h-8 w-1/2 bg-slate-300 rounded"></div>
              <div className="h-3.5 w-5/6 bg-slate-200 rounded"></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-8 rounded-3xl bg-rose-50 border border-rose-200 text-rose-700 text-center text-sm font-semibold flex flex-col items-center justify-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-rose-600 animate-spin" />
          <div>{error}</div>
          <button 
            onClick={fetchDashboardData} 
            className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all"
          >
            Retry Fetching Data
          </button>
        </div>
      ) : (
        <>
          {/* Real-time Notifications Bar */}
          {data?.notifications?.length > 0 && (
            <div className="space-y-2.5 no-print">
              {data.notifications.map((notif: any, idx: number) => (
                <div 
                  key={idx} 
                  className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-bold ${
                    notif.type === 'CRITICAL' 
                      ? 'bg-rose-50 border-rose-200 text-rose-700' 
                      : notif.type === 'WARNING' 
                        ? 'bg-amber-50 border-amber-200 text-amber-700' 
                        : 'bg-blue-50 border-blue-200 text-blue-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`w-4 h-4 shrink-0 ${notif.type === 'CRITICAL' ? 'text-rose-600 animate-pulse' : 'text-amber-500'}`} />
                    <span>{notif.message}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full uppercase bg-white/50">{notif.type}</span>
                </div>
              ))}
            </div>
          )}

          {/* Section 1 - Core Payment Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            
            {/* Previous Month Collection */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between select-none hover:border-emerald-400 hover:shadow-md transition-all h-36">
              <div className="flex justify-between items-start w-full">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Previous Month Collection</span>
                  <span className="text-2.5xl font-black text-emerald-600 block tracking-tight mt-2.5">
                    ₹{data.summary?.revenue?.prevMonth?.toLocaleString() || '0'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
              </div>
              <div className="border-t border-slate-100 pt-2 text-[10px] font-bold text-slate-500">
                {data.summary?.revenue?.prevMonthInvoicesCount || 0} Paid Invoices
              </div>
            </div>

            {/* Current Month Collection */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between select-none hover:border-emerald-400 hover:shadow-md transition-all h-36">
              <div className="flex justify-between items-start w-full">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Current Month Collection</span>
                  <span className="text-2.5xl font-black text-emerald-600 block tracking-tight mt-2.5">
                    ₹{data.summary?.revenue?.currentMonth?.toLocaleString() || '0'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div className="border-t border-slate-100 pt-2 text-[10px] font-bold text-slate-500">
                {data.summary?.revenue?.currentMonthInvoicesCount || 0} Paid Invoices
              </div>
            </div>

            {/* Total Student Fee Amount */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between select-none hover:border-blue-450 hover:shadow-md transition-all h-36">
              <div className="flex justify-between items-start w-full">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Student Fee</span>
                  <span className="text-2.5xl font-black text-slate-900 block tracking-tight mt-2.5">
                    ₹{((data.summary?.revenue?.academicYear || 0) + (data.summary?.pending?.total || 0)).toLocaleString()}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                  <Landmark className="w-5 h-5" />
                </div>
              </div>
              <div className="border-t border-slate-100 pt-2 text-[10px] font-bold text-slate-500">
                Expected Academic Year Fees
              </div>
            </div>

            {/* Remaining Balance */}
            <div 
              onClick={() => {
                setDrilldownType('pending');
                setDrilldownTitle('Outstanding Student Accounts');
              }}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between cursor-pointer hover:border-rose-450 hover:shadow-md transition-all h-36 select-none"
            >
              <div className="flex justify-between items-start w-full">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Remaining Balance</span>
                  <span className="text-2.5xl font-black text-rose-650 block tracking-tight mt-2.5 font-mono">
                    ₹{data.summary?.pending?.total?.toLocaleString() || '0'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>
              <div className="border-t border-slate-100 pt-2 text-[10px] font-bold text-slate-500">
                {data.summary?.pending?.studentsCount || 0} Students Pending
              </div>
            </div>

            {/* Total Amount Collected */}
            <div 
              onClick={() => {
                setDrilldownType('revenue');
                setDrilldownTitle('Collected Revenue Ledger');
              }}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between cursor-pointer hover:border-emerald-450 hover:shadow-md transition-all h-36 select-none"
            >
              <div className="flex justify-between items-start w-full">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Amount Collected</span>
                  <span className="text-2.5xl font-black text-emerald-600 block tracking-tight mt-2.5 font-mono">
                    ₹{data.summary?.revenue?.academicYear?.toLocaleString() || '0'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                  <CheckCircle className="w-5 h-5" />
                </div>
              </div>
              <div className="border-t border-slate-100 pt-2 text-[10px] font-bold text-slate-500">
                Overall Collected (Academic Year)
              </div>
            </div>

            {/* Collection Progress */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between select-none h-36">
              <div className="flex justify-between items-start w-full">
                <div className="w-full">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Collection Progress</span>
                  
                  <div className="flex justify-between items-baseline mt-2">
                    <span className="text-2xl font-black text-emerald-600">
                      {data.summary?.profit?.collectionRate || 100}%
                    </span>
                    <span className="text-[10px] font-bold text-rose-500">
                      {data.summary?.profit?.pendingPercentage || 0}% Pending
                    </span>
                  </div>
                  
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-2 border border-slate-150">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${data.summary?.profit?.collectionRate || 100}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex justify-between border-t border-slate-50 pt-2">
                <span>Collected</span>
                <span>Pending</span>
              </div>
            </div>

          </div>

          {/* Section 2 - Cash Flow & Profit margin banner */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Cash Flow Panel */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-indigo-500" />
                  <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">Cash Flow Statement</h3>
                </div>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 uppercase">Filtered Period</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Opening Balance</span>
                  <strong className="block text-sm text-slate-700 font-mono">₹{data.summary?.cashFlow?.openingBalance?.toLocaleString()}</strong>
                </div>
                <div className="p-3 bg-emerald-50/50 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" /> Income (+)
                  </span>
                  <strong className="block text-sm text-emerald-600 font-mono">₹{data.summary?.cashFlow?.totalIncome?.toLocaleString()}</strong>
                </div>
                <div className="p-3 bg-rose-50/50 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <ArrowDownLeft className="w-3.5 h-3.5 text-rose-600" /> Expenses (-)
                  </span>
                  <strong className="block text-sm text-rose-600 font-mono font-black">₹{data.summary?.cashFlow?.totalExpenses?.toLocaleString()}</strong>
                </div>
                <div className="p-3 bg-slate-900 text-white rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Closing Balance</span>
                  <strong className="block text-sm font-mono text-white">₹{data.summary?.cashFlow?.closingBalance?.toLocaleString()}</strong>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 flex flex-col sm:flex-row justify-between gap-3 text-xs font-bold text-slate-650">
                <span className="flex items-center gap-1.5">
                  Expected Income: <strong className="text-slate-900 font-mono">₹{data.summary?.cashFlow?.expectedIncome?.toLocaleString()}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  Expected Expenses: <strong className="text-slate-900 font-mono">₹{data.summary?.cashFlow?.expectedExpenses?.toLocaleString()}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  Net Period Cash Flow: 
                  <strong className={`font-mono text-sm font-black ${
                    data.summary?.cashFlow?.netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {data.summary?.cashFlow?.netCashFlow >= 0 ? '+' : ''}₹{data.summary?.cashFlow?.netCashFlow?.toLocaleString()}
                  </strong>
                </span>
              </div>
            </div>

            {/* Financial KPIs Banner */}
            <div className="bg-gradient-to-tr from-slate-900 to-slate-800 text-white border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="font-extrabold text-sm text-slate-350 uppercase tracking-wider">Executive KPIs</h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-indigo-400 uppercase font-black">Annual</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Expense Ratio</span>
                  <strong className="text-sm font-mono text-white block">{data.kpis?.expenseRatio}%</strong>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Net Margin</span>
                  <strong className="text-sm font-mono text-emerald-400 block">{data.kpis?.netMargin}%</strong>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Avg Rev per Student</span>
                  <strong className="text-sm font-mono text-white block">₹{data.kpis?.avgFeePerStudent?.toLocaleString()}</strong>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Outstanding Ratio</span>
                  <strong className="text-sm font-mono text-rose-400 block">{data.kpis?.outstandingRatio}%</strong>
                </div>
              </div>
            </div>

          </div>

          {/* Section 3 - Dynamic Interactive Custom SVG Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Monthly Revenue & Expenses SVG Bar Chart */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">Monthly Revenue & Expenses</h3>
                <span className="text-[10px] font-bold text-slate-400">Last 12 Months</span>
              </div>
              <div className="h-64 relative">
                {/* SVG Render */}
                <svg viewBox="0 0 500 240" className="w-full h-full">
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#1E3A8A" />
                    </linearGradient>
                    <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EF4444" />
                      <stop offset="100%" stopColor="#991B1B" />
                    </linearGradient>
                  </defs>
                  {/* Grid Lines */}
                  <line x1="40" y1="30" x2="480" y2="30" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="40" y1="80" x2="480" y2="80" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="40" y1="130" x2="480" y2="130" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="40" y1="180" x2="480" y2="180" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="40" y1="200" x2="480" y2="200" stroke="#cbd5e1" strokeWidth="1.5" />
                  
                  {/* Draw Bars */}
                  {data?.charts?.incomeVsExpense?.map((item: any, idx: number) => {
                    const maxVal = Math.max(...data.charts.incomeVsExpense.map((i: any) => Math.max(i.income, i.expenses)), 10000);
                    const x = 40 + idx * 36;
                    const hInc = (item.income / maxVal) * 160;
                    const hExp = (item.expenses / maxVal) * 160;
                    
                    return (
                      <g key={idx} className="group cursor-pointer">
                        {/* Income bar */}
                        <rect 
                          x={x} 
                          y={200 - hInc} 
                          width="12" 
                          height={Math.max(hInc, 2)} 
                          fill="url(#revGrad)" 
                          rx="2"
                          className="hover:opacity-85 transition-opacity"
                        >
                          <title>{`Income: ₹${item.income.toLocaleString()}`}</title>
                        </rect>
                        {/* Expense bar */}
                        <rect 
                          x={x + 14} 
                          y={200 - hExp} 
                          width="12" 
                          height={Math.max(hExp, 2)} 
                          fill="url(#expGrad)" 
                          rx="2"
                          className="hover:opacity-85 transition-opacity"
                        >
                          <title>{`Expense: ₹${item.expenses.toLocaleString()}`}</title>
                        </rect>
                        {/* Month text */}
                        <text 
                          x={x + 13} 
                          y="218" 
                          fontSize="7" 
                          fontWeight="bold" 
                          fill="#64748b" 
                          textAnchor="middle"
                        >
                          {item.month}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
              <div className="flex justify-center gap-6 mt-2 text-[10px] font-bold text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-blue-600 block"></span> Income (Billed Collection)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-red-600 block"></span> Expenses
                </span>
              </div>
            </div>

            {/* Daily Collection Trend SVG Line Chart */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">Daily Collection Trend</h3>
                <span className="text-[10px] font-bold text-slate-400">Last 30 Days</span>
              </div>
              <div className="h-64 relative">
                <svg viewBox="0 0 500 240" className="w-full h-full">
                  <defs>
                    <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  
                  {/* Grid Lines */}
                  <line x1="40" y1="30" x2="480" y2="30" stroke="#f8fafc" strokeWidth="1" />
                  <line x1="40" y1="80" x2="480" y2="80" stroke="#f8fafc" strokeWidth="1" />
                  <line x1="40" y1="130" x2="480" y2="130" stroke="#f8fafc" strokeWidth="1" />
                  <line x1="40" y1="180" x2="480" y2="180" stroke="#f8fafc" strokeWidth="1" />
                  <line x1="40" y1="200" x2="480" y2="200" stroke="#cbd5e1" strokeWidth="1.5" />
                  
                  {/* Construct path */}
                  {(() => {
                    const maxVal = Math.max(...data?.charts?.dailyCollectionTrend?.map((d: any) => d.amount) || [1000], 1000);
                    const points = data?.charts?.dailyCollectionTrend?.map((item: any, idx: number) => {
                      const x = 40 + idx * 14.5;
                      const y = 200 - (item.amount / maxVal) * 160;
                      return { x, y, label: item.date, amount: item.amount };
                    }) || [];

                    if (points.length === 0) return null;

                    const linePath = points.map((p: any, idx: number) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                    const areaPath = `${linePath} L ${points[points.length - 1].x} 200 L ${points[0].x} 200 Z`;

                    return (
                      <>
                        {/* Area under line */}
                        <path d={areaPath} fill="url(#lineAreaGrad)" />
                        {/* Main Trend Line */}
                        <path d={linePath} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" />
                        
                        {/* Interactive dots */}
                        {points.map((p: any, idx: number) => (
                          <g key={idx} className="group cursor-pointer">
                            <circle cx={p.x} cy={p.y} r="3" fill="#2563EB" className="group-hover:r-5 group-hover:fill-slate-900 transition-all" />
                            <title>{`${p.label}: ₹${p.amount.toLocaleString()}`}</title>
                            {/* Render date label periodically */}
                            {idx % 5 === 0 && (
                              <text x={p.x} y="218" fontSize="7" fontWeight="bold" fill="#94a3b8" textAnchor="middle">{p.label}</text>
                            )}
                          </g>
                        ))}
                      </>
                    );
                  })()}
                </svg>
              </div>
              <div className="flex justify-center text-[10px] font-bold text-slate-500 mt-2">
                <span>⚡ Real-time Payment Gateway Transactions Feed (₹ Amount)</span>
              </div>
            </div>

          </div>

          {/* Section 4 - Distribution Pies & Class Outstanding */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Payment Methods Distribution */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800 border-b border-slate-100 pb-3 mb-4 uppercase tracking-wider">Payment Channels</h3>
                <div className="h-44 relative flex items-center justify-center">
                  {/* Clean SVG Donut Chart */}
                  <svg viewBox="0 0 100 100" className="w-36 h-36">
                    {(() => {
                      let accumulatedPercent = 0;
                      const colors = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
                      return data?.charts?.paymentMethodsDistribution?.map((item: any, idx: number) => {
                        const radius = 30;
                        const strokeWidth = 14;
                        const circumference = 2 * Math.PI * radius;
                        const dashArray = `${(item.percentage / 100) * circumference} ${circumference}`;
                        const rotation = (accumulatedPercent / 100) * 360;
                        accumulatedPercent += item.percentage;
                        
                        return (
                          <circle
                            key={idx}
                            cx="50"
                            cy="50"
                            r={radius}
                            fill="transparent"
                            stroke={colors[idx % colors.length]}
                            strokeWidth={strokeWidth}
                            strokeDasharray={dashArray}
                            transform={`rotate(${rotation - 90} 50 50)`}
                            className="hover:stroke-[16] transition-all cursor-pointer"
                          >
                            <title>{`${item.method}: ₹${item.amount.toLocaleString()} (${item.percentage}%)`}</title>
                          </circle>
                        );
                      });
                    })()}
                    <circle cx="50" cy="50" r="21" fill="#ffffff" />
                  </svg>
                </div>
              </div>
              
              <div className="space-y-1.5 mt-2">
                {data?.charts?.paymentMethodsDistribution?.map((item: any, idx: number) => {
                  const colors = ['bg-blue-600', 'bg-emerald-500', 'bg-amber-500', 'bg-red-500', 'bg-purple-500'];
                  return (
                    <div key={idx} className="flex justify-between items-center text-xs font-bold text-slate-650">
                      <span className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${colors[idx % colors.length]} block shrink-0`}></span>
                        {item.method}
                      </span>
                      <span className="font-mono">₹{item.amount.toLocaleString()} ({item.percentage}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Expense Categories Distribution */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800 border-b border-slate-100 pb-3 mb-4 uppercase tracking-wider">Expense Categories</h3>
                <div className="h-44 relative flex items-center justify-center">
                  <svg viewBox="0 0 100 100" className="w-36 h-36">
                    {(() => {
                      let accumulatedPercent = 0;
                      const colors = ['#EF4444', '#8B5CF6', '#F59E0B', '#10B981', '#3B82F6', '#EC4899'];
                      return data?.charts?.expenseCategoryAnalysis?.map((item: any, idx: number) => {
                        const radius = 30;
                        const strokeWidth = 14;
                        const circumference = 2 * Math.PI * radius;
                        const dashArray = `${(item.percentage / 100) * circumference} ${circumference}`;
                        const rotation = (accumulatedPercent / 100) * 360;
                        accumulatedPercent += item.percentage;
                        
                        return (
                          <circle
                            key={idx}
                            cx="50"
                            cy="50"
                            r={radius}
                            fill="transparent"
                            stroke={colors[idx % colors.length]}
                            strokeWidth={strokeWidth}
                            strokeDasharray={dashArray}
                            transform={`rotate(${rotation - 90} 50 50)`}
                            className="hover:stroke-[16] transition-all cursor-pointer"
                          >
                            <title>{`${item.categoryName}: ₹${item.amount.toLocaleString()} (${item.percentage}%)`}</title>
                          </circle>
                        );
                      });
                    })()}
                    <circle cx="50" cy="50" r="21" fill="#ffffff" />
                  </svg>
                </div>
              </div>
              
              <div className="space-y-1.5 mt-2 max-h-36 overflow-y-auto pr-1">
                {data?.charts?.expenseCategoryAnalysis?.map((item: any, idx: number) => {
                  const colors = ['bg-red-500', 'bg-purple-500', 'bg-amber-500', 'bg-emerald-500', 'bg-blue-500', 'bg-pink-500'];
                  return (
                    <div key={idx} className="flex justify-between items-center text-xs font-bold text-slate-650">
                      <span className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${colors[idx % colors.length]} block shrink-0`}></span>
                        {item.categoryName}
                      </span>
                      <span className="font-mono">₹{item.amount.toLocaleString()} ({item.percentage}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Outstanding Dues by Class Rankings */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800 border-b border-slate-100 pb-3 mb-3 uppercase tracking-wider">Dues Class Ranking</h3>
                <div className="space-y-3.5 mt-2 max-h-72 overflow-y-auto pr-1">
                  {data?.charts?.outstandingByClass?.slice(0, 8).map((item: any, idx: number) => (
                    <div key={item.classId} className="space-y-1 text-xs">
                      <div className="flex justify-between items-center font-bold text-slate-700">
                        <span>{item.className}</span>
                        <span className="font-mono text-rose-600">₹{item.totalPending.toLocaleString()}</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-rose-500 rounded-full transition-all" 
                          style={{ width: `${100 - item.collectionPercentage}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                        <span>{item.studentCount} Pending Students</span>
                        <span>Collection: {item.collectionPercentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Section 5 - Executive Insights grid & activities timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Executive Insights Cards List */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">Executive Insights</h3>
              </div>
              <div className="divide-y divide-slate-100 text-xs font-bold text-slate-650 space-y-3">
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-450">Highest Paying Class:</span>
                  <strong className="text-slate-900">{data.insights?.executive?.highestPayingClass}</strong>
                </div>
                <div className="flex justify-between py-1.5 pt-3">
                  <span className="text-slate-450">Highest Pending Dues Class:</span>
                  <strong className="text-rose-600">{data.insights?.executive?.highestPendingClass}</strong>
                </div>
                <div className="flex justify-between py-1.5 pt-3">
                  <span className="text-slate-450">Top Revenue Month:</span>
                  <strong className="text-slate-900">{data.insights?.executive?.highestRevenueMonth}</strong>
                </div>
                <div className="flex justify-between py-1.5 pt-3">
                  <span className="text-slate-450">Top Budget Category:</span>
                  <strong className="text-slate-900">{data.insights?.executive?.topExpenseCategory}</strong>
                </div>
                <div className="flex justify-between py-1.5 pt-3">
                  <span className="text-slate-450">Avg Revenue Per Student:</span>
                  <strong className="text-slate-900 font-mono">₹{data.insights?.executive?.averageRevenuePerStudent?.toLocaleString()}</strong>
                </div>
                <div className="flex justify-between py-1.5 pt-3">
                  <span className="text-slate-450">Avg Pending Per Student:</span>
                  <strong className="text-rose-600 font-mono">₹{data.insights?.executive?.averagePendingPerStudent?.toLocaleString()}</strong>
                </div>
              </div>
            </div>

            {/* Top 10 Pending Students & Drill-down triggers */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">Top Unpaid Balances</h3>
                <button 
                  onClick={() => handleExportCSV('dues')}
                  className="p-1 hover:bg-slate-100 text-slate-500 rounded"
                  title="Export Dues List to CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {data.insights?.topPendingStudents?.slice(0, 6).map((student: any) => (
                  <div key={student.studentId} className="flex justify-between items-center text-xs border-b border-slate-50 pb-2">
                    <div>
                      <strong className="text-slate-800 block">{student.studentName}</strong>
                      <span className="text-[10px] text-slate-450">{student.className} - {student.sectionName} · Roll: {student.rollNo}</span>
                    </div>
                    <span className="font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                      ₹{student.pending?.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* School Financial Timeline */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">Institution Timeline</h3>
              </div>
              <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                {data.timeline?.slice(0, 8).map((event: any) => (
                  <div key={event.id} className="relative pl-6 pb-2 last:pb-0 border-l border-slate-200 last:border-l-transparent animate-in fade-in slide-in-from-left-2 duration-200">
                    {/* Circle mark */}
                    <span className={`absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full ${
                      event.type === 'PAYMENT' ? 'bg-emerald-500' :
                      event.type === 'EXPENSE' ? 'bg-rose-500' :
                      event.type === 'ADMISSION' ? 'bg-blue-500' :
                      event.type === 'PROMOTION' ? 'bg-indigo-500' :
                      event.type === 'ROLLBACK' ? 'bg-amber-500' :
                      'bg-slate-400'
                    } block`}></span>
                    
                    <div className="text-xs">
                      <div className="flex justify-between items-start font-bold">
                        <span className="text-slate-800">{event.title}</span>
                        <span className={`font-mono ${
                          event.amount > 0 ? 'text-emerald-600' :
                          event.amount < 0 ? 'text-rose-600' :
                          'text-slate-400'
                        }`}>
                          {event.amount > 0 ? '+' : ''}{event.amount !== 0 ? `₹${Math.abs(event.amount).toLocaleString()}` : '—'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-450 mt-0.5">{event.description}</p>
                      <span className="text-[9px] text-slate-400 font-bold block mt-1">{event.dateStr}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Quick Actions Panel */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 no-print">
            <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">Quick Navigation & Admin Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button 
                onClick={() => {
                  setDrilldownType('revenue');
                  setDrilldownTitle('Collected Revenue Ledger');
                }}
                className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl text-center transition-all group"
              >
                <DollarSign className="w-5 h-5 text-blue-500 mx-auto group-hover:scale-110 transition-all" />
                <span className="block text-xs font-bold text-slate-700 mt-2">Open Transaction History</span>
              </button>
              <Link 
                href="/dashboard/billing"
                className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl text-center transition-all group"
              >
                <Calendar className="w-5 h-5 text-emerald-500 mx-auto group-hover:scale-110 transition-all" />
                <span className="block text-xs font-bold text-slate-700 mt-2">Open Fee Setup</span>
              </Link>
              <button 
                onClick={() => {
                  setDrilldownType('students');
                  setDrilldownTitle('Student Ledger & Accounts');
                }}
                className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl text-center transition-all group"
              >
                <Users className="w-5 h-5 text-amber-500 mx-auto group-hover:scale-110 transition-all" />
                <span className="block text-xs font-bold text-slate-700 mt-2">Open Student Ledger</span>
              </button>
              <button 
                onClick={() => {
                  setDrilldownType('expenses');
                  setDrilldownTitle('Expense Management Directory');
                }}
                className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl text-center transition-all group"
              >
                <Briefcase className="w-5 h-5 text-rose-500 mx-auto group-hover:scale-110 transition-all" />
                <span className="block text-xs font-bold text-slate-700 mt-2">Open Expense Management</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Reusable Drill-down Modal */}
      {drilldownType && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-150 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900">{drilldownTitle}</h3>
                <p className="text-xs text-slate-500 mt-1">Live metrics matching applied filters</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleExportCSV(drilldownType === 'expenses' ? 'expenses' : drilldownType === 'pending' ? 'dues' : 'revenue')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
                <button 
                  onClick={() => setDrilldownType(null)}
                  className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Search Bar */}
            <div className="p-4 border-b border-slate-100 flex items-center bg-white">
              <Search className="w-4 h-4 text-slate-400 mr-2" />
              <input
                type="text"
                placeholder="Search listing by name, category, or keyword..."
                value={drilldownSearch}
                onChange={(e) => setDrilldownSearch(e.target.value)}
                className="w-full text-xs font-bold text-slate-700 outline-none placeholder-slate-400 bg-transparent"
              />
            </div>

            {/* Modal Table Content */}
            <div className="overflow-y-auto p-6 flex-grow bg-white">
              {drilldownType === 'revenue' && (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase pb-3">
                      <th className="py-2.5">Transaction ID</th>
                      <th className="py-2.5">Student Name</th>
                      <th className="py-2.5">Payment Method</th>
                      <th className="py-2.5 text-right">Amount Paid</th>
                      <th className="py-2.5 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-650">
                    {data.activities?.latestPayments
                      ?.filter((p: any) => p.studentName?.toLowerCase().includes(drilldownSearch.toLowerCase()) || p.method?.toLowerCase().includes(drilldownSearch.toLowerCase()))
                      .map((p: any) => (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="py-3 font-mono font-bold text-slate-500">{p.id.slice(-8).toUpperCase()}</td>
                          <td className="py-3 font-black text-slate-800">{p.studentName}</td>
                          <td className="py-3">{p.method}</td>
                          <td className="py-3 text-right text-emerald-600 font-bold font-mono">₹{p.amount.toLocaleString()}</td>
                          <td className="py-3 text-right">{p.date}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}

              {drilldownType === 'expenses' && (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase pb-3">
                      <th className="py-2.5">ID</th>
                      <th className="py-2.5">Category</th>
                      <th className="py-2.5">Payment Mode</th>
                      <th className="py-2.5 text-right">Amount</th>
                      <th className="py-2.5 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-650">
                    {data.insights?.expense?.recentExpenses
                      ?.filter((e: any) => e.category?.toLowerCase().includes(drilldownSearch.toLowerCase()) || e.description?.toLowerCase().includes(drilldownSearch.toLowerCase()))
                      .map((e: any) => (
                        <tr key={e.id} className="hover:bg-slate-50/50">
                          <td className="py-3 font-mono font-bold text-slate-500">{e.id.slice(-8).toUpperCase()}</td>
                          <td className="py-3 font-black text-slate-800">{e.category}</td>
                          <td className="py-3">{e.mode || 'CASH'}</td>
                          <td className="py-3 text-right text-rose-600 font-bold font-mono">₹{e.amount.toLocaleString()}</td>
                          <td className="py-3 text-right">{e.date}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}

              {drilldownType === 'pending' && (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase pb-3">
                      <th className="py-2.5">Student Name</th>
                      <th className="py-2.5">Class/Section</th>
                      <th className="py-2.5 text-right">Assigned (₹)</th>
                      <th className="py-2.5 text-right">Collected (₹)</th>
                      <th className="py-2.5 text-right">Outstanding Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-650">
                    {data.insights?.topPendingStudents
                      ?.filter((s: any) => s.studentName?.toLowerCase().includes(drilldownSearch.toLowerCase()) || s.className?.toLowerCase().includes(drilldownSearch.toLowerCase()))
                      .map((s: any) => (
                        <tr key={s.studentId} className="hover:bg-slate-50/50">
                          <td className="py-3 font-black text-slate-800">{s.studentName}</td>
                          <td className="py-3">{s.className} - {s.sectionName}</td>
                          <td className="py-3 text-right font-mono">₹{s.totalFee?.toLocaleString()}</td>
                          <td className="py-3 text-right font-mono text-emerald-600">₹{s.paid?.toLocaleString()}</td>
                          <td className="py-3 text-right text-rose-600 font-bold font-mono">₹{s.pending?.toLocaleString()}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}

              {drilldownType === 'students' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {data.activities?.latestAdmissions
                    ?.filter((s: any) => s.name?.toLowerCase().includes(drilldownSearch.toLowerCase()) || s.class?.toLowerCase().includes(drilldownSearch.toLowerCase()))
                    .map((s: any) => (
                      <div key={s.id} className="p-4 border border-slate-200 rounded-2xl bg-slate-50/50">
                        <strong className="block text-slate-800 text-sm">{s.name}</strong>
                        <span className="text-[10px] text-slate-400 block mt-1">Class: {s.class}</span>
                        <span className="text-[10px] text-slate-400 block">Admitted On: {s.date}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50">
              <button
                onClick={() => setDrilldownType(null)}
                className="px-4 py-2 border border-slate-250 hover:bg-slate-100 text-slate-650 rounded-xl text-xs font-bold transition-all"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
