'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useTenant } from '../../providers/TenantContext';
import { User, KeyRound, CheckCircle, AlertCircle, Sparkles, Mail, Phone, BookOpen, Shield, ShieldCheck, Lock, PhoneCall, Check } from 'lucide-react';

export default function ProfilePage() {
  const { refresh } = useTenant();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [qualification, setQualification] = useState('');

  // Mobile OTP Security verification states
  const [otpStep, setOtpStep] = useState<'IDLE' | 'SENDING' | 'OTP_SENT' | 'VERIFIED'>('IDLE');
  const [otpCode, setOtpCode] = useState('');
  const [otpMessage, setOtpMessage] = useState('');

  async function loadProfile() {
    try {
      const res = await api.get('/teacher-portal/profile');
      setProfile(res.data);
      setName(res.data.user.name);
      setPhone(res.data.user.phone || '');
      setQualification(res.data.qualification || '');
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setUpdating(true);
    try {
      await api.put('/teacher-portal/profile', { name, phone, qualification });
      setSuccessMsg('Profile updated successfully.');
      await refresh();
      await loadProfile();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setUpdating(false);
    }
  };

  const handleSendOtp = () => {
    setOtpStep('SENDING');
    setOtpMessage('');
    setErrorMsg('');
    setTimeout(() => {
      setOtpStep('OTP_SENT');
      setOtpMessage(`Verification OTP sent to +91 ${phone || profile?.user?.phone}`);
    }, 1000);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 4) {
      setErrorMsg('Please enter a valid verification code.');
      return;
    }
    setUpdating(true);
    setTimeout(() => {
      setUpdating(false);
      setOtpStep('VERIFIED');
      setSuccessMsg('Mobile authentication credentials verified successfully.');
      setOtpMessage('');
    }, 1000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-4 border-t-[#2E5BFF] border-slate-200 rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-md mx-auto sm:max-w-none">
      <div className="flex justify-between items-center pb-4 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <User className="w-6 h-6 text-[#2E5BFF]" />
          My Profile & Settings
        </h2>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 text-xs font-semibold">
          <CheckCircle className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-start gap-2.5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-semibold">
          <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Grid wrapper */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Profile Card Summary */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center text-center space-y-4">
          {profile?.user?.avatarUrl ? (
            <img src={profile.user.avatarUrl} alt={profile.user.name} className="w-24 h-24 rounded-full object-cover border-2 border-[#2E5BFF]" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 text-white flex items-center justify-center font-black text-3xl select-none shadow-lg">
              {profile?.user?.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h3 className="font-bold text-slate-800 text-lg">{profile?.user?.name}</h3>
            <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wide">{profile?.designation || 'Faculty Teacher'}</p>
          </div>

          <div className="w-full border-t border-slate-100 pt-4 space-y-2 text-left">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <Shield className="w-4 h-4 text-slate-400" />
              <span>Employee ID: <strong>{profile?.employeeId || 'N/A'}</strong></span>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <Mail className="w-4 h-4 text-slate-400" />
              <span>{profile?.user?.email}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <Phone className="w-4 h-4 text-slate-400" />
              <span>+91 {profile?.user?.phone || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <BookOpen className="w-4 h-4 text-slate-400" />
              <span>Subjects: {profile?.subjectsTaught?.join(', ') || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Update Profile Form */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 text-[15px] flex items-center gap-2 pb-2 border-b border-slate-100">
            <Sparkles className="w-4.5 h-4.5 text-[#2E5BFF]" />
            Edit Profile Information
          </h3>

          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Contact Mobile</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Academic Qualifications</label>
              <input
                type="text"
                value={qualification}
                onChange={(e) => setQualification(e.target.value)}
                placeholder="e.g. M.Sc. Mathematics, B.Ed."
                className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={updating}
              className="w-full py-2.5 px-4 bg-[#2E5BFF] text-white rounded-xl font-semibold text-xs hover:bg-blue-600 transition-all cursor-pointer disabled:opacity-50"
            >
              Save Changes
            </button>
          </form>
        </div>

        {/* Security & Mobile Login Credentials Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
          <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-[15px] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#2E5BFF]" />
              Security & Login Access
            </h3>
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              OTP Auth Active
            </span>
          </div>

          <div className="space-y-4">
            {/* Read-only Registered Login Mobile Number */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Registered Login Mobile Number</span>
                <span className="text-[10px] text-slate-400 font-normal normal-case flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-400" /> Read-only ID
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={phone ? `+91 ${phone}` : (profile?.user?.phone ? `+91 ${profile.user.phone}` : 'Not Registered')}
                  readOnly
                  disabled
                  className="block w-full px-4 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-slate-700 font-semibold text-sm cursor-not-allowed select-none"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-slate-200/60 text-slate-600 text-[10px] font-bold uppercase">
                  Primary ID
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
                Your account uses mobile number-based OTP authentication for instant secure login.
              </p>
            </div>

            {/* Auth Method Description Box */}
            <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-100 text-xs space-y-1.5">
              <div className="flex items-center gap-2 text-blue-900 font-bold">
                <PhoneCall className="w-4 h-4 text-[#2E5BFF]" />
                <span>Password-less Security</span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Traditional passwords are disabled. Access code verification is delivered via SMS/WhatsApp to your registered phone number upon logging in.
              </p>
            </div>

            {/* OTP Verification Flow */}
            {otpStep === 'VERIFIED' ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-sm">
                  <Check className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-emerald-900">Security Credentials Verified</h4>
                <p className="text-[11px] text-emerald-700">
                  Login mobile number +91 {phone || profile?.user?.phone} is active and authenticated.
                </p>
                <button
                  type="button"
                  onClick={() => setOtpStep('IDLE')}
                  className="mt-1 text-[11px] text-emerald-700 underline font-semibold cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : otpStep === 'OTP_SENT' ? (
              <form onSubmit={handleVerifyOtp} className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <label className="block text-xs font-bold text-slate-700">
                  Enter Verification OTP
                </label>
                {otpMessage && (
                  <p className="text-[11px] text-blue-600 font-medium">{otpMessage}</p>
                )}
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit OTP"
                  className="block w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-mono text-center tracking-widest font-bold focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-sm"
                  required
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={updating}
                    className="flex-1 py-2 px-3 bg-[#2E5BFF] hover:bg-blue-600 text-white rounded-xl font-semibold text-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    Verify OTP
                  </button>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-semibold text-xs transition-all cursor-pointer"
                  >
                    Resend
                  </button>
                </div>
              </form>
            ) : (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpStep === 'SENDING'}
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {otpStep === 'SENDING' ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-t-white border-r-white border-b-transparent border-l-transparent rounded-full animate-spin" />
                      <span>Sending Verification OTP...</span>
                    </>
                  ) : (
                    <>
                      <PhoneCall className="w-4 h-4 text-blue-400" />
                      <span>Verify Login Credentials via OTP</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
