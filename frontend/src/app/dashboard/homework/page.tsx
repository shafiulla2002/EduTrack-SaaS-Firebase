'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';
import { BookOpen, Calendar, Plus, Trash2, Edit3, X, CheckCircle2, ChevronRight, FileText, Loader2, Search } from 'lucide-react';
import Drawer from '@/components/Drawer';
import DatePickerInput from '@/components/DatePickerInput';
import { formatDateDDMMYYYY } from '@/lib/date';

export default function HomeworkPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [homeworks, setHomeworks] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form modal visibility
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHomework, setEditingHomework] = useState<any | null>(null);

  // Share Homework state
  const [showShareModal, setShowShareModal] = useState(false);
  const [hwToShare, setHwToShare] = useState<any | null>(null);
  const [isAutoBroadcast, setIsAutoBroadcast] = useState(false);
  const [shareStep, setShareStep] = useState<'details' | 'select_parents' | 'send_list'>('details');
  const [studentsForShare, setStudentsForShare] = useState<any[]>([]);
  const [loadingStudentsForShare, setLoadingStudentsForShare] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Record<string, boolean>>({});
  const [sentStudents, setSentStudents] = useState<Record<string, boolean>>({});
  const [shareSearchTerm, setShareSearchTerm] = useState('');
  const [sendingState, setSendingState] = useState<'idle' | 'sending' | 'completed'>('idle');
  const [sendResult, setSendResult] = useState<any | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [classSectionId, setClassSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [maxMarks, setMaxMarks] = useState('100');
  const [allowLateSubmission, setAllowLateSubmission] = useState(false);
  const [assignmentType, setAssignmentType] = useState('Homework');

  async function loadData() {
    try {
      const [hwRes, clsRes] = await Promise.all([
        api.get('/teacher-portal/homework'),
        api.get('/teacher-portal/classes'),
      ]);
      setHomeworks(hwRes.data);
      setClasses(clsRes.data);
    } catch (err) {
      console.error('Failed to load homework data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    setIsMounted(true);
  }, []);

  // Auto pre-fill from Quick Action link parameters (Assign Homework)
  useEffect(() => {
    if (!loading && classes.length > 0 && typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const createParam = searchParams.get('create');
      const paramClassSectionId = searchParams.get('classSectionId');
      const paramSubjectId = searchParams.get('subjectId');
      const paramSubjectName = searchParams.get('subjectName');
      const paramClassName = searchParams.get('className');
      const paramPeriodNumber = searchParams.get('periodNumber');

      if (createParam === 'true' || paramClassSectionId) {
        let matchedClass = classes.find((c: any) =>
          (paramClassSectionId && c.classSectionId === paramClassSectionId) ||
          (paramClassName && c.className?.toLowerCase().trim() === paramClassName.toLowerCase().trim())
        );

        if (!matchedClass && classes.length > 0) {
          matchedClass = classes[0];
        }

        if (matchedClass) {
          setClassSectionId(matchedClass.classSectionId);
          setSubjectId(paramSubjectId || matchedClass.subjectId);
        }

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setDueDate(tomorrow.toISOString().split('T')[0]);

        const subjName = paramSubjectName || (matchedClass ? matchedClass.subjectName : '');
        const pNum = paramPeriodNumber ? ` (Period ${paramPeriodNumber})` : '';
        if (subjName) {
          setTitle(`${subjName} Assignment${pNum}`);
        } else {
          setTitle('Class Assignment');
        }

        setEditingHomework(null);
        setIsModalOpen(true);
      }
    }
  }, [loading, classes]);

  // Lock body scroll when WhatsApp Share Modal is open
  useEffect(() => {
    if (showShareModal) {
      const originalOverflow = document.body.style.overflow;
      const originalPaddingRight = document.body.style.paddingRight;
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      
      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;
      };
    }
  }, [showShareModal]);

  const openCreateModal = () => {
    setEditingHomework(null);
    setTitle('');
    setDescription('');
    setDueDate('');
    setClassSectionId('');
    setSubjectId('');
    setMaxMarks('100');
    setAllowLateSubmission(false);
    setAssignmentType('Homework');
    setIsModalOpen(true);
  };

  const openEditModal = (hw: any) => {
    setEditingHomework(hw);
    setTitle(hw.title);
    setDescription(hw.description);
    setDueDate(hw.dueDate.split('T')[0]);
    setClassSectionId(hw.classSectionId);
    setSubjectId(hw.subjectId);
    setMaxMarks(String(hw.maxMarks));
    setAllowLateSubmission(hw.allowLateSubmission);
    setAssignmentType(hw.assignmentType);
    setIsModalOpen(true);
  };

  const handleClassChange = (val: string) => {
    setClassSectionId(val);
    const cls = classes.find(c => c.classSectionId === val);
    if (cls) {
      setSubjectId(cls.subjectId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    // Find subject name for payload notification template
    const cls = classes.find(c => c.classSectionId === classSectionId);
    const subjectName = cls ? cls.subjectName : 'Assignment';

    const payload = {
      title,
      description,
      dueDate,
      classSectionId,
      subjectId,
      subjectName,
      maxMarks: parseFloat(maxMarks),
      allowLateSubmission,
      assignmentType,
      status: 'Published',
    };

    try {
      if (editingHomework) {
        await api.put(`/teacher-portal/homework/${editingHomework.id}`, payload);
      } else {
        await api.post('/teacher-portal/homework', payload);
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save homework:', err);
      alert('Failed to save assignment. Verify input details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this homework?')) return;
    try {
      await api.delete(`/teacher-portal/homework/${id}`);
      await loadData();
    } catch (err) {
      console.error('Failed to delete homework:', err);
    }
  };

  const triggerSendConfirm = (hw: any) => {
    openShareModal(hw);
  };

  const openShareModal = async (hw: any) => {
    setHwToShare(hw);
    setIsAutoBroadcast(false);
    setShareStep('details');
    setStudentsForShare([]);
    setSelectedStudents({});
    setSentStudents({});
    setShareSearchTerm('');
    setSendingState('idle');
    setSendResult(null);
    setShowShareModal(true);
    
    setLoadingStudentsForShare(true);
    try {
      const res = await api.get(`/teacher-portal/classes/${hw.classSectionId}/students`);
      setStudentsForShare(res.data);
      // Select all by default
      const initialSelected: Record<string, boolean> = {};
      res.data.forEach((s: any) => {
        initialSelected[s.id] = true;
      });
      setSelectedStudents(initialSelected);
    } catch (err) {
      console.error('Failed to load students for sharing:', err);
    } finally {
      setLoadingStudentsForShare(false);
    }
  };

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return '91' + cleaned;
    }
    return cleaned;
  };

  const generateHomeworkMessage = (hw: any) => {
    if (!hw) return '';
    const dateStr = hw.dueDate.split('T')[0];
    return `📚 Homework Assignment

School: Cambridge International School

Class: ${hw.classSection?.class?.name || ''}

Section: ${hw.classSection?.section?.name || ''}

Subject: ${hw.subject?.name || ''}

Homework: ${hw.title} - ${hw.description}

Due Date: ${dateStr}

Kindly ensure your child completes the homework before the due date.

Thank you.`;
  };

  const handleSendHomeworkBulk = async () => {
    if (!hwToShare) return;
    setSendingState('sending');
    try {
      const res = await api.post(`/teacher-portal/homework/${hwToShare.id}/send-to-parents`);
      setSendResult(res.data);
      setSendingState('completed');
    } catch (err) {
      console.error('Failed to send homework to parents:', err);
      alert('Failed to send homework to parents. Please try again.');
      setSendingState('idle');
    }
  };

  if (loading) {
  return (
    <div className="space-y-4 max-w-md mx-auto sm:max-w-none">
      {/* Skeleton cards */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col space-y-3 animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/3"></div>
          <div className="h-3 bg-slate-200 rounded w-2/3"></div>
          <div className="h-3 bg-slate-200 rounded w-1/2"></div>
          <div className="flex justify-between items-center pt-3 border-t border-slate-100">
            <div className="h-3 bg-slate-200 rounded w-20"></div>
            <div className="h-3 bg-slate-200 rounded w-24"></div>
          </div>
        </div>
      ))}
    </div>
  );
  }

  return (
    <div className="space-y-6 max-w-md mx-auto sm:max-w-none pb-20">
      <div className="flex justify-between items-center pb-4 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-[#2E5BFF]" />
          Homework & Assignments
        </h2>
        <button
          onClick={openCreateModal}
          className="p-2.5 bg-[#2E5BFF] hover:bg-blue-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Homework
        </button>
      </div>

      {homeworks.length === 0 ? (
        <div className="bg-white p-8 text-center rounded-3xl border border-slate-200 shadow-sm text-slate-500 italic text-sm">
          No homework assignments created yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {homeworks.map((hw) => (
            <div key={hw.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded uppercase border ${
                    hw.assignmentType === 'Quiz' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                    hw.assignmentType === 'Project' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                    'bg-blue-50 text-[#2E5BFF] border-blue-100'
                  }`}>
                    {hw.assignmentType}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => triggerSendConfirm(hw)}
                      className="text-slate-400 hover:text-emerald-500 transition-colors p-1 cursor-pointer"
                      title="Send to Parents"
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                        <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 0 0 1.333 4.982L2 22l5.233-1.371a9.936 9.936 0 0 0 4.779 1.226h.005c5.505 0 9.989-4.478 9.99-9.984A9.97 9.97 0 0 0 12.012 2zm5.835 14.16c-.255.72-1.488 1.31-2.036 1.393-.497.075-1.15.1-3.326-.8-2.784-1.153-4.577-3.986-4.717-4.172-.14-.186-1.133-1.507-1.133-2.876 0-1.369.72-2.043 1.002-2.33.282-.286.613-.357.818-.357h.582c.184 0 .432.007.622.457.197.468.675 1.642.732 1.758.056.115.094.25.019.4-.075.15-.113.245-.226.376-.113.13-.239.294-.34.394-.112.11-.23.23-.098.457.132.226.587.967 1.258 1.564.868.772 1.597 1.01 1.823 1.123.226.113.357.094.49-.057.13-.15.563-.656.713-.881.15-.226.3-.188.508-.113.206.075 1.313.619 1.538.732.226.113.376.169.432.263.056.094.056.544-.2 1.263z" />
                      </svg>
                    </button>
                    <button onClick={() => openEditModal(hw)} className="text-slate-400 hover:text-blue-600 transition-colors p-1 cursor-pointer">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(hw.id)} className="text-slate-400 hover:text-red-600 transition-colors p-1 cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="font-bold text-slate-800 text-[15px]">{hw.title}</h3>
                <p className="text-xs text-slate-500 font-light leading-relaxed truncate-3-lines">{hw.description}</p>
              </div>

              <div className="border-t border-slate-100 pt-3 flex flex-wrap gap-y-2 justify-between items-center text-[11px] text-slate-400 font-semibold">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Due: {formatDateDDMMYYYY(hw.dueDate)}
                </span>
                <span className="bg-slate-50 border border-slate-200/50 px-2 py-0.5 rounded text-slate-500 font-mono">
                  {hw.classSection.class.name} - {hw.classSection.section.name} • {hw.subject.name}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Form Modal */}
      <Drawer
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingHomework ? 'Modify Assignment' : 'Create Assignment'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 bg-white dark:bg-slate-800">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Chapter 4 Calculus exercises"
              className="block w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Draft details and instructions..."
              rows={4}
              className="block w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Target Class Section</label>
            <select
              value={classSectionId}
              onChange={(e) => handleClassChange(e.target.value)}
              className="block w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-sm font-semibold"
              required
            >
              <option value="" className="dark:bg-slate-800">Select Class Section...</option>
              {classes.map(c => <option key={c.classSectionId} value={c.classSectionId} className="dark:bg-slate-800">{c.className} ({c.subjectName})</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Assignment Type</label>
              <select
                value={assignmentType}
                onChange={(e) => setAssignmentType(e.target.value)}
                className="block w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-sm"
              >
                <option value="Homework" className="dark:bg-slate-800">Homework</option>
                <option value="Project" className="dark:bg-slate-800">Project</option>
                <option value="Quiz" className="dark:bg-slate-800">Quiz</option>
                <option value="Assignment" className="dark:bg-slate-800">Assignment</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Max Marks</label>
              <input
                type="number"
                value={maxMarks}
                onChange={(e) => setMaxMarks(e.target.value)}
                className="block w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-sm font-semibold"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Due Date</label>
              <DatePickerInput
                value={dueDate}
                onChange={setDueDate}
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="allowLate"
              checked={allowLateSubmission}
              onChange={(e) => setAllowLateSubmission(e.target.checked)}
              className="rounded border-slate-350 text-[#2E5BFF] focus:ring-[#2E5BFF] w-4.5 h-4.5"
            />
            <label htmlFor="allowLate" className="text-xs font-bold text-slate-600 dark:text-slate-400">Allow Late Submissions</label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-[#2E5BFF] hover:bg-blue-600 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/10 cursor-pointer disabled:opacity-50 mt-4 transition-all"
          >
            {submitting ? 'Saving...' : 'Publish Assignment'}
          </button>
        </form>
      </Drawer>

      {/* WhatsApp Share Dialog / Modal */}
      {isMounted && showShareModal && hwToShare && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[99999] p-4 animate-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-black text-slate-900 text-base leading-none">Share Homework</h3>
                <p className="text-[11px] text-slate-400 font-semibold mt-1">WhatsApp Sharing options & distribution</p>
              </div>
              <button
                onClick={() => {
                  setShowShareModal(false);
                  setHwToShare(null);
                }}
                className="p-2 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              
              {shareStep === 'details' && (
                <>
                  {sendingState === 'sending' ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <Loader2 className="w-10 h-10 text-[#2E5BFF] animate-spin" />
                      <p className="text-sm font-bold text-slate-700">Sending automatic broadcast...</p>
                      <p className="text-xs text-slate-400">Please wait while we notify all parents via WhatsApp API</p>
                    </div>
                  ) : sendingState === 'completed' && sendResult ? (
                    <div className="flex flex-col items-center justify-center py-6 space-y-4 text-center">
                      <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center text-emerald-500 mb-2">
                        <CheckCircle2 className="w-10 h-10" />
                      </div>
                      <h3 className="text-lg font-black text-slate-800">Broadcast Sent!</h3>
                      <p className="text-xs text-slate-500 max-w-sm">
                        Successfully dispatched automated homework details to all parents in the class.
                      </p>
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 w-full grid grid-cols-3 gap-2 mt-4">
                        <div>
                          <div className="text-base font-bold text-slate-800">{sendResult.totalStudents || 0}</div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase">Total Parents</div>
                        </div>
                        <div>
                          <div className="text-base font-bold text-emerald-600">{sendResult.successfullySent || 0}</div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase">Sent</div>
                        </div>
                        <div>
                          <div className="text-base font-bold text-red-500">{sendResult.failed || 0}</div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase">Failed</div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setShowShareModal(false);
                          setHwToShare(null);
                        }}
                        className="mt-6 w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs cursor-pointer transition-all"
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Homework Summary Card */}
                      <div className="bg-[#f7fafc] border border-[#e2e8f0] p-4 rounded-2xl space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">Homework details</span>
                          <span className="bg-blue-50 border border-blue-100 text-[#2E5BFF] px-2 py-0.5 rounded text-[10px] font-bold">
                            {hwToShare.classSection?.class?.name} - {hwToShare.classSection?.section?.name} • {hwToShare.subject?.name}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-extrabold text-[#1e293b] text-[14px]">{hwToShare.title}</h4>
                          <p className="text-xs text-[#64748b] font-light mt-1 whitespace-pre-wrap">{hwToShare.description}</p>
                        </div>
                        <div className="text-[11px] text-[#94a3b8] font-semibold flex gap-3">
                          <span>Due Date: {formatDateDDMMYYYY(hwToShare.dueDate)}</span>
                          <span>•</span>
                          <span>
                            Recipients:{' '}
                            {loadingStudentsForShare ? (
                              <span className="animate-pulse">Loading...</span>
                            ) : (
                              `${studentsForShare.length} parents`
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Mode Selector */}
                      <div className="space-y-3">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">WhatsApp Sharing Mode</div>
                        
                        {/* Auto Broadcast Option */}
                        <div 
                          onClick={() => setIsAutoBroadcast(true)}
                          className={`p-4 border rounded-2xl flex items-center justify-between cursor-pointer transition-all ${
                            isAutoBroadcast 
                              ? 'bg-blue-50/50 border-[#2E5BFF]' 
                              : 'bg-slate-50 border-slate-200 hover:border-slate-300 opacity-80'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                              <span>Automatic WhatsApp Broadcast</span>
                              <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider font-sans">Active</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Sends automated message to all parents via API</div>
                          </div>
                          <input
                            type="checkbox"
                            checked={isAutoBroadcast}
                            onChange={(e) => setIsAutoBroadcast(e.target.checked)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-9 h-5 rounded-full appearance-none bg-slate-200 checked:bg-[#2E5BFF] transition-colors relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-transform checked:after:translate-x-4 cursor-pointer"
                          />
                        </div>

                        {/* Manual Option Indicator */}
                        <div 
                          onClick={() => setIsAutoBroadcast(false)}
                          className={`p-4 border rounded-2xl flex items-center justify-between cursor-pointer transition-all ${
                            !isAutoBroadcast 
                              ? 'bg-blue-50/50 border-[#2E5BFF]' 
                              : 'bg-slate-50 border-slate-200 hover:border-slate-300 opacity-80'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-extrabold text-slate-700">Manual WhatsApp Sharing</div>
                            <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Choose recipients and share using WhatsApp Web/App deep link</div>
                          </div>
                          <span className={`w-2.5 h-2.5 rounded-full ${!isAutoBroadcast ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                        </div>
                      </div>

                      {/* Integration Configured Note */}
                      {isAutoBroadcast ? (
                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-800 flex gap-2">
                          <span className="text-sm shrink-0">ℹ️</span>
                          <div>
                            <span className="font-bold">Notice:</span> Automatic WhatsApp broadcasting will dispatch automated notifications to all parents via backend API logs.
                          </div>
                        </div>
                      ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 flex gap-2">
                          <span className="text-sm shrink-0">⚠️</span>
                          <div>
                            <span className="font-bold">Notice:</span> Manual WhatsApp sharing requires sending deep links to each parent individually.
                          </div>
                        </div>
                      )}

                      {/* Action Button */}
                      <div className="pt-2">
                        {isAutoBroadcast ? (
                          <button
                            onClick={handleSendHomeworkBulk}
                            className="w-full py-3 bg-[#2E5BFF] hover:bg-blue-600 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/10"
                          >
                            Send Automatic Broadcast
                          </button>
                        ) : (
                          <button
                            onClick={() => setShareStep('select_parents')}
                            className="w-full py-3 bg-[#2E5BFF] hover:bg-blue-600 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/10"
                          >
                            Share via WhatsApp
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

              {shareStep === 'select_parents' && (
                <>
                  {/* Select Parents Header */}
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Recipients</span>
                    <button
                      onClick={() => {
                        const allSelected = Object.keys(selectedStudents).length === studentsForShare.length;
                        const nextSelected: Record<string, boolean> = {};
                        if (!allSelected) {
                          studentsForShare.forEach((s) => {
                            nextSelected[s.id] = true;
                          });
                        }
                        setSelectedStudents(nextSelected);
                      }}
                      className="text-xs text-[#2E5BFF] font-bold hover:underline cursor-pointer"
                    >
                      {Object.keys(selectedStudents).length === studentsForShare.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  {/* Search Recipients */}
                  <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:border-[#2E5BFF] transition-all">
                    <Search className="w-4 h-4 text-slate-400 mr-2" />
                    <input
                      type="text"
                      placeholder="Search by student or parent name..."
                      value={shareSearchTerm}
                      onChange={(e) => setShareSearchTerm(e.target.value)}
                      className="bg-transparent border-none text-[13px] font-medium text-slate-800 outline-none w-full placeholder-slate-400"
                    />
                  </div>

                  {/* Recipient List */}
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 border border-slate-100 rounded-2xl p-2 bg-slate-50/50">
                    {studentsForShare.filter(s =>
                      s.user.name.toLowerCase().includes(shareSearchTerm.toLowerCase()) ||
                      (s.fatherName && s.fatherName.toLowerCase().includes(shareSearchTerm.toLowerCase())) ||
                      (s.motherName && s.motherName.toLowerCase().includes(shareSearchTerm.toLowerCase()))
                    ).map((student) => {
                      const parentName = student.fatherName || student.motherName || 'Parent';
                      const parentPhone = student.fatherPhone || student.motherPhone || student.guardianPhone || 'N/A';
                      const isChecked = !!selectedStudents[student.id];

                      return (
                        <div
                          key={student.id}
                          onClick={() => {
                            setSelectedStudents((prev) => {
                              const next = { ...prev };
                              if (next[student.id]) {
                                delete next[student.id];
                              } else {
                                next[student.id] = true;
                              }
                              return next;
                            });
                          }}
                          className={`p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                            isChecked
                              ? 'bg-blue-50/40 border-[#2E5BFF]'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              readOnly
                              className="rounded border-slate-350 text-[#2E5BFF] focus:ring-[#2E5BFF] w-4.5 h-4.5 pointer-events-none"
                            />
                            <div>
                              <div className="text-xs font-extrabold text-slate-800">{student.user.name}</div>
                              <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                {parentName} • {parentPhone}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {studentsForShare.length === 0 && (
                      <div className="text-center py-8 text-slate-400 text-xs italic">
                        No students enrolled in this class.
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShareStep('details')}
                      className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold rounded-2xl text-xs hover:bg-slate-50 cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      disabled={Object.keys(selectedStudents).length === 0}
                      onClick={() => {
                        // If only 1 parent is selected, open WhatsApp directly
                        const selectedIds = Object.keys(selectedStudents);
                        if (selectedIds.length === 1) {
                          const student = studentsForShare.find(s => s.id === selectedIds[0]);
                          if (student) {
                            const phone = student.fatherPhone || student.motherPhone || student.guardianPhone || '';
                            const message = generateHomeworkMessage(hwToShare);
                            const formattedPhone = formatPhoneNumber(phone);
                            const url = formattedPhone 
                              ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`
                              : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
                            window.open(url, '_blank');
                            setSentStudents({ [student.id]: true });
                          }
                        }
                        setShareStep('send_list');
                      }}
                      className="flex-1 py-3 bg-[#2E5BFF] hover:bg-blue-600 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      Continue
                    </button>
                  </div>
                </>
              )}

              {shareStep === 'send_list' && (
                <>
                  {/* Message Preview */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Prefilled Message Preview</div>
                    <textarea
                      readOnly
                      rows={6}
                      value={generateHomeworkMessage(hwToShare)}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono text-slate-700 leading-relaxed focus:outline-none resize-none"
                    />
                  </div>

                  {/* Action List */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Send Status ({Object.keys(sentStudents).length} / {Object.keys(selectedStudents).length} Sent)
                    </div>
                    
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 border border-slate-100 rounded-2xl p-2 bg-slate-50/50">
                      {studentsForShare.filter(s => !!selectedStudents[s.id]).map((student) => {
                        const parentName = student.fatherName || student.motherName || 'Parent';
                        const parentPhone = student.fatherPhone || student.motherPhone || student.guardianPhone || '';
                        const isSent = !!sentStudents[student.id];

                        return (
                          <div
                            key={student.id}
                            className="p-3 rounded-xl bg-white border border-slate-250 flex items-center justify-between animate-in fade-in"
                          >
                            <div>
                              <div className="text-xs font-extrabold text-slate-800">{student.user.name}</div>
                              <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                {parentName} • {parentPhone || 'No Phone'}
                              </div>
                            </div>
                            
                            {isSent ? (
                              <button
                                onClick={() => {
                                  const message = generateHomeworkMessage(hwToShare);
                                  const formattedPhone = formatPhoneNumber(parentPhone);
                                  const url = formattedPhone 
                                    ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`
                                    : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
                                  window.open(url, '_blank');
                                }}
                                className="px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg text-[10px] font-extrabold flex items-center gap-1 hover:bg-emerald-100 transition-colors cursor-pointer"
                              >
                                ✓ Sent (Resend)
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  const message = generateHomeworkMessage(hwToShare);
                                  const formattedPhone = formatPhoneNumber(parentPhone);
                                  const url = formattedPhone 
                                    ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`
                                    : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
                                  window.open(url, '_blank');
                                  setSentStudents((prev) => ({ ...prev, [student.id]: true }));
                                }}
                                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-650 text-white rounded-lg text-[10px] font-bold shadow-xs cursor-pointer"
                              >
                                Send via WhatsApp
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShareStep('select_parents')}
                      className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold rounded-2xl text-xs hover:bg-slate-50 cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => {
                        setShowShareModal(false);
                        setHwToShare(null);
                      }}
                      className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </>
              )}

            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
