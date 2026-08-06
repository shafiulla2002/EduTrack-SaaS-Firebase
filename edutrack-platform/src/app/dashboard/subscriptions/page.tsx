'use client';

import { useState, useEffect } from 'react';
import { CreditCard, CheckCircle, RefreshCw, AlertTriangle, Shield, Check } from 'lucide-react';

export default function SubscriptionsManagementPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [newPlan, setNewPlan] = useState('BASIC');
  const [newStatus, setNewStatus] = useState('ACTIVE');
  const [successMsg, setSuccessMsg] = useState('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const [tRes, pRes] = await Promise.all([
        fetch(`${API_URL}/super-admin/tenants`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/super-admin/plans`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const tData = await tRes.json();
      const pData = await pRes.json();
      setTenants(tData);
      setPlans(pData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateSubscription = async (tenantId: string) => {
    setSuccessMsg('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/super-admin/tenants/${tenantId}/subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          planName: newPlan,
          status: newStatus,
        }),
      });

      if (!res.ok) throw new Error('Failed to update subscription');
      setSuccessMsg(`Subscription updated successfully for school.`);
      fetchData();
      setSelectedTenant(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Subscription Management</h1>
          <p className="text-xs text-slate-400 mt-1">Manage school subscription plans, renewals, and lifecycle status</p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-300 text-sm flex items-center gap-2">
          <Check className="w-5 h-5 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">School</th>
                <th className="px-6 py-4">Current Plan</th>
                <th className="px-6 py-4">Expiry Date</th>
                <th className="px-6 py-4">Lifecycle Status</th>
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
                    {t.subscription?.expiryDate
                      ? new Date(t.subscription.expiryDate).toLocaleDateString()
                      : 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
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
                      className="text-xs font-semibold px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
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

      {selectedTenant && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Modify Subscription: {selectedTenant.name}</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Select Plan</label>
              <select
                value={newPlan}
                onChange={(e) => setNewPlan(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white p-2.5 rounded-xl text-sm"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name} (₹{p.price}/yr)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Lifecycle Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white p-2.5 rounded-xl text-sm"
              >
                <option value="TRIAL">TRIAL</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="GRACE_PERIOD">GRACE_PERIOD</option>
                <option value="EXPIRED">EXPIRED</option>
                <option value="RENEWED">RENEWED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setSelectedTenant(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateSubscription(selectedTenant.id)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
