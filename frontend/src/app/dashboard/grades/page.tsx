'use client';

import React, { useState, useEffect } from 'react';
import { 
  Award, Search, Calendar, RefreshCw, X, ChevronRight,
  TrendingUp, CheckCircle, AlertTriangle, Trophy, BookOpen,
  Download, Printer
} from 'lucide-react';
import { api } from '@/lib/api';
import { useTenant } from '../../providers/TenantContext';
import { PDFService } from '@/lib/pdf';
import { PDFLayout } from '@/components/PDFLayout';

interface GradeRecord {
  studentId: string;
  name: string;
  rollNo: string;
  classSectionId: string;
  score: number;
  average: number;
  grade: string;
  gpa: number;
  rank: number;
  subjectsList: { name: string; score: number; max: number }[];
}

type ClassSectionOption = {
  value: string;
  label: string;
  classId: string;
  sectionId: string;
};

export default function GradesMarksPage() {
  const [search, setSearch] = useState('');
  const { schoolName } = useTenant();
  
  // Metadata options
  const [classes, setClasses] = useState<ClassSectionOption[]>([]);
  const [examTypes, setExamTypes] = useState<string[]>([]);

  // Selection filters
  const [selectedClassSectionId, setSelectedClassSectionId] = useState('');
  const [selectedExamName, setSelectedExamName] = useState('');

  // Results list
  const [records, setRecords] = useState<GradeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Modal Student Details
  const [activeReportStudent, setActiveReportStudent] = useState<GradeRecord | null>(null);

  const handleExportPDF = async (student: GradeRecord) => {
    const element = document.getElementById(`report-card-print-${student.studentId}`);
    if (!element) return;

    setIsGeneratingPDF(true);
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const safeStudentName = student.name.replace(/[^a-zA-Z0-9]/g, '_');
      const safeClassName = classLabel.replace(/[^a-zA-Z0-9]/g, '_');
      const safeExamName = selectedExamName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `ReportCard_${safeStudentName}_${safeClassName}_${safeExamName}_${dateStr}`;

      await PDFService.export({
        element,
        filename,
        metadata: {
          title: `Report Card for ${student.name}`,
          author: schoolName,
          subject: `${selectedExamName} Evaluation`,
          keywords: 'Report Card, Student Performance, Grades',
        },
      });
    } catch (err: any) {
      console.error('Failed to generate PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Lock body scroll when report card modal is open
  useEffect(() => {
    if (activeReportStudent) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [activeReportStudent]);

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

      const typeRes = await api.get('/exams/exam-types');
      setExamTypes(typeRes.data);
      if (typeRes.data.length > 0) {
        setSelectedExamName(typeRes.data[0]);
      }
    } catch (err: any) {
      console.error('Error fetching grades metadata:', err);
      setErrorMsg('Failed to load class or exam type filters.');
    }
  };

  useEffect(() => {
    if (selectedClassSectionId && selectedExamName) {
      fetchGrades();
    }
  }, [selectedClassSectionId, selectedExamName]);

  const fetchGrades = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await api.get(
        `/exams/grades-report?classSectionId=${selectedClassSectionId}&examName=${encodeURIComponent(
          selectedExamName
        )}`
      );
      setRecords(res.data);
    } catch (err: any) {
      console.error('Error loading grades report:', err);
      setErrorMsg('Failed to load marks roster report.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    if (classes.length > 0) setSelectedClassSectionId(classes[0].value);
    if (examTypes.length > 0) setSelectedExamName(examTypes[0]);
  };

  // Filter computation by search query
  const filteredRecords = records.filter(r => {
    return (
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.rollNo.toLowerCase().includes(search.toLowerCase())
    );
  });

  // KPI Calculations
  const totalStudents = filteredRecords.length;
  const averageScore = totalStudents > 0
    ? Math.round(filteredRecords.reduce((sum, r) => sum + r.score, 0) / totalStudents)
    : 0;
  const passedCount = filteredRecords.filter(r => r.score >= 45).length;
  const failedCount = filteredRecords.filter(r => r.score < 45).length;
  const passRate = totalStudents > 0 ? Math.round((passedCount / totalStudents) * 100) : 0;

  // Top Scorer
  const topScorer = filteredRecords.length > 0
    ? [...filteredRecords].sort((a, b) => b.score - a.score)[0]
    : null;

  const getGradeBadge = (letter: string) => {
    if (letter === 'A+' || letter === 'A') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (letter === 'B') return 'bg-blue-50 text-blue-600 border-blue-100';
    if (letter === 'C') return 'bg-slate-50 text-slate-650 border-slate-200';
    if (letter === 'D') return 'bg-amber-50 text-amber-600 border-amber-100';
    return 'bg-rose-50 text-rose-600 border-rose-100';
  };

  const getSubjectGrade = (score: number) => {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  };

  const classLabel = classes.find(c => c.value === selectedClassSectionId)?.label || 'Class Section';

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5 print:hidden">
        <div>
          <h2 className="text-[22px] sm:text-[28px] font-bold text-slate-900 leading-none">
            Grades &amp; Marks Roster
          </h2>
          <p className="text-slate-500 text-[12px] sm:text-[13px] font-medium mt-2">
            View student term score analysis, ranks classifications, and generate report cards.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchGrades}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[13px] flex items-center gap-2 shadow-xs transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
            Refresh
          </button>
          <button
            onClick={handleResetFilters}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[13px] transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3 text-sm print:hidden">
          <X className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* Filters config bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 print:hidden">
        {/* Search */}
        <div className="relative flex items-center bg-white border border-slate-200 rounded-xl px-3 py-2 sm:col-span-2 shadow-xs focus-within:border-[#2E5BFF]">
          <Search className="w-4 h-4 text-slate-400 mr-2" />
          <input
            type="text"
            placeholder="Search student, roll number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-none text-[13px] font-semibold text-slate-800 outline-none w-full placeholder-slate-400"
          />
        </div>

        {/* Class select */}
        <select
          value={selectedClassSectionId}
          onChange={(e) => setSelectedClassSectionId(e.target.value)}
          className="border border-slate-200 rounded-xl p-2.5 text-[13px] text-slate-755 font-bold bg-white shadow-xs outline-none"
        >
          {classes.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        {/* Test select */}
        <select
          value={selectedExamName}
          onChange={(e) => setSelectedExamName(e.target.value)}
          className="border border-slate-200 rounded-xl p-2.5 text-[13px] text-slate-755 font-bold bg-white shadow-xs outline-none"
        >
          {examTypes.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6 print:hidden">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm">
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Total Students</span>
          <span className="text-xl sm:text-2xl font-extrabold text-slate-800 block mt-1 sm:mt-2">{totalStudents}</span>
          <span className="text-[10px] text-slate-400 font-semibold block mt-1 hidden sm:block">Staged in current filters</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm">
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Class Avg</span>
          <span className="text-xl sm:text-2xl font-extrabold text-slate-850 block mt-1 sm:mt-2">{averageScore}%</span>
          <span className="text-[10px] text-emerald-600 font-semibold block mt-1 hidden sm:block">Recalculated from DB scores</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm">
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Passed</span>
          <span className="text-xl sm:text-2xl font-extrabold text-emerald-600 block mt-1 sm:mt-2">{passedCount}</span>
          <span className="text-[10px] text-slate-450 font-semibold block mt-1 hidden sm:block">{passRate}% Pass Rate</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm">
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Failed</span>
          <span className="text-xl sm:text-2xl font-extrabold text-rose-600 block mt-1 sm:mt-2">{failedCount}</span>
          <span className="text-[10px] text-slate-455 font-semibold block mt-1 hidden sm:block">Score below 45% threshold</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm col-span-2 sm:col-span-1">
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Top Scorer</span>
          <span className="text-sm font-black text-slate-800 block mt-1 sm:mt-2 truncate">
            {topScorer ? `${topScorer.name} (${topScorer.score}%)` : '—'}
          </span>
          <span className="text-[10px] text-purple-650 font-semibold block mt-1 hidden sm:block truncate">
            Rank 1 in Class Section
          </span>
        </div>
      </div>

      {/* Student Performance List */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm print:hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between sm:items-center gap-1">
          <h3 className="text-sm font-bold text-slate-700">Student Performance Marks Roster</h3>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tap a card to view report card</span>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin" />
            <span className="text-xs font-semibold">Generating report roster...</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-16 text-center text-slate-450 text-xs font-semibold">
            No evaluation records found for this class and test term.
          </div>
        ) : (
          <>
            {/* Desktop Table – hidden on mobile */}
            <div className="hidden sm:block overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">Student</th>
                    <th className="px-6 py-4">Roll No.</th>
                    <th className="px-6 py-4">Class Section</th>
                    <th className="px-6 py-4">Rank</th>
                    <th className="px-6 py-4" style={{ width: '200px' }}>Score</th>
                    <th className="px-6 py-4">Grade</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-650 font-semibold">
                  {filteredRecords.map((r) => (
                    <tr
                      key={r.studentId}
                      onClick={() => setActiveReportStudent(r)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-855 text-sm leading-tight">{r.name}</div>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-500">{r.rollNo}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded bg-slate-50 border border-slate-200 font-bold text-[10px] text-slate-650">
                          {classLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-800">Rank {r.rank}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-150 h-1.5 rounded-full overflow-hidden w-28">
                            <div className="bg-[#2E5BFF] h-full rounded-full" style={{ width: `${r.score}%` }} />
                          </div>
                          <span className="font-bold font-mono text-[11px] shrink-0">{r.score}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getGradeBadge(r.grade)}`}>
                          {r.grade}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-blue-600 hover:text-blue-500 text-xs font-bold inline-flex items-center gap-0.5">
                          Report Card <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards – shown only on mobile */}
            <div className="sm:hidden divide-y divide-slate-100">
              {filteredRecords.map((r) => (
                <button
                  key={r.studentId}
                  onClick={() => setActiveReportStudent(r)}
                  className="w-full text-left px-4 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="font-bold text-slate-800 text-sm leading-tight">{r.name}</div>
                      <div className="text-[11px] text-slate-400 font-semibold mt-0.5">
                        Roll: <span className="font-mono">{r.rollNo}</span> · Rank {r.rank} · {classLabel}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getGradeBadge(r.grade)}`}>
                        {r.grade}
                      </span>
                      <ChevronRight className="w-4 h-4 text-blue-400" />
                    </div>
                  </div>
                  {/* Score bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${r.score}%`,
                          background: r.score >= 75 ? '#10b981' : r.score >= 45 ? '#2E5BFF' : '#ef4444'
                        }}
                      />
                    </div>
                    <span className="font-bold font-mono text-[12px] shrink-0 text-slate-700">{r.score}%</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
            {/* REPORT CARD MODAL */}
      {activeReportStudent && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4 sm:p-6 z-[99999] bg-slate-900/60 backdrop-blur-sm overflow-hidden print:relative print:inset-0 print:bg-transparent print:p-0"
          onClick={() => setActiveReportStudent(null)}
        >
          {/* Modal Container */}
          <div 
            className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transform transition-all animate-in zoom-in-95 print:relative print:max-h-none print:shadow-none print:border-none print:overflow-visible print:w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 shrink-0 print:hidden bg-white rounded-t-2xl">
              <div className="flex items-center gap-2.5 min-w-0">
                <Trophy className="w-5 h-5 text-purple-600 shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-extrabold text-slate-800 text-sm sm:text-base leading-tight truncate">Report Card</h3>
                  <p className="text-slate-400 text-[11px] font-semibold truncate">{selectedExamName} · {classLabel}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleExportPDF(activeReportStudent)}
                  disabled={isGeneratingPDF}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">{isGeneratingPDF ? 'Generating...' : 'Download PDF'}</span>
                  <span className="xs:hidden">PDF</span>
                </button>
                <button
                  onClick={() => setActiveReportStudent(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Body wrapped in PDFLayout */}
            <div className="flex-1 overflow-y-auto print:overflow-visible">
              <PDFLayout
                id={`report-card-print-${activeReportStudent.studentId}`}
                schoolLogo={null}
                schoolName={schoolName}
                schoolSubtitle={`${selectedExamName} Term Roster Evaluation`}
                reportTitle="Official Progress Report Card"
                metadata={[
                  { label: 'Student Name', value: activeReportStudent.name },
                  { label: 'Roll Number', value: activeReportStudent.rollNo },
                  { label: 'Class & Section', value: classLabel },
                  { label: 'Class Rank', value: `Rank ${activeReportStudent.rank}` }
                ]}
                footerText={`Official report card statement generated by ${schoolName}. Powered by Covenant Synergy.`}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left Column: Overall Results */}
                  <div className="space-y-4">
                    {/* GPA Summary */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center shadow-xs">
                        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Total Marks</span>
                        <span className="text-sm font-extrabold text-slate-800 block mt-1">
                          {activeReportStudent.subjectsList.reduce((sum, s) => sum + s.score, 0)} / {activeReportStudent.subjectsList.length * 100}
                        </span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center shadow-xs">
                        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Overall Avg</span>
                        <span className="text-sm font-extrabold text-slate-800 block mt-1">{activeReportStudent.score}%</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center shadow-xs">
                        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">GPA Grade</span>
                        <span className="text-sm font-extrabold text-purple-600 block mt-1">{activeReportStudent.grade}</span>
                      </div>
                      <div className={`border rounded-2xl p-4 text-center shadow-xs ${
                        activeReportStudent.score >= 45
                          ? 'bg-emerald-50 border-emerald-100'
                          : 'bg-rose-50 border-rose-100'
                      }`}>
                        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Final Result</span>
                        <span className={`text-sm font-extrabold block mt-1 ${
                          activeReportStudent.score >= 45 ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {activeReportStudent.score >= 45 ? 'PASSED' : 'FAILED'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Subject-wise details */}
                  <div className="md:col-span-2 space-y-3">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Subject Wise Marks</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeReportStudent.subjectsList.map((subj, idx) => {
                        const isPass = subj.score >= 45;
                        const letter = getSubjectGrade(subj.score);
                        const pct = Math.round((subj.score / subj.max) * 100);
                        return (
                          <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between min-h-[96px] break-inside-avoid">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-extrabold text-slate-855 text-sm truncate pr-2" title={subj.name}>{subj.name}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="font-black text-blue-600 text-sm">{letter}</span>
                                <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black tracking-wider border ${
                                  isPass ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                                }`}>
                                  {isPass ? 'PASS' : 'FAIL'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${pct}%`,
                                    background: pct >= 75 ? '#10b981' : pct >= 45 ? '#2E5BFF' : '#ef4444'
                                  }}
                                />
                              </div>
                              <span className="text-xs font-bold text-slate-500 font-mono shrink-0">
                                {subj.score} / {subj.max}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </PDFLayout>
            </div>

            {/* Sticky Footer – always visible */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0 bg-white sm:rounded-b-2xl print:hidden">
              <button
                onClick={() => setActiveReportStudent(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-semibold text-sm transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => PDFService.print()}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-colors cursor-pointer flex items-center gap-2"
              >
                <Printer className="w-4 h-4" /> Print (Browser)
              </button>
              <button
                onClick={() => handleExportPDF(activeReportStudent)}
                disabled={isGeneratingPDF}
                className="px-5 py-2.5 rounded-xl bg-[#2E5BFF] hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-blue-500/20 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" /> {isGeneratingPDF ? 'Generating PDF...' : 'Download PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
