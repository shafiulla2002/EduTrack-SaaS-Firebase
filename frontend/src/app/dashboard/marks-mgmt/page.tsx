'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { Award, FileText, CheckCircle2, AlertTriangle, RefreshCcw, Save } from 'lucide-react';
import { useFloatingBarPadding } from '@/hooks/useFloatingBarPadding';

export default function MarksMgmtPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [examTypes, setExamTypes] = useState<any[]>([]);

  // Selection states
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedSubjectType, setSelectedSubjectType] = useState('');
  const [components, setComponents] = useState<any[]>([]);
  const [examConfig, setExamConfig] = useState<{ maxMarks: number; passingPercentage: number }>({ maxMarks: 100, passingPercentage: 35 });

  // UI state
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Auto save state
  const [saving, setSaving] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState('All changes saved');

  const { barRef, contentPaddingBottom } = useFloatingBarPadding({ visible: students.length > 0 });
  
  // Local marks state
  const [marksSheet, setMarksSheet] = useState<{ [studentId: string]: { score: string; remarks: string } }>({});

  // Reference to debounce timer
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [clsRes, subRes, examRes, compRes] = await Promise.all([
          api.get('/teacher-portal/classes'),
          api.get('/exams/subjects'),
          api.get('/exams/exam-types'),
          api.get('/exam-config/components'),
        ]);
        setClasses(clsRes.data);
        setSubjects(subRes.data);
        setExamTypes(examRes.data);
        setComponents(compRes.data);
        if (compRes.data.length > 0) setSelectedSubjectType(compRes.data[0].name);
        else setSelectedSubjectType('Theory');
      } catch (err) {
        console.error('Failed to load initial data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleLoadRoster = async () => {
    if (!selectedClass || !selectedSubject || !selectedExam) return;
    setLoadingStudents(true);
    setMessage({ type: '', text: '' });
    try {
      // Find classSectionId from selectedClass
      const cls = classes.find(c => c.classSectionId === selectedClass);
      const res = await api.get(`/teacher-portal/marks/entry?subjectId=${selectedSubject}&examName=${encodeURIComponent(selectedExam)}&classSectionId=${selectedClass}&subjectType=${encodeURIComponent(selectedSubjectType)}`);
      setStudents(res.data.roster || res.data);
      if (res.data.config) setExamConfig(res.data.config);

      const initialSheet: { [id: string]: { score: string; remarks: string } } = {};
      const rosterData = res.data.roster || res.data;
      rosterData.forEach((s: any) => {
        initialSheet[s.studentId] = {
          score: s.marksObtained !== null ? String(s.marksObtained) : '',
          remarks: s.remarks || '',
        };
      });
      setMarksSheet(initialSheet);
      setAutosaveStatus('All changes saved');
    } catch (err: any) {
      console.error('Failed to load roster:', err);
      const errMsg = err.response?.data?.message || 'Failed to load class marks roster.';
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setLoadingStudents(false);
    }
  };

  // Trigger auto-save
  const triggerAutoSave = (updatedSheet: typeof marksSheet) => {
    setAutosaveStatus('Saving...');
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      // Build marks array payload
      const marksPayload = Object.keys(updatedSheet)
        .filter(studentId => updatedSheet[studentId].score !== '')
        .map(studentId => {
          const scoreNum = parseFloat(updatedSheet[studentId].score);
          return {
            studentId,
            marksObtained: isNaN(scoreNum) ? 0 : scoreNum,
            remarks: updatedSheet[studentId].remarks,
          };
        });

      if (marksPayload.length === 0) {
        setAutosaveStatus('All changes saved');
        return;
      }

      try {
        await api.post('/teacher-portal/marks/save', {
          marks: marksPayload,
          examName: selectedExam,
          classSectionId: selectedClass,
          subjectId: selectedSubject,
          subjectType: selectedSubjectType,
        });
        setAutosaveStatus('All changes saved');
      } catch (err) {
        console.error('Auto save error:', err);
        setAutosaveStatus('Failed to auto-save');
      }
    }, 2000); // 2 seconds debounce delay
  };

  const handleMarkChange = (studentId: string, value: string) => {
    // Basic validation: max marks
    const valNum = parseFloat(value);
    if (!isNaN(valNum) && (valNum < 0 || valNum > examConfig.maxMarks)) {
      alert(`Score must be between 0 and ${examConfig.maxMarks}.`);
      return;
    }

    const updated = {
      ...marksSheet,
      [studentId]: {
        ...marksSheet[studentId],
        score: value,
      },
    };
    setMarksSheet(updated);
    triggerAutoSave(updated);
  };

  const handleRemarksChange = (studentId: string, value: string) => {
    const updated = {
      ...marksSheet,
      [studentId]: {
        ...marksSheet[studentId],
        remarks: value,
      },
    };
    setMarksSheet(updated);
    triggerAutoSave(updated);
  };

  const handleManualSave = async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setSaving(true);
    setAutosaveStatus('Saving...');
    try {
      const marksPayload = Object.keys(marksSheet)
        .filter(studentId => marksSheet[studentId].score !== '')
        .map(studentId => {
          const scoreNum = parseFloat(marksSheet[studentId].score);
          return {
            studentId,
            marksObtained: isNaN(scoreNum) ? 0 : scoreNum,
            remarks: marksSheet[studentId].remarks,
          };
        });

      await api.post('/teacher-portal/marks/save', {
        marks: marksPayload,
        examName: selectedExam,
        classSectionId: selectedClass,
        subjectId: selectedSubject,
        subjectType: selectedSubjectType,
      });
      setAutosaveStatus('All changes saved');
      setMessage({ type: 'success', text: 'All marks saved successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    } catch (err) {
      console.error('Manual save error:', err);
      setAutosaveStatus('Failed to save changes');
      setMessage({ type: 'error', text: 'Failed to save marks. Check network connection.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-md mx-auto sm:max-w-none">
        {/* Filter form skeleton */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4 animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/4"></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-10 bg-slate-200 rounded-xl"></div>
            <div className="h-10 bg-slate-200 rounded-xl"></div>
          </div>
          <div className="h-10 bg-slate-200 rounded-xl"></div>
        </div>
        {/* Student cards skeleton */}
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3 animate-pulse">
            <div className="flex justify-between">
              <div className="space-y-2">
                <div className="h-4 bg-slate-200 rounded w-36"></div>
                <div className="h-3 bg-slate-200 rounded w-20"></div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="h-10 bg-slate-200 rounded-xl"></div>
              <div className="col-span-2 h-10 bg-slate-200 rounded-xl"></div>
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
          <Award className="w-6 h-6 text-[#2E5BFF]" />
          Enter Student Marks
        </h2>
      </div>

      {message.text && (
        <div className={`p-3.5 rounded-2xl border text-xs font-bold ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
          'bg-rose-50 text-rose-700 border-rose-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Select Filters Form */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Class Section</label>
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setSelectedSubject('');
                setStudents([]);
              }}
              className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-sm"
            >
              <option value="">Select...</option>
              {Array.from(new Map(classes.map(c => [c.classSectionId, c.className])).entries()).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Subject</label>
              <select
                value={selectedSubject}
                onChange={(e) => {
                  setSelectedSubject(e.target.value);
                  setStudents([]);
                }}
                disabled={!selectedClass}
                className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Select...</option>
                {classes
                  .filter(c => c.classSectionId === selectedClass)
                  .map(c => (
                    <option key={c.subjectId} value={c.subjectId}>
                      {c.subjectName}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Exam Type</label>
              <select
                value={selectedExam}
                onChange={(e) => {
                  setSelectedExam(e.target.value);
                  setStudents([]);
                }}
                className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-sm"
              >
                <option value="">Select...</option>
                {examTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Component</label>
              <select
                value={selectedSubjectType}
                onChange={(e) => {
                  setSelectedSubjectType(e.target.value);
                  setStudents([]);
                }}
                className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-sm"
              >
                {components.length > 0 ? components.map(c => <option key={c.id} value={c.name}>{c.name}</option>) : <option value="Theory">Theory</option>}
              </select>
            </div>
          </div>
        </div>

        <button
          onClick={handleLoadRoster}
          disabled={!selectedClass || !selectedSubject || !selectedExam || loadingStudents}
          className="w-full py-3 bg-[#2E5BFF] hover:bg-blue-600 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/10 cursor-pointer disabled:opacity-50"
        >
          {loadingStudents ? 'Loading Students...' : '🔍 Load Students'}
        </button>
      </div>

      {/* Roster list */}
      {students.length > 0 && (
        <div className="space-y-4">
          
          {/* Status Indicator */}
          <div className="bg-slate-100 p-3 rounded-2xl flex justify-between items-center text-xs font-bold text-slate-600">
            <span className="flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-slate-400" />
              {students.length} Students Loaded
            </span>
            <span className={`px-2 py-0.5 rounded-lg text-[10px] text-white uppercase ${
              autosaveStatus === 'Saving...' ? 'bg-amber-500' :
              autosaveStatus === 'Failed to auto-save' ? 'bg-rose-500' :
              'bg-emerald-500'
            }`}>
              {autosaveStatus}
            </span>
          </div>

          {/* Cards */}
          <div className="space-y-3" style={{ paddingBottom: contentPaddingBottom }}>
            {students.map((s) => (
              <div key={s.studentId} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-800 text-[14px]">{s.name}</h4>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">Roll: {s.rollNo}</p>
                  </div>
                  {s.hasMarks && (
                    <span className="bg-blue-50 text-blue-600 text-[9px] font-black uppercase px-2 py-0.5 rounded border border-blue-100">
                      Saved
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3 items-center">
                  <div className="col-span-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Score (Max {examConfig.maxMarks})</label>
                    <input
                      type="number"
                      min={0}
                      max={examConfig.maxMarks}
                      value={marksSheet[s.studentId]?.score || ''}
                      onChange={(e) => handleMarkChange(s.studentId, e.target.value)}
                      placeholder="--"
                      className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-sm font-bold text-center"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Remarks</label>
                    <input
                      type="text"
                      value={marksSheet[s.studentId]?.remarks || ''}
                      onChange={(e) => handleRemarksChange(s.studentId, e.target.value)}
                      placeholder="Good performance, needs work..."
                      className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Sticky Manual Save trigger */}
          <div ref={barRef} className="fixed bottom-16 lg:bottom-4 left-0 right-0 p-4 bg-transparent z-40 max-w-md mx-auto sm:max-w-7xl flex justify-end pointer-events-none">
            <button
              onClick={handleManualSave}
              disabled={saving}
              className="pointer-events-auto flex items-center gap-2 px-6 py-3.5 bg-[#2E5BFF] text-white hover:bg-blue-600 font-bold rounded-full text-xs shadow-2xl transition-all cursor-pointer transform hover:scale-105"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Marks'}
            </button>
          </div>

        </div>
      )}

      {students.length === 0 && (
        <div className="bg-white py-12 text-center text-slate-400 text-xs font-semibold rounded-3xl border border-slate-200 shadow-sm px-6">
          {!selectedClass || !selectedSubject || !selectedExam ? (
            <p className="text-slate-500">Please select a Class Section and Subject to continue.</p>
          ) : (
            <p className="text-slate-500">Click &ldquo;Load Students&rdquo; to fetch the student listing.</p>
          )}
        </div>
      )}

    </div>
  );
}
