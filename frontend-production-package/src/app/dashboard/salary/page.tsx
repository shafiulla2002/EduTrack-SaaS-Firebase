'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  DollarSign, 
  ShieldCheck,
  PlusCircle,
  MinusCircle,
  TrendingUp,
  Percent,
  Eye, 
  Download, 
  Printer
} from 'lucide-react';
import { api } from '@/lib/api';

interface SalaryDetails {
  basicSalary: number;
  allowances: number;
  deductions: number;
  pfDeduction: number;
  bonus: number;
  netSalary: number;
  paymentStatus: string;
  paymentDate: string;
  salaryMonth: string;
  payrollReference: string;
  employeeId: string;
  designation: string;
}

interface SalaryHistoryItem {
  id: string;
  salaryMonth: string;
  paymentDate: string;
  grossSalary: number;
  deductions: number;
  pfDeduction: number;
  bonus: number;
  netSalary: number;
  paymentStatus: string;
  paymentMethod: string;
  transactionReference: string;
}

export default function TeacherSalaryPage() {
  const router = useRouter();
  const [details, setDetails] = useState<SalaryDetails | null>(null);
  const [history, setHistory] = useState<SalaryHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSalaryData = async () => {
      try {
        setIsLoading(true);
        const [detailsRes, historyRes] = await Promise.all([
          api.get('/teacher-portal/salary/details'),
          api.get('/teacher-portal/salary/history')
        ]);
        setDetails(detailsRes.data);
        setHistory(historyRes.data);
      } catch (err: any) {
        console.error('Failed to load salary/payroll data', err);
        setError(err.response?.data?.message || err.message || 'Failed to fetch payroll records.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchSalaryData();
  }, []);

  if (isLoading) {
    return (
      <div className="p-6 flex flex-col gap-6 max-w-7xl mx-auto">
        <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Salary & Payslips</h1>
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="w-10 h-10 border-4 border-t-blue-600 border-r-indigo-500 border-b-purple-500 border-l-slate-250 dark:border-l-slate-700 rounded-full animate-spin"></div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-4">Loading payroll information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex flex-col gap-6 max-w-7xl mx-auto">
        <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Salary & Payslips</h1>
        <div className="p-6 text-center bg-rose-50 dark:bg-rose-950/20 border border-rose-250 rounded-2xl">
          <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{error}</p>
        </div>
      </div>
    );
  }

  const hasSalary = details && details.payrollReference !== 'N/A';

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-slate-50 leading-none">Salary & Payslips</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
            Access secure pay structures, deductions, and downloadable payslips.
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">
            Confidential Portal
          </span>
        </div>
      </div>

      {/* Salary Dashboard Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Basic Salary */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 dark:bg-blue-950/40 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <DollarSign className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Basic Salary</div>
            <div className="text-base font-black text-slate-800 dark:text-slate-100 mt-0.5">
              ₹{Number(details?.basicSalary || 0).toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Allowances */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <PlusCircle className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Allowances</div>
            <div className="text-base font-black text-slate-800 dark:text-slate-100 mt-0.5">
              ₹{Number(details?.allowances || 0).toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Bonus / Incentives */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-50 dark:bg-amber-950/40 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <TrendingUp className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Bonus / Incentives</div>
            <div className="text-base font-black text-slate-800 dark:text-slate-100 mt-0.5">
              ₹{Number(details?.bonus || 0).toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* PF Deductions */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-50 dark:bg-orange-950/40 rounded-xl flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
            <Percent className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">PF Deduction</div>
            <div className="text-base font-black text-slate-800 dark:text-slate-100 mt-0.5">
              ₹{Number(details?.pfDeduction || 0).toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Other Deductions */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 bg-rose-50 dark:bg-rose-950/40 rounded-xl flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <MinusCircle className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Other Deductions</div>
            <div className="text-base font-black text-slate-800 dark:text-slate-100 mt-0.5">
              ₹{Number(details?.deductions || 0).toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Net Take Home */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-750 text-white p-4 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-white shrink-0">
            <DollarSign className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="text-[9px] text-blue-200 font-bold uppercase tracking-wider">Net Take Home</div>
            <div className="text-base font-black mt-0.5">
              ₹{Number(details?.netSalary || 0).toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>

      {/* Current Month Active Payslip Banner */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
        <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Latest Processed Payroll</h2>
        
        {hasSalary ? (
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full md:w-auto">
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Salary Month</span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{details?.salaryMonth}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Disbursement Date</span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{details?.paymentDate}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Payment Status</span>
                <span className="inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400">
                  {details?.paymentStatus}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Reference No</span>
                <span className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200 truncate block max-w-[120px]">{details?.payrollReference}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto sm:shrink-0">
              <button 
                onClick={() => router.push(`/dashboard/salary/payslip/${details?.payrollReference}`)}
                className="w-full md:w-auto px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Eye className="w-4 h-4" /> View Payslip
              </button>
              <button 
                onClick={() => router.push(`/dashboard/salary/payslip/${details?.payrollReference}?print=true`)}
                className="w-full md:w-auto px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" /> Download / Print PDF
              </button>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-xs font-semibold">
            No salary records have been processed for you yet. Once processed by Admin, your pay stub will display here.
          </div>
        )}
      </div>

      {/* Payslip History Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
          <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Salary History & Payslips</h2>
          <span className="text-[10px] bg-slate-100 dark:bg-slate-700 font-bold px-2 py-0.5 rounded text-slate-500 dark:text-slate-400">
            {history.length} records
          </span>
        </div>

        {history.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs font-medium">
            No previous salary transaction records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-750 border-b border-slate-200 dark:border-slate-700 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                  <th className="px-5 py-3">Salary Month</th>
                  <th className="px-5 py-3">Payment Date</th>
                  <th className="px-5 py-3 text-right">Gross Salary</th>
                  <th className="px-5 py-3 text-right">Deductions</th>
                  <th className="px-5 py-3 text-right">PF Deduction</th>
                  <th className="px-5 py-3 text-right">Bonus</th>
                  <th className="px-5 py-3 text-right">Net Salary</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-center" style={{ width: '220px' }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-750/30">
                    <td className="px-5 py-4 text-slate-800 dark:text-slate-200 font-bold">{item.salaryMonth}</td>
                    <td className="px-5 py-4">{item.paymentDate}</td>
                    <td className="px-5 py-4 text-right">₹{item.grossSalary.toLocaleString('en-IN')}</td>
                    <td className="px-5 py-4 text-right text-rose-500">₹{item.deductions.toLocaleString('en-IN')}</td>
                    <td className="px-5 py-4 text-right text-orange-500">₹{item.pfDeduction.toLocaleString('en-IN')}</td>
                    <td className="px-5 py-4 text-right text-emerald-500">₹{item.bonus.toLocaleString('en-IN')}</td>
                    <td className="px-5 py-4 text-right text-slate-800 dark:text-slate-200 font-bold">
                      ₹{item.netSalary.toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-4 text-[10px] uppercase font-mono">{item.paymentMethod.replace('_', ' ')}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400">
                        {item.paymentStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => router.push(`/dashboard/salary/payslip/${item.id}`)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-400 text-[11px] flex items-center gap-1.5 cursor-pointer font-semibold"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                        <button
                          onClick={() => router.push(`/dashboard/salary/payslip/${item.id}?print=true`)}
                          className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#2E5BFF] dark:text-blue-400 text-[11px] flex items-center gap-1.5 cursor-pointer font-bold hover:bg-blue-100/70"
                        >
                          <Printer className="w-3.5 h-3.5" /> Print / PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
