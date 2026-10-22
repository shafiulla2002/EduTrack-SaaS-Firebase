'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Building2, User, ShieldCheck, CreditCard, Receipt, FileText, ArrowLeft, RefreshCw, Key, Lock, Unlock, LogOut, CheckCircle, AlertTriangle
} from 'lucide-react';
import { getApiUrl } from '@/lib/api';

export default function SchoolDetailsProfilePage() {
  const params = useParams();
  const router = useRouter();
  const schoolId = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [actionMsg, setActionMsg] = useState('');

  const fetchSchoolDetails = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const baseUrl = getApiUrl();
      const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const res = await fetch(`${cleanUrl}/super-admin/schools/${schoolId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (schoolId) fetchSchoolDetails();
  }, [schoolId]);

  const handleImpersonate = async () => {
    try {
      const token = localStorage.getItem('token');
      const baseUrl = getApiUrl();
      const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const res = await fetch(`${cleanUrl}/super-admin/impersonate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ schoolId }),
      });
      const result = await res.json();
      if (res.ok && result.access_token) {
        // Redirect to School App with impersonation token & flag
        localStorage.setItem('admin_token', result.access_token);
        localStorage.setItem('admin_tenantId', result.user.tenantId);
        sessionStorage.setItem('impersonating_from_platform', 'true');
        sessionStorage.setItem('impersonated_school_name', data?.school?.name || 'School');
        window.location.href = 'http://localhost:3000/dashboard';
      } else {
        alert(result.message || 'Impersonation failed');
      }
    } catch (err: any) {
      alert(`Impersonation failed: ${err.message}`);
    }
  };

  const handleAdminAction = async (action: string) => {
    setActionMsg('');
    try {
      const token = localStorage.getItem('token');
      const baseUrl = getApiUrl();
      const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const res = await fetch(`${cleanUrl}/super-admin/schools/${schoolId}/admin/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });
      const result = await res.json();
      setActionMsg(`Success: ${action} executed.`);
      setTimeout(() => setActionMsg(''), 4000);
    } catch (err: any) {
      alert(`Action error: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400 animate-pulse font-medium text-sm">
        Loading School Master Profile...
      </div>
    );
  }

  const school = data?.school || {};
  const admin = data?.admin || {};
  const sub = data?.subscription || {};
  const metrics = data?.metrics || {};

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/schools')}
            className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">{school.name || 'School Profile'}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                {sub.status || 'ACTIVE'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Code: <span className="font-mono text-slate-200">{school.code || 'N/A'}</span> · Tenant ID: <span className="font-mono text-slate-200">{school.id}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleImpersonate}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg cursor-pointer"
          >
            <Key className="w-4 h-4" />
            <span>Impersonate Admin</span>
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-800 text-emerald-200 rounded-xl text-xs font-semibold">
          {actionMsg}
        </div>
      )}

      {/* Profile Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Students</span>
          <div className="text-xl font-bold text-white mt-1">{metrics.students || 0}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Teachers</span>
          <div className="text-xl font-bold text-white mt-1">{metrics.teachers || 0}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Revenue</span>
          <div className="text-xl font-bold text-emerald-400 mt-1">₹{(metrics.revenue || 25000).toLocaleString()}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] text-slate-400 uppercase font-semibold">Storage Used</span>
          <div className="text-xl font-bold text-blue-400 mt-1">{metrics.storageMB || 420} MB</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-3 border-b-2 ${activeTab === 'overview' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400'}`}
        >
          School Information
        </button>
        <button
          onClick={() => setActiveTab('admin')}
          className={`px-4 py-3 border-b-2 ${activeTab === 'admin' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400'}`}
        >
          Admin & Security
        </button>
        <button
          onClick={() => setActiveTab('subscription')}
          className={`px-4 py-3 border-b-2 ${activeTab === 'subscription' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400'}`}
        >
          Subscription & Dues
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 text-xs">
          <h3 className="text-sm font-bold text-white">General Information</h3>
          <div className="grid grid-cols-2 gap-4 text-slate-300">
            <div><strong>Address:</strong> {school.address || 'Vikas Nagar, New Delhi'}</div>
            <div><strong>Phone:</strong> {school.phone || '+91 9876543210'}</div>
            <div><strong>Email:</strong> {school.email || 'admin@school.edu'}</div>
            <div><strong>Board:</strong> CBSE / ICSE</div>
          </div>
        </div>
      )}

      {activeTab === 'admin' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 text-xs">
          <h3 className="text-sm font-bold text-white">Admin Management</h3>
          <p className="text-slate-400">Admin Name: <strong className="text-white">{admin.name || 'School Admin'}</strong> ({admin.email || 'admin@school.edu'})</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button onClick={() => handleAdminAction('reset_password')} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg">Reset Password</button>
            <button onClick={() => handleAdminAction('disable_account')} className="px-3 py-2 bg-rose-950 text-rose-300 hover:bg-rose-900 rounded-lg">Disable Account</button>
            <button onClick={() => handleAdminAction('enable_account')} className="px-3 py-2 bg-emerald-950 text-emerald-300 hover:bg-emerald-900 rounded-lg">Enable Account</button>
            <button onClick={() => handleAdminAction('force_logout')} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg">Force Logout</button>
          </div>
        </div>
      )}

      {activeTab === 'subscription' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 text-xs">
          <h3 className="text-sm font-bold text-white">Subscription Management</h3>
          <div className="flex justify-between items-center text-slate-300">
            <div>Current Plan: <strong className="text-blue-400">{sub.planName || 'BASIC'}</strong></div>
            <div>Expiry: <strong className="text-slate-100">{new Date(sub.expiryDate || Date.now()).toLocaleDateString()}</strong></div>
          </div>
        </div>
      )}
    </div>
  );
}
