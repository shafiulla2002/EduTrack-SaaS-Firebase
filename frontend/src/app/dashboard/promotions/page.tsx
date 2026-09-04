'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, ArrowLeft, Check, CheckCircle, Plus, X, 
  ChevronLeft, User, Calendar, DollarSign, AlertCircle, 
  Award, Users, ArrowRight, Shield, RefreshCw,
  GraduationCap, UserX, UserCheck, History, Clock, 
  FileText, ChevronRight, Loader2, BookOpen, AlertTriangle, ExternalLink, ArrowUpRight, Eye
} from 'lucide-react';
import Drawer from '@/components/Drawer';
import { api } from '@/lib/api';

const CLASS_ORDER = [
  'Nursery', 'LKG', 'UKG',
  'Class-1', 'Class-2', 'Class-3', 'Class-4', 'Class-5', 'Class-6', 'Class-7', 'Class-8', 'Class-9', 'Class-10',
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'
];

function getNextClass(currentClass: string): string {
  if (!currentClass) return '';
  const normalized = currentClass.trim().replace(/\s+/g, ' ');
  const normalizedWithDash = currentClass.trim().replace(/\s+/g, '-');
  
  let idx = CLASS_ORDER.findIndex(c => c.toLowerCase() === normalized.toLowerCase() || c.toLowerCase() === normalizedWithDash.toLowerCase());
  if (idx >= 0 && idx < CLASS_ORDER.length - 1) {
    const currentIsGrade = normalized.toLowerCase().startsWith('grade');
    const nextClass = CLASS_ORDER[idx + 1];
    const nextIsGrade = nextClass.toLowerCase().startsWith('grade');
    if (currentIsGrade === nextIsGrade) {
      return nextClass;
    }
  }
  
  const salesforceOrder = [
    'Nursery', 'LKG', 'UKG',
    'Class-1', 'Class-2', 'Class-3', 'Class-4', 'Class-5', 'Class-6', 'Class-7', 'Class-8', 'Class-9', 'Class-10'
  ];
  const gradeOrder = [
    'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'
  ];
  
  let salesforceIdx = salesforceOrder.findIndex(c => c.toLowerCase() === normalizedWithDash.toLowerCase() || c.toLowerCase() === normalized.toLowerCase());
  if (salesforceIdx >= 0 && salesforceIdx < salesforceOrder.length - 1) {
    return salesforceOrder[salesforceIdx + 1];
  }
  
  let gradeIdx = gradeOrder.findIndex(c => c.toLowerCase() === normalized.toLowerCase() || c.toLowerCase() === normalizedWithDash.toLowerCase());
  if (gradeIdx >= 0 && gradeIdx < gradeOrder.length - 1) {
    return gradeOrder[gradeIdx + 1];
  }
  
  return '';
}

interface ClassSummary {
  className: string;
  section: string;
  studentCount: number;
}

