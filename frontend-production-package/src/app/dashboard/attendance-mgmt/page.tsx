'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { Calendar, Search, Users, Check, X, ShieldAlert, Sparkles, RefreshCw, Save } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useFloatingBarPadding } from '@/hooks/useFloatingBarPadding';
import DatePickerInput from '@/components/DatePickerInput';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/lib/date';

const formatLocalTime = (isoString: string) => {
  try {
    const date = new Date(isoString);
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    const hoursStr = hours < 10 ? '0' + hours : hours;
    return `${hoursStr}:${minutesStr} ${ampm}`;
  } catch (e) {
    return '';
  }
};

interface StudentCardProps {
  student: any;
  status: string;
  onToggle: (studentId: string, currentStatus: string) => void;
  isReadOnly?: boolean;
}

const StudentCard = React.memo(({ student, status, onToggle, isReadOnly = false }: StudentCardProps) => {
  const isAbsent = status === 'ABSENT';

  return (
    <div
      onClick={() => {
        if (!isReadOnly) {
          onToggle(student.Id, status);
        }
      }}
      className={`p-4 rounded-3xl border transition-all duration-200 select-none flex justify-between items-center min-h-[72px] ${
        isReadOnly ? 'cursor-default opacity-90' : 'cursor-pointer active:scale-[0.99] touch-pan-y'
      } ${
        isAbsent
          ? `bg-rose-50/70 border-rose-200 ${!isReadOnly ? 'hover:bg-rose-100/50' : ''}`
          : `bg-emerald-50/60 border-emerald-100 ${!isReadOnly ? 'hover:bg-emerald-100/40 hover:border-emerald-200 hover:shadow-xs' : ''}`
      }`}
    >
      <div>
        <h4 className="font-bold text-slate-800 text-[14px]">{student.Name}</h4>
        <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Roll: {student.Roll_No__c || 'N/A'}</p>
      </div>

      <div className="flex items-center justify-end">
        {isAbsent ? (
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-500 text-white rounded-xl text-[11px] font-bold shadow-md shadow-rose-500/15 animate-in fade-in zoom-in-95 duration-150">
            <X className="w-3.5 h-3.5" />
            <span>Absent</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl text-[11px] font-bold shadow-md shadow-emerald-500/15 animate-in fade-in zoom-in-95 duration-150">
            <Check className="w-3.5 h-3.5" />
            <span>Present</span>
          </div>
        )}
      </div>
    </div>
  );
});
StudentCard.displayName = 'StudentCard';

