import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';

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
      if (!success) {
        setLoading(false);
      }
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Contact EduTrack Support"
      subtitle="Fill in details about your query. Our support team will get back to you shortly."
      size="xl"
    >
      <div className="space-y-4">
        {/* Error panel */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium rounded-xl leading-relaxed animate-pulse">
            {error}
          </div>
        )}

        {/* Success message panel */}
        {success && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-xl leading-relaxed text-center">
            Your query has been recorded. Reference ID generated.
            <br />
            Closing modal in a moment...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: Full Name & School Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Full Name <span className="text-[#2E5BFF]">*</span>
              </label>
              <input
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                placeholder="John Doe"
                disabled={loading || success}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-[#2E5BFF] disabled:opacity-40"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                School Name <span className="text-[#2E5BFF]">*</span>
              </label>
              <input
                name="schoolName"
                type="text"
                value={formData.schoolName}
                onChange={handleChange}
                placeholder="Oakridge High"
                disabled={loading || success}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-[#2E5BFF] disabled:opacity-40"
                required
              />
            </div>
          </div>

          {/* Row 2: Email Address & Phone Number */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Email Address <span className="text-[#2E5BFF]">*</span>
              </label>
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="email@example.com"
                disabled={loading || success}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-[#2E5BFF] disabled:opacity-40"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Mobile Number <span className="text-[#2E5BFF]">*</span>
              </label>
              <input
                name="phone"
                type="text"
                value={formData.phone}
                onChange={handleChange}
                placeholder="e.g. 9876543210 (digits only)"
                disabled={loading || success}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-[#2E5BFF] disabled:opacity-40"
                required
              />
            </div>
          </div>

          {/* Row 3: Subject */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Subject <span className="text-[#2E5BFF]">*</span>
            </label>
            <input
              name="subject"
              type="text"
              value={formData.subject}
              onChange={handleChange}
              placeholder="Billing queries, login issues, etc."
              disabled={loading || success}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-[#2E5BFF] disabled:opacity-40"
              required
            />
          </div>

          {/* Row 4: Message Textarea */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Message <span className="text-[#2E5BFF]">*</span>
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
              rows={4}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-[#2E5BFF] disabled:opacity-40 resize-none"
              required
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading || success}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition-all min-h-[42px] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="flex-1 py-2.5 rounded-xl bg-[#2E5BFF] hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold transition-all min-h-[42px] flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-500/10"
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
    </Modal>
  );
}

