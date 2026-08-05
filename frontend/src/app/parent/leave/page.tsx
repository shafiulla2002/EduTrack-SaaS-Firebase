'use client';

import React, { useState, useEffect } from 'react';
import { useParent } from '../ParentContext';
import { api } from '@/lib/api';
import {
  FileText, CheckCircle, Clock, Upload, X, ShieldAlert, Loader2,
  Paperclip, Eye, User, Calendar
} from 'lucide-react';
import DatePickerInput from '@/components/DatePickerInput';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/lib/date';

export default function LeavePage() {
  const { selectedChild } = useParent();
  const [leaveType, setLeaveType] = useState('Casual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Submit states
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [leavesList, setLeavesList] = useState<any[]>([]);

  // Audit modal state
  const [selectedAuditLeave, setSelectedAuditLeave] = useState<any | null>(null);

  const fetchLeaves = async (childId: string) => {
    try {
      const res = await api.get(`/parent-portal/children/${childId}/leave`);
      setLeavesList(res.data || []);
    } catch (err) {
      console.error('Failed to fetch leaves:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (selectedChild) {
      setHistoryLoading(true);
      fetchLeaves(selectedChild.id);
      const interval = setInterval(() => fetchLeaves(selectedChild.id), 10000);
      return () => clearInterval(interval);
    }
  }, [selectedChild]);

  // Listen to switcher events
  useEffect(() => {
    const handleChildChange = (e: any) => {
      fetchLeaves(e.detail);
    };
    window.addEventListener('parentChildChanged', handleChildChange);
    return () => window.removeEventListener('parentChildChanged', handleChildChange);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChild) return;

    setLoading(true);
    setMessage('');
    try {
      const processSubmit = async (base64File: string | null) => {
        try {
          await api.post(`/parent-portal/children/${selectedChild.id}/leave`, {
            leaveType,
            startDate,
            endDate,
            reason,
            base64File,
          });

          setMessage('Leave application submitted successfully!');
          fetchLeaves(selectedChild.id);

          // Reset form
          setStartDate('');
          setEndDate('');
          setReason('');
          setUploadFile(null);

          setTimeout(() => setMessage(''), 4000);
        } catch (err) {
          console.error(err);
          setMessage('Failed to submit leave request. Please try again.');
        } finally {
          setLoading(false);
        }
      };

      if (uploadFile) {
        const reader = new FileReader();
        reader.readAsDataURL(uploadFile);
        reader.onload = () => processSubmit(reader.result as string);
        reader.onerror = () => {
          setMessage('Failed to process certificate file.');
          setLoading(false);
        };
      } else {
        await processSubmit(null);
      }
    } catch (err) {
      console.error(err);
      setMessage('Failed to submit leave. Please try again.');
      setLoading(false);
    }
  };

  if (!selectedChild) {
    return (
      <div className="text-slate-500 text-sm text-center py-12">
        Please select a child to apply for leave.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in relative font-sans text-slate-800 pb-20">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          Apply Student Leave: <span className="text-[#2E5BFF] font-extrabold">{selectedChild.name}</span>
        </h2>
        <p className="text-slate-500 text-xs mt-1 font-medium">
          Submit absenteeism applications for medical recovery or emergency situations. Real-time updates auto-reflect approval status.
        </p>
      </div>

      {message && (
        <div className={`p-4 border rounded-2xl text-xs font-semibold leading-relaxed flex items-center gap-2 ${
          message.includes('successfully') 
            ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
            : 'bg-rose-50 border-rose-100 text-rose-700'
        }`}>
          {message.includes('successfully') ? <CheckCircle className="w-4.5 h-4.5 shrink-0" /> : <ShieldAlert className="w-4.5 h-4.5 shrink-0" />}
          <span>{message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Application Form */}
        <div className="lg:col-span-5 bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900 border-b border-slate-100 pb-3">New Leave Application</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Leave Type *</label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-[#2E5BFF]"
              >
                <option value="Casual">Casual Leave</option>
                <option value="Medical">Medical Leave</option>
                <option value="Half Day">Half Day Leave</option>
                <option value="Emergency">Emergency Leave</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Start Date *</label>
                <DatePickerInput
                  value={startDate}
                  onChange={setStartDate}
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">End Date *</label>
                <DatePickerInput
                  value={endDate}
                  onChange={setEndDate}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Description / Reason *</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Briefly state the detailed reason for absence..."
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#2E5BFF] focus:ring-1 focus:ring-[#2E5BFF]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Attachment (Optional, e.g. Doctor's Note)</label>
              <div className="border border-dashed border-slate-200 bg-slate-50 hover:border-slate-350 rounded-2xl p-4 text-center cursor-pointer transition-all relative flex items-center justify-center gap-2">
                <input
                  type="file"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setUploadFile(file);
                  }}
                />
                <Upload className="w-4.5 h-4.5 text-slate-400" />
                <span className="text-xs text-slate-500 font-semibold block truncate max-w-[200px]">
                  {uploadFile ? uploadFile.name : 'Choose file to upload'}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#2E5BFF] hover:bg-blue-600 text-white rounded-xl font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                  Submitting Application...
                </>
              ) : (
                'Submit Application'
              )}
            </button>
          </form>
        </div>

        {/* Application History Tracker */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">Application History &amp; Status</h3>
            <span className="text-[10px] text-slate-400 font-mono">Live Sync Active</span>
          </div>
          
          {historyLoading ? (
            <div className="flex justify-center items-center py-16 bg-white border border-slate-200 rounded-3xl shadow-sm">
              <Loader2 className="w-6 h-6 animate-spin text-[#2E5BFF]" />
            </div>
          ) : (
            <div className="space-y-4">
              {leavesList.length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-12 bg-white border border-slate-200 rounded-3xl shadow-sm">
                  No leave applications submitted yet.
                </div>
              ) : (
                leavesList.map((leave) => {
                  const statusUpper = (leave.status || 'PENDING').toUpperCase();
                  const isApproved = statusUpper === 'APPROVED';
                  const isRejected = statusUpper === 'REJECTED';

                  return (
                    <div
                      key={leave.id}
                      className={`bg-white border rounded-2xl p-5 shadow-xs space-y-3.5 transition-all ${
                        isApproved ? 'border-emerald-200' : isRejected ? 'border-rose-200' : 'border-amber-200 bg-amber-50/10'
                      }`}
                    >
                      {/* Header */}
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-bold text-[#2E5BFF] text-xs block">{leave.leaveType} Leave</span>
                          <span className="text-[11px] text-slate-500 font-semibold">{formatDateDDMMYYYY(leave.startDate)} to {formatDateDDMMYYYY(leave.endDate)}</span>
                        </div>
                        <span className={`px-2.5 py-1 rounded-lg border font-extrabold uppercase tracking-wider text-[9px] ${
                          isApproved ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                          isRejected ? 'bg-rose-50 border-rose-200 text-rose-700' :
                          'bg-amber-50 border-amber-200 text-amber-700'
                        }`}>
                          {isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Pending Approval'}
                        </span>
                      </div>

                      {/* Reason */}
                      <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-150">
                        {leave.reason}
                      </p>

                      {/* Approval Info Box */}
                      {(isApproved || isRejected || leave.comments || leave.approvedBy) && (
                        <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                          {leave.approvedBy && (
                            <div className="text-slate-700 font-semibold text-[11px]">
                              <strong className="text-slate-500 font-bold">Processed By:</strong> {leave.approvedBy} {leave.approvedRole ? `(${leave.approvedRole})` : ''}
                            </div>
                          )}
                          {leave.approvedDate && (
                            <div className="text-slate-500 text-[10px]">
                              <strong className="font-bold">Decision Date:</strong> {leave.approvedDate}
                            </div>
                          )}
                          {leave.comments && (
                            <div className="text-slate-800 font-medium text-[11px] pt-1">
                              <strong className="text-blue-700 font-bold">Remarks:</strong> "{leave.comments}"
                            </div>
                          )}
                        </div>
                      )}

                      {/* Card Footer Actions */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        {leave.attachmentUrl ? (
                          <a
                            href={leave.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-[#2E5BFF] hover:underline flex items-center gap-1 font-bold"
                          >
                            <Paperclip className="w-3.5 h-3.5" /> Medical Certificate / File
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">No attachment</span>
                        )}

                        <button
                          onClick={() => setSelectedAuditLeave(leave)}
                          className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <Eye className="w-3 h-3 text-slate-500" /> Audit Trail
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

      </div>

      {/* Audit Trail Modal */}
      {selectedAuditLeave && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[999] p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl space-y-0">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-sm leading-none">Leave Audit Trail</h3>
                <p className="text-slate-400 text-[10px] mt-1">Ref ID: {selectedAuditLeave.id}</p>
              </div>
              <button
                onClick={() => setSelectedAuditLeave(null)}
                className="text-slate-400 hover:text-white p-1 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
              {selectedAuditLeave.statusHistories && selectedAuditLeave.statusHistories.length > 0 ? (
                selectedAuditLeave.statusHistories.map((h: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-150 text-xs">
                    <Clock className="w-3.5 h-3.5 text-[#2E5BFF] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-800 text-[11px]">
                        Status updated to <strong className="text-blue-600">{h.currentStatus}</strong> by {h.updatedBy?.name || 'User'} ({h.updatedBy?.role || 'System'})
                      </p>
                      {h.remarks && <p className="text-slate-500 text-[10px] italic mt-0.5 font-medium">"{h.remarks}"</p>}
                      <span className="text-[9px] text-slate-400 font-mono block mt-1">{new Date(h.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-500 text-center py-6">
                  Initial application submitted and recorded in audit ledger.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
