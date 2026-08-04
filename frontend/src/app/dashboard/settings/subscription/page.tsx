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
  HelpCircle
} from 'lucide-react';

export default function SubscriptionPage() {
  const { subscription, refresh } = useTenant();
  const [stats, setStats] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<string>('BASIC');
  const [billingPeriod, setBillingPeriod] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [gateway, setGateway] = useState<'STRIPE' | 'RAZORPAY' | 'PAYPAL'>('STRIPE');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form mock values
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('123');
  const [upiId, setUpiId] = useState('schooladmin@upi');

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

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const paymentDetails = {
        gateway,
        billingPeriod,
        method: gateway === 'PAYPAL' || gateway === 'RAZORPAY' ? 'UPI' : 'CARD',
        cardHolder: 'School Principal',
        txRef: 'TXN-' + gateway + '-' + Date.now().toString().slice(-6),
        upiHandle: upiId,
      };

      const res = await api.post('/tenant/subscription/renew', {
        planName: checkoutPlan,
        paymentDetails,
      });

      setSuccessMsg(`Payment Successful! Your subscription has been upgraded/renewed to ${checkoutPlan} via ${gateway}.`);
      setShowCheckoutModal(false);

      // Refresh global context & stats immediately
      await refresh();
      await fetchStats();
    } catch (err: any) {
      console.error('Payment gateway checkout failed:', err);
      setErrorMsg(err.response?.data?.message || 'Transaction processed failed. Please verify credentials.');
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

  const currentPlanName = stats?.plan || subscription?.plan || 'TRIAL';
  const currentStatus = stats?.status || subscription?.status || 'ACTIVE';
  const expiryDate = stats?.expiryDate || subscription?.expiryDate;
  const remainingDays = stats?.remainingDays ?? 180;
  
  const studentUsage = stats?.studentUsage ?? 0;
  const teacherUsage = stats?.teacherUsage ?? 0;
  const parentUsage = stats?.parentUsage ?? 0;

  // Filter out TRIAL from self-checkout plans grid
  const checkoutPlansList = plans.filter(p => p.name !== 'TRIAL');
  const activeSelectedPlanObj = checkoutPlansList.find(p => p.name === checkoutPlan) || checkoutPlansList[0];

  const calculateTotalPrice = (plan: any) => {
    if (!plan) return 0;
    const priceNum = Number(plan.price);
    if (billingPeriod === 'YEARLY') {
      return priceNum * 10; // 10 Months pricing for 12 months (roughly 17% discount)
    }
    return priceNum;
  };

  const totalPrice = calculateTotalPrice(activeSelectedPlanObj);

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
            Manage your school subscription plan, scan invoices, and complete payment renews.
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
                Instance ID: {(subscription as any)?.tenantId?.substring(0, 8) || 'Tenant'}
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
                Your subscription has expired. Access to operational features has been locked. Please renew to restore full access.
              </p>
            </div>
          )}
        </div>

        {/* Card 2: Current School Statistics */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-6 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              School Statistics
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between items-center p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-xs font-semibold text-slate-500">Total Students</span>
                <span className="text-sm font-bold text-slate-800">{studentUsage}</span>
              </div>
              <div className="flex justify-between items-center p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-xs font-semibold text-slate-500">Total Teachers & Staff</span>
                <span className="text-sm font-bold text-slate-800">{teacherUsage}</span>
              </div>
              <div className="flex justify-between items-center p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-xs font-semibold text-slate-500">Total Parent Profiles</span>
                <span className="text-sm font-bold text-slate-800">{parentUsage}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 text-[10px] text-slate-400 leading-relaxed">
            Record tallies are informational. EduTrack SaaS subscriptions feature flat-rate pricing with unlimited student, staff, and parent accounts.
          </div>
        </div>
      </div>

      {/* Upgrade / Renewal Panel (Simulated Checkout) */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 sm:p-8 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600" />
              Renew or Upgrade Subscription
            </h2>
            <p className="text-slate-500 text-xs font-light mt-1">
              Select a target billing plan tier and trigger payment checkout.
            </p>
          </div>
          {/* Monthly / Yearly Toggle */}
          <div className="inline-flex bg-slate-200/60 p-1 rounded-2xl shrink-0 self-start sm:self-auto border border-slate-300/40">
            <button
              onClick={() => setBillingPeriod('MONTHLY')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                billingPeriod === 'MONTHLY' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('YEARLY')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer relative ${
                billingPeriod === 'YEARLY' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
              }`}
            >
              Yearly (Save 17%)
            </button>
          </div>
        </div>

        <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Checkout plan selection */}
          <div className="space-y-4">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Select Plan Tier</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {checkoutPlansList.map((plan) => {
                const planPrice = calculateTotalPrice(plan);
                const isSelected = checkoutPlan === plan.name;
                return (
                  <div
                    key={plan.id}
                    onClick={() => setCheckoutPlan(plan.name)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer relative ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/20 text-[#2E5BFF] shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-3 right-3 bg-indigo-600 text-white rounded-full p-0.5">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider">{plan.name}</span>
                    </div>
                    <p className="text-2xl font-black text-slate-800">
                      ₹{planPrice.toLocaleString()}{' '}
                      <span className="text-xs font-normal text-slate-400">
                        /{billingPeriod === 'YEARLY' ? 'yr' : 'mo'}
                      </span>
                    </p>
                    <p className="text-[10px] text-slate-400 font-light mt-1.5">
                      {plan.name === 'BASIC'
                        ? 'Standard operational modules, reports, and attendance.'
                        : 'All modules, transport tracker, payroll, parent & teacher portals.'}
                    </p>
                  </div>
                );
              })}

            </div>

            <div className="pt-4 border-t border-slate-100 text-slate-600 space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span>Base Charge</span>
                <span>₹{totalPrice.toLocaleString()}.00</span>
              </div>
              <div className="flex justify-between text-xs font-semibold">
                <span>GST (18% Included)</span>
                <span>₹{Math.round(totalPrice * 0.18).toLocaleString()}.00</span>
              </div>
              <div className="flex justify-between text-sm font-black text-slate-800 pt-2 border-t border-slate-100">
                <span>Total Amount Due</span>
                <span>₹{totalPrice.toLocaleString()}.00</span>
              </div>
            </div>
          </div>

          {/* Payment gateway selection column */}
          <div className="flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-200 pt-8 lg:pt-0 lg:pl-8">
            <div className="space-y-4">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest text-center lg:text-left">
                Select Payment Method
              </label>
              
              <div className="grid grid-cols-3 gap-3">
                {/* Stripe */}
                <button
                  onClick={() => setGateway('STRIPE')}
                  className={`p-3 rounded-2xl border text-xs font-bold text-center transition-all cursor-pointer ${
                    gateway === 'STRIPE' ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Stripe
                </button>
                {/* Razorpay */}
                <button
                  onClick={() => setGateway('RAZORPAY')}
                  className={`p-3 rounded-2xl border text-xs font-bold text-center transition-all cursor-pointer ${
                    gateway === 'RAZORPAY' ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Razorpay
                </button>
                {/* PayPal */}
                <button
                  onClick={() => setGateway('PAYPAL')}
                  className={`p-3 rounded-2xl border text-xs font-bold text-center transition-all cursor-pointer ${
                    gateway === 'PAYPAL' ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  PayPal
                </button>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl text-center space-y-1">
                <p className="text-xs font-bold text-slate-700">Billing details wrapper active</p>
                <p className="text-[10px] text-slate-400 leading-normal max-w-xs mx-auto">
                  Clicking proceed triggers the checkout modal overlay simulating {gateway} API authentication webhooks.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowCheckoutModal(true)}
              className="mt-6 w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              Proceed to Checkout
              <ArrowUpRight className="w-4.5 h-4.5" />
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
                    <td className="px-6 py-4 font-bold">₹{Number(inv.amount).toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                        inv.status === 'PAID' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => PDFService.print()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-[11px] font-semibold text-blue-600 hover:bg-blue-50/50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Print/PDF
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gateway Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[99999] px-6 select-none animate-fade-in">
          <form
            onSubmit={handleCheckoutSubmit}
            className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl relative animate-scale-up"
          >
            {/* Close */}
            <button
              type="button"
              onClick={() => setShowCheckoutModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <h3 className="text-xl font-black text-slate-800 tracking-tight font-sans flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-600" />
              Checkout: {gateway}
            </h3>
            <p className="text-xs text-slate-400 font-light mt-1">
              Completing simulated billing for {checkoutPlan} plan. Total: ₹{totalPrice.toLocaleString()}.
            </p>

            <div className="mt-6 space-y-4">
              {gateway === 'STRIPE' ? (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Card Number</label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Expiry Date</label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        required
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">CVV</label>
                      <input
                        type="password"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        required
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">UPI VPA Address</label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white"
                  />
                  <p className="text-[9px] text-slate-400 mt-1">Simulated push webhook notifications will send request to this address.</p>
                </div>
              )}
            </div>

            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200/80 rounded-xl text-xs font-bold text-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="w-1/2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Pay & Activate
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
