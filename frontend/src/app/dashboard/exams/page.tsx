'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Award, FileText, CheckCircle, Save, Plus, ArrowRight, X,
  PlusCircle, MinusCircle, Info, TrendingUp, Sparkles, RefreshCw, Settings
} from 'lucide-react';
import { api } from '@/lib/api';

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

  // Manage Exam Types State
  const [isManageTypesOpen, setIsManageTypesOpen] = useState(false);
  const [manageTypesList, setManageTypesList] = useState<any[]>([]);
  const [newTypeName, setNewTypeName] = useState('');
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeName, setEditingTypeName] = useState('');
  const [isSavingType, setIsSavingType] = useState(false);
  const [typeError, setTypeError] = useState('');

  // Exam configuration (pass % from ExamConfigService)
  const [examConfig, setExamConfig] = useState<{ passingPercentage: number; maxMarks: number }>(
    { passingPercentage: 35, maxMarks: 100 },
  );

  // Fetch types for management modal
  const fetchManageTypes = async () => {
    try {
      const res = await api.get('/exams/exam-types/manage');
      setManageTypesList(res.data);
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
      const classRes = await api.get('/exams/classes');
      setClasses(classRes.data);
      if (classRes.data.length > 0) {
        setSelectedClassSectionId(classRes.data[0].value);
      }

      const subRes = await api.get('/exams/subjects');
      setSubjects(subRes.data);
      if (subRes.data.length > 0) {
        setSelectedSubjectId(subRes.data[0].id);
      }

      const compRes = await api.get('/exam-config/components');
      setComponents(compRes.data);
      if (compRes.data.length > 0) {
        setSelectedSubjectType(compRes.data[0].name);
      } else {
        setSelectedSubjectType('Theory');
      }

      const typeRes = await api.get('/exams/exam-types');
      setExamTypes(typeRes.data);
      if (typeRes.data.length > 0) {
        setSelectedExamName(typeRes.data[0]);
        // Fetch config for first exam type
        try {
          const cfgRes = await api.get(`/exam-config/resolve?examType=${encodeURIComponent(typeRes.data[0])}`);
          setExamConfig({ passingPercentage: cfgRes.data.passingPercentage, maxMarks: cfgRes.data.maxMarks });
        } catch {}
      }
    } catch (err: any) {
      console.error('Error fetching exams metadata:', err);
      setErrorMsg('Failed to load class, subject, or exam metadata.');
    }
  };

  // Re-fetch exam config when exam name changes
  useEffect(() => {
    if (!selectedExamName) return;
    api.get(`/exam-config/resolve?examType=${encodeURIComponent(selectedExamName)}`)
      .then(res => setExamConfig({ passingPercentage: res.data.passingPercentage, maxMarks: res.data.maxMarks }))
      .catch(() => {});
  }, [selectedExamName]);

  useEffect(() => {
    if (selectedClassSectionId && selectedSubjectId && selectedExamName && selectedSubjectType) {
      fetchRoster();
    }
  }, [selectedClassSectionId, selectedSubjectId, selectedExamName, selectedSubjectType]);

  const fetchRoster = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await api.get(
        `/exams/marks-entry?classSectionId=${selectedClassSectionId}&subjectId=${selectedSubjectId}&examName=${encodeURIComponent(
          selectedExamName
        )}&subjectType=${encodeURIComponent(selectedSubjectType)}`
      );
      setRoster(res.data.roster || []);
      if (res.data.config) {
        setExamConfig(res.data.config);
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
    const valNum = valStr === '' ? null : Number(valStr);
    const val = valNum === null ? null : isNaN(valNum) ? 0 : Math.min(100, Math.max(0, valNum));
    
    setRoster(prev =>
      prev.map(item =>
        item.studentId === studentId ? { ...item, marksObtained: val } : item
      )
    );
  };

  const handleIncrement = (studentId: string) => {
    setRoster(prev =>
      prev.map(item => {
        if (item.studentId === studentId) {
          const cur = item.marksObtained === null ? 0 : item.marksObtained;
          return { ...item, marksObtained: Math.min(examConfig.maxMarks, cur + 1) };
        }
        return item;
      })
    );
  };

  const handleDecrement = (studentId: string) => {
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
      fetchRoster();
      setTimeout(() => {
        setSaveSuccess(false);
      }, 5000);
    } catch (err: any) {
      console.error('Error saving marks:', err);
      const backendMsg = err.response?.data?.message;
      if (backendMsg === 'Exam not found' || err.response?.status === 404) {
        setErrorMsg('No exam has been configured for the selected Class, Subject, and Exam Term. Please create or configure the exam before entering marks.');
      } else {
        setErrorMsg(backendMsg || 'Failed to save scoresheet.');
      }
    }
  };

  // Grade badge – uses configured pass percentage
  const getGradeInfo = (score: number | null) => {
    if (score === null) return { letter: '—', color: 'bg-slate-50 text-slate-400 border-slate-200', result: null };
    const passPct = examConfig.passingPercentage;
    const maxM = examConfig.maxMarks;
    const pct = maxM > 0 ? (score / maxM) * 100 : score;
    const pass = pct >= passPct;
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
            <span className="text-sm font-extrabold text-slate-850 block mt-0.5">{examConfig.passingPercentage}% of {examConfig.maxMarks}</span>
          </div>
        </div>
      </div>

      {/* Matrix Score table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-700">
            Scoring Matrix: {subjects.find(s => s.id === selectedSubjectId)?.name || 'Subject'} — Max Marks: 100
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
    </div>
  );
}
