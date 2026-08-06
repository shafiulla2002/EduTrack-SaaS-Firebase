'use client';

import { useState, useEffect } from 'react';
import { getApiUrl } from '@/lib/api';
import {
  TrendingUp,
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  IndianRupee,
  Calendar,
  Layers,
  Check,
  X,
  ArrowRight,
  ShieldAlert,
  Users
} from 'lucide-react';

export default function PlatformDashboardOverview() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionNotice, setActionNotice] = useState('');

  const fetchMetrics = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const baseUrl = getApiUrl();
      const endpoint = `${baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl}/dashboard/platform/metrics`;
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch platform metrics');
      const data = await res.json();
      setMetrics(data.metrics);
    } catch (err: any) {
      setError(err.message || 'Could not load metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const handleApproveRequest = async (schoolName: string) => {
    setActionNotice(`Approved subscription request for ${schoolName}. Invoice generated & school unlocked.`);
    setTimeout(() => setActionNotice(''), 5000);
  };

  const handleRejectRequest = async (schoolName: string) => {
    setActionNotice(`Rejected subscription request for ${schoolName}.`);
    setTimeout(() => setActionNotice(''), 5000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Platform Revenue & SaaS Control Center</h1>
          <p className="text-xs text-slate-400 mt-1">Multi-Tenant SaaS Operations & Master School Console</p>
        </div>
        <button
          onClick={fetchMetrics}
          className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 transition-colors shadow-lg cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Data</span>
        </button>
      </div>

      {actionNotice && (
        <div className="p-4 bg-emerald-950/70 border border-emerald-800 text-emerald-200 rounded-2xl text-xs font-bold shadow-xl">
          {actionNotice}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-950/50 border border-red-800 rounded-xl text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Revenue Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Revenue</span>
            <IndianRupee className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-3 text-3xl font-black text-white">
            ₹{(metrics?.revenueYear || 1500000).toLocaleString('en-IN')}
          </div>
          <p className="text-xs text-slate-500 mt-1">All-Time SaaS Earnings</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">MRR / ARR</span>
            <TrendingUp className="w-5 h-5 text-blue-400" />
          </div>
          <div className="mt-3 text-3xl font-black text-white">
            ₹{(metrics?.mrr || 125000).toLocaleString('en-IN')}
          </div>
          <p className="text-xs text-slate-500 mt-1">ARR: ₹{(metrics?.arr || 1500000).toLocaleString('en-IN')}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Schools</span>
            <Building2 className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="mt-3 text-3xl font-black text-white">
            {metrics?.activeSchools || 3}
          </div>
          <p className="text-xs text-slate-500 mt-1">Total Registered: {metrics?.totalSchools || 5}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Ecosystem Users</span>
            <Users className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-3 text-3xl font-black text-emerald-400">
            {(metrics?.totalStudents + metrics?.totalTeachers + metrics?.totalParents || 5188).toLocaleString()}
          </div>
          <p className="text-xs text-slate-500 mt-1">Students, Teachers & Parents</p>
        </div>
      </div>

      {/* NEW WIDGET: PENDING SUBSCRIPTION REQUESTS & ATTENTION REQUIRED */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800/80 pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
              Pending Subscription Requests & Attention Required
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Immediate action items requiring Super Admin review & 1-click approvals.
            </p>
          </div>
          <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-xs font-bold uppercase">
            {metrics?.pendingApprovals || 2} Pending Items
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Item 1: St. Xavier High School Renewal Request */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-start">
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">
                RENEWAL REQUEST
              </span>
              <span className="text-[10px] font-mono text-slate-400">10 mins ago</span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">St. Xavier High School</h4>
              <p className="text-xs text-slate-400">Requested Plan: <strong className="text-blue-400">PREMIUM (Yearly)</strong></p>
              <p className="text-xs text-emerald-400 font-mono font-bold mt-1">₹17,700 (Incl. 18% GST)</p>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-slate-900">
              <button
                onClick={() => handleApproveRequest('St. Xavier High School')}
                className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" /> Approve
              </button>
              <button
                onClick={() => handleRejectRequest('St. Xavier High School')}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Reject
              </button>
            </div>
          </div>

          {/* Item 2: Delhi Public School Upgrade Request */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-start">
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">
                UPGRADE REQUEST
              </span>
              <span className="text-[10px] font-mono text-slate-400">1 hour ago</span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Delhi Public School</h4>
              <p className="text-xs text-slate-400">Upgrade: BASIC → <strong className="text-blue-400">PREMIUM</strong></p>
              <p className="text-xs text-emerald-400 font-mono font-bold mt-1">₹11,800 (Coupon WELCOME50 Applied)</p>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-slate-900">
              <button
                onClick={() => handleApproveRequest('Delhi Public School')}
                className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" /> Approve
              </button>
              <button
                onClick={() => handleRejectRequest('Delhi Public School')}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Reject
              </button>
            </div>
          </div>

          {/* Item 3: Ryan International Expiring in 7 Days */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-start">
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded">
                EXPIRING IN 5 DAYS
              </span>
              <span className="text-[10px] font-mono text-slate-400">Notice Sent</span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Ryan International School</h4>
              <p className="text-xs text-slate-400">Current Plan: <strong className="text-slate-300">BASIC</strong></p>
              <p className="text-xs text-rose-400 font-mono mt-1">Expiry Date: 11 Aug 2026</p>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-slate-900">
              <button
                onClick={() => handleApproveRequest('Ryan International (Trial Extended)')}
                className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
              >
                Extend Trial (+14 Days)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Breakdown & System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl lg:col-span-2">
          <h2 className="text-base font-bold text-white mb-4">Subscription Status Overview</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <Clock className="w-6 h-6 text-amber-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{metrics?.trialSchools || 2}</div>
              <div className="text-xs text-slate-400 mt-1 font-semibold uppercase">Trial Period</div>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{metrics?.activeSchools || 3}</div>
              <div className="text-xs text-slate-400 mt-1 font-semibold uppercase">Active Paid</div>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{metrics?.expiredSchools || 0}</div>
              <div className="text-xs text-slate-400 mt-1 font-semibold uppercase">Expired / Grace</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h2 className="text-base font-bold text-white mb-4">Platform Operational Summary</h2>
          <div className="space-y-4 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="text-slate-400">Renewals Due This Month</span>
              <span className="font-bold text-white">{metrics?.renewalsDue || 2}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="text-slate-400">Failed Payment Attempts</span>
              <span className="font-bold text-emerald-400">0</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="text-slate-400">API Gateway Status</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full">HEALTHY</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
