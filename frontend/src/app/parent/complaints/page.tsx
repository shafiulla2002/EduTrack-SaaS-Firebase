'use client';

import React, { useState, useEffect } from 'react';
import { useParent } from '../ParentContext';
import { api } from '@/lib/api';
import {
  AlertCircle, CheckCircle, Info, Send, Loader2, ArrowRight,
  MessageSquare, Clock, Eye, X, ShieldAlert, AlertTriangle, User, Calendar
} from 'lucide-react';

export default function ComplaintsPage() {
  const { selectedChild } = useParent();
  const [activeTab, setActiveTab] = useState<'my-tickets' | 'teacher-complaints'>('my-tickets');
  
  // Parent grievances states
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Teacher complaints states
  const [teacherComplaints, setTeacherComplaints] = useState<any[]>([]);
  const [teacherLoading, setTeacherLoading] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Academics');
  const [description, setDescription] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Audit modal state
  const [selectedAuditComplaint, setSelectedAuditComplaint] = useState<any | null>(null);

  const fetchComplaints = async () => {
    try {
      const res = await api.get('/parent-portal/complaints');
      setComplaints(res.data || []);
    } catch (err) {
      console.error('Failed to fetch parent complaints:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeacherComplaints = async () => {
    if (!selectedChild?.id) {
      setTeacherComplaints([]);
      return;
    }
    setTeacherLoading(true);
    try {
      const res = await api.get(`/parent-portal/children/${selectedChild.id}/teacher-complaints`);
      setTeacherComplaints(res.data || []);
    } catch (err) {
      console.error('Failed to fetch teacher complaints:', err);
    } finally {
      setTeacherLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
    const interval = setInterval(fetchComplaints, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchTeacherComplaints();
    const interval = setInterval(fetchTeacherComplaints, 10000);
    return () => clearInterval(interval);
  }, [selectedChild?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setMessage('');
    try {
      const res = await api.post('/parent-portal/complaints', {
        title,
        category,
        description,
      });

      setMessage('Concern registered successfully! Ticket ref: #' + res.data.id.substring(0, 8).toUpperCase());
      setComplaints(prev => [res.data, ...prev]);

      // Reset
      setTitle('');
      setDescription('');

      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      console.error(err);
      setMessage('Failed to submit concern. Please try again.');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-t-[#2E5BFF] border-r-[#2E5BFF] border-b-transparent border-l-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in relative font-sans text-slate-800 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            Complaint Box
          </h2>
          <p className="text-slate-500 text-xs mt-1 font-medium">
            Manage your filed concerns, track admin replies, and view teacher-submitted behavior complaints for your child.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('my-tickets')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'my-tickets'
              ? 'border-blue-600 text-blue-600 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-650'
          }`}
        >
          My Grievance Tickets
        </button>
        <button
          onClick={() => setActiveTab('teacher-complaints')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'teacher-complaints'
              ? 'border-blue-600 text-blue-600 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-650'
          }`}
        >
          Teacher Complaints {selectedChild ? `(${selectedChild.name})` : ''}
        </button>
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

      {/* Tab Contents */}
      {activeTab === 'my-tickets' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Form */}
          <div className="lg:col-span-5 bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 border-b border-slate-100 pb-3">File New Concern / Ticket</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-[#2E5BFF]"
                >
                  <option value="Academics">Academics / Curriculum</option>
                  <option value="Transport">Transport / Bus Timing</option>
                  <option value="Facilities">Facilities / Sanitation</option>
                  <option value="Billing">Fee Statements / Payments</option>
                  <option value="Other">Other / General Suggestions</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Subject / Headline *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Bus arrival delay at stop"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-[#2E5BFF]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Elaborated Concern *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Elaborate on the issue or share detailed feedback..."
                  rows={4}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#2E5BFF] focus:ring-1 focus:ring-[#2E5BFF]"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitLoading}
                className="w-full py-3.5 bg-[#2E5BFF] hover:bg-blue-600 text-white rounded-xl font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitLoading ? (
                  <>
                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                    Submitting Ticket...
                  </>
                ) : (
                  'File Concern Ticket'
                )}
              </button>
            </form>
          </div>

          {/* Tracker */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">Active &amp; Past Tickets</h3>
              <span className="text-[10px] text-slate-400 font-mono">Real-Time Sync Active</span>
            </div>
            
            <div className="space-y-4">
              {complaints.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center bg-white border border-slate-200 rounded-3xl shadow-sm">
                  <Info className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-xs font-semibold">No complaints registered yet.</p>
                </div>
              ) : (
                complaints.map((c) => {
                  const st = (c.status || 'OPEN').toUpperCase();
                  return (
                    <div
                      key={c.id}
                      className={`bg-white border rounded-2xl p-5 shadow-xs space-y-3 transition-all ${
                        st === 'OPEN' ? 'border-blue-200' :
                        st === 'IN_PROGRESS' ? 'border-amber-200 bg-amber-50/10' :
                        st === 'RESOLVED' ? 'border-emerald-200' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-bold text-[#2E5BFF] uppercase tracking-wider">{c.category}</span>
                          <h4 className="text-sm font-extrabold text-slate-900 leading-snug mt-0.5">{c.title}</h4>
                        </div>
                        <span className={`px-2.5 py-1 rounded-lg border font-extrabold uppercase tracking-wider text-[9px] ${
                          st === 'OPEN' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                          st === 'IN_PROGRESS' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                          st === 'RESOLVED' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                          'bg-slate-100 border-slate-200 text-slate-600'
                        }`}>
                          {c.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-150">
                        {c.description}
                      </p>

                      {/* Official Admin Reply */}
                      {c.adminReply && (
                        <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-100 space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-extrabold text-blue-900">
                            <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                            School Admin Reply:
                          </div>
                          <p className="text-xs text-slate-700 font-medium leading-relaxed italic">
                            "{c.adminReply}"
                          </p>
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <span className="text-[9px] text-slate-400 font-mono">
                          Ref: #{c.id.substring(0, 8).toUpperCase()} &nbsp;·&nbsp; {new Date(c.updatedAt || c.createdAt).toLocaleDateString()}
                        </span>

                        <button
                          type="button"
                          onClick={() => setSelectedAuditComplaint(c)}
                          className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <Eye className="w-3 h-3 text-slate-500" /> Ticket History
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'teacher-complaints' && (
        <div className="space-y-4 max-w-3xl mx-auto">
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
              Complaints Raised by Teachers
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">Real-Time Sync Active</span>
          </div>

          {teacherLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#2E5BFF] animate-spin" />
            </div>
          ) : !selectedChild ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center bg-white border border-slate-200 rounded-3xl shadow-sm">
              <Info className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-xs font-semibold">Please select a student from the switcher dropdown at the top.</p>
            </div>
          ) : teacherComplaints.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center bg-white border border-slate-200 rounded-3xl shadow-sm px-4">
              <AlertTriangle className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-xs font-semibold">No teacher complaints have been raised for this student.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {teacherComplaints.map((c) => {
                const st = (c.status || 'NEW').toUpperCase();
                return (
                  <div
                    key={c.id}
                    className={`bg-white border rounded-2xl p-5 shadow-xs space-y-3 transition-all ${
                      st === 'NEW' || st === 'OPEN' ? 'border-blue-200' :
                      st === 'IN_PROGRESS' ? 'border-amber-200 bg-amber-50/10' :
                      st === 'RESOLVED' || st === 'CLOSED' ? 'border-emerald-200' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold text-[#2E5BFF] uppercase tracking-wider">{c.category}</span>
                        <h4 className="text-sm font-extrabold text-slate-900 leading-snug mt-0.5">
                          {c.category} Behavior Incident
                        </h4>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg border font-extrabold uppercase tracking-wider text-[9px] ${
                        st === 'NEW' || st === 'OPEN' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                        st === 'IN_PROGRESS' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                        st === 'RESOLVED' || st === 'CLOSED' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                        'bg-slate-100 border-slate-200 text-slate-600'
                      }`}>
                        {c.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-150">
                      {c.description}
                    </p>

                    {/* Metadata: Submitted By & Date */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 text-xs text-slate-500 border-t border-slate-100">
                      <div className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>Submitted By: <strong>{c.teacher?.user?.name || 'Teacher'}</strong></span>
                      </div>
                      <div className="flex items-center gap-1 sm:ml-auto">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(c.createdAt).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Optional Resolution remarks (if supported in database / added dynamically) */}
                    {c.resolutionNotes && (
                      <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-100 space-y-1 mt-2">
                        <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-950">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          Resolution Notes / Remarks:
                        </div>
                        <p className="text-xs text-slate-700 font-medium leading-relaxed italic">
                          "{c.resolutionNotes}"
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Audit Trail Modal */}
      {selectedAuditComplaint && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[999] p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl space-y-0">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-sm leading-none">Ticket Audit Trail &amp; History</h3>
                <p className="text-slate-400 text-[10px] mt-1">Ref ID: #{selectedAuditComplaint.id.substring(0, 8).toUpperCase()}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAuditComplaint(null)}
                className="text-slate-400 hover:text-white p-1 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
              {selectedAuditComplaint.statusHistories && selectedAuditComplaint.statusHistories.length > 0 ? (
                selectedAuditComplaint.statusHistories.map((h: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-150 text-xs">
                    <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-800 text-[11px]">
                        Status updated to <strong className="text-blue-600">{h.currentStatus}</strong> by {h.updatedBy?.name || 'Admin'}
                      </p>
                      {h.remarks && <p className="text-slate-500 text-[10px] italic mt-0.5 font-medium">"{h.remarks}"</p>}
                      <span className="text-[9px] text-slate-400 font-mono block mt-1">{new Date(h.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-500 text-center py-6">
                  Complaint ticket opened and registered in database.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
