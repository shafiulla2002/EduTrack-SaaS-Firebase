'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Award, CheckCircle, Save, X, PlusCircle, MinusCircle, 
  RefreshCw, Settings, AlertTriangle, Filter, FileText, Download,
  Layers, Check, Sparkles
} from 'lucide-react';
import { api, fastGet, getCachedData } from '@/lib/api';
import LoadingSpinner from '@/components/loading/LoadingSpinner';
import { useToast } from '@/components/Toast';

type AcademicYearOption = {
  id: string;
  name: string;
  isActive: boolean;
};

type ClassSectionOption = {
  value: string;
  label: string;
  displayName?: string;
  classId: string;
  className?: string;
  sectionId: string;
  sectionName?: string;
  academicYearId?: string;
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

type MarksReportStudent = {
  studentId: string;
  admissionNo: string;
  rollNo: string;
  studentName: string;
  marks: Record<string, number | 'AB' | '—'>;
  totalMarks: number | null;
};

type MarksReportData = {
  schoolName: string;
  schoolCode: string;
  academicYear: string;
  academicYearId?: string;
  className: string;
  classId?: string;
  sectionName: string;
  sectionId?: string;
  classSectionId?: string;
  examType: string;
  subjects: { id: string; name: string }[];
  totalStudents: number;
  students: MarksReportStudent[];
};

type RosterStatus = 'idle' | 'loading' | 'success' | 'error';

export default function ExamsAndMarksPage() {
  const router = useRouter();
  const { showToast } = useToast();

  // Active request tracking refs for race-condition prevention & abort handling
  const activeRosterRequestIdRef = useRef<string>('');
  const rosterAbortControllerRef = useRef<AbortController | null>(null);

  // Synchronous metadata cache initialization
  const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>(() => getCachedData<AcademicYearOption[]>('/academics/academic-years') || []);
  const [classes, setClasses] = useState<ClassSectionOption[]>(() => getCachedData<ClassSectionOption[]>('/exams/classes') || []);
  const [subjects, setSubjects] = useState<SubjectOption[]>(() => getCachedData<SubjectOption[]>('/exams/subjects') || []);
  const [examTypes, setExamTypes] = useState<string[]>(() => getCachedData<string[]>('/exams/exam-types') || []);
  const [components, setComponents] = useState<any[]>(() => getCachedData<any[]>('/exam-config/components') || []);

  // ── STAGED FILTER CONTROLS ──────────────────────────────────────────────────
  const [stagedYearId, setStagedYearId] = useState<string>('');
  const [stagedClassId, setStagedClassId] = useState<string>('');
  const [stagedSectionId, setStagedSectionId] = useState<string>('');
  const [stagedExamName, setStagedExamName] = useState<string>('');

  // ── ACTIVE APPLIED FILTER STATE & REPORT CACHE ──────────────────────────────
  const [activeFilter, setActiveFilter] = useState<{
    academicYearId: string;
    classId: string;
    sectionId: string;
    examName: string;
  } | null>(null);

  const [reportData, setReportData] = useState<MarksReportData | null>(null);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [filterError, setFilterError] = useState<string>('');

  // ── SCORING MATRIX SELECTION STATES (Interactive Entry) ─────────────────────
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

  // ── FILTER DROPDOWN OPTIONS DERIVATION ──────────────────────────────────────
  
  // Available classes for selected Academic Year
  const availableClasses = useMemo(() => {
    const filtered = stagedYearId
      ? classes.filter(c => !c.academicYearId || c.academicYearId === stagedYearId)
      : classes;

    const map = new Map<string, { id: string; name: string }>();
    for (const c of filtered) {
      if (c.classId && !map.has(c.classId)) {
        const name = c.className || c.label.split(' - ')[0] || 'Class';
        map.set(c.classId, { id: c.classId, name });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [classes, stagedYearId]);

  // Available sections for selected Class & Academic Year
  const availableSections = useMemo(() => {
    if (!stagedClassId) return [];
    const filtered = classes.filter(c => 
      c.classId === stagedClassId && 
      (!stagedYearId || !c.academicYearId || c.academicYearId === stagedYearId)
    );

    const map = new Map<string, { id: string; name: string; classSectionId: string }>();
    for (const c of filtered) {
      if (c.sectionId && !map.has(c.sectionId)) {
        const name = c.sectionName || (c.label.includes(' - ') ? c.label.split(' - ')[1] : 'Section');
        map.set(c.sectionId, { id: c.sectionId, name, classSectionId: c.value });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [classes, stagedClassId, stagedYearId]);

  // ── PDF ENABLED STATUS (STRICT INVALIDATION) ────────────────────────────────
  const isPdfEnabled = useMemo(() => {
    if (!reportData || !reportData.students || reportData.students.length === 0) return false;
    if (!activeFilter) return false;
    if (isFiltering || isDownloadingPdf) return false;
    // Must match the exact active filter that produced the reportData
    return (
      stagedYearId === activeFilter.academicYearId &&
      stagedClassId === activeFilter.classId &&
      stagedSectionId === activeFilter.sectionId &&
      stagedExamName === activeFilter.examName
    );
  }, [reportData, activeFilter, stagedYearId, stagedClassId, stagedSectionId, stagedExamName, isFiltering, isDownloadingPdf]);

  // ── METADATA INITIALIZATION ────────────────────────────────────────────────
  useEffect(() => {
    fetchMetadata();
  }, []);

  const fetchMetadata = async (retryCount = 0) => {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    try {
      setMetadataError('');
      const [yearRes, classRes, subRes, compRes, typeRes] = await Promise.all([
        fastGet('/academics/academic-years', undefined, { ttlMs: 60000 }).catch(() => fastGet('/academic-years', undefined, { ttlMs: 60000 })).catch(() => ({ data: [] })),
        fastGet('/exams/classes', undefined, { ttlMs: 60000 }),
        fastGet('/exams/subjects', undefined, { ttlMs: 60000 }),
        fastGet('/exam-config/components', undefined, { ttlMs: 60000 }),
        fastGet('/exams/exam-types', undefined, { ttlMs: 60000 }),
      ]);

      const yearList: AcademicYearOption[] = yearRes.data || [];
      const classList: ClassSectionOption[] = classRes.data || [];
      const subList: SubjectOption[] = subRes.data || [];
      const compList = compRes.data || [];
      const typeList: string[] = typeRes.data || [];

      setAcademicYears(yearList);
      setClasses(classList);
      setSubjects(subList);
      setComponents(compList);
      setExamTypes(typeList);

      // Default Active Academic Year
      const activeYear = yearList.find(y => y.isActive) || yearList[0];
      const initialYearId = activeYear ? activeYear.id : '';
      setStagedYearId(prev => prev || initialYearId);

      // Default Class & Section
      const relevantClasses = initialYearId
        ? classList.filter(c => !c.academicYearId || c.academicYearId === initialYearId)
        : classList;
      const initialClass = relevantClasses[0];

      if (initialClass) {
        setStagedClassId(prev => prev || initialClass.classId);
        setStagedSectionId(prev => prev || initialClass.sectionId);
      }

      // Default Exam
      const initialExam = typeList.length > 0 ? typeList[0] : '';
      setStagedExamName(prev => prev || initialExam);

      // Interactive Matrix Selectors fallback
      const targetClassSectionId = selectedClassSectionId || (classList.length > 0 ? classList[0].value : '');
      const targetSubId = selectedSubjectId || (subList.length > 0 ? subList[0].id : '');
      const targetComp = selectedSubjectType || (compList.length > 0 ? compList[0].name : 'Theory');
      const targetExam = selectedExamName || initialExam;

      if (!selectedClassSectionId && targetClassSectionId) setSelectedClassSectionId(targetClassSectionId);
      if (!selectedSubjectId && targetSubId) setSelectedSubjectId(targetSubId);
      if (!selectedSubjectType && targetComp) setSelectedSubjectType(targetComp);
      if (!selectedExamName && targetExam) setSelectedExamName(targetExam);

      const elapsed = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Exam Page] loadMetadata completed: ${elapsed}ms`);
      }

      if (targetClassSectionId && targetSubId && targetExam && targetComp) {
        fetchRoster(targetClassSectionId, targetSubId, targetExam, targetComp);
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

  // ── FILTER INVALIDATION ON SELECTION CHANGE ─────────────────────────────────

  const handleYearChange = (yearId: string) => {
    setStagedYearId(yearId);
    setFilterError('');
    // Invalidate PDF
    setReportData(null);
    setActiveFilter(null);

    // Cascading: update class and section
    const matching = classes.filter(c => !c.academicYearId || c.academicYearId === yearId);
    if (matching.length > 0) {
      setStagedClassId(matching[0].classId);
      setStagedSectionId(matching[0].sectionId);
    } else {
      setStagedClassId('');
      setStagedSectionId('');
    }
  };

  const handleClassChange = (classId: string) => {
    setStagedClassId(classId);
    setFilterError('');
    // Invalidate PDF
    setReportData(null);
    setActiveFilter(null);

    // Cascading: update section
    const matching = classes.filter(c => 
      c.classId === classId && 
      (!stagedYearId || !c.academicYearId || c.academicYearId === stagedYearId)
    );
    if (matching.length > 0) {
      setStagedSectionId(matching[0].sectionId);
    } else {
      setStagedSectionId('');
    }
  };

  const handleSectionChange = (sectionId: string) => {
    setStagedSectionId(sectionId);
    setFilterError('');
    // Invalidate PDF
    setReportData(null);
    setActiveFilter(null);
  };

  const handleExamChange = (examName: string) => {
    setStagedExamName(examName);
    setFilterError('');
    // Invalidate PDF
    setReportData(null);
    setActiveFilter(null);
  };

  // ── EXECUTE MARKS REPORT FILTER ─────────────────────────────────────────────

  const handleFilterReport = async () => {
    setFilterError('');

    if (!stagedYearId || !stagedClassId || !stagedSectionId || !stagedExamName) {
      const msg = 'Please select Academic Year, Class, Section, and Exam Type.';
      setFilterError(msg);
      showToast(msg, 'error');
      return;
    }

    setIsFiltering(true);
    try {
      // Find matching ClassSection
      const matchedCs = classes.find(c => 
        c.classId === stagedClassId && 
        c.sectionId === stagedSectionId &&
        (!stagedYearId || !c.academicYearId || c.academicYearId === stagedYearId)
      );

      const params = new URLSearchParams({
        academicYearId: stagedYearId,
        classId: stagedClassId,
        sectionId: stagedSectionId,
        examName: stagedExamName,
      });
      if (matchedCs) {
        params.append('classSectionId', matchedCs.value);
      }

      const res = await api.get(`/exams/marks-report?${params.toString()}`);
      const data: MarksReportData = res.data;

      setReportData(data);
      setActiveFilter({
        academicYearId: stagedYearId,
        classId: stagedClassId,
        sectionId: stagedSectionId,
        examName: stagedExamName,
      });

      if (!data.students || data.students.length === 0) {
        showToast('No matching students found in the selected class section.', 'info');
      } else {
        showToast(`Loaded marks report for ${data.students.length} students.`, 'success');
      }

      // Sync interactive scoring matrix below
      if (matchedCs) {
        setSelectedClassSectionId(matchedCs.value);
      }
      setSelectedExamName(stagedExamName);

    } catch (err: any) {
      console.error('Filter marks report error:', err);
      setReportData(null);
      setActiveFilter(null);
      const backendMsg = err.response?.data?.message || 'Failed to load marks report for the selected filter.';
      setFilterError(backendMsg);
      showToast(backendMsg, 'error');
    } finally {
      setIsFiltering(false);
    }
  };

  // ── DOWNLOAD GOVERNMENT-STYLE LANDSCAPE PDF ─────────────────────────────────

  const handleDownloadMarksPDF = async () => {
    if (!reportData || !reportData.students || reportData.students.length === 0) {
      showToast('No report data available to download. Please click Filter first.', 'error');
      return;
    }

    setIsDownloadingPdf(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = 297;
      const pageHeight = 210;
      const margin = 12;
      const printableWidth = pageWidth - (margin * 2);

      const dateStr = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
      const schoolTitle = reportData.schoolName.toUpperCase();
      const schoolCodeText = reportData.schoolCode ? `[ School Code / UDISE: ${reportData.schoolCode} ]` : '';

      // Header Banner
      doc.setFillColor(30, 41, 59); // slate-800
      doc.rect(margin, margin, printableWidth, 16, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(`${schoolTitle} ${schoolCodeText}`, margin + 6, margin + 10.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(203, 213, 225); // slate-300
      doc.text(`Generated: ${dateStr} | Total Students: ${reportData.totalStudents}`, printableWidth + margin - 6, margin + 10.5, { align: 'right' });

      // Report Info Subcard
      let y = margin + 20;
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.roundedRect(margin, y, printableWidth, 14, 2, 2, 'FD');

      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.setFont('helvetica', 'bold');
      doc.text('EXAMINATION REPORT DETAILS:', margin + 4, y + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Academic Year: ${reportData.academicYear}   |   Class: ${reportData.className}   |   Section: ${reportData.sectionName}`,
        margin + 56,
        y + 5.5
      );
      doc.text(
        `Exam Term: ${reportData.examType}   |   Format: Government-Style Consolidated Mark Sheet   |   Status: Validated`,
        margin + 56,
        y + 10.5
      );

      y += 18;

      // ── COLUMN LAYOUT CONFIGURATION ─────────────────────────────────────────
      const fixedLeftCols = [
        { header: '#', key: '_sno', width: 9, align: 'center' },
        { header: 'School Code', key: '_schoolCode', width: 22, align: 'center' },
        { header: 'Admission No', key: '_admNo', width: 24, align: 'left' },
        { header: 'Roll No', key: '_rollNo', width: 18, align: 'left' },
        { header: 'Student Name', key: '_name', width: 44, align: 'left' },
        { header: 'Exam Type', key: '_examType', width: 26, align: 'left' },
      ];

      const subjects = reportData.subjects || [];
      const numSubjects = Math.max(1, subjects.length);
      const fixedLeftWidth = fixedLeftCols.reduce((sum, c) => sum + c.width, 0); // ~143mm
      const fixedRightWidth = 20; // Total marks column width
      const remainingWidth = printableWidth - fixedLeftWidth - fixedRightWidth; // ~110mm

      const calculatedSubWidth = Math.max(14, Math.min(26, remainingWidth / numSubjects));
      const subjectCols = subjects.map(s => ({
        header: s.name,
        key: `sub_${s.name}`,
        width: calculatedSubWidth,
        align: 'center' as const,
      }));

      const totalCol = { header: 'Total Marks', key: '_total', width: fixedRightWidth, align: 'right' as const };

      // Combine all columns
      const allCols = [...fixedLeftCols, ...subjectCols, totalCol];

      // If total width exceeds printable width, rescale proportionally
      const totalColWidth = allCols.reduce((sum, c) => sum + c.width, 0);
      if (totalColWidth > printableWidth) {
        const scale = printableWidth / totalColWidth;
        for (const col of allCols) {
          col.width = Number((col.width * scale).toFixed(2));
        }
      }

      const drawTableHeader = (curY: number) => {
        doc.setFillColor(241, 245, 249); // slate-100
        doc.setDrawColor(203, 213, 225); // slate-300
        doc.rect(margin, curY, printableWidth, 7.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);

        let curX = margin;
        for (const c of allCols) {
          const posX = c.align === 'right' ? curX + c.width - 2 : c.align === 'center' ? curX + (c.width / 2) : curX + 2;
          // Truncate header text if too long
          let text = c.header;
          if (c.width < 18 && text.length > 8) {
            text = text.substring(0, 7) + '..';
          }
          doc.text(text, posX, curY + 5, { align: c.align as any });
          curX += c.width;
        }
        return curY + 7.5;
      };

      y = drawTableHeader(y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);

      const students = reportData.students || [];

      for (let i = 0; i < students.length; i++) {
        const item = students[i];
        const rowHeight = 6.8;

        if (y + rowHeight > pageHeight - margin - 8) {
          // Add page footer
          doc.setFontSize(7);
          doc.setTextColor(148, 163, 184);
          doc.text(`Page ${doc.getNumberOfPages()} | Generated via CS EduTrack Examination Platform`, pageWidth / 2, pageHeight - 6, { align: 'center' });

          doc.addPage();
          y = margin;
          y = drawTableHeader(y);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
        }

        // Alternating row background
        if (i % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, printableWidth, rowHeight, 'F');
        }

        doc.setDrawColor(241, 245, 249);
        doc.line(margin, y + rowHeight, margin + printableWidth, y + rowHeight);

        let curX = margin;

        // 1. # (S.No)
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(String(i + 1), curX + (allCols[0].width / 2), y + 4.6, { align: 'center' });
        curX += allCols[0].width;

        // 2. School Code
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(reportData.schoolCode || '—', curX + (allCols[1].width / 2), y + 4.6, { align: 'center' });
        curX += allCols[1].width;

        // 3. Admission No
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(item.admissionNo || '—', curX + 2, y + 4.6);
        curX += allCols[2].width;

        // 4. Roll No
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(item.rollNo || '—', curX + 2, y + 4.6);
        curX += allCols[3].width;

        // 5. Student Name
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        let sName = item.studentName || 'Student';
        if (sName.length > 22) sName = sName.substring(0, 20) + '..';
        doc.text(sName, curX + 2, y + 4.6);
        curX += allCols[4].width;

        // 6. Exam Type
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        let exType = reportData.examType || 'Exam';
        if (exType.length > 14) exType = exType.substring(0, 12) + '..';
        doc.text(exType, curX + 2, y + 4.6);
        curX += allCols[5].width;

        // 7. Dynamic Subject Columns
        doc.setFont('helvetica', 'normal');
        for (let sIdx = 0; sIdx < subjects.length; sIdx++) {
          const sub = subjects[sIdx];
          const colDef = subjectCols[sIdx];
          const markVal = item.marks[sub.name];

          const posX = curX + (colDef.width / 2);

          if (markVal === 'AB') {
            doc.setTextColor(225, 29, 72); // rose-600
            doc.setFont('helvetica', 'bold');
            doc.text('AB', posX, y + 4.6, { align: 'center' });
          } else if (markVal === '—' || markVal === null || markVal === undefined) {
            doc.setTextColor(148, 163, 184); // slate-400
            doc.setFont('helvetica', 'normal');
            doc.text('—', posX, y + 4.6, { align: 'center' });
          } else if (markVal === 0) {
            doc.setTextColor(30, 41, 59);
            doc.setFont('helvetica', 'normal');
            doc.text('0', posX, y + 4.6, { align: 'center' });
          } else {
            doc.setTextColor(15, 23, 42);
            doc.setFont('helvetica', 'normal');
            doc.text(String(markVal), posX, y + 4.6, { align: 'center' });
          }

          curX += colDef.width;
        }

        // 8. Total Marks
        const totalMarksVal = item.totalMarks !== null && item.totalMarks !== undefined ? String(item.totalMarks) : '—';
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(totalMarksVal, curX + totalCol.width - 2, y + 4.6, { align: 'right' });

        y += rowHeight;
      }

      // Final page footer
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${doc.getNumberOfPages()} | Generated via CS EduTrack Examination Platform`, pageWidth / 2, pageHeight - 6, { align: 'center' });

      // Save PDF file
      const safeClass = reportData.className.replace(/[^a-zA-Z0-9]/g, '_');
      const safeSec = reportData.sectionName.replace(/[^a-zA-Z0-9]/g, '_');
      const safeExam = reportData.examType.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `Marks_Report_${safeClass}_${safeSec}_${safeExam}.pdf`;

      doc.save(fileName);
      showToast('Government-Style Marks Report PDF downloaded successfully.', 'success');
    } catch (err: any) {
      console.error('PDF export error:', err);
      showToast('Failed to generate PDF. Please try again.', 'error');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // ── MANAGE EXAM TYPES MODAL HANDLERS ────────────────────────────────────────

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

  // ── FETCH ROSTER FOR INTERACTIVE SCORING MATRIX ─────────────────────────────

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
      if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        return;
      }

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

      // If report was previously loaded for this exam, invalidate so user refreshes it to view newly saved marks
      setReportData(null);
      setActiveFilter(null);

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

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-sm opacity-60 animate-pulse">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 bg-slate-200 rounded w-24"></div>
                <div className="h-10 bg-slate-100 rounded-xl"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in pb-20 lg:pb-6">
      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-[24px] sm:text-[28px] font-bold text-slate-900 leading-tight">
            Enter Student Marks
          </h2>
          <p className="text-slate-500 text-xs sm:text-[13px] font-medium mt-1">
            Filter student cohorts, enter examination scores, and export government-style marks reports.
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
        </div>
      </div>

      {/* ── SECTION 1: CASCADING MARKS REPORT FILTERS & PDF EXPORT CARD ─────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Marks Report & Scoresheet Filter</h3>
              <p className="text-[11px] font-medium text-slate-500">
                Select Academic Year, Class, Section, and Exam Term to filter students and export reports.
              </p>
            </div>
          </div>
          {reportData && (
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-700 text-xs font-bold">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Report Loaded: {reportData.students.length} Students</span>
            </div>
          )}
        </div>

        {filterError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{filterError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 text-xs font-bold">
          {/* 1. Academic Year */}
          <div>
            <label className="block text-slate-500 mb-1.5 uppercase tracking-wider text-[11px]">
              Academic Year <span className="text-rose-500">*</span>
            </label>
            <select
              value={stagedYearId}
              onChange={(e) => handleYearChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold outline-none focus:border-blue-600 transition-colors"
            >
              <option value="">Select Academic Year</option>
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.name} {ay.isActive ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Class */}
          <div>
            <label className="block text-slate-500 mb-1.5 uppercase tracking-wider text-[11px]">
              Class <span className="text-rose-500">*</span>
            </label>
            <select
              value={stagedClassId}
              onChange={(e) => handleClassChange(e.target.value)}
              disabled={availableClasses.length === 0}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold outline-none focus:border-blue-600 disabled:bg-slate-100 disabled:text-slate-400 transition-colors"
            >
              <option value="">Select Class</option>
              {availableClasses.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Section */}
          <div>
            <label className="block text-slate-500 mb-1.5 uppercase tracking-wider text-[11px]">
              Section <span className="text-rose-500">*</span>
            </label>
            <select
              value={stagedSectionId}
              onChange={(e) => handleSectionChange(e.target.value)}
              disabled={availableSections.length === 0}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold outline-none focus:border-blue-600 disabled:bg-slate-100 disabled:text-slate-400 transition-colors"
            >
              <option value="">Select Section</option>
              {availableSections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.name}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Exam Type */}
          <div>
            <label className="block text-slate-500 mb-1.5 uppercase tracking-wider text-[11px]">
              Exam Term / Type <span className="text-rose-500">*</span>
            </label>
            <select
              value={stagedExamName}
              onChange={(e) => handleExamChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold outline-none focus:border-blue-600 transition-colors"
            >
              <option value="">Select Exam Type</option>
              {examTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons: Filter & Download PDF */}
        <div className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleFilterReport}
            disabled={isFiltering || !stagedYearId || !stagedClassId || !stagedSectionId || !stagedExamName}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            {isFiltering ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Filtering...</span>
              </>
            ) : (
              <>
                <Filter className="w-4 h-4" />
                <span>Filter</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadMarksPDF}
            disabled={!isPdfEnabled || isDownloadingPdf}
            title={
              !isPdfEnabled
                ? 'Click "Filter" to retrieve validated student marks before downloading PDF'
                : 'Download Government-Style Marks Report PDF'
            }
            className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs ${
              isPdfEnabled && !isDownloadingPdf
                ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer hover:shadow-md'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-70'
            }`}
          >
            {isDownloadingPdf ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
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

      {/* ── SECTION 2: INTERACTIVE SCORING MATRIX SELECTORS & SAVE SCORESHEET ─ */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Interactive Subject Scoring Matrix</h3>
            <p className="text-[11px] font-medium text-slate-500">
              Select specific subject and component to enter individual student marks.
            </p>
          </div>
          <button
            onClick={handleSaveMarks}
            disabled={roster.length === 0 || rosterStatus === 'loading' || isSaving || rosterStatus === 'error'}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white font-semibold text-xs sm:text-[13px] flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4 text-xs font-bold">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-slate-400 mb-1.5 uppercase tracking-wider">Class & Section</label>
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
            <label className="block text-slate-400 mb-1.5 uppercase tracking-wider truncate">Subject</label>
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
            <label className="block text-slate-400 mb-1.5 uppercase tracking-wider truncate">Exam Term</label>
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

          <div className="col-span-2 sm:col-span-1 min-w-0">
            <label className="block text-slate-400 mb-1.5 uppercase tracking-wider truncate">Component</label>
            <select
              value={selectedSubjectType}
              onChange={(e) => setSelectedSubjectType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold outline-none truncate"
            >
              {components.length > 0 ? (
                components.map((c: any) => (
                  <option key={c.id || c.name} value={c.name}>
                    {c.name}
                  </option>
                ))
              ) : (
                <option value="Theory">Theory</option>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* ── KPI STATISTICS CARDS ────────────────────────────────────────────── */}
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

      {/* ── SCORING MATRIX TABLE ────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-700">
            Scoring Matrix: {subjects.find(s => s.id === selectedSubjectId)?.name || 'Subject'} ({selectedSubjectType}) — Max Marks: {examConfig.maxMarks}
          </h3>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            {classes.find(c => c.value === selectedClassSectionId)?.label || ''} · {selectedExamName}
          </span>
        </div>

        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
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
                          placeholder="Add remark / AB..."
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

      {/* ── MANAGE EXAM TYPES MODAL ─────────────────────────────────────────── */}
      {isManageTypesOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in space-y-0 text-slate-800">
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

            <div className="p-6 space-y-4">
              {typeError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl font-semibold">
                  {typeError}
                </div>
              )}

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

      {/* ── VALIDATION ERROR POPUP MODAL ────────────────────────────────────── */}
      {popupAlert.show && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-rose-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 text-slate-800">
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
