'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Award, CheckCircle, Save, X, PlusCircle, MinusCircle, 
  RefreshCw, Settings, AlertTriangle
} from 'lucide-react';
import { api, fastGet, getCachedData } from '@/lib/api';
import LoadingSpinner from '@/components/loading/LoadingSpinner';
import { useToast } from '@/components/Toast';

type ClassSectionOption = {
  value: string;
  label: string;
  classId: string;
  sectionId: string;
};

type SubjectOption = {
  id: string;
  name: string;
  maxMarks: number;
  icon: string;
};

type StudentMarkRow = {
  studentId: string;
  name: string;
  rollNo: string;
  hasMarks: boolean;
  marksObtained: number | null;
  remarks?: string;
};

type RosterStatus = 'idle' | 'loading' | 'success' | 'error';

export default function ExamsAndMarksPage() {
  const router = useRouter();
  const { showToast } = useToast();

  // Active request tracking refs for race-condition prevention & abort handling
  const activeRosterRequestIdRef = useRef<string>('');
  const rosterAbortControllerRef = useRef<AbortController | null>(null);

  // Synchronous metadata cache initialization
  const [classes, setClasses] = useState<ClassSectionOption[]>(() => getCachedData<ClassSectionOption[]>('/exams/classes') || []);
  const [subjects, setSubjects] = useState<SubjectOption[]>(() => getCachedData<SubjectOption[]>('/exams/subjects') || []);
  const [examTypes, setExamTypes] = useState<string[]>(() => getCachedData<string[]>('/exams/exam-types') || []);
  const [components, setComponents] = useState<any[]>(() => getCachedData<any[]>('/exam-config/components') || []);

  // Selection states with session persistence
  const [selectedClassSectionId, setSelectedClassSectionId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('last_exam_class');
      if (saved) return saved;
    }
    const cached = getCachedData<ClassSectionOption[]>('/exams/classes');
    return cached && cached.length > 0 ? cached[0].value : '';
  });

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('last_exam_subject');
      if (saved) return saved;
    }
    const cached = getCachedData<SubjectOption[]>('/exams/subjects');
    return cached && cached.length > 0 ? cached[0].id : '';
  });

  const [selectedExamName, setSelectedExamName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('last_exam_name');
      if (saved) return saved;
    }
    const cached = getCachedData<string[]>('/exams/exam-types');
    return cached && cached.length > 0 ? cached[0] : '';
  });

  const [selectedSubjectType, setSelectedSubjectType] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('last_exam_component');
      if (saved) return saved;
    }
    const cached = getCachedData<any[]>('/exam-config/components');
    return cached && cached.length > 0 ? cached[0].name : 'Theory';
  });

  // State separation: Roster records, Roster status & Errors
  const [roster, setRoster] = useState<StudentMarkRow[]>([]);
  const [rosterStatus, setRosterStatus] = useState<RosterStatus>('idle');
  const [rosterError, setRosterError] = useState<string>('');
  const [metadataError, setMetadataError] = useState<string>('');

  // Exam configuration (pass % and max marks)
  const [examConfig, setExamConfig] = useState<{ passingPercentage: number; maxMarks: number; passMarks?: number }>({
    passingPercentage: 35,
    maxMarks: 100,
    passMarks: 35,
  });

  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(() => {
    const cachedClasses = getCachedData<ClassSectionOption[]>('/exams/classes');
    return !cachedClasses || cachedClasses.length === 0;
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [popupAlert, setPopupAlert] = useState<{
    show: boolean;
    title: string;
    message: string;
    maxMarks?: number;
    enteredValue?: number;
  }>({
    show: false,
    title: '',
    message: '',
  });

  // Manage Exam Types State
  const [isManageTypesOpen, setIsManageTypesOpen] = useState(false);
  const [manageTypesList, setManageTypesList] = useState<any[]>([]);
  const [newTypeName, setNewTypeName] = useState('');
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeName, setEditingTypeName] = useState('');
  const [isSavingType, setIsSavingType] = useState(false);
  const [typeError, setTypeError] = useState('');

  // Fetch types for management modal
  const fetchManageTypes = async () => {
    try {
      const res = await fastGet('/exams/exam-types/manage');
      setManageTypesList(res.data || []);
    } catch (err) {
      console.error('Error fetching manage exam types:', err);
    }
  };

  useEffect(() => {
    if (isManageTypesOpen) {
      fetchManageTypes();
    }
  }, [isManageTypesOpen]);

  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault();
    setTypeError('');
    if (!newTypeName.trim()) return;
    setIsSavingType(true);
    try {
      await api.post('/exams/exam-types', { name: newTypeName });
      setNewTypeName('');
      await fetchManageTypes();
      await fetchMetadata();
    } catch (err: any) {
      setTypeError(err.response?.data?.message || 'Failed to create exam type.');
    } finally {
      setIsSavingType(false);
    }
  };

  const handleUpdateType = async (id: string) => {
    setTypeError('');
    if (!editingTypeName.trim()) return;
    setIsSavingType(true);
    try {
      await api.put(`/exams/exam-types/${id}`, { name: editingTypeName });
      setEditingTypeId(null);
      setEditingTypeName('');
      await fetchManageTypes();
      await fetchMetadata();
    } catch (err: any) {
      setTypeError(err.response?.data?.message || 'Failed to update exam type.');
    } finally {
      setIsSavingType(false);
    }
  };

  const handleDeleteType = async (id: string) => {
    if (!confirm('Are you sure you want to delete this exam type? This may affect records using it.')) return;
    setTypeError('');
    try {
      await api.delete(`/exams/exam-types/${id}`);
      await fetchManageTypes();
      await fetchMetadata();
    } catch (err: any) {
      setTypeError(err.response?.data?.message || 'Failed to delete exam type.');
    }
  };

  // Initial metadata fetch
  useEffect(() => {
    fetchMetadata();
  }, []);

  const fetchMetadata = async (retryCount = 0) => {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    try {
      setMetadataError('');
      // Fetch independent metadata in parallel
      const [classRes, subRes, compRes, typeRes] = await Promise.all([
        fastGet('/exams/classes', undefined, { ttlMs: 60000 }),
        fastGet('/exams/subjects', undefined, { ttlMs: 60000 }),
        fastGet('/exam-config/components', undefined, { ttlMs: 60000 }),
        fastGet('/exams/exam-types', undefined, { ttlMs: 60000 }),
      ]);

      const classList = classRes.data || [];
      const subList = subRes.data || [];
      const compList = compRes.data || [];
      const typeList = typeRes.data || [];

      setClasses(classList);
      setSubjects(subList);
      setComponents(compList);
      setExamTypes(typeList);

      const targetClassId = selectedClassSectionId || (classList.length > 0 ? classList[0].value : '');
      const targetSubId = selectedSubjectId || (subList.length > 0 ? subList[0].id : '');
      const targetComp = selectedSubjectType || (compList.length > 0 ? compList[0].name : 'Theory');
      const targetExam = selectedExamName || (typeList.length > 0 ? typeList[0] : '');

      if (!selectedClassSectionId && targetClassId) setSelectedClassSectionId(targetClassId);
      if (!selectedSubjectId && targetSubId) setSelectedSubjectId(targetSubId);
      if (!selectedSubjectType && targetComp) setSelectedSubjectType(targetComp);
      if (!selectedExamName && targetExam) setSelectedExamName(targetExam);

      const elapsed = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Exam Page] loadMetadata completed: ${elapsed}ms`);
      }

      if (targetClassId && targetSubId && targetExam && targetComp) {
        fetchRoster(targetClassId, targetSubId, targetExam, targetComp);
      }
    } catch (err: any) {
      const elapsed = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
      console.error(`[Exam Page] API ERROR fetchMetadata duration: ${elapsed}ms`, err);
      if (retryCount < 2) {
        setTimeout(() => fetchMetadata(retryCount + 1), 600);
      } else {
        setMetadataError('Failed to load class, subject, or exam metadata. Please check connection and click Retry.');
      }
    } finally {
      setIsInitialLoading(false);
    }
  };

  // Fetch roster when filter changes
  useEffect(() => {
    if (!isInitialLoading && selectedClassSectionId && selectedSubjectId && selectedExamName && selectedSubjectType) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('last_exam_class', selectedClassSectionId);
        sessionStorage.setItem('last_exam_subject', selectedSubjectId);
        sessionStorage.setItem('last_exam_name', selectedExamName);
        sessionStorage.setItem('last_exam_component', selectedSubjectType);
      }
      fetchRoster(selectedClassSectionId, selectedSubjectId, selectedExamName, selectedSubjectType);
    }
  }, [selectedClassSectionId, selectedSubjectId, selectedExamName, selectedSubjectType, isInitialLoading]);

  // Main student roster fetching logic with Request ID & AbortController
  const fetchRoster = async (
    classSectionId?: string,
    subjectId?: string,
    examName?: string,
    subjectType?: string
  ) => {
    const targetClassId = classSectionId || selectedClassSectionId;
    const targetSubId = subjectId || selectedSubjectId;
    const targetExamName = examName || selectedExamName;
    const targetSubType = subjectType || selectedSubjectType;

    if (!targetClassId || !targetSubId || !targetExamName || !targetSubType) {
      setRosterStatus('idle');
      setRoster([]);
      return;
    }

    // Abort previous in-flight READ request to prevent stale response race condition
    if (rosterAbortControllerRef.current) {
      rosterAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    rosterAbortControllerRef.current = abortController;

    const currentRequestId = `${targetClassId}::${targetSubId}::${targetExamName}::${targetSubType}::${Date.now()}`;
    activeRosterRequestIdRef.current = currentRequestId;

    const url = `/exams/marks-entry?classSectionId=${targetClassId}&subjectId=${targetSubId}&examName=${encodeURIComponent(
      targetExamName
    )}&subjectType=${encodeURIComponent(targetSubType)}`;

    setRosterStatus('loading');
    setRosterError('');

    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();

    try {
      const res = await api.get(url, { signal: abortController.signal });

      // Stale request protection: Ignore response if user switched selection in the meantime
      if (activeRosterRequestIdRef.current !== currentRequestId) {
        return;
      }

      const elapsed = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Exam Page] fetchRoster completed in ${elapsed}ms for ${targetExamName}`);
      }

      if (res.data) {
        setRoster(res.data.roster || []);
        if (res.data.config) {
          setExamConfig({
            maxMarks: Number(res.data.config.maxMarks) || 100,
            passingPercentage: Number(res.data.config.passingPercentage) || 35,
            passMarks: res.data.config.passMarks !== undefined && res.data.config.passMarks !== null
              ? Number(res.data.config.passMarks)
              : Number(((Number(res.data.config.passingPercentage || 35) / 100) * (Number(res.data.config.maxMarks) || 100)).toFixed(2)),
          });
        }
      } else {
        setRoster([]);
      }

      setRosterStatus('success');
    } catch (err: any) {
      // If request was intentionally aborted due to newer filter selection, do not trigger error state
      if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        return;
      }

      // Ignore if a newer request is already underway
      if (activeRosterRequestIdRef.current !== currentRequestId) {
        return;
      }

      const elapsed = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
      console.error(`[Exam Page] API ERROR fetchRoster endpoint: ${url} status: ${err.response?.status} duration: ${elapsed}ms`, err);

      const backendMsg = err.response?.data?.message;
      if (backendMsg === 'Exam not found' || err.response?.status === 404) {
        setRosterError('No exam has been configured for the selected Class, Subject, and Exam Term. Please create or configure the exam before entering marks.');
      } else if (backendMsg && backendMsg !== 'Internal server error') {
        setRosterError(backendMsg);
      } else {
        setRosterError('Failed to load students roster for mark entry. Please click Retry.');
      }

      setRoster([]);
      setRosterStatus('error');
    }
  };

  const handleScoreChange = (studentId: string, valStr: string) => {
    setRosterError('');
    if (valStr === '') {
      setRoster(prev =>
        prev.map(item =>
          item.studentId === studentId ? { ...item, marksObtained: null } : item
        )
      );
      return;
    }
    const valNum = Number(valStr);
    if (isNaN(valNum)) return;
    if (valNum < 0) {
      const msg = 'Marks cannot be negative.';
      setRosterError(msg);
      showToast(msg, 'error');
      setPopupAlert({
        show: true,
        title: 'Invalid Marks',
        message: `Marks cannot be negative. Please enter a score between 0 and ${examConfig.maxMarks}.`,
        maxMarks: examConfig.maxMarks,
        enteredValue: valNum,
      });
      return;
    }
    if (valNum > examConfig.maxMarks) {
      const msg = `Marks cannot exceed the configured maximum of ${examConfig.maxMarks}.`;
      setRosterError(msg);
      showToast(msg, 'error');
      setPopupAlert({
        show: true,
        title: 'Maximum Marks Limit Exceeded',
        message: `The entered mark (${valNum}) exceeds the configured maximum of ${examConfig.maxMarks} marks for this exam.`,
        maxMarks: examConfig.maxMarks,
        enteredValue: valNum,
      });
      return;
    }
    setRoster(prev =>
      prev.map(item =>
        item.studentId === studentId ? { ...item, marksObtained: valNum } : item
      )
    );
  };

  const handleIncrement = (studentId: string) => {
    setRosterError('');
    setRoster(prev =>
      prev.map(item => {
        if (item.studentId === studentId) {
          const current = item.marksObtained ?? 0;
          if (current >= examConfig.maxMarks) {
            setPopupAlert({
              show: true,
              title: 'Maximum Score Reached',
              message: `Maximum marks for this subject is ${examConfig.maxMarks}. Score cannot be incremented further.`,
              maxMarks: examConfig.maxMarks,
              enteredValue: current + 1,
            });
            return item;
          }
          return { ...item, marksObtained: Math.min(examConfig.maxMarks, current + 1) };
        }
        return item;
      })
    );
  };

  const handleDecrement = (studentId: string) => {
    setRosterError('');
    setRoster(prev =>
      prev.map(item => {
        if (item.studentId === studentId) {
          const current = item.marksObtained ?? 0;
          return { ...item, marksObtained: Math.max(0, current - 1) };
        }
        return item;
      })
    );
  };

  const handleSaveMarks = async () => {
    if (!selectedClassSectionId || !selectedSubjectId || !selectedExamName) {
      showToast('Please select Class, Subject, and Exam Term before saving.', 'error');
      return;
    }

    // Pre-validate all entries against maximum marks
    const invalidEntry = roster.find(r => r.marksObtained !== null && (r.marksObtained > examConfig.maxMarks || r.marksObtained < 0));
    if (invalidEntry) {
      const msg = `Student ${invalidEntry.name} has invalid marks (${invalidEntry.marksObtained}). Marks must be between 0 and ${examConfig.maxMarks}.`;
      setRosterError(msg);
      showToast(msg, 'error');
      setPopupAlert({
        show: true,
        title: 'Validation Error Before Saving',
        message: msg,
        maxMarks: examConfig.maxMarks,
        enteredValue: invalidEntry.marksObtained ?? undefined,
      });
      return;
    }

    setIsSaving(true);
    setRosterError('');
    try {
      const marksPayload = roster.map(r => ({
        studentId: r.studentId,
        marksObtained: r.marksObtained,
        remarks: r.remarks,
      }));

      await api.post('/exams/save-marks', {
        classSectionId: selectedClassSectionId,
        subjectId: selectedSubjectId,
        examName: selectedExamName,
        marks: marksPayload,
        subjectType: selectedSubjectType,
      });

      setSaveSuccess(true);
      showToast('Scoresheet updated. Ranks and average matrices compiled successfully.', 'success');
      fetchRoster();
      setTimeout(() => {
        setSaveSuccess(false);
      }, 5000);
    } catch (err: any) {
      console.error('Error saving marks:', err);
      const backendMsg = err.response?.data?.message;
      if (backendMsg === 'Exam not found' || err.response?.status === 404) {
        const msg = 'No exam has been configured for the selected Class, Subject, and Exam Term. Please create or configure the exam before entering marks.';
        setRosterError(msg);
        showToast(msg, 'error');
      } else {
        const msg = backendMsg || 'Failed to save scoresheet.';
        setRosterError(msg);
        showToast(msg, 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Grade badge calculator
  const getGradeInfo = (score: number | null) => {
    if (score === null) return { letter: '—', color: 'bg-slate-50 text-slate-400 border-slate-200', result: null };
    const passMarks = examConfig.passMarks !== undefined
      ? examConfig.passMarks
      : Number(((examConfig.passingPercentage / 100) * examConfig.maxMarks).toFixed(2));
    const maxM = examConfig.maxMarks;
    const pct = maxM > 0 ? (score / maxM) * 100 : score;
    const pass = score >= passMarks;
    if (pct >= 90) return { letter: 'A+', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', result: pass };
    if (pct >= 80) return { letter: 'A',  color: 'bg-emerald-50 text-emerald-500 border-emerald-100', result: pass };
    if (pct >= 70) return { letter: 'B+', color: 'bg-blue-50 text-[#2E5BFF] border-blue-100',         result: pass };
    if (pct >= 60) return { letter: 'B',  color: 'bg-slate-50 text-slate-600 border-slate-200',       result: pass };
    if (pct >= 50) return { letter: 'C',  color: 'bg-amber-50 text-amber-600 border-amber-100',       result: pass };
    if (pct >= 35) return { letter: 'D',  color: 'bg-orange-50 text-orange-600 border-orange-100',    result: pass };
    return { letter: 'F', color: 'bg-rose-50 text-rose-600 border-rose-100', result: false };
  };

  // Statistics computations
  const validScores = roster
    .map(r => r.marksObtained)
    .filter((s): s is number => s !== null);

  const classAverage = validScores.length > 0
    ? Math.round(validScores.reduce((sum, val) => sum + val, 0) / validScores.length)
    : 0;

  const highestMarks = validScores.length > 0 ? Math.max(...validScores) : 0;

  // Initial Loading state
  if (isInitialLoading) {
    return (
      <div className="relative space-y-6 max-w-md mx-auto sm:max-w-none pb-20 lg:pb-6">
        {/* Centered Glassmorphic Spinner & Status Card */}
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center min-h-[460px] pointer-events-none">
          <div className="bg-white/95 backdrop-blur-md border border-blue-100/90 shadow-2xl shadow-blue-500/15 rounded-3xl p-6 sm:p-8 flex flex-col items-center gap-4 text-center max-w-sm mx-4 animate-in fade-in zoom-in duration-300">
            <div className="relative flex items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center shadow-inner">
                <LoadingSpinner size="lg" variant="brand" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-600"></span>
              </span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 tracking-tight">Loading Exam Scoring System</h3>
              <p className="text-xs font-medium text-slate-500 mt-1">Preparing student rosters, grading thresholds, and subjects...</p>
            </div>
            <div className="w-36 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full animate-pulse w-3/4"></div>
            </div>
          </div>
        </div>

        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
          <div className="space-y-2">
            <div className="h-7 bg-slate-200 rounded-xl w-56 animate-pulse"></div>
            <div className="h-3.5 bg-slate-100 rounded w-80 animate-pulse"></div>
          </div>
          <div className="flex gap-3">
            <div className="h-10 w-36 bg-slate-100 rounded-xl animate-pulse"></div>
            <div className="h-10 w-36 bg-slate-100 rounded-xl animate-pulse"></div>
          </div>
        </div>

        {/* Selectors card skeleton */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-sm opacity-60 animate-pulse">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-4">
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <div className="h-3 bg-slate-200 rounded w-28"></div>
              <div className="h-10 bg-slate-100 rounded-xl"></div>
            </div>
            <div className="space-y-2 col-span-1 sm:col-span-1">
              <div className="h-3 bg-slate-200 rounded w-24"></div>
              <div className="h-10 bg-slate-100 rounded-xl"></div>
            </div>
            <div className="space-y-2 col-span-1 sm:col-span-1">
              <div className="h-3 bg-slate-200 rounded w-24"></div>
              <div className="h-10 bg-slate-100 rounded-xl"></div>
            </div>
          </div>
        </div>

        {/* 4 KPI cards skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 opacity-60 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 shrink-0"></div>
              <div className="space-y-1.5 flex-1">
                <div className="h-2.5 bg-slate-200 rounded w-16"></div>
                <div className="h-5 bg-slate-100 rounded w-12"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Table skeleton */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm opacity-60 animate-pulse">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <div className="h-4 bg-slate-200 rounded w-48"></div>
            <div className="h-3 bg-slate-200 rounded w-28"></div>
          </div>
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-slate-100">
                <div className="h-4 bg-slate-100 rounded w-16"></div>
                <div className="h-4 bg-slate-200 rounded w-36"></div>
                <div className="h-8 bg-slate-100 rounded-lg w-28"></div>
                <div className="h-6 bg-slate-100 rounded-lg w-32"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in pb-20 lg:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-[24px] sm:text-[28px] font-bold text-slate-900 leading-tight">
            Enter Student Marks
          </h2>
          <p className="text-slate-500 text-xs sm:text-[13px] font-medium mt-1">
            Grade and evaluate student performance in specific examinations.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2.5 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={() => router.push('/dashboard/exams/config')}
            className="col-span-1 px-3 py-2.5 rounded-xl border border-[#2E5BFF]/30 bg-blue-50 hover:bg-blue-100 text-[#2E5BFF] font-semibold text-xs sm:text-[13px] flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer truncate"
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span className="truncate">Exam Configuration</span>
          </button>
          <button
            onClick={() => setIsManageTypesOpen(true)}
            className="col-span-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-[13px] flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer truncate"
          >
            <Settings className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="truncate">Manage Exam Types</span>
          </button>
          <button
            onClick={handleSaveMarks}
            disabled={roster.length === 0 || rosterStatus === 'loading' || isSaving || rosterStatus === 'error'}
            className="col-span-2 sm:col-span-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white font-semibold text-xs sm:text-[13px] flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer w-full sm:w-auto"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 shrink-0" />
                <span>Save Scoresheet</span>
              </>
            )}
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-3 text-sm">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">Scoresheet updated. Ranks and average matrices compiled successfully.</span>
        </div>
      )}

      {/* Metadata Loading Error Banner */}
      {metadataError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3">
            <X className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="font-semibold">{metadataError}</span>
          </div>
          <button
            onClick={() => {
              setMetadataError('');
              fetchMetadata(0);
            }}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Metadata
          </button>
        </div>
      )}

      {/* Roster Loading Error Banner */}
      {rosterError && rosterStatus === 'error' && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3">
            <X className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="font-semibold">{rosterError}</span>
          </div>
          <button
            onClick={() => {
              setRosterError('');
              fetchRoster();
            }}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Loading
          </button>
        </div>
      )}

      {/* Selectors card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-4 text-xs font-bold">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-slate-400 mb-1.5 uppercase tracking-wider">Select Class & Section</label>
            <select
              value={selectedClassSectionId}
              onChange={(e) => setSelectedClassSectionId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold outline-none truncate"
            >
              {classes.map((cls) => (
                <option key={cls.value} value={cls.value}>
                  {cls.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-1 sm:col-span-1 min-w-0">
            <label className="block text-slate-400 mb-1.5 uppercase tracking-wider truncate">Select Subject</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold outline-none truncate"
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-1 sm:col-span-1 min-w-0">
            <label className="block text-slate-400 mb-1.5 uppercase tracking-wider truncate">Select Exam Term</label>
            <select
              value={selectedExamName}
              onChange={(e) => setSelectedExamName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold outline-none truncate"
            >
              {examTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Class Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-5 shadow-sm flex items-center gap-2.5 sm:gap-4 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-[#2E5BFF] flex items-center justify-center font-extrabold text-sm sm:text-base shrink-0">
            📈
          </div>
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate block">Class Average</span>
            <span className="text-base sm:text-xl font-extrabold text-slate-850 block mt-0.5 truncate">{classAverage}%</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-5 shadow-sm flex items-center gap-2.5 sm:gap-4 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-extrabold text-sm sm:text-base shrink-0">
            🏆
          </div>
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate block">Highest Score</span>
            <span className="text-base sm:text-xl font-extrabold text-slate-850 block mt-0.5 truncate">{highestMarks}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-5 shadow-sm flex items-center gap-2.5 sm:gap-4 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-extrabold text-sm sm:text-base shrink-0">
            ✅
          </div>
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate block">Roster Entries</span>
            <span className="text-base sm:text-xl font-extrabold text-slate-850 block mt-0.5 truncate">
              {rosterStatus === 'loading' ? 'Loading...' : `${roster.length} Students`}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-5 shadow-sm flex items-center gap-2.5 sm:gap-4 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-extrabold text-xs sm:text-sm shrink-0">
            {examConfig.passingPercentage}%
          </div>
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate block">Pass Threshold</span>
            <span className="text-xs sm:text-sm font-extrabold text-slate-850 block mt-0.5 leading-tight break-words">
              {examConfig.passMarks !== undefined ? examConfig.passMarks : ((examConfig.passingPercentage / 100) * examConfig.maxMarks).toFixed(1)} / {examConfig.maxMarks} ({examConfig.passingPercentage}%)
            </span>
          </div>
        </div>
      </div>

      {/* Matrix Score table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-700">
            Scoring Matrix: {subjects.find(s => s.id === selectedSubjectId)?.name || 'Subject'} — Max Marks: {examConfig.maxMarks}
          </h3>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            {classes.find(c => c.value === selectedClassSectionId)?.label || ''} · {selectedExamName}
          </span>
        </div>

        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          {/* STATE A: LOADING */}
          {rosterStatus === 'loading' ? (
            <div className="relative min-h-[260px] flex flex-col justify-center">
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/75 backdrop-blur-[2px]">
                <div className="bg-white border border-blue-100 shadow-xl shadow-blue-500/10 rounded-2xl px-6 py-4 flex items-center gap-3.5 animate-in fade-in zoom-in duration-200">
                  <LoadingSpinner size="md" variant="brand" />
                  <div>
                    <div className="text-xs font-bold text-slate-800">Loading Student Scoresheet...</div>
                    <div className="text-[10px] font-medium text-slate-500">Retrieving student roster & existing marks</div>
                  </div>
                </div>
              </div>
              {/* Shimmer skeleton table rows underneath */}
              <div className="p-6 space-y-4 opacity-40 animate-pulse">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex justify-between items-center py-2.5 border-b border-slate-100">
                    <div className="h-3.5 bg-slate-200 rounded w-20"></div>
                    <div className="h-4 bg-slate-300 rounded w-44"></div>
                    <div className="h-8 bg-slate-100 rounded-lg w-32"></div>
                    <div className="h-7 bg-slate-100 rounded-lg w-36"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : rosterStatus === 'error' ? (
            /* STATE B: ERROR (Never show "No students enrolled") */
            <div className="py-16 px-4 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-xs">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <div className="space-y-1 max-w-md">
                <h4 className="text-sm font-bold text-slate-800">Failed to load student roster</h4>
                <p className="text-xs text-slate-500 font-medium">{rosterError || 'An error occurred while fetching student marks roster.'}</p>
              </div>
              <button
                onClick={() => {
                  setRosterError('');
                  fetchRoster();
                }}
                className="mt-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry Loading Roster</span>
              </button>
            </div>
          ) : rosterStatus === 'success' && roster.length === 0 ? (
            /* STATE C: SUCCESS WITH 0 RECORDS */
            <div className="py-16 text-center text-slate-400 text-xs font-semibold">
              No students enrolled in the selected class and section.
            </div>
          ) : (
            /* STATE D: SUCCESS WITH RECORDS */
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <th className="px-6 py-4" style={{ width: '150px' }}>Roll Number</th>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4 text-center" style={{ width: '220px' }}>Score Obtained</th>
                  <th className="px-6 py-4 text-right">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-650 font-semibold">
                {roster.map((s) => {
                  const mark = s.marksObtained;
                  const gr = getGradeInfo(mark);
                  return (
                    <tr key={s.studentId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-500">{s.rollNo}</td>
                      <td className="px-6 py-4 font-bold text-slate-800 text-sm leading-tight">{s.name}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => handleDecrement(s.studentId)}
                            className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 hover:text-rose-600 cursor-pointer"
                          >
                            <MinusCircle className="w-4.5 h-4.5 text-slate-450" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            max={examConfig.maxMarks}
                            value={mark === null ? '' : mark}
                            onChange={(e) => handleScoreChange(s.studentId, e.target.value)}
                            className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-mono text-xs text-slate-800 font-extrabold focus:outline-none focus:border-blue-600"
                          />
                          <button
                            onClick={() => handleIncrement(s.studentId)}
                            className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 hover:text-emerald-600 cursor-pointer"
                          >
                            <PlusCircle className="w-4.5 h-4.5 text-slate-450" />
                          </button>

                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${gr.color}`}>
                            {gr.letter}
                          </span>
                          {gr.result !== null && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              gr.result
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {gr.result ? 'PASS' : 'FAIL'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <input
                          type="text"
                          placeholder="Add remark..."
                          value={s.remarks || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRoster(prev =>
                              prev.map(item =>
                                item.studentId === s.studentId ? { ...item, remarks: val } : item
                              )
                            );
                          }}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 text-xs text-slate-700 w-44 font-semibold focus:outline-none focus:border-blue-600"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Manage Exam Types Modal */}
      {isManageTypesOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in space-y-0 text-slate-800">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-blue-600" />
                <h2 className="text-[16px] font-bold text-slate-900">Manage Exam Types</h2>
              </div>
              <button
                onClick={() => setIsManageTypesOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-[18px] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {typeError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl font-semibold">
                  {typeError}
                </div>
              )}

              {/* Create Form */}
              <form onSubmit={handleCreateType} className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Pre-Final Exam"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-600"
                  disabled={isSavingType}
                />
                <button
                  type="submit"
                  disabled={isSavingType || !newTypeName.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-bold text-xs cursor-pointer"
                >
                  Add Type
                </button>
              </form>

              {/* List of Types */}
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-[220px] overflow-y-auto bg-slate-50/20">
                {manageTypesList.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs italic">
                    Loading exam types...
                  </div>
                ) : (
                  manageTypesList.map((t) => (
                    <div key={t.id} className="p-3 flex items-center justify-between gap-3 text-xs font-semibold">
                      {editingTypeId === t.id ? (
                        <div className="flex-1 flex gap-2">
                          <input
                            type="text"
                            value={editingTypeName}
                            onChange={(e) => setEditingTypeName(e.target.value)}
                            className="flex-1 bg-white border border-slate-350 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-semibold focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateType(t.id)}
                            className="text-emerald-600 hover:text-emerald-700 cursor-pointer font-bold"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTypeId(null)}
                            className="text-slate-400 hover:text-slate-500 cursor-pointer font-bold"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-slate-800">{t.name}</span>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTypeId(t.id);
                                setEditingTypeName(t.name);
                              }}
                              className="text-slate-500 hover:text-blue-600 cursor-pointer font-bold"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteType(t.id)}
                              className="text-slate-400 hover:text-rose-600 cursor-pointer font-bold"
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Validation Error Popup Modal */}
      {popupAlert.show && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-rose-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 text-slate-800">
            {/* Header */}
            <div className="p-6 pb-4 flex items-start justify-between gap-4 border-b border-rose-100 bg-rose-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 shadow-xs">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-rose-900 leading-tight">
                    {popupAlert.title || 'Validation Alert'}
                  </h3>
                  <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">
                    Score Limit Exceeded
                  </span>
                </div>
              </div>
              <button
                onClick={() => setPopupAlert(prev => ({ ...prev, show: false }))}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-white/80 transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-xs font-semibold text-slate-650 leading-relaxed">
                {popupAlert.message}
              </p>

              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2.5 text-xs font-semibold">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Configured Maximum Marks:</span>
                  <span className="font-extrabold text-slate-900 bg-slate-200/80 px-2.5 py-0.5 rounded-lg text-xs font-mono">
                    {popupAlert.maxMarks ?? examConfig.maxMarks}
                  </span>
                </div>
                {popupAlert.enteredValue !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-rose-600 font-bold">Entered Marks:</span>
                    <span className="font-extrabold text-rose-700 bg-rose-100 border border-rose-200 px-2.5 py-0.5 rounded-lg text-xs font-mono">
                      {popupAlert.enteredValue}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="text-slate-500">Passing Threshold:</span>
                  <span className="font-bold text-slate-700">
                    {examConfig.passMarks !== undefined
                      ? `${examConfig.passMarks} / ${popupAlert.maxMarks ?? examConfig.maxMarks} (${examConfig.passingPercentage}%)`
                      : `${((examConfig.passingPercentage / 100) * examConfig.maxMarks).toFixed(1)} / ${examConfig.maxMarks} (${examConfig.passingPercentage}%)`}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setPopupAlert(prev => ({ ...prev, show: false }))}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer text-center"
              >
                Understood, Fix Marks
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
