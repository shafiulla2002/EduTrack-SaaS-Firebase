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
  Check,
  X,
  Users,
  Shield,
  Tag
} from 'lucide-react';

export default function PlatformDashboardOverview() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Rejection modal
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchMetrics = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const baseUrl = getApiUrl();
      const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const endpoint = `${cleanUrl}/dashboard/platform/metrics`;
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

  const handleApproveRequest = async (paymentId: string, schoolName: string) => {
    setProcessingId(paymentId);
    setActionNotice('');
    try {
      const token = localStorage.getItem('token');
      const baseUrl = getApiUrl();
      const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const res = await fetch(`${cleanUrl}/super-admin/payments/${paymentId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ remarks: 'Approved from Overview Dashboard' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Approval failed');

      setActionNotice(`✓ Subscription approved for ${schoolName}! Invoice ${data.invoiceNumber} generated & school unlocked.`);
      await fetchMetrics();
    } catch (err: any) {
      setError(err.message || 'Failed to approve subscription');
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectTarget) return;
    const paymentId = rejectTarget.id;
    const schoolName = rejectTarget.schoolName;
    setProcessingId(paymentId);
    setActionNotice('');
    try {
      const token = localStorage.getItem('token');
      const baseUrl = getApiUrl();
      const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const res = await fetch(`${cleanUrl}/super-admin/payments/${paymentId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: rejectReason || 'Rejected by Super Admin' }),
      });
      if (!res.ok) throw new Error('Rejection failed');

      setActionNotice(`Rejected subscription request for ${schoolName}. School admin notified.`);
      setRejectTarget(null);
      setRejectReason('');
      await fetchMetrics();
    } catch (err: any) {
      setError(err.message || 'Failed to reject subscription');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const pendingRequests = metrics?.pendingRequests || [];
  const pendingApprovalsCount = metrics?.pendingApprovals ?? pendingRequests.length;
  const ecosystemUsers = metrics?.totalEcosystemUsers ?? ((metrics?.totalStudents || 0) + (metrics?.totalTeachers || 0) + (metrics?.totalParents || 0));

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
        <div className="p-4 bg-emerald-950/70 border border-emerald-800 text-emerald-200 rounded-2xl text-xs font-bold shadow-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-950/50 border border-red-800 rounded-xl text-red-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
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
            ₹{(metrics?.totalRevenue || 0).toLocaleString('en-IN')}
          </div>
          <p className="text-xs text-slate-500 mt-1">All-Time SaaS Earnings</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">MRR / ARR</span>
            <TrendingUp className="w-5 h-5 text-blue-400" />
          </div>
          <div className="mt-3 text-3xl font-black text-white">
            ₹{(metrics?.mrr || 0).toLocaleString('en-IN')}
          </div>
          <p className="text-xs text-slate-500 mt-1">ARR: ₹{(metrics?.arr || 0).toLocaleString('en-IN')}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Schools</span>
            <Building2 className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="mt-3 text-3xl font-black text-white">
            {metrics?.activeSchools ?? 0}
          </div>
          <p className="text-xs text-slate-500 mt-1">Total Registered: {metrics?.totalSchools ?? 0}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Ecosystem Users</span>
            <Users className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-3 text-3xl font-black text-emerald-400">
            {ecosystemUsers.toLocaleString('en-IN')}
          </div>
          <p className="text-xs text-slate-500 mt-1">Students, Teachers & Parents</p>
        </div>
      </div>

      {/* REAL LIVE PENDING SUBSCRIPTION REQUESTS WIDGET */}
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
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${
            pendingApprovalsCount > 0
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          }`}>
            {pendingApprovalsCount} PENDING ITEMS
          </span>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="bg-slate-950/60 border border-slate-800/60 rounded-2xl p-8 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">No Pending Subscription Requests</p>
            <p className="text-xs text-slate-500">All registered school subscriptions are currently active and up to date.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingRequests.map((req: any) => {
              const formattedDate = new Date(req.createdAt).toLocaleString('en-IN', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              });
              const isProcessing = processingId === req.id;

              return (
                <div key={req.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 relative flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">
                        RENEWAL REQUEST
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{formattedDate}</span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-white">{req.schoolName}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Plan: <strong className="text-blue-400">{req.plan} ({req.billingCycle})</strong>
                      </p>
                      <p className="text-xs text-emerald-400 font-mono font-bold mt-1">
                        ₹{Number(req.amount).toLocaleString('en-IN')} (Incl. 18% GST)
                      </p>
                      {req.coupon && (
                        <p className="text-[11px] text-amber-300 font-medium flex items-center gap-1 mt-0.5">
                          <Tag className="w-3 h-3 text-amber-400" /> Coupon: {req.coupon}
                        </p>
                      )}
                      {req.transactionId && (
                        <p className="text-[10px] text-slate-500 font-mono mt-1 truncate">
                          Txn: {req.transactionId}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-slate-900 mt-2">
                    <button
                      onClick={() => handleApproveRequest(req.id, req.schoolName)}
                      disabled={isProcessing}
                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all"
                    >
                      {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Approve
                    </button>
                    <button
                      onClick={() => { setRejectTarget(req); setRejectReason(''); }}
                      disabled={isProcessing}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-rose-400 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Subscription Breakdown & System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl lg:col-span-2">
          <h2 className="text-base font-bold text-white mb-4">Subscription Status Overview</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <Clock className="w-6 h-6 text-amber-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{metrics?.trialSchools ?? 0}</div>
              <div className="text-xs text-slate-400 mt-1 font-semibold uppercase">Trial Period</div>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{metrics?.activeSchools ?? 0}</div>
              <div className="text-xs text-slate-400 mt-1 font-semibold uppercase">Active Paid</div>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{metrics?.expiredSchools ?? 0}</div>
              <div className="text-xs text-slate-400 mt-1 font-semibold uppercase">Expired / Grace</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h2 className="text-base font-bold text-white mb-4">Platform Operational Summary</h2>
          <div className="space-y-4 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="text-slate-400">Renewals Due This Month</span>
              <span className="font-bold text-white">{metrics?.renewalsDueThisMonth ?? 0}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="text-slate-400">Failed Payment Attempts</span>
              <span className="font-bold text-emerald-400">{metrics?.failedPayments ?? 0}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="text-slate-400">API Gateway Status</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full">HEALTHY</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl text-white">
            <h3 className="text-lg font-bold">Reject Subscription Request</h3>
            <p className="text-xs text-slate-400">
              School: <span className="text-white font-semibold">{rejectTarget.schoolName}</span>
            </p>
            <p className="text-xs text-slate-400">
              Amount: <span className="text-emerald-400 font-semibold font-mono">₹{Number(rejectTarget.amount).toLocaleString('en-IN')}</span>
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Rejection Reason</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter rejection reason for school admin..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 text-white p-2.5 rounded-xl text-sm resize-none outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setRejectTarget(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={!!processingId}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl cursor-pointer flex items-center gap-1.5"
              >
                {processingId ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
