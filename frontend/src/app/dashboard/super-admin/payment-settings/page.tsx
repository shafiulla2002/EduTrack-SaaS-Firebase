'use client';

import React, { useState, useEffect } from 'react';

export default function PaymentSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState({
    companyName: 'EduTrack Inc.',
    companyLogoUrl: '',
    address: '',
    website: 'https://edutrack.com',
    supportEmail: 'support@edutrack.com',
    supportPhone: '+91 9876543210',
    gstNumber: '',
    panNumber: '',
    gstPercentage: 18.0,
    invoicePrefix: 'INV-SUB-',
    invoiceNumberFormat: 'INV-{YYYY}-{MM}-{NUMBER}',
    footer: 'Thank you for choosing EduTrack SaaS platform!',
    termsAndConditions: 'Payment due within 15 days of invoice date.',
    defaultCurrency: 'INR',
    timeZone: 'Asia/Kolkata',
    bankName: '',
    accountName: '',
    accountNumber: '',
    ifscCode: '',
    branchName: '',
    upiId: '',
  });

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch(`${backendUrl}/api/v1/platform/payment-settings`);
        if (res.ok) {
          const data = await res.json();
          setFormData((prev) => ({ ...prev, ...data }));
        }
      } catch (err) {
        console.error('Failed to load payment settings:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, [backendUrl]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(`${backendUrl}/api/v1/platform/payment-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setMessage('Payment Settings updated successfully!');
      } else {
        setMessage('Failed to save payment settings.');
      }
    } catch (err) {
      setMessage('Error updating settings: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-600">Loading Platform Payment Settings...</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Platform Payment & Invoice Settings</h1>
          <p className="text-sm text-slate-500">Configure company branding, GSTIN, invoice templates, and bank details for SaaS billing.</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 mb-6 rounded-lg text-sm font-medium ${message.includes('successfully') ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Company & Branding */}
        <section>
          <h2 className="text-lg font-semibold text-slate-700 mb-4 border-l-4 border-indigo-500 pl-3">Company & Branding Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Company Name</label>
              <input type="text" name="companyName" value={formData.companyName} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Company Logo URL</label>
              <input type="text" name="companyLogoUrl" value={formData.companyLogoUrl} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" placeholder="https://example.com/logo.png" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Support Email</label>
              <input type="email" name="supportEmail" value={formData.supportEmail} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Support Phone</label>
              <input type="text" name="supportPhone" value={formData.supportPhone} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Company Address</label>
              <textarea name="address" value={formData.address} onChange={handleChange} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </section>

        {/* Tax Information */}
        <section>
          <h2 className="text-lg font-semibold text-slate-700 mb-4 border-l-4 border-emerald-500 pl-3">Tax Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">GSTIN Number</label>
              <input type="text" name="gstNumber" value={formData.gstNumber} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" placeholder="29ABCDE1234F1Z5" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">PAN Number</label>
              <input type="text" name="panNumber" value={formData.panNumber} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" placeholder="ABCDE1234F" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">GST Percentage (%)</label>
              <input type="number" step="0.01" name="gstPercentage" value={formData.gstPercentage} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" required />
            </div>
          </div>
        </section>

        {/* Bank & UPI Details */}
        <section>
          <h2 className="text-lg font-semibold text-slate-700 mb-4 border-l-4 border-sky-500 pl-3">Bank & Settlement Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Bank Name</label>
              <input type="text" name="bankName" value={formData.bankName} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-sky-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Account Number</label>
              <input type="text" name="accountNumber" value={formData.accountNumber} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-sky-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">IFSC Code</label>
              <input type="text" name="ifscCode" value={formData.ifscCode} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-sky-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Branch Name</label>
              <input type="text" name="branchName" value={formData.branchName} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-sky-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">UPI VPA / QR ID</label>
              <input type="text" name="upiId" value={formData.upiId} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-sky-500" placeholder="edutrack@upi" />
            </div>
          </div>
        </section>

        {/* Submit */}
        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button type="submit" disabled={saving} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors disabled:opacity-50">
            {saving ? 'Saving Settings...' : 'Save Payment Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
