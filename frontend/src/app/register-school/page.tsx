'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { School, User, Mail, MapPin, Calendar, Loader2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useTenant } from '../providers/TenantContext';

function RegisterSchoolContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useTenant();
  
  const phone = searchParams.get('phone') || '';

  const [formData, setFormData] = useState({
    schoolName: '',
    schoolType: 'School',
    adminName: '',
    mobileNumber: phone,
    email: '',
    address: '',
    academicYear: '2026-2027',
    subscriptionPlan: 'TRIAL',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Keep phone prefilled if it changes in URL query
  useEffect(() => {
    if (phone) {
      setFormData((prev) => ({ ...prev, mobileNumber: phone }));
    } else {
      router.push('/auth/login');
    }
  }, [phone, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Check mandatory fields
    const required = [
      'schoolName',
      'schoolType',
      'adminName',
      'mobileNumber',
      'email',
      'address',
      'academicYear',
    ];

    for (const field of required) {
      if (!formData[field as keyof typeof formData]) {
        setError('Please fill in all the required fields.');
        return;
      }
    }

    setLoading(true);
    try {
      const response = await api.post('/tenant/register', formData);
      const data = response.data;
      
      if (data.success && data.access_token) {
        // Store JWT token and new Tenant ID in local storage under admin namespace
        localStorage.setItem('admin_token', data.access_token);
        localStorage.setItem('admin_tenantId', data.user.tenantId);
        if (data.user.phone) {
          localStorage.setItem('admin_userPhone', data.user.phone);
        }
        sessionStorage.setItem('active_role', 'SCHOOL_ADMIN');

        // Fetch tenant details immediately to verify branding is ready
        try {
          await refresh();
        } catch (err) {
          console.error('Failed to pre-fetch school profile on registration:', err);
        }

        // Redirect directly to the ERP dashboard
        router.push('/dashboard');
      } else {
        setError('Registration succeeded but login session was not returned.');
      }
    } catch (err: any) {
      console.error('Register school error:', err);
      setError(err.response?.data?.message || 'Failed to register school. Please check details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center py-12 px-4 relative overflow-y-auto">
      {/* Background Ornaments */}
      <div className="absolute top-[10%] left-[10%] w-[350px] h-[350px] rounded-full bg-brand-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[10%] w-[350px] h-[350px] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />

      {/* Main Form container */}
      <div className="w-full max-w-2xl z-10">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <span className="font-extrabold text-white text-xl tracking-tight">ET</span>
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              EduTrack <span className="text-brand-400 font-medium text-xs px-2 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20 ml-1">SaaS</span>
            </span>
          </div>
        </div>

        <div className="glass-card p-8 md:p-10 rounded-3xl border border-slate-900/50 bg-slate-900/40 backdrop-blur-xl">
          <div className="mb-8 text-center md:text-left border-b border-slate-900/50 pb-5">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Register Your Institution</h2>
            <p className="text-slate-400 text-sm mt-2 font-light">
              Just a few mandatory details to provision your dedicated cloud school instance.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs mb-6">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Institution Details */}
              <div className="space-y-4 col-span-1 md:col-span-2">
                <h3 className="text-sm font-semibold text-brand-400 uppercase tracking-wider">Institution Details</h3>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  School/College Name *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <School className="w-4.5 h-4.5" />
                  </div>
                  <input
                    type="text"
                    name="schoolName"
                    value={formData.schoolName}
                    onChange={handleChange}
                    placeholder="e.g. Greenwood High School"
                    className="block w-full pl-11 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm font-light transition-all"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Institution Type *
                </label>
                <select
                  name="schoolType"
                  value={formData.schoolType}
                  onChange={handleChange}
                  className="block w-full px-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm font-light transition-all cursor-pointer"
                  required
                  disabled={loading}
                >
                  <option value="School">School</option>
                  <option value="College">College</option>
                  <option value="University">University</option>
                </select>
              </div>

              {/* Administrative Contact */}
              <div className="space-y-4 col-span-1 md:col-span-2 border-t border-slate-900/50 pt-5 mt-2">
                <h3 className="text-sm font-semibold text-brand-400 uppercase tracking-wider">Admin Settings</h3>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Admin Full Name *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4.5 h-4.5" />
                  </div>
                  <input
                    type="text"
                    name="adminName"
                    value={formData.adminName}
                    onChange={handleChange}
                    placeholder="e.g. John Doe"
                    className="block w-full pl-11 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm font-light transition-all"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Admin Email Address *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4.5 h-4.5" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="e.g. admin@greenwood.com"
                    className="block w-full pl-11 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm font-light transition-all"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Admin Verified Mobile Number *
                </label>
                <input
                  type="text"
                  name="mobileNumber"
                  value={formData.mobileNumber}
                  className="block w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-500 text-sm font-light cursor-not-allowed"
                  required
                  disabled
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Initial Academic Year *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Calendar className="w-4.5 h-4.5" />
                  </div>
                  <input
                    type="text"
                    name="academicYear"
                    value={formData.academicYear}
                    onChange={handleChange}
                    placeholder="e.g. 2026-2027"
                    className="block w-full pl-11 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm font-light transition-all"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Physical Address *
                </label>
                <div className="relative">
                  <div className="absolute top-3 left-3.5 text-slate-500">
                    <MapPin className="w-4.5 h-4.5" />
                  </div>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Enter complete building, street, and city details..."
                    rows={3}
                    className="block w-full pl-11 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm font-light transition-all"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Subscription Plan Selection */}
              <div className="col-span-1 md:col-span-2 border-t border-slate-900/50 pt-5 mt-2">
                <h3 className="text-sm font-semibold text-brand-400 uppercase tracking-wider mb-4">Select Subscription Plan</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Trial Card */}
                  <div
                    onClick={() => setFormData(prev => ({ ...prev, subscriptionPlan: 'TRIAL' }))}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      formData.subscriptionPlan === 'TRIAL'
                        ? 'border-brand-500 bg-brand-500/5 text-white'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-slate-200">Trial</span>
                        {formData.subscriptionPlan === 'TRIAL' && (
                          <span className="w-2.5 h-2.5 rounded-full bg-brand-500" />
                        )}
                      </div>
                      <p className="text-2xl font-black text-white mb-2">Free</p>
                      <p className="text-[11px] leading-relaxed mb-4">6 Months Trial. Full access to evaluate platform capabilities.</p>
                    </div>
                    <ul className="text-[10px] space-y-1.5 border-t border-slate-900/50 pt-3">
                      <li>• 1,000 Students Limit</li>
                      <li>• 100 Teachers Limit</li>
                      <li>• Standard Support</li>
                    </ul>
                  </div>

                  {/* Basic Card */}
                  <div
                    onClick={() => setFormData(prev => ({ ...prev, subscriptionPlan: 'BASIC' }))}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      formData.subscriptionPlan === 'BASIC'
                        ? 'border-indigo-500 bg-indigo-500/5 text-white'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-slate-200">Basic</span>
                        {formData.subscriptionPlan === 'BASIC' && (
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                        )}
                      </div>
                      <p className="text-2xl font-black text-white mb-2">₹1,999<span className="text-xs font-normal">/mo</span></p>
                      <p className="text-[11px] leading-relaxed mb-4">Essential features for small to mid-sized schools.</p>
                    </div>
                    <ul className="text-[10px] space-y-1.5 border-t border-slate-900/50 pt-3">
                      <li>• 5,000 Students Limit</li>
                      <li>• 200 Teachers Limit</li>
                      <li>• Priority Support</li>
                    </ul>
                  </div>

                  {/* Premium Card */}
                  <div
                    onClick={() => setFormData(prev => ({ ...prev, subscriptionPlan: 'PREMIUM' }))}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      formData.subscriptionPlan === 'PREMIUM'
                        ? 'border-pink-500 bg-pink-500/5 text-white'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-slate-200">Premium</span>
                        {formData.subscriptionPlan === 'PREMIUM' && (
                          <span className="w-2.5 h-2.5 rounded-full bg-pink-500" />
                        )}
                      </div>
                      <p className="text-2xl font-black text-white mb-2">₹4,999<span className="text-xs font-normal">/mo</span></p>
                      <p className="text-[11px] leading-relaxed mb-4">Unlimited operations and premium modules for large schools.</p>
                    </div>
                    <ul className="text-[10px] space-y-1.5 border-t border-slate-900/50 pt-3">
                      <li>• Unlimited Students</li>
                      <li>• Unlimited Teachers</li>
                      <li>• 24/7 Dedicated Support</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-900/50 pt-6 mt-6 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-3 bg-gradient-to-r from-brand-600 to-indigo-600 text-white rounded-xl font-bold text-sm hover:from-brand-500 hover:to-indigo-500 shadow-lg shadow-brand-500/15 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Provisioning Instance...
                  </>
                ) : (
                  'Complete Registration'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function RegisterSchoolPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-slate-100 flex justify-center items-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    }>
      <RegisterSchoolContent />
    </Suspense>
  );
}
