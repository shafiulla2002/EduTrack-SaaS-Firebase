'use client';

import React, { useState, useEffect } from 'react';
import { useParent } from '../ParentContext';
import { api } from '@/lib/api';
import { BookOpen, Calendar, Paperclip, CheckCircle, Clock, Upload, X, ShieldAlert, Loader2 } from 'lucide-react';

export default function HomeworkPage() {
  const { selectedChild } = useParent();
  const [homeworkList, setHomeworkList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Submit modal states
  const [submittingHomework, setSubmittingHomework] = useState<any>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchHomework = async (childId: string) => {
    try {
      setLoading(true);
      const res = await api.get(`/parent-portal/children/${childId}/homework`);
      setHomeworkList(res.data || []);
    } catch (err) {
      console.error('Failed to fetch homework:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedChild) {
      fetchHomework(selectedChild.id);
    }
  }, [selectedChild]);

  // Listen to switcher events
  useEffect(() => {
    const handleChildChange = (e: any) => {
      fetchHomework(e.detail);
    };
    window.addEventListener('parentChildChanged', handleChildChange);
    return () => window.removeEventListener('parentChildChanged', handleChildChange);
  }, []);

  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChild || !submittingHomework || !uploadFile) return;
    
    setSubmitLoading(true);
    setMessage('');
    try {
      const reader = new FileReader();
      reader.readAsDataURL(uploadFile);
      reader.onload = async () => {
        const base64File = reader.result as string;
        try {
          await api.post(`/parent-portal/children/${selectedChild.id}/homework/${submittingHomework.id}/submit`, {
            base64File,
            fileName: uploadFile.name,
          });
          setMessage('Assignment submitted successfully!');
          fetchHomework(selectedChild.id);
          setTimeout(() => {
            setSubmittingHomework(null);
            setUploadFile(null);
            setMessage('');
          }, 1500);
        } catch (err) {
          console.error(err);
          setMessage('Failed to submit assignment. Please try again.');
          setSubmitLoading(false);
        }
      };
      reader.onerror = () => {
        setMessage('Failed to process submission attachment.');
        setSubmitLoading(false);
      };
    } catch (err) {
      console.error(err);
      setMessage('Failed to submit assignment.');
      setSubmitLoading(false);
    }
  };

  const formatDateDDMMYYYY = (dateStr: string) => {
    if (!dateStr) return '';
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return dateStr;
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}/${month}/${year}`;
  };

  if (!selectedChild) {
    return (
      <div className="text-slate-500 text-sm text-center py-12">
        Please select a child to view homework.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-t-[#2E5BFF] border-r-[#2E5BFF] border-b-transparent border-l-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in relative">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          Homework Desk: <span className="text-[#2E5BFF] font-extrabold">{selectedChild.name}</span>
        </h2>
        <p className="text-slate-500 text-xs mt-1 font-light">Monitor pending and completed class assignments.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {homeworkList.length === 0 ? (
          <div className="col-span-2 bg-white border border-slate-200 p-12 rounded-3xl text-center text-slate-500 shadow-sm">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold">No homework assigned yet.</p>
            <p className="text-xs font-light mt-1">Excellent! Your child is all caught up.</p>
          </div>
        ) : (
          homeworkList.map((hw: any) => (
            <div
              key={hw.id}
              className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all space-y-5"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-[#2E5BFF] font-black uppercase tracking-wider bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg">
                      {hw.subject}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium block mt-2">Assigned by: {hw.teacher}</span>
                  </div>
                  
                  {hw.submitted ? (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                      <CheckCircle className="w-3.5 h-3.5" />
                      {hw.submissionStatus}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider">
                      <Clock className="w-3.5 h-3.5" />
                      Pending
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-slate-700 text-sm leading-snug">{hw.title}</h3>
                  <p className="text-slate-500 text-xs font-normal leading-relaxed whitespace-pre-line">{hw.description}</p>
                </div>

                {hw.attachments && hw.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1.5">
                    {hw.attachments.map((att: string, idx: number) => (
                      <a
                        key={idx}
                        href={att.startsWith('http') || att.startsWith('/uploads') ? att : '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer font-semibold"
                      >
                        <Paperclip className="w-3 h-3" />
                        Attachment File {idx + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-4 flex justify-between items-center text-[10px] text-slate-400">
                <span>Due Date: <strong className="text-slate-700 font-bold">{formatDateDDMMYYYY(hw.dueDate)}</strong></span>
                {!hw.submitted && (
                  <button
                    onClick={() => setSubmittingHomework(hw)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#2E5BFF] text-white font-bold tracking-wide hover:bg-blue-600 transition-all flex items-center gap-1.5 cursor-pointer text-[10px]"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Submit Work
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Submission Modal Dialog */}
      {submittingHomework && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-xl p-6 relative animate-scale-up space-y-4">
            <button
              onClick={() => {
                setSubmittingHomework(null);
                setUploadFile(null);
                setMessage('');
              }}
              className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-base font-bold text-slate-800">Submit Assignment</h3>
              <p className="text-xs text-slate-400 font-light mt-0.5">{submittingHomework.title}</p>
            </div>

            {message && (
              <div className={`p-3 border rounded-2xl text-xs font-semibold leading-relaxed flex items-center gap-2 ${
                message.includes('successfully') 
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                  : 'bg-rose-50 border-rose-100 text-rose-700'
              }`}>
                {message.includes('successfully') ? <CheckCircle className="w-4.5 h-4.5 shrink-0" /> : <ShieldAlert className="w-4.5 h-4.5 shrink-0" />}
                <span>{message}</span>
              </div>
            )}

            <form onSubmit={handleSubmitAssignment} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Attachment File (PDF, PNG, JPG)</label>
                <div className="border border-dashed border-slate-200 hover:border-slate-350 bg-slate-50 rounded-2xl p-6 text-center transition-all relative cursor-pointer flex flex-col items-center justify-center">
                  <input
                    type="file"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setUploadFile(file);
                    }}
                    required
                  />
                  <Upload className="w-7 h-7 text-slate-400 mb-2" />
                  <span className="text-xs text-slate-500 font-semibold block truncate max-w-[250px]">
                    {uploadFile ? uploadFile.name : 'Select or drag file to upload'}
                  </span>
                  <span className="text-[9px] text-slate-400 block mt-1">Maximum upload size: 2MB (Base64)</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitLoading || !uploadFile}
                className="w-full py-3 bg-[#2E5BFF] hover:bg-blue-600 text-white rounded-xl font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitLoading ? (
                  <>
                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                    Uploading Assignment...
                  </>
                ) : (
                  'Confirm & Submit'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
