'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard, CheckCircle, RefreshCw, AlertTriangle, Shield,
  Check, Clock, XCircle, ChevronDown, ChevronUp, IndianRupee,
  FileText, BadgeCheck, Ban
} from 'lucide-react';
import { getApiUrl } from '@/lib/api';

// ─── Helpers ───────────────────────────────────────────────────────────────
function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function apiUrl() {
  const base = getApiUrl();
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

type TabType = 'pending' | 'all';

export default function SubscriptionsManagementPage() {
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [tenants, setTenants] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [newPlan, setNewPlan] = useState('BASIC');
  const [newStatus, setNewStatus] = useState('ACTIVE');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const base = apiUrl();
      const headers = authHeaders();
      const [tRes, pRes, pendRes] = await Promise.all([
        fetch(`${base}/super-admin/tenants`, { headers }),
        fetch(`${base}/super-admin/plans`, { headers }),
        fetch(`${base}/super-admin/pending-payments`, { headers }),
      ]);
      setTenants(tRes.ok ? await tRes.json() : []);
      setPlans(pRes.ok ? await pRes.json() : []);
      setPendingPayments(pendRes.ok ? await pendRes.json() : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpdateSubscription = async (tenantId: string) => {
    setSuccessMsg(''); setErrorMsg('');
    try {
      const res = await fetch(`${apiUrl()}/super-admin/tenants/${tenantId}/subscription`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ planName: newPlan, status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update subscription');
      setSuccessMsg('Subscription updated successfully.');
      fetchData();
      setSelectedTenant(null);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleApprove = async (paymentId: string) => {
    setActionLoading(paymentId);
    setSuccessMsg(''); setErrorMsg('');
    try {
      const res = await fetch(`${apiUrl()}/super-admin/payments/${paymentId}/approve`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ remarks: 'Approved by Super Admin' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to approve');
      setSuccessMsg(`✓ Approved! Invoice: ${data.invoiceNumber}. Subscription activated until ${new Date(data.newExpiry).toLocaleDateString()}.`);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setActionLoading(rejectTarget.id);
    setSuccessMsg(''); setErrorMsg('');
    try {
      const res = await fetch(`${apiUrl()}/super-admin/payments/${rejectTarget.id}/reject`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ reason: rejectReason || 'Rejected by Super Admin' }),
      });
      if (!res.ok) throw new Error('Failed to reject payment');
      setSuccessMsg('Payment rejected and school admin notified.');
      setRejectTarget(null);
      setRejectReason('');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Subscription Management</h1>
          <p className="text-xs text-slate-400 mt-1">Approve payment requests, manage school subscriptions and billing</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold cursor-pointer transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Status Messages */}
      {successMsg && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-300 text-sm flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-0">
        {([
          { id: 'pending', label: `Pending Approvals`, badge: pendingPayments.length },
          { id: 'all', label: 'All Subscriptions', badge: null },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 cursor-pointer transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
            {tab.badge !== null && tab.badge > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── PENDING PAYMENTS TAB ──────────────────────────────────── */}
          {activeTab === 'pending' && (
            <div className="space-y-4">
              {pendingPayments.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
                  <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                  <p className="text-slate-300 font-semibold">No Pending Approvals</p>
                  <p className="text-xs text-slate-500 mt-1">All subscription payment requests have been processed.</p>
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                  <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-amber-300">{pendingPayments.length} payment(s) awaiting your approval</span>
                  </div>
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="px-5 py-3">School</th>
                        <th className="px-5 py-3">Plan</th>
                        <th className="px-5 py-3">Duration</th>
                        <th className="px-5 py-3">Amount Paid</th>
                        <th className="px-5 py-3">Transaction ID</th>
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3">Verified</th>
                        <th className="px-5 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {pendingPayments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-5 py-4">
                            <div className="font-semibold text-white">{p.tenant?.name || '—'}</div>
                            <div className="text-[10px] text-slate-500">{p.tenant?.email || ''}</div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-lg text-xs font-semibold">
                              {p.planId || 'BASIC'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-xs text-slate-400">{p.billingDurationMonths ? `${p.billingDurationMonths} Months` : '—'}</td>
                          <td className="px-5 py-4 font-mono font-bold text-emerald-400">₹{Number(p.amount).toLocaleString()}</td>
                          <td className="px-5 py-4 font-mono text-xs text-slate-400 max-w-[160px] truncate">{p.transactionId}</td>
                          <td className="px-5 py-4 text-xs text-slate-400">{new Date(p.createdAt).toLocaleDateString()}</td>
                          <td className="px-5 py-4">
                            {p.signatureVerified
                              ? <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold"><Shield className="w-3.5 h-3.5" />Verified</span>
                              : <span className="flex items-center gap-1 text-amber-400 text-xs font-bold"><AlertTriangle className="w-3.5 h-3.5" />Pending</span>
                            }
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleApprove(p.id)}
                                disabled={actionLoading === p.id}
                                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold rounded-lg cursor-pointer transition-all"
                              >
                                {actionLoading === p.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />}
                                Approve
                              </button>
                              <button
                                onClick={() => { setRejectTarget(p); setRejectReason(''); }}
                                disabled={actionLoading === p.id}
                                className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white text-xs font-bold rounded-lg cursor-pointer transition-all"
                              >
                                <Ban className="w-3.5 h-3.5" /> Reject
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
          )}

          {/* ── ALL SUBSCRIPTIONS TAB ─────────────────────────────────── */}
          {activeTab === 'all' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">School</th>
                    <th className="px-6 py-4">Current Plan</th>
                    <th className="px-6 py-4">Expiry Date</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {tenants.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 font-semibold text-white">{t.name}</td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs font-semibold text-blue-300">
                          {t.subscription?.plan?.name || 'TRIAL'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {t.subscription?.expiryDate ? new Date(t.subscription.expiryDate).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          t.subscription?.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : t.subscription?.status === 'EXPIRED' ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : 'bg-amber-950 text-amber-400 border border-amber-800'
                        }`}>
                          {t.subscription?.status || 'ACTIVE'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedTenant(t);
                            setNewPlan(t.subscription?.plan?.name || 'BASIC');
                            setNewStatus(t.subscription?.status || 'ACTIVE');
                          }}
                          className="text-xs font-semibold px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors cursor-pointer"
                        >
                          Modify Plan
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Modify Subscription Modal ─────────────────────────────────────── */}
      {selectedTenant && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Modify: {selectedTenant.name}</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Select Plan</label>
              <select value={newPlan} onChange={(e) => setNewPlan(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white p-2.5 rounded-xl text-sm">
                {plans.map((p) => (
                  <option key={p.id} value={p.name}>{p.name} (₹{p.price})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Lifecycle Status</label>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white p-2.5 rounded-xl text-sm">
                {['TRIAL','ACTIVE','GRACE_PERIOD','EXPIRED','RENEWED','CANCELLED','SUSPENDED'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button onClick={() => setSelectedTenant(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer">
                Cancel
              </button>
              <button onClick={() => handleUpdateSubscription(selectedTenant.id)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl cursor-pointer">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Reason Modal ───────────────────────────────────────────── */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Reject Payment Request</h3>
            <p className="text-xs text-slate-400">School: <span className="text-white font-semibold">{rejectTarget.tenant?.name}</span></p>
            <p className="text-xs text-slate-400">Amount: <span className="text-white font-semibold font-mono">₹{Number(rejectTarget.amount).toLocaleString()}</span></p>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Rejection Reason</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter reason for rejection (optional)..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 text-white p-2.5 rounded-xl text-sm resize-none outline-none focus:border-rose-500"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button onClick={() => setRejectTarget(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer">
                Cancel
              </button>
              <button onClick={handleReject} disabled={!!actionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white text-xs font-semibold rounded-xl cursor-pointer flex items-center gap-1.5">
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
