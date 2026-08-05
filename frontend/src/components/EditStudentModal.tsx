import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { updateStudent } from '@/lib/api';
import PhotoUpload from './PhotoUpload';
import Modal from '@/components/Modal';

interface EditStudentModalProps {
  student: {
    id: string;
    rollNo: string;
    name: string;
    email: string;
    phone: string;
    class: string;
    section: string;
    fatherName: string;
    motherName: string;
    aadharNo: string;
    profilePhotoUrl?: string | null;
  };
  onClose: () => void;
  onSave: () => void;
}

export default function EditStudentModal({ student, onClose, onSave }: EditStudentModalProps) {
  const [formData, setFormData] = useState({
    rollNo: student.rollNo || '',
    name: student.name || '',
    email: student.email || '',
    phone: student.phone || '',
    fatherName: student.fatherName || '',
    motherName: student.motherName || '',
    aadharNo: student.aadharNo || '',
    profilePhotoUrl: student.profilePhotoUrl || null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setFormData({
      rollNo: student.rollNo || '',
      name: student.name || '',
      email: student.email || '',
      phone: student.phone || '',
      fatherName: student.fatherName || '',
      motherName: student.motherName || '',
      aadharNo: student.aadharNo || '',
      profilePhotoUrl: student.profilePhotoUrl || null,
    });
    setError('');
  }, [student]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await updateStudent(student.id, formData);
      onSave();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update student details');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Edit Student Profile"
      subtitle="Update the student's personal and parent details."
      size="xl"
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-xs font-semibold rounded-xl leading-relaxed">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Section 1: Academic Info (Read-Only) & Roll Number */}
          <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Class</label>
              <input
                value={student.class}
                disabled
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-xl px-3.5 py-2 text-xs font-semibold cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Section</label>
              <input
                value={student.section.replace('Section ', '')}
                disabled
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-xl px-3.5 py-2 text-xs font-semibold cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Roll Number</label>
              <input
                name="rollNo"
                value={formData.rollNo}
                onChange={handleChange}
                placeholder="Roll No"
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:border-[#2E5BFF]"
                required
              />
            </div>
          </div>

          {/* Profile Photo Section */}
          <div>
            <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">Profile Photo</h3>
            <PhotoUpload
              value={formData.profilePhotoUrl}
              onChange={(val) => setFormData((prev) => ({ ...prev, profilePhotoUrl: val }))}
            />
          </div>

          {/* Section 2: Personal Details */}
          <div>
            <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">Personal Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Student Name</label>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Student Name"
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:border-[#2E5BFF]"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="email@example.com"
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:border-[#2E5BFF]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Phone Number</label>
                <input
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="10-digit number"
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:border-[#2E5BFF]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">National Aadhar Number</label>
                <input
                  name="aadharNo"
                  value={formData.aadharNo}
                  onChange={handleChange}
                  placeholder="Aadhar Number"
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:border-[#2E5BFF]"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Parent Info */}
          <div>
            <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">Parent Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Father's Name</label>
                <input
                  name="fatherName"
                  value={formData.fatherName}
                  onChange={handleChange}
                  placeholder="Father's Name"
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:border-[#2E5BFF]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Mother's Name</label>
                <input
                  name="motherName"
                  value={formData.motherName}
                  onChange={handleChange}
                  placeholder="Mother's Name"
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:border-[#2E5BFF]"
                />
              </div>
            </div>
          </div>

          {/* Buttons Footer */}
          <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition-all min-h-[40px] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded-xl bg-[#2E5BFF] hover:bg-[#254EDB] text-white text-xs font-extrabold transition-all min-h-[40px] flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