export default function StudentPromotionPage() {
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [dbClasses, setDbClasses] = useState<any[]>([]);
  const [studentsState, setStudentsState] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Source Filters
  const [sourceYear, setSourceYear] = useState('');
  const [targetYear, setTargetYear] = useState('');
  const [sourceClass, setSourceClass] = useState('ALL');
  const [sourceSection, setSourceSection] = useState('');

  // Target Config
  const [targetClass, setTargetClass] = useState('');
  const [targetSection, setTargetSection] = useState('');

  // UI state
  const [isDrilldown, setIsDrilldown] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Record<string, boolean>>({});
  
  // Custom Success Modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [promotedCount, setPromotedCount] = useState(0);

  // Validation / Summary Dialog States
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationData, setValidationData] = useState<any>(null);

  // Post-Promotion Summary Report State
  const [reportData, setReportData] = useState<any>(null);

  // Sections cache for re-enrollment
  const [dbSections, setDbSections] = useState<any[]>([]);

  // ── Student Lifecycle States ──
  const [isLifecycleDrawerOpen, setIsLifecycleDrawerOpen] = useState(false);
  const [lifecycleTab, setLifecycleTab] = useState<'actions' | 'former' | 'reenroll'>('actions');
  
  // Tab 1: Lifecycle Actions
  const [selectedStudentForLifecycle, setSelectedStudentForLifecycle] = useState<any | null>(null);
  const [lifecycleActionType, setLifecycleActionType] = useState<'LEFT' | 'TRANSFERRED' | 'WITHDRAWN' | 'GRADUATED'>('LEFT');
  const [lifecycleReason, setLifecycleReason] = useState('Left School');
  const [lifecycleEffectiveDate, setLifecycleEffectiveDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [lifecycleNotes, setLifecycleNotes] = useState('');
  const [lifecycleSubmitting, setLifecycleSubmitting] = useState(false);
  const [lifecycleStudentSearch, setLifecycleStudentSearch] = useState('');

  // Tab 2: Former / Historical Students
  const [historicalStudents, setHistoricalStudents] = useState<any[]>([]);
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  const [historicalStatusFilter, setHistoricalStatusFilter] = useState('ALL');
  const [historicalSearchQuery, setHistoricalSearchQuery] = useState('');

  // Tab 3: Re-enroll Student
  const [studentToReEnroll, setStudentToReEnroll] = useState<any | null>(null);
  const [reEnrollYearId, setReEnrollYearId] = useState('');
  const [reEnrollClassId, setReEnrollClassId] = useState('');
  const [reEnrollSectionId, setReEnrollSectionId] = useState('');
  const [reEnrollRollNo, setReEnrollRollNo] = useState('');
  const [reEnrollNotes, setReEnrollNotes] = useState('');
  const [reEnrollSubmitting, setReEnrollSubmitting] = useState(false);

  // Complete Student History Modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [studentHistoryData, setStudentHistoryData] = useState<any | null>(null);
  const [loadingStudentHistory, setLoadingStudentHistory] = useState(false);
  const [historyActiveTab, setHistoryActiveTab] = useState<'overview' | 'timeline' | 'attendance' | 'exams' | 'homework' | 'fees' | 'complaints'>('overview');

  // Load Academic Years & Classes & Sections
  useEffect(() => {
    const fetchYears = async () => {
      try {
        const res = await api.get('/academics/academic-years');
        setAcademicYears(res.data);
        if (res.data.length > 0) {
          const active = res.data.find((y: any) => y.isActive);
          const inactive = res.data.find((y: any) => !y.isActive);
          if (active) {
            setSourceYear(active.id);
          } else {
            setSourceYear(res.data[0].id);
          }
          if (inactive) {
            setTargetYear(inactive.id);
          } else {
            setTargetYear(res.data[res.data.length - 1].id);
          }
        }
      } catch (err) {
        console.error('Error fetching academic years:', err);
      }
    };
    const fetchClasses = async () => {
      try {
        const res = await api.get('/academics/classes');
        const sorted = (res.data || []).sort((a: any, b: any) => {
          const idxA = CLASS_ORDER.indexOf(a.name);
          const idxB = CLASS_ORDER.indexOf(b.name);
          if (idxA >= 0 && idxB >= 0) return idxA - idxB;
          if (idxA >= 0) return -1;
          if (idxB >= 0) return 1;
          return a.name.localeCompare(b.name);
        });
        setDbClasses(sorted);
      } catch (err) {
        console.error('Error fetching classes:', err);
      }
    };
    const fetchSections = async () => {
      try {
        const res = await api.get('/academics/sections');
        setDbSections(res.data || []);
      } catch (err) {
        console.error('Error fetching sections:', err);
      }
    };
    fetchYears();
    fetchClasses();
    fetchSections();
  }, []);

  const fetchHistoricalStudents = async () => {
    setLoadingHistorical(true);
    try {
      const res = await api.get('/students/lifecycle/historical', {
        params: {
          status: historicalStatusFilter !== 'ALL' ? historicalStatusFilter : undefined,
          search: historicalSearchQuery || undefined,
        }
      });
      setHistoricalStudents(res.data || []);
    } catch (err) {
      console.error('Failed to load historical students:', err);
    } finally {
      setLoadingHistorical(false);
    }
  };

  useEffect(() => {
    if (isLifecycleDrawerOpen && lifecycleTab === 'former') {
      fetchHistoricalStudents();
    }
  }, [isLifecycleDrawerOpen, lifecycleTab, historicalStatusFilter]);

  const handleApplyLifecycleStatus = async () => {
    if (!selectedStudentForLifecycle) {
      alert('Please select a student to update lifecycle status.');
      return;
    }
    setLifecycleSubmitting(true);
    try {
      await api.post('/students/lifecycle/status', {
        studentId: selectedStudentForLifecycle.id,
        status: lifecycleActionType,
        reason: lifecycleReason,
        effectiveDate: lifecycleEffectiveDate,
        lastClassName: selectedStudentForLifecycle.class,
        lastSectionName: selectedStudentForLifecycle.section,
        academicYearId: sourceYear,
        notes: lifecycleNotes,
      });

      alert(`Student ${selectedStudentForLifecycle.name} has been marked as ${lifecycleActionType}.`);
      setSelectedStudentForLifecycle(null);
      setLifecycleNotes('');
      await fetchCandidates();
      if (lifecycleTab === 'former') {
        await fetchHistoricalStudents();
      }
    } catch (err: any) {
      console.error('Lifecycle update failed:', err);
      alert(`Failed to update lifecycle status: ${err.response?.data?.message || err.message}`);
    } finally {
      setLifecycleSubmitting(false);
    }
  };

  const handleReEnrollSubmit = async () => {
    if (!studentToReEnroll) {
      alert('Please select a former student to re-enroll.');
      return;
    }
    if (!reEnrollClassId || !reEnrollSectionId) {
      alert('Please select target class and section.');
      return;
    }
    setReEnrollSubmitting(true);
    try {
      await api.post('/students/lifecycle/re-enroll', {
        studentId: studentToReEnroll.id,
        targetYearId: reEnrollYearId || targetYear || sourceYear,
        targetClassId: reEnrollClassId,
        targetSectionId: reEnrollSectionId,
        rollNo: reEnrollRollNo || undefined,
        notes: reEnrollNotes,
      });

      alert(`Student ${studentToReEnroll.name} has been re-enrolled successfully!`);
      setStudentToReEnroll(null);
      setReEnrollRollNo('');
      setReEnrollNotes('');
      await fetchCandidates();
      fetchHistoricalStudents();
      setLifecycleTab('former');
    } catch (err: any) {
      console.error('Re-enrollment failed:', err);
      alert(`Failed to re-enroll student: ${err.response?.data?.message || err.message}`);
    } finally {
      setReEnrollSubmitting(false);
    }
  };

  const openCompleteStudentHistory = async (studentId: string) => {
    setIsHistoryModalOpen(true);
    setLoadingStudentHistory(true);
    setHistoryActiveTab('overview');
    try {
      const res = await api.get(`/students/${studentId}/complete-history`);
      setStudentHistoryData(res.data);
    } catch (err) {
      console.error('Failed to load complete student history:', err);
      alert('Failed to load complete student history.');
    } finally {
      setLoadingStudentHistory(false);
    }
  };

  // Fetch Candidates
  const fetchCandidates = async () => {
    if (!sourceYear) return;
    setIsLoading(true);
    try {
      const res = await api.get('/students/promotion-candidates', {
        params: {
          sourceYearId: sourceYear,
          className: sourceClass,
          sectionName: sourceSection || undefined,
        }
      });
      setStudentsState(res.data);
    } catch (err) {
      console.error('Error fetching candidates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, [sourceYear, sourceClass, sourceSection]);

  // Sync target year when source year changes
  useEffect(() => {
    if (sourceYear && academicYears.length > 0) {
      const active = academicYears.find((y: any) => y.isActive && y.id !== sourceYear);
      if (active) {
        setTargetYear(active.id);
      } else {
        const other = academicYears.find((y: any) => y.id !== sourceYear);
        if (other) setTargetYear(other.id);
      }
    }
  }, [sourceYear, academicYears]);

  // Flexible class & section matching helpers
  const isSectionMatch = (studentSection: string, filterSection: string) => {
    if (!filterSection || filterSection === 'ALL') return true;
    if (!studentSection) return false;
    const cleanStudent = studentSection.replace(/^Section[-\s]*/i, '').trim().toLowerCase();
    const cleanFilter = filterSection.replace(/^Section[-\s]*/i, '').trim().toLowerCase();
    return cleanStudent === cleanFilter || studentSection.toLowerCase() === filterSection.toLowerCase();
  };

  const isClassMatch = (studentClass: string, filterClass: string) => {
    if (!filterClass || filterClass === 'ALL') return true;
    if (!studentClass) return false;
    return studentClass.toLowerCase().trim() === filterClass.toLowerCase().trim();
  };

  // Dynamically resolved sections from DB and loaded students
  const availableSections = React.useMemo(() => {
    const set = new Set<string>();
    (dbSections || []).forEach(s => s.name && set.add(s.name));
    (studentsState || []).forEach(s => s.section && set.add(s.section));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [dbSections, studentsState]);

  // Sync target class when source class changes
  useEffect(() => {
    if (sourceClass === 'ALL') {
      setIsDrilldown(false);
      setTargetClass('');
    } else if (sourceClass) {
      const nextCls = getNextClass(sourceClass);
      setTargetClass(nextCls);
      setIsDrilldown(true);
    } else {
      setTargetClass('');
    }
  }, [sourceClass]);

  // Calculate Class Summaries
  const getClassSummaries = (): ClassSummary[] => {
    const counts: Record<string, number> = {};
    
    studentsState.forEach(student => {
      const key = `${student.class}:${student.section}`;
      counts[key] = (counts[key] || 0) + 1;
    });

    return Object.entries(counts).map(([key, count]) => {
      const [className, section] = key.split(':');
      return { className, section, studentCount: count };
    }).sort((a, b) => a.className.localeCompare(b.className));
  };

  const summaries = getClassSummaries();

  // Filter summaries based on section chip selection & class
  const filteredSourceSummary = summaries.filter(item => {
    return isClassMatch(item.className, sourceClass) && isSectionMatch(item.section, sourceSection);
  });

  // Projection Map for Right Card
  const filteredTargetSummary = (() => {
    const projectionMap = new Map<string, ClassSummary>();
    
    filteredSourceSummary.forEach(source => {
      const nextClass = getNextClass(source.className);
      if (!nextClass) return; // Graduating classes don't project

      const key = `${nextClass}:${source.section}`;
      const existing = projectionMap.get(key);
      if (existing) {
        existing.studentCount += source.studentCount;
      } else {
        projectionMap.set(key, {
          className: nextClass,
          section: source.section,
          studentCount: source.studentCount
        });
      }
    });

    return Array.from(projectionMap.values());
  })();

  // Filtered Students for Drilldown view
  const currentStudentsList = studentsState.filter(s => {
    const matchesClass = isClassMatch(s.class, sourceClass);
    const matchesSection = isSectionMatch(s.section, sourceSection);
    const matchesSearch = !searchQuery || 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.rollNo.includes(searchQuery);
    return matchesClass && matchesSection && matchesSearch;
  });

  // Candidate Pool Count
  const sourceTotalCount = (() => {
    if (sourceClass !== 'ALL') return currentStudentsList.length;
    
    return filteredSourceSummary.reduce((sum, item) => {
      const isPromotable = !!getNextClass(item.className);
      return sum + (isPromotable ? item.studentCount : 0);
    }, 0);
  })();

  // Vetted / Selected Students
  const selectedStudents = currentStudentsList.filter(s => !!selectedStudentIds[s.id]);
  const targetTotalCount = sourceClass === 'ALL' ? sourceTotalCount : selectedStudents.length;

  // Initial selection of all students on drilldown
  useEffect(() => {
    if (isDrilldown) {
      const initialSel: Record<string, boolean> = {};
      currentStudentsList.forEach(s => {
        initialSel[s.id] = true;
      });
      setSelectedStudentIds(initialSel);
    }
  }, [isDrilldown, sourceClass, sourceSection, currentStudentsList.length]);

  const handleStudentToggle = (studentId: string) => {
    setSelectedStudentIds(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  const handleSelectAll = () => {
    const newSel: Record<string, boolean> = {};
    currentStudentsList.forEach(s => {
      newSel[s.id] = true;
    });
    setSelectedStudentIds(newSel);
  };

  const handleClearSelection = () => {
    setSelectedStudentIds({});
  };

  const handleSummaryClick = (className: string, section: string) => {
    if (!getNextClass(className)) {
      alert(`🎓 ${className} is the graduating class. These students are completing their term and cannot be promoted further.`);
      return;
    }
    setSourceClass(className);
    setSourceSection(section);
    setIsDrilldown(true);
  };

  const handleBackToClasses = () => {
    setSourceClass('ALL');
    setSourceSection('');
    setIsDrilldown(false);
    setSearchQuery('');
  };

  const executePromotion = async (candidateIds: string[]) => {
    const targetYearLabel = academicYears.find(y => y.id === targetYear)?.name || 'Next Year';
    setIsLoading(true);
    try {
      const res = await api.post('/students/promote', {
        studentIds: candidateIds,
        sourceYearId: sourceYear,
        targetYearId: targetYear,
        targetClassName: sourceClass === 'ALL' ? 'ALL' : targetClass,
        targetSectionName: targetSection || undefined,
      });

      setReportData(res.data);
      setPromotedCount(res.data.promotedCount);
      setSuccessMessage(
        sourceClass === 'ALL' 
          ? `Successfully promoted ${res.data.promotedCount} students across classes to their next grades for Academic Year ${targetYearLabel}.`
          : `Successfully promoted ${res.data.promotedCount} students from ${sourceClass} to ${targetClass} (${targetSection || sourceSection}) for ${targetYearLabel}.`
      );
      
      setShowSuccessModal(true);
      fetchCandidates();
    } catch (err: any) {
      console.error('Promotion failed:', err);
      alert(`Promotion failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Perform promotion on backend
  const handlePromote = async () => {
    const targetYearLabel = academicYears.find(y => y.id === targetYear)?.name || 'Next Year';
    
    const candidateIds = sourceClass === 'ALL' 
      ? studentsState.map(s => s.id)
      : Object.keys(selectedStudentIds).filter(id => selectedStudentIds[id]);

    if (candidateIds.length === 0) {
      alert('No students selected for promotion');
      return;
    }

    setIsLoading(true);
    try {
      const valRes = await api.post('/students/promote/validate', {
        studentIds: candidateIds,
        sourceYearId: sourceYear
      });
      setValidationData(valRes.data);
      setIsLoading(false);

      if (valRes.data.totalSelected > 0) {
        setShowValidationModal(true);
      } else {
        alert('No students selected for promotion');
      }
    } catch (err: any) {
      console.error('Validation failed:', err);
      alert(`Validation failed: ${err.response?.data?.message || err.message}`);
      setIsLoading(false);
    }
  };

  const closeSuccessModal = () => {
    setShowSuccessModal(false);
    handleBackToClasses();
  };

  const sourceYearLabel = academicYears.find(y => y.id === sourceYear)?.name || 'Current Year';
  const targetYearLabel = academicYears.find(y => y.id === targetYear)?.name || 'Next Year';

  const isPromoteDisabled = isLoading || 
    (sourceClass === 'ALL' ? sourceTotalCount === 0 : targetTotalCount === 0);

  return (
    <div className="space-y-6 animate-in text-slate-800">
      
      {/* Dynamic Dot Flow Animation style injection */}
      <style>{`
        @keyframes dotFlow {
          0% { opacity: 0; transform: translateY(-10px) scale(0.5); }
          20% { opacity: 1; transform: translateY(0) scale(1); }
          80% { opacity: 1; transform: translateY(120px) scale(1); }
          100% { opacity: 0; transform: translateY(150px) scale(0.5); }
        }
        .cascade-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: linear-gradient(135deg, #2E5BFF, #10B981);
          box-shadow: 0 0 6px rgba(46, 91, 255, 0.3);
          opacity: 0;
        }
        .cascade-dot-1 { animation: dotFlow 1.2s 0s infinite ease-in-out; }
        .cascade-dot-2 { animation: dotFlow 1.2s 0.2s infinite ease-in-out; }
        .cascade-dot-3 { animation: dotFlow 1.2s 0.4s infinite ease-in-out; }
        .cascade-dot-4 { animation: dotFlow 1.2s 0.6s infinite ease-in-out; }
        .cascade-dot-5 { animation: dotFlow 1.2s 0.8s infinite ease-in-out; }
      `}</style>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-[28px] font-bold text-slate-900 leading-none">Student Promotion</h2>
            <span className="px-2 py-0.5 rounded bg-blue-50 text-[#2E5BFF] text-[10px] font-bold uppercase tracking-wider border border-blue-100">
              SCHOLARFLOW
            </span>
          </div>
          <p className="text-slate-500 text-[13px] font-medium mt-2">
            Reassign classes, sections, and reset fee ledgers for students entering the next academic year.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setIsLifecycleDrawerOpen(true);
              setLifecycleTab('actions');
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-all cursor-pointer"
            title="Manage Student Status / Student Lifecycle"
          >
            <Users className="w-4 h-4 text-blue-400" />
            <span>Student Lifecycle</span>
          </button>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Sidebar Filter Panel */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-6 flex flex-col justify-between">
          <div className="space-y-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Promotion Filters</h3>
            
            {/* Source Year */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2E5BFF]" />
                Current Academic Year
              </label>
              <select 
                value={sourceYear} 
                onChange={(e) => setSourceYear(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
              >
                {academicYears.map(y => (
                  <option key={y.id} value={y.id}>{y.name} {y.isActive ? '(Active)' : ''}</option>
                ))}
              </select>
            </div>

            {/* Target Year */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Target Academic Year
              </label>
              <select 
                value={targetYear} 
                onChange={(e) => setTargetYear(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
              >
                {academicYears.filter(y => y.id !== sourceYear).map(y => (
                  <option key={y.id} value={y.id}>{y.name} {y.isActive ? '(Active)' : ''}</option>
                ))}
              </select>
            </div>

            <div className="border-t border-slate-100" />

            {/* Class Dropdown */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                Class Filter
              </label>
              <select 
                value={sourceClass} 
                onChange={(e) => setSourceClass(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
              >
                <option value="ALL">ALL CLASSES (Bulk Promotion)</option>
                {dbClasses.map(cls => (
                  <option key={cls.id} value={cls.name}>{cls.name}</option>
                ))}
              </select>
            </div>

            {/* Dynamic Section Filter Chips */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
                Section Filter
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSourceSection('')}
                  className={`flex-1 min-w-[50px] py-2 text-[11px] font-bold rounded-xl border text-center transition-all select-none cursor-pointer ${
                    !sourceSection 
                      ? 'bg-blue-50/70 border-blue-500 text-blue-600 shadow-xs' 
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-blue-500 hover:border-blue-200'
                  }`}
                >
                  ALL
                </button>
                {availableSections.map((sec) => {
                  const isSelected = isSectionMatch(sec, sourceSection);
                  const displayLabel = sec.replace(/^Section[-\s]*/i, '');
                  return (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setSourceSection(isSelected ? '' : sec)}
                      className={`flex-1 min-w-[50px] py-2 text-[11px] font-bold rounded-xl border text-center transition-all select-none cursor-pointer ${
                        isSelected 
                          ? 'bg-blue-50/70 border-blue-500 text-blue-600 shadow-xs' 
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-blue-500 hover:border-blue-200'
                      }`}
                    >
                      {displayLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Search Input when inside Drilldown */}
            {isDrilldown && (
              <div className="space-y-1.5 pt-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Search Students
                </label>
                <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-blue-500 transition-all">
                  <Search className="w-4.5 h-4.5 text-slate-400 mr-2" />
                  <input
                    type="text"
                    placeholder="Search candidate..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent text-xs text-slate-800 outline-none w-full placeholder-slate-400 font-medium"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Promotion Actions / Summary inside Sidebar */}
          <div className="space-y-4 pt-6 border-t border-slate-100">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
              <div className="flex justify-between text-xs text-slate-500 font-semibold">
                <span>Vetted Candidates</span>
                <span className="font-extrabold text-slate-800">{targetTotalCount}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 font-semibold">
                <span>Source Pool</span>
                <span className="font-extrabold text-slate-800">{sourceTotalCount}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 font-semibold">
                <span>Destination Grade</span>
                <span className="font-extrabold text-blue-600">{sourceClass === 'ALL' ? 'Next Sequential' : targetClass || '—'}</span>
              </div>
            </div>

            {/* Promote Button */}
            <button
              onClick={handlePromote}
              disabled={isPromoteDisabled}
              className={`w-full py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-indigo-600 hover:to-blue-600 shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isPromoteDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/20'
              }`}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  {sourceClass === 'ALL' 
                    ? `Promote All Batches (${sourceTotalCount})` 
                    : `Promote ${targetTotalCount} Students`
                  }
                </>
              )}
            </button>

            {/* Student Lifecycle Action Shortcut */}
            <button
              type="button"
              onClick={() => {
                setIsLifecycleDrawerOpen(true);
                setLifecycleTab('actions');
              }}
              className="w-full py-2.5 rounded-xl font-bold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
            >
              <Users className="w-3.5 h-3.5 text-blue-600" />
              <span>Manage Student Status / Lifecycle</span>
            </button>
          </div>
        </div>

        {/* Right Main Flow Area */}
        <div className="lg:col-span-3 space-y-6 flex flex-col">
          
          {/* Main Title Row & Year Range Pill */}
          <div className="flex justify-between items-center bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-sm">
            <h3 className="font-bold text-slate-800 text-lg">Promotion Preview</h3>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-4 py-1.5 text-xs font-bold text-slate-500 select-none">
              <span className="text-[#2E5BFF]">{sourceYearLabel}</span>
              <span className="text-slate-400">→</span>
              <span className="text-emerald-600">{targetYearLabel}</span>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Candidate Pool</span>
              <span className="text-2xl font-extrabold text-blue-600 block mt-1">{sourceTotalCount}</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Vetted Students</span>
              <span className="text-2xl font-extrabold text-emerald-600 block mt-1">{targetTotalCount}</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Classes Staged</span>
              <span className="text-2xl font-extrabold text-slate-800 block mt-1">
                {sourceClass === 'ALL' 
                  ? `${filteredSourceSummary.filter(s => !!getNextClass(s.className)).length} / ${summaries.length}`
                  : '1 / 1'
                }
              </span>
            </div>
          </div>

          {/* Cards Transfer Area */}
          <div className="flex-1 flex items-stretch gap-0 border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white min-h-[480px]">
            
            {/* Left Card: Source Class Enrollment */}
            <div className="flex-1 flex flex-col border-r border-slate-150">
              <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-3">
                  {isDrilldown && (
                    <button 
                      onClick={handleBackToClasses}
                      className="p-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 hover:text-[#2E5BFF] transition-all cursor-pointer mr-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  )}
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">{sourceYearLabel}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Current Enrollment</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-lg">
                  {sourceTotalCount}
                </span>
              </div>

              {/* Card List Body */}
              <div className="p-4 overflow-y-auto flex-1 space-y-2.5 max-h-[380px]">
                
                {/* Summary View */}
                {!isDrilldown && (
                  <>
                    {filteredSourceSummary.map(item => {
                      const isPromotable = !!getNextClass(item.className);
                      return (
                        <div 
                          key={`${item.className}-${item.section}`}
                          onClick={() => handleSummaryClick(item.className, item.section)}
                          className={`flex justify-between items-center p-3.5 border rounded-2xl transition-all select-none ${
                            isPromotable 
                              ? 'bg-slate-50 border-slate-200 hover:border-blue-300 hover:translate-x-1 cursor-pointer' 
                              : 'bg-slate-50/40 border-slate-200 opacity-60 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold bg-gradient-to-tr ${
                              isPromotable ? 'from-blue-500 to-indigo-500' : 'from-slate-400 to-slate-500'
                            }`}>
                              {item.className.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h5 className="font-bold text-slate-800 text-sm">{item.className}</h5>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Section {item.section}</p>
                            </div>
                          </div>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                            isPromotable 
                              ? 'bg-blue-50 text-blue-600 border-blue-100' 
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>
                            {isPromotable ? `${item.studentCount} Students` : 'Graduating (Complete)'}
                          </span>
                        </div>
                      );
                    })}
                    {filteredSourceSummary.length === 0 && (
                      <div className="h-full flex flex-col justify-center items-center text-center text-slate-400 py-12">
                        <Users className="w-10 h-10 mb-2 opacity-30" />
                        <p className="text-xs font-semibold">No staging classes found</p>
                      </div>
                    )}
                  </>
                )}

                {/* Drilldown view */}
                {isDrilldown && (
                  <>
                    <div className="flex justify-between items-center mb-3">
                      <h5 className="text-xs font-bold text-slate-500">{sourceClass} - {sourceSection} Enrollment</h5>
                      <div className="flex gap-2">
                        <button onClick={handleSelectAll} className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer">Select All</button>
                        <span className="text-slate-300 text-[10px]">|</span>
                        <button onClick={handleClearSelection} className="text-[10px] font-bold text-slate-500 hover:underline cursor-pointer">Clear All</button>
                      </div>
                    </div>
                    {currentStudentsList.map(s => {
                      const isSelected = !!selectedStudentIds[s.id];
                      const hasDue = s.balanceDue > 0;
                      return (
                        <div 
                          key={s.id}
                          onClick={() => handleStudentToggle(s.id)}
                          className={`flex justify-between items-center p-3 border rounded-2xl cursor-pointer transition-all select-none ${
                            isSelected 
                              ? 'bg-blue-50/40 border-blue-500 shadow-sm' 
                              : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              readOnly
                              className="accent-blue-600 cursor-pointer w-4 h-4 rounded-md"
                            />
                            <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-slate-700 text-xs font-extrabold">
                              {s.name.split(' ').map((n: string) => n[0]).join('').substring(0,2)}
                            </div>
                            <div>
                              <h5 className="font-bold text-slate-800 text-xs">{s.name}</h5>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{s.rollNo}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {/* Financial validation check */}
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border flex items-center gap-1.5 ${
                              hasDue 
                                ? 'bg-amber-50 text-amber-600 border-amber-200' 
                                : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            }`}>
                              <span className={`w-1 h-1 rounded-full ${hasDue ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                              {s.financialStatus || (hasDue ? `₹${s.balanceDue} Due` : 'Paid Clear')}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStudentForLifecycle(s);
                                setIsLifecycleDrawerOpen(true);
                                setLifecycleTab('actions');
                              }}
                              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                              title="Manage Student Lifecycle Status"
                            >
                              <Users className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {currentStudentsList.length === 0 && (
                      <div className="h-full flex flex-col justify-center items-center text-center text-slate-400 py-12">
                        <User className="w-10 h-10 mb-2 opacity-30" />
                        <p className="text-xs font-semibold">No students match filter criteria</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Center: Cascade Dot flow Animation Zone */}
            <div className="w-20 bg-slate-50/50 flex flex-col items-center justify-center relative overflow-hidden select-none border-r border-slate-150">
              
              {/* Central flow graphic */}
              <div className="h-28 w-1 border-l border-dashed border-slate-200 relative">
                <div className="absolute inset-y-0 left-[-3px] flex flex-col justify-between">
                  <span className="cascade-dot cascade-dot-1" />
                  <span className="cascade-dot cascade-dot-2" />
                  <span className="cascade-dot cascade-dot-3" />
                  <span className="cascade-dot cascade-dot-4" />
                  <span className="cascade-dot cascade-dot-5" />
                </div>
              </div>

              <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm text-lg text-slate-400 my-4">
                →
              </div>

              <div className="h-28 w-1 border-l border-dashed border-slate-200 relative">
                <div className="absolute inset-y-0 left-[-3px] flex flex-col justify-between" style={{ transform: 'scaleY(-1)' }}>
                  <span className="cascade-dot cascade-dot-1" />
                  <span className="cascade-dot cascade-dot-2" />
                  <span className="cascade-dot cascade-dot-3" />
                  <span className="cascade-dot cascade-dot-4" />
                  <span className="cascade-dot cascade-dot-5" />
                </div>
              </div>
            </div>

            {/* Right Card: Target Class Enrollment */}
            <div className="flex-1 flex flex-col bg-slate-50/10">
              <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">{targetYearLabel}</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">After Promotion</p>
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-lg">
                  {targetTotalCount}
                </span>
              </div>

              {/* Card List Body */}
              <div className="p-4 overflow-y-auto flex-1 space-y-2.5 max-h-[380px]">
                
                {/* Summary View Projected */}
                {!isDrilldown && (
                  <>
                    {filteredTargetSummary.map(item => (
                      <div 
                        key={`${item.className}-${item.section}`}
                        className="flex justify-between items-center p-3.5 border border-slate-200 bg-white rounded-2xl animate-fade-in"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold bg-gradient-to-tr from-emerald-500 to-cyan-500">
                            {item.className.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h5 className="font-bold text-slate-800 text-sm">{item.className}</h5>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Section {item.section}</p>
                          </div>
                        </div>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                          {item.studentCount} Students
                        </span>
                      </div>
                    ))}
                    {filteredTargetSummary.length === 0 && (
                      <div className="h-full flex flex-col justify-center items-center text-center text-slate-400 py-12">
                        <Users className="w-10 h-10 mb-2 opacity-30" />
                        <p className="text-xs font-semibold">Staged vetted summaries will show here</p>
                      </div>
                    )}
                  </>
                )}

                {/* Drilldown View Projected */}
                {isDrilldown && (
                  <>
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 block">Target Enrollment Staged</h5>
                    {selectedStudents.map(s => (
                      <div 
                        key={s.id}
                        className="flex justify-between items-center p-3 border border-slate-200 bg-white rounded-2xl animate-fade-in"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-extrabold">
                            {s.name.split(' ').map((n: string) => n[0]).join('').substring(0,2)}
                          </div>
                          <div>
                            <h5 className="font-bold text-slate-800 text-xs">{s.name}</h5>
                            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Target: {targetClass} ({targetSection || s.section})</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100">
                          Ready
                        </span>
                      </div>
                    ))}
                    {selectedStudents.length === 0 && (
                      <div className="h-full flex flex-col justify-center items-center text-center text-slate-400 py-12">
                        <User className="w-10 h-10 mb-2 opacity-30" />
                        <p className="text-xs font-semibold">Select candidates to show stage result</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal Overlay */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl border border-slate-100 animate-in flex flex-col items-center text-center max-h-[90vh] overflow-y-auto">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-400 to-cyan-400 flex items-center justify-center text-white text-3xl shadow-lg shadow-emerald-500/20 mb-6 animate-bounce shrink-0">
              ✨
            </div>
            
            <h3 className="text-2xl font-extrabold text-slate-900 leading-tight mb-2">
              Promotion Successful!
            </h3>
            
            <p className="text-sm text-slate-500 font-medium leading-relaxed mb-4">
              {successMessage}
            </p>

            {/* Post-Promotion Summary Report */}
            {reportData && (
              <div className="w-full space-y-4 mb-6">
                <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 border border-slate-200 rounded-xl text-center text-xs">
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Promoted</span>
                    <strong className="text-sm font-extrabold text-blue-600">{reportData.promotedCount}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Carried Forward</span>
                    <strong className="text-sm font-extrabold text-amber-600">{reportData.studentsWithCarriedForwardDues}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">CF Amount</span>
                    <strong className="text-sm font-extrabold text-rose-600">₹{reportData.totalCarriedForwardAmount.toLocaleString()}</strong>
                  </div>
                </div>

                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl text-xs text-left">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-250 text-slate-400 font-bold">
                        <th className="p-2">Student</th>
                        <th className="p-2 text-right">Carried Forward</th>
                        <th className="p-2 text-right">Total Outstanding</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-655 font-semibold">
                      {reportData.studentOutstandingBalances.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2">
                            <div className="font-bold text-slate-800">{item.name}</div>
                            <div className="text-[9px] text-slate-400">Roll: {item.rollNo}</div>
                          </td>
                          <td className="p-2 text-right font-bold text-amber-600">₹{item.carriedForwardAmount.toLocaleString()}</td>
                          <td className="p-2 text-right font-bold text-slate-800">₹{item.totalOutstanding.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 w-full bg-slate-50 p-4 border border-slate-150 rounded-2xl mb-6 text-xs text-slate-600">
              <div className="text-center border-r border-slate-200">
                <span className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Source Session</span>
                <strong className="text-sm font-extrabold text-blue-600">{sourceYearLabel}</strong>
              </div>
              <div className="text-center">
                <span className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">Target Session</span>
                <strong className="text-sm font-extrabold text-emerald-600">{targetYearLabel}</strong>
              </div>
            </div>

            <button
              onClick={closeSuccessModal}
              className="w-full py-3 rounded-xl font-bold bg-[#2E5BFF] hover:bg-[#1E3FCC] text-white shadow-lg shadow-blue-500/10 transition-all cursor-pointer hover:-translate-y-0.5"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ── VALIDATION MODAL ── */}
      {showValidationModal && validationData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-4 mb-4">
              <div className="flex items-center gap-2">
                {validationData.studentsWithPendingDue > 0 ? (
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                )}
                <h3 className="text-lg font-bold text-slate-800">Student Promotion Summary</h3>
              </div>
              <button 
                onClick={() => setShowValidationModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-4 gap-4 bg-slate-50 p-4 border border-slate-200 rounded-xl mb-4 text-center">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Selected</span>
                <span className="text-base font-extrabold text-slate-700">{validationData.totalSelected}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">No Due</span>
                <span className="text-base font-extrabold text-emerald-600">{validationData.studentsWithNoDue}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Pending Due</span>
                <span className="text-base font-extrabold text-amber-600">{validationData.studentsWithPendingDue}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Due</span>
                <span className="text-base font-extrabold text-rose-650">₹{validationData.totalOutstandingDue.toLocaleString()}</span>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto min-h-[150px] border border-slate-200 rounded-xl mb-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-250 text-slate-400 font-bold sticky top-0">
                    <th className="p-3">Student</th>
                    <th className="p-3">Class</th>
                    <th className="p-3">Previous Academic Year</th>
                    <th className="p-3 text-right">Prev Year Due</th>
                    <th className="p-3 text-right">Total Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-655 font-semibold">
                  {validationData.dueList.map((item: any) => (
                    <tr key={item.studentId} className="hover:bg-slate-50">
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{item.name}</div>
                        <div className="text-[10px] text-slate-400">Roll: {item.rollNo}</div>
                      </td>
                      <td className="p-3">
                        <span className="font-medium text-slate-700">{item.class}</span>
                        {item.section && item.section !== '—' && (
                          <span className="text-slate-400"> / {item.section}</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-500">{item.sourceYear || '—'}</td>
                      <td className="p-3 text-right">
                        {item.previousYearDue > 0 ? (
                          <span className="text-amber-600 font-mono">₹{item.previousYearDue.toLocaleString()}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-bold">
                        {item.pendingDue > 0 ? (
                          <span className="text-rose-600 font-mono">₹{item.pendingDue.toLocaleString()}</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-bold">
                            Paid Clear
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Warning/Success Message */}
            {validationData.studentsWithPendingDue > 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6 flex gap-3 text-xs text-amber-800 animate-in">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed font-semibold">
                  Warning: Some students still have pending fees from the previous academic year. If you continue, these outstanding balances will automatically be carried forward to the next academic year along with the new academic year's fee structure. Do you want to continue?
                </p>
              </div>
            ) : (
              <div className="p-4 bg-emerald-50 border border-emerald-250 rounded-xl mb-6 flex gap-3 text-xs text-emerald-800 animate-in">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed font-semibold">
                  All selected students are clear of any outstanding dues. Proceeding will enroll them in the target academic year and allocate their new class standard fee structures.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowValidationModal(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer text-xs"
              >
                Cancel Promotion
              </button>
              {validationData.studentsWithPendingDue > 0 ? (
                <button
                  onClick={() => {
                    setShowValidationModal(false);
                    const candidateIds = sourceClass === 'ALL' 
                      ? studentsState.map(s => s.id)
                      : Object.keys(selectedStudentIds).filter(id => selectedStudentIds[id]);
                    executePromotion(candidateIds);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold cursor-pointer text-xs transition-all hover:scale-[1.02]"
                >
                  Promote Anyway
                </button>
              ) : (
                <button
                  onClick={() => {
                    setShowValidationModal(false);
                    const candidateIds = sourceClass === 'ALL' 
                      ? studentsState.map(s => s.id)
                      : Object.keys(selectedStudentIds).filter(id => selectedStudentIds[id]);
                    executePromotion(candidateIds);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer text-xs transition-all hover:scale-[1.02]"
                >
                  Confirm Promotion
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* ── STUDENT LIFECYCLE MANAGEMENT DRAWER ─────────────────────────────────── */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <Drawer
        open={isLifecycleDrawerOpen}
        onClose={() => setIsLifecycleDrawerOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#2E5BFF]" />
            <span>Student Academic Lifecycle</span>
          </div>
        }
        subtitle="Manage student departure, transfers, withdrawals, Class 10 graduation, re-enrollment, and view permanent records."
        size="2xl"
      >
        <div className="flex flex-col h-full bg-slate-50/50">
          {/* Navigation Sub-Tabs */}
          <div className="flex border-b border-slate-200 bg-white px-6 pt-3 gap-6">
            <button
              type="button"
              onClick={() => setLifecycleTab('actions')}
              className={`pb-3 text-xs font-bold transition-all cursor-pointer border-b-2 flex items-center gap-1.5 ${
                lifecycleTab === 'actions'
                  ? 'border-[#2E5BFF] text-[#2E5BFF]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Update Student Status</span>
            </button>

            <button
              type="button"
              onClick={() => setLifecycleTab('former')}
              className={`pb-3 text-xs font-bold transition-all cursor-pointer border-b-2 flex items-center gap-1.5 ${
                lifecycleTab === 'former'
                  ? 'border-[#2E5BFF] text-[#2E5BFF]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Former & Historical Students</span>
            </button>

            <button
              type="button"
              onClick={() => setLifecycleTab('reenroll')}
              className={`pb-3 text-xs font-bold transition-all cursor-pointer border-b-2 flex items-center gap-1.5 ${
                lifecycleTab === 'reenroll'
                  ? 'border-[#2E5BFF] text-[#2E5BFF]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              <span>Re-enroll Returning Student</span>
            </button>
          </div>

          {/* TAB 1: UPDATE STUDENT STATUS */}
          {lifecycleTab === 'actions' && (
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              {/* Action Type Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Select Lifecycle Action
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: 'LEFT', label: 'Not Promoting / Left', icon: UserX, desc: 'Leaving school' },
                    { id: 'TRANSFERRED', label: 'Transfer Student', icon: ArrowUpRight, desc: 'Moving to other school' },
                    { id: 'WITHDRAWN', label: 'Withdraw Student', icon: AlertTriangle, desc: 'Voluntary withdrawal' },
                    { id: 'GRADUATED', label: 'Graduate / Class 10', icon: GraduationCap, desc: 'Higher education' },
                  ].map((act) => {
                    const Icon = act.icon;
                    const isCur = lifecycleActionType === act.id;
                    return (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => {
                          setLifecycleActionType(act.id as any);
                          if (act.id === 'LEFT') setLifecycleReason('Left School');
                          if (act.id === 'TRANSFERRED') setLifecycleReason('Transferred to another school');
                          if (act.id === 'WITHDRAWN') setLifecycleReason('Parent withdrawal request');
                          if (act.id === 'GRADUATED') setLifecycleReason('Completed Secondary Education (Class 10)');
                        }}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isCur
                            ? 'bg-blue-50/80 border-[#2E5BFF] shadow-xs ring-1 ring-[#2E5BFF]'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <Icon className={`w-5 h-5 mb-2 ${isCur ? 'text-[#2E5BFF]' : 'text-slate-400'}`} />
                        <div>
                          <div className={`text-xs font-bold ${isCur ? 'text-blue-950' : 'text-slate-800'}`}>{act.label}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{act.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Student Picker */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex justify-between items-center">
                  <span>Selected Student</span>
                  {selectedStudentForLifecycle && (
                    <button
                      type="button"
                      onClick={() => setSelectedStudentForLifecycle(null)}
                      className="text-[11px] text-blue-600 hover:underline font-bold"
                    >
                      Change Student
                    </button>
                  )}
                </label>

                {selectedStudentForLifecycle ? (
                  <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-xs flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2E5BFF] flex items-center justify-center font-bold text-sm">
                        {selectedStudentForLifecycle.name ? selectedStudentForLifecycle.name[0] : 'S'}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">{selectedStudentForLifecycle.name}</h4>
                        <p className="text-xs text-slate-500 font-mono">
                          Roll: {selectedStudentForLifecycle.rollNo || '—'} • Class: {selectedStudentForLifecycle.class} ({selectedStudentForLifecycle.section})
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-[#2E5BFF] border border-blue-100">
                      Active Candidate
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        placeholder="Search student by name or roll number from current session..."
                        value={lifecycleStudentSearch}
                        onChange={(e) => setLifecycleStudentSearch(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 outline-none focus:border-[#2E5BFF]"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 shadow-2xs">
                      {studentsState
                        .filter(s => 
                          !lifecycleStudentSearch ||
                          s.name.toLowerCase().includes(lifecycleStudentSearch.toLowerCase()) ||
                          s.rollNo?.toString().includes(lifecycleStudentSearch)
                        )
                        .slice(0, 8)
                        .map(s => (
                          <div
                            key={s.id}
                            onClick={() => setSelectedStudentForLifecycle(s)}
                            className="p-3 hover:bg-slate-50 flex justify-between items-center cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-700">
                                {s.name[0]}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-slate-800">{s.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {s.class} - {s.section} • Roll: {s.rollNo || '—'}
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded">
                              Select
                            </span>
                          </div>
                        ))}
                      {studentsState.length === 0 && (
                        <div className="p-4 text-center text-xs text-slate-400 italic">
                          No active students found in current selection.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Reason & Effective Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Reason / Departure Cause
                  </label>
                  <select
                    value={lifecycleReason}
                    onChange={(e) => setLifecycleReason(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-700 outline-none focus:border-[#2E5BFF]"
                  >
                    {lifecycleActionType === 'LEFT' && (
                      <>
                        <option value="Left School">Left School (General)</option>
                        <option value="Relocated to another city">Relocated to another city</option>
                        <option value="Financial difficulties">Financial difficulties</option>
                        <option value="Personal reasons">Personal reasons</option>
                        <option value="Other">Other</option>
                      </>
                    )}
                    {lifecycleActionType === 'TRANSFERRED' && (
                      <>
                        <option value="Transferred to another school">Transferred to another school</option>
                        <option value="Parent job transfer">Parent job transfer</option>
                        <option value="Board syllabus switch (CBSE / ICSE / State)">Board syllabus switch</option>
                        <option value="Moving to boarding school">Moving to boarding school</option>
                        <option value="Other">Other</option>
                      </>
                    )}
                    {lifecycleActionType === 'WITHDRAWN' && (
                      <>
                        <option value="Parent withdrawal request">Parent withdrawal request</option>
                        <option value="Medical reasons">Medical reasons</option>
                        <option value="Disciplinary withdrawal">Disciplinary withdrawal</option>
                        <option value="Long absence without leave">Long absence without leave</option>
                        <option value="Other">Other</option>
                      </>
                    )}
                    {lifecycleActionType === 'GRADUATED' && (
                      <>
                        <option value="Completed Secondary Education (Class 10)">Completed Secondary Education (Class 10)</option>
                        <option value="Higher Education College Enrollment">Higher Education College Enrollment</option>
                        <option value="Graduated Senior Secondary (Class 12)">Graduated Senior Secondary (Class 12)</option>
                        <option value="Vocational Career Transition">Vocational Career Transition</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Effective Date
                  </label>
                  <input
                    type="date"
                    value={lifecycleEffectiveDate}
                    onChange={(e) => setLifecycleEffectiveDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-700 outline-none focus:border-[#2E5BFF]"
                  />
                </div>
              </div>

              {/* Administrative Remarks */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Administrative Notes / Remarks
                </label>
                <textarea
                  rows={3}
                  value={lifecycleNotes}
                  onChange={(e) => setLifecycleNotes(e.target.value)}
                  placeholder="Add transfer certificate details, clearance notes, or graduation remarks..."
                  className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-700 outline-none focus:border-[#2E5BFF]"
                />
              </div>

              {/* Notice Box */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  Zero Data Deletion Policy
                </div>
                <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
                  Marking a student as {lifecycleActionType} removes them from active promotion batches and current class lists.
                  All attendance records, past marks, invoices, and homework submissions remain permanently preserved in historical archives.
                </p>
              </div>

              {/* Apply Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleApplyLifecycleStatus}
                  disabled={lifecycleSubmitting || !selectedStudentForLifecycle}
                  className={`w-full py-3.5 rounded-xl font-bold text-xs text-white bg-[#2E5BFF] hover:bg-blue-600 shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    lifecycleSubmitting || !selectedStudentForLifecycle ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'
                  }`}
                >
                  {lifecycleSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Applying Status...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Confirm & Mark Student as {lifecycleActionType}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: FORMER / HISTORICAL STUDENTS */}
          {lifecycleTab === 'former' && (
            <div className="p-6 space-y-4 flex-1 flex flex-col min-h-0">
              {/* Search & Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
                <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto">
                  {['ALL', 'LEFT', 'TRANSFERRED', 'WITHDRAWN', 'GRADUATED', 'ACTIVE'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setHistoricalStatusFilter(st)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        historicalStatusFilter === st
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {st === 'ALL' ? 'All' : st}
                    </button>
                  ))}
                </div>

                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search by student, roll no, parent phone..."
                    value={historicalSearchQuery}
                    onChange={(e) => setHistoricalSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:border-[#2E5BFF]"
                  />
                </div>
              </div>

              {/* Former Students Table */}
              <div className="flex-1 overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-2xs">
                {loadingHistorical ? (
                  <div className="flex flex-col items-center justify-center py-24 space-y-2">
                    <Loader2 className="w-8 h-8 text-[#2E5BFF] animate-spin" />
                    <p className="text-xs text-slate-400 font-semibold">Loading historical student records...</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4">Student</th>
                        <th className="py-3 px-3">Lifecycle Status</th>
                        <th className="py-3 px-3">Last Class</th>
                        <th className="py-3 px-3">Effective Date</th>
                        <th className="py-3 px-3">Reason</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historicalStudents
                        .filter(s =>
                          !historicalSearchQuery ||
                          s.name.toLowerCase().includes(historicalSearchQuery.toLowerCase()) ||
                          s.rollNo?.toLowerCase().includes(historicalSearchQuery.toLowerCase()) ||
                          s.parentPhone?.includes(historicalSearchQuery)
                        )
                        .map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-700">
                                  {s.name[0]}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-800">{s.name}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    Roll: {s.rollNo} • Phone: {s.parentPhone}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                s.lifecycleStatus === 'GRADUATED' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                s.lifecycleStatus === 'TRANSFERRED' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                s.lifecycleStatus === 'WITHDRAWN' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                s.lifecycleStatus === 'LEFT' ? 'bg-slate-100 text-slate-700 border-slate-300' :
                                'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}>
                                {s.lifecycleStatus}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-medium text-slate-600">
                              {s.lastClass} - {s.lastSection}
                            </td>
                            <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                              {s.effectiveDate ? new Date(s.effectiveDate).toLocaleDateString() : '—'}
                            </td>
                            <td className="py-3 px-3 text-slate-600 truncate max-w-[140px]">
                              {s.reason || '—'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openCompleteStudentHistory(s.id)}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                                  title="View Complete History"
                                >
                                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                                  <span>History</span>
                                </button>
                                {!s.isActive && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setStudentToReEnroll(s);
                                      setLifecycleTab('reenroll');
                                      if (academicYears.length > 0) {
                                        const curActive = academicYears.find(y => y.isActive);
                                        if (curActive) setReEnrollYearId(curActive.id);
                                      }
                                    }}
                                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#2E5BFF] border border-blue-200 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                                    title="Re-enroll returning student"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    <span>Re-enroll</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      {historicalStudents.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-16 text-center text-slate-400 italic">
                            No student lifecycle records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: RE-ENROLL RETURNING STUDENT */}
          {lifecycleTab === 'reenroll' && (
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4 text-blue-600" />
                  Re-enrollment Architecture
                </div>
                <p className="text-[11px] text-blue-700 leading-relaxed font-medium">
                  When a former student returns, their original student profile and admission history are reused. No duplicate records are created, and their entire previous academic, attendance, and fee history is preserved.
                </p>
              </div>

              {/* Student Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Select Former Student
                </label>
                {studentToReEnroll ? (
                  <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-xs flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#2E5BFF] flex items-center justify-center font-bold">
                        {studentToReEnroll.name[0]}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-sm">{studentToReEnroll.name}</div>
                        <div className="text-xs text-slate-500 font-mono">
                          Former: {studentToReEnroll.lifecycleStatus} • Last Class: {studentToReEnroll.lastClass} - {studentToReEnroll.lastSection}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStudentToReEnroll(null)}
                      className="text-xs text-blue-600 hover:underline font-bold cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <select
                    onChange={(e) => {
                      const found = historicalStudents.find(s => s.id === e.target.value);
                      if (found) setStudentToReEnroll(found);
                    }}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-700 outline-none focus:border-[#2E5BFF]"
                  >
                    <option value="">-- Choose from Former Students --</option>
                    {historicalStudents
                      .filter(s => !s.isActive)
                      .map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.lifecycleStatus} from {s.lastClass}-{s.lastSection})
                        </option>
                      ))}
                  </select>
                )}
              </div>

              {/* Target Enrollment Information */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Target Academic Year
                  </label>
                  <select
                    value={reEnrollYearId || targetYear || sourceYear}
                    onChange={(e) => setReEnrollYearId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-[#2E5BFF]"
                  >
                    {academicYears.map(y => (
                      <option key={y.id} value={y.id}>{y.name} {y.isActive ? '(Active)' : ''}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Target Class
                  </label>
                  <select
                    value={reEnrollClassId}
                    onChange={(e) => setReEnrollClassId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-[#2E5BFF]"
                  >
                    <option value="">-- Select Class --</option>
                    {dbClasses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Target Section
                  </label>
                  <select
                    value={reEnrollSectionId}
                    onChange={(e) => setReEnrollSectionId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-[#2E5BFF]"
                  >
                    <option value="">-- Select Section --</option>
                    {dbSections.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Roll Number & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Roll Number (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Auto-assigned if blank"
                    value={reEnrollRollNo}
                    onChange={(e) => setReEnrollRollNo(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-[#2E5BFF]"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Re-enrollment Notes
                  </label>
                  <input
                    type="text"
                    placeholder="Reason for return, previous clearing certificates, remarks..."
                    value={reEnrollNotes}
                    onChange={(e) => setReEnrollNotes(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-[#2E5BFF]"
                  />
                </div>
              </div>

              {/* Submit Re-enrollment */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleReEnrollSubmit}
                  disabled={reEnrollSubmitting || !studentToReEnroll || !reEnrollClassId || !reEnrollSectionId}
                  className={`w-full py-3.5 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    reEnrollSubmitting || !studentToReEnroll || !reEnrollClassId || !reEnrollSectionId
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:shadow-lg'
                  }`}
                >
                  {reEnrollSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Re-enrolling Student...
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      Re-enroll & Activate Student in New Class
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </Drawer>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* ── COMPLETE 360° STUDENT HISTORY MODAL ─────────────────────────────────── */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#2E5BFF] flex items-center justify-center font-black text-sm">
                  {studentHistoryData?.profile?.name ? studentHistoryData.profile.name[0] : 'S'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 leading-tight">
                      {studentHistoryData?.profile?.name || 'Loading Student...'}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                      studentHistoryData?.profile?.isActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {studentHistoryData?.profile?.isActive ? 'Active' : 'Former'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Roll: {studentHistoryData?.profile?.rollNo} • Current/Last: {studentHistoryData?.profile?.currentClass}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-tabs header */}
            <div className="flex border-b border-slate-200 bg-white px-6 overflow-x-auto gap-4 text-xs font-bold">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'timeline', label: 'Lifecycle Timeline' },
                { id: 'attendance', label: 'Attendance' },
                { id: 'exams', label: 'Exams & Marks' },
                { id: 'homework', label: 'Homework' },
                { id: 'fees', label: 'Fees & Invoices' },
                { id: 'complaints', label: 'Complaints' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setHistoryActiveTab(tab.id as any)}
                  className={`py-3 transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
                    historyActiveTab === tab.id
                      ? 'border-[#2E5BFF] text-[#2E5BFF]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
              {loadingStudentHistory ? (
                <div className="py-24 flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="w-8 h-8 text-[#2E5BFF] animate-spin" />
                  <p className="text-xs text-slate-400 font-semibold">Retrieving full 360° database records...</p>
                </div>
              ) : studentHistoryData ? (
                <>
                  {/* TAB: OVERVIEW */}
                  {historyActiveTab === 'overview' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Parent Details</span>
                          <div className="text-xs text-slate-700 font-semibold">
                            <div>Father: {studentHistoryData.profile.fatherName}</div>
                            <div>Mother: {studentHistoryData.profile.motherName}</div>
                            <div>Phone: {studentHistoryData.profile.fatherPhone || studentHistoryData.profile.motherPhone}</div>
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Attendance Rate</span>
                          <div className="text-2xl font-black text-slate-800">
                            {studentHistoryData.attendance?.attendancePercentage}%
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {studentHistoryData.attendance?.presentSessions} present / {studentHistoryData.attendance?.totalSessions} sessions
                          </p>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Exams Completed</span>
                          <div className="text-2xl font-black text-slate-800">
                            {studentHistoryData.examMarks?.length || 0}
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium">Recorded subjects & tests</p>
                        </div>
                      </div>

                      {/* Academic Year Enrollments */}
                      <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Academic Year History</h4>
                        <div className="divide-y divide-slate-100 text-xs">
                          {studentHistoryData.academicHistory?.map((ah: any) => (
                            <div key={ah.id} className="py-2.5 flex justify-between items-center">
                              <span className="font-bold text-slate-700">{ah.academicYear}</span>
                              <span className="text-slate-500 font-mono">Stage: {ah.stage}</span>
                              <span className="font-bold text-slate-800">Total Fees: ₹{ah.totalFees?.toLocaleString()}</span>
                            </div>
                          ))}
                          {(!studentHistoryData.academicHistory || studentHistoryData.academicHistory.length === 0) && (
                            <div className="py-4 text-center text-slate-400 italic">No previous year opportunities recorded.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB: TIMELINE */}
                  {historyActiveTab === 'timeline' && (
                    <div className="space-y-3">
                      <div className="bg-white p-4 rounded-2xl border border-slate-200 divide-y divide-slate-100">
                        {studentHistoryData.lifecycleHistories?.map((lh: any) => (
                          <div key={lh.id} className="py-3 flex items-start gap-3">
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-800">
                                  Status updated to <span className="text-blue-600">{lh.currentStatus}</span>
                                </span>
                                <span className="text-slate-400 font-mono text-[10px]">
                                  {new Date(lh.date).toLocaleString()}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Reason: {lh.details?.reason || '—'} {lh.details?.lastClass && `(From ${lh.details.lastClass})`}
                              </div>
                              {lh.details?.notes && (
                                <div className="text-[10px] text-slate-400 italic">Notes: {lh.details.notes}</div>
                              )}
                              <div className="text-[9px] text-slate-400">Updated by: {lh.updatedBy}</div>
                            </div>
                          </div>
                        ))}

                        {studentHistoryData.activityLogs?.map((al: any) => (
                          <div key={al.id} className="py-3 flex items-start gap-3">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                            <div className="flex-1 space-y-0.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-800">{al.action}</span>
                                <span className="text-slate-400 font-mono text-[10px]">
                                  {new Date(al.date).toLocaleString()}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500">{al.details}</div>
                            </div>
                          </div>
                        ))}

                        {(!studentHistoryData.lifecycleHistories?.length && !studentHistoryData.activityLogs?.length) && (
                          <div className="py-8 text-center text-xs text-slate-400 italic">
                            No lifecycle transitions recorded yet.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB: ATTENDANCE */}
                  {historyActiveTab === 'attendance' && (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase">
                            <th className="py-2.5 px-4">Date</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Reason / Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {studentHistoryData.attendance?.recentRecords?.map((att: any) => (
                            <tr key={att.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-4 font-mono">{new Date(att.date).toLocaleDateString()}</td>
                              <td className="py-2.5 px-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  att.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                }`}>
                                  {att.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-500">{att.reason || '—'}</td>
                            </tr>
                          ))}
                          {(!studentHistoryData.attendance?.recentRecords?.length) && (
                            <tr>
                              <td colSpan={3} className="py-8 text-center text-slate-400 italic">No attendance records found.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* TAB: EXAMS & MARKS */}
                  {historyActiveTab === 'exams' && (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase">
                            <th className="py-2.5 px-4">Exam</th>
                            <th className="py-2.5 px-3">Subject</th>
                            <th className="py-2.5 px-3">Type</th>
                            <th className="py-2.5 px-3">Marks Obtained</th>
                            <th className="py-2.5 px-3">Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {studentHistoryData.examMarks?.map((em: any) => (
                            <tr key={em.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-4 font-bold text-slate-800">{em.examName}</td>
                              <td className="py-2.5 px-3">{em.subjectName}</td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">{em.subjectType}</td>
                              <td className="py-2.5 px-3 font-black text-blue-600">{em.marksObtained}</td>
                              <td className="py-2.5 px-3 text-slate-500">{em.remarks}</td>
                            </tr>
                          ))}
                          {(!studentHistoryData.examMarks?.length) && (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-slate-400 italic">No exam records found.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* TAB: HOMEWORK */}
                  {historyActiveTab === 'homework' && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Submitted Homework</h4>
                      <div className="divide-y divide-slate-100 text-xs">
                        {studentHistoryData.homeworkSubmissions?.map((hw: any) => (
                          <div key={hw.id} className="py-2.5 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-[#2E5BFF]" />
                              <span className="font-bold text-slate-700">{hw.fileName}</span>
                            </div>
                            <span className="text-slate-400 font-mono text-[10px]">
                              {new Date(hw.submittedAt).toLocaleString()}
                            </span>
                          </div>
                        ))}
                        {(!studentHistoryData.homeworkSubmissions?.length) && (
                          <div className="py-8 text-center text-slate-400 italic">No homework submissions found.</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB: FEES & INVOICES */}
                  {historyActiveTab === 'fees' && (
                    <div className="space-y-4">
                      {studentHistoryData.feeInvoices?.map((inv: any) => (
                        <div key={inv.id} className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                            <div>
                              <span className="font-bold text-slate-800 text-xs">Invoice #{inv.id.substring(0, 8)}</span>
                              <span className="text-slate-400 text-[10px] ml-2 font-mono">Session: {inv.academicYear}</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              inv.status === 'PAID' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {inv.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>Total: <strong>₹{inv.totalAmount.toLocaleString()}</strong></div>
                            <div>Paid: <strong className="text-emerald-600">₹{inv.paidAmount.toLocaleString()}</strong></div>
                            <div>Due: <strong className="text-amber-600">₹{inv.remainingBalance.toLocaleString()}</strong></div>
                          </div>
                        </div>
                      ))}
                      {(!studentHistoryData.feeInvoices?.length) && (
                        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 italic text-xs">
                          No fee invoices on record.
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB: COMPLAINTS */}
                  {historyActiveTab === 'complaints' && (
                    <div className="space-y-3">
                      {studentHistoryData.complaints?.map((c: any) => (
                        <div key={c.id} className="bg-white p-4 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
                          <div className="flex justify-between items-center">
                            <h5 className="font-bold text-slate-800">{c.title}</h5>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                              {c.status}
                            </span>
                          </div>
                          <p className="text-slate-500 text-[11px]">{c.description}</p>
                          {c.adminReply && (
                            <div className="bg-slate-50 p-2 rounded-xl text-[10px] text-slate-600 italic">
                              Reply: {c.adminReply}
                            </div>
                          )}
                        </div>
                      ))}
                      {(!studentHistoryData.complaints?.length) && (
                        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 italic text-xs">
                          No complaints recorded for this student.
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
