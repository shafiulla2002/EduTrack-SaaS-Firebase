'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { dispatchSchoolSetupUpdated } from '@/lib/events';
import { resizeAndCompressImage } from '@/lib/image';
import { useToast } from '@/components/Toast';
import { 
  Building2, Landmark, CheckCircle, Save, QrCode, 
  Plus, Trash2, Calendar, ShieldAlert, Globe, Link as LinkIcon,
  CreditCard, Eye, EyeOff, ShieldCheck, AlertCircle, KeyRound, Lock
} from 'lucide-react';

interface BankAccount {
  id: string;
  name: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
  isPrimary: boolean;
}

interface AcademicTerm {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

function SettingsPageContent() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'profile' | 'banking' | 'upi' | 'terms'>('profile');

  useEffect(() => {
    if (tabParam === 'school-profile') {
      setActiveTab('profile');
    }
  }, [tabParam]);

  // 1. School Profile Metadata
  const [schoolName, setSchoolName] = useState('');
  const [schoolSubtitle, setSchoolSubtitle] = useState('');
  const [schoolEmail, setSchoolEmail] = useState('');
  const [schoolPhone, setSchoolPhone] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [schoolLogo, setSchoolLogo] = useState('');
  const [userAvatar, setUserAvatar] = useState('');
  const [subdomain, setSubdomain] = useState('');

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [setupData, setSetupData] = useState<any>(null);

  // 2. UPI Gateway Keys
  const [gpayId, setGpayId] = useState('');
  const [phonepeId, setPhonepeId] = useState('');
  const [upiQrId, setUpiQrId] = useState('');

  // 2b. Razorpay Gateway State
  const [razorpayEnabled, setRazorpayEnabled] = useState(false);
  const [razorpayIsTestMode, setRazorpayIsTestMode] = useState(true);
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [razorpayKeySecret, setRazorpayKeySecret] = useState('');
  const [razorpayWebhookSecret, setRazorpayWebhookSecret] = useState('');
  const [hasRazorpayKeySecret, setHasRazorpayKeySecret] = useState(false);
  const [hasRazorpayWebhookSecret, setHasRazorpayWebhookSecret] = useState(false);
  const [showKeySecret, setShowKeySecret] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [savingRazorpay, setSavingRazorpay] = useState(false);

  // 3. Bank Accounts List
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  // 4. Academic Years List
  const [academicYears, setAcademicYears] = useState<AcademicTerm[]>([]);

  // Form helper for adding a new bank account
  const [newBank, setNewBank] = useState({
    name: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    branch: '',
    isPrimary: false
  });

  // Form helper for adding a new academic year
  const [newYearRange, setNewYearRange] = useState('');

