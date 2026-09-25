'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Award, CheckCircle, Save, X, PlusCircle, MinusCircle, 
  RefreshCw, Settings, AlertTriangle, Filter, Download,
  Check, Sparkles, HelpCircle, Layers
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

  // Active request abort controller
  const rosterAbortControllerRef = useRef<AbortController | null>(null);

  // ── STORAGE KEY FOR LAST SUCCESSFULLY APPLIED FILTER ────────────────────────
  const ENTER_MARKS_FILTER_KEY = 'cs-edutrack-enter-marks-filter';

  // Metadata state loaded once on mount
  const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>(() => {
    return getCachedData<AcademicYearOption[]>('/academics/academic-years') || 
           getCachedData<AcademicYearOption[]>('/academic-years') || [];
  });
  const [classes, setClasses] = useState<ClassSectionOption[]>(() => {
    return getCachedData<ClassSectionOption[]>('/exams/classes') || [];
  });
  const [examTypes, setExamTypes] = useState<string[]>(() => {
    return getCachedData<string[]>('/exams/exam-types') || [];
  });
  const [components, setComponents] = useState<any[]>(() => {
    return getCachedData<any[]>('/exam-config/components') || [];
  });
  const [availableSubjects, setAvailableSubjects] = useState<SubjectOption[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);

  // ── SINGLE UNIFIED FILTER STATE (SSR SAFE INITIAL STATE) ────────────────────
  const [selectedFilters, setSelectedFilters] = useState<{
    academicYearId: string;
    classSectionId: string;
    subjectId: string;
    examName: string;
    component: string;
  }>({
    academicYearId: '',
    classSectionId: '',
    subjectId: '',
    examName: '',
    component: '',
  });

  // ── ACTIVE APPLIED FILTER SNAPSHOT ─────────────────────────────────────────
  const [activeFilter, setActiveFilter] = useState<{
    academicYearId: string;
    classSectionId: string;
    subjectId: string;
    examName: string;
    component: string;
  } | null>(null);

  // ── ROSTER & REPORT RESULTS ────────────────────────────────────────────────
  const [roster, setRoster] = useState<StudentMarkRow[]>([]);
  const [reportData, setReportData] = useState<MarksReportData | null>(null);
  const [rosterStatus, setRosterStatus] = useState<RosterStatus>('idle');
  const [rosterError, setRosterError] = useState<string>('');
  const [metadataError, setMetadataError] = useState<string>('');

  // Filtering & PDF state
  const [isFiltering, setIsFiltering] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Exam configuration (passing % and max marks)
  const [examConfig, setExamConfig] = useState<{ passingPercentage: number; maxMarks: number; passMarks?: number }>({
    passingPercentage: 35,
    maxMarks: 100,
    passMarks: 35,
  });

  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(() => {
    const cachedClasses = getCachedData<ClassSectionOption[]>('/exams/classes');
    return !Array.isArray(cachedClasses) || cachedClasses.length === 0;
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

  // ── STRICT ASCENDING NUMERIC ROLL NUMBER SORTER ─────────────────────────────
  const parseRollNo = (r?: string | null) => {
    if (!r) return { num: Infinity, str: '' };
    const trimmed = String(r).trim();
    const match = trimmed.match(/^(\d+)(.*)$/);
    if (match) {
      return { num: parseInt(match[1], 10), str: match[2] };
    }
    const num = parseInt(trimmed, 10);
    return isNaN(num) ? { num: Infinity, str: trimmed } : { num, str: '' };
  };

  const sortRosterByRollNo = (students: StudentMarkRow[]): StudentMarkRow[] => {
    return [...students].sort((a, b) => {
      const rollA = parseRollNo(a.rollNo);
      const rollB = parseRollNo(b.rollNo);
      if (rollA.num !== rollB.num) return rollA.num - rollB.num; // Ascending: 1, 2, 3, 4, 5...
      if (rollA.str !== rollB.str) return rollA.str.localeCompare(rollB.str);
      return (a.name || '').localeCompare(b.name || '');
    });
  };

  // ── CORE FILTER EXECUTION & PERSISTENCE ENGINE ──────────────────────────────
  const executeFilterFetch = async (
    filtersToApply: {
      academicYearId: string;
      classSectionId: string;
      subjectId: string;
      examName: string;
      component: string;
    },
    targetCs?: ClassSectionOption | null,
    isFromRestore = false
  ) => {
    const cs = targetCs || classes.find(c => c.value === filtersToApply.classSectionId);
    if (!cs && !isFromRestore) {
      showToast('Could not resolve Class Section. Please verify your selection.', 'error');
      return false;
    }

    // Abort previous in-flight requests
    if (rosterAbortControllerRef.current) {
      rosterAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    rosterAbortControllerRef.current = abortController;

    setRosterStatus('loading');
    setRosterError('');
    setIsFiltering(true);

    const classSectionId = filtersToApply.classSectionId;
    const classId = cs?.classId || '';
    const sectionId = cs?.sectionId || '';
    const { subjectId, examName, component } = filtersToApply;

    try {
      const [marksEntryRes, reportRes] = await Promise.all([
        api.get(
          `/exams/marks-entry?classSectionId=${classSectionId}&subjectId=${subjectId}&examName=${encodeURIComponent(
            examName
          )}&subjectType=${encodeURIComponent(component || 'Theory')}`,
          { signal: abortController.signal }
        ),
        api.get(
          `/exams/marks-report?academicYearId=${filtersToApply.academicYearId}&classId=${classId}&sectionId=${sectionId}&classSectionId=${classSectionId}&examName=${encodeURIComponent(
            examName
          )}`,
          { signal: abortController.signal }
        ),
      ]);

      const rawRoster: StudentMarkRow[] = marksEntryRes.data?.roster || [];
      const loadedRoster = sortRosterByRollNo(rawRoster);
      setRoster(loadedRoster);

      if (marksEntryRes.data?.config) {
        const maxM = Number(marksEntryRes.data.config.maxMarks) || 100;
        const passPct = Number(marksEntryRes.data.config.passingPercentage) || 35;
        const passM =
          marksEntryRes.data.config.passMarks !== undefined && marksEntryRes.data.config.passMarks !== null
            ? Number(marksEntryRes.data.config.passMarks)
            : Number(((passPct / 100) * maxM).toFixed(2));
        setExamConfig({ maxMarks: maxM, passingPercentage: passPct, passMarks: passM });
      }

      setReportData(reportRes.data);
      setActiveFilter({ ...filtersToApply });
      setSelectedFilters({ ...filtersToApply });
      setRosterStatus('success');

      // Persist the LAST SUCCESSFULLY APPLIED filter to localStorage
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(ENTER_MARKS_FILTER_KEY, JSON.stringify(filtersToApply));
        }
      } catch (e) {
        console.warn('Failed to save enter-marks filter to localStorage', e);
      }

      if (!isFromRestore) {
        if (loadedRoster.length === 0) {
          showToast('No students enrolled in the selected class and section.', 'info');
        } else {
          showToast(`Loaded scoresheet for ${loadedRoster.length} students.`, 'success');
        }
      }
      return true;
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        return false;
      }
      console.error('[Exam Page] Filter API Error:', err);
      setRoster([]);
      setReportData(null);
      setActiveFilter(null);

      if (isFromRestore) {
        try {
          if (typeof window !== 'undefined') {
            localStorage.removeItem(ENTER_MARKS_FILTER_KEY);
          }
        } catch (e) {}
        setRosterStatus('idle');
      } else {
        setRosterStatus('error');
        const backendMsg = err.response?.data?.message;
        if (backendMsg === 'Exam not found' || err.response?.status === 404) {
          setRosterError('No exam configuration found for the selected Class, Subject, and Exam Term.');
        } else if (backendMsg) {
          setRosterError(backendMsg);
        } else {
          setRosterError('Failed to load students roster for mark entry. Please click Retry.');
        }
      }
      return false;
    } finally {
      setIsFiltering(false);
    }
  };

  // ── LOAD INITIAL METADATA & PARALLEL RESTORE ON MOUNT ──────────────────────
  const fetchMetadata = async () => {
    let isMounted = true;
    try {
      setMetadataError('');

      // 1. Read saved filter from localStorage immediately on mount
      let savedFilter: any = null;
      try {
        if (typeof window !== 'undefined') {
          const raw = localStorage.getItem(ENTER_MARKS_FILTER_KEY);
          if (raw) savedFilter = JSON.parse(raw);
        }
      } catch (e) {}

      const hasSaved = Boolean(
        savedFilter?.academicYearId &&
        savedFilter?.classSectionId &&
        savedFilter?.subjectId &&
        savedFilter?.examName &&
        savedFilter?.component
      );

      if (hasSaved) {
        setSelectedFilters(savedFilter);
        setRosterStatus('loading');
        setIsFiltering(true);
      }

      // 2. Fetch all metadata and restore payloads concurrently in parallel
      const metadataRequests = [
        fastGet('/academics/academic-years', undefined, { ttlMs: 60000 })
          .catch(() => fastGet('/academic-years', undefined, { ttlMs: 60000 }))
          .catch(() => ({ data: [] })),
        fastGet('/exams/classes', undefined, { ttlMs: 60000 }).catch(() => ({ data: [] })),
        fastGet('/exams/exam-types', undefined, { ttlMs: 60000 }).catch(() => ({ data: [] })),
        fastGet('/exam-config/components', undefined, { ttlMs: 60000 }).catch(() => ({ data: [] })),
      ];

      const restoreRequests = hasSaved
        ? [
            fastGet(`/exams/subjects?classSectionId=${savedFilter.classSectionId}`, undefined, { ttlMs: 60000 }).catch(() => ({ data: [] })),
            api.get(
              `/exams/marks-entry?classSectionId=${savedFilter.classSectionId}&subjectId=${savedFilter.subjectId}&examName=${encodeURIComponent(
                savedFilter.examName
              )}&subjectType=${encodeURIComponent(savedFilter.component || 'Theory')}`
            ).catch(() => null),
            api.get(
              `/exams/marks-report?academicYearId=${savedFilter.academicYearId}&classSectionId=${savedFilter.classSectionId}&examName=${encodeURIComponent(
                savedFilter.examName
              )}`
            ).catch(() => null),
          ]
        : [];

      const [metadataRes, restoreRes] = await Promise.all([
        Promise.all(metadataRequests),
        Promise.all(restoreRequests),
      ]);

      const [yearRes, classRes, typeRes, compRes] = metadataRes;
      const loadedYears: AcademicYearOption[] = (yearRes as any)?.data || [];
      const loadedClasses: ClassSectionOption[] = (classRes as any)?.data || [];
      const loadedExamTypes: string[] = (typeRes as any)?.data || [];
      const loadedComponents: any[] = (compRes as any)?.data || [];

      setAcademicYears(loadedYears);
      setClasses(loadedClasses);
      setExamTypes(loadedExamTypes);
      setComponents(loadedComponents);

      if (hasSaved && restoreRes.length > 0) {
        const [subRes, marksEntryRes, reportRes] = restoreRes;
        if (subRes?.data && Array.isArray(subRes.data)) {
          setAvailableSubjects(subRes.data);
        }

        if (marksEntryRes?.data) {
          const marksData = marksEntryRes.data;
          const rawRoster: StudentMarkRow[] = marksData.roster || [];
          const loadedRoster = sortRosterByRollNo(rawRoster);
          setRoster(loadedRoster);

          if (marksData.config) {
            const maxM = Number(marksData.config.maxMarks) || 100;
            const passPct = Number(marksData.config.passingPercentage) || 35;
            const passM =
              marksData.config.passMarks !== undefined && marksData.config.passMarks !== null
                ? Number(marksData.config.passMarks)
                : Number(((passPct / 100) * maxM).toFixed(2));
            setExamConfig({ maxMarks: maxM, passingPercentage: passPct, passMarks: passM });
          }

          if (reportRes?.data) {
            setReportData(reportRes.data);
          }

          setActiveFilter({ ...savedFilter });
          setRosterStatus('success');
        } else {
          setRosterStatus('idle');
        }
      } else {
        setRosterStatus('idle');
      }
    } catch (err: any) {
      console.error('[Exam Page] API ERROR fetchMetadata:', err);
      setMetadataError('Failed to load academic years and exam metadata. Please click Retry.');
      setRosterStatus('idle');
    } finally {
      setIsInitialLoading(false);
      setIsFiltering(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  // ── PROGRESSIVE CASCADING DROPDOWN DERIVATION ────────────────────────────────

  // Class & Section options for selected Academic Year
  const availableClassSections = useMemo(() => {
    if (!selectedFilters.academicYearId) return [];
    return classes
      .filter(c => !c.academicYearId || c.academicYearId === selectedFilters.academicYearId)
      .sort((a, b) => {
        const nameA = a.displayName || a.label || `${a.className} - ${a.sectionName}`;
        const nameB = b.displayName || b.label || `${b.className} - ${b.sectionName}`;
        return nameA.localeCompare(nameB, undefined, { numeric: true });
      });
  }, [classes, selectedFilters.academicYearId]);

  // Resolve matching ClassSection
  const matchedClassSection = useMemo(() => {
    if (!selectedFilters.classSectionId) return null;
    return classes.find(c => c.value === selectedFilters.classSectionId) || null;
  }, [classes, selectedFilters.classSectionId]);

  // Load available subjects when Class / Section is selected
  useEffect(() => {
    const csId = selectedFilters.classSectionId;
    if (!csId) {
      setAvailableSubjects([]);
      setIsLoadingSubjects(false);
      return;
    }

    const cached = getCachedData<SubjectOption[]>(`/exams/subjects?classSectionId=${csId}`);
    if (cached && cached.length > 0) {
      setAvailableSubjects(cached);
    } else {
      setIsLoadingSubjects(true);
    }

    fastGet(`/exams/subjects?classSectionId=${csId}`, undefined, {
      ttlMs: 60000,
      onRevalidate: (fresh) => {
        if (fresh && Array.isArray(fresh)) {
          setAvailableSubjects(fresh);
        }
      },
    })
      .then((res) => {
        if (res?.data && Array.isArray(res.data)) {
          setAvailableSubjects(res.data);
        }
      })
      .catch((err) => {
        console.error('Error fetching subjects for class-section:', err);
      })
      .finally(() => {
        setIsLoadingSubjects(false);
      });
  }, [selectedFilters.classSectionId]);

  // Available components (Theory, Practical, etc.)
  const availableComponents = useMemo(() => {
    if (components && components.length > 0) {
      return components.map((c: any) => c.name || c);
    }
    return ['Theory', 'Practical'];
  }, [components]);

  // ── RESET STATE ON PARENT FILTER CHANGES (MARKS SELECTION AS UNAPPLIED) ─────

  const clearRosterAndReport = () => {
    setRoster([]);
    setReportData(null);
    setActiveFilter(null);
    setRosterStatus('idle');
    setRosterError('');
  };

  const handleYearChange = (yearId: string) => {
    setSelectedFilters({
      academicYearId: yearId,
      classSectionId: '',
      subjectId: '',
      examName: '',
      component: '',
    });
    clearRosterAndReport();
  };

  const handleClassSectionChange = (classSectionId: string) => {
    setSelectedFilters(prev => ({
      ...prev,
      classSectionId,
      subjectId: '',
      examName: '',
      component: '',
    }));
    clearRosterAndReport();
  };

  const handleSubjectChange = (subjectId: string) => {
    setSelectedFilters(prev => ({
      ...prev,
      subjectId,
      examName: '',
      component: '',
    }));
    clearRosterAndReport();
  };

  const handleExamChange = (examName: string) => {
    setSelectedFilters(prev => ({
      ...prev,
      examName,
      component: '',
    }));
    clearRosterAndReport();
  };

  const handleComponentChange = (component: string) => {
    setSelectedFilters(prev => ({
      ...prev,
      component,
    }));
    clearRosterAndReport();
  };

  // ── FILTER COMPLETENESS & PDF ENABLED STATUS ────────────────────────────────

  const isFilterComplete = Boolean(
    selectedFilters.academicYearId &&
    selectedFilters.classSectionId &&
    selectedFilters.subjectId &&
    selectedFilters.examName &&
    selectedFilters.component
  );

  const isPdfEnabled = Boolean(
    activeFilter &&
    reportData &&
    reportData.students &&
    reportData.students.length > 0 &&
    selectedFilters.academicYearId === activeFilter.academicYearId &&
    selectedFilters.classSectionId === activeFilter.classSectionId &&
    selectedFilters.subjectId === activeFilter.subjectId &&
    selectedFilters.examName === activeFilter.examName &&
    selectedFilters.component === activeFilter.component &&
    rosterStatus === 'success' &&
    !isFiltering &&
    !isDownloadingPdf
  );

  // ── TRIGGER FILTER BUTTON ───────────────────────────────────────────────────

  const handleFilter = async () => {
    if (!isFilterComplete) {
      showToast('Please select all required filters before clicking Filter.', 'error');
      return;
    }
    await executeFilterFetch(selectedFilters, matchedClassSection, false);
  };

  // ── SCORE INPUT CHANGE HANDLERS ─────────────────────────────────────────────

  const handleScoreChange = (studentId: string, valStr: string) => {
    if (valStr === '') {
      setRoster(prev =>
        prev.map(item => (item.studentId === studentId ? { ...item, marksObtained: null } : item))
      );
      return;
    }
    const valNum = Number(valStr);
    if (isNaN(valNum)) return;
    if (valNum < 0) {
      const msg = 'Marks cannot be negative.';
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
      prev.map(item => (item.studentId === studentId ? { ...item, marksObtained: valNum } : item))
    );
  };

  const handleIncrement = (studentId: string) => {
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

  // ── SAVE MARKS HANDLER ──────────────────────────────────────────────────────

  const handleSaveMarks = async () => {
    if (!matchedClassSection || !selectedFilters.subjectId || !selectedFilters.examName) {
      showToast('Please select all required filters before saving.', 'error');
      return;
    }

    const invalidEntry = roster.find(
      r => r.marksObtained !== null && (r.marksObtained > examConfig.maxMarks || r.marksObtained < 0)
    );
    if (invalidEntry) {
      const msg = `Student ${invalidEntry.name} has invalid marks (${invalidEntry.marksObtained}). Marks must be between 0 and ${examConfig.maxMarks}.`;
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
    try {
      const marksPayload = roster.map(r => ({
        studentId: r.studentId,
        marksObtained: r.marksObtained,
        remarks: r.remarks,
      }));

      await api.post('/exams/save-marks', {
        classSectionId: matchedClassSection.value,
        subjectId: selectedFilters.subjectId,
        examName: selectedFilters.examName,
        marks: marksPayload,
        subjectType: selectedFilters.component,
      });

      setSaveSuccess(true);
      showToast('Scoresheet updated. Ranks and average matrices compiled successfully.', 'success');

      // Refresh report data in background for PDF export parity
      api.get(
        `/exams/marks-report?academicYearId=${selectedFilters.academicYearId}&classId=${matchedClassSection.classId}&sectionId=${matchedClassSection.sectionId}&classSectionId=${matchedClassSection.value}&examName=${encodeURIComponent(
          selectedFilters.examName
        )}`
      ).then(res => setReportData(res.data)).catch(() => {});

      setTimeout(() => {
        setSaveSuccess(false);
      }, 4000);
    } catch (err: any) {
      console.error('Error saving marks:', err);
      const msg = err.response?.data?.message || 'Failed to save scoresheet.';
      showToast(msg, 'error');
    } finally {
      setIsSaving(false);
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
      const printableWidth = pageWidth - margin * 2;

      const dateStr = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
      const schoolTitle = (reportData.schoolName || 'CS EduTrack Institute').toUpperCase();

      // Header Banner
      doc.setFillColor(30, 41, 59); // slate-800
      doc.rect(margin, margin, printableWidth, 16, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);

      // Fit school title on top left
      const maxTitleWidth = printableWidth - 75;
      let displayTitle = schoolTitle;
      while (displayTitle.length > 4 && doc.getTextWidth(displayTitle) > maxTitleWidth) {
        displayTitle = displayTitle.slice(0, -1);
      }
      if (displayTitle !== schoolTitle) displayTitle += '..';
      doc.text(displayTitle, margin + 6, margin + 10.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225); // slate-300
      doc.text(`Generated: ${dateStr} | Total: ${reportData.totalStudents} Students`, printableWidth + margin - 6, margin + 10.5, {
        align: 'right',
      });

      // Report Info Subcard
      let y = margin + 20;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, y, printableWidth, 14, 2, 2, 'FD');

      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'bold');
      doc.text('EXAMINATION REPORT DETAILS:', margin + 4, y + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Academic Year: ${reportData.academicYear}   |   Class: ${reportData.className}   |   Section: ${reportData.sectionName}   |   School Code: ${reportData.schoolCode || '—'}`,
        margin + 54,
        y + 5.5
      );
      doc.text(
        `Exam Term: ${reportData.examType}   |   Format: Government-Style Consolidated Mark Sheet   |   Status: Validated`,
        margin + 54,
        y + 10.5
      );

      y += 18;

      // Table columns setup
      const fixedLeftCols = [
        { header: '#', key: '_sno', width: 9, align: 'center' },
        { header: 'School Code', key: '_schoolCode', width: 24, align: 'center' },
        { header: 'Admission No', key: '_admNo', width: 22, align: 'left' },
        { header: 'Roll No', key: '_rollNo', width: 16, align: 'center' },
        { header: 'Student Name', key: '_name', width: 44, align: 'left' },
        { header: 'Exam Type', key: '_examType', width: 24, align: 'left' },
      ];

      const subjects = reportData.subjects || [];
      const numSubjects = Math.max(1, subjects.length);
      const fixedLeftWidth = fixedLeftCols.reduce((sum, c) => sum + c.width, 0);
      const fixedRightWidth = 20;
      const remainingWidth = printableWidth - fixedLeftWidth - fixedRightWidth;

      const calculatedSubWidth = Math.max(13, Math.min(25, remainingWidth / numSubjects));
      const subjectCols = subjects.map(s => ({
        header: s.name,
        key: `sub_${s.name}`,
        width: calculatedSubWidth,
        align: 'center' as const,
      }));

      const totalCol = { header: 'Total Marks', key: '_total', width: fixedRightWidth, align: 'right' as const };
      const allCols = [...fixedLeftCols, ...subjectCols, totalCol];

      const totalColWidth = allCols.reduce((sum, c) => sum + c.width, 0);
      if (totalColWidth > printableWidth) {
        const scale = printableWidth / totalColWidth;
        for (const col of allCols) {
          col.width = Number((col.width * scale).toFixed(2));
        }
      }

      const fitCellText = (text: string, maxW: number) => {
        let str = String(text || '');
        if (doc.getTextWidth(str) <= maxW) return str;
        while (str.length > 2 && doc.getTextWidth(str + '..') > maxW) {
          str = str.slice(0, -1);
        }
        return str + '..';
      };

      const drawTableHeader = (curY: number) => {
        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(203, 213, 225);
        doc.rect(margin, curY, printableWidth, 7.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);

        let curX = margin;
        for (const c of allCols) {
          const posX = c.align === 'right' ? curX + c.width - 2 : c.align === 'center' ? curX + c.width / 2 : curX + 2;
          let text = fitCellText(c.header, c.width - 2);
          doc.text(text, posX, curY + 5, { align: c.align as any });
          curX += c.width;
        }
        return curY + 7.5;
      };

      y = drawTableHeader(y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);

      // Sort students numerically by roll number: 1, 2, 3, ..., 10, 11...
      const parseRoll = (r?: string | null) => {
        if (!r) return { num: Infinity, str: '' };
        const trimmed = String(r).trim();
        const match = trimmed.match(/^(\d+)(.*)$/);
        if (match) {
          return { num: parseInt(match[1], 10), str: match[2] };
        }
        const num = parseInt(trimmed, 10);
        return isNaN(num) ? { num: Infinity, str: trimmed } : { num, str: '' };
      };

      const students = [...(reportData.students || [])].sort((a, b) => {
        const rollA = parseRoll(a.rollNo);
        const rollB = parseRoll(b.rollNo);
        if (rollA.num !== rollB.num) return rollA.num - rollB.num;
        if (rollA.str !== rollB.str) return rollA.str.localeCompare(rollB.str);
        return (a.studentName || '').localeCompare(b.studentName || '');
      });

      for (let i = 0; i < students.length; i++) {
        const item = students[i];
        const rowHeight = 6.8;

        if (y + rowHeight > pageHeight - margin - 8) {
          doc.setFontSize(7);
          doc.setTextColor(148, 163, 184);
          doc.text(`Page ${doc.getNumberOfPages()} | Generated via CS EduTrack Examination Platform`, pageWidth / 2, pageHeight - 6, { align: 'center' });

          doc.addPage();
          y = margin;
          y = drawTableHeader(y);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
        }

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
        doc.text(String(i + 1), curX + allCols[0].width / 2, y + 4.6, { align: 'center' });
        curX += allCols[0].width;

        // 2. School Code
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        const sCodeText = fitCellText(reportData.schoolCode || '—', allCols[1].width - 2);
        doc.text(sCodeText, curX + allCols[1].width / 2, y + 4.6, { align: 'center' });
        curX += allCols[1].width;

        // 3. Admission No
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        const admNoText = fitCellText(item.admissionNo || '—', allCols[2].width - 2);
        doc.text(admNoText, curX + 2, y + 4.6);
        curX += allCols[2].width;

        // 4. Roll No
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(String(item.rollNo || '—'), curX + allCols[3].width / 2, y + 4.6, { align: 'center' });
        curX += allCols[3].width;

        // 5. Student Name
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        const sName = fitCellText(item.studentName || 'Student', allCols[4].width - 3);
        doc.text(sName, curX + 2, y + 4.6);
        curX += allCols[4].width;

        // 6. Exam Type
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        const exType = fitCellText(reportData.examType || 'Exam', allCols[5].width - 3);
        doc.text(exType, curX + 2, y + 4.6);
        curX += allCols[5].width;

        // 7. Dynamic Subject Columns
        doc.setFont('helvetica', 'normal');
        for (let sIdx = 0; sIdx < subjects.length; sIdx++) {
          const sub = subjects[sIdx];
          const colDef = subjectCols[sIdx];
          const markVal = item.marks[sub.name];
          const posX = curX + colDef.width / 2;

          if (markVal === 'AB') {
            doc.setTextColor(225, 29, 72);
            doc.setFont('helvetica', 'bold');
            doc.text('AB', posX, y + 4.6, { align: 'center' });
          } else if (markVal === '—' || markVal === null || markVal === undefined) {
            doc.setTextColor(148, 163, 184);
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

      // Final footer
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${doc.getNumberOfPages()} | Generated via CS EduTrack Examination Platform`, pageWidth / 2, pageHeight - 6, { align: 'center' });

      const safeClass = (reportData.className || 'Class').replace(/[^a-zA-Z0-9]/g, '_');
      const safeSec = (reportData.sectionName || 'Sec').replace(/[^a-zA-Z0-9]/g, '_');
      const safeExam = (reportData.examType || 'Exam').replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`Marks_Report_${safeClass}_${safeSec}_${safeExam}.pdf`);
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

  // ── GRADE BADGE HELPER ──────────────────────────────────────────────────────

  const getGradeInfo = (score: number | null) => {
    if (score === null) return { letter: '—', color: 'bg-slate-50 text-slate-400 border-slate-200', result: null };
    const passMarks = examConfig.passMarks !== undefined
      ? examConfig.passMarks
      : Number(((examConfig.passingPercentage / 100) * examConfig.maxMarks).toFixed(2));
    const maxM = examConfig.maxMarks;
    const pct = maxM > 0 ? (score / maxM) * 100 : score;
    const pass = score >= passMarks;
    if (pct >= 90) return { letter: 'A+', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', result: pass };
    if (pct >= 80) return { letter: 'A', color: 'bg-emerald-50 text-emerald-500 border-emerald-100', result: pass };
    if (pct >= 70) return { letter: 'B+', color: 'bg-blue-50 text-[#2E5BFF] border-blue-100', result: pass };
    if (pct >= 60) return { letter: 'B', color: 'bg-slate-50 text-slate-600 border-slate-200', result: pass };
    if (pct >= 50) return { letter: 'C', color: 'bg-amber-50 text-amber-600 border-amber-100', result: pass };
    if (pct >= 35) return { letter: 'D', color: 'bg-orange-50 text-orange-600 border-orange-100', result: pass };
    return { letter: 'F', color: 'bg-rose-50 text-rose-600 border-rose-100', result: false };
  };

  // ── STATISTICS COMPUTATIONS ─────────────────────────────────────────────────

  const validScores = roster.map(r => r.marksObtained).filter((s): s is number => s !== null);
  const classAverage = validScores.length > 0 ? Math.round(validScores.reduce((sum, val) => sum + val, 0) / validScores.length) : 0;
  const highestMarks = validScores.length > 0 ? Math.max(...validScores) : 0;

  // Resolved display names for scoring matrix header
  const currentSubjectName = availableSubjects.find(s => s.id === selectedFilters.subjectId)?.name || 'Subject';
  const currentClassSectionLabel = matchedClassSection?.displayName || matchedClassSection?.label || (matchedClassSection ? `${matchedClassSection.className} - ${matchedClassSection.sectionName}` : 'Class & Section');

  // ── INITIAL SKELETON LOADING ────────────────────────────────────────────────
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 bg-slate-200 rounded w-20"></div>
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

      {/* ── METADATA ERROR BANNER ────────────────────────────────────────────── */}
      {metadataError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3">
            <X className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="font-semibold">{metadataError}</span>
          </div>
          <button
            onClick={() => {
              setMetadataError('');
              fetchMetadata();
            }}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Metadata
          </button>
        </div>
      )}

      {/* ── UNIFIED FILTER CARD (SINGLE SOURCE OF TRUTH) ────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Select Exam Cohort & Subject</h3>
              <p className="text-[11px] font-medium text-slate-500">
                Choose Academic Year, Class / Section, Subject, Exam Term, and Component to load students.
              </p>
            </div>
          </div>
          {activeFilter && rosterStatus === 'success' && (
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-700 text-xs font-bold">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Active Filter: {roster.length} Students</span>
            </div>
          )}
        </div>

        {/* 5 Cascading Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-3.5 text-xs font-bold">
          {/* 1. Academic Year */}
          <div>
            <label className="block text-slate-500 mb-1.5 uppercase tracking-wider text-[10px]">
              Academic Year <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedFilters.academicYearId}
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

          {/* 2. Class / Section */}
          <div>
            <label className="block text-slate-500 mb-1.5 uppercase tracking-wider text-[10px]">
              Class / Section <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedFilters.classSectionId}
              onChange={(e) => handleClassSectionChange(e.target.value)}
              disabled={!selectedFilters.academicYearId || availableClassSections.length === 0}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold outline-none focus:border-blue-600 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
            >
              <option value="">Select Class / Section</option>
              {availableClassSections.map((cs) => (
                <option key={cs.value} value={cs.value}>
                  {cs.displayName || cs.label || `${cs.className} - ${cs.sectionName}`}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Subject */}
          <div>
            <label className="block text-slate-500 mb-1.5 uppercase tracking-wider text-[10px]">
              Subject <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedFilters.subjectId}
              onChange={(e) => handleSubjectChange(e.target.value)}
              disabled={!selectedFilters.classSectionId || isLoadingSubjects || availableSubjects.length === 0}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold outline-none focus:border-blue-600 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
            >
              <option value="">
                {!selectedFilters.classSectionId
                  ? 'Select Class / Section first'
                  : isLoadingSubjects
                  ? 'Loading subjects...'
                  : availableSubjects.length === 0
                  ? 'No subjects found'
                  : 'Select Subject'}
              </option>
              {availableSubjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Exam Term */}
          <div>
            <label className="block text-slate-500 mb-1.5 uppercase tracking-wider text-[10px]">
              Exam Term <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedFilters.examName}
              onChange={(e) => handleExamChange(e.target.value)}
              disabled={!selectedFilters.subjectId || examTypes.length === 0}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold outline-none focus:border-blue-600 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
            >
              <option value="">Select Exam Type</option>
              {examTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Component */}
          <div>
            <label className="block text-slate-500 mb-1.5 uppercase tracking-wider text-[10px]">
              Component <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedFilters.component}
              onChange={(e) => handleComponentChange(e.target.value)}
              disabled={!selectedFilters.examName}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold outline-none focus:border-blue-600 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
            >
              <option value="">Select Component</option>
              {availableComponents.map((comp) => (
                <option key={comp} value={comp}>
                  {comp}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons: Filter & Download PDF */}
        <div className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleFilter}
            disabled={!isFilterComplete || isFiltering}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
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

      {/* ── SAVE SUCCESS BANNER ──────────────────────────────────────────────── */}
      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-3 text-sm animate-in fade-in duration-200">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">Scoresheet updated. Ranks and average matrices compiled successfully.</span>
        </div>
      )}

      {/* ── MUTUALLY EXCLUSIVE CONTENT STATES ───────────────────────────────── */}

      {/* STATE 1: IDLE (User has not clicked Filter yet) */}
      {rosterStatus === 'idle' && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-8 sm:p-12 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mx-auto shadow-xs">
            <Layers className="w-6 h-6 text-blue-600" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h4 className="text-sm font-bold text-slate-800">Select Filters & Click Filter</h4>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Please select Academic Year, Class / Section, Subject, Exam Term, and Component above, then click{' '}
              <strong className="text-slate-700">Filter</strong> to load the student scoresheet and enter marks.
            </p>
          </div>
        </div>
      )}

      {/* STATE 2: LOADING (Centered Animated Loading Spinner) */}
      {rosterStatus === 'loading' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 flex flex-col items-center justify-center min-h-[320px] text-center shadow-sm space-y-4">
          <div className="relative flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center shadow-inner">
              <LoadingSpinner size="lg" variant="brand" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-600"></span>
            </span>
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-800">Loading Student Scoresheet...</h4>
            <p className="text-xs text-slate-500 font-medium">Retrieving student roster, existing marks, and grading configuration</p>
          </div>
          <div className="w-40 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full animate-pulse w-3/4"></div>
          </div>
        </div>
      )}

      {/* STATE 3: ERROR (API Failure with Retry) */}
      {rosterStatus === 'error' && (
        <div className="bg-white border border-rose-200 rounded-2xl p-8 sm:p-12 flex flex-col items-center justify-center text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-xs">
            <AlertTriangle className="w-6 h-6 text-rose-600" />
          </div>
          <div className="space-y-1 max-w-md">
            <h4 className="text-sm font-bold text-slate-800">Failed to load student roster</h4>
            <p className="text-xs text-slate-500 font-medium">{rosterError || 'An error occurred while fetching student marks roster.'}</p>
          </div>
          <button
            onClick={handleFilter}
            className="mt-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Loading Roster</span>
          </button>
        </div>
      )}

      {/* STATE 4: SUCCESS WITH ZERO RECORDS */}
      {rosterStatus === 'success' && roster.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 text-xs font-semibold shadow-xs">
          No students enrolled in the selected class and section.
        </div>
      )}

      {/* STATE 5: SUCCESS WITH RECORDS (Interactive Scoring Matrix & KPIs) */}
      {rosterStatus === 'success' && roster.length > 0 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* KPI Statistics */}
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
                  {roster.length} Students
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
                  {examConfig.passMarks !== undefined
                    ? examConfig.passMarks
                    : ((examConfig.passingPercentage / 100) * examConfig.maxMarks).toFixed(1)}{' '}
                  / {examConfig.maxMarks} ({examConfig.passingPercentage}%)
                </span>
              </div>
            </div>
          </div>

          {/* Scoring Matrix Table Card */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Scoring Matrix: {currentSubjectName} ({selectedFilters.component}) — Max Marks: {examConfig.maxMarks}
                </h3>
                <span className="text-[11px] text-slate-500 font-semibold block mt-0.5">
                  {currentClassSectionLabel} · {selectedFilters.examName}
                </span>
              </div>
              <button
                onClick={handleSaveMarks}
                disabled={isSaving || roster.length === 0}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white font-semibold text-xs sm:text-[13px] flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
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

            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
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
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  gr.result
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
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
                                prev.map(item => (item.studentId === s.studentId ? { ...item, remarks: val } : item))
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
            </div>
          </div>
        </div>
      )}

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
