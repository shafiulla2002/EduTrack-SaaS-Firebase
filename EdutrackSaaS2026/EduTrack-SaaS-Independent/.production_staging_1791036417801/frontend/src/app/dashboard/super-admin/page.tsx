'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  Globe,
  Sliders,
  DollarSign,
  TrendingUp,
  ShieldAlert,
  Calendar,
  Plus,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  FileText,
  Settings,
  PieChart,
  Layers,
  Save,
  Check
} from 'lucide-react';

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tenants' | 'plans' | 'invoices' | 'settings'>('tenants');

  // Selected entities for actions
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  // Overrides & Modals state
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustPlan, setAdjustPlan] = useState<string>('TRIAL');
  const [adjustExpiry, setAdjustExpiry] = useState('');
  const [adjustStatus, setAdjustStatus] = useState<string>('ACTIVE');
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // Edit Plan state
  const [editPlanPrice, setEditPlanPrice] = useState<string>('');
  const [editPlanFeatures, setEditPlanFeatures] = useState<string[]>([]);
  const [editPlanActive, setEditPlanActive] = useState<boolean>(true);
  const [planSubmitting, setPlanSubmitting] = useState(false);

  // Manual Invoice State
  const [invoiceTenantId, setInvoiceTenantId] = useState('');
  const [invoicePlan, setInvoicePlan] = useState<string>('BASIC');
  const [invoiceAmount, setInvoiceAmount] = useState('5000');
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Settings State
  const [platformSettings, setPlatformSettings] = useState<any>({});
  const [gateways, setGateways] = useState<any[]>([]);
  const [settingsSubmitting, setSettingsSubmitting] = useState(false);
  const [editGateway, setEditGateway] = useState<any>(null);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [statsRes, tenantsRes, plansRes, settingsRes, gatewaysRes] = await Promise.all([
        api.get('/super-admin/dashboard/stats'),
        api.get('/super-admin/tenants'),
        api.get('/super-admin/plans'),
        api.get('/super-admin/settings'),
        api.get('/super-admin/gateways'),
      ]);
      setStats(statsRes.data);
      setTenants(tenantsRes.data);
      setPlans(plansRes.data || []);
      setPlatformSettings(settingsRes.data || {});
      setGateways(gatewaysRes.data || []);
    } catch (err) {
      console.error('Failed to load Super Admin dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const openAdjustModal = (tenant: any) => {
    setSelectedTenant(tenant);
    setAdjustPlan(tenant.subscription?.plan?.name || 'TRIAL');
    if (tenant.subscription?.expiryDate) {
      const dateStr = new Date(tenant.subscription.expiryDate).toISOString().substring(0, 10);
      setAdjustExpiry(dateStr);
    } else {
      setAdjustExpiry('');
    }
    setAdjustStatus(tenant.subscription?.status || 'ACTIVE');
    setShowAdjustModal(true);
  };

  const handleAdjustSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalSubmitting(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await api.post(`/super-admin/tenants/${selectedTenant.id}/subscription`, {
        planName: adjustPlan,
        expiryDate: adjustExpiry ? new Date(adjustExpiry).toISOString() : undefined,
        status: adjustStatus,
      });

      setSuccessMsg(`Successfully updated subscription for school "${selectedTenant.name}".`);
      setShowAdjustModal(false);
      await fetchAllData();
    } catch (err: any) {
      console.error('Adjust subscription failed:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to update subscription.');
    } finally {
      setModalSubmitting(false);
    }
  };

  const startEditPlan = (plan: any) => {
    setSelectedPlan(plan);
    setEditPlanPrice(String(plan.price));
    setEditPlanFeatures(plan.features || []);
    setEditPlanActive(plan.isActive);
  };

  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlanSubmitting(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await api.put(`/super-admin/plans/${selectedPlan.id}`, {
        price: Number(editPlanPrice),
        features: editPlanFeatures,
        isActive: editPlanActive,
      });

      setSuccessMsg(`Plan "${selectedPlan.name}" updated successfully.`);
      setSelectedPlan(null);
      await fetchAllData();
    } catch (err: any) {
      console.error('Failed to update plan:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to update plan details.');
    } finally {
      setPlanSubmitting(false);
    }
  };

  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceTenantId) {
      setErrorMsg('Please select a school to generate an invoice.');
      return;
    }
    setInvoiceSubmitting(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const res = await api.post('/super-admin/billing/invoices/generate', {
        tenantId: invoiceTenantId,
        planName: invoicePlan,
        amount: Number(invoiceAmount),
      });
      setSuccessMsg(`Manual Invoice ${res.data.invoiceNumber} generated successfully.`);
      await fetchAllData();
    } catch (err: any) {
      console.error('Generate manual invoice failed:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to generate manual invoice.');
    } finally {
      setInvoiceSubmitting(false);
    }
  };

  const toggleFeatureFlag = (feature: string) => {
    if (editPlanFeatures.includes(feature)) {
      setEditPlanFeatures(prev => prev.filter(f => f !== feature));
    } else {
      setEditPlanFeatures(prev => [...prev, feature]);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSubmitting(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await api.put('/super-admin/settings', platformSettings);
      setSuccessMsg('Platform settings updated successfully.');
      await fetchAllData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to update platform settings.');
    } finally {
      setSettingsSubmitting(false);
    }
  };

  const handleUpdateGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGateway) return;
    setSettingsSubmitting(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await api.put(`/super-admin/gateways/${editGateway.gatewayName}`, {
        isActive: editGateway.isActive,
        apiKey: editGateway.apiKey,
        apiSecret: editGateway.apiSecret,
        webhookSecret: editGateway.webhookSecret,
      });
      setSuccessMsg(`${editGateway.gatewayName} configuration updated successfully.`);
      setEditGateway(null);
      await fetchAllData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to update gateway configuration.');
    } finally {
      setSettingsSubmitting(false);
    }
  };

  const availableModules = [
    { key: 'admissions', label: 'Admissions & Promotions' },
    { key: 'attendance', label: 'Attendance Management' },
    { key: 'timetable', label: 'Timetable Scheduling' },
    { key: 'exams', label: 'Exam & GPA Management' },
    { key: 'billing', label: 'Fee Management & Invoices' },
    { key: 'library', label: 'Library Management' },
    { key: 'expenses', label: 'Expense Tracking' },
    { key: 'academics', label: 'Grades & Academics' },
    { key: 'transport', label: 'GPS Transport Tracker' },
    { key: 'hostel', label: 'Hostel Allocation' },
    { key: 'payroll', label: 'Staff Payroll Ledger' },
    { key: 'teacher_portal', label: 'Teacher Portal Access' },
    { key: 'parent_portal', label: 'Parent Portal Access' }
  ];

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-10 h-10 animate-spin text-indigo-600" />
          <p className="text-sm font-semibold text-slate-500">Loading Super Admin Controls...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-indigo-950 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-indigo-600" />
            Super Admin Controls
          </h1>
          <p className="text-slate-400 text-sm font-light mt-1">
            Overview of SaaS platform metrics, tenant environments, manual plan overrides, and invoice auditing.
          </p>
        </div>
        <button
          onClick={fetchAllData}
          className="flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-200 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50 transition-colors shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Sync Live Data
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

      {/* Metric Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Schools</span>
            <Globe className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-slate-800 mt-2">{stats?.totalSchools ?? 0}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Active Trials</span>
            <Calendar className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-slate-800 mt-2">{stats?.activeTrials ?? 0}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Active Paid</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-slate-800 mt-2">{stats?.activePaid ?? 0}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Expired / Suspended</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-slate-800 mt-2">{(stats?.expired ?? 0) + (stats?.grace ?? 0)}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Platform Revenue</span>
            <DollarSign className="w-4 h-4 text-[#2E5BFF]" />
          </div>
          <p className="text-2xl font-black text-slate-800 mt-2">₹{(stats?.totalRevenue ?? 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Tabs Selector Navigation */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('tenants')}
          className={`pb-4 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'tenants' ? 'border-indigo-600 text-indigo-900' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Tenant Environments
        </button>
        <button
          onClick={() => setActiveTab('plans')}
          className={`pb-4 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'plans' ? 'border-indigo-600 text-indigo-900' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Subscription Plans Configuration
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`pb-4 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'invoices' ? 'border-indigo-600 text-indigo-900' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Manual Invoicing
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-4 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'settings' ? 'border-indigo-600 text-indigo-900' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Platform Settings
        </button>
      </div>

      {/* Tab CONTENT: Tenants */}
      {activeTab === 'tenants' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Tenant Environments</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                  <th className="px-6 py-3.5">School Name</th>
                  <th className="px-6 py-3.5">Subdomain</th>
                  <th className="px-6 py-3.5">Plan Tier</th>
                  <th className="px-6 py-3.5">Expiry Date</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                {tenants.map((tenant: any) => (
                  <tr key={tenant.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-800">{tenant.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{tenant.id}</p>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-500">{tenant.subDomain}.edutrack.com</td>
                    <td className="px-6 py-4">
                      <span className="font-semibold uppercase tracking-wide">
                        {tenant.subscription?.plan?.name || 'NO_PLAN'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {tenant.subscription?.expiryDate
                        ? new Date(tenant.subscription.expiryDate).toLocaleDateString()
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                        tenant.subscription?.status === 'ACTIVE' 
                          ? 'bg-emerald-50 text-emerald-600' 
                          : 'bg-red-50 text-red-600'
                      }`}>
                        {tenant.subscription?.status || 'UNKNOWN'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openAdjustModal(tenant)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Sliders className="w-3 h-3" />
                        Adjust
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab CONTENT: Plans Configurator */}
      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List of Plans */}
          <div className="lg:col-span-2 space-y-4">
            {plans.map((p) => (
              <div
                key={p.id}
                onClick={() => startEditPlan(p)}
                className={`p-6 bg-white border rounded-3xl cursor-pointer transition-all shadow-xs ${
                  selectedPlan?.id === p.id ? 'border-indigo-600 ring-2 ring-indigo-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-black text-slate-800 uppercase tracking-wide">{p.name} PLAN</h3>
                  </div>
                  <span className={`text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                    p.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {p.isActive ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className="text-xl font-black text-slate-800">
                  ₹{Number(p.price).toLocaleString()} <span className="text-xs font-normal text-slate-400">/mo</span>
                </p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-3">Enabled Features ({p.features?.length || 0})</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(p.features || []).map((f: string) => (
                    <span key={f} className="text-[9px] font-bold bg-slate-50 border border-slate-150 text-slate-500 px-2 py-0.5 rounded-md">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Editor Sidebar */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm h-fit">
            {selectedPlan ? (
              <form onSubmit={handleUpdatePlan} className="space-y-6">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Settings className="w-4.5 h-4.5 text-indigo-600" />
                    Edit Plan: {selectedPlan.name}
                  </h3>
                  <p className="text-slate-400 text-[10px] font-light mt-1">Configure pricing structure and enable specific platform feature modules.</p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Monthly Pricing (INR)</label>
                  <input
                    type="number"
                    value={editPlanPrice}
                    onChange={(e) => setEditPlanPrice(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:border-indigo-600 focus:bg-white transition-all"
                  />
                </div>

                <div className="space-y-2.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Feature Flags ACL</label>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-2 border border-slate-100 p-2 rounded-xl">
                    {availableModules.map((module) => {
                      const isChecked = editPlanFeatures.includes(module.key);
                      return (
                        <div
                          key={module.key}
                          onClick={() => toggleFeatureFlag(module.key)}
                          className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors border ${
                            isChecked 
                              ? 'bg-indigo-50/30 border-indigo-200 text-indigo-700 font-semibold' 
                              : 'bg-white border-slate-150 hover:bg-slate-50 text-slate-500'
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${
                            isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                          }`}>
                            {isChecked && <Check className="w-2.5 h-2.5" />}
                          </div>
                          <span className="text-[11px] select-none truncate">{module.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-xs font-semibold text-slate-500">Plan Enabled Status</span>
                  <input
                    type="checkbox"
                    checked={editPlanActive}
                    onChange={(e) => setEditPlanActive(e.target.checked)}
                    className="accent-indigo-600 cursor-pointer h-4 w-4"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedPlan(null)}
                    className="w-1/2 py-2.5 border border-slate-200 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50 cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={planSubmitting}
                    className="w-1/2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {planSubmitting ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        Save Config
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <Layers className="w-8 h-8 mx-auto mb-3 text-slate-300 animate-pulse" />
                <p className="text-xs font-semibold">Select any plan to the left to modify pricing configurations and feature flags.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab CONTENT: Manual Invoicing */}
      {activeTab === 'invoices' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Payment Feed logs */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Recent Platform Payments</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                    <th className="px-6 py-3">School</th>
                    <th className="px-6 py-3">Tx Ref ID</th>
                    <th className="px-6 py-3">Gateway</th>
                    <th className="px-6 py-3">Amount</th>
                    <th className="px-6 py-3">Paid Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600 text-xs">
                  {(stats?.recentPayments || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-6 text-center text-slate-400 font-medium">
                        No recent platform payments logged.
                      </td>
                    </tr>
                  ) : (
                    stats.recentPayments.map((pay: any) => (
                      <tr key={pay.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3 font-bold text-slate-800">{pay.schoolName}</td>
                        <td className="px-6 py-3 font-mono">{pay.transactionId}</td>
                        <td className="px-6 py-3 font-bold text-indigo-700">{pay.gateway}</td>
                        <td className="px-6 py-3 font-bold text-indigo-600">₹{Number(pay.amount).toLocaleString()}</td>
                        <td className="px-6 py-3 text-slate-400">
                          {new Date(pay.paidAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Manual Invoice Builder Widget */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm flex flex-col justify-between h-fit">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileText className="w-4.5 h-4.5 text-indigo-600" />
                Manual Invoice Builder
              </h3>
              <p className="text-slate-400 text-[11px] leading-relaxed mb-6 font-light">
                Issue custom pricing subscription invoices directly to any school environment.
              </p>

              <form onSubmit={handleGenerateInvoice} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Target School
                  </label>
                  <select
                    value={invoiceTenantId}
                    onChange={(e) => setInvoiceTenantId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:border-indigo-600 focus:bg-white transition-all cursor-pointer"
                  >
                    <option value="">-- Choose School --</option>
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Plan Tier
                  </label>
                  <select
                    value={invoicePlan}
                    onChange={(e) => setInvoicePlan(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:border-indigo-600 focus:bg-white transition-all cursor-pointer"
                  >
                    <option value="BASIC">BASIC</option>
                    <option value="PREMIUM">PREMIUM</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Custom Cost Amount (INR)
                  </label>
                  <input
                    type="number"
                    value={invoiceAmount}
                    onChange={(e) => setInvoiceAmount(e.target.value)}
                    placeholder="e.g. 1999"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:border-indigo-600 focus:bg-white transition-all"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={invoiceSubmitting}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {invoiceSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      Generate Manual Invoice
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Tab CONTENT: Platform Settings */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* General Platform Settings */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
            <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-6 flex items-center gap-2">
              <Settings className="w-4.5 h-4.5 text-indigo-600" />
              General Platform Settings
            </h2>
            <form onSubmit={handleUpdateSettings} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Company Name</label>
                <input
                  type="text"
                  value={platformSettings.companyName || ''}
                  onChange={(e) => setPlatformSettings({...platformSettings, companyName: e.target.value})}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:border-indigo-600 focus:bg-white transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Currency Code</label>
                  <input
                    type="text"
                    value={platformSettings.currency || ''}
                    onChange={(e) => setPlatformSettings({...platformSettings, currency: e.target.value})}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:border-indigo-600 focus:bg-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Tax Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={platformSettings.taxRate || ''}
                    onChange={(e) => setPlatformSettings({...platformSettings, taxRate: parseFloat(e.target.value)})}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:border-indigo-600 focus:bg-white transition-all"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={settingsSubmitting}
                className="w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {settingsSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save General Settings
              </button>
            </form>
          </div>

          {/* Payment Gateways Config */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
            <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-6 flex items-center gap-2">
              <DollarSign className="w-4.5 h-4.5 text-indigo-600" />
              Payment Gateway Configurations
            </h2>
            <div className="space-y-4">
              {gateways.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                  No payment gateways configured. Start by editing RAZORPAY.
                </div>
              )}
              {['RAZORPAY', 'STRIPE'].map(gatewayName => {
                const gateway = gateways.find(g => g.gatewayName === gatewayName) || { gatewayName, isActive: false, apiKey: '', apiSecret: '' };
                const isEditing = editGateway?.gatewayName === gatewayName;
                
                if (isEditing) {
                  return (
                    <form key={gatewayName} onSubmit={handleUpdateGateway} className="p-4 border border-indigo-200 bg-indigo-50/20 rounded-2xl space-y-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-black text-slate-800 uppercase">{gatewayName} Config</h4>
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Active</label>
                          <input 
                            type="checkbox" 
                            checked={editGateway.isActive}
                            onChange={(e) => setEditGateway({...editGateway, isActive: e.target.checked})}
                            className="w-4 h-4 accent-indigo-600"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">API Key / Key ID</label>
                        <input
                          type="text"
                          value={editGateway.apiKey || ''}
                          onChange={(e) => setEditGateway({...editGateway, apiKey: e.target.value})}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs"
                          placeholder="rzp_live_..."
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">API Secret / Key Secret</label>
                        <input
                          type="password"
                          value={editGateway.apiSecret || ''}
                          onChange={(e) => setEditGateway({...editGateway, apiSecret: e.target.value})}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs"
                          placeholder="********"
                          required
                        />
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-slate-100">
                        <button type="button" onClick={() => setEditGateway(null)} className="flex-1 py-2 text-xs font-semibold border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancel</button>
                        <button type="submit" disabled={settingsSubmitting} className="flex-1 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50">Save</button>
                      </div>
                    </form>
                  );
                }

                return (
                  <div key={gatewayName} className="flex items-center justify-between p-4 border border-slate-200 rounded-2xl bg-slate-50">
                    <div>
                      <h4 className="font-bold text-slate-800 uppercase">{gatewayName}</h4>
                      <span className={`text-[10px] font-bold uppercase ${gateway.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {gateway.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <button onClick={() => setEditGateway({...gateway})} className="px-3 py-1.5 border border-slate-200 text-[11px] font-semibold text-indigo-600 bg-white hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer">
                      Edit
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Adjust Subscription Modal */}
      {showAdjustModal && selectedTenant && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[999] px-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide">Adjust Plan: {selectedTenant.name}</h3>
              <button 
                onClick={() => setShowAdjustModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleAdjustSubscription} className="p-6 space-y-4 text-left">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Subscription Plan</label>
                <select
                  value={adjustPlan}
                  onChange={(e) => setAdjustPlan(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:border-indigo-600 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="TRIAL">TRIAL</option>
                  <option value="BASIC">BASIC</option>
                  <option value="PREMIUM">PREMIUM</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Manual Expiry Date</label>
                <input
                  type="date"
                  value={adjustExpiry}
                  onChange={(e) => setAdjustExpiry(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:border-indigo-600 focus:bg-white transition-all cursor-pointer"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">System Status</label>
                <select
                  value={adjustStatus}
                  onChange={(e) => setAdjustStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:border-indigo-600 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="EXPIRED">EXPIRED</option>
                  <option value="PAST_DUE">PAST_DUE (Grace period)</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 border border-slate-200 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {modalSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Saving Overrides...
                    </>
                  ) : (
                    'Save Adjustments'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
