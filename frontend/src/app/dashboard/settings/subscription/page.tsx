'use client';

import React, { useState, useEffect } from 'react';
import { useTenant } from '../../../providers/TenantContext';
import { api } from '@/lib/api';
import {
  CreditCard,
  CheckCircle,
  Download,
  AlertTriangle,
  Users,
  QrCode,
  RefreshCw,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';

export default function SubscriptionPage() {
  const { subscription, refresh } = useTenant();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<'BASIC' | 'PREMIUM'>('BASIC');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch full subscription statistics (usage, invoices, payments)
  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await api.get('/tenant/subscription');
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch subscription stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [subscription?.plan, subscription?.status]);

  const handleSimulatePayment = async () => {
    setSubmitting(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const paymentDetails = {
        method: 'UPI_SIMULATED',
        gateway: 'SIMULATED_UPI',
        txRef: 'TXN-UPI-' + Date.now().toString().slice(-6),
      };

      const res = await api.post('/tenant/subscription/renew', {
        planName: checkoutPlan,
        paymentDetails,
      });

      setSuccessMsg(`Simulated Payment Successful! Subscription upgraded/renewed to ${checkoutPlan}.`);
      
      // Update global context immediately
      await refresh();
      
      // Reload stats
      await fetchStats();
    } catch (err: any) {
      console.error('Renewal simulation failed:', err);
      setErrorMsg(err.response?.data?.message || 'Simulated payment processing failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-10 h-10 animate-spin text-blue-600" />
          <p className="text-sm font-semibold text-slate-500">Loading billing dashboard...</p>
        </div>
      </div>
    );
  }

  // Display fields
  const currentPlanName = stats?.plan || subscription?.plan || 'TRIAL';
  const currentStatus = stats?.status || subscription?.status || 'ACTIVE';
  const expiryDate = stats?.expiryDate || subscription?.expiryDate;
  const remainingDays = stats?.remainingDays ?? 180;
  
  const studentUsage = stats?.studentUsage ?? 0;
  const studentLimit = stats?.studentLimit ?? 1000;
  const teacherUsage = stats?.teacherUsage ?? 0;
  const teacherLimit = stats?.teacherLimit ?? 100;
  const parentUsage = stats?.parentUsage ?? 0;

  // Percentage calculations
  const studentPercent = studentLimit ? Math.min(100, Math.round((studentUsage / studentLimit) * 100)) : 0;
  const teacherPercent = teacherLimit ? Math.min(100, Math.round((teacherUsage / teacherLimit) * 100)) : 0;

  // Checkout plan pricing
  const checkoutPrice = checkoutPlan === 'BASIC' ? '1,999' : '4,999';

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-blue-600" />
            Billing & Subscription
          </h1>
          <p className="text-slate-400 text-sm font-light mt-1">
            Manage your tenant subscription plan, check feature quotas, and review billing invoices.
          </p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-200 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50 transition-colors shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Stats
        </button>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 rounded-2xl flex items-center gap-3">
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-500" />
          <span className="text-sm font-semibold">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-600 rounded-2xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500" />
          <span className="text-sm font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* Grid of Main Dashboard Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Card 1: Active Plan Summary */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/5 rounded-full blur-2xl -mr-10 -mt-10" />
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className={`text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full ${
                currentStatus === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
              }`}>
                {currentStatus}
              </span>
              <span className="text-slate-400 text-xs font-mono">
                Instance ID: {subscription?.tenantId?.substring(0, 8) || 'Tenant'}
              </span>
            </div>
            
            <h2 className="text-3xl font-black text-slate-800 tracking-tight uppercase">
              {currentPlanName} PLAN
            </h2>
            <p className="text-slate-500 text-xs font-medium mt-1">
              {currentPlanName === 'TRIAL' 
                ? '6 Months Free Trial Period' 
                : currentPlanName === 'BASIC'
                  ? 'Standard features for small-mid size institutes'
                  : 'Unlimited features for large scale institutions'}
            </p>

            <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-slate-100">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expires On</p>
                <p className="text-base font-bold text-slate-700 mt-1">
                  {expiryDate ? new Date(expiryDate).toLocaleDateString(undefined, {
                    year: 'numeric', month: 'long', day: 'numeric'
                  }) : 'No Expiry'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Remaining Days</p>
                <p className={`text-base font-bold mt-1 ${remainingDays <= 15 ? 'text-amber-500' : 'text-slate-700'}`}>
                  {remainingDays > 0 ? `${remainingDays} Days` : 'Expired'}
                </p>
              </div>
            </div>
          </div>

          {remainingDays <= 0 && (
            <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 text-amber-700 rounded-2xl flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <p className="text-xs font-semibold leading-relaxed">
                Your subscription has expired. You are currently within your 3-day grace period, after which system access will become read-only. Please renew.
              </p>
            </div>
          )}
        </div>

        {/* Card 2: Quota Limits Usage */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm flex flex-col justify-between">
          <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-6 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            Quota Usage
          </h3>

          <div className="space-y-6">
            {/* Student Quota */}
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-2">
                <span>Students Admit</span>
                <span>{studentUsage} / {studentLimit ?? 'Unlimited'}</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    studentPercent > 90 ? 'bg-rose-500' : studentPercent > 75 ? 'bg-amber-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${studentPercent || 100}%` }}
                />
              </div>
              <p className="text-[9px] text-slate-400 font-bold tracking-wider mt-1.5 uppercase">
                {studentPercent}% OF SEATS ALLOCATED
              </p>
            </div>

            {/* Teacher Quota */}
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-2">
                <span>Teacher & Staff</span>
                <span>{teacherUsage} / {teacherLimit ?? 'Unlimited'}</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    teacherPercent > 90 ? 'bg-rose-500' : teacherPercent > 75 ? 'bg-amber-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${teacherPercent || 100}%` }}
                />
              </div>
              <p className="text-[9px] text-slate-400 font-bold tracking-wider mt-1.5 uppercase">
                {teacherPercent}% OF STAFF ALLOCATED
              </p>
            </div>

            {/* Parent Info */}
            <div className="flex justify-between items-center text-xs font-semibold text-slate-700 pt-3 border-t border-slate-100">
              <span>Parent Profiles</span>
              <span className="font-bold text-slate-800">{parentUsage} (Unlimited)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade / Renewal Panel (Simulated Checkout) */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 sm:p-8 bg-slate-50 border-b border-slate-200">
          <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
            <QrCode className="w-5 h-5 text-indigo-600" />
            Renew or Upgrade Subscription
          </h2>
          <p className="text-slate-500 text-xs font-light mt-1">
            Choose a plan tier, scan the simulated QR code payload, and confirm simulated checkout.
          </p>
        </div>

        <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Checkout plan selection */}
          <div className="space-y-4">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Select Plan Tier</label>
            <div className="grid grid-cols-2 gap-4">
              
              {/* Basic Option */}
              <div
                onClick={() => setCheckoutPlan('BASIC')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  checkoutPlan === 'BASIC'
                    ? 'border-indigo-600 bg-indigo-50/20 text-[#2E5BFF] shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase">Basic</span>
                  <input 
                    type="radio" 
                    checked={checkoutPlan === 'BASIC'} 
                    onChange={() => {}} 
                    className="accent-indigo-600 shrink-0" 
                  />
                </div>
                <p className="text-xl font-black text-slate-800">₹1,999<span className="text-xs font-normal">/mo</span></p>
                <p className="text-[10px] text-slate-400 font-light mt-1">5,000 Students limit, 200 staff limit, standard modules.</p>
              </div>

              {/* Premium Option */}
              <div
                onClick={() => setCheckoutPlan('PREMIUM')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  checkoutPlan === 'PREMIUM'
                    ? 'border-pink-600 bg-pink-50/20 text-[#2E5BFF] shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase">Premium</span>
                  <input 
                    type="radio" 
                    checked={checkoutPlan === 'PREMIUM'} 
                    onChange={() => {}} 
                    className="accent-pink-600 shrink-0" 
                  />
                </div>
                <p className="text-xl font-black text-slate-800">₹4,999<span className="text-xs font-normal">/mo</span></p>
                <p className="text-[10px] text-slate-400 font-light mt-1">Unlimited Students, Unlimited staff, all advanced modules.</p>
              </div>

            </div>

            <div className="pt-4 border-t border-slate-100 text-slate-600 space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span>Base Charge</span>
                <span>₹{checkoutPrice}.00</span>
              </div>
              <div className="flex justify-between text-xs font-semibold">
                <span>GST (18% Included)</span>
                <span>₹{Math.round(Number(checkoutPrice.replace(',', '')) * 0.18)}.00</span>
              </div>
              <div className="flex justify-between text-sm font-black text-slate-800 pt-2 border-t border-slate-100">
                <span>Total Amount Due</span>
                <span>₹{checkoutPrice}.00</span>
              </div>
            </div>
          </div>

          {/* Simulated QR Code Checkout column */}
          <div className="flex flex-col items-center justify-center border-t lg:border-t-0 lg:border-l border-slate-200 pt-8 lg:pt-0 lg:pl-8 text-center">
            
            {/* Visual QR Code Mock */}
            <div className="w-36 h-36 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center p-3 relative shadow-inner">
              <QrCode className="w-28 h-28 text-slate-800 shrink-0" />
              <div className="absolute inset-0 bg-blue-500/5 hover:bg-transparent transition-all rounded-2xl flex items-center justify-center text-[10px] text-blue-600 font-extrabold uppercase tracking-wide">
                <span>Simulated UPI</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-4">
              Scan with any simulated UPI client app
            </p>
            <p className="text-[11px] text-slate-500 max-w-xs mt-1 leading-relaxed">
              This triggers a simulated payload verification bypass using mock database payments.
            </p>

            <button
              onClick={handleSimulatePayment}
              disabled={submitting}
              className="mt-6 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Verifying Transaction...
                </>
              ) : (
                <>
                  Confirm Simulated Payment
                  <ArrowUpRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-base font-bold text-slate-800 tracking-tight uppercase">Invoice Audit History</h2>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-150 px-3 py-1 rounded-full">
            {(stats?.invoices || []).length} Invoices
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-3.5">Invoice #</th>
                <th className="px-6 py-3.5">Date</th>
                <th className="px-6 py-3.5">Plan tier</th>
                <th className="px-6 py-3.5">Amount</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
              {(stats?.invoices || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400 font-medium">
                    No billing invoices generated yet.
                  </td>
                </tr>
              ) : (
                stats.invoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">{inv.invoiceNumber}</td>
                    <td className="px-6 py-4">
                      {new Date(inv.paymentDate || inv.createdDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-semibold uppercase">{inv.planId}</td>
                    <td className="px-6 py-4 font-bold">₹{inv.amount}</td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                        inv.status === 'PAID' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <a
                        href={inv.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-[11px] font-semibold text-blue-600 hover:bg-blue-50/50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        PDF
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
