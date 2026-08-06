'use client';

import React, { useState, useEffect } from 'react';
import { useTenant } from '../../../providers/TenantContext';
import { api } from '@/lib/api';
import { PDFService } from '@/lib/pdf';
import {
  CreditCard,
  CheckCircle,
  Download,
  AlertTriangle,
  Users,
  RefreshCw,
  ArrowUpRight,
  TrendingUp,
  Check,
  Shield,
  HelpCircle,
  Tag,
  Receipt,
  Clock,
  Lock
} from 'lucide-react';

export default function SubscriptionPage() {
  const { subscription, refresh } = useTenant();
  const [stats, setStats] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<string>('BASIC');
  const [billingPeriod, setBillingPeriod] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [gateway, setGateway] = useState<'RAZORPAY' | 'STRIPE'>('RAZORPAY');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponMsg, setCouponMsg] = useState('');

  // Histories
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [renewals, setRenewals] = useState<any[]>([]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await api.get('/tenant/subscription');
      setStats(res.data);
      if (res.data?.invoices) setInvoices(res.data.invoices);
      if (res.data?.payments) setPayments(res.data.payments);
      if (res.data?.renewals) setRenewals(res.data.renewals);
    } catch (err) {
      console.error('Failed to fetch subscription stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await api.get('/tenant/subscription/plans');
      setPlans(res.data || []);
    } catch (err) {
      console.error('Failed to fetch plans:', err);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchPlans();
  }, [subscription?.plan, subscription?.status]);

  const applyCoupon = () => {
    setCouponMsg('');
    if (!couponCode) return;
    if (couponCode.toUpperCase() === 'WELCOME50') {
      setCouponDiscount(50); // 50% discount
      setCouponApplied(true);
      setCouponMsg('Coupon WELCOME50 applied! (50% OFF)');
    } else if (couponCode.toUpperCase() === 'FLAT2000') {
      setCouponDiscount(2000); // Flat ₹2000 OFF
      setCouponApplied(true);
      setCouponMsg('Coupon FLAT2000 applied! (₹2000 OFF)');
    } else {
      setCouponApplied(false);
      setCouponMsg('Invalid or expired coupon code.');
    }
  };

  const basePrice = checkoutPlan === 'PREMIUM' ? (billingPeriod === 'YEARLY' ? 15000 : 1500) : (billingPeriod === 'YEARLY' ? 5000 : 500);
  let discountAmount = 0;
  if (couponApplied) {
    if (couponDiscount <= 100) {
      discountAmount = (basePrice * couponDiscount) / 100;
    } else {
      discountAmount = couponDiscount;
    }
  }
  const taxableAmount = Math.max(0, basePrice - discountAmount);
  const gstAmount = Math.round(taxableAmount * 0.18);
  const finalPayable = taxableAmount + gstAmount;

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const paymentDetails = {
        gateway,
        billingPeriod,
        method: 'RAZORPAY_UPI',
        couponCode: couponApplied ? couponCode : null,
        amount: finalPayable,
        txRef: 'TXN-RAZORPAY-' + Date.now().toString().slice(-6),
      };

      const res = await api.post('/tenant/subscription/renew', {
        planName: checkoutPlan,
        paymentDetails,
        status: 'PENDING_APPROVAL',
      });

      setSuccessMsg('Your subscription request has been submitted successfully and is awaiting approval from the Platform Administrator.');
      setShowCheckoutModal(false);

      await refresh();
      await fetchStats();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Transaction processed failed. Please contact billing support.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentStatus = subscription?.status || 'ACTIVE';
  const isPendingApproval = currentStatus === 'PENDING_APPROVAL';
  const isExpired = currentStatus === 'EXPIRED' || currentStatus === 'SUSPENDED';

  const expiryDateObj = subscription?.expiryDate ? new Date(subscription.expiryDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const daysRemaining = Math.max(0, Math.ceil((expiryDateObj.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white tracking-tight">Subscription & Billing Console</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              isPendingApproval
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : isExpired
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}>
              {currentStatus}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage school plan allocation, automated Razorpay invoicing, and platform approval statuses.
          </p>
        </div>

        <button
          onClick={() => setShowCheckoutModal(true)}
          className="flex items-center gap-2 px-5 py-3 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-500 rounded-2xl shadow-lg shadow-blue-600/30 cursor-pointer transition-all"
        >
          <CreditCard className="w-4 h-4" />
          <span>Renew / Upgrade Subscription</span>
        </button>
      </div>

      {/* PENDING APPROVAL WARNING BANNER */}
      {isPendingApproval && (
        <div className="p-6 bg-amber-950/60 border border-amber-800/80 rounded-3xl flex items-start gap-4 text-amber-200 shadow-xl">
          <Clock className="w-6 h-6 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
          <div>
            <h3 className="text-sm font-bold text-amber-300">Renewal Request Pending Approval</h3>
            <p className="text-xs text-amber-200/90 mt-1 leading-relaxed">
              Your subscription request has been submitted successfully and is awaiting approval from the Platform Administrator.
              Once verified by Super Admin, your invoice will be generated and your school plan fully activated.
            </p>
          </div>
        </div>
      )}

      {/* EXPIRED APPLICATION LOCK BANNER */}
      {isExpired && (
        <div className="p-6 bg-rose-950/70 border border-rose-800/80 rounded-3xl flex items-start gap-4 text-rose-200 shadow-xl">
          <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-rose-300">Subscription Expired — Application Locked</h3>
            <p className="text-xs text-rose-200/90 mt-1 leading-relaxed">
              Your subscription has expired. Please renew your subscription to continue using EduTrack modules.
            </p>
          </div>
        </div>
      )}

      {/* Current Subscription Details Card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Current Plan</span>
          <div className="text-2xl font-black text-slate-900 mt-2">{subscription?.plan || 'BASIC'}</div>
          <span className="text-xs text-slate-500 mt-1 block">Tier allocation</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Expiry Date</span>
          <div className="text-2xl font-black text-slate-900 mt-2">{expiryDateObj.toLocaleDateString()}</div>
          <span className="text-xs text-slate-500 mt-1 block">{daysRemaining} days remaining</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Billing Cycle</span>
          <div className="text-2xl font-black text-slate-900 mt-2">{stats?.billingCycle || 'YEARLY'}</div>
          <span className="text-xs text-slate-500 mt-1 block">Auto-renewal enabled</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Grace Period Status</span>
          <div className="text-2xl font-black text-emerald-600 mt-2">Active</div>
          <span className="text-xs text-slate-500 mt-1 block">3-day grace window</span>
        </div>
      </div>

      {/* Subscription Plans Selection Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Available Subscription Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* BASIC PLAN */}
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-8 space-y-6 hover:border-blue-500 transition-all shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-full uppercase">Standard</span>
                <h3 className="text-xl font-bold text-slate-900 mt-3">BASIC Tier</h3>
                <p className="text-xs text-slate-500 mt-1">Ideal for small and medium schools up to 500 students.</p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-black text-slate-900">₹5,000</span>
                <span className="text-xs text-slate-500 block">/ year</span>
              </div>
            </div>
            <ul className="space-y-3 text-xs text-slate-600">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Up to 500 Students</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Core Attendance, Fees & Timetable</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Email & SMS Notifications</li>
            </ul>
            <button
              onClick={() => { setCheckoutPlan('BASIC'); setShowCheckoutModal(true); }}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-extrabold text-xs transition-all shadow-md"
            >
              Select BASIC Plan
            </button>
          </div>

          {/* PREMIUM PLAN */}
          <div className="bg-slate-900 border-2 border-blue-600 rounded-3xl p-8 space-y-6 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-4 right-4 bg-blue-600 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full">
              MOST POPULAR
            </div>
            <div className="flex justify-between items-start">
              <div>
                <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-xs font-bold rounded-full uppercase border border-blue-500/30">Enterprise</span>
                <h3 className="text-xl font-bold text-white mt-3">PREMIUM Tier</h3>
                <p className="text-xs text-slate-400 mt-1">Unlimited students, GPS tracking, and Super Admin support.</p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-black text-white">₹15,000</span>
                <span className="text-xs text-slate-400 block">/ year</span>
              </div>
            </div>
            <ul className="space-y-3 text-xs text-slate-300">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-400" /> Unlimited Students & Staff</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-400" /> Live Bus GPS Tracking & Transport</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-400" /> Priority 24/7 Dedicated Support</li>
            </ul>
            <button
              onClick={() => { setCheckoutPlan('PREMIUM'); setShowCheckoutModal(true); }}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-extrabold text-xs transition-all shadow-lg shadow-blue-600/40"
            >
              Select PREMIUM Plan
            </button>
          </div>
        </div>
      </div>

      {/* Invoice History Section */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Receipt className="w-5 h-5 text-blue-600" />
          Subscription Invoice History
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                <th className="p-3">Invoice #</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Subtotal</th>
                <th className="p-3">GST (18%)</th>
                <th className="p-3">Total Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3">Date</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {invoices.length > 0 ? (
                invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="p-3 font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                    <td className="p-3 font-semibold">{inv.planId || 'BASIC'}</td>
                    <td className="p-3 font-mono">₹{inv.amount}</td>
                    <td className="p-3 font-mono">₹{inv.gst}</td>
                    <td className="p-3 font-mono font-bold text-emerald-600">₹{inv.amount + inv.gst}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase">
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-3">{new Date(inv.createdDate || inv.createdAt).toLocaleDateString()}</td>
                    <td className="p-3">
                      <button
                        onClick={() => PDFService.downloadInvoicePDF(inv)}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold"
                      >
                        <Download className="w-3.5 h-3.5" /> PDF
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-slate-400">No invoices generated yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Renewal Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-6 text-white shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold">Renew / Upgrade to {checkoutPlan}</h3>
              <button onClick={() => setShowCheckoutModal(false)} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Billing Cycle</label>
                <select
                  value={billingPeriod}
                  onChange={(e: any) => setBillingPeriod(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none"
                >
                  <option value="MONTHLY">Monthly Billing</option>
                  <option value="YEARLY">Yearly Billing (Save 20%)</option>
                </select>
              </div>

              {/* Coupon Code Section */}
              <div>
                <label className="block text-slate-400 mb-1">Promotional Coupon Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Try WELCOME50 or FLAT2000"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none uppercase font-mono"
                  />
                  <button
                    type="button"
                    onClick={applyCoupon}
                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 font-bold rounded-xl text-blue-400"
                  >
                    Apply
                  </button>
                </div>
                {couponMsg && (
                  <p className={`text-[11px] mt-1.5 font-medium ${couponApplied ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {couponMsg}
                  </p>
                )}
              </div>

              {/* Price Calculation Summary */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2 font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Base Plan Price:</span>
                  <span>₹{basePrice.toLocaleString()}</span>
                </div>
                {couponApplied && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Coupon Discount:</span>
                    <span>-₹{discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400">
                  <span>GST (18%):</span>
                  <span>+₹{gstAmount.toLocaleString()}</span>
                </div>
                <div className="border-t border-slate-800 pt-2 flex justify-between text-sm font-bold text-white">
                  <span>Total Payable:</span>
                  <span className="text-emerald-400">₹{finalPayable.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(false)}
                  className="px-5 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg"
                >
                  {submitting ? 'Submitting...' : 'Submit Request for Approval →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
