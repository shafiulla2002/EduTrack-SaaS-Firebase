'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Award, FileText, CheckCircle, Save, Plus, ArrowRight, X,
  PlusCircle, MinusCircle, Info, TrendingUp, Sparkles, RefreshCw, Settings, AlertTriangle
} from 'lucide-react';
import { api, fastGet } from '@/lib/api';
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

export default function ExamsAndMarksPage() {
  const router = useRouter();
  const { showToast } = useToast();
  // Metadata options
  const [classes, setClasses] = useState<ClassSectionOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [examTypes, setExamTypes] = useState<string[]>([]);

  // Selection states
  const [selectedClassSectionId, setSelectedClassSectionId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedExamName, setSelectedExamName] = useState('');
  const [selectedSubjectType, setSelectedSubjectType] = useState('');
  const [components, setComponents] = useState<any[]>([]);

  // Roster & marks list
  const [roster, setRoster] = useState<StudentMarkRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
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

  // Exam configuration (pass % and max marks from ExamConfigService)
  const [examConfig, setExamConfig] = useState<{ passingPercentage: number; maxMarks: number; passMarks?: number }>(
    { passingPercentage: 35, maxMarks: 100, passMarks: 35 },
  );

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
      await fetchMetadata(); // Refresh parent dropdown options!
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
      await fetchMetadata(); // Refresh parent dropdown options!
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
      await fetchMetadata(); // Refresh parent dropdown options!
    } catch (err: any) {
      setTypeError(err.response?.data?.message || 'Failed to delete exam type.');
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  const fetchMetadata = async () => {
    try {
      // Fetch all independent metadata in parallel with caching
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

      const defaultClassId = classList.length > 0 ? classList[0].value : '';
      const defaultSubId = subList.length > 0 ? subList[0].id : '';
      const defaultComp = compList.length > 0 ? compList[0].name : 'Theory';
      const defaultExam = typeList.length > 0 ? typeList[0] : '';

      if (defaultClassId) setSelectedClassSectionId(defaultClassId);
      if (defaultSubId) setSelectedSubjectId(defaultSubId);
      if (defaultComp) setSelectedSubjectType(defaultComp);
      if (defaultExam) setSelectedExamName(defaultExam);

      if (defaultClassId && defaultSubId && defaultExam && defaultComp) {
        fetchRoster(defaultClassId, defaultSubId, defaultExam, defaultComp);
      }
    } catch (err: any) {
      console.error('Error fetching exams metadata:', err);
      setErrorMsg('Failed to load class, subject, or exam metadata.');
    }
  };

  // Re-fetch exam config when exam name, class, subject, or component changes
  useEffect(() => {
    if (!selectedExamName) return;
    const params: any = { examType: selectedExamName };
    if (selectedClassSectionId) params.classSectionId = selectedClassSectionId;
    if (selectedSubjectId) params.subjectId = selectedSubjectId;
    if (selectedSubjectType) params.subjectType = selectedSubjectType;
    const subObj = subjects.find(s => s.id === selectedSubjectId);
    if (subObj?.name) params.subjectName = subObj.name;
    
    fastGet('/exam-config/resolve', { params }, { ttlMs: 60000 })
      .then(res => {
        if (res.data) {
          setExamConfig({
            passingPercentage: res.data.passingPercentage,
            maxMarks: res.data.maxMarks,
            passMarks: res.data.passMarks,
          });
        }
      })
      .catch(() => {});
  }, [selectedExamName, selectedClassSectionId, selectedSubjectId, selectedSubjectType, subjects]);

  useEffect(() => {
    if (selectedClassSectionId && selectedSubjectId && selectedExamName && selectedSubjectType) {
      fetchRoster(selectedClassSectionId, selectedSubjectId, selectedExamName, selectedSubjectType);
    }
  }, [selectedClassSectionId, selectedSubjectId, selectedExamName, selectedSubjectType]);

  const fetchRoster = async (classSectionId?: string, subjectId?: string, examName?: string, subjectType?: string) => {
    const targetClassId = classSectionId || selectedClassSectionId;
    const targetSubId = subjectId || selectedSubjectId;
    const targetExamName = examName || selectedExamName;
    const targetSubType = subjectType || selectedSubjectType;

    if (!targetClassId || !targetSubId || !targetExamName || !targetSubType) return;

    setErrorMsg('');
    try {
      const res = await fastGet(
        `/exams/marks-entry?classSectionId=${targetClassId}&subjectId=${targetSubId}&examName=${encodeURIComponent(
          targetExamName
        )}&subjectType=${encodeURIComponent(targetSubType)}`,
        undefined,
        {
          ttlMs: 30000,
          onRevalidate: (fresh) => {
            if (fresh?.roster) setRoster(fresh.roster);
            if (fresh?.config) setExamConfig(fresh.config);
          }
        }
      );
      if (!res.isFromCache) {
        setIsLoading(false);
      }
      if (res.data) {
        setRoster(res.data.roster || []);
        if (res.data.config) {
          setExamConfig(res.data.config);
        }
      }
    } catch (err: any) {
      console.error('Error fetching marks entry list:', err);
      const backendMsg = err.response?.data?.message;
      if (backendMsg === 'Exam not found' || err.response?.status === 404) {
        setErrorMsg('No exam has been configured for the selected Class, Subject, and Exam Term. Please create or configure the exam before entering marks.');
      } else {
        setErrorMsg(backendMsg || 'Failed to load students roster for mark entry.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleScoreChange = (studentId: string, valStr: string) => {
    setErrorMsg('');
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
      setErrorMsg(msg);
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
      setErrorMsg(msg);
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
    setErrorMsg('');
    setRoster(prev =>
      prev.map(item => {
        if (item.studentId === studentId) {
          const cur = item.marksObtained === null ? 0 : item.marksObtained;
          if (cur + 1 > examConfig.maxMarks) {
            const msg = `Marks cannot exceed the configured maximum of ${examConfig.maxMarks}.`;
            setErrorMsg(msg);
            showToast(msg, 'error');
            setPopupAlert({
              show: true,
              title: 'Maximum Marks Limit Exceeded',
              message: `Increasing marks (${cur + 1}) exceeds the configured maximum limit of ${examConfig.maxMarks} marks for this exam.`,
              maxMarks: examConfig.maxMarks,
              enteredValue: cur + 1,
            });
            return item;
          }
          return { ...item, marksObtained: cur + 1 };
        }
        return item;
      })
    );
  };

  const handleDecrement = (studentId: string) => {
    setErrorMsg('');
    setRoster(prev =>
      prev.map(item => {
        if (item.studentId === studentId) {
          const cur = item.marksObtained === null ? 0 : item.marksObtained;
          return { ...item, marksObtained: Math.max(0, cur - 1) };
        }
        return item;
      })
    );
  };

  const handleSaveMarks = async () => {
    setErrorMsg('');
    setSaveSuccess(false);

    // Frontend validation before submission
    for (const item of roster) {
      if (item.marksObtained !== null && item.marksObtained !== undefined) {
        if (item.marksObtained < 0) {
          const msg = 'Marks cannot be negative.';
          setErrorMsg(msg);
          showToast(msg, 'error');
          setPopupAlert({
            show: true,
            title: 'Invalid Marks Found',
            message: `Student "${item.name}" (Roll: ${item.rollNo}) has negative marks (${item.marksObtained}). Marks cannot be negative.`,
            maxMarks: examConfig.maxMarks,
            enteredValue: item.marksObtained,
          });
          return;
        }
        if (item.marksObtained > examConfig.maxMarks) {
          const msg = `Marks cannot exceed the configured maximum of ${examConfig.maxMarks}.`;
          setErrorMsg(msg);
          showToast(msg, 'error');
          setPopupAlert({
            show: true,
            title: 'Maximum Marks Exceeded',
            message: `Marks entered for "${item.name}" (Roll: ${item.rollNo}) (${item.marksObtained}) exceed the configured maximum limit of ${examConfig.maxMarks}.`,
            maxMarks: examConfig.maxMarks,
            enteredValue: item.marksObtained,
          });
          return;
        }
      }
    }

    try {
      const marksPayload = roster.map(item => ({
        studentId: item.studentId,
        marksObtained: item.marksObtained === null ? 0 : item.marksObtained,
        remarks: item.remarks || '',
      }));

      await api.post('/exams/save-marks', {
        marks: marksPayload,
        examName: selectedExamName,
        classSectionId: selectedClassSectionId,
        subjectId: selectedSubjectId,
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
        setErrorMsg(msg);
        showToast(msg, 'error');
      } else {
        const msg = backendMsg || 'Failed to save scoresheet.';
        setErrorMsg(msg);
        showToast(msg, 'error');
      }
    }
  };

  // Grade badge – uses configured pass marks & percentages
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

  // Compute stats
  const validScores = roster
    .map(r => r.marksObtained)
    .filter((s): s is number => s !== null);

  const classAverage = validScores.length > 0
    ? Math.round(validScores.reduce((sum, val) => sum + val, 0) / validScores.length)
    : 0;

  const highestMarks = validScores.length > 0 ? Math.max(...validScores) : 0;

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-[28px] font-bold text-slate-900 leading-none">
            Enter Student Marks
          </h2>
          <p className="text-slate-500 text-[13px] font-medium mt-2">
            Grade and evaluate student performance in specific examinations.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => router.push('/dashboard/exams/config')}
            className="px-4 py-2.5 rounded-xl border border-[#2E5BFF]/30 bg-blue-50 hover:bg-blue-100 text-[#2E5BFF] font-semibold text-[13px] flex items-center gap-2 transition-all shadow-xs cursor-pointer"
          >
            <Settings className="w-4 h-4" />
            Exam Configuration
          </button>
          <button
            onClick={() => setIsManageTypesOpen(true)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[13px] flex items-center gap-2 transition-all shadow-xs cursor-pointer"
          >
            <Settings className="w-4 h-4 text-slate-500" />
            Manage Exam Types
          </button>
          <button
            onClick={handleSaveMarks}
            disabled={roster.length === 0 || isLoading || !!errorMsg}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white font-semibold text-[13px] flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Save Scoresheet
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-3 text-sm">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">Scoresheet updated. Ranks and average matrices compiled successfully.</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3 text-sm">
          <X className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* Selectors card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-bold">
          <div>
            <label className="block text-slate-400 mb-1.5 uppercase tracking-wider">Select Class & Section</label>
            <select
              value={selectedClassSectionId}
              onChange={(e) => setSelectedClassSectionId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold outline-none"
            >
              {classes.map((cls) => (
                <option key={cls.value} value={cls.value}>
                  {cls.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-slate-400 mb-1.5 uppercase tracking-wider">Select Subject</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold outline-none"
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-slate-400 mb-1.5 uppercase tracking-wider">Select Exam Term</label>
            <select
              value={selectedExamName}
              onChange={(e) => setSelectedExamName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold outline-none"
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2E5BFF] flex items-center justify-center font-extrabold">
            📈
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Class Average</span>
            <span className="text-xl font-extrabold text-slate-850 block mt-0.5">{classAverage}%</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-extrabold">
            🏆
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Highest Score</span>
            <span className="text-xl font-extrabold text-slate-850 block mt-0.5">{highestMarks}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-extrabold">
            ✅
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Roster Entries</span>
            <span className="text-xl font-extrabold text-slate-850 block mt-0.5">{roster.length} Students</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-extrabold text-sm">{examConfig.passingPercentage}%</div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pass Threshold</span>
            <span className="text-sm font-extrabold text-slate-850 block mt-0.5">
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
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin" />
              <span className="text-xs font-semibold">Loading student list...</span>
            </div>
          ) : roster.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs font-semibold">
              No students enrolled in the selected class and section.
            </div>
          ) : (
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
                            className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 hover:text-rose-600"
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
                            className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 hover:text-emerald-600"
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
