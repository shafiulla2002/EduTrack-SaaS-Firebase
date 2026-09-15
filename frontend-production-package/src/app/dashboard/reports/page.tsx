'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, BarChart2, PieChart, Download, CheckCircle2, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';

interface DemographicsData {
  totalStudents: number;
  classDistribution: Record<string, number>;
  timeline: { date: string; count: number }[];
}

interface FinancialsData {
  totalRevenue: number;
  outstandingReceivables: number;
  totalExpenses: number;
  netCashflow: number;
}

interface GradingData {
  averageScore: number;
  passRate: number;
  distribution: {
    failed: number;
    belowAverage: number;
    average: number;
    firstDivision: number;
    highDistinction: number;
  };
}

interface ReportsSummary {
  demographics: DemographicsData;
  financials: FinancialsData;
  grading: GradingData;
}

export default function ReportsAnalyticsPage() {
  const [reportsData, setReportsData] = useState<ReportsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportType, setExportType] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const fetchReportsData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/dashboard/reports');
      setReportsData(res.data);
    } catch (err) {
      console.error('Error loading reports details:', err);
      setError('Failed to fetch real-time reports analytics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReportsData();
  }, []);

  const triggerExport = async (type: 'demographics' | 'cashflows' | 'grading', label: string) => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const res = await api.get(`/dashboard/reports/${type}`);
      const data = res.data;

      if (!data || data.length === 0) {
        alert('No records available to export.');
        return;
      }

      // Generate CSV
      const headers = Object.keys(data[0]).join(',');
      const rows = data.map((row: any) => 
        Object.values(row)
          .map(val => `"${String(val).replace(/"/g, '""')}"`)
          .join(',')
      );
      
      const csvContent = "\uFEFF" + [headers, ...rows].join('\n'); // Add BOM for Excel compatibility
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${type}_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportType(label);
      setExportSuccess(true);
      setTimeout(() => {
        setExportSuccess(false);
        setExportType('');
      }, 3000);
    } catch (err) {
      console.error(`Error exporting ${type} report:`, err);
      alert(`Failed to export ${label}`);
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm">Fetching real-time analytics...</p>
      </div>
    );
  }

  if (error || !reportsData) {
    return (
      <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-center max-w-lg mx-auto">
        <p className="font-bold text-sm">Error Loading Reports</p>
        <p className="text-xs mt-1 text-rose-600">{error || 'An unexpected error occurred'}</p>
        <button
          onClick={fetchReportsData}
          className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Calculate Curve distribution points
  const dist = reportsData.grading.distribution;
  const vals = [dist.failed, dist.belowAverage, dist.average, dist.firstDivision, dist.highDistinction];
  const maxVal = Math.max(...vals, 1);

  const yFailed = 230 - (dist.failed / maxVal) * 170;
  const yBelowAverage = 230 - (dist.belowAverage / maxVal) * 170;
  const yAverage = 230 - (dist.average / maxVal) * 170;
  const yFirstDivision = 230 - (dist.firstDivision / maxVal) * 170;
  const yHighDistinction = 230 - (dist.highDistinction / maxVal) * 170;

  const totalClasses = Object.keys(reportsData.demographics.classDistribution).length;

  return (
    <div className="space-y-8 relative">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Scholastic Reports & Analytics
          </h1>
          <p className="text-slate-500 text-sm font-normal mt-1">
            Aggregate student rosters, performance grading averages, and school financial statements.
          </p>
        </div>
        <button
          onClick={fetchReportsData}
          className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
        </button>
      </div>

      {exportSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 text-sm animate-pulse">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <span className="font-bold">Roster Exported!</span> Compiled {exportType} report stream downloaded successfully.
          </div>
        </div>
      )}

      {/* Grid of Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Report 1 */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl flex flex-col justify-between hover:border-blue-500/30 hover:shadow-lg transition-all duration-300 shadow-xs h-64">
          <div className="space-y-4">
            <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600">
              <LineChart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Enrollment Demographics</h3>
              <p className="text-slate-500 text-xs font-normal leading-relaxed mt-1.5">
                Manage {reportsData.demographics.totalStudents} total students enrolled across {totalClasses} classes, section distribution limits, and enrollment trends.
              </p>
            </div>
          </div>
          <button
            onClick={() => triggerExport('demographics', 'Enrollment CSV')}
            disabled={isExporting}
            className="w-full py-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-600 border border-slate-200 hover:border-blue-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-200"
          >
            <Download className="w-4 h-4" />
            Export Demographics CSV
          </button>
        </div>

        {/* Report 2 */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl flex flex-col justify-between hover:border-blue-500/30 hover:shadow-lg transition-all duration-300 shadow-xs h-64">
          <div className="space-y-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Financial Cashflows Statement</h3>
              <p className="text-slate-500 text-xs font-normal leading-relaxed mt-1.5">
                Revenue collected: ₹{reportsData.financials.totalRevenue.toLocaleString()}. Outstanding balance: ₹{reportsData.financials.outstandingReceivables.toLocaleString()}. Salaries & operating costs: ₹{reportsData.financials.totalExpenses.toLocaleString()}.
              </p>
            </div>
          </div>
          <button
            onClick={() => triggerExport('cashflows', 'Financial Cashflows PDF')}
            disabled={isExporting}
            className="w-full py-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-600 border border-slate-200 hover:border-blue-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-200"
          >
            <Download className="w-4 h-4" />
            Export Cashflows Ledger
          </button>
        </div>

        {/* Report 3 */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl flex flex-col justify-between hover:border-blue-500/30 hover:shadow-lg transition-all duration-300 shadow-xs h-64">
          <div className="space-y-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Grading Averages & GPAs</h3>
              <p className="text-slate-500 text-xs font-normal leading-relaxed mt-1.5">
                School average grading score is {reportsData.grading.averageScore}% with a passing rate of {reportsData.grading.passRate}%. Tracks subject-wise mark curves and GPAs.
              </p>
            </div>
          </div>
          <button
            onClick={() => triggerExport('grading', 'Academic GPA Spreadsheet')}
            disabled={isExporting}
            className="w-full py-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-600 border border-slate-200 hover:border-blue-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-200"
          >
            <Download className="w-4 h-4" />
            Export Grading Spreadsheet
          </button>
        </div>
      </div>

      {/* Analytics Chart SVG Graphics Section */}
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-6">
        <div>
          <h3 className="font-bold text-slate-800 text-base">Grading Mark Curve Distribution</h3>
          <p className="text-slate-500 text-xs font-normal">Real-time performance scores spread (Counts of student marks registered in database)</p>
        </div>

        <div className="h-60 w-full relative mt-4">
          <svg className="w-full h-full" viewBox="0 0 600 240" preserveAspectRatio="none">
            {/* Grid background */}
            <line x1="0" y1="60" x2="600" y2="60" stroke="#f1f5f9" strokeDasharray="5,5" strokeWidth="0.8" />
            <line x1="0" y1="120" x2="600" y2="120" stroke="#f1f5f9" strokeDasharray="5,5" strokeWidth="0.8" />
            <line x1="0" y1="180" x2="600" y2="180" stroke="#f1f5f9" strokeDasharray="5,5" strokeWidth="0.8" />
            <line x1="0" y1="240" x2="600" y2="240" stroke="#cbd5e1" strokeWidth="1" />

            {/* Custom SVG Curve */}
            <path
              d={`M 60,${yFailed} L 180,${yBelowAverage} L 300,${yAverage} L 420,${yFirstDivision} L 540,${yHighDistinction}`}
              fill="none"
              stroke="#6366f1"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Glow below curve */}
            <path
              d={`M 60,${yFailed} L 180,${yBelowAverage} L 300,${yAverage} L 420,${yFirstDivision} L 540,${yHighDistinction} L 540,240 L 60,240 Z`}
              fill="url(#chartGlowGrad)"
              opacity="0.1"
            />
            <defs>
              <linearGradient id="chartGlowGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Circle markers */}
            <circle cx="60" cy={yFailed} r="6" fill="#6366f1" stroke="#ffffff" strokeWidth="3" />
            <circle cx="180" cy={yBelowAverage} r="6" fill="#6366f1" stroke="#ffffff" strokeWidth="3" />
            <circle cx="300" cy={yAverage} r="6" fill="#6366f1" stroke="#ffffff" strokeWidth="3" />
            <circle cx="420" cy={yFirstDivision} r="6" fill="#6366f1" stroke="#ffffff" strokeWidth="3" />
            <circle cx="540" cy={yHighDistinction} r="6" fill="#6366f1" stroke="#ffffff" strokeWidth="3" />
          </svg>
          {/* Legend tags */}
          <div className="absolute top-[30px] left-[260px] bg-slate-900 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold shadow-md">
            Mean Exam Average: {reportsData.grading.averageScore}%
          </div>
        </div>
        
        {/* Horizontal scale */}
        <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold px-2">
          <span className="flex flex-col items-center">
            <span>Failed (&lt;35)</span>
            <span className="text-[9px] font-bold text-rose-500 mt-0.5">{dist.failed} students</span>
          </span>
          <span className="flex flex-col items-center">
            <span>Below average (35-60)</span>
            <span className="text-[9px] font-bold text-amber-500 mt-0.5">{dist.belowAverage} students</span>
          </span>
          <span className="flex flex-col items-center">
            <span>Average (60-75)</span>
            <span className="text-[9px] font-bold text-indigo-500 mt-0.5">{dist.average} students</span>
          </span>
          <span className="flex flex-col items-center">
            <span>First Division (75-90)</span>
            <span className="text-[9px] font-bold text-blue-500 mt-0.5">{dist.firstDivision} students</span>
          </span>
          <span className="flex flex-col items-center">
            <span>High Distinction (90-100)</span>
            <span className="text-[9px] font-bold text-emerald-500 mt-0.5">{dist.highDistinction} students</span>
          </span>
        </div>
      </div>
    </div>
  );
}