  const loadAcademicYears = async () => {
    try {
      const response = await api.get('/academics/academic-years');
      const data = response.data;
      const mapped = data.map((ay: any) => ({
        id: ay.id,
        name: ay.name,
        startDate: ay.startDate ? new Date(ay.startDate).toISOString().split('T')[0] : '',
        endDate: ay.endDate ? new Date(ay.endDate).toISOString().split('T')[0] : '',
        isActive: ay.isActive,
      }));
      setAcademicYears(mapped);
    } catch (err) {
      console.error('Error loading academic years:', err);
    }
  };

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await api.get('/tenant/setup-status');
        const data = response.data;
        setSetupData(data);
        if (data.setup) {
          setSchoolName(data.setup.schoolName || '');
          setSchoolSubtitle(data.setup.schoolType || '');
          setSchoolEmail(data.setup.email || '');
          setSchoolPhone(data.setup.mobileNumber || '');
          setSchoolAddress(data.setup.address || '');
          setSchoolLogo(data.setup.schoolLogo || '');
          if (data.currentUser) {
            setUserAvatar(data.currentUser.avatarUrl || '');
          }
          if (data.setup.tenant) {
            setSubdomain(data.setup.tenant.subDomain || '');
            setGpayId(data.setup.tenant.googlePayId || '');
            setPhonepeId(data.setup.tenant.phonePeId || '');
            setUpiQrId(data.setup.tenant.upiQrId || '');

            // Razorpay gateway setup
            setRazorpayEnabled(!!data.setup.tenant.razorpayEnabled);
            setRazorpayIsTestMode(data.setup.tenant.razorpayIsTestMode ?? true);
            setRazorpayKeyId(data.setup.tenant.razorpayKeyId || '');
            setHasRazorpayKeySecret(!!data.setup.tenant.hasRazorpayKeySecret);
            setHasRazorpayWebhookSecret(!!data.setup.tenant.hasRazorpayWebhookSecret);
            
            if (data.setup.tenant.bankAccountNo) {
              setBankAccounts([
                {
                  id: 'primary-bank',
                  name: data.setup.tenant.bankName || 'School Trust Account',
                  bankName: data.setup.tenant.bankName || '',
                  accountNumber: data.setup.tenant.bankAccountNo || '',
                  ifscCode: data.setup.tenant.bankIFSC || '',
                  branch: data.setup.tenant.bankBranch || '',
                  isPrimary: true
                }
              ]);
            } else {
              setBankAccounts([]);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching settings school profile:', err);
      } finally {
        setLoadingProfile(false);
      }
    };
    
    loadProfile();
    loadAcademicYears();
  }, []);

  // Handle Save
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (activeTab === 'profile') {
        const payload = {
          schoolName,
          schoolType: schoolSubtitle,
          email: schoolEmail,
          address: schoolAddress,
          schoolLogo,
          mobileNumber: schoolPhone,
          adminAvatarUrl: userAvatar,
          subdomain,
        };

        await api.put('/school-setup', payload);
        showToast('School Setup org defaults successfully updated.', 'success');
      } else if (activeTab === 'upi') {
        const primaryBank = bankAccounts[0];
        await api.put('/tenant/banking-upi', {
          bankName: primaryBank?.bankName || null,
          bankAccountNo: primaryBank?.accountNumber || null,
          bankIFSC: primaryBank?.ifscCode || null,
          bankBranch: primaryBank?.branch || null,
          googlePayId: gpayId,
          phonePeId: phonepeId,
          upiQrId: upiQrId,
        });
        showToast('UPI payment gateway keys updated.', 'success');
      }

      // Dispatch event to refresh branding instantly
      dispatchSchoolSetupUpdated();
    } catch (err: any) {
      console.error('Error saving settings profile:', err);
      showToast('Failed to save configuration settings: ' + (err.response?.data?.message || err.message), 'error');
    }
  };

  // Handle Razorpay Config Save
  const handleSaveRazorpayConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (razorpayEnabled) {
      if (!razorpayKeyId.trim()) {
        showToast('Razorpay Key ID is required when Razorpay is enabled.', 'error');
        return;
      }
      if (!hasRazorpayKeySecret && !razorpayKeySecret.trim()) {
        showToast('Razorpay Key Secret is required when Razorpay is enabled.', 'error');
        return;
      }
      if (razorpayIsTestMode && !razorpayKeyId.startsWith('rzp_test_')) {
        showToast('Warning: Test Mode Key ID should start with "rzp_test_".', 'error');
      }
      if (!razorpayIsTestMode && !razorpayKeyId.startsWith('rzp_live_')) {
        showToast('Warning: Live Mode Key ID must start with "rzp_live_".', 'error');
      }
    }

    setSavingRazorpay(true);
    try {
      const payload: any = {
        enabled: razorpayEnabled,
        isTestMode: razorpayIsTestMode,
        keyId: razorpayKeyId.trim(),
      };
      if (razorpayKeySecret.trim()) {
        payload.keySecret = razorpayKeySecret.trim();
      }
      if (razorpayWebhookSecret.trim()) {
        payload.webhookSecret = razorpayWebhookSecret.trim();
      }

      let res;
      try {
        res = await api.put('/tenant/razorpay-config', payload);
      } catch (putErr: any) {
        const isRouteMissing = putErr.response?.status === 404 || putErr.response?.status === 405 || !putErr.response || String(putErr.message || '').includes('404') || String(putErr.response?.data || '').includes('Cannot PUT');
        if (isRouteMissing) {
          // Resilient fallback to banking-upi endpoint if razorpay-config route has serverless propagation delay
          res = await api.put('/tenant/banking-upi', {
            razorpayEnabled: payload.enabled,
            razorpayIsTestMode: payload.isTestMode,
            razorpayKeyId: payload.keyId,
            razorpayKeySecret: payload.keySecret,
            razorpayWebhookSecret: payload.webhookSecret,
          });
        } else {
          throw putErr;
        }
      }

      if (res.data?.hasKeySecret || payload.keySecret) setHasRazorpayKeySecret(true);
      if (res.data?.hasWebhookSecret || payload.webhookSecret) setHasRazorpayWebhookSecret(true);
      setRazorpayKeySecret('');
      setRazorpayWebhookSecret('');
      showToast(res.data?.message || 'Razorpay gateway settings saved successfully.', 'success');
      dispatchSchoolSetupUpdated();
    } catch (err: any) {
      console.error('Error saving Razorpay settings:', err);
      showToast(err.response?.data?.message || 'Failed to save Razorpay configuration.', 'error');
    } finally {
      setSavingRazorpay(false);
    }
  };

  // Add Bank Account Row
  const handleAddBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBank.bankName || !newBank.accountNumber || !newBank.ifscCode) {
      alert('Please fill out all required bank fields.');
      return;
    }

    try {
      await api.put('/tenant/banking-upi', {
        bankName: newBank.bankName,
        bankAccountNo: newBank.accountNumber,
        bankIFSC: newBank.ifscCode,
        bankBranch: newBank.branch,
        googlePayId: gpayId,
        phonePeId: phonepeId,
        upiQrId: upiQrId,
      });

      setBankAccounts([
        {
          id: 'primary-bank',
          name: newBank.bankName,
          bankName: newBank.bankName,
          accountNumber: newBank.accountNumber,
          ifscCode: newBank.ifscCode,
          branch: newBank.branch,
          isPrimary: true
        }
      ]);

      setNewBank({
        name: '',
        bankName: '',
        accountNumber: '',
        ifscCode: '',
        branch: '',
        isPrimary: false
      });

      showToast('Merchant bank account configuration updated.', 'success');
    } catch (err: any) {
      console.error('Error adding bank account:', err);
      showToast('Failed to save bank account: ' + (err.response?.data?.message || err.message), 'error');
    }
  };

  // Delete Bank Account Row
  const handleDeleteBankAccount = async (id: string) => {
    try {
      await api.put('/tenant/banking-upi', {
        bankName: null,
        bankAccountNo: null,
        bankIFSC: null,
        bankBranch: null,
        googlePayId: gpayId,
        phonePeId: phonepeId,
        upiQrId: upiQrId,
      });

      setBankAccounts([]);
      showToast('Merchant bank account configuration cleared.', 'success');
    } catch (err: any) {
      console.error('Error clearing bank account:', err);
      showToast('Failed to clear bank account: ' + (err.response?.data?.message || err.message), 'error');
    }
  };

  // Toggle Primary Bank Account
  const handleSetPrimaryBank = (id: string) => {};

  // Add Academic Year
  const handleAddAcademicYear = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRange = newYearRange.replace('–', '-').trim();
    const years = cleanRange.split('-');
    if (years.length !== 2 || isNaN(Number(years[0])) || isNaN(Number(years[1]))) {
      alert('Invalid year range format. Please use YYYY-YYYY (e.g. 2027-2028).');
      return;
    }

    const startYear = Number(years[0]);
    const endYear = Number(years[1]);

    try {
      await api.post('/academics/academic-years', {
        name: cleanRange,
        startDate: `${startYear}-06-01T00:00:00.000Z`,
        endDate: `${endYear}-05-31T23:59:59.000Z`,
        isActive: false
      });

      setNewYearRange('');
      await loadAcademicYears();

      showToast(`Academic year term ${cleanRange} successfully configured.`, 'success');
    } catch (err: any) {
      console.error('Error adding academic year:', err);
      showToast('Failed to add academic year: ' + (err.response?.data?.message || err.message), 'error');
    }
  };

  // Toggle Active Academic Year
  const handleToggleActiveYear = async (id: string) => {
    try {
      await api.patch(`/academics/academic-years/${id}/toggle`);
      await loadAcademicYears();
      
      showToast('Academic year active status updated.', 'success');
    } catch (err: any) {
      console.error('Error toggling academic year status:', err);
      showToast('Failed to update academic year active status: ' + (err.response?.data?.message || err.message), 'error');
    }
  };

  return (
    <div className="space-y-8 animate-in">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-[28px] font-bold text-slate-950 leading-none">
            School Setup & Settings
          </h1>
          <p className="text-slate-500 text-[13px] font-medium mt-2">
            Replicates `schoolSetup` LWC. Configure school profiles metadata, active terms, bank account indices, and UPI payments gateways.
          </p>
        </div>
      </div>



      {/* Tabs Layout */}
      <div className="overflow-x-auto w-full scrollbar-none border-b border-slate-200">
        <div className="flex gap-6 min-w-max pb-px">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-3 pt-2 min-h-[44px] text-[14px] font-bold border-b-2 transition-all cursor-pointer flex items-center ${
              activeTab === 'profile'
                ? 'border-[#2E5BFF] text-[#2E5BFF]'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <span className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              School Profile
            </span>
          </button>

          <button
            onClick={() => setActiveTab('banking')}
            className={`pb-3 pt-2 min-h-[44px] text-[14px] font-bold border-b-2 transition-all cursor-pointer flex items-center ${
              activeTab === 'banking'
                ? 'border-[#2E5BFF] text-[#2E5BFF]'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <span className="flex items-center gap-2">
              <Landmark className="w-4 h-4" />
              Bank Registry
            </span>
          </button>

          <button
            onClick={() => setActiveTab('upi')}
            className={`pb-3 pt-2 min-h-[44px] text-[14px] font-bold border-b-2 transition-all cursor-pointer flex items-center ${
              activeTab === 'upi'
                ? 'border-[#2E5BFF] text-[#2E5BFF]'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <span className="flex items-center gap-2">
              <QrCode className="w-4 h-4" />
              UPI Gateways
            </span>
          </button>

          <button
            onClick={() => setActiveTab('terms')}
            className={`pb-3 pt-2 min-h-[44px] text-[14px] font-bold border-b-2 transition-all cursor-pointer flex items-center ${
              activeTab === 'terms'
                ? 'border-[#2E5BFF] text-[#2E5BFF]'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Academic Terms
            </span>
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Side forms depending on tab */}
        <div className="lg:col-span-2 space-y-6">
          {/* TAB 1: PROFILE SETUP */}
          {activeTab === 'profile' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
              <h3 className="text-[16px] font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#2E5BFF]" />
                Organization Branding & Details
              </h3>

              <form onSubmit={handleSaveSettings} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] text-slate-500 font-semibold mb-1">Organization Name *</label>
                  <input
                    type="text"
                    required
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-[44px] text-[13px] text-slate-800 focus:outline-none focus:border-[#2E5BFF]"
                  />
                </div>

                <div>
                  <label className="block text-[12px] text-slate-500 font-semibold mb-1">School Subtitle / Motto</label>
                  <input
                    type="text"
                    value={schoolSubtitle}
                    onChange={(e) => setSchoolSubtitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-[44px] text-[13px] text-slate-800 focus:outline-none focus:border-[#2E5BFF]"
                  />
                </div>

                <div>
                  <label className="block text-[12px] text-slate-500 font-semibold mb-1">Tenant Subdomain *</label>
                  <div className="flex h-[44px]">
                    <input
                      type="text"
                      required
                      value={subdomain}
                      onChange={(e) => setSubdomain(e.target.value)}
                      className="bg-slate-50 border border-slate-200 border-r-0 rounded-l-xl px-4 h-full text-[13px] text-slate-800 focus:outline-none focus:border-[#2E5BFF] w-1/2"
                    />
                    <span className="bg-slate-100 border border-slate-200 border-l-0 rounded-r-xl px-4 h-full text-[13px] text-slate-400 w-1/2 select-none truncate flex items-center justify-center">
                      .edutrack.covenantsynergy.in
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] text-slate-500 font-semibold mb-1">Contact Email *</label>
                  <input
                    type="email"
                    required
                    value={schoolEmail}
                    onChange={(e) => setSchoolEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-[44px] text-[13px] text-slate-800 focus:outline-none focus:border-[#2E5BFF]"
                  />
                </div>

                <div>
                  <label className="block text-[12px] text-slate-500 font-semibold mb-1">Help Desk Phone</label>
                  <input
                    type="text"
                    value={schoolPhone}
                    onChange={(e) => setSchoolPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-[44px] text-[13px] text-slate-800 focus:outline-none"
                  />
                </div>

                {/* School Logo Upload */}
                <div className="sm:col-span-2">
                  <label className="block text-[12px] text-slate-500 font-semibold mb-1">School Logo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const result = await resizeAndCompressImage(file);
                        setSchoolLogo(result);
                      } catch (err) {
                        console.error('Error compressing logo:', err);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-[44px] text-[13px] text-slate-800 focus:outline-none"
                  />
                  {schoolLogo && (
                    <div className="mt-2 flex justify-center">
                      <img
                        src={schoolLogo}
                        alt="School Logo Preview"
                        className="w-24 h-24 rounded-2xl object-cover border border-slate-200 shadow-sm"
                      />
                    </div>
                  )}
                </div>

                {/* Admin Profile Photo Upload */}
                <div className="sm:col-span-2">
                  <label className="block text-[12px] text-slate-500 font-semibold mb-1">Admin Profile Photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const result = await resizeAndCompressImage(file);
                        setUserAvatar(result);
                      } catch (err) {
                        console.error('Error compressing admin avatar:', err);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-[44px] text-[13px] text-slate-800 focus:outline-none"
                  />
                  {userAvatar && (
                    <div className="mt-2 flex justify-center">
                      <img
                        src={userAvatar}
                        alt="Admin Profile Preview"
                        className="w-24 h-24 rounded-2xl object-cover border border-slate-200 shadow-sm"
                      />
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[12px] text-slate-500 font-semibold mb-1">Mailing Address</label>
                  <textarea
                    rows={2}
                    value={schoolAddress}
                    onChange={(e) => setSchoolAddress(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[13px] text-slate-800 focus:outline-none focus:border-[#2E5BFF] resize-none"
                  />
                </div>

                <div className="sm:col-span-2 pt-4">
                  <button
                    type="submit"
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#2E5BFF] hover:bg-blue-600 text-white text-[13px] font-semibold flex items-center gap-2 cursor-pointer shadow-md shadow-blue-500/10"
                  >
                    <Save className="w-4 h-4" />
                    Save Organization Branding
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: BANKING REGISTRY */}
          {activeTab === 'banking' && (
            <div className="space-y-6">
              {/* Add Bank Account row form */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <h3 className="text-[16px] font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-[#2E5BFF]" />
                  Add School Bank Account
                </h3>

                <form onSubmit={handleAddBankAccount} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[12px] text-slate-500 font-semibold mb-1">Account Display Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Trust Account"
                      value={newBank.name}
                      onChange={(e) => setNewBank({ ...newBank, name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-[44px] text-[13px] text-slate-800 focus:outline-none focus:border-[#2E5BFF]"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] text-slate-500 font-semibold mb-1">Bank Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. State Bank of India"
                      value={newBank.bankName}
                      onChange={(e) => setNewBank({ ...newBank, bankName: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-[44px] text-[13px] text-slate-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] text-slate-500 font-semibold mb-1">Account Number *</label>
                    <input
                      type="text"
                      placeholder="Enter numbers only"
                      value={newBank.accountNumber}
                      onChange={(e) => setNewBank({ ...newBank, accountNumber: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-[44px] text-[13px] text-slate-800 font-mono focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] text-slate-500 font-semibold mb-1">IFSC Routing Code *</label>
                    <input
                      type="text"
                      placeholder="e.g. SBIN0001234"
                      value={newBank.ifscCode}
                      onChange={(e) => setNewBank({ ...newBank, ifscCode: e.target.value.toUpperCase() })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-[44px] text-[13px] text-slate-800 font-mono focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] text-slate-500 font-semibold mb-1">Branch Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Rohini Sec 9"
                      value={newBank.branch}
                      onChange={(e) => setNewBank({ ...newBank, branch: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-[44px] text-[13px] text-slate-800 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      id="isPrimaryAcc"
                      checked={newBank.isPrimary}
                      onChange={(e) => setNewBank({ ...newBank, isPrimary: e.target.checked })}
                      className="rounded border-slate-300 text-[#2E5BFF] focus:ring-[#2E5BFF] w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="isPrimaryAcc" className="text-[13px] text-slate-600 font-semibold select-none cursor-pointer">
                      Mark Primary Account
                    </label>
                  </div>

                  <div className="sm:col-span-2 md:col-span-3 pt-2">
                    <button
                      type="submit"
                      className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#2E5BFF] hover:bg-blue-600 text-white text-[13px] font-semibold flex items-center gap-2 cursor-pointer shadow-md shadow-blue-500/10"
                    >
                      <Plus className="w-4 h-4" />
                      Add Bank Account Row
                    </button>
                  </div>
                </form>
              </div>

              {/* Bank accounts ledger list */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <h4 className="text-[14px] font-bold text-slate-900">Active Merchant Bank Accounts</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/35 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="px-6 py-3">Account Name</th>
                        <th className="px-6 py-3">Bank details</th>
                        <th className="px-6 py-3">Account Number</th>
                        <th className="px-6 py-3">IFSC Code</th>
                        <th className="px-6 py-3 text-center">Primary</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bankAccounts.map(b => (
                        <tr key={b.id} className="hover:bg-slate-50/50 text-[13px] text-slate-700">
                          <td className="px-6 py-4 font-semibold text-slate-900">{b.name}</td>
                          <td className="px-6 py-4">
                            <div>{b.bankName}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{b.branch || 'Main Branch'}</div>
                          </td>
                          <td className="px-6 py-4 font-mono font-medium text-slate-800">{b.accountNumber}</td>
                          <td className="px-6 py-4 font-mono text-slate-500">{b.ifscCode}</td>
                          <td className="px-6 py-4 text-center">
                            <input
                              type="radio"
                              name="primaryBankSel"
                              checked={b.isPrimary}
                              onChange={() => handleSetPrimaryBank(b.id)}
                              className="w-4 h-4 text-[#2E5BFF] focus:ring-[#2E5BFF] cursor-pointer"
                            />
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteBankAccount(b.id)}
                              className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="Delete Row"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: UPI & ONLINE GATEWAYS */}
          {activeTab === 'upi' && (
            <div className="space-y-6">
              {/* Existing UPI Gateways Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
                <h3 className="text-[16px] font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-[#2E5BFF]" />
                  UPI Integration Gateways
                </h3>

                <form onSubmit={handleSaveSettings} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[12px] text-slate-500 font-semibold mb-1">GooglePay Business UPI ID</label>
                      <input
                        type="text"
                        value={gpayId}
                        onChange={(e) => setGpayId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-[44px] text-[13px] text-slate-800 font-mono focus:outline-none focus:border-[#2E5BFF]"
                      />
                    </div>

                    <div>
                      <label className="block text-[12px] text-slate-500 font-semibold mb-1">PhonePe Merchant UPI ID</label>
                      <input
                        type="text"
                        value={phonepeId}
                        onChange={(e) => setPhonepeId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-[44px] text-[13px] text-slate-800 font-mono focus:outline-none focus:border-[#2E5BFF]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] text-slate-500 font-semibold mb-1">UPI Merchant Standee QR Payload ID</label>
                    <input
                      type="text"
                      value={upiQrId}
                      onChange={(e) => setUpiQrId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-[44px] text-[13px] text-slate-800 font-mono focus:outline-none focus:border-[#2E5BFF]"
                    />
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">
                      Used to generate customized UPI dynamic QR standees on the student fee billing pages.
                    </p>
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#2E5BFF] hover:bg-blue-600 text-white text-[13px] font-semibold flex items-center gap-2 cursor-pointer shadow-md shadow-blue-500/10"
                    >
                      <Save className="w-4 h-4" />
                      Save UPI Integration Keys
                    </button>
                  </div>
                </form>
              </div>

              {/* Razorpay Online Payment Gateway Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                  <h3 className="text-[16px] font-bold text-slate-900 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-[#2E5BFF]" />
                    Razorpay Online Payment Gateway
                  </h3>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    {!razorpayEnabled ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        Disabled
                      </span>
                    ) : !razorpayKeyId ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                        Incomplete Setup
                      </span>
                    ) : razorpayIsTestMode ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        Connected (Test Sandbox Mode)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Active (Live Production Mode)
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-[12px] text-slate-500 -mt-2 leading-relaxed">
                  Configure school-specific Razorpay merchant credentials to accept student fee payments online directly to your school's bank account via Credit/Debit Cards, UPI, Net Banking, and Wallets.
                </p>

                <form onSubmit={handleSaveRazorpayConfig} className="space-y-5">
                  {/* Toggle: Enable / Disable & Environment */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50/70 border border-slate-200/80">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[13px] font-bold text-slate-800">Enable Razorpay Integration</div>
                        <div className="text-[11px] text-slate-500">Allow parents & admins to pay via Razorpay</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={razorpayEnabled}
                          onChange={(e) => setRazorpayEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2E5BFF]" />
                      </label>
                    </div>

                    <div className="flex items-center justify-between border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-4">
                      <div>
                        <div className="text-[13px] font-bold text-slate-800">Gateway Environment</div>
                        <div className="text-[11px] text-slate-500">
                          {razorpayIsTestMode ? 'Test mode uses dummy cards & accounts' : 'Live mode processes real payments'}
                        </div>
                      </div>
                      <div className="inline-flex rounded-lg p-0.5 bg-slate-200/80 text-[11px] font-bold">
                        <button
                          type="button"
                          onClick={() => setRazorpayIsTestMode(true)}
                          className={`px-3 py-1.5 rounded-md transition-all ${
                            razorpayIsTestMode ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Test Mode
                        </button>
                        <button
                          type="button"
                          onClick={() => setRazorpayIsTestMode(false)}
                          className={`px-3 py-1.5 rounded-md transition-all ${
                            !razorpayIsTestMode ? 'bg-[#2E5BFF] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Live Mode
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Key ID and Key Secret */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[12px] text-slate-600 font-semibold mb-1">
                        Razorpay Key ID {razorpayEnabled && <span className="text-rose-500">*</span>}
                      </label>
                      <input
                        type="text"
                        placeholder={razorpayIsTestMode ? "rzp_test_..." : "rzp_live_..."}
                        value={razorpayKeyId}
                        onChange={(e) => setRazorpayKeyId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-[44px] text-[13px] text-slate-800 font-mono focus:outline-none focus:border-[#2E5BFF]"
                      />
                      <p className="text-[10px] text-slate-400 font-medium mt-1">
                        Find in Razorpay Dashboard → Settings → API Keys ({razorpayIsTestMode ? 'Prefix: rzp_test_' : 'Prefix: rzp_live_'})
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[12px] text-slate-600 font-semibold">
                          Razorpay Key Secret {razorpayEnabled && !hasRazorpayKeySecret && <span className="text-rose-500">*</span>}
                        </label>
                        {hasRazorpayKeySecret && (
                          <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Saved & Encrypted
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type={showKeySecret ? "text" : "password"}
                          placeholder={hasRazorpayKeySecret ? "•••••••••••••••• (Leave blank to keep existing)" : "Enter Key Secret"}
                          value={razorpayKeySecret}
                          onChange={(e) => setRazorpayKeySecret(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-10 h-[44px] text-[13px] text-slate-800 font-mono focus:outline-none focus:border-[#2E5BFF]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKeySecret(!showKeySecret)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showKeySecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium mt-1">
                        Stored encrypted at rest with AES-256-GCM. Never exposed in responses.
                      </p>
                    </div>
                  </div>

                  {/* Webhook Secret */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[12px] text-slate-600 font-semibold">
                        Razorpay Webhook Secret <span className="text-slate-400 font-normal">(Optional for Webhook Signature Verification)</span>
                      </label>
                      {hasRazorpayWebhookSecret && (
                        <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> Configured
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showWebhookSecret ? "text" : "password"}
                        placeholder={hasRazorpayWebhookSecret ? "•••••••••••••••• (Leave blank to keep existing)" : "Enter Webhook Secret configured in Razorpay Dashboard"}
                        value={razorpayWebhookSecret}
                        onChange={(e) => setRazorpayWebhookSecret(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-10 h-[44px] text-[13px] text-slate-800 font-mono focus:outline-none focus:border-[#2E5BFF]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showWebhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium mt-1">
                      Webhook URL: <span className="font-mono text-slate-600">{typeof window !== 'undefined' ? `${window.location.origin}/api/billing/public/razorpay/webhook` : '/api/billing/public/razorpay/webhook'}</span> (Events: payment.captured, order.paid)
                    </p>
                  </div>

                  {/* Security Notice */}
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 text-[11px] text-blue-900 leading-relaxed">
                    <ShieldCheck className="w-4 h-4 text-[#2E5BFF] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Multi-Tenant Credential Isolation:</span> These credentials are stored encrypted at rest using server-side AES-256-GCM. Payments collected for this school are routed exclusively through this Razorpay merchant account and are strictly isolated from platform subscriptions and other schools.
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={savingRazorpay}
                      className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#2E5BFF] hover:bg-blue-600 text-white text-[13px] font-semibold flex items-center gap-2 cursor-pointer shadow-md shadow-blue-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Save className="w-4 h-4" />
                      {savingRazorpay ? 'Saving Configuration...' : 'Save Razorpay Gateway Configuration'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 4: ACADEMIC TERMS */}
          {activeTab === 'terms' && (
            <div className="space-y-6">
              {/* Add Academic Year form */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <h3 className="text-[16px] font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#2E5BFF]" />
                  Configure Academic Year Term
                </h3>

                <form onSubmit={handleAddAcademicYear} className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-[12px] text-slate-500 font-semibold mb-1">Academic Year Range *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 2027-2028"
                      value={newYearRange}
                      onChange={(e) => setNewYearRange(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-[44px] text-[13px] text-slate-800 focus:outline-none focus:border-[#2E5BFF]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#2E5BFF] hover:bg-blue-600 text-white text-[13px] font-semibold min-h-[44px] flex items-center gap-2 cursor-pointer shadow-md shadow-blue-500/10"
                  >
                    <Plus className="w-4 h-4" />
                    Configure Year
                  </button>
                </form>
                <p className="text-[10px] text-slate-400 font-semibold">
                  Note: Custom settings June 1st to May 31st boundaries will be automatically constructed for terms boundaries.
                </p>
              </div>

              {/* Academic Terms table */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <h4 className="text-[14px] font-bold text-slate-900">Academic Year Calendars</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/35 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="px-6 py-3">Academic Term</th>
                        <th className="px-6 py-3">Term Start Date</th>
                        <th className="px-6 py-3">Term End Date</th>
                        <th className="px-6 py-3 text-center">Status</th>
                        <th className="px-6 py-3 text-center">Active Toggle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {academicYears.map(ay => (
                        <tr key={ay.id} className="hover:bg-slate-50/50 text-[13px] text-slate-700">
                          <td className="px-6 py-4 font-bold text-slate-900">{ay.name}</td>
                          <td className="px-6 py-4 font-mono text-slate-600">{ay.startDate}</td>
                          <td className="px-6 py-4 font-mono text-slate-600">{ay.endDate}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              ay.isActive 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                : 'bg-slate-100 text-slate-400'
                            }`}>
                              {ay.isActive ? 'Active Term' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleActiveYear(ay.id)}
                              className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                                ay.isActive
                                  ? 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100'
                                  : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'
                              }`}
                            >
                              {ay.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar Widget */}
        <div className="space-y-6">
          {/* Logo Brand Box */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs text-center space-y-4">
            <h4 className="text-[14px] font-bold text-slate-900 border-b border-slate-100 pb-2">Branding Preview</h4>
            <div className="flex justify-center">
              {schoolLogo ? (
                <img 
                  src={schoolLogo} 
                  alt="School Logo" 
                  className="w-24 h-24 rounded-2xl object-cover border border-slate-200 shadow-sm"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&q=80&w=200';
                  }}
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-300">
                  No Logo
                </div>
              )}
            </div>
            <div>
              <h5 className="font-extrabold text-[15px] text-slate-900">{schoolName}</h5>
              <p className="text-[11px] text-slate-400 mt-1 italic">"{schoolSubtitle}"</p>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-left text-[11px] space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Subdomain:</span>
                <span className="text-slate-700 font-semibold">{subdomain}.edutrack.covenantsynergy.in</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Primary Bank:</span>
                <span className="text-slate-700 font-semibold">
                  {bankAccounts.find(b => b.isPrimary)?.bankName || 'None'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Active Term:</span>
                <span className="text-slate-700 font-semibold">
                  {academicYears.find(ay => ay.isActive)?.name || 'None'}
                </span>
              </div>
            </div>
          </div>

          {/* Salesforce Org Default Alert info */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
            <h4 className="text-[12px] font-bold text-slate-700 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
              Developer System Settings
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              These properties represent tenant configuration flags and map to Custom Settings hierarchy fields in the backplane database. Change modifications propagate dynamically across all modules.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <React.Suspense fallback={
      <div className="p-8 text-center text-slate-500 font-medium">
        Loading settings...
      </div>
    }>
      <SettingsPageContent />
    </React.Suspense>
  );
}