export default function AttendanceMgmtPage() {
  const { showToast } = useToast();
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  // Selection states
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // UI state
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Sheet states
  const [sheet, setSheet] = useState<{ [studentId: string]: string }>({});
  const [originalSheet, setOriginalSheet] = useState<{ [studentId: string]: string }>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Pre-submitted session states
  const [sessionExists, setSessionExists] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);

  // Confirmation Overlays State
  const [showEditConfirmModal, setShowEditConfirmModal] = useState(false);
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);

  // Offline Sync States
  const [isOffline, setIsOffline] = useState(false);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);

  const { barRef, contentPaddingBottom } = useFloatingBarPadding({
    visible: students.length > 0 && !isReadOnly,
  });

  // Sync offline queue to backend
  const syncOfflineQueue = async () => {
    if (!navigator.onLine) return;
    const queueStr = localStorage.getItem('edutrack_offline_attendance_queue');
    if (!queueStr) {
      setPendingQueueCount(0);
      return;
    }
    const queue: any[] = JSON.parse(queueStr);
    if (queue.length === 0) {
      setPendingQueueCount(0);
      return;
    }

    setMessage({ type: 'info', text: `Syncing ${queue.length} offline attendance records...` });
    const failed = [];
    for (const item of queue) {
      try {
        await api.post('/teacher-portal/attendance/save', item);
      } catch (err) {
        console.error('Failed to sync item:', item, err);
        failed.push(item);
      }
    }

    if (failed.length > 0) {
      localStorage.setItem('edutrack_offline_attendance_queue', JSON.stringify(failed));
      setPendingQueueCount(failed.length);
      setMessage({ type: 'error', text: `Failed to sync ${failed.length} records. Will retry later.` });
    } else {
      localStorage.removeItem('edutrack_offline_attendance_queue');
      setPendingQueueCount(0);
      setMessage({ type: 'success', text: 'All offline attendance records synced successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    }
  };

  useEffect(() => {
    // Check initial online status
    setIsOffline(!navigator.onLine);

    const handleOnline = () => {
      setIsOffline(false);
      syncOfflineQueue();
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial load of classes
    async function loadInitial() {
      try {
        const clsRes = await api.get('/teacher-portal/attendance/classes');
        setClasses(clsRes.data);
      } catch (err) {
        console.error('Failed to load classes:', err);
      } finally {
        setLoading(false);
      }
    }
    loadInitial();

    // Check offline queue count
    const queueStr = localStorage.getItem('edutrack_offline_attendance_queue');
    if (queueStr) {
      const queue = JSON.parse(queueStr);
      setPendingQueueCount(queue.length);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch sections when class changes
  useEffect(() => {
    if (!selectedClass) {
      setSections([]);
      return;
    }
    async function loadSections() {
      try {
        const secRes = await api.get(`/teacher-portal/attendance/sections?classVal=${encodeURIComponent(selectedClass)}`);
        setSections(secRes.data);
      } catch (err) {
        console.error('Failed to load sections:', err);
      }
    }
    loadSections();
  }, [selectedClass]);

  // Load roster
  const handleLoadRoster = async () => {
    if (!selectedClass || !selectedSection) return;
    setLoadingStudents(true);
    setMessage({ type: '', text: '' });
    setSessionExists(false);
    setSessionInfo(null);
    setIsReadOnly(false);

    try {
      // 1. Fetch students list
      const rosterRes = await api.get(`/teacher-portal/attendance/students?classVal=${encodeURIComponent(selectedClass)}&sectionVal=${encodeURIComponent(selectedSection)}`);
      
      // 2. Fetch existing session data if taken today
      const sessionRes = await api.get(`/attendance/session-data?classVal=${encodeURIComponent(selectedClass)}&sectionVal=${encodeURIComponent(selectedSection)}&dateVal=${selectedDate}`);
      
      setStudents(rosterRes.data);

      const initialSheet: { [id: string]: string } = {};
      const absentSet = new Set(sessionRes.data.absentIds || []);

      rosterRes.data.forEach((s: any) => {
        initialSheet[s.Id] = absentSet.has(s.Id) ? 'ABSENT' : 'PRESENT';
      });

      setSheet(initialSheet);
      setOriginalSheet(initialSheet);

      if (sessionRes.data.sessionExists) {
        setSessionExists(true);
        setSessionInfo(sessionRes.data);
        setIsReadOnly(true);
      }
    } catch (err) {
      console.error('Failed to load roster:', err);
      setMessage({ type: 'error', text: 'Failed to load class roster.' });
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleStatusChange = (studentId: string, status: string) => {
    setSheet(prev => ({ ...prev, [studentId]: status }));
  };

  const handleToggle = useCallback((studentId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ABSENT' ? 'PRESENT' : 'ABSENT';
    setSheet(prev => ({ ...prev, [studentId]: nextStatus }));
  }, []);

  const handleCancelEdit = () => {
    setSheet(originalSheet);
    setIsReadOnly(true);
    showToast('Editing cancelled. Original attendance restored.', 'info');
  };

  const formatDateLong = (dateStr: string) => {
    return formatDateDDMMYYYY(dateStr);
  };

  const formatLocalDateTime = (isoString: string) => {
    return formatDateTimeDDMMYYYY(isoString);
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const isLocked = sessionExists && selectedDate !== todayStr;

  const hasChanges = Object.keys(sheet).some(id => sheet[id] !== originalSheet[id]);
  const isSaveDisabled = sessionExists ? (!hasChanges || saving) : saving;

  const applyBulkStatus = (status: string) => {
    const updated = { ...sheet };
    students.forEach(s => {
      updated[s.Id] = status;
    });
    setSheet(updated);
    setMessage({ type: 'success', text: `Marked all students as ${status}.` });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const handleSave = () => {
    if (sessionExists) {
      setShowSaveConfirmModal(true);
    } else {
      executeSave();
    }
  };

  const executeSave = async () => {
    setMessage({ type: '', text: '' });
    
    // Parse absent students
    const absentStudentIds = Object.keys(sheet).filter(id => sheet[id] === 'ABSENT');
    const presentCount = Object.keys(sheet).filter(id => sheet[id] === 'PRESENT').length;
    
    const payload = {
      dateStr: selectedDate,
      classVal: selectedClass,
      sectionVal: selectedSection,
      absentStudentIds,
      totalStudents: students.length,
      presentCount,
      absentCount: absentStudentIds.length,
      allowPastDates: true,
    };

    if (isOffline || !navigator.onLine) {
      // Save locally to offline queue
      const queueStr = localStorage.getItem('edutrack_offline_attendance_queue');
      const queue = queueStr ? JSON.parse(queueStr) : [];
      queue.push(payload);
      localStorage.setItem('edutrack_offline_attendance_queue', JSON.stringify(queue));
      setPendingQueueCount(queue.length);
      setMessage({ type: 'success', text: 'Offline Mode: Attendance saved locally on your phone. Will auto-sync when online.' });
      return;
    }

    setSaving(true);
    try {
      await api.post('/teacher-portal/attendance/save', payload);
      if (sessionExists) {
        showToast('✅ Attendance updated successfully.', 'success');
        setMessage({ type: 'success', text: 'Attendance updated successfully.' });
      } else {
        showToast('Attendance saved and synchronized successfully!', 'success');
        setMessage({ type: 'success', text: 'Attendance saved and synchronized successfully!' });
      }
      // Reload roster data to fetch audit times and restore read-only
      await handleLoadRoster();
    } catch (err: any) {
      console.error('Save/Update attendance error:', err);
      // Fallback: save to offline queue on timeout or API crash
      const queueStr = localStorage.getItem('edutrack_offline_attendance_queue');
      const queue = queueStr ? JSON.parse(queueStr) : [];
      queue.push(payload);
      localStorage.setItem('edutrack_offline_attendance_queue', JSON.stringify(queue));
      setPendingQueueCount(queue.length);
      showToast('Connection failed. Saved locally to sync queue.', 'warning');
      setMessage({ type: 'warning', text: 'Server connection failed. Saved locally to sync queue.' });
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = students.filter(s =>
    s.Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.Roll_No__c && s.Roll_No__c.toLowerCase().includes(searchTerm.toLowerCase())),
  );

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
      
      {/* Offline Status Alert Banner */}
      {isOffline && (
        <div className="bg-amber-500 text-white p-3 rounded-2xl flex items-center justify-between text-xs font-bold shadow-md animate-pulse">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>Working Offline (Low Network/No Connection)</span>
          </div>
          {pendingQueueCount > 0 && (
            <span className="bg-amber-700 px-2.5 py-0.5 rounded-lg text-[10px] font-black">{pendingQueueCount} Pending Syncs</span>
          )}
        </div>
      )}

      {/* Online Sync Queue notification */}
      {!isOffline && pendingQueueCount > 0 && (
        <div className="bg-blue-600 text-white p-3.5 rounded-2xl flex items-center justify-between text-xs font-bold shadow-md">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Connection Restored! {pendingQueueCount} attendance logs pending sync.</span>
          </div>
          <button
            onClick={syncOfflineQueue}
            className="bg-white text-blue-600 px-3 py-1 rounded-xl text-[11px] font-black cursor-pointer hover:bg-slate-50"
          >
            Sync Now
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Calendar className="w-6 h-6 text-[#2E5BFF]" />
          Mark Attendance
        </h2>
      </div>

      {message.text && (
        <div className={`p-3.5 rounded-2xl border text-xs font-bold ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
          message.type === 'error' ? 'bg-rose-50 text-rose-700 border-rose-200' :
          'bg-blue-50 text-blue-700 border-blue-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Select Filters Form */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Class/Course</label>
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setSelectedSection('');
                setStudents([]);
              }}
              className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-sm"
            >
              <option value="">Select...</option>
              {classes.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Section/Batch</label>
            <select
              value={selectedSection}
              onChange={(e) => {
                setSelectedSection(e.target.value);
                setStudents([]);
              }}
              className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-sm"
              disabled={!selectedClass}
            >
              <option value="">Select...</option>
              {sections.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Date</label>
          <DatePickerInput
            value={selectedDate}
            onChange={(val) => {
              setSelectedDate(val);
              setStudents([]);
            }}
          />
        </div>

        <button
          onClick={handleLoadRoster}
          disabled={!selectedClass || !selectedSection || loadingStudents}
          className="w-full py-3 bg-[#2E5BFF] hover:bg-blue-600 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/10 cursor-pointer disabled:opacity-50"
        >
          {loadingStudents ? 'Loading Roster...' : '🔍 Load Roster'}
        </button>
      </div>

      {/* Roster & marking section */}
      {students.length > 0 && (
        <div className="space-y-4 animate-in fade-in duration-200">
          
          {/* Green success banner & summary card when attendance is already submitted and we are in read-only mode */}
          {sessionExists && isReadOnly && sessionInfo && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-bold flex items-center gap-2">
                <Check className="w-5 h-5 shrink-0 text-emerald-600" />
                <span>
                  ✅ Attendance for {selectedClass} - {selectedSection} has already been submitted for {formatDateLong(selectedDate)}.
                </span>
              </div>

              {/* Metrics summary card */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center py-2.5 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total</span>
                    <span className="block text-lg font-extrabold text-slate-800 mt-0.5">{sessionInfo.total}</span>
                  </div>
                  <div className="text-center py-2.5 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
                    <span className="block text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">Present</span>
                    <span className="block text-lg font-extrabold text-emerald-600 mt-0.5">{sessionInfo.present}</span>
                  </div>
                  <div className="text-center py-2.5 bg-rose-50/50 rounded-2xl border border-rose-100/50">
                    <span className="block text-[10px] font-semibold text-rose-500 uppercase tracking-wider">Absent</span>
                    <span className="block text-lg font-extrabold text-rose-600 mt-0.5">{sessionInfo.absent}</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs font-semibold text-slate-500 border-t border-slate-100 pt-4 px-1">
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className="text-emerald-600 font-bold">Submitted</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{sessionInfo.createdAt !== sessionInfo.updatedAt ? 'Last Updated:' : 'Submitted:'}</span>
                    <span className="text-slate-700">
                      {sessionInfo.createdAt !== sessionInfo.updatedAt
                        ? `${formatLocalDateTime(sessionInfo.updatedAt)} by ${sessionInfo.teacherName}`
                        : `${formatLocalDateTime(sessionInfo.createdAt)} by ${sessionInfo.teacherName}`
                      }
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (isLocked) {
                      showToast('Attendance is locked and cannot be updated.', 'warning');
                    } else {
                      setShowEditConfirmModal(true);
                    }
                  }}
                  disabled={isLocked}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-4 h-4 text-brand-400" />
                  Update Attendance
                </button>
              </div>
            </div>
          )}

          {/* Locked warning banner */}
          {isLocked && isReadOnly && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl text-xs font-bold flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600" />
              <span>
                Attendance has been locked and can no longer be modified. Please contact the school administrator.
              </span>
            </div>
          )}

          {/* Quick Roster Actions / Bulk Operations (Hidden in read-only mode) */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex gap-2 w-full sm:w-auto">
              {!isReadOnly ? (
                <>
                  <button
                    onClick={() => applyBulkStatus('PRESENT')}
                    className="flex-1 sm:flex-initial px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-100"
                  >
                    <Check className="w-4 h-4" /> Bulk Present
                  </button>
                  <button
                    onClick={() => applyBulkStatus('ABSENT')}
                    className="flex-1 sm:flex-initial px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-rose-100"
                  >
                    <X className="w-4 h-4" /> Bulk Absent
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 rounded-xl text-[11px] font-bold">
                  <span>Read-Only Mode</span>
                </div>
              )}
            </div>
            
            {/* Quick search input */}
            <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 w-full sm:w-[220px]">
              <Search className="w-4 h-4 text-slate-400 mr-2" />
              <input
                type="text"
                placeholder="Find student..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none text-[12px] font-semibold text-slate-700 outline-none w-full placeholder-slate-400"
              />
            </div>
          </div>

          {/* Student Cards Roster List */}
          <div className="space-y-3" style={{ paddingBottom: contentPaddingBottom }}>
            {filteredStudents.length === 0 ? (
              <div className="bg-white py-12 text-center text-slate-400 text-xs italic rounded-3xl border border-slate-200 shadow-sm">
                No students match your criteria.
              </div>
            ) : (
              filteredStudents.map((s) => {
                const currentStatus = sheet[s.Id] || 'PRESENT';
                return (
                  <StudentCard
                    key={s.Id}
                    student={s}
                    status={currentStatus}
                    onToggle={handleToggle}
                    isReadOnly={isReadOnly}
                  />
                );
              })
            )}
          </div>

          {/* Sticky Bottom Save / Cancel Button bar */}
          {!isReadOnly && (
            <div ref={barRef} className="fixed bottom-16 lg:bottom-4 left-0 right-0 p-4 bg-transparent z-40 max-w-md mx-auto sm:max-w-7xl flex justify-end pointer-events-none gap-3">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="pointer-events-auto flex items-center gap-2 px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-full text-xs shadow-2xl transition-all cursor-pointer transform hover:scale-105"
              >
                Cancel
              </button>

              {isSaveDisabled && sessionExists && (
                <div className="pointer-events-auto flex items-center px-4 py-3 bg-slate-50 border border-slate-200 rounded-full text-[11px] font-bold text-slate-400 shadow-sm">
                  No changes detected
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={isSaveDisabled}
                className="pointer-events-auto flex items-center gap-2 px-6 py-3.5 bg-slate-900 text-white hover:bg-slate-800 font-bold rounded-full text-xs shadow-2xl transition-all cursor-pointer transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Syncing...' : (sessionExists ? 'Update Attendance' : 'Save Attendance')}
              </button>
            </div>
          )}

        </div>
      )}

      {/* Confirmation Modal for entering edit mode */}
      {showEditConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-100 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Update Attendance?</h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Attendance has already been submitted for this class. Do you want to modify the submitted attendance?
            </p>
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setShowEditConfirmModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[11px] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowEditConfirmModal(false);
                  setIsReadOnly(false);
                }}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-[11px] shadow-md transition-all cursor-pointer"
              >
                Update Attendance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for saving updates */}
      {showSaveConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-100 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Confirm Attendance Update</h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Are you sure you want to update the submitted attendance? This will overwrite the previously saved attendance for this class and date.
            </p>
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setShowSaveConfirmModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[11px] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowSaveConfirmModal(false);
                  executeSave();
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-[11px] shadow-md transition-all cursor-pointer"
              >
                Confirm Update
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
