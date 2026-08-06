'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';

export default function PlatformDashboardOverview() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const fetchMetrics = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/dashboard/platform/metrics`, {
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Platform Revenue & Performance</h1>
          <p className="text-xs text-slate-400 mt-1">Multi-Tenant School SaaS Subscription Analytics</p>
        </div>
        <button
          onClick={fetchMetrics}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-slate-300 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Data</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-950/50 border border-red-800 rounded-xl text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Revenue Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Revenue</span>
            <IndianRupee className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-white">
            ₹{metrics?.totalRevenue ? Number(metrics.totalRevenue).toLocaleString('en-IN') : '0'}
          </div>
          <p className="text-xs text-slate-500 mt-1">All-Time Subscription Earnings</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">MRR</span>
            <TrendingUp className="w-5 h-5 text-blue-400" />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-white">
            ₹{metrics?.mrr ? Number(metrics.mrr).toLocaleString('en-IN') : '0'}
          </div>
          <p className="text-xs text-slate-500 mt-1">Monthly Recurring Revenue</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Schools</span>
            <Building2 className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-white">
            {metrics?.activeSchools || 0}
          </div>
          <p className="text-xs text-slate-500 mt-1">Total Onboarded Schools: {metrics?.totalSchools || 0}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Renewal Rate</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-emerald-400">
            {metrics?.renewalSuccessRate || 100}%
          </div>
          <p className="text-xs text-slate-500 mt-1">Successful Subscription Renewals</p>
        </div>
      </div>

      {/* Subscription Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg lg:col-span-2">
          <h2 className="text-lg font-bold text-white mb-4">School Subscriptions Overview</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <Clock className="w-6 h-6 text-amber-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{metrics?.trialSchools || 0}</div>
              <div className="text-xs text-slate-400 mt-1 font-semibold uppercase">Trial Status</div>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{metrics?.activeSchools || 0}</div>
              <div className="text-xs text-slate-400 mt-1 font-semibold uppercase">Active Paid</div>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{metrics?.expiredSchools || 0}</div>
              <div className="text-xs text-slate-400 mt-1 font-semibold uppercase">Expired / Grace</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
          <h2 className="text-lg font-bold text-white mb-4">Platform Health Summary</h2>
          <div className="space-y-4 text-sm">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="text-slate-400">Renewals Due This Month</span>
              <span className="font-bold text-white">{metrics?.renewalsDueThisMonth || 0}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="text-slate-400">Failed Payment Attempts</span>
              <span className="font-bold text-red-400">{metrics?.failedPayments || 0}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="text-slate-400">API Readiness Status</span>
              <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full">HEALTHY</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
