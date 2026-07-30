import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';

interface ContactSupportModalProps {
  onClose: () => void;
}

export default function ContactSupportModal({ onClose }: ContactSupportModalProps) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    schoolName: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError('');

    // Client-side validations
    if (!formData.name.trim()) return setError('Full Name is required');
    if (!formData.schoolName.trim()) return setError('School Name is required');
    if (!formData.email.trim()) return setError('Email address is required');
    if (!formData.phone.trim()) return setError('Phone number is required');
    if (!formData.subject.trim()) return setError('Subject is required');
    if (!formData.message.trim()) return setError('Message is required');

    // Phone Format Validation (10 to 15 digits)
    if (!/^[0-9]{10,15}$/.test(formData.phone)) {
      setError('Phone number must be between 10 and 15 digits (numbers only)');
      return;
    }

    // Message Character limit (20 to 2000)
    if (formData.message.length < 20) {
      setError('Message must be at least 20 characters');
      return;
    }
    if (formData.message.length > 2000) {
      setError('Message cannot exceed 2000 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/support/contact', formData);
      const data = response.data;

      if (data.success) {
        setSuccess(true);
        // Show success notification depending on email status
        if (data.emailSent) {
          showToast(
            data.message || 'Your support request has been submitted successfully. Our support team will contact you shortly.',
            'success'
          );
        } else {
          showToast(
            data.message || 'Your request has been saved successfully. Our support team will review it shortly.',
            'warning'
          );
        }

        // Wait for 2.5 seconds before automatically closing the modal
        setTimeout(() => {
          onClose();
        }, 2500);
      } else {
        setError(data.message || 'Failed to submit support request');
      }
    } catch (err: any) {
      console.error('[ContactSupportModal] Submission error:', err);
      const errMsg = err.response?.data?.message || 'Failed to connect to support server. Please try again.';
      setError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      // Keep loading active if successful so controls remain disabled during redirect/closure delay
      if (!success) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] text-slate-100 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          disabled={loading}
          className="absolute top-4 right-4 text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition p-1.5 rounded-lg hover:bg-slate-800/50 z-10 cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Modal Title */}
        <div className="p-6 border-b border-slate-800 flex-shrink-0 bg-slate-900/40">
          <h2 className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
            Contact EduTrack Support
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-light">
            Please fill in details about your query. We will get back to you shortly.
          </p>
        </div>

        {/* Error panel */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium rounded-xl leading-relaxed animate-pulse">
            {error}
          </div>
        )}

        {/* Success message panel */}
        {success && (
          <div className="mx-6 mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-xl leading-relaxed text-center">
            Your query has been recorded. Reference ID generated.
            <br />
            Closing modal in a moment...
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            
            {/* Row 1: Full Name & School Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Full Name <span className="text-brand-500">*</span>
                </label>
                <input
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  disabled={loading || success}
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none transition-all placeholder:text-slate-600 disabled:opacity-40"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  School Name <span className="text-brand-500">*</span>
                </label>
                <input
                  name="schoolName"
                  type="text"
                  value={formData.schoolName}
                  onChange={handleChange}
                  placeholder="Oakridge High"
                  disabled={loading || success}
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none transition-all placeholder:text-slate-600 disabled:opacity-40"
                  required
                />
              </div>
            </div>

            {/* Row 2: Email Address & Phone Number */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Email Address <span className="text-brand-500">*</span>
                </label>
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="email@example.com"
                  disabled={loading || success}
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none transition-all placeholder:text-slate-600 disabled:opacity-40"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Mobile Number <span className="text-brand-500">*</span>
                </label>
                <input
                  name="phone"
                  type="text"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="e.g. 9876543210 (digits only)"
                  disabled={loading || success}
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none transition-all placeholder:text-slate-600 disabled:opacity-40"
                  required
                />
              </div>
            </div>

            {/* Row 3: Subject */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Subject <span className="text-brand-500">*</span>
              </label>
              <input
                name="subject"
                type="text"
                value={formData.subject}
                onChange={handleChange}
                placeholder="Billing queries, login issues, etc."
                disabled={loading || success}
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none transition-all placeholder:text-slate-600 disabled:opacity-40"
                required
              />
            </div>

            {/* Row 4: Message Textarea */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Message <span className="text-brand-500">*</span>
                </label>
                <span className={`text-[10px] font-medium ${formData.message.length < 20 || formData.message.length > 2000 ? 'text-red-400' : 'text-slate-500'}`}>
                  {formData.message.length} / 2000 (Min 20)
                </span>
              </div>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                placeholder="Write your issue detail here... (min 20 characters)"
                disabled={loading || success}
                rows={5}
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none transition-all placeholder:text-slate-600 disabled:opacity-40 resize-none"
                required
              />
            </div>

          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 p-6 border-t border-slate-800 bg-slate-900/60 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading || success}
              className="flex-1 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-800/40 text-xs font-bold transition-all min-h-[42px] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-bold transition-all min-h-[42px] flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-brand-500/10 hover:shadow-brand-500/20"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Sending...
                </>
              ) : (
                'Send Support Request'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
