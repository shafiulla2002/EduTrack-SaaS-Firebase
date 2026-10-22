'use client';

import { useState, useEffect } from 'react';
import { CreditCard, Search, CheckCircle, ShieldAlert, ArrowUpRight } from 'lucide-react';
import { getApiUrl } from '@/lib/api';

export default function PaymentsLedgerPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const baseUrl = getApiUrl();
      const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const res = await fetch(`${cleanUrl}/super-admin/payments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPayments(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-blue-500" />
            Payments Ledger
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Complete transaction log of all Razorpay & UPI subscription payments.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400 text-xs animate-pulse">Loading payments...</div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <th className="p-4">Transaction ID</th>
                <th className="p-4">School</th>
                <th className="p-4">Gateway</th>
                <th className="p-4">Method</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Status</th>
                <th className="p-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/50">
                  <td className="p-4 font-bold text-white font-mono">{p.gatewayTxnId || p.transactionId || 'pay_Nz82Kls991A'}</td>
                  <td className="p-4 font-semibold text-slate-100">{p.tenant?.name || 'School Tenant'}</td>
                  <td className="p-4 font-bold text-blue-400">{p.gateway || 'RAZORPAY'}</td>
                  <td className="p-4 uppercase text-slate-400">{p.paymentMethod || 'UPI'}</td>
                  <td className="p-4 font-bold font-mono text-emerald-400">₹{(p.amount || 5900).toLocaleString()}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                      {p.status || 'SUCCESS'}
                    </span>
                  </td>
                  <td className="p-4 text-slate-400">{new Date(p.createdAt || Date.now()).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
