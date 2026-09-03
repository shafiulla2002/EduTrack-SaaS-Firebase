'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useSchoolSetupUpdate } from '@/lib/events';
import { 
  Plus, X, Search, ChevronDown, ChevronUp, Users, 
  BookOpen, Grid3X3, BarChart3, Clock, Upload, 
  Calendar, Layers, Trash2, Edit2, AlertCircle, ArrowLeft, ArrowRight, Check, Award, Settings
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import BulkTeacherImportModal from '@/components/BulkTeacherImportModal';

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#667eea,#764ba2)',
  'linear-gradient(135deg,#f093fb,#f5576c)',
  'linear-gradient(135deg,#4facfe,#00f2fe)',
  'linear-gradient(135deg,#43e97b,#38f9d7)',
  'linear-gradient(135deg,#fa709a,#fee140)',
  'linear-gradient(135deg,#a18cd1,#fbc2eb)',
  'linear-gradient(135deg,#fd7043,#ff8a65)',
  'linear-gradient(135deg,#26c6da,#00acc1)',
];

const SCHOOL_DAYS = [
  { day: 'Monday', dayLabel: 'Monday', dayShort: 'MON' },
  { day: 'Tuesday', dayLabel: 'Tuesday', dayShort: 'TUE' },
  { day: 'Wednesday', dayLabel: 'Wednesday', dayShort: 'WED' },
  { day: 'Thursday', dayLabel: 'Thursday', dayShort: 'THU' },
  { day: 'Friday', dayLabel: 'Friday', dayShort: 'FRI' },
  { day: 'Saturday', dayLabel: 'Saturday', dayShort: 'SAT' },
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TODAY_DAY_NAME = DAY_NAMES[new Date().getDay()] === 'Sunday' ? 'Monday' : DAY_NAMES[new Date().getDay()];

interface Teacher {
  id: string;
  name: string;
  initials: string;
  subjects: string[];
  classCount: number;
  loadPercent: number;
  gradient: string;
}

interface ClassSection {
  id: string;
  classId?: string;
  name: string;
  academicYear: string;
  academicYearId?: string;
  subjectCount: number;
  staffedCount: number;
  loadPercent: number;
}

export default function TeacherClassManagement() {
  const { showToast } = useToast();
  
  // ── CORE STATE ──
  const [currentStep, setCurrentStep] = useState(0); // 0: Dashboard, 1: Step1, 2: Step2, 3: Step3
  const [isTimetableView, setIsTimetableView] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [availableClasses, setAvailableClasses] = useState<any[]>([]);
  const [availableSections, setAvailableSections] = useState<any[]>([]);
  
  const [teacherSearch, setTeacherSearch] = useState('');
  const [classSearch, setClassSearch] = useState('');
  
  // ── EXPANDED INLINE DRAWER STATE ──
  const [expandedTeacherId, setExpandedTeacherId] = useState<string | null>(null);
  const [teacherDetail, setTeacherDetail] = useState<any | null>(null);
  const [teacherDetailLoading, setTeacherDetailLoading] = useState(false);
  const [isWeeklyExpanded, setIsWeeklyExpanded] = useState(true);
  const [isTodayExpanded, setIsTodayExpanded] = useState(true);
  
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [classDetail, setClassDetail] = useState<any | null>(null);
  const [classDetailLoading, setClassDetailLoading] = useState(false);
  const [isClassTodayExpanded, setIsClassTodayExpanded] = useState(true);
  
  // ── WORKLOAD SUMMARY ──
  const [workloadSummary, setWorkloadSummary] = useState({
    totalTeachers: 0,
    totalClasses: 0,
    totalAssignments: 0,
    avgLoadPercent: 0
  });

  const [assignSubjectId, setAssignSubjectId] = useState('');

  // ── NEW TEACHER FORM STATE ──
  const [showTeacherForm, setShowTeacherForm] = useState(false);
  const [newTeacher, setNewTeacher] = useState({
    firstName: '', lastName: '', email: '', phone: '', gender: '',
    dob: '', qualification: '', joiningDate: '', address: '',
    basicSalary: 30000, hra: 3600, da: 2400, pf: 1500,
    accountNumber: '', ifsc: '',
    skills: [{ subjectId: '', skillLevel: 'Expert', yearsOfExperience: 5 }]
  });
  
  // ── STEP 1: NEW CLASS SECTION STATE ──
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [classStrength, setClassStrength] = useState('');
  const [showInlineAddClass, setShowInlineAddClass] = useState(false);
  const [newClassNameInline, setNewClassNameInline] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  
  // ── STEP 2: CHOOSE SUBJECTS STATE ──
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [subjectSearchTerm, setSubjectSearchTerm] = useState('');
  
  // ── STEP 3: ASSIGN TEACHERS STATE ──
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // ── TIMETABLE EDITOR STATE ──
  const [ttSelectedClassSectionId, setTtSelectedClassSectionId] = useState('');
  const [ttSelectedAcademicYear, setTtSelectedAcademicYear] = useState('');
  const [ttFrequency, setTtFrequency] = useState('Weekly');
  const [ttDuration, setTtDuration] = useState<number>(1);
  const [ttStartDate, setTtStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [ttEndDate, setTtEndDate] = useState('');

  const calculateEndDate = (startDateStr: string, frequency: string, durationVal: number) => {
    if (!startDateStr) return '';
    const date = new Date(startDateStr);
    if (isNaN(date.getTime())) return '';

    const duration = Math.max(1, durationVal);

    if (frequency === 'Daily' || frequency === 'Day') {
      date.setDate(date.getDate() + duration);
    } else if (frequency === 'Weekly') {
      date.setDate(date.getDate() + (duration * 7));
    } else if (frequency === 'Monthly' || frequency === 'Month') {
      date.setMonth(date.getMonth() + duration);
    } else if (frequency === 'Yearly' || frequency === 'Year') {
      date.setFullYear(date.getFullYear() + duration);
    }

    return date.toISOString().split('T')[0];
  };

  // Recalculate End Date when Start Date, Frequency, or Duration changes
  useEffect(() => {
    const computedEnd = calculateEndDate(ttStartDate, ttFrequency, ttDuration);
    if (computedEnd) {
      setTtEndDate(computedEnd);
    }
  }, [ttStartDate, ttFrequency, ttDuration]);

  // ── TIMETABLE CONFIGURATION STATE ──
  const [isTimetableConfigView, setIsTimetableConfigView] = useState(false);
  const [workingDays, setWorkingDays] = useState<string[]>(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
  const [schoolStartTime, setSchoolStartTime] = useState('09:00 AM');
  const [schoolEndTime, setSchoolEndTime] = useState('04:00 PM');
  const [periodDuration, setPeriodDuration] = useState(45);
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [numPeriods, setNumPeriods] = useState(8);
  const [configPeriodsList, setConfigPeriodsList] = useState<any[]>([]);
  const [configBreaksList, setConfigBreaksList] = useState<any[]>([{ name: 'Lunch Break', startTime: '12:45 PM', endTime: '01:30 PM' }]);
  const [configErrors, setConfigErrors] = useState<string[]>([]);
  const [showConfirmChangeConfigModal, setShowConfirmChangeConfigModal] = useState(false);

  // ── TIMETABLE CONFIGURATION LOGIC ──
  const parseTimeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const match = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
    if (!match) return 0;
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && hours !== 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const formatMinutesToTime = (totalMinutes: number): string => {
    let hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const hoursStr = hours.toString().padStart(2, '0');
    const minutesStr = minutes.toString().padStart(2, '0');
    return `${hoursStr}:${minutesStr} ${ampm}`;
  };

  const handleAutoGenerateTimetable = () => {
    setConfigErrors([]);
    const startMins = parseTimeToMinutes(schoolStartTime);
    const endMins = parseTimeToMinutes(schoolEndTime);
    
    if (startMins >= endMins) {
      setConfigErrors(['School End Time must be after School Start Time.']);
      return;
    }

    const sortedBreaks = [...configBreaksList].sort((a, b) => {
      return parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime);
    });

    const generated: any[] = [];
    let currentMins = startMins;
    let periodIndex = 1;

    for (let i = 0; i < numPeriods; i++) {
      let breakInserted = true;
      while (breakInserted) {
        breakInserted = false;
        const matchingBreak = sortedBreaks.find(b => {
          const bStart = parseTimeToMinutes(b.startTime);
          return bStart >= currentMins && bStart < currentMins + periodDuration;
        });

        if (matchingBreak) {
          const bStart = parseTimeToMinutes(matchingBreak.startTime);
          const bEnd = parseTimeToMinutes(matchingBreak.endTime);
          
          if (bStart > currentMins) {
            generated.push({
              periodNumber: periodIndex,
              name: `P${periodIndex}`,
              startTime: formatMinutesToTime(currentMins),
              endTime: formatMinutesToTime(bStart),
              isBreak: false
            });
            periodIndex++;
            currentMins = bStart;
          }
          
          generated.push({
            periodNumber: periodIndex,
            name: matchingBreak.name,
            startTime: formatMinutesToTime(bStart),
            endTime: formatMinutesToTime(bEnd),
            isBreak: true
          });
          periodIndex++;
          currentMins = bEnd;
          breakInserted = true;
        }
      }

      if (currentMins >= endMins) break;

      const nextEnd = currentMins + periodDuration;
      generated.push({
        periodNumber: periodIndex,
        name: `P${periodIndex}`,
        startTime: formatMinutesToTime(currentMins),
        endTime: formatMinutesToTime(Math.min(nextEnd, endMins)),
        isBreak: false
      });
      periodIndex++;
      currentMins = nextEnd;
    }

    sortedBreaks.forEach(b => {
      const bStart = parseTimeToMinutes(b.startTime);
      const bEnd = parseTimeToMinutes(b.endTime);
      if (bStart >= currentMins && bStart < endMins) {
        generated.push({
          periodNumber: periodIndex,
          name: b.name,
          startTime: formatMinutesToTime(bStart),
          endTime: formatMinutesToTime(bEnd),
          isBreak: true
        });
        periodIndex++;
        currentMins = bEnd;
      }
    });

    setConfigPeriodsList(generated);
  };

  const validateTimetableConfig = (periodsToValidate: any[]): boolean => {
    const errors: string[] = [];
    const schoolStart = parseTimeToMinutes(schoolStartTime);
    const schoolEnd = parseTimeToMinutes(schoolEndTime);

    if (schoolStart >= schoolEnd) {
      errors.push('School End Time must be after School Start Time.');
    }

    if (workingDays.length === 0) {
      errors.push('Please select at least one working day.');
    }

    for (let i = 0; i < periodsToValidate.length; i++) {
      const pt = periodsToValidate[i];
      const ptStart = parseTimeToMinutes(pt.startTime);
      const ptEnd = parseTimeToMinutes(pt.endTime);

      if (!pt.name.trim()) {
        errors.push(`Slot ${i + 1}: Name cannot be empty.`);
      }

      if (ptStart >= ptEnd) {
        errors.push(`Slot "${pt.name}": End Time (${pt.endTime}) must be after Start Time (${pt.startTime}).`);
        continue;
      }

      if (ptStart < schoolStart || ptEnd > schoolEnd) {
        errors.push(`Slot "${pt.name}": Timing (${pt.startTime} - ${pt.endTime}) must fall within school working hours (${schoolStartTime} - ${schoolEndTime}).`);
      }

      for (let j = i + 1; j < periodsToValidate.length; j++) {
        const other = periodsToValidate[j];
        const otherStart = parseTimeToMinutes(other.startTime);
        const otherEnd = parseTimeToMinutes(other.endTime);

        if (ptStart < otherEnd && ptEnd > otherStart) {
          errors.push(`Conflict: Slot "${pt.name}" (${pt.startTime} - ${pt.endTime}) overlaps with Slot "${other.name}" (${other.startTime} - ${other.endTime}).`);
        }
      }
    }

    setConfigErrors(errors);
    return errors.length === 0;
  };

  const loadConfigPeriods = async () => {
    try {
      setIsLoading(true);
      const [configRes, timingsRes] = await Promise.all([
        api.get('/timetable/config'),
        api.get('/timetable/period-timings')
      ]);

      if (configRes.data) {
        setWorkingDays(configRes.data.workingDays || []);
        setSchoolStartTime(configRes.data.schoolStartTime);
        setSchoolEndTime(configRes.data.schoolEndTime);
        setPeriodDuration(configRes.data.periodDuration);
        setAutoGenerate(configRes.data.autoGenerate);
        setNumPeriods(configRes.data.numPeriods);
      }

      if (timingsRes.data) {
        setConfigPeriodsList(timingsRes.data);
        const breaks = timingsRes.data.filter((t: any) => t.isBreak).map((t: any) => ({
          name: t.name,
          startTime: t.startTime,
          endTime: t.endTime
        }));
        setConfigBreaksList(breaks.length > 0 ? breaks : [{ name: 'Lunch Break', startTime: '12:45 PM', endTime: '01:30 PM' }]);
      }
    } catch (err) {
      console.error('Failed to load config details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveConfig = async (force: boolean = false) => {
    if (!validateTimetableConfig(configPeriodsList)) {
      showToast('Timetable configuration has validation errors.', 'error');
      return;
    }

    try {
      setIsLoading(true);
      if (!force) {
        const checkRes = await api.get('/timetable/config/check-existing');
        if (checkRes.data?.hasExistingTimetables) {
          setShowConfirmChangeConfigModal(true);
          setIsLoading(false);
          return;
        }
      }

      await api.post('/timetable/config', {
        workingDays,
        schoolStartTime,
        schoolEndTime,
        periodDuration,
        autoGenerate,
        numPeriods,
        periods: configPeriodsList.map(pt => ({
          id: pt.id,
          periodNumber: Number(pt.periodNumber),
          name: pt.name,
          isBreak: pt.isBreak || false,
          startTime: pt.startTime,
          endTime: pt.endTime
        }))
      });

      showToast('Timetable configuration saved successfully.', 'success');
      setShowConfirmChangeConfigModal(false);
      setIsTimetableConfigView(false);
      await loadWorkloadDashboard();
    } catch (err: any) {
      console.error('Failed to save config:', err);
      showToast(err.response?.data?.message || 'Failed to save configuration.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isTimetableConfigView) {
      loadConfigPeriods();
    }
  }, [isTimetableConfigView]);

  const [showTimetableGrid, setShowTimetableGrid] = useState(false);
  const [timetableData, setTimetableData] = useState<Record<string, { subject: string; teacherId: string }>>({});
  const [classSubjects, setClassSubjects] = useState<any[]>([]);
  const [subjectTeachers, setSubjectTeachers] = useState<Record<string, any[]>>({});
  const [timings, setTimings] = useState<any[]>([]);
  const [ttSelectedClassName, setTtSelectedClassName] = useState('');

  // ── REASSIGN TEACHER MODAL STATE ──
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignContext, setReassignContext] = useState<any>({});
  const [reassignNewTeacherId, setReassignNewTeacherId] = useState('');
  const [reassignPeriodsPerWeek, setReassignPeriodsPerWeek] = useState(5);
  const [reassignTeacherOptions, setReassignTeacherOptions] = useState<any[]>([]);

  // ── SUBSTITUTE TEACHER MODAL STATE ──
  const [showSubstituteModal, setShowSubstituteModal] = useState(false);
  const [substituteContext, setSubstituteContext] = useState<any>({});
  const [substituteTeacherId, setSubstituteTeacherId] = useState('');
  const [substituteTeacherOptions, setSubstituteTeacherOptions] = useState<any[]>([]);



  // ── CSV IMPORT & SINGLE ENTRY STATICS ──
  const [showImportTeachers, setShowImportTeachers] = useState(false);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [showCreateSection, setShowCreateSection] = useState(false);
  const [subjectsListInput, setSubjectsListInput] = useState([{ id: 1, name: '' }]);
  const [classNamesInput, setClassNamesInput] = useState([{ id: 1, name: '' }]);
  const [existingClasses, setExistingClasses] = useState<any[]>([]);
  const [newSectionName, setNewSectionName] = useState('');

  // ── DELETE CONFIRMATION STATE ──
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    type: 'class' | 'teacher';
    id: string;
    classId?: string;
    name: string;
  }>({
    show: false,
    type: 'class',
    id: '',
    name: ''
  });

  // ── MANAGE EXAM TYPES STATE ──
  const [isManageTypesOpen, setIsManageTypesOpen] = useState(false);
  const [manageTypesList, setManageTypesList] = useState<any[]>([]);
  const [newTypeName, setNewTypeName] = useState('');
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeName, setEditingTypeName] = useState('');
  const [isSavingType, setIsSavingType] = useState(false);
  const [typeError, setTypeError] = useState('');

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
    } catch (err: any) {
      setTypeError(err.response?.data?.message || 'Failed to delete exam type.');
    }
  };

  const getLoadColor = (pct: number) => {
    if (pct < 50) return '#10b981'; // Green
    if (pct < 85) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  };

  const getLoadBg = (pct: number) => {
    if (pct < 50) return '#ecfdf5';
    if (pct < 85) return '#fffbeb';
    return '#fef2f2';
  };

  // ── LOAD DASHBOARD METRICS & LISTS ──
  const loadWorkloadDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/timetable/workload/dashboard');
      const data = res.data;

      if (data) {
        setWorkloadSummary(data.summary || {
          totalTeachers: 0,
          totalClasses: 0,
          totalAssignments: 0,
          avgLoadPercent: 0
        });

        const mappedTeachers: Teacher[] = (data.teachers || []).map((t: any, idx: number) => ({
          id: t.teacherId,
          name: t.teacherName || 'Unknown Teacher',
          initials: (t.teacherName || 'TT').split(' ').map((n: string) => n[0] || '').join('').substring(0, 2).toUpperCase(),
          subjects: t.subjectsTaught || [],
          classCount: t.classCount || 0,
          loadPercent: Math.min(100, t.loadPercent || 0),
          gradient: AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]
        }));
        setTeachers(mappedTeachers);

        const mappedClasses: ClassSection[] = (data.classes || []).map((c: any) => ({
          id: c.classSectionId,
          classId: c.classId,
          name: c.name || 'Unknown Class',
          academicYear: c.academicYear || '2026-2027',
          subjectCount: c.subjectCount || 0,
          staffedCount: c.staffedCount || 0,
          loadPercent: c.loadPercent || 0
        }));
        setClasses(mappedClasses);

        const rawTimings = data.periodTimings || [];
        const sortedTimings = [...rawTimings].sort((a: any, b: any) => (a.periodNumber ?? a.num ?? 0) - (b.periodNumber ?? b.num ?? 0));
        let displayCount = 1;
        const mappedTimings = sortedTimings.map((pt: any) => {
          const isBreak = pt.isBreak ?? false;
          const displayLabel = isBreak ? (pt.name || 'Break') : `Period ${displayCount}`;
          const displayNum = isBreak ? null : displayCount;
          if (!isBreak) {
            displayCount++;
          }
          return {
            ...pt,
            id: pt.id,
            num: pt.periodNumber ?? pt.num,
            label: displayLabel,
            displayPeriodNumber: displayNum,
            startTime: pt.startTime,
            endTime: pt.endTime,
            isBreak
          };
        });
        setTimings(mappedTimings);

        setAllSubjects(data.subjects || []);
        setAcademicYears(data.academicYears || []);
        setAvailableSections(data.sections || []);

        if (data.config) {
          setWorkingDays(data.config.workingDays || []);
          setSchoolStartTime(data.config.schoolStartTime);
          setSchoolEndTime(data.config.schoolEndTime);
          setPeriodDuration(data.config.periodDuration);
          setAutoGenerate(data.config.autoGenerate);
          setNumPeriods(data.config.numPeriods);
        }

        const activeYear = (data.academicYears || []).find((y: any) => y.isActive) || data.academicYears?.[0];
        if (activeYear) {
          setSelectedAcademicYear(activeYear.id);
          setTtSelectedAcademicYear(activeYear.id);
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkloadDashboard();
  }, [loadWorkloadDashboard]);

  // ── INLINE TEACHER DETAILS FETCHING ──
  const fetchTeacherDetail = useCallback(async (teacherId: string) => {
    setTeacherDetailLoading(true);
    try {
      const [workloadRes, periodsRes, leasersRes] = await Promise.all([
        api.get(`/timetable/workload/teacher/${teacherId}`),
        api.get(`/timetable/teacher/${teacherId}/periods?gaps=true`),
        api.get(`/timetable/teacher/${teacherId}/leaser-periods`)
      ]);
      
      const details = workloadRes.data;
      const skillsRes = await api.get(`/timetable/teachers/${teacherId}/skills`);

      // Parse schedule periods — backend returns normalized flat fields
      const allPeriods: any[] = periodsRes.data || [];
      const leaserPeriods: any[] = leasersRes.data || [];

      // Combine and mark leaser periods
      const leaserSet = new Set(leaserPeriods.map((p: any) => p.periodId));

      // Helper to build a period card from a raw period record
      const buildCard = (p: any) => {
        const isLeaser = leaserSet.has(p.periodId) || p.isLeaser === true || p.isFreePeriod === true;
        return {
          key: p.periodId,
          periodNumber: p.periodNumber,
          subjectName: p.isFreePeriod ? 'Free Period' : (p.subjectName || '—'),
          className: p.isFreePeriod ? 'No class assigned' : (p.className || '—'),
          classSectionId: p.classSectionId || '',
          academicYearId: p.academicYearId || '',
          startDate: p.startDate || '',
          endDate: p.endDate || '',
          startTime: p.startTime || '',
          endTime: p.endTime || '',
          frequency: p.frequency || 'Weekly',
          isLeaser,
          leaserType: p.isFreePeriod ? 'FREE' : 'LEASER',
          substituteTeacher: isLeaser && p.substituteTeacherName ? p.substituteTeacherName : null,
        };
      };

      // ── WEEKLY: group ALL periods by day (for Weekly Schedule) ──
      const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const weeklyDayMap: Record<string, any[]> = {};
      allPeriods.forEach((p: any) => {
        const day = p.day || 'Monday';
        if (!weeklyDayMap[day]) weeklyDayMap[day] = [];
        weeklyDayMap[day].push(buildCard(p));
      });
      const weeklyPeriods = DAY_ORDER
        .filter(d => weeklyDayMap[d] && weeklyDayMap[d].length > 0)
        .map(dayName => ({
          day: dayName,
          dayShort: dayName.substring(0, 3).toUpperCase(),
          periods: weeklyDayMap[dayName].sort((a: any, b: any) => a.periodNumber - b.periodNumber),
        }));

      // ── TODAY: filter only today's periods (for Today's Schedule) ──
      const todayPeriodsFiltered = allPeriods.filter((p: any) => p.day === TODAY_DAY_NAME);
      const todayDayMap: Record<string, any[]> = {};
      todayPeriodsFiltered.forEach((p: any) => {
        const day = p.day || TODAY_DAY_NAME;
        if (!todayDayMap[day]) todayDayMap[day] = [];
        todayDayMap[day].push(buildCard(p));
      });
      const todayDayGroupList = Object.keys(todayDayMap).map(dayName => ({
        day: dayName,
        dayShort: dayName.substring(0, 3).toUpperCase(),
        periods: todayDayMap[dayName].sort((a: any, b: any) => a.periodNumber - b.periodNumber),
      }));

      setTeacherDetail({
        id: teacherId,
        totalAssignments: details.classes?.reduce((sum: number, c: any) => sum + (c.subjects?.length || 0), 0) || 0,
        classCount: details.classes?.length || 0,
        subjects: details.classes?.flatMap((c: any) => (c.subjects || []).map((s: any) => ({
          uniqueKey: `${s.assignmentId}_${c.classSectionId}`,
          assignmentId: s.assignmentId,
          subjectId: s.subjectId,
          subjectName: s.subjectName,
          className: c.className,
          periodsPerWeek: s.periodsPerWeek || 5,
        }))) || [],
        // FIX: backend returns flat subjectName; use s.subjectName first
        skills: (skillsRes.data || []).map((s: any) => ({
          id: s.id,
          subjectName: s.subjectName || s.subject?.name || 'Unknown Subject',
          skillLevel: s.skillLevel || 'Expert',
          yearsOfExperience: s.yearsOfExperience || 0,
        })),
        weeklyPeriods,                           // All days → Weekly Schedule
        timetablePeriods: todayDayGroupList,     // Today only → Today's Schedule
        hasTimetable: weeklyPeriods.length > 0,  // true when any saved period exists
        hasTodayTimetable: todayDayGroupList.length > 0,
        hasLeaserToday: todayDayGroupList.some((dg: any) => dg.periods.some((p: any) => p.isLeaser && p.leaserType === 'LEASER')),
        hasFreeToday: todayDayGroupList.some((dg: any) => dg.periods.some((p: any) => p.isLeaser && p.leaserType === 'FREE')),
      });
    } catch (err) {
      console.error('Failed to load teacher detail:', err);
      showToast('Error loading teacher workload detailed view.', 'error');
    } finally {
      setTeacherDetailLoading(false);
    }
  }, [showToast]);

  // ── INLINE TEACHER EXPANSION ──
  const handleSelectTeacher = async (teacherId: string) => {
    if (expandedTeacherId === teacherId) {
      setExpandedTeacherId(null);
      setTeacherDetail(null);
      return;
    }
    setExpandedTeacherId(teacherId);
    await fetchTeacherDetail(teacherId);
  };

  // ── INLINE CLASS DETAILS FETCHING ──
  const fetchClassDetail = useCallback(async (classSectionId: string) => {
    setClassDetailLoading(true);
    try {
      const [workloadRes, periodsRes] = await Promise.all([
        api.get(`/timetable/workload/class-section/${classSectionId}`),
        api.get(`/timetable/class/${classSectionId}/periods`)
      ]);
      
      const workload = workloadRes.data;

      // Group timetable periods daily
      const todayPeriods = (periodsRes.data || []).filter((p: any) => p.day === TODAY_DAY_NAME);
      const activePeriods = todayPeriods.length > 0 ? todayPeriods : (periodsRes.data || []).filter((p: any) => p.day === 'Monday');
      
      const dayMap: Record<string, any[]> = {};
      activePeriods.forEach((p: any) => {
        const day = p.day || 'Monday';
        if (!dayMap[day]) dayMap[day] = [];
        
        const isSub = p.isSubstitute === true;
        dayMap[day].push({
          key: p.periodId,
          periodNumber: p.periodNumber,
          subjectName: p.subjectName || '—',
          teacherName: isSub ? (p.substituteTeacherName || 'Sub TBD') : (p.teacherName || 'Unassigned'),
          classSectionId: p.classSectionId || '',
          academicYearId: p.academicYearId || '',
          startDate: p.startDate || '',
          endDate: p.endDate || '',
          frequency: p.frequency || 'Weekly',
          isSubstitute: isSub,
          substituteTeacher: isSub ? p.substituteTeacherName : null,
          originalTeacher: isSub ? p.originalTeacherName : null
        });
      });

      const dayGroupList = Object.keys(dayMap).map(dayName => ({
        day: dayName,
        dayShort: dayName.substring(0, 3).toUpperCase(),
        periods: dayMap[dayName].sort((a, b) => a.periodNumber - b.periodNumber),
        subCount: dayMap[dayName].filter(p => p.isSubstitute).length
      }));

      setClassDetail({
        id: classSectionId,
        name: workload.name || 'Class Details',
        academicYear: workload.academicYear || '2026-2027',
        subjectCount: workload.subjects?.length || 0,
        teacherCount: workload.teacherCount || 0,
        loadPercent: workload.loadPercent || 0,
        subjects: (workload.subjects || []).map((s: any) => ({
          subjectId: s.subjectId,
          subjectName: s.subjectName,
          hasTeacher: s.teachers && s.teachers.length > 0,
          teachers: (s.teachers || []).map((t: any) => ({
            id: t.teacherId,
            name: t.teacherName,
            initials: (t.teacherName || 'TT').split(' ').map((n: string) => n[0] || '').join('').substring(0, 2).toUpperCase(),
            assignmentId: t.assignmentId,
            periodsPerWeek: t.periodsPerWeek || 5,
            loadPercent: Math.round(((t.periodsPerWeek || 5) / 48) * 100)
          }))
        })),
        timetablePeriods: dayGroupList,
        hasTimetable: dayGroupList.length > 0,
        hasSubToday: dayGroupList.some(dg => dg.periods.some(p => p.isSubstitute))
      });
    } catch (err) {
      console.error('Failed to load class details:', err);
      showToast('Error loading class section detailed view.', 'error');
    } finally {
      setClassDetailLoading(false);
    }
  }, [showToast]);

  // ── INLINE CLASS EXPANSION ──
  const handleSelectClass = async (classSectionId: string) => {
    if (expandedClassId === classSectionId) {
      setExpandedClassId(null);
      setClassDetail(null);
      return;
    }
    setExpandedClassId(classSectionId);
    await fetchClassDetail(classSectionId);
  };

  // ── CENTRALIZED REFERSHER EVENT ──
  const handleRefreshAll = useCallback(async () => {
    await loadWorkloadDashboard();
    if (expandedTeacherId) {
      await fetchTeacherDetail(expandedTeacherId);
    }
    if (expandedClassId) {
      await fetchClassDetail(expandedClassId);
    }
  }, [loadWorkloadDashboard, expandedTeacherId, expandedClassId, fetchTeacherDetail, fetchClassDetail]);

  useSchoolSetupUpdate(handleRefreshAll);

  // ── DIRECT SUBJECTS & STAFF ASSOCIATIONS (Class Drawer inside view) ──
  const handleAddSubjectToClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expandedClassId || !assignSubjectId) return;
    try {
      await api.post(`/academics/class-sections/${expandedClassId}/subjects`, {
        subjectId: assignSubjectId,
      });
      showToast('Subject linked successfully.', 'success');
      setAssignSubjectId('');
      // Reload class detail
      await handleSelectClass(expandedClassId);
      await loadWorkloadDashboard();
    } catch (err: any) {
      console.error('Error linking subject:', err);
      showToast(err.response?.data?.message || 'Failed to link subject.', 'error');
    }
  };

  const handleAssignTeacherDirect = async (subjectId: string, teacherId: string, assignmentId?: string) => {
    if (!expandedClassId) return;
    try {
      if (!teacherId) {
        if (assignmentId) {
          await api.delete(`/timetable/assignments/${assignmentId}`);
          showToast('Teacher unassigned.', 'success');
        }
      } else {
        await api.post(`/teachers/${teacherId}/assignments`, {
          classSectionId: expandedClassId,
          subjectId,
          periodsPerWeek: 5,
        });
        showToast('Teacher assigned successfully.', 'success');
      }
      await handleSelectClass(expandedClassId);
      await loadWorkloadDashboard();
    } catch (err: any) {
      console.error('Error assigning teacher:', err);
      showToast(err.response?.data?.message || 'Failed to assign teacher.', 'error');
    }
  };

  const handleRemoveSubjectFromClass = async (subjectId: string) => {
    if (!expandedClassId) return;
    try {
      await api.delete(`/academics/class-sections/${expandedClassId}/subjects/${subjectId}`);
      showToast('Subject unlinked successfully.', 'success');
      await handleSelectClass(expandedClassId);
      await loadWorkloadDashboard();
    } catch (err: any) {
      console.error('Error unlinking subject:', err);
      showToast(err.response?.data?.message || 'Failed to unlink subject.', 'error');
    }
  };

  // ── REASSIGN MODAL ──
  const handleOpenReassign = async (e: React.MouseEvent, assignmentId: string, subjectId: string, subjectName: string, teacherId: string, teacherName: string, currentPeriods: number) => {
    e.stopPropagation();
    setReassignContext({
      assignmentId,
      subjectId,
      subjectName,
      currentTeacherId: teacherId,
      currentTeacherName: teacherName
    });
    setReassignNewTeacherId(teacherId);
    setReassignPeriodsPerWeek(currentPeriods || 5);
    try {
      setIsLoading(true);
      const res = await api.get(`/timetable/teachers/subject-in-class?subjectId=${subjectId}&classSectionId=${expandedClassId || ttSelectedClassSectionId}`);
      setReassignTeacherOptions(res.data || []);
    } catch (err) {
      console.error('Failed to load qualified teachers:', err);
      setReassignTeacherOptions([]);
    } finally {
      setIsLoading(false);
    }
    setShowReassignModal(true);
  };

  const handleSaveReassign = async () => {
    if (!reassignContext.assignmentId) return;
    try {
      setIsLoading(true);
      await api.patch(`/timetable/assignments/${reassignContext.assignmentId}`, {
        newTeacherId: reassignNewTeacherId,
        periodsPerWeek: Number(reassignPeriodsPerWeek)
      });
      showToast('Assignment updated successfully.', 'success');
      setShowReassignModal(false);
      // Refresh current drawer
      if (expandedTeacherId) await handleSelectTeacher(expandedTeacherId);
      if (expandedClassId) await handleSelectClass(expandedClassId);
      await loadWorkloadDashboard();
    } catch (err: any) {
      console.error('Failed to reassign:', err);
      showToast(err.response?.data?.message || 'Failed to update assignment.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAssignment = async (e: React.MouseEvent, assignmentId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to remove this assignment?')) return;
    try {
      setIsLoading(true);
      await api.delete(`/timetable/assignments/${assignmentId}`);
      showToast('Assignment deleted.', 'success');
      if (expandedTeacherId) await handleSelectTeacher(expandedTeacherId);
      if (expandedClassId) await handleSelectClass(expandedClassId);
      await loadWorkloadDashboard();
    } catch (err: any) {
      console.error('Failed to delete assignment:', err);
      showToast(err.response?.data?.message || 'Failed to delete assignment.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ── PERIOD CARD CLICK TIMETABLE NAVIGATION ──
  const handlePeriodCardClick = async (classSectionId: string, yearId: string, start: string, end: string, freq: string) => {
    setIsTimetableView(true);
    setTtSelectedClassSectionId(classSectionId);
    setTtSelectedAcademicYear(yearId || selectedAcademicYear);
    setTtFrequency(freq || 'Weekly');
    if (start) setTtStartDate(start);
    if (end) setTtEndDate(end);
    
    // Auto-trigger grid load
    setShowTimetableGrid(false);
  };

  // ── TIMETABLE MATRIX LOADER & SAVE ──
  const loadTimetableGrid = async () => {
    if (!ttSelectedClassSectionId) {
      showToast('Please select a Class Section first.', 'error');
      return;
    }
    try {
      setIsLoading(true);
      // Fetch subjects, timings, workload & current timetable in parallel
      const [workloadRes, timingsRes, timetableRes, subjectsRes, configRes] = await Promise.all([
        api.get(`/timetable/workload/class-section/${ttSelectedClassSectionId}`),
        api.get('/timetable/period-timings'),
        api.get(`/timetable/class/${ttSelectedClassSectionId}/periods?academicYearId=${ttSelectedAcademicYear}&startDate=${ttStartDate}&endDate=${ttEndDate}`),
        api.get('/timetable/subjects'),
        api.get('/timetable/config')
      ]);

      setClassSubjects(workloadRes.data.subjects || []);
      const rawTimings = timingsRes.data || [];
      const sortedTimings = [...rawTimings].sort((a: any, b: any) => (a.periodNumber ?? a.num ?? 0) - (b.periodNumber ?? b.num ?? 0));
      let displayCount = 1;
      const mappedTimings = sortedTimings.map((pt: any) => {
        const isBreak = pt.isBreak ?? false;
        const displayLabel = isBreak ? (pt.name || 'Break') : `Period ${displayCount}`;
        const displayNum = isBreak ? null : displayCount;
        if (!isBreak) {
          displayCount++;
        }
        return {
          ...pt,
          id: pt.id,
          num: pt.periodNumber ?? pt.num,
          label: displayLabel,
          displayPeriodNumber: displayNum,
          startTime: pt.startTime,
          endTime: pt.endTime,
          isBreak
        };
      });
      setTimings(mappedTimings);
      // Always refresh the full subjects list so the dropdown is never empty
      if (subjectsRes.data && subjectsRes.data.length > 0) {
        setAllSubjects(subjectsRes.data);
      }

      const activeDays = configRes.data?.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      setWorkingDays(activeDays);

      const dayShortMap: Record<string, string> = {
        'Monday': 'MON', 'Tuesday': 'TUE', 'Wednesday': 'WED', 
        'Thursday': 'THU', 'Friday': 'FRI', 'Saturday': 'SAT', 'Sunday': 'SUN'
      };

      // Initialize timetable grid using actual period numbers from timings data
      const formattedData: Record<string, { subject: string; teacherId: string }> = {};
      const periodNumbers = (timingsRes.data || []).map((t: any) => t.periodNumber).filter(Boolean);
      const allPeriodNums = periodNumbers.length > 0 ? periodNumbers : [1, 2, 3, 4, 5, 6, 7, 8];
      
      for (const day of activeDays) {
        const dayShort = dayShortMap[day] || day.substring(0, 3).toUpperCase();
        for (const p of allPeriodNums) {
          formattedData[`${dayShort}-${p}`] = { subject: '', teacherId: '' };
        }
      }

      // Fill backend scheduled periods (flat array mapping)
      const backendData = Array.isArray(timetableRes.data) ? timetableRes.data : [];
      const cachedSubjectTeachers: Record<string, any[]> = {};

      for (const p of backendData) {
        const backDay = p.day;
        const periodNum = p.periodNumber;
        const frontDay = dayShortMap[backDay] || backDay.substring(0, 3).toUpperCase();

        if (frontDay && periodNum) {
          const subId = p.subjectId || '';
          const tId = p.teacherId || '';

          formattedData[`${frontDay}-${periodNum}`] = {
            subject: subId,
            teacherId: tId
          };

          // Cache subject teachers
          if (subId && !cachedSubjectTeachers[subId]) {
            try {
              const res = await api.get(`/timetable/teachers/subject-in-class?subjectId=${subId}&classSectionId=${ttSelectedClassSectionId}`);
              cachedSubjectTeachers[subId] = res.data || [];
            } catch (e) {
              console.error('Failed to pre-cache teachers:', e);
            }
          }
        }
      }

      setSubjectTeachers(prev => ({ ...prev, ...cachedSubjectTeachers }));
      setTimetableData(formattedData);
      setShowTimetableGrid(true);
      showToast('Timetable loaded successfully!', 'success');
    } catch (err) {
      console.error('Timetable load failed:', err);
      showToast('Failed to load timetable matrix.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCellChange = async (day: string, period: number, field: 'subject' | 'teacherId', value: string) => {
    const cellKey = `${day}-${period}`;
    setTimetableData(prev => {
      const current = prev[cellKey] || { subject: '', teacherId: '' };
      const updated = { ...current, [field]: value };
      if (field === 'subject') {
        updated.teacherId = '';
      }
      return { ...prev, [cellKey]: updated };
    });

    if (field === 'subject' && value) {
      try {
        const res = await api.get(`/timetable/teachers/subject-in-class?subjectId=${value}&classSectionId=${ttSelectedClassSectionId}`);
        setSubjectTeachers(prev => ({
          ...prev,
          [value]: res.data || []
        }));
      } catch (err) {
        console.error('Failed to load teachers for subject:', err);
      }
    }
  };

  const handleSaveTimetable = async () => {
    if (!ttSelectedClassSectionId) return;
    try {
      setIsLoading(true);
      const periodsList: any[] = [];
      const dayMap: Record<string, string> = {
        'MON': 'Monday', 'TUE': 'Tuesday', 'WED': 'Wednesday', 
        'THU': 'Thursday', 'FRI': 'Friday', 'SAT': 'Saturday', 'SUN': 'Sunday'
      };

      for (const key of Object.keys(timetableData)) {
        const parts = key.split('-');
        if (parts.length < 2) continue;
        const frontDay = parts[0];
        const periodNum = Number(parts[1]);

        const cell = timetableData[key];
        if (cell && cell.subject && cell.teacherId) {
          const backDay = dayMap[frontDay];
          if (backDay) {
            // Verify this is not a break timing
            const timing = timings.find(t => t.periodNumber === periodNum);
            if (timing && timing.isBreak) continue;

            periodsList.push({
              day: backDay,
              periodNumber: periodNum,
              subjectId: cell.subject,
              teacherId: cell.teacherId
            });
          }
        }
      }

      await api.post('/timetable/periods/save', {
        classSectionId: ttSelectedClassSectionId,
        academicYearId: ttSelectedAcademicYear,
        periods: periodsList
      });

      showToast('Timetable saved successfully!', 'success');
    } catch (err: any) {
      console.error('Error saving timetable:', err);
      showToast(err.response?.data?.message || 'Failed to save timetable.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ── LEAVE SUBSTITUTE CLICK MANAGEMENT ──
  const handleOpenSubstituteModal = async (e: React.MouseEvent, periodId: string, day: string, periodNumber: number, subjectName: string, currentTeacherId: string, currentTeacherName: string) => {
    e.stopPropagation();
    setSubstituteContext({
      periodId,
      day,
      periodNumber,
      subjectName,
      currentTeacherId,
      currentTeacherName
    });
    setSubstituteTeacherId('');
    try {
      setIsLoading(true);
      const res = await api.get(`/timetable/teachers/subject-in-class?subjectId=${substituteContext.subjectId || ''}&classSectionId=${ttSelectedClassSectionId}`);
      setSubstituteTeacherOptions(res.data || []);
    } catch (err) {
      console.error('Failed to load substitute options:', err);
      setSubstituteTeacherOptions([]);
    } finally {
      setIsLoading(false);
    }
    setShowSubstituteModal(true);
  };

  const handleSaveSubstitute = async () => {
    if (!substituteContext.periodId) return;
    try {
      setIsLoading(true);
      await api.post('/timetable/periods/substitute', {
        periodId: substituteContext.periodId,
        substituteTeacherId
      });
      showToast('Substitute teacher assigned successfully.', 'success');
      setShowSubstituteModal(false);
      // Refresh teacher/class details
      if (expandedTeacherId) await handleSelectTeacher(expandedTeacherId);
      if (expandedClassId) await handleSelectClass(expandedClassId);
    } catch (err: any) {
      console.error('Failed to map substitute:', err);
      showToast(err.response?.data?.message || 'Failed to map substitute.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ── SINGLE ACTIONS CREATION & MANAGEMENT ──
  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const payload = {
        firstName: newTeacher.firstName,
        lastName: newTeacher.lastName,
        email: newTeacher.email,
        phone: newTeacher.phone,
        qualification: newTeacher.qualification,
        basicSalary: Number(newTeacher.basicSalary),
        joiningDate: newTeacher.joiningDate,
        skills: newTeacher.skills.filter(s => s.subjectId).map(s => ({
          subjectId: s.subjectId,
          skillLevel: s.skillLevel,
          yearsOfExperience: Number(s.yearsOfExperience)
        }))
      };
      await api.post('/timetable/teachers', payload);
      showToast('Teacher created successfully.', 'success');
      setShowTeacherForm(false);
      setNewTeacher({
        firstName: '', lastName: '', email: '', phone: '', gender: '',
        dob: '', qualification: '', joiningDate: '', address: '',
        basicSalary: 30000, hra: 3600, da: 2400, pf: 1500,
        accountNumber: '', ifsc: '',
        skills: [{ subjectId: '', skillLevel: 'Expert', yearsOfExperience: 5 }]
      });
      await loadWorkloadDashboard();
    } catch (err: any) {
      console.error('Error saving teacher:', err);
      showToast(err.response?.data?.message || 'Failed to save teacher.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSubjects = async () => {
    const valid = subjectsListInput.filter(s => s.name.trim());
    if (valid.length === 0) {
      showToast('Please enter at least one subject.', 'error');
      return;
    }
    try {
      setIsLoading(true);
      await api.post('/timetable/subjects/bulk', {
        subjects: valid.map(s => ({ name: s.name.trim() }))
      });
      showToast('Subjects added successfully.', 'success');
      // Refresh the subjects list to update dropdowns
      const subjectsRes = await api.get('/timetable/subjects');
      if (subjectsRes.data && subjectsRes.data.length > 0) {
        setAllSubjects(subjectsRes.data);
      }
      setShowAddSubject(false);
      setSubjectsListInput([{ id: 1, name: '' }]);
      await loadWorkloadDashboard();
    } catch (err: any) {
      console.error('Error adding subjects:', err);
      showToast(err.response?.data?.message || 'Failed to save subjects.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSubject = async (subjectId: string) => {
    if (!confirm('Are you sure you want to delete this subject?')) return;
    try {
      setIsLoading(true);
      await api.delete(`/timetable/subjects/${subjectId}`);
      showToast('Subject deleted successfully.', 'success');
      const subjectsRes = await api.get('/timetable/subjects');
      setAllSubjects(subjectsRes.data || []);
      await loadWorkloadDashboard();
    } catch (err: any) {
      console.error('Error deleting subject:', err);
      showToast(err.response?.data?.message || 'Failed to delete subject.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const [sectionNamesInput, setSectionNamesInput] = useState([{ id: 1, name: '' }]);

  const handleSaveSectionsBulk = async () => {
    const valid = sectionNamesInput.filter(s => s.name.trim());
    if (valid.length === 0) {
      showToast('Please enter at least one section letter (e.g. Section A).', 'error');
      return;
    }
    try {
      setIsLoading(true);
      for (const item of valid) {
        await api.post('/academics/sections', { name: item.name.trim() });
      }
      showToast('Section(s) created successfully.', 'success');
      setShowCreateSection(false);
      setSectionNamesInput([{ id: 1, name: '' }]);
      const secRes = await api.get('/academics/sections');
      setAvailableSections(secRes.data || []);
      await loadWorkloadDashboard();
    } catch (err: any) {
      console.error('Error creating sections:', err);
      showToast(err.response?.data?.message || 'Failed to create section(s).', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm('Are you sure you want to delete this section?')) return;
    try {
      setIsLoading(true);
      await api.delete(`/academics/sections/${sectionId}`);
      showToast('Section deleted successfully.', 'success');
      const secRes = await api.get('/academics/sections');
      setAvailableSections(secRes.data || []);
      await loadWorkloadDashboard();
    } catch (err: any) {
      console.error('Error deleting section:', err);
      showToast(err.response?.data?.message || 'Failed to delete section.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchExistingClasses = useCallback(async () => {
    try {
      // Use the academics endpoint to get the list of classes for the selected academic year
      const res = await api.get('/academics/classes', {
        params: selectedAcademicYear ? { academicYearId: selectedAcademicYear } : undefined
      });
      setExistingClasses(res.data || []);
    } catch (err) {
      console.error('Failed to fetch existing classes:', err);
    }
  }, [selectedAcademicYear]);

  useEffect(() => {
    if (showCreateClass) {
      fetchExistingClasses();
    }
  }, [showCreateClass, fetchExistingClasses]);

  const handleDeleteClass = async (classId: string) => {
    try {
      setIsLoading(true);
      const res = await api.get(`/academics/classes/${classId}/student-count`);
      const studentCount = res.data.count || 0;
      setIsLoading(false);

      showToast(`This class has ${studentCount} allotted student(s).`, 'info');

      if (!confirm(`Are you sure you want to delete this class? This will delete all associated records (Allotted students: ${studentCount}).`)) {
        return;
      }

      setIsLoading(true);
      await api.delete(`/academics/classes/${classId}`);
      showToast('Class deleted successfully.', 'success');
      await fetchExistingClasses();
      await loadWorkloadDashboard();
    } catch (err: any) {
      console.error('Error deleting class:', err);
      showToast(err.response?.data?.message || 'Failed to delete class.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveClass = async () => {
    const valid = classNamesInput.filter(c => c.name.trim());
    if (valid.length === 0) {
      showToast('Please enter at least one class name.', 'error');
      return;
    }
    // Determine academic year ID: use selected or fall back to active year
    const yearId = selectedAcademicYear || (academicYears.find((y: any) => y.isActive)?.id) || '';
    if (!yearId) {
      showToast('Please select an academic year before creating classes.', 'error');
      return;
    }
    try {
      setIsLoading(true);
      for (const entry of valid) {
        await api.post('/academics/classes', { name: entry.name.trim(), academicYearId: yearId });
      }
      showToast('Classes created successfully.', 'success');
      setShowCreateClass(false);
      setClassNamesInput([{ id: 1, name: '' }]);
      await loadWorkloadDashboard();
      // Refresh class list after creating new classes
      await fetchExistingClasses();
    } catch (err: any) {
      console.error('Error creating classes:', err);
      showToast(err.response?.data?.message || 'Failed to save class names.', 'error');
    } finally {
      setIsLoading(false);
    }
  }

  const handleSaveSection = async () => {
    if (!newSectionName.trim()) return;
    try {
      setIsLoading(true);
      await api.post('/timetable/sections', { name: newSectionName.trim() });
      showToast(`Section "${newSectionName}" created successfully.`, 'success');
      setShowCreateSection(false);
      setNewSectionName('');
      await loadWorkloadDashboard();
    } catch (err: any) {
      console.error('Error creating section:', err);
      showToast(err.response?.data?.message || 'Failed to save section.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ── MULTI-STEP SETUP WIZARD FOR CLASSES & ASSIGNMENTS ──
  const enterSetupWizard = async () => {
    try {
      setIsLoading(true);
      const activeYear = academicYears.find((y: any) => y.isActive) || academicYears[0];
      const targetYearId = activeYear ? activeYear.id : '';

      const [clsRes, secRes, subRes] = await Promise.all([
        api.get('/timetable/classes', { params: { academicYearId: targetYearId } }),
        api.get('/timetable/sections'),
        api.get('/timetable/subjects')
      ]);
      setAvailableClasses(clsRes.data || []);
      setAvailableSections(secRes.data || []);
      setAllSubjects((subRes.data || []).map((s: any) => ({ ...s, isSelected: false })));

      if (targetYearId) setSelectedAcademicYear(targetYearId);
      if (clsRes.data?.length > 0) setSelectedClassId(clsRes.data[0].id);
      if (secRes.data?.length > 0) setSelectedSectionId(secRes.data[0].id);

      setSelectedSubjects(new Set());
      setTeacherAssignments([]);
      setCurrentStep(1);
    } catch (err) {
      console.error('Failed to initialize wizard options:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveNewClassInline = async () => {
    if (!newClassNameInline.trim()) return;
    try {
      setIsLoading(true);
      const res = await api.post('/timetable/classes', {
        name: newClassNameInline.trim(),
        academicYearId: selectedAcademicYear
      });
      setAvailableClasses(prev => [...prev, res.data]);
      setSelectedClassId(res.data.id);
      setShowInlineAddClass(false);
      setNewClassNameInline('');
      showToast('Class created inline.', 'success');
    } catch (err: any) {
      console.error('Inline class creation failed:', err);
      showToast(err.response?.data?.message || 'Failed to save class name inline.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch classes when selectedAcademicYear changes in the wizard
  useEffect(() => {
    if (!selectedAcademicYear || currentStep !== 1) return;
    const fetchClassesForYear = async () => {
      try {
        const res = await api.get('/timetable/classes', {
          params: { academicYearId: selectedAcademicYear }
        });
        setAvailableClasses(res.data || []);
        if (res.data && res.data.length > 0) {
          setSelectedClassId(res.data[0].id);
        } else {
          setSelectedClassId('');
        }
      } catch (err) {
        console.error('Failed to fetch classes for academic year:', err);
      }
    };
    fetchClassesForYear();
  }, [selectedAcademicYear, currentStep]);


  const handleStep1Next = () => {
    if (!selectedAcademicYear || !selectedClassId || !selectedSectionId) {
      showToast('Please fill in all required setup details.', 'error');
      return;
    }
    setCurrentStep(2);
  };

  const handleSubjectToggle = (subjectId: string) => {
    setSelectedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });
  };

  const handleStep2Next = async () => {
    if (selectedSubjects.size === 0) {
      showToast('Please choose at least one subject to link.', 'error');
      return;
    }
    setIsLoading(true);
    try {
      const subjectIds = Array.from(selectedSubjects);
      const teachersBySubjectRes = await api.get(`/timetable/teachers/subject?subjectIds=${subjectIds.join(',')}`);
      const teachersBySubject = teachersBySubjectRes.data || {};

      const assignments = subjectIds.map(subId => {
        const subject = allSubjects.find(s => s.id === subId);
        const options = teachersBySubject[subId] || [];
        return {
          subjectId: subId,
          subjectName: subject?.name || 'Subject',
          noTeachersAvailable: options.length === 0,
          teachers: [
            { id: 1, label: 'Primary Teacher', selectedTeacherId: '', periodsPerWeek: 5, teacherOptions: options, isFirst: true }
          ],
          teacherCounter: 1,
          hasError: false
        };
      });

      setTeacherAssignments(assignments);
      setCurrentStep(3);
    } catch (err) {
      console.error('Failed to load assignments page options:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTeacherToWizardRow = (subjectId: string) => {
    setTeacherAssignments(prev => prev.map(a => {
      if (a.subjectId !== subjectId) return a;
      const nextId = a.teacherCounter + 1;
      return {
        ...a,
        teacherCounter: nextId,
        teachers: [
          ...a.teachers,
          { id: nextId, label: `Additional Teacher ${a.teachers.length}`, selectedTeacherId: '', periodsPerWeek: 5, teacherOptions: a.teachers[0].teacherOptions, isFirst: false }
        ]
      };
    }));
  };

  const handleRemoveTeacherFromWizardRow = (subjectId: string, indexId: number) => {
    setTeacherAssignments(prev => prev.map(a => {
      if (a.subjectId !== subjectId) return a;
      return {
        ...a,
        teachers: a.teachers.filter((t: any) => t.id !== indexId)
      };
    }));
  };

  const handleWizardTeacherChange = (subjectId: string, indexId: number, field: 'selectedTeacherId' | 'periodsPerWeek', value: any) => {
    setTeacherAssignments(prev => prev.map(a => {
      if (a.subjectId !== subjectId) return a;
      return {
        ...a,
        teachers: a.teachers.map((t: any) => {
          if (t.id !== indexId) return t;
          return { ...t, [field]: value };
        })
      };
    }));
  };

  const handleWizardSubmit = async () => {
    let err = false;
    const assignmentsCopy = teacherAssignments.map(a => {
      const valid = a.teachers.some((t: any) => t.selectedTeacherId);
      if (!valid) err = true;
      return { ...a, hasError: !valid };
    });
    setTeacherAssignments(assignmentsCopy);

    if (err) {
      showToast('Please assign at least one teacher to all checked subjects.', 'error');
      return;
    }

    const subjectTeacherMap: Record<string, string[]> = {};
    const subjectPeriodsMap: Record<string, number[]> = {};

    teacherAssignments.forEach(a => {
      const assigned = a.teachers.filter((t: any) => t.selectedTeacherId);
      subjectTeacherMap[a.subjectId] = assigned.map((t: any) => t.selectedTeacherId);
      subjectPeriodsMap[a.subjectId] = assigned.map((t: any) => Number(t.periodsPerWeek || 5));
    });

    try {
      setIsLoading(true);
      const res = await api.post('/timetable/class-sections', {
        academicYearId: selectedAcademicYear,
        classId: selectedClassId,
        sectionId: selectedSectionId,
        classStrength: classStrength ? Number(classStrength) : null,
        subjectTeacherMap,
        subjectPeriodsMap
      });

      setSuccessMessage(`Created Class Section and mapped assignments successfully.`);
      setShowSuccessModal(true);
    } catch (err: any) {
      console.error('Wizard submit failed:', err);
      showToast(err.response?.data?.message || 'Failed to complete class section creation.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDoneWizard = () => {
    setShowSuccessModal(false);
    setCurrentStep(0);
    loadWorkloadDashboard();
  };

  // ── DELETIONS AND SOFTPRESS ──
  const handleDeleteClassClick = (classSection: ClassSection) => {
    setDeleteConfirm({
      show: true,
      type: 'class',
      id: classSection.id,
      classId: classSection.classId,
      name: classSection.name
    });
  };

  const handleDeleteTeacherClick = (teacherId: string, name: string) => {
    setDeleteConfirm({
      show: true,
      type: 'teacher',
      id: teacherId,
      name
    });
  };

  const handleConfirmDelete = async () => {
    try {
      setIsLoading(true);
      if (deleteConfirm.type === 'class') {
        if (!deleteConfirm.classId) return;
        await api.delete(`/academics/classes/${deleteConfirm.classId}`);
        showToast('Class Section deleted.', 'success');
        setExpandedClassId(null);
      } else {
        await api.delete(`/teachers/${deleteConfirm.id}`);
        showToast('Teacher profile deleted.', 'success');
        setExpandedTeacherId(null);
      }
      setDeleteConfirm({ show: false, type: 'class', id: '', name: '' });
      await loadWorkloadDashboard();
    } catch (err: any) {
      console.error('Failed deletion:', err);
      showToast(err.response?.data?.message || 'Failed to complete soft-deletion.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="teacher-class-mgmt-container space-y-6">
      
      {/* ── TOP LOADING BAR ── */}
      {isLoading && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-blue-100 z-[9999] overflow-hidden">
          <div className="h-full bg-blue-600 animate-pulse w-full"></div>
        </div>
      )}

      {/* ── HEADER TITLE BLOCK ── */}
      {currentStep === 0 && !isTimetableView && !isTimetableConfigView && (
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Layers className="w-4 h-4 text-blue-600" />
            </div>
            <h2 className="text-[18px] font-bold text-slate-800">Teacher &amp; Class Management</h2>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
           STEP 0: WORKLOAD OVERVIEW LANDING
           ════════════════════════════════════════════════ */}
      {currentStep === 0 && !isTimetableView && !isTimetableConfigView && (
        <div className="space-y-6 animate-in">
          
          {/* Workload Overview Banner & Action Controls */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6">
              <div>
                <h3 className="dash-title">Workload Overview</h3>
                <p className="dash-subtitle">Live teacher &amp; class assignment dashboard</p>
              </div>
              
              {/* Action Buttons Row */}
              <div className="action-btn-group">
                <button onClick={() => setShowTeacherForm(true)} className="action-pill action-pill-primary">
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> Add Teacher
                </button>
                <button onClick={() => setShowImportTeachers(true)} className="action-pill action-pill-primary">
                  <Upload className="w-3.5 h-3.5 stroke-[2.5]" /> Import Teachers
                </button>
                <button onClick={() => setShowAddSubject(true)} className="action-pill action-pill-primary">
                  <BookOpen className="w-3.5 h-3.5 stroke-[2.5]" /> Add Subject
                </button>
                <button onClick={() => setShowCreateClass(true)} className="action-pill action-pill-primary">
                  <Grid3X3 className="w-3.5 h-3.5 stroke-[2.5]" /> Create Class
                </button>
                <button onClick={() => setShowCreateSection(true)} className="action-pill action-pill-primary">
                  <Layers className="w-3.5 h-3.5 stroke-[2.5]" /> Create Section
                </button>
                <button onClick={() => setIsManageTypesOpen(true)} className="action-pill action-pill-primary">
                  <Award className="w-3.5 h-3.5 stroke-[2.5]" /> Manage Exam Types
                </button>
                <button onClick={enterSetupWizard} className="action-pill action-pill-timetable action-pill-primary">
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> Add Class Section
                </button>
                <button onClick={() => { setIsTimetableConfigView(true); }} className="action-pill action-pill-timetable action-pill-primary">
                  <Settings className="w-3.5 h-3.5 stroke-[2.5]" /> Timetable Setup
                </button>
                <button onClick={() => { setIsTimetableView(true); setShowTimetableGrid(false); }} className="action-pill action-pill-timetable">
                  <Calendar className="w-3.5 h-3.5 stroke-[2.5]" /> Timetable
                </button>
              </div>
            </div>

            {/* KPI Cards Strip */}
            <div className="kpi-strip">
              <div className="kpi-card kpi-blue">
                <div className="kpi-icon-wrap kpi-icon-blue">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <div className="kpi-data">
                  <span className="kpi-val">{workloadSummary.totalTeachers}</span>
                  <span className="kpi-label">Total Teachers</span>
                </div>
              </div>
              <div className="kpi-card kpi-green">
                <div className="kpi-icon-wrap kpi-icon-green">
                  <Grid3X3 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="kpi-data">
                  <span className="kpi-val">{workloadSummary.totalClasses}</span>
                  <span className="kpi-label">Class Sections</span>
                </div>
              </div>
              <div className="kpi-card kpi-purple">
                <div className="kpi-icon-wrap kpi-icon-purple">
                  <BookOpen className="w-4 h-4 text-purple-600" />
                </div>
                <div className="kpi-data">
                  <span className="kpi-val">{workloadSummary.totalAssignments}</span>
                  <span className="kpi-label">Assignments</span>
                </div>
              </div>
              <div className="kpi-card kpi-amber">
                <div className="kpi-icon-wrap kpi-icon-amber">
                  <BarChart3 className="w-4 h-4 text-amber-600" />
                </div>
                <div className="kpi-data">
                  <span className="kpi-val">{workloadSummary.avgLoadPercent}%</span>
                  <span className="kpi-label">Avg Workload</span>
                </div>
              </div>
            </div>

            {/* Dual Panel Rows */}
            <div className="dual-panel mt-6">
              
              {/* LEFT: Teacher Workload Panel */}
              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title-row w-full flex items-center">
                    <span className="panel-accent panel-accent-blue"></span>
                    <h3 className="panel-title">Teacher Workload</h3>
                    <span className="panel-badge">{teachers.length}</span>
                    <button 
                      onClick={() => setShowTeacherForm(true)}
                      className="ml-auto p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg flex items-center justify-center cursor-pointer transition-all border border-blue-100"
                      title="Add Teacher"
                    >
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>
                  <div className="panel-searchbox">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search teachers…" 
                      value={teacherSearch}
                      onChange={e => setTeacherSearch(e.target.value)}
                      className="panel-search-input"
                    />
                  </div>
                </div>

                <div className="panel-list max-h-[600px] overflow-y-auto">
                  {teachers.filter(t => t.name.toLowerCase().includes(teacherSearch.toLowerCase())).map((t, idx) => {
                    const isSelected = expandedTeacherId === t.id;
                    const color = getLoadColor(t.loadPercent);
                    const bg = getLoadBg(t.loadPercent);
                    return (
                      <React.Fragment key={t.id}>
                        <div 
                          onClick={() => handleSelectTeacher(t.id)}
                          className={`panel-row ${isSelected ? 'panel-row-active' : ''}`}
                        >
                          <div className="tw-avatar" style={{ background: t.gradient }}>
                            <span className="avatar-initials">{t.initials}</span>
                          </div>
                          <div className="tw-body">
                            <div className="tw-top">
                              <span className="tw-name">{t.name}</span>
                              <span className="tw-load-chip" style={{ background: bg, color }}>{t.loadPercent}%</span>
                            </div>
                            <div className="tw-meta">{t.subjects.join(', ') || 'No subjects'} &bull; {t.classCount} class(es)</div>
                            <div className="tw-bar-track">
                              <div className="tw-bar-fill" style={{ width: `${t.loadPercent}%`, background: color }} />
                            </div>
                          </div>
                          <ChevronDown className={`tw-chevron transition-transform duration-250 ${isSelected ? 'rotate-180 text-blue-600' : ''}`} />
                        </div>

                        {/* Collapsible Inline Detail Drawer */}
                        {isSelected && (
                          <div className="detail-drawer inline-detail-drawer p-5 border-b border-slate-200">
                            {teacherDetailLoading ? (
                              <div className="flex items-center gap-3 justify-center py-6">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                                <span className="text-xs text-slate-400 font-semibold">Loading assignments…</span>
                              </div>
                            ) : teacherDetail ? (
                              <div className="space-y-4">
                                <div className="dd-header flex items-center justify-between border-b border-slate-100 pb-3">
                                  <div className="flex items-center gap-3">
                                    <div className="dd-avatar w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: t.gradient }}>
                                      {t.initials}
                                    </div>
                                    <div>
                                      <h4 className="dd-name font-bold text-slate-800 text-sm">{t.name}</h4>
                                      <p className="dd-sub text-xs text-slate-400">{teacherDetail.totalAssignments} assignments across {teacherDetail.classCount} class(es)</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <button 
                                      onClick={() => handleDeleteTeacherClick(t.id, t.name)}
                                      className="px-2.5 py-1 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200"
                                    >
                                      Delete Teacher
                                    </button>
                                    <button onClick={() => handleSelectTeacher(t.id)} className="dd-close w-6 h-6 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 flex items-center justify-center">
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Accordion: Weekly Schedule */}
                                <div className="border border-slate-200/60 rounded-xl overflow-hidden bg-white shadow-sm">
                                  <div 
                                    onClick={() => setIsWeeklyExpanded(!isWeeklyExpanded)}
                                    className="flex justify-between items-center px-4 py-3 bg-slate-50 cursor-pointer border-b border-slate-200/60"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Calendar className="w-4 h-4 text-blue-500" />
                                      <span className="text-xs font-bold text-slate-700">Weekly Schedule</span>
                                    </div>
                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isWeeklyExpanded ? 'rotate-180' : ''}`} />
                                  </div>
                                  
                                  {isWeeklyExpanded && (
                                    <div className="p-4 space-y-2">
                                      {teacherDetail.subjects.length === 0 ? (
                                        teacherDetail.skills.length > 0 ? (
                                          <div className="space-y-2">
                                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Subject Skills</div>
                                            {teacherDetail.skills.map((sk: any) => (
                                              <div key={sk.id} className="flex justify-between items-center p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                                                <span className="font-bold text-slate-700">{sk.subjectName}</span>
                                                <div className="flex gap-2">
                                                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold">{sk.skillLevel}</span>
                                                  <span className="text-slate-400">{sk.yearsOfExperience} yrs exp</span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <div className="text-xs text-slate-400 italic py-2 text-center">No assignments or subject skills mapped.</div>
                                        )
                                      ) : (
                                        <div className="divide-y divide-slate-100">
                                          {teacherDetail.subjects.map((sub: any) => (
                                            <div key={sub.uniqueKey} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 text-xs border-b border-slate-100 dark:border-slate-800 last:border-0">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"></span>
                                                <span className="font-bold text-slate-700 dark:text-slate-200">{sub.subjectName}</span>
                                                <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400 text-[10px] font-semibold whitespace-nowrap flex-shrink-0">
                                                  {sub.className}
                                                </span>
                                              </div>
                                              <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pl-3 sm:pl-0">
                                                <span className="text-slate-400 dark:text-slate-400 font-semibold whitespace-nowrap">{sub.periodsPerWeek} periods/wk</span>
                                                <div className="flex gap-1.5">
                                                  <button 
                                                    onClick={(e) => handleOpenReassign(e, sub.assignmentId, sub.subjectId, sub.subjectName, t.id, t.name, sub.periodsPerWeek)}
                                                    className="p-1.5 rounded bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/50 text-slate-500 dark:text-slate-400 hover:text-blue-600 transition-colors"
                                                    title="Reassign Teacher"
                                                  >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                  </button>
                                                  <button 
                                                    onClick={(e) => handleDeleteAssignment(e, sub.assignmentId)}
                                                    className="p-1.5 rounded bg-slate-50 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-900/50 text-slate-500 dark:text-slate-400 hover:text-rose-600 transition-colors"
                                                    title="Remove Assignment"
                                                  >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                  </button>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Accordion: Today's Schedule Card Deck */}
                                <div className="border border-slate-200/60 rounded-xl overflow-hidden bg-white shadow-sm">
                                  <div 
                                    onClick={() => setIsTodayExpanded(!isTodayExpanded)}
                                    className="flex justify-between items-center px-4 py-3 bg-slate-50 cursor-pointer border-b border-slate-200/60"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Clock className="w-4 h-4 text-emerald-500" />
                                      <span className="text-xs font-bold text-slate-700">Today&apos;s Schedule ({TODAY_DAY_NAME})</span>
                                    </div>
                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isTodayExpanded ? 'rotate-180' : ''}`} />
                                  </div>

                                  {isTodayExpanded && (
                                    <div className="p-4">
                                      {!teacherDetail.hasTimetable ? (
                                        <div className="text-xs text-slate-400 italic text-center py-2">No timetable periods scheduled today.</div>
                                      ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                          {teacherDetail.timetablePeriods.map((dg: any) => 
                                            dg.periods.map((p: any) => (
                                              <div 
                                                key={p.key}
                                                onClick={() => handlePeriodCardClick(p.classSectionId, p.academicYearId, p.startDate, p.endDate, p.frequency)}
                                                className={`p-3 rounded-xl border border-slate-100 shadow-sm cursor-pointer hover:border-blue-400 transition-all ${p.isLeaser ? 'bg-amber-50/50 border-amber-200/60' : 'bg-slate-50/60'}`}
                                              >
                                                {p.isLeaser && (
                                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase tracking-wide block w-fit mb-1">{p.leaserType}</span>
                                                )}
                                                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                                                  <span>{timings.find(t => (t.num ?? t.periodNumber) === p.periodNumber)?.label || `Period ${p.periodNumber}`}</span>
                                                  <span>{p.startTime}</span>
                                                </div>
                                                <div className="text-xs font-extrabold text-slate-800 truncate mt-1">{p.subjectName}</div>
                                                <div className="text-[10px] text-slate-500 font-semibold mt-0.5">{p.className}</div>
                                                {p.substituteTeacher && (
                                                  <div className="text-[9px] text-blue-600 font-bold mt-1">Sub: {p.substituteTeacher}</div>
                                                )}
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                              </div>
                            ) : null}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT: Class Workload Panel */}
              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title-row w-full flex items-center">
                    <span className="panel-accent panel-accent-green"></span>
                    <h3 className="panel-title">Class Workload</h3>
                    <span className="panel-badge panel-badge-green">{classes.length}</span>
                    <button 
                      onClick={enterSetupWizard}
                      className="ml-auto p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg flex items-center justify-center cursor-pointer transition-all border border-emerald-100"
                      title="Add Class Section"
                    >
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>
                  <div className="panel-searchbox">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search classes…" 
                      value={classSearch}
                      onChange={e => setClassSearch(e.target.value)}
                      className="panel-search-input"
                    />
                  </div>
                </div>

                <div className="panel-list max-h-[600px] overflow-y-auto">
                  {classes.filter(c => c.name.toLowerCase().includes(classSearch.toLowerCase())).map((c, idx) => {
                    const isSelected = expandedClassId === c.id;
                    const color = getLoadColor(c.loadPercent);
                    const bg = getLoadBg(c.loadPercent);
                    return (
                      <React.Fragment key={c.id}>
                        <div 
                          onClick={() => handleSelectClass(c.id)}
                          className={`panel-row ${isSelected ? 'panel-row-active' : ''}`}
                        >
                          <div className="cw-icon-bg">
                            <BookOpen className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div className="tw-body">
                            <div className="tw-top">
                              <span className="tw-name">{c.name}</span>
                              <span className="cw-year-tag">{c.academicYear}</span>
                            </div>
                            <div className="tw-meta">{c.subjectCount} subjects &bull; {c.staffedCount} staffed &bull; {c.subjectCount - c.staffedCount} open</div>
                            <div className="tw-bar-track">
                              <div className="tw-bar-fill" style={{ width: `${c.loadPercent}%`, background: color }} />
                            </div>
                          </div>
                          <div className="cw-pct-badge font-bold text-xs" style={{ background: bg, color }}>{c.loadPercent}%</div>
                        </div>

                        {/* Collapsible Inline Class Detail Drawer */}
                        {isSelected && (
                          <div className="detail-drawer detail-drawer-green inline-detail-drawer p-5 border-b border-slate-200">
                            {classDetailLoading ? (
                              <div className="flex items-center gap-3 justify-center py-6">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600"></div>
                                <span className="text-xs text-slate-400 font-semibold">Loading class details…</span>
                              </div>
                            ) : classDetail ? (
                              <div className="space-y-4">
                                <div className="dd-header flex items-center justify-between border-b border-slate-100 pb-3">
                                  <div className="flex items-center gap-3">
                                    <div className="dd-class-icon w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                                      <BookOpen className="w-5 h-5" />
                                    </div>
                                    <div>
                                      <h4 className="dd-name font-bold text-slate-800 text-sm">{c.name}</h4>
                                      <p className="dd-sub text-xs text-slate-400">{c.academicYear} &bull; {classDetail.subjectCount} subjects &bull; {classDetail.teacherCount} teachers</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <button 
                                      onClick={() => handleDeleteClassClick(c)}
                                      className="px-2.5 py-1 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200"
                                    >
                                      Delete Class
                                    </button>
                                    <button onClick={() => handleSelectClass(c.id)} className="dd-close w-6 h-6 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 flex items-center justify-center">
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Circular SVG Workload Ring & Coverage Progress */}
                                <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 rounded-2xl p-4">
                                  <div className="relative w-14 h-14">
                                    <svg viewBox="0 0 56 56" className="w-full h-full transform -rotate-90">
                                      <circle cx="28" cy="28" r="22" className="fill-none stroke-slate-200 stroke-[5]" />
                                      <circle 
                                        cx="28" cy="28" r="22" 
                                        className="fill-none stroke-emerald-500 stroke-[5] stroke-linecap-round transition-all duration-500" 
                                        strokeDasharray={2 * Math.PI * 22}
                                        strokeDashoffset={2 * Math.PI * 22 - (classDetail.loadPercent / 100) * 2 * Math.PI * 22}
                                      />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center text-[11px] font-extrabold text-slate-700">
                                      {classDetail.loadPercent}%
                                    </div>
                                  </div>
                                  <div className="flex-1">
                                    <span className="text-xs font-bold text-slate-700">Staffing Coverage</span>
                                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden mt-1.5">
                                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${classDetail.loadPercent}%` }} />
                                    </div>
                                  </div>
                                </div>

                                {/* Subject Blocks */}
                                <div className="space-y-3">
                                  {classDetail.subjects.map((subj: any) => (
                                    <div key={subj.subjectId} className="cd-subj-block border border-slate-200 rounded-xl overflow-hidden bg-white">
                                      <div className="cd-subj-header flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50/50">
                                        <div className="flex items-center gap-2">
                                          <span className="w-2 h-2 rounded-full" style={{ background: getLoadColor(subj.loadPercent) }}></span>
                                          <span className="text-xs font-extrabold text-slate-800">{subj.subjectName}</span>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${subj.hasTeacher ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                                          {subj.hasTeacher ? 'Assigned' : 'Open'}
                                        </span>
                                      </div>

                                      <div className="p-3">
                                        {subj.hasTeacher ? (
                                          subj.teachers.map((t: any) => (
                                            <div key={t.id} className="flex items-center justify-between text-xs py-1">
                                              <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: AVATAR_GRADIENTS[Math.floor(Math.random() * 8)] }}>
                                                  {t.initials}
                                                </div>
                                                <span className="font-semibold text-slate-700">{t.name}</span>
                                              </div>
                                              <div className="flex items-center gap-3">
                                                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold text-[10px]">{t.periodsPerWeek} p/wk</span>
                                                <div className="flex gap-1.5">
                                                  <button 
                                                    onClick={(e) => handleOpenReassign(e, t.assignmentId, subj.subjectId, subj.subjectName, t.id, t.name, t.periodsPerWeek)}
                                                    className="p-1 rounded bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-600"
                                                    title="Reassign Teacher"
                                                  >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                  </button>
                                                  <button 
                                                    onClick={(e) => handleDeleteAssignment(e, t.assignmentId)}
                                                    className="p-1 rounded bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600"
                                                    title="Remove Assignment"
                                                  >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                  </button>
                                                </div>
                                              </div>
                                            </div>
                                          ))
                                        ) : (
                                          <div className="text-xs text-slate-400 italic py-1">No teacher assigned yet.</div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {/* Inline Subject & Direct Assignments Manager */}
                                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
                                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                    <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Class Subjects &amp; Staff Assignments</h4>
                                    <form onSubmit={handleAddSubjectToClass} className="flex gap-2 items-center">
                                      <select
                                        value={assignSubjectId}
                                        onChange={e => setAssignSubjectId(e.target.value)}
                                        required
                                        className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs outline-none text-slate-700"
                                      >
                                        <option value="">Link Subject...</option>
                                        {allSubjects
                                          .filter(sub => !classDetail.subjects.some((csSub: any) => csSub.subjectId === sub.id))
                                          .map(sub => (
                                            <option key={sub.id} value={sub.id}>{sub.name}</option>
                                          ))
                                        }
                                      </select>
                                      <button
                                        type="submit"
                                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                                      >
                                        + Link
                                      </button>
                                    </form>
                                  </div>

                                  <div className="divide-y divide-slate-100">
                                    {classDetail.subjects.map((sub: any) => {
                                      const assignedTeacherId = sub.teachers && sub.teachers.length > 0 ? sub.teachers[0].id : '';
                                      const assignmentId = sub.teachers && sub.teachers.length > 0 ? sub.teachers[0].assignmentId : '';
                                      return (
                                        <div key={sub.subjectId} className="flex items-center justify-between py-2 text-xs">
                                          <div className="font-semibold text-slate-700">{sub.subjectName}</div>
                                          <div className="flex items-center gap-3">
                                            <select
                                              value={assignedTeacherId}
                                              onChange={async (e) => {
                                                const newTId = e.target.value;
                                                await handleAssignTeacherDirect(sub.subjectId, newTId, assignmentId);
                                              }}
                                              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs outline-none text-slate-700"
                                            >
                                              <option value="">Unassigned</option>
                                              {teachers.map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                              ))}
                                            </select>
                                            <button
                                              onClick={async () => {
                                                if (confirm(`Remove ${sub.subjectName} from this class section?`)) {
                                                  await handleRemoveSubjectFromClass(sub.subjectId);
                                                }
                                              }}
                                              type="button"
                                              className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer flex items-center justify-center"
                                              title="Unlink Subject"
                                            >
                                              <Trash2 className="w-4 h-4 text-rose-500" />
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Accordion: Class Today's Timetable */}
                                <div className="border border-slate-200/60 rounded-xl overflow-hidden bg-white shadow-sm">
                                  <div 
                                    onClick={() => setIsClassTodayExpanded(!isClassTodayExpanded)}
                                    className="flex justify-between items-center px-4 py-3 bg-slate-50 cursor-pointer border-b border-slate-200/60"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Clock className="w-4 h-4 text-blue-500" />
                                      <span className="text-xs font-bold text-slate-700">Today&apos;s Timetable Schedule ({TODAY_DAY_NAME})</span>
                                    </div>
                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isClassTodayExpanded ? 'rotate-180' : ''}`} />
                                  </div>

                                  {isClassTodayExpanded && (
                                    <div className="p-4">
                                      {!classDetail.hasTimetable ? (
                                        <div className="text-xs text-slate-400 italic text-center py-2">No timetable periods scheduled.</div>
                                      ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                          {classDetail.timetablePeriods.map((dg: any) => 
                                            dg.periods.map((p: any) => (
                                              <div 
                                                key={p.key}
                                                onClick={() => handlePeriodCardClick(c.id, p.academicYearId, p.startDate, p.endDate, p.frequency)}
                                                className={`p-3 rounded-xl border border-slate-100 shadow-sm cursor-pointer hover:border-emerald-400 transition-all ${p.isSubstitute ? 'bg-emerald-50/50 border-emerald-200/60' : 'bg-slate-50/60'}`}
                                              >
                                                {p.isSubstitute && (
                                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 uppercase tracking-wide block w-fit mb-1">SUBSTITUTE</span>
                                                )}
                                                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                                                  <span>{timings.find(t => (t.num ?? t.periodNumber) === p.periodNumber)?.label || `Period ${p.periodNumber}`}</span>
                                                  <span>{p.startTime}</span>
                                                </div>
                                                <div className="text-xs font-extrabold text-slate-800 truncate mt-1">{p.subjectName}</div>
                                                <div className="text-[10px] text-slate-500 font-semibold mt-0.5">{p.teacherName}</div>
                                                {p.originalTeacher && (
                                                  <div className="text-[9px] text-amber-600 font-bold mt-1">Leave: {p.originalTeacher}</div>
                                                )}
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                              </div>
                            ) : null}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
           MULTI-STEP SETUP WIZARD (Add Class Section)
           ════════════════════════════════════════════════ */}
      {currentStep > 0 && (
        <div className="space-y-6 animate-in">
          
          {/* Step wizard header */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Plus className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h2 className="text-[18px] font-bold text-slate-800">Add Class Section</h2>
                <p className="text-xs text-slate-400 mt-0.5">Wizard Step {currentStep} of 3</p>
              </div>
            </div>
            
            {/* Steps Progress Indicator */}
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className={`px-2.5 py-1 rounded-full ${currentStep === 1 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>1</span>
              <span className="w-4 h-0.5 bg-slate-200"></span>
              <span className={`px-2.5 py-1 rounded-full ${currentStep === 2 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>2</span>
              <span className="w-4 h-0.5 bg-slate-200"></span>
              <span className={`px-2.5 py-1 rounded-full ${currentStep === 3 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>3</span>
            </div>
          </div>

          {/* STEP 1: CLASS INFO */}
          {currentStep === 1 && (
            <div className="section-card">
              <div className="section-header">
                <h2 className="section-title">Create New Class Section</h2>
                <p className="section-subtitle">Select academic year, class name and section details</p>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Academic Year *</label>
                  <select 
                    value={selectedAcademicYear}
                    onChange={e => setSelectedAcademicYear(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none"
                  >
                    <option value="">Select Academic Year</option>
                    {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                  </select>
                </div>

                <div className="form-group relative">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Class *</label>
                  <div className="flex gap-2">
                    <select 
                      value={selectedClassId}
                      onChange={e => setSelectedClassId(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none"
                    >
                      <option value="">Select Class</option>
                      {availableClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button 
                      type="button"
                      onClick={() => setShowInlineAddClass(!showInlineAddClass)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 flex items-center justify-center font-bold text-xs"
                      title="Add Class Inline"
                    >
                      +
                    </button>
                  </div>

                  {showInlineAddClass && (
                    <div className="absolute top-[102%] left-0 right-0 bg-white border border-slate-200 shadow-xl rounded-xl p-3 z-50 flex gap-2 items-center mt-1 animate-in">
                      <input 
                        type="text" 
                        placeholder="New class name..." 
                        value={newClassNameInline}
                        onChange={e => setNewClassNameInline(e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-blue-500"
                      />
                      <button 
                        onClick={handleSaveNewClassInline}
                        className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg flex items-center justify-center"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => { setShowInlineAddClass(false); setNewClassNameInline(''); }}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Section *</label>
                  <select 
                    value={selectedSectionId}
                    onChange={e => setSelectedSectionId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none"
                  >
                    <option value="">Select Section</option>
                    {availableSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Class Strength (Optional)</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 40"
                    value={classStrength}
                    onChange={e => setClassStrength(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-slate-100">
                <button onClick={() => setCurrentStep(0)} className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all">Cancel</button>
                <button onClick={handleStep1Next} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all flex items-center gap-1.5">Next: Choose Subjects <ArrowRight className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          )}

          {/* STEP 2: CHOOSE SUBJECTS */}
          {currentStep === 2 && (
            <div className="section-card">
              <div className="section-header">
                <h2 className="section-title">Select Subjects</h2>
                <p className="section-subtitle">Choose all academic subjects that are taught in this class section</p>
              </div>

              <div className="search-container mb-4">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="search" 
                    placeholder="Search subjects catalog..." 
                    value={subjectSearchTerm}
                    onChange={e => setSubjectSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {selectedSubjects.size > 0 && (
                <div className="selected-subjects-container mb-4">
                  <div className="selected-header flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-sm border border-emerald-400">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <span className="selected-count text-xs font-bold text-slate-700 dark:text-slate-200">{selectedSubjects.size} Subject(s) Selected</span>
                  </div>
                  <div className="pill-container flex flex-wrap gap-2">
                    {Array.from(selectedSubjects).map(subId => {
                      const subject = allSubjects.find(s => s.id === subId);
                      return (
                        <div key={subId} className="subject-pill flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                          <span>{subject?.name}</span>
                          <button onClick={() => handleSubjectToggle(subId)} className="pill-remove text-blue-400 hover:text-rose-600 rounded-full p-0.5 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="subject-grid grid grid-cols-2 md:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto pr-1">
                {allSubjects
                  .filter(s => s.name.toLowerCase().includes(subjectSearchTerm.toLowerCase()))
                  .map(s => {
                    const isSelected = selectedSubjects.has(s.id);
                    return (
                      <div 
                        key={s.id} 
                        onClick={() => handleSubjectToggle(s.id)}
                        className={`subject-card p-4 rounded-xl border cursor-pointer transition-all ${isSelected ? 'selected border-blue-500 shadow-md bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-400'}`}
                      >
                        <div className="subject-card-header flex justify-between items-center mb-2">
                          {isSelected ? (
                            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-sm border border-emerald-400 transition-all scale-110">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 transition-all" />
                          )}
                          <BookOpen className={`w-4 h-4 transition-colors ${isSelected ? 'text-blue-500' : 'text-slate-400 dark:text-slate-500'}`} />
                        </div>
                        <h3 className={`subject-name text-xs font-bold transition-colors ${isSelected ? 'text-blue-900 dark:text-white' : 'text-slate-800 dark:text-slate-200'}`}>{s.name}</h3>
                      </div>
                    );
                  })}
              </div>

              <div className="flex gap-3 justify-between mt-6 pt-4 border-t border-slate-100">
                <button onClick={() => setCurrentStep(1)} className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all flex items-center gap-1.5"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
                <button onClick={handleStep2Next} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all flex items-center gap-1.5">Next: Assign Teachers <ArrowRight className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          )}

          {/* STEP 3: ASSIGN TEACHERS */}
          {currentStep === 3 && (
            <div className="section-card">
              <div className="section-header">
                <h2 className="section-title">Assign Teachers &amp; Workloads</h2>
                <p className="section-subtitle">Map teaching staff and weekly period allocations to selected subjects</p>
              </div>

              <div className="assignment-container space-y-4 max-h-[350px] overflow-y-auto pr-1">
                {teacherAssignments.map(a => (
                  <div key={a.subjectId} className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200/40 pb-2">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-blue-500" />
                        <h3 className="text-xs font-bold text-slate-800">{a.subjectName}</h3>
                      </div>
                      {a.hasError && (
                        <span className="text-[10px] font-bold text-rose-500 px-2 py-0.5 rounded bg-rose-50 border border-rose-200">Required</span>
                      )}
                    </div>

                    <div className="space-y-3">
                      {a.noTeachersAvailable ? (
                        <div className="flex items-center gap-1.5 p-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs">
                          <AlertCircle className="w-4 h-4" />
                          <span>No qualified teachers mapped to this subject. Please check credentials or add another.</span>
                        </div>
                      ) : (
                        a.teachers.map((t: any) => (
                          <div key={t.id} className="flex gap-3 items-end">
                            <div className="flex-1">
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t.label}</label>
                              <select
                                value={t.selectedTeacherId}
                                onChange={e => handleWizardTeacherChange(a.subjectId, t.id, 'selectedTeacherId', e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none"
                              >
                                <option value="">Select Teacher</option>
                                {t.teacherOptions.map((opt: any) => (
                                  <option key={opt.teacherId || opt.Id} value={opt.teacherId || opt.Id}>{opt.teacherName || opt.Name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="w-24">
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Periods/Wk</label>
                              <input
                                type="number"
                                min="1"
                                max="48"
                                value={t.periodsPerWeek}
                                onChange={e => handleWizardTeacherChange(a.subjectId, t.id, 'periodsPerWeek', Number(e.target.value))}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none"
                              />
                            </div>
                            {!t.isFirst && (
                              <button
                                type="button"
                                onClick={() => handleRemoveTeacherFromWizardRow(a.subjectId, t.id)}
                                className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {!a.noTeachersAvailable && (
                      <button
                        type="button"
                        onClick={() => handleAddTeacherToWizardRow(a.subjectId)}
                        className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 mt-2"
                      >
                        + Add Another Teacher
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3 justify-between mt-6 pt-4 border-t border-slate-100">
                <button onClick={() => setCurrentStep(2)} className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all flex items-center gap-1.5"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
                <button onClick={handleWizardSubmit} className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition-all flex items-center gap-1.5">Create Class Section <Check className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ════════════════════════════════════════════════
           TIMETABLE MATRIX GRID VIEW
           ════════════════════════════════════════════════ */}
      {isTimetableView && (
        <div className="space-y-6 animate-in">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h2 className="text-[18px] font-bold text-slate-800">Class Timetable Matrix</h2>
                <p className="text-xs text-slate-400 mt-0.5">Map subject periods and assign substitute coverages</p>
              </div>
            </div>
            <button 
              onClick={() => setIsTimetableView(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all"
            >
              ✕ Close
            </button>
          </div>

          {/* Timetable Configuration Filters Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Class Section *</label>
                <select
                  value={ttSelectedClassSectionId}
                  onChange={e => {
                    setTtSelectedClassSectionId(e.target.value);
                    const csOpt = classes.find(c => c.id === e.target.value);
                    setTtSelectedClassName(csOpt ? csOpt.name : '');
                    setShowTimetableGrid(false);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none"
                >
                  <option value="">Select Class Section</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Academic Year *</label>
                <select
                  value={ttSelectedAcademicYear}
                  onChange={e => { setTtSelectedAcademicYear(e.target.value); setShowTimetableGrid(false); }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none"
                >
                  <option value="">Select Academic Year</option>
                  {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Frequency *</label>
                <select
                  value={ttFrequency}
                  onChange={e => {
                    setTtFrequency(e.target.value);
                    setTtStartDate(new Date().toISOString().split('T')[0]); // Set to current date
                    setShowTimetableGrid(false);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none"
                >
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Start Date *</label>
                <input
                  type="date"
                  value={ttStartDate}
                  onChange={e => { setTtStartDate(e.target.value); setShowTimetableGrid(false); }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">End Date *</label>
                <input
                  type="date"
                  value={ttEndDate}
                  onChange={e => {
                    const val = e.target.value;
                    if (val && ttStartDate && val <= ttStartDate) {
                      showToast('End Date must be after Start Date.', 'warning');
                      const computedEnd = calculateEndDate(ttStartDate, ttFrequency, ttDuration);
                      setTtEndDate(computedEnd);
                    } else {
                      setTtEndDate(val);
                      setShowTimetableGrid(false);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none"
                />
              </div>
              <div>
                <button
                  onClick={loadTimetableGrid}
                  className="w-full px-4 py-2.5 rounded-xl border border-blue-600 hover:bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  🔍 Load Timetable
                </button>
              </div>
            </div>
          </div>

          {/* Timetable Editor Grid Matrix */}
          {showTimetableGrid && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse min-w-[1200px]">
                  <thead>
                    <tr className="bg-[#1E293B] text-white uppercase text-[10px] tracking-wider font-bold">
                      <th className="px-4 py-3.5 border border-slate-700 w-24">Day</th>
                      {timings.map(t => (
                        <th key={t.id} className="px-4 py-3.5 border border-slate-700 text-center">
                          <div className="font-extrabold">{t.label || t.name || `P${t.periodNumber}`}</div>
                          <div className="text-[9px] opacity-80 font-normal mt-0.5">{t.startTime} - {t.endTime}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {workingDays.map(day => {
                      const dayShortMap: Record<string, string> = {
                        'Monday': 'MON', 'Tuesday': 'TUE', 'Wednesday': 'WED', 
                        'Thursday': 'THU', 'Friday': 'FRI', 'Saturday': 'SAT', 'Sunday': 'SUN'
                      };
                      const dayShort = dayShortMap[day] || day.substring(0, 3).toUpperCase();
                      return (
                        <tr key={day} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-4 border border-slate-200 font-extrabold text-slate-700 text-sm bg-slate-50/50">
                            {dayShort}
                          </td>
                          {timings.map(t => {
                            const cellKey = `${dayShort}-${t.periodNumber}`;
                            const cell = timetableData[cellKey] || { subject: '', teacherId: '' };
                            
                            if (t.isBreak) {
                              return (
                                <td key={t.id} className="p-3 border border-slate-200 bg-slate-55/60 text-center font-semibold text-slate-450 italic select-none align-middle">
                                  {t.name}
                                </td>
                              );
                            }

                            return (
                              <td key={t.periodNumber} className="p-3 border border-slate-200 min-w-[150px]">
                                <div className="space-y-1.5">
                                  <select
                                    value={cell.subject}
                                    onChange={e => handleCellChange(dayShort, t.periodNumber, 'subject', e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none"
                                  >
                                    <option value="">Subject</option>
                                    {allSubjects.map(sub => (
                                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                                    ))}
                                  </select>

                                  <select
                                    value={cell.teacherId}
                                    disabled={!cell.subject}
                                    onChange={e => handleCellChange(dayShort, t.periodNumber, 'teacherId', e.target.value)}
                                    className={`w-full border rounded-lg px-2.5 py-1.5 text-xs outline-none ${cell.subject ? 'bg-white border-slate-200 text-slate-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                                  >
                                    <option value="">{cell.subject ? 'Select Teacher' : 'Select subject first'}</option>
                                    {(subjectTeachers[cell.subject] || []).map(tch => (
                                      <option key={tch.id || tch.Id} value={tch.id || tch.Id}>{tch.name || tch.Name}</option>
                                    ))}
                                  </select>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              <div className="flex justify-end gap-3 p-4 bg-slate-50 border-t border-slate-100">
                <button
                  onClick={() => {
                    if (confirm('Clear entire grid layout inputs?')) {
                      const cleared: Record<string, { subject: string; teacherId: string }> = {};
                      const dayShortMap: Record<string, string> = {
                        'Monday': 'MON', 'Tuesday': 'TUE', 'Wednesday': 'WED', 
                        'Thursday': 'THU', 'Friday': 'FRI', 'Saturday': 'SAT', 'Sunday': 'SUN'
                      };
                      for (const day of workingDays) {
                        const dayShort = dayShortMap[day] || day.substring(0, 3).toUpperCase();
                        for (const t of timings) {
                          if (!t.isBreak) {
                            cleared[`${dayShort}-${t.periodNumber}`] = { subject: '', teacherId: '' };
                          }
                        }
                      }
                      setTimetableData(cleared);
                    }
                  }}
                  className="px-4 py-2 border border-slate-200 bg-white rounded-xl text-xs font-bold text-slate-600"
                >
                  🧹 Clear Inputs
                </button>
                <button
                  onClick={handleSaveTimetable}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white shadow-sm"
                >
                  💾 Save Timetable
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════
           TIMETABLE CONFIGURATION VIEW
           ════════════════════════════════════════════════ */}
      {isTimetableConfigView && (
        <div className="space-y-6 animate-in">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Settings className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-[18px] font-bold text-slate-800">Timetable Structure Configuration</h2>
                <p className="text-xs text-slate-400 mt-0.5">Customize daily schedule formats, teaching periods, breaks, and working days</p>
              </div>
            </div>
            <button 
              onClick={() => setIsTimetableConfigView(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all"
            >
              ✕ Close
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* COLUMN 1 & 2: SETUP CONFIG */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Card 1: Working Days & Working Hours */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                  <span className="w-1.5 h-3.5 bg-blue-500 rounded-full"></span> 1. School Operational Parameters
                </h3>
                
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">School Working Days *</label>
                  <div className="flex flex-wrap gap-2">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                      const isSelected = workingDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setWorkingDays(workingDays.filter(d => d !== day));
                            } else {
                              setWorkingDays([...workingDays, day]);
                            }
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                            isSelected 
                              ? 'bg-blue-600 border-blue-600 text-white shadow-sm' 
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">School Opening Hour *</label>
                    <input
                      type="text"
                      value={schoolStartTime}
                      onChange={e => setSchoolStartTime(e.target.value)}
                      placeholder="e.g. 09:00 AM"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-700 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">School Closing Hour *</label>
                    <input
                      type="text"
                      value={schoolEndTime}
                      onChange={e => setSchoolEndTime(e.target.value)}
                      placeholder="e.g. 04:00 PM"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-700 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Period Count & Breaks */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                <h3 className="text-sm font-extrabold text-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-3.5 bg-indigo-500 rounded-full"></span> 2. Timetable Generation Settings
                  </div>
                  <div className="flex items-center gap-2 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => setAutoGenerate(true)}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${autoGenerate ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
                    >
                      Auto-Generate
                    </button>
                    <button
                      type="button"
                      onClick={() => setAutoGenerate(false)}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${!autoGenerate ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
                    >
                      Manual Mode
                    </button>
                  </div>
                </h3>

                {autoGenerate ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Teaching Period Duration (minutes) *</label>
                      <input
                        type="number"
                        value={periodDuration}
                        onChange={e => setPeriodDuration(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-700 outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Number of Teaching Periods *</label>
                      <input
                        type="number"
                        value={numPeriods}
                        onChange={e => setNumPeriods(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-700 outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-slate-500 text-xs">
                    💡 <strong>Manual Mode Active:</strong> You can define each teaching period and break directly in the list on the right side. End Time must be after Start Time.
                  </div>
                )}

                {/* Breaks Section */}
                <div className="border-t border-slate-100 pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Break Allocations</label>
                    <button
                      type="button"
                      onClick={() => setConfigBreaksList([...configBreaksList, { name: 'Short Break', startTime: '10:30 AM', endTime: '10:45 AM' }])}
                      className="px-2.5 py-1 text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-1 transition-all"
                    >
                      <Plus className="w-3 h-3" /> Add Break
                    </button>
                  </div>

                  {configBreaksList.length === 0 ? (
                    <div className="text-center py-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                      No breaks configured. Click "Add Break" to register intervals.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {configBreaksList.map((brk, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 animate-in">
                          <div className="flex-1">
                            <input
                              type="text"
                              value={brk.name}
                              onChange={e => {
                                const copy = [...configBreaksList];
                                copy[idx].name = e.target.value;
                                setConfigBreaksList(copy);
                              }}
                              placeholder="Break Name (e.g. Lunch Break)"
                              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none"
                            />
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={brk.startTime}
                              onChange={e => {
                                const copy = [...configBreaksList];
                                copy[idx].startTime = e.target.value;
                                setConfigBreaksList(copy);
                              }}
                              placeholder="Start Time (01:00 PM)"
                              className="w-28 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-center outline-none"
                            />
                            <input
                              type="text"
                              value={brk.endTime}
                              onChange={e => {
                                const copy = [...configBreaksList];
                                copy[idx].endTime = e.target.value;
                                setConfigBreaksList(copy);
                              }}
                              placeholder="End Time (01:45 PM)"
                              className="w-28 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-center outline-none"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setConfigBreaksList(configBreaksList.filter((_, i) => i !== idx))}
                            className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-all"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {autoGenerate && (
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleAutoGenerateTimetable}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                      >
                        ⚡ Generate Periods &amp; Breaks
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* COLUMN 3: PERIOD PREVIEW / EDIT LIST */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5 flex flex-col h-[600px]">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                  <span className="w-1.5 h-3.5 bg-indigo-500 rounded-full"></span> Timetable Slots Preview
                </h3>
                {!autoGenerate && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfigPeriodsList([
                        ...configPeriodsList,
                        { periodNumber: configPeriodsList.length + 1, name: `P${configPeriodsList.length + 1}`, startTime: '09:00 AM', endTime: '10:00 AM', isBreak: false }
                      ]);
                    }}
                    className="text-[10px] text-blue-600 hover:underline font-bold"
                  >
                    + Add Slot
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {configPeriodsList.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs italic">
                    {autoGenerate 
                      ? 'Configure settings and click "Generate Periods" to preview timetable structure.' 
                      : 'Click "+ Add Slot" to register timetable slots manually.'}
                  </div>
                ) : (
                  configPeriodsList.map((slot, idx) => {
                    return (
                      <div key={idx} className={`p-3 rounded-xl border transition-all ${
                        slot.isBreak 
                          ? 'bg-amber-50/40 border-amber-200' 
                          : 'bg-slate-50 border-slate-200'
                      }`}>
                        {autoGenerate ? (
                          // Read-only list in auto-generate mode
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <div className="font-bold text-slate-700 flex items-center gap-1.5">
                              {slot.isBreak ? (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-extrabold text-[9px] uppercase">Break</span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-extrabold text-[9px] uppercase">Period</span>
                              )}
                              <span>{slot.name}</span>
                            </div>
                            <div className="font-semibold text-slate-500 text-right">
                              {slot.startTime} - {slot.endTime}
                            </div>
                          </div>
                        ) : (
                          // Manual edit fields in manual mode
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <input
                                type="text"
                                value={slot.name}
                                onChange={e => {
                                  const copy = [...configPeriodsList];
                                  copy[idx].name = e.target.value;
                                  setConfigPeriodsList(copy);
                                }}
                                className="font-bold bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 w-28 outline-none"
                              />
                              <div className="flex items-center gap-2">
                                <label className="flex items-center gap-1 font-bold text-[10px] text-slate-500">
                                  <input
                                    type="checkbox"
                                    checked={slot.isBreak || false}
                                    onChange={e => {
                                      const copy = [...configPeriodsList];
                                      copy[idx].isBreak = e.target.checked;
                                      setConfigPeriodsList(copy);
                                    }}
                                    className="rounded border-slate-300"
                                  />
                                  Break
                                </label>
                                <button
                                  type="button"
                                  onClick={() => setConfigPeriodsList(configPeriodsList.filter((_, i) => i !== idx))}
                                  className="text-red-500 hover:text-red-600 font-bold"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={slot.startTime}
                                onChange={e => {
                                  const copy = [...configPeriodsList];
                                  copy[idx].startTime = e.target.value;
                                  setConfigPeriodsList(copy);
                                }}
                                placeholder="Start (e.g. 09:00 AM)"
                                className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-600 text-center outline-none"
                              />
                              <input
                                type="text"
                                value={slot.endTime}
                                onChange={e => {
                                  const copy = [...configPeriodsList];
                                  copy[idx].endTime = e.target.value;
                                  setConfigPeriodsList(copy);
                                }}
                                placeholder="End (e.g. 09:45 AM)"
                                className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-600 text-center outline-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Validation errors */}
              {configErrors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1 text-[11px] text-red-700 max-h-24 overflow-y-auto">
                  {configErrors.map((err, i) => (
                    <div key={i} className="font-semibold">• {err}</div>
                  ))}
                </div>
              )}

              <div className="border-t border-slate-100 pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsTimetableConfigView(false)}
                  className="flex-1 py-2 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition-all text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveConfig(false)}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-sm text-center"
                >
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TIMETABLE RESET WARNING MODAL ── */}
      {showConfirmChangeConfigModal && (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-100 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mx-auto">
              ⚠️
            </div>
            <h3 className="font-extrabold text-slate-800 text-base">Overwriting Existing Timetables?</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Changing the timetable configuration will clear all currently active class timetable grid schedules for this tenant. 
              <br /><span className="font-bold text-red-500 mt-2 block">This action is permanent and cannot be undone.</span>
              <br /><br />Do you wish to proceed and apply the new structure?
            </p>
            <div className="flex gap-2 pt-2 text-xs">
              <button 
                onClick={() => setShowConfirmChangeConfigModal(false)}
                className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl"
              >
                No, Keep Existing
              </button>
              <button 
                onClick={() => handleSaveConfig(true)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl"
              >
                Yes, Overwrite &amp; Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
           WIZARD SUCCESS MODAL
           ════════════════════════════════════════════════ */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-slate-100 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>
            <h3 className="font-extrabold text-slate-800 text-lg">Class Setup Complete!</h3>
            <p className="text-xs text-slate-400">{successMessage}</p>
            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => { setShowSuccessModal(false); enterSetupWizard(); }}
                className="flex-1 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl"
              >
                Create Another
              </button>
              <button 
                onClick={handleDoneWizard}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD NEW TEACHER MODAL (Single Creation) ── */}
      {showTeacherForm && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[90]" onClick={() => setShowTeacherForm(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl bg-white rounded-2xl shadow-2xl z-[100] overflow-y-auto max-h-[90vh] animate-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-base">Add New Teacher</h3>
              <button onClick={() => setShowTeacherForm(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            
            <form onSubmit={handleSaveTeacher} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">First Name *</label>
                  <input required value={newTeacher.firstName} onChange={e => setNewTeacher({...newTeacher, firstName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-blue-500" placeholder="First Name" />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Last Name *</label>
                  <input required value={newTeacher.lastName} onChange={e => setNewTeacher({...newTeacher, lastName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-blue-500" placeholder="Last Name" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Email *</label>
                  <input type="email" required value={newTeacher.email} onChange={e => setNewTeacher({...newTeacher, email: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-blue-500" placeholder="email@school.com" />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Phone *</label>
                  <input type="tel" required value={newTeacher.phone} onChange={e => setNewTeacher({...newTeacher, phone: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-blue-500" placeholder="+91 9XXXXXXXXX" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Qualification</label>
                  <input value={newTeacher.qualification} onChange={e => setNewTeacher({...newTeacher, qualification: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-blue-500" placeholder="e.g. M.Sc, B.Ed" />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Basic Salary (₹)</label>
                  <input type="number" value={newTeacher.basicSalary} onChange={e => setNewTeacher({...newTeacher, basicSalary: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-slate-500 font-semibold">Subject Skills</label>
                  <button type="button" onClick={() => setNewTeacher({...newTeacher, skills: [...newTeacher.skills, {subjectId:'',level:'Expert',yearsOfExperience:5} as any]})} className="text-[11px] text-blue-600 font-bold hover:underline">+ Add Skill</button>
                </div>
                {newTeacher.skills.map((sk, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <select 
                      value={sk.subjectId} 
                      onChange={e => {
                        const s = [...newTeacher.skills];
                        s[idx] = { ...s[idx], subjectId: e.target.value };
                        setNewTeacher({ ...newTeacher, skills: s });
                      }}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none"
                    >
                      <option value="">Select Subject</option>
                      {allSubjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                    </select>
                    <select 
                      value={sk.skillLevel} 
                      onChange={e => {
                        const s = [...newTeacher.skills];
                        s[idx] = { ...s[idx], skillLevel: e.target.value };
                        setNewTeacher({ ...newTeacher, skills: s });
                      }}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none"
                    >
                      <option>Beginner</option>
                      <option>Intermediate</option>
                      <option>Advanced</option>
                      <option>Expert</option>
                    </select>
                    <input 
                      type="number" 
                      value={sk.yearsOfExperience} 
                      onChange={e => {
                        const s = [...newTeacher.skills];
                        s[idx] = { ...s[idx], yearsOfExperience: Number(e.target.value) };
                        setNewTeacher({ ...newTeacher, skills: s });
                      }}
                      className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none" 
                      placeholder="Yrs" 
                    />
                    {newTeacher.skills.length > 1 && (
                      <button type="button" onClick={() => setNewTeacher({...newTeacher, skills: newTeacher.skills.filter((_, i) => i !== idx)})} className="text-rose-500 hover:text-rose-700">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowTeacherForm(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs">Cancel</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm">Save Teacher</button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ── REASSIGN TEACHER MODAL ── */}
      {showReassignModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[120]" onClick={() => setShowReassignModal(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-2xl shadow-2xl z-[130] p-6 animate-in">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
              <h3 className="font-extrabold text-slate-800 text-sm">Reassign Teacher</h3>
              <button onClick={() => setShowReassignModal(false)} className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            
            <div className="space-y-4 text-xs">
              <div>
                <span className="block text-slate-400 font-semibold mb-1">Subject</span>
                <span className="font-bold text-slate-700">{reassignContext.subjectName}</span>
              </div>

              <div>
                <span className="block text-slate-400 font-semibold mb-1">Current Teacher</span>
                <span className="font-bold text-slate-700">{reassignContext.currentTeacherName || 'Unassigned'}</span>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">New Teacher Assignment *</label>
                <select
                  value={reassignNewTeacherId}
                  onChange={e => setReassignNewTeacherId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none"
                >
                  <option value="">Select New Teacher</option>
                  {reassignTeacherOptions.map(o => (
                    <option key={o.id || o.Id} value={o.id || o.Id}>{o.name || o.Name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Periods/Week *</label>
                <input
                  type="number"
                  value={reassignPeriodsPerWeek}
                  onChange={e => setReassignPeriodsPerWeek(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button onClick={() => setShowReassignModal(false)} className="flex-1 py-2 border border-slate-200 rounded-xl text-slate-600 font-semibold">Cancel</button>
                <button onClick={handleSaveReassign} className="flex-1 py-2 bg-blue-600 text-white rounded-xl font-bold">Save Change</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {deleteConfirm.show && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[150]" onClick={() => setDeleteConfirm({ show: false, type: 'class', id: '', name: '' })} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-2xl shadow-2xl z-[160] p-6 text-center space-y-4 animate-in">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center text-rose-600 mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-slate-800 text-base">Confirm Deletion</h3>
            <p className="text-xs text-slate-400">Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This action is soft-delete but might disrupt active assignments.</p>
            <div className="flex gap-2">
              <button 
                onClick={() => setDeleteConfirm({ show: false, type: 'class', id: '', name: '' })}
                className="flex-1 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmDelete}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── SIMPLE MODALS (Subject, Class, Section) ── */}
      {showAddSubject && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowAddSubject(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl z-50 p-6 animate-in">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-sm">Add Subjects Catalog</h3>
              <button onClick={() => setShowAddSubject(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>

            {allSubjects.length > 0 && (
              <div className="mb-4">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Existing Subjects Catalog</h4>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                  {allSubjects.map((sub) => (
                    <div key={sub.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-medium">
                      <span>{sub.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteSubject(sub.id)}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Subject"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 mb-4">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Add New Subjects</h4>
              {subjectsListInput.map((s, idx) => (
                <div key={s.id} className="flex gap-2">
                  <input
                    value={s.name}
                    onChange={e => { 
                      const arr = [...subjectsListInput]; 
                      arr[idx] = { ...arr[idx], name: e.target.value }; 
                      setSubjectsListInput(arr); 
                    }}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs outline-none focus:border-blue-500"
                    placeholder="e.g. Mathematics, Physical Science"
                  />
                  <button
                    type="button"
                    onClick={() => setSubjectsListInput([...subjectsListInput, { id: Date.now(), name: '' }])}
                    className="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold hover:bg-purple-200"
                  >+</button>
                  {subjectsListInput.length > 1 && (
                    <button type="button" onClick={() => setSubjectsListInput(subjectsListInput.filter((_, i) => i !== idx))} className="w-9 h-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={handleSaveSubjects} className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs cursor-pointer">
              ✓ Submit Subjects
            </button>
          </div>
        </>
      )}

      {showCreateClass && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowCreateClass(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-2xl shadow-2xl z-50 p-6 animate-in">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-sm">Create Class Names</h3>
              <button onClick={() => setShowCreateClass(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>

            {existingClasses.length > 0 && (
              <div className="mb-4">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Existing Classes</h4>
                <div className="max-h-32 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                  {existingClasses.map((cls) => (
                    <div key={cls.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs text-slate-700">
                      <span>{cls.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteClass(cls.id)}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Class"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 mb-4">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Add New Classes</h4>
              {classNamesInput.map((entry, idx) => (
                <div key={entry.id} className="flex gap-2 items-center">
                  <input
                    value={entry.name}
                    onChange={e => {
                      const arr = [...classNamesInput];
                      arr[idx] = { ...arr[idx], name: e.target.value };
                      setClassNamesInput(arr);
                    }}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs outline-none focus:border-blue-500"
                    placeholder={`e.g. Grade ${idx + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => setClassNamesInput([...classNamesInput, { id: Date.now(), name: '' }])}
                    className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold hover:bg-blue-200"
                  >+</button>
                  {classNamesInput.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setClassNamesInput(classNamesInput.filter((_, i) => i !== idx))}
                      className="w-9 h-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={handleSaveClass} className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer">
              ✓ Save Classes
            </button>
          </div>
        </>
      )}

      {showCreateSection && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowCreateSection(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-2xl shadow-2xl z-50 p-6 animate-in">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-sm">Create Section Letters</h3>
              <button onClick={() => setShowCreateSection(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>

            {availableSections.length > 0 && (
              <div className="mb-4">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Existing Sections</h4>
                <div className="max-h-32 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                  {availableSections.map((sec) => (
                    <div key={sec.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-medium">
                      <span>{sec.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteSection(sec.id)}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Section"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 mb-4">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Add New Sections</h4>
              {sectionNamesInput.map((entry, idx) => (
                <div key={entry.id} className="flex gap-2 items-center">
                  <input
                    value={entry.name}
                    onChange={e => {
                      const arr = [...sectionNamesInput];
                      arr[idx] = { ...arr[idx], name: e.target.value };
                      setSectionNamesInput(arr);
                    }}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs outline-none focus:border-blue-500"
                    placeholder={`e.g. Section ${String.fromCharCode(65 + idx)}`}
                  />
                  <button
                    type="button"
                    onClick={() => setSectionNamesInput([...sectionNamesInput, { id: Date.now(), name: '' }])}
                    className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold hover:bg-blue-200"
                  >+</button>
                  {sectionNamesInput.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSectionNamesInput(sectionNamesInput.filter((_, i) => i !== idx))}
                      className="w-9 h-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button onClick={handleSaveSectionsBulk} className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer">
              ✓ Save Sections
            </button>
          </div>
        </>
      )}

      {isManageTypesOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setIsManageTypesOpen(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl z-50 p-6 animate-in text-slate-800">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-blue-600" />
                <h3 className="font-extrabold text-slate-800 text-sm">Manage Exam Types</h3>
              </div>
              <button
                onClick={() => setIsManageTypesOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4">
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
              <div className="border border-slate-250 rounded-xl divide-y divide-slate-100 max-h-[220px] overflow-y-auto bg-slate-50/20">
                {manageTypesList.length === 0 ? (
                  <div className="p-8 text-center text-slate-450 text-xs italic">
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
                          <span className="text-slate-850 font-bold">{t.name}</span>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTypeId(t.id);
                                setEditingTypeName(t.name);
                              }}
                              className="text-blue-600 hover:text-blue-700 cursor-pointer font-bold"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteType(t.id)}
                              className="text-rose-500 hover:text-rose-650 cursor-pointer font-bold"
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
        </>
      )}

      <BulkTeacherImportModal
        isOpen={showImportTeachers}
        onClose={() => setShowImportTeachers(false)}
        onImportSuccess={(count) => {
          showToast(`Successfully imported ${count} teachers.`, 'success');
          loadWorkloadDashboard();
        }}
        allSubjects={allSubjects}
      />
    </div>
  );
}
