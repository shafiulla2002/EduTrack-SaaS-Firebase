'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  AlertCircle, CheckCircle, Search, User, Filter, Plus, 
  ShieldAlert, Award, Calendar, ChevronRight, BookOpen, Clock, 
  Activity, ArrowLeft, RefreshCw, Eye, X, Phone, GraduationCap,
  Edit, Trash2, RotateCcw
} from 'lucide-react';
import { PencilSpinner } from '@/components/loading';
import { api, fastGet, getCachedData, setCachedData } from '@/lib/api';
import Link from 'next/link';
import { useTenant } from '@/app/providers/TenantContext';

interface BehaviorCase {
  id: string;
  behaviorType: 'Complaint' | 'Praise';
  category: string;
  academicYear: string;
  status: string;
  priority: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  studentId: string;
  student?: {
    id: string;
    rollNo?: string;
    user: {
      name: string;
    };
    classSection?: {
      class: { name: string };
      section: { name: string };
    };
  };
  teacher?: {
    id: string;
    user: {
      name: string;
    };
  };
}

interface StudentOption {
  id: string;
  rollNo?: string;
  user: {
    name: string;
    email?: string;
    phone?: string;
  };
  classSection?: {
    id: string;
    class: { name: string };
    section: { name: string };
  };
}

interface ClassSectionOption {
  id: string;
  class: {
    id: string;
    name: string;
  };
  section: {
    id: string;
    name: string;
  };
}

interface TeacherOption {
  id: string;
  user: {
    name: string;
  };
}

interface AcademicYear {
  id: string;
  name: string;
  isActive: boolean;
}

interface StudentStats {
  studentId: string;
  totalCases: number;
  complaintCount: number;
  praiseCount: number;
  resolvedCount: number;
}

interface ComplaintBoxProps {
  isEmbedded?: boolean;
}

export default function ComplaintBox({ isEmbedded = false }: ComplaintBoxProps) {
  const { currentUser } = useTenant();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);
  type TabKey = 'parent-complaints' | 'submit' | 'pending' | 'history';
  const [activeTab, setActiveTab] = useState<TabKey>('parent-complaints');
  const activeTabRef = useRef<TabKey>('parent-complaints');
  const tabRequestSeqRef = useRef<number>(0);

  // Per-tab loading and error tracking
  const [tabLoading, setTabLoading] = useState<Record<TabKey, boolean>>({
    'parent-complaints': true,
    'submit': false,
    'pending': false,
    'history': false,
  });
  const [tabError, setTabError] = useState<Record<TabKey, string | null>>({
    'parent-complaints': null,
    'submit': null,
    'pending': null,
    'history': null,
  });

  // Parent complaints states
  const [parentComplaints, setParentComplaints] = useState<any[]>(() => {
    if (typeof window === 'undefined') return [];
    return getCachedData<any[]>('/complaint-box/parent-complaints') || [];
  });
  const [isLoadingParentComplaints, setIsLoadingParentComplaints] = useState<boolean>(false);
  const [parentFilterStatus, setParentFilterStatus] = useState<string>('All');
  const [selectedParentComplaint, setSelectedParentComplaint] = useState<any | null>(null);
  const [parentReplyText, setParentReplyText] = useState<string>('');
  const [parentNewStatus, setParentNewStatus] = useState<string>('OPEN');
  const [parentResolutionNotes, setParentResolutionNotes] = useState<string>('');
  const [isSavingParentComplaint, setIsSavingParentComplaint] = useState<boolean>(false);

  const fetchParentComplaints = async (status = parentFilterStatus) => {
    setIsLoadingParentComplaints(true);
    try {
      const res = await fastGet('/complaint-box/parent-complaints', {
        params: status !== 'All' ? { status } : {}
      }, {
        ttlMs: 30000,
        onRevalidate: (fresh) => {
          if (fresh) {
            setParentComplaints(fresh.data || fresh);
            setIsLoadingParentComplaints(false);
          }
        }
      });
      if (res?.data) {
        setParentComplaints(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch parent complaints:', err);
    } finally {
      setIsLoadingParentComplaints(false);
    }
  };

  const handleParentFilterChange = async (st: string) => {
    setParentFilterStatus(st);
    setIsLoadingParentComplaints(true);
    try {
      const res = await fastGet('/complaint-box/parent-complaints', {
        params: st !== 'All' ? { status: st } : {}
      }, {
        ttlMs: 30000,
        onRevalidate: (fresh) => { if (fresh) setParentComplaints(fresh.data || fresh); }
      });
      if (res?.data) {
        setParentComplaints(res.data);
      }
    } catch (err) {
      console.error('Failed to filter parent complaints:', err);
    } finally {
      setIsLoadingParentComplaints(false);
    }
  };

  // Backend configuration states
  const [classOptions, setClassOptions] = useState<ClassSectionOption[]>(() => {
    if (typeof window === 'undefined') return [];
    return getCachedData<ClassSectionOption[]>('/complaint-box/student-classes') || [];
  });
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>(() => {
    if (typeof window === 'undefined') return [];
    return getCachedData<AcademicYear[]>('/complaint-box/academic-years') || [];
  });
  const [teachers, setTeachers] = useState<TeacherOption[]>(() => {
    if (typeof window === 'undefined') return [];
    return getCachedData<TeacherOption[]>('/complaint-box/teachers') || [];
  });
  const [currentTeacher, setCurrentTeacher] = useState<TeacherOption | null>(null);

  // Class & Student listing states for log flow
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [searchKey, setSearchKey] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);

  // Form input fields
  const [behaviorType, setBehaviorType] = useState<'Complaint' | 'Praise'>('Complaint');
  const [category, setCategory] = useState<string>('Discipline');
  const [description, setDescription] = useState<string>('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('');
  const [submittingTeacherId, setSubmittingTeacherId] = useState<string>('');

  // Pending ledger and history lists
  const [pendingCases, setPendingCases] = useState<BehaviorCase[]>(() => {
    if (typeof window === 'undefined') return [];
    return getCachedData<BehaviorCase[]>('/complaint-box/pending-cases') || [];
  });
  const [isLoadingPendingCases, setIsLoadingPendingCases] = useState<boolean>(false);
  const [filterAcademicYear, setFilterAcademicYear] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const handlePendingYearChange = async (yr: string) => {
    setFilterAcademicYear(yr);
    setIsLoadingPendingCases(true);
    try {
      const res = await fastGet('/complaint-box/pending-cases', {
        params: yr !== 'All' ? { academicYear: yr } : {}
      }, {
        ttlMs: 30000,
        onRevalidate: (fresh) => { if (fresh) setPendingCases(fresh.data || fresh); }
      });
      if (res?.data) {
        setPendingCases(res.data);
      }
    } catch (err) {
      console.error('Failed to filter pending cases:', err);
    } finally {
      setIsLoadingPendingCases(false);
    }
  };

  // Student history and stats
  const [historyStudent, setHistoryStudent] = useState<StudentOption | null>(null);
  const [historyStudentInput, setHistoryStudentInput] = useState<string>('');
  const [historySearchResults, setHistorySearchResults] = useState<StudentOption[]>([]);
  const [studentCases, setStudentCases] = useState<BehaviorCase[]>([]);
  const [studentStats, setStudentStats] = useState<StudentStats | null>(null);
  const [historyAcademicYearFilter, setHistoryAcademicYearFilter] = useState<string>('All');

  // UI state
  const [selectedCase, setSelectedCase] = useState<BehaviorCase | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [alertMessage, setAlertMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  // Inline edit state inside modal
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editBehaviorType, setEditBehaviorType] = useState<'Complaint' | 'Praise'>('Complaint');
  const [editCategory, setEditCategory] = useState<string>('Discipline');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editAcademicYear, setEditAcademicYear] = useState<string>('');
  const [editTeacherId, setEditTeacherId] = useState<string>('');

  // Tab navigation with proper loading state & stale request prevention
  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    activeTabRef.current = tab;
    loadTabData(tab);
  };

  const loadTabData = async (tab: TabKey) => {
    const seq = ++tabRequestSeqRef.current;
    setTabLoading(prev => ({ ...prev, [tab]: true }));
    setTabError(prev => ({ ...prev, [tab]: null }));

    try {
      if (tab === 'parent-complaints') {
        const res = await fastGet('/complaint-box/parent-complaints', {
          params: parentFilterStatus !== 'All' ? { status: parentFilterStatus } : {}
        }, {
          ttlMs: 30000,
          onRevalidate: (fresh) => {
            if (fresh && activeTabRef.current === 'parent-complaints' && tabRequestSeqRef.current === seq) {
              setParentComplaints(fresh.data || fresh);
            }
          }
        });
        if (activeTabRef.current === 'parent-complaints' && tabRequestSeqRef.current === seq) {
          if (res?.data) {
            setParentComplaints(res.data);
          }
        }
      } else if (tab === 'submit') {
        const [classesRes, yearsRes, teachersRes, currentTeacherRes] = await Promise.all([
          classOptions.length > 0 ? Promise.resolve({ data: classOptions }) : fastGet('/complaint-box/student-classes', undefined, { ttlMs: 60000 }).catch(() => null),
          academicYears.length > 0 ? Promise.resolve({ data: academicYears }) : fastGet('/complaint-box/academic-years', undefined, { ttlMs: 60000 }).catch(() => null),
          teachers.length > 0 ? Promise.resolve({ data: teachers }) : fastGet('/complaint-box/teachers', undefined, { ttlMs: 60000 }).catch(() => null),
          currentTeacher ? Promise.resolve({ data: currentTeacher }) : fastGet('/complaint-box/current-teacher', undefined, { ttlMs: 60000 }).catch(() => null),
        ]);

        if (activeTabRef.current === 'submit' && tabRequestSeqRef.current === seq) {
          if (classesRes?.data) setClassOptions(classesRes.data);
          if (yearsRes?.data) {
            setAcademicYears(yearsRes.data);
            if (yearsRes.data.length > 0 && !selectedAcademicYear) {
              const activeYear = yearsRes.data.find((y: any) => y.isActive) || yearsRes.data[0];
              setSelectedAcademicYear(activeYear.name);
            }
          }
          if (teachersRes?.data) setTeachers(teachersRes.data);
          if (currentTeacherRes?.data) {
            setCurrentTeacher(currentTeacherRes.data);
            if (!submittingTeacherId) setSubmittingTeacherId(currentTeacherRes.data.id);
          }
        }
      } else if (tab === 'pending') {
        const res = await fastGet('/complaint-box/pending-cases', {
          params: filterAcademicYear !== 'All' ? { academicYear: filterAcademicYear } : {}
        }, {
          ttlMs: 30000,
          onRevalidate: (fresh) => {
            if (fresh && activeTabRef.current === 'pending' && tabRequestSeqRef.current === seq) {
              setPendingCases(fresh.data || fresh);
            }
          }
        });
        if (activeTabRef.current === 'pending' && tabRequestSeqRef.current === seq) {
          if (res?.data) {
            setPendingCases(res.data);
          }
        }
      } else if (tab === 'history') {
        if (academicYears.length === 0) {
          const yearsRes = await fastGet('/complaint-box/academic-years', undefined, { ttlMs: 60000 }).catch(() => null);
          if (yearsRes?.data && activeTabRef.current === 'history' && tabRequestSeqRef.current === seq) {
            setAcademicYears(yearsRes.data);
          }
        }
      }
    } catch (err: any) {
      if (activeTabRef.current === tab && tabRequestSeqRef.current === seq) {
        console.error(`Failed to load data for tab ${tab}:`, err);
        setTabError(prev => ({
          ...prev,
          [tab]: err?.message || 'Unable to retrieve records from the school server. Please verify your connection and try again.'
        }));
      }
    } finally {
      if (activeTabRef.current === tab && tabRequestSeqRef.current === seq) {
        setTabLoading(prev => ({ ...prev, [tab]: false }));
      }
    }
  };

  // Fetch initial setup data
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Lock body scroll when any modal is open to prevent background scrolling
  useEffect(() => {
    if (selectedCase || selectedParentComplaint) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedCase, selectedParentComplaint]);

  const fetchInitialData = async () => {
    try {
      const [classesRes, yearsRes, teachersRes, currentTeacherRes, pendingRes, complaintsRes] = await Promise.all([
        fastGet('/complaint-box/student-classes', undefined, {
          ttlMs: 60000,
          onRevalidate: (fresh) => { if (fresh) setClassOptions(fresh.data || fresh); }
        }).catch(() => null),
        fastGet('/complaint-box/academic-years', undefined, {
          ttlMs: 60000,
          onRevalidate: (fresh) => { if (fresh) setAcademicYears(fresh.data || fresh); }
        }).catch(() => null),
        fastGet('/complaint-box/teachers', undefined, {
          ttlMs: 60000,
          onRevalidate: (fresh) => { if (fresh) setTeachers(fresh.data || fresh); }
        }).catch(() => null),
        fastGet('/complaint-box/current-teacher', undefined, { ttlMs: 60000 }).catch(() => null),
        fastGet('/complaint-box/pending-cases', {
          params: filterAcademicYear !== 'All' ? { academicYear: filterAcademicYear } : {}
        }, {
          ttlMs: 30000,
          onRevalidate: (fresh) => { if (fresh) setPendingCases(fresh.data || fresh); }
        }).catch(() => null),
        fastGet('/complaint-box/parent-complaints', {
          params: parentFilterStatus !== 'All' ? { status: parentFilterStatus } : {}
        }, {
          ttlMs: 30000,
          onRevalidate: (fresh) => { if (fresh) setParentComplaints(fresh.data || fresh); }
        }).catch(() => null),
      ]);

      if (classesRes?.data) setClassOptions(classesRes.data);
      if (yearsRes?.data) {
        setAcademicYears(yearsRes.data);
        if (yearsRes.data.length > 0) {
          const activeYear = yearsRes.data.find((y: any) => y.isActive) || yearsRes.data[0];
          setSelectedAcademicYear(activeYear.name);
        }
      }
      if (teachersRes?.data) setTeachers(teachersRes.data);
      if (pendingRes?.data) setPendingCases(pendingRes.data);
      if (complaintsRes?.data) setParentComplaints(complaintsRes.data);

      if (currentTeacherRes && currentTeacherRes.data) {
        setCurrentTeacher(currentTeacherRes.data);
        setSubmittingTeacherId(currentTeacherRes.data.id);
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
      if (activeTabRef.current === 'parent-complaints') {
        setTabError(prev => ({ ...prev, 'parent-complaints': 'Failed to load initial data. Please retry.' }));
      }
    } finally {
      setIsLoading(false);
      setIsLoadingParentComplaints(false);
      setTabLoading(prev => ({ ...prev, 'parent-complaints': false }));
    }
  };

  const refreshPendingCases = async () => {
    setIsLoadingPendingCases(true);
    try {
      const res = await fastGet('/complaint-box/pending-cases', {
        params: filterAcademicYear !== 'All' ? { academicYear: filterAcademicYear } : {}
      }, {
        ttlMs: 30000,
        onRevalidate: (fresh) => {
          if (fresh) {
            setPendingCases(fresh.data || fresh);
            setIsLoadingPendingCases(false);
          }
        }
      }).catch(() => null);
      if (res?.data) {
        setPendingCases(res.data);
      }
    } catch (err) {
      console.error('Failed to refresh pending cases:', err);
    } finally {
      setIsLoadingPendingCases(false);
    }
  };

  // Load students when a class is selected
  useEffect(() => {
    if (selectedClass) {
      loadStudentsByClass(selectedClass);
    } else {
      setStudents([]);
      setSearchKey('');
      setSelectedStudent(null);
    }
  }, [selectedClass]);

  const loadStudentsByClass = async (classSectionId: string) => {
    try {
      const res = await fastGet(`/complaint-box/students-by-class/${classSectionId}`, undefined, {
        ttlMs: 30000,
        onRevalidate: (fresh) => { if (fresh) setStudents(fresh.data || fresh); }
      });
      setStudents(res.data || []);
      setSearchKey('');
      setSelectedStudent(null);
      if (!res.data || res.data.length === 0) {
        showAlert('No students found in this class section.', 'info');
      }
    } catch (err) {
      console.error('Failed to load students for class:', err);
      showAlert('Error loading student roster.', 'error');
    }
  };

  // Autocomplete search on history tab
  useEffect(() => {
    if (historyStudentInput.trim().length < 2) {
      setHistorySearchResults([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fastGet('/complaint-box/search-students', {
          params: { searchTerm: historyStudentInput }
        }, { ttlMs: 15000 });
        setHistorySearchResults(res.data || []);
      } catch (err) {
        console.error('Student search failed:', err);
      }
    }, 250);
    return () => clearTimeout(delayDebounce);
  }, [historyStudentInput]);

  // Load student cases history and stats
  useEffect(() => {
    if (historyStudent) {
      loadStudentHistoryAndStats(historyStudent.id);
    } else {
      setStudentCases([]);
      setStudentStats(null);
    }
  }, [historyStudent, historyAcademicYearFilter]);

  const loadStudentHistoryAndStats = async (studentId: string) => {
    try {
      const [casesRes, statsRes] = await Promise.all([
        fastGet(`/complaint-box/student-cases/${studentId}`, {
          params: historyAcademicYearFilter !== 'All' ? { academicYear: historyAcademicYearFilter } : {}
        }, { ttlMs: 30000 }),
        fastGet(`/complaint-box/student-stats/${studentId}`, undefined, { ttlMs: 30000 })
      ]);
      setStudentCases(casesRes.data || []);
      setStudentStats(statsRes.data || null);
    } catch (err) {
      console.error('Failed to load student statistics:', err);
    }
  };

  const showAlert = (text: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setAlertMessage({ text, type });
    setTimeout(() => setAlertMessage(null), 4000);
  };

  const handleResetForm = () => {
    setBehaviorType('Complaint');
    setCategory('Discipline');
    setDescription('');
    if (currentTeacher) {
      setSubmittingTeacherId(currentTeacher.id);
    } else {
      setSubmittingTeacherId('');
    }
    if (academicYears.length > 0) {
      const activeYear = academicYears.find(y => y.isActive) || academicYears[0];
      setSelectedAcademicYear(activeYear.name);
    }
  };

  const handleClearStudentSelection = () => {
    setSelectedStudent(null);
    handleResetForm();
  };

  const handleSubmitBehavior = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      showAlert('Please select a student from the class roster.', 'error');
      return;
    }
    if (!behaviorType || !category || !description || !selectedAcademicYear || !submittingTeacherId) {
      showAlert('Please fill all required form fields.', 'error');
      return;
    }
    if (description.length < 10) {
      showAlert('Description must be at least 10 characters long.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      setIsLoading(true);
      const res = await api.post('/complaint-box/submit-behavior', {
        studentId: selectedStudent.id,
        behaviorType,
        category,
        academicYear: selectedAcademicYear,
        description,
        teacherId: submittingTeacherId
      });

      showAlert(`Behavior record submitted successfully for ${selectedStudent.user.name}.`, 'success');
      handleClearStudentSelection();
      await refreshPendingCases();
      setActiveTab('pending');
    } catch (err) {
      console.error('Failed to save behavior case:', err);
      showAlert('Failed to save behavior record. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (caseId: string, newStatus: string) => {
    if (currentUser?.role === 'TEACHER') {
      showAlert('Only administrators can update complaint status.', 'error');
      return;
    }

    try {
      await api.patch(`/complaint-box/case-status/${caseId}`, {
        status: newStatus
      });
      showAlert(`Case status updated to ${newStatus}.`, 'success');
      
      if (selectedCase && selectedCase.id === caseId) {
        setSelectedCase(prev => prev ? { ...prev, status: newStatus } : null);
      }
      
      await refreshPendingCases();
      if (historyStudent) {
        await loadStudentHistoryAndStats(historyStudent.id);
      }
    } catch (err) {
      console.error('Failed to update case status:', err);
      showAlert('Failed to update status.', 'error');
    }
  };

  const handleStartEdit = (c: BehaviorCase) => {
    setEditBehaviorType(c.behaviorType);
    setEditCategory(c.category);
    setEditDescription(c.description);
    setEditAcademicYear(c.academicYear);
    setEditTeacherId(c.teacher?.id || '');
    setIsEditing(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;

    if (editDescription.length < 10) {
      showAlert('Description must be at least 10 characters long.', 'error');
      return;
    }

    try {
      setIsLoading(true);
      const res = await api.patch(`/complaint-box/behavior/${selectedCase.id}`, {
        studentId: selectedCase.studentId,
        behaviorType: editBehaviorType,
        category: editCategory,
        academicYear: editAcademicYear,
        description: editDescription,
        teacherId: editTeacherId || submittingTeacherId,
      });

      showAlert('Complaint updated successfully.', 'success');
      setIsEditing(false);
      
      // Update case state inside modal view
      const updatedCase: BehaviorCase = {
        ...selectedCase,
        behaviorType: editBehaviorType,
        category: editCategory,
        description: editDescription,
        academicYear: editAcademicYear,
        priority: editBehaviorType === 'Complaint' ? 'High' : 'Medium',
      };
      setSelectedCase(updatedCase);
      
      await refreshPendingCases();
      if (historyStudent) {
        await loadStudentHistoryAndStats(historyStudent.id);
      }
    } catch (err: any) {
      console.error('Failed to edit behavior case:', err);
      showAlert('Failed to save changes. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCase = async (caseId: string) => {
    if (!window.confirm('Are you sure you want to delete this complaint record? This action cannot be undone.')) {
      return;
    }

    try {
      setIsLoading(true);
      await api.delete(`/complaint-box/behavior/${caseId}`);
      showAlert('Complaint deleted successfully.', 'success');
      
      if (selectedCase && selectedCase.id === caseId) {
        setSelectedCase(null);
        setIsEditing(false);
      }

      await refreshPendingCases();
      if (historyStudent) {
        await loadStudentHistoryAndStats(historyStudent.id);
      }
    } catch (err: any) {
      console.error('Failed to delete behavior case:', err);
      showAlert('Failed to delete complaint record.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper check for Modify (Edit/Delete) permissions
  const canModify = (c: BehaviorCase) => {
    if (!currentUser) return false;
    if (currentUser.role === 'SCHOOL_ADMIN' || currentUser.role === 'SUPER_ADMIN') {
      return true;
    }
    // Teacher can only edit/delete if they created the case
    return currentUser.role === 'TEACHER' && c.teacher?.id === currentTeacher?.id;
  };

  // Local memory search filtering for students list
  const filteredStudents = students.filter(student => {
    if (!searchKey) return true;
    const name = student.user?.name?.toLowerCase() || '';
    const phone = student.user?.phone?.toLowerCase() || '';
    const roll = student.rollNo?.toLowerCase() || '';
    const term = searchKey.toLowerCase();
    return name.includes(term) || phone.includes(term) || roll.includes(term);
  });

  // Local search query filtering for pending list view
  const filteredPendingCases = pendingCases.filter(c => {
    const term = searchQuery.toLowerCase().trim();
    if (!term) return true;
    const sName = c.student?.user?.name?.toLowerCase() || '';
    const desc = c.description?.toLowerCase() || '';
    const cat = c.category?.toLowerCase() || '';
    const num = c.id.substring(0, 8).toLowerCase();
    return sName.includes(term) || desc.includes(term) || cat.includes(term) || num.includes(term);
  });

  const contentBody = (
    <div className="space-y-6 w-full max-w-full min-w-0 overflow-hidden">
      
      {/* Alert toast notification */}
      {alertMessage && (
        <div className={`fixed top-4 right-4 z-[9999] p-4 rounded-xl shadow-xl border flex items-center gap-3 text-sm animate-bounce ${
          alertMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
          alertMessage.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
          alertMessage.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {alertMessage.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
          <span className="font-semibold">{alertMessage.text}</span>
        </div>
      )}

      {/* Premium Card Panel */}
      <div className="bg-slate-900 border border-slate-700/60 rounded-[20px] shadow-xl overflow-hidden w-full max-w-full">
        
        {/* LWC Header Gradient */}
        <div className="bg-gradient-to-r from-[#2E5BFF] to-[#8B5CF6] p-6 sm:p-8 text-white">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5">
            <div className="bg-white/20 p-3 sm:p-4 rounded-2xl shrink-0">
              <BookOpen className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight leading-tight">
                Student Behavior Submission
              </h1>
              <p className="text-white/90 text-[11px] sm:text-sm font-medium">
                Submit complaints or praises for student behavior logs in CS EduTrack
              </p>
            </div>
          </div>
        </div>

        {/* Salesforce SLDS Style Navigation Tabs */}
        <div className="flex border-b border-slate-700 bg-slate-800/50 px-6 overflow-x-auto scrollbar-none">
          <button
            onClick={() => handleTabChange('parent-complaints')}
            className={`px-6 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-2 ${
              activeTab === 'parent-complaints'
                ? 'border-blue-500 text-blue-400 bg-slate-900 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Parent Complaints &amp; Tickets
            {tabLoading['parent-complaints'] && <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />}
          </button>
          <button
            onClick={() => handleTabChange('submit')}
            className={`px-6 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-2 ${
              activeTab === 'submit'
                ? 'border-blue-500 text-blue-400 bg-slate-900 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Log Behavior
            {tabLoading['submit'] && <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />}
          </button>
          <button
            onClick={() => handleTabChange('pending')}
            className={`px-6 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'border-blue-500 text-blue-400 bg-slate-900 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Pending Behavior Cases
            {tabLoading['pending'] && <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />}
          </button>
          <button
            onClick={() => handleTabChange('history')}
            className={`px-6 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-400 bg-slate-900 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Student Ledger &amp; Stats
            {tabLoading['history'] && <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />}
          </button>
        </div>

        {/* Card Body Container */}
        <div className="p-4 sm:p-8 bg-slate-900 min-h-[380px]">
          {tabLoading[activeTab] ? (
            <div className="w-full flex flex-col items-center justify-center p-16 text-center bg-slate-800/40 rounded-2xl border border-slate-700/60 min-h-[320px] animate-in fade-in duration-200">
              <PencilSpinner size="md" />
              <h4 className="font-bold text-slate-200 text-sm mt-4 tracking-wide">
                {activeTab === 'parent-complaints' ? 'Loading Parent Complaints & Tickets...' :
                 activeTab === 'submit' ? 'Loading Student Behavior Roster & Form...' :
                 activeTab === 'pending' ? 'Loading Pending Behavior Cases...' :
                 'Loading Student Ledger & Stats...'}
              </h4>
              <p className="text-xs text-slate-400 font-medium mt-1">Retrieving latest records from CS EduTrack</p>
            </div>
          ) : tabError[activeTab] ? (
            <div className="w-full p-12 flex flex-col items-center justify-center text-center bg-slate-800/60 border border-rose-900/50 rounded-2xl min-h-[260px] animate-in fade-in duration-200">
              <div className="w-12 h-12 rounded-2xl bg-rose-900/40 text-rose-400 flex items-center justify-center mb-3">
                <AlertCircle className="w-6 h-6 stroke-[2]" />
              </div>
              <h4 className="text-base font-bold text-slate-100">Unable to load records</h4>
              <p className="text-xs text-slate-400 font-medium mt-1 max-w-md">{tabError[activeTab]}</p>
              <button
                onClick={() => loadTabData(activeTab)}
                className="mt-4 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors inline-flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" /> Retry Loading
              </button>
            </div>
          ) : (
            <>
              {/* TAB 0: PARENT COMPLAINTS & TICKETS MANAGEMENT */}
              {activeTab === 'parent-complaints' && (
                <div className="space-y-6 pb-24">
                  {/* Filter Bar */}
                  <div className="bg-slate-800 p-4 sm:p-6 rounded-2xl border border-slate-700 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between shadow-xs">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Filter className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="font-bold text-xs uppercase tracking-wider text-slate-300">Parent Grievance Tickets</span>
                    </div>

                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 items-center w-full sm:w-auto">
                      {(['All', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const).map(st => (
                        <button
                          key={st}
                          onClick={() => handleParentFilterChange(st)}
                      className={`text-center px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        st === 'CLOSED' ? 'col-span-2 sm:col-auto' : ''
                      } ${
                        parentFilterStatus === st
                          ? 'bg-blue-600 text-white shadow-xs border-blue-600'
                          : 'bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {st === 'All' ? 'All Tickets' : st.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Complaints Table / Cards */}
              {isLoadingParentComplaints && parentComplaints.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-800/40 rounded-2xl border border-slate-700">
                  <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                  <p className="text-xs text-slate-400 font-semibold mt-3">Loading tickets...</p>
                </div>
              ) : parentComplaints.length === 0 ? (
                <div className="bg-slate-800 border border-dashed border-slate-700 rounded-2xl p-16 text-center text-slate-400">
                  <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-slate-200">No Parent Complaints Registered</h3>
                  <p className="text-xs text-slate-400 mt-1">Complaints submitted via Parent Portal will appear here in real time.</p>
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto border border-slate-700 rounded-2xl shadow-sm bg-slate-900">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-700 bg-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          <th className="px-6 py-4">Ticket Ref</th>
                          <th className="px-6 py-4">Submitted By</th>
                          <th className="px-6 py-4">Category &amp; Title</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Last Updated</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/50 bg-slate-900">
                        {parentComplaints.map(c => {
                          const st = (c.status || 'OPEN').toUpperCase();
                          return (
                            <tr key={c.id} className="bg-slate-900 hover:bg-slate-800 text-[13px] text-slate-300 transition-all">
                              <td className="px-6 py-4 font-mono text-xs font-bold text-blue-400">
                                #{c.id.substring(0, 8).toUpperCase()}
                              </td>
                              <td className="px-6 py-4">
                                <div className="font-bold text-slate-100">{c.submittedBy?.name || 'Parent'}</div>
                                <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                                  {c.submittedBy?.email || c.submittedBy?.phone || ''}
                                </div>
                              </td>
                              <td className="px-6 py-4 max-w-xs">
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-900/50 text-blue-300 border border-blue-700/50 uppercase tracking-wider mb-1">
                                  {c.category}
                                </span>
                                <p className="font-bold text-slate-200 text-xs truncate" title={c.title}>{c.title}</p>
                                <p className="text-slate-400 text-[11px] truncate mt-0.5" title={c.description}>{c.description}</p>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-block text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider border ${
                                  st === 'OPEN' ? 'bg-blue-900/50 text-blue-300 border-blue-700/50' :
                                  st === 'IN_PROGRESS' ? 'bg-amber-900/40 text-amber-300 border-amber-700/50' :
                                  st === 'RESOLVED' ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50' :
                                  'bg-slate-700 text-slate-400 border-slate-600'
                                }`}>
                                  {c.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-xs font-mono text-slate-400">
                                {new Date(c.updatedAt || c.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() => {
                                    setSelectedParentComplaint(c);
                                    setParentNewStatus(c.status || 'OPEN');
                                    setParentReplyText(c.adminReply || '');
                                    setParentResolutionNotes(c.resolutionNotes || '');
                                  }}
                                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-all"
                                >
                                  View &amp; Reply
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View with Dedicated Scroll Container */}
                  <div className="block md:hidden max-h-[600px] overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                    {parentComplaints.map(c => {
                      const st = (c.status || 'OPEN').toUpperCase();
                      return (
                        <div key={c.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-sm space-y-3">
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="font-mono text-xs font-bold text-blue-400 block">
                                #{c.id.substring(0, 8).toUpperCase()}
                              </span>
                              <h4 className="font-bold text-slate-100 text-sm mt-0.5 truncate">{c.submittedBy?.name || 'Parent'}</h4>
                              <p className="text-[11px] text-slate-400 font-medium truncate">
                                {c.submittedBy?.email || c.submittedBy?.phone || ''}
                              </p>
                            </div>
                            <span className={`inline-block text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider border shrink-0 ${
                              st === 'OPEN' ? 'bg-blue-900/50 text-blue-300 border-blue-700/50' :
                              st === 'IN_PROGRESS' ? 'bg-amber-900/40 text-amber-300 border-amber-700/50' :
                              st === 'RESOLVED' ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50' :
                              'bg-slate-700 text-slate-400 border-slate-600'
                            }`}>
                              {c.status}
                            </span>
                          </div>

                          <div className="space-y-1 bg-slate-700/50 p-3 rounded-xl border border-slate-600 text-xs">
                            <div>
                              <span className="inline-block px-2 py-0.5 rounded text-[9px] font-bold bg-blue-900/50 text-blue-300 border border-blue-700/50 uppercase tracking-wider mb-1">
                                {c.category}
                              </span>
                            </div>
                            <p className="font-bold text-slate-200 text-xs truncate" title={c.title}>{c.title}</p>
                            <p className="text-slate-400 text-[11px] line-clamp-2" title={c.description}>{c.description}</p>
                          </div>

                          <div className="flex justify-between items-center pt-1 gap-2">
                            <span className="text-[10px] font-mono text-slate-400 shrink-0">
                              Updated: {new Date(c.updatedAt || c.createdAt).toLocaleDateString()}
                            </span>
                            <button
                              onClick={() => {
                                setSelectedParentComplaint(c);
                                setParentNewStatus(c.status || 'OPEN');
                                setParentReplyText(c.adminReply || '');
                                setParentResolutionNotes(c.resolutionNotes || '');
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-all shrink-0"
                            >
                              View &amp; Reply
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 1: FORM BEHAVIOR LOG SUBMISSION */}
          {activeTab === 'submit' && (
            <div className="space-y-6">
              
              {/* 1. Class Selection Gated Box */}
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                <div className="flex items-center gap-2 mb-3 text-slate-300">
                  <Filter className="w-4 h-4 text-blue-400" />
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Filter by Class *</label>
                </div>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-xs text-slate-100 outline-none focus:border-blue-500"
                >
                  <option value="">{classOptions.length === 0 ? '-- Loading Classes... --' : '-- Select a Class to view student roster --'}</option>
                  {classOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>
                      {opt.class.name} - {opt.section.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Gated displays: only when class selection is active */}
              {selectedClass ? (
                <div className="space-y-6">

                  {/* 2. Student Lookup and Cards list - only show when no student is active */}
                  {!selectedStudent && (
                    <div className="space-y-4">
                      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <div className="flex items-center gap-2 mb-3 text-slate-300">
                          <Search className="w-4 h-4 text-blue-400" />
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Search Class Student</label>
                        </div>
                        <input
                          type="text"
                          placeholder="Type student name or roll number..."
                          value={searchKey}
                          onChange={(e) => setSearchKey(e.target.value)}
                          className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-xs text-slate-100 outline-none focus:border-blue-500"
                        />
                      </div>

                      {/* Cards list grid */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs font-bold text-slate-400 px-1 uppercase tracking-wider">
                          <span>Roster Results</span>
                          <span className="text-blue-400">{filteredStudents.length} Students found</span>
                        </div>

                        {filteredStudents.length === 0 ? (
                          <div className="p-8 border border-dashed border-slate-700 rounded-xl text-center text-xs text-slate-400 font-semibold bg-slate-800/40">
                            No students in this class match your search query.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-1">
                            {filteredStudents.map(student => (
                              <div
                                key={student.id}
                                onClick={() => setSelectedStudent(student)}
                                className="flex items-center justify-between p-4 bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-xl shadow-xs hover:shadow-md cursor-pointer transition-all hover:-translate-y-0.5 group"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs">
                                    {student.user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                                  </div>
                                  <div className="space-y-0.5">
                                    <h4 className="font-bold text-xs text-slate-200 group-hover:text-blue-400">{student.user.name}</h4>
                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold">
                                      <span className="flex items-center gap-0.5"><GraduationCap className="w-3 h-3" /> Roll: {student.rollNo || 'N/A'}</span>
                                      {student.user.phone && <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" /> {student.user.phone}</span>}
                                    </div>
                                  </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 3. Selected student confirmation banner */}
                  {selectedStudent && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-1.5 duration-200">
                      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-xl shadow-md flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-6 h-6 text-emerald-400 bg-white rounded-full p-0.5 shrink-0" />
                          <div className="space-y-0.5">
                            <h4 className="font-bold text-sm leading-none">{selectedStudent.user.name}</h4>
                            <p className="text-[11px] text-white/80 font-medium">
                              Class: {selectedStudent.classSection?.class.name} - {selectedStudent.classSection?.section.name} • Roll No: {selectedStudent.rollNo || 'N/A'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleClearStudentSelection}
                          className="p-1 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
                          title="Clear Selection"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Behavior submission form */}
                      <form onSubmit={handleSubmitBehavior} className="space-y-5 border-t border-slate-700 pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          
                          {/* Behavior Type */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Behavior Record Type *</label>
                            <select
                              value={behaviorType}
                              onChange={(e) => setBehaviorType(e.target.value as any)}
                              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-xs text-slate-100 outline-none focus:border-blue-500"
                            >
                              <option value="Complaint">Infraction / Complaint (High Priority)</option>
                              <option value="Praise">Praise / Merit (Medium Priority)</option>
                            </select>
                          </div>

                          {/* Category Dropdown */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Behavior Category *</label>
                            <select
                              value={category}
                              onChange={(e) => setCategory(e.target.value)}
                              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-xs text-slate-100 outline-none focus:border-blue-500"
                            >
                              <option value="Academic">Academic Performance</option>
                              <option value="Discipline">Discipline</option>
                              <option value="Sports">Sports & Athletics</option>
                              <option value="Extra-Curricular">Extra-Curricular Activities</option>
                              <option value="General">General Behavior</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          
                          {/* Academic Year */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Academic Year *</label>
                            <select
                              value={selectedAcademicYear}
                              onChange={(e) => setSelectedAcademicYear(e.target.value)}
                              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-xs text-slate-100 outline-none focus:border-blue-500"
                            >
                              {academicYears.map(year => (
                                <option key={year.id} value={year.name}>{year.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Submitting Teacher (Disabled/Locked for Teachers) */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Submitting Teacher *</label>
                            <select
                              value={submittingTeacherId}
                              disabled={currentUser?.role === 'TEACHER'}
                              onChange={(e) => setSubmittingTeacherId(e.target.value)}
                              className="w-full bg-slate-700 disabled:bg-slate-800 disabled:cursor-not-allowed border border-slate-600 rounded-xl px-4 py-2.5 text-xs text-slate-100 outline-none focus:border-blue-500"
                            >
                              {currentUser?.role === 'TEACHER' ? (
                                <option value={currentTeacher?.id || ''}>{currentTeacher?.user?.name || 'Loading...'}</option>
                              ) : (
                                <>
                                  <option value="">-- Select Submitting Teacher --</option>
                                  {teachers.map(teacher => (
                                    <option key={teacher.id} value={teacher.id}>
                                      {teacher.user.name}
                                    </option>
                                  ))}
                                </>
                              )}
                            </select>
                          </div>
                        </div>

                        {/* Description details */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Detailed Incident Description *</label>
                          <textarea
                            required
                            rows={4}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Provide description of the behavior (minimum 10 characters required)..."
                            className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-xs text-slate-100 outline-none focus:border-blue-500 resize-none"
                          />
                          {description && description.length < 10 && (
                            <p className="text-[11px] font-bold text-rose-400">
                              Description must be at least 10 characters (currently: {description.length}).
                            </p>
                          )}
                        </div>

                        {/* Form action triggers */}
                        <div className="flex gap-4 pt-4 border-t border-slate-700 justify-end">
                          <button
                            type="button"
                            onClick={handleResetForm}
                            className="px-6 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700 font-bold text-xs transition-colors cursor-pointer"
                          >
                            Reset Form
                          </button>
                          <button
                            type="submit"
                            disabled={isSubmitting || description.length < 10}
                            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/15 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                          >
                            {isSubmitting ? 'Submitting...' : 'Submit Behavior Record'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              ) : (
                /* Form Empty State when no class selected */
                <div className="p-16 border border-dashed border-slate-700 bg-slate-800/40 rounded-2xl text-center text-slate-400">
                  <Filter className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                  <h3 className="text-base font-bold text-slate-200">No Class Selected</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    Please select a class section from the dropdown list to load and view student profiles.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PENDING CASES LEDGER */}
          {activeTab === 'pending' && (
            <div className="space-y-6">
              
              {/* Ledger filters */}
              <div className="bg-slate-800 p-4 sm:p-6 rounded-xl border border-slate-700 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between shadow-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <Filter className="w-4 h-4 text-blue-400" />
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-300">Filters Ledger</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 items-center w-full sm:w-auto">
                  <div className="relative w-full sm:w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search student, details..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-slate-700 border border-slate-600 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-100 outline-none w-full focus:border-blue-500"
                    />
                  </div>

                  <select
                    value={filterAcademicYear}
                    onChange={(e) => handlePendingYearChange(e.target.value)}
                    className="bg-slate-700 border border-slate-600 rounded-xl px-3 py-1.5 text-xs text-slate-100 outline-none w-full sm:w-auto focus:border-blue-500"
                  >
                    <option value="All">All Years</option>
                    {academicYears.map(year => (
                      <option key={year.id} value={year.name}>{year.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Table list view */}
              {isLoadingPendingCases && pendingCases.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-800/40 rounded-2xl border border-slate-700">
                  <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                  <p className="text-xs text-slate-400 font-semibold mt-3">Loading behavior cases...</p>
                </div>
              ) : filteredPendingCases.length === 0 ? (
                <div className="bg-slate-800 border border-dashed border-slate-700 rounded-2xl p-16 text-center text-slate-400">
                  <BookOpen className="w-12 h-12 text-slate-500 mx-auto mb-4 opacity-50" />
                  <h3 className="text-base font-bold text-slate-200">No Pending Behavior Logs</h3>
                  <p className="text-xs text-slate-400 mt-1">Cases with status other than "Closed" will appear in this ledger.</p>
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto border border-slate-700 rounded-2xl shadow-sm bg-slate-900">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-700 bg-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          <th className="px-6 py-4">Student &amp; Class</th>
                          <th className="px-6 py-4">Type &amp; Category</th>
                          <th className="px-6 py-4">Description</th>
                          <th className="px-6 py-4">Priority</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/50 bg-slate-900">
                        {filteredPendingCases.map(c => {
                          const isComplaint = c.behaviorType === 'Complaint';
                          return (
                            <tr key={c.id} className="hover:bg-slate-800 text-[13px] text-slate-300 transition-all">
                              <td className="px-6 py-4">
                                <div className="font-bold text-slate-100">{c.student?.user?.name || 'Unknown Student'}</div>
                                <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                                  Roll: {c.student?.rollNo || 'N/A'} • {c.student?.classSection?.class.name} {c.student?.classSection?.section.name}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                                  isComplaint ? 'bg-rose-900/40 text-rose-300 border border-rose-700/50' : 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50'
                                }`}>
                                  {isComplaint ? <ShieldAlert className="w-3.5 h-3.5" /> : <Award className="w-3.5 h-3.5" />}
                                  {c.behaviorType}
                                </span>
                                <div className="text-[11px] text-slate-400 font-bold mt-1.5">{c.category}</div>
                              </td>
                              <td className="px-6 py-4 max-w-xs">
                                <p className="truncate text-slate-300 text-xs" title={c.description}>
                                  {c.description}
                                </p>
                                <span className="text-[10px] text-slate-400 font-semibold block mt-1">
                                  Logged by: {c.teacher?.user?.name || 'Admin'}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                                  c.priority === 'High' ? 'bg-rose-900/40 border-rose-700/50 text-rose-300' : 'bg-slate-800 border-slate-700 text-slate-300'
                                }`}>
                                  {c.priority}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                                  c.status === 'New' ? 'bg-blue-900/40 text-blue-300 border-blue-700/50' :
                                  c.status === 'In Progress' ? 'bg-amber-900/40 text-amber-300 border-amber-700/50' :
                                  'bg-emerald-900/40 text-emerald-300 border-emerald-700/50'
                                }`}>
                                  {c.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2 items-center">
                                  <button
                                    onClick={() => setSelectedCase(c)}
                                    className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 cursor-pointer"
                                    title="View Case Details"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  
                                  {/* Edit/Delete Actions (Creator/Admin only) */}
                                  {canModify(c) && (
                                    <>
                                      <button
                                        onClick={() => { setSelectedCase(c); handleStartEdit(c); }}
                                        className="p-1.5 rounded-lg hover:bg-blue-900/40 text-blue-400 hover:text-blue-300 cursor-pointer"
                                        title="Edit Record"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteCase(c.id)}
                                        className="p-1.5 rounded-lg hover:bg-rose-900/40 text-rose-400 hover:text-rose-300 cursor-pointer"
                                        title="Delete Record"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}

                                  {/* Status change action (Admin only) */}
                                  {currentUser?.role !== 'TEACHER' && c.status !== 'Closed' && (
                                    <button
                                      onClick={() => handleUpdateStatus(c.id, 'Closed')}
                                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors cursor-pointer shadow-xs"
                                    >
                                      Resolve
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="block md:hidden space-y-4">
                    {filteredPendingCases.map(c => {
                      const isComplaint = c.behaviorType === 'Complaint';
                      return (
                        <div key={c.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-sm space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-slate-100 text-sm">{c.student?.user?.name || 'Unknown Student'}</h4>
                              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                Roll: {c.student?.rollNo || 'N/A'} • {c.student?.classSection?.class.name} {c.student?.classSection?.section.name}
                              </p>
                            </div>
                            <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                              isComplaint ? 'bg-rose-900/40 text-rose-300 border border-rose-700/50' : 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50'
                            }`}>
                              {c.behaviorType}
                            </span>
                          </div>

                          <p className="text-xs text-slate-300 line-clamp-3 bg-slate-700/50 p-2.5 rounded-xl border border-slate-600 leading-relaxed">
                            {c.description}
                          </p>

                          <div className="flex flex-wrap gap-2 items-center text-xs text-slate-400 justify-between">
                            <div className="flex gap-2">
                              <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                                c.priority === 'High' ? 'bg-rose-900/40 border-rose-700/50 text-rose-300' : 'bg-slate-700 border-slate-600 text-slate-300'
                              }`}>
                                {c.priority}
                              </span>
                              <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                c.status === 'New' ? 'bg-blue-900/40 text-blue-300 border-blue-700/50' :
                                c.status === 'In Progress' ? 'bg-amber-900/40 text-amber-300 border-amber-700/50' :
                                'bg-emerald-900/40 text-emerald-300 border-emerald-700/50'
                              }`}>
                                {c.status}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              by {c.teacher?.user?.name || 'Admin'}
                            </span>
                          </div>

                          <div className="flex gap-2 justify-end pt-1 border-t border-slate-700">
                            <button
                              onClick={() => setSelectedCase(c)}
                              className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-600 hover:bg-slate-700 text-slate-200 text-xs font-bold min-h-[44px] cursor-pointer"
                            >
                              <Eye className="w-4 h-4" /> View
                            </button>

                            {canModify(c) && (
                              <>
                                <button
                                  onClick={() => { setSelectedCase(c); handleStartEdit(c); }}
                                  className="flex items-center gap-1 px-3 py-2 rounded-xl border border-blue-600/50 hover:bg-blue-900/40 text-blue-300 text-xs font-bold min-h-[44px] cursor-pointer"
                                >
                                  <Edit className="w-4 h-4" /> Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteCase(c.id)}
                                  className="flex items-center gap-1 px-3 py-2 rounded-xl border border-rose-600/50 hover:bg-rose-900/40 text-rose-300 text-xs font-bold min-h-[44px] cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" /> Delete
                                </button>
                              </>
                            )}

                            {currentUser?.role !== 'TEACHER' && c.status !== 'Closed' && (
                              <button
                                onClick={() => handleUpdateStatus(c.id, 'Closed')}
                                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors min-h-[44px] cursor-pointer"
                              >
                                Resolve
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: STUDENT HISTORY & STATS DASHBOARD */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              
              {/* Student Selector card */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xs w-full sm:max-w-xl mx-auto space-y-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-100 leading-none font-sans">Select Student to view history</h3>
                  <p className="text-slate-400 text-[11px] font-semibold mt-1">Queries student stats metrics and full logs registry.</p>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Type student name to search..."
                    value={historyStudentInput}
                    onChange={(e) => {
                      setHistoryStudentInput(e.target.value);
                      if (historyStudent) setHistoryStudent(null);
                    }}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 outline-none focus:border-blue-500"
                  />

                  {!historyStudent && historySearchResults.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-20 max-h-48 overflow-y-auto divide-y divide-slate-700">
                      {historySearchResults.map(student => (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => {
                            setHistoryStudent(student);
                            setHistoryStudentInput(student.user.name);
                            setHistorySearchResults([]);
                          }}
                          className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-slate-700 flex justify-between items-center transition-colors cursor-pointer"
                        >
                          <span className="font-semibold">{student.user.name}</span>
                          <span className="text-[10px] text-slate-400 font-bold font-mono">
                            Roll: {student.rollNo || 'N/A'} • {student.classSection?.class.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Dashboard statistics display and timelines */}
              {historyStudent ? (
                <div className="space-y-6 animate-in fade-in duration-200">
                  
                  {/* Stats summary cards */}
                  {studentStats && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-sm flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-700 text-blue-400 flex items-center justify-center shrink-0">
                          <Activity className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xl font-extrabold text-slate-100 leading-tight">{studentStats.totalCases}</div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Total Logs</div>
                        </div>
                      </div>

                      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-sm flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-rose-900/40 text-rose-400 flex items-center justify-center shrink-0">
                          <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xl font-extrabold text-slate-100 leading-tight">{studentStats.complaintCount}</div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Complaints</div>
                        </div>
                      </div>

                      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-sm flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-900/40 text-emerald-400 flex items-center justify-center shrink-0">
                          <Award className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xl font-extrabold text-slate-100 leading-tight">{studentStats.praiseCount}</div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Praises</div>
                        </div>
                      </div>

                      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-sm flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-violet-900/40 text-violet-400 flex items-center justify-center shrink-0">
                          <CheckCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xl font-extrabold text-slate-100 leading-tight">{studentStats.resolvedCount}</div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Resolved</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Behavior cases history */}
                  <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-5 border-b border-slate-700 bg-slate-800/80 flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <h4 className="font-bold text-sm text-slate-100 font-sans">Behavior Cases History</h4>
                        <p className="text-slate-400 text-[11px] font-semibold mt-0.5">Historical logs for {historyStudent.user.name}</p>
                      </div>

                      <select
                        value={historyAcademicYearFilter}
                        onChange={(e) => setHistoryAcademicYearFilter(e.target.value)}
                        className="bg-slate-700 border border-slate-600 rounded-xl px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-blue-500"
                      >
                        <option value="All">All Academic Years</option>
                        {academicYears.map(year => (
                          <option key={year.id} value={year.name}>{year.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="p-6 divide-y divide-slate-700">
                      {studentCases.length === 0 ? (
                        <p className="text-center text-slate-400 text-xs py-8 font-medium font-sans">
                          No cases logged for this student in the selected year.
                        </p>
                      ) : (
                        studentCases.map(c => {
                          const isComplaint = c.behaviorType === 'Complaint';
                          return (
                            <div key={c.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row justify-between gap-3 text-xs">
                              <div className="space-y-1.5 flex-1">
                                <div className="flex flex-wrap gap-2 items-center">
                                  <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                    isComplaint ? 'bg-rose-900/40 text-rose-300 border border-rose-700/50' : 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50'
                                  }`}>
                                    {c.behaviorType}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide uppercase border ${
                                    c.status === 'Closed' ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-blue-900/40 border-blue-700/50 text-blue-300'
                                  }`}>
                                    Status: {c.status}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-bold font-mono">
                                    Logged: {new Date(c.createdAt).toLocaleDateString()}
                                  </span>
                                </div>

                                <div className="text-[11px] font-bold text-blue-400 font-sans">
                                  Category: {c.category} • Academic Year: {c.academicYear}
                                </div>

                                <p className="text-slate-300 leading-relaxed text-xs">
                                  {c.description}
                                </p>
                              </div>

                              <div className="flex flex-col sm:items-end justify-between gap-2 shrink-0">
                                <div className="flex gap-2 items-center self-start sm:self-auto">
                                  <button
                                    onClick={() => setSelectedCase(c)}
                                    className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-0.5 cursor-pointer"
                                  >
                                    View Details <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                  {canModify(c) && (
                                    <>
                                      <button
                                        onClick={() => { setSelectedCase(c); handleStartEdit(c); }}
                                        className="text-slate-400 hover:text-blue-400 cursor-pointer"
                                        title="Edit Complaint"
                                      >
                                        <Edit className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteCase(c.id)}
                                        className="text-slate-400 hover:text-rose-400 cursor-pointer"
                                        title="Delete Complaint"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>

                                {currentUser?.role !== 'TEACHER' && c.status !== 'Closed' && (
                                  <button
                                    onClick={() => handleUpdateStatus(c.id, 'Closed')}
                                    className="px-2.5 py-1 rounded-lg border border-emerald-700/50 bg-emerald-900/40 text-emerald-300 font-bold text-[10px] hover:bg-emerald-600 hover:text-white transition-all cursor-pointer"
                                  >
                                    Resolve Case
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-800 border border-dashed border-slate-700 rounded-2xl p-16 text-center text-slate-400 w-full sm:max-w-xl mx-auto">
                  <User className="w-12 h-12 mx-auto mb-3 opacity-30 animate-pulse text-slate-400" />
                  <h3 className="text-base font-bold text-slate-200">Select a Student</h3>
                  <p className="text-xs text-slate-400 mt-1">Please search and select a student above to inspect behavior timelines.</p>
                </div>
              )}
            </div>
          )}
          </>
        )}
        </div>
      </div>

      {/* CASE DETAILS & EDIT MODAL */}
      {isMounted && selectedCase && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 sm:p-6 animate-fade-in" onClick={() => { setSelectedCase(null); setIsEditing(false); }}>
          <div className="w-full max-w-xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-scale-in" onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className={`p-6 text-white flex justify-between items-start shrink-0 ${
              (isEditing ? editBehaviorType : selectedCase.behaviorType) === 'Complaint' ? 'bg-rose-600' : 'bg-emerald-600'
            }`}>
              <div className="space-y-1">
                <span className="text-[9px] font-bold uppercase tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full">
                  {isEditing ? 'Editing Behavior Incident' : `${selectedCase.behaviorType} Incident Details`}
                </span>
                <h3 className="text-lg font-black leading-tight">{selectedCase.student?.user?.name || 'Unknown Student'}</h3>
              </div>
              <button
                onClick={() => { setSelectedCase(null); setIsEditing(false); }}
                className="text-white hover:bg-white/10 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            {isEditing ? (
              <form onSubmit={handleSaveEdit} className="p-6 space-y-4 flex-1 overflow-y-auto overscroll-contain flex flex-col">
                <div className="grid grid-cols-2 gap-4">
                  
                  {/* Edit Record Type */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Record Type *</label>
                    <select
                      value={editBehaviorType}
                      onChange={(e) => setEditBehaviorType(e.target.value as any)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500"
                    >
                      <option value="Complaint">Complaint</option>
                      <option value="Praise">Praise</option>
                    </select>
                  </div>

                  {/* Edit Category */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Category *</label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500"
                    >
                      <option value="Academic">Academic Performance</option>
                      <option value="Discipline">Discipline</option>
                      <option value="Sports">Sports & Athletics</option>
                      <option value="Extra-Curricular">Extra-Curricular Activities</option>
                      <option value="General">General Behavior</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  
                  {/* Edit Academic Year */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Academic Year *</label>
                    <select
                      value={editAcademicYear}
                      onChange={(e) => setEditAcademicYear(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500"
                    >
                      {academicYears.map(year => (
                        <option key={year.id} value={year.name}>{year.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Edit Submitting Teacher (Locked for Teacher) */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Submitting Teacher *</label>
                    <select
                      value={editTeacherId}
                      disabled={currentUser?.role === 'TEACHER'}
                      onChange={(e) => setEditTeacherId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500 disabled:opacity-80"
                    >
                      {currentUser?.role === 'TEACHER' ? (
                        <option value={currentTeacher?.id || ''}>{currentTeacher?.user?.name || 'Loading...'}</option>
                      ) : (
                        <>
                          <option value="">-- Select Submitting Teacher --</option>
                          {teachers.map(teacher => (
                            <option key={teacher.id} value={teacher.id}>
                              {teacher.user.name}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {/* Edit Description */}
                <div className="space-y-1.5 border-t border-slate-700 pt-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Detailed Incident Description *</label>
                  <textarea
                    required
                    rows={4}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Provide description of the behavior (minimum 10 characters)..."
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500 resize-none"
                  />
                  {editDescription && editDescription.length < 10 && (
                    <p className="text-[11px] font-bold text-rose-600">
                      Description must be at least 10 characters (currently: {editDescription.length}).
                    </p>
                  )}
                </div>

                {/* Edit Form Actions */}
                <div className="flex gap-3 justify-end pt-3 border-t border-slate-150 shrink-0 mt-auto">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editDescription.length < 10}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-750 text-white font-bold text-xs rounded-xl shadow-md disabled:opacity-50 cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-6 space-y-6 flex-1 overflow-y-auto overscroll-contain">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider font-sans">Student Name</span>
                    <span className="text-slate-800 font-bold block mt-0.5">{selectedCase.student?.user?.name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider font-sans">Class & Section</span>
                    <span className="text-slate-800 font-semibold block mt-0.5">
                      {selectedCase.student?.classSection?.class.name} {selectedCase.student?.classSection?.section.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider font-sans">Logged By Teacher</span>
                    <span className="text-slate-800 font-medium block mt-0.5">{selectedCase.teacher?.user?.name || 'Admin'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider font-sans">Category</span>
                    <span className="text-slate-800 font-semibold block mt-0.5">{selectedCase.category}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider font-sans">Academic Year</span>
                    <span className="text-slate-800 font-mono block mt-0.5">{selectedCase.academicYear}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider font-sans">Date Created</span>
                    <span className="text-slate-800 font-mono block mt-0.5 font-bold">
                      {new Date(selectedCase.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Description Details */}
                <div className="border-t border-slate-700 pt-4">
                  <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider mb-2 font-sans">Description details</span>
                  <div className="p-4 bg-slate-800 rounded-xl border border-slate-200 text-slate-700 text-xs leading-relaxed max-h-48 overflow-y-auto">
                    {selectedCase.description}
                  </div>
                </div>

                {/* Current Status Update controls */}
                <div className="border-t border-slate-700 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider font-sans">Current Status</span>
                    <span className={`inline-block mt-1 px-3 py-0.5 border text-[10px] font-bold rounded-full ${
                      selectedCase.status === 'New' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                      selectedCase.status === 'In Progress' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                      'bg-emerald-50 text-emerald-700 border-emerald-100'
                    }`}>
                      {selectedCase.status}
                    </span>
                  </div>

                  {/* Status buttons ONLY for Admins, hidden for Teachers */}
                  {currentUser?.role !== 'TEACHER' && (
                    <div className="flex gap-2">
                      {selectedCase.status !== 'New' && (
                        <button
                          onClick={() => handleUpdateStatus(selectedCase.id, 'New')}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-[11px] font-bold cursor-pointer transition-colors"
                        >
                          Set New
                        </button>
                      )}
                      {selectedCase.status !== 'In Progress' && selectedCase.status !== 'Closed' && (
                        <button
                          onClick={() => handleUpdateStatus(selectedCase.id, 'In Progress')}
                          className="px-3 py-1.5 rounded-lg border border-amber-200 text-amber-750 bg-amber-50/20 hover:bg-amber-50 text-[11px] font-bold cursor-pointer transition-colors"
                        >
                          Investigate
                        </button>
                      )}
                      {selectedCase.status !== 'Closed' && (
                        <button
                          onClick={() => handleUpdateStatus(selectedCase.id, 'Closed')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer transition-colors"
                        >
                          Resolve Case
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Edit/Delete controls inside Modal (Creator/Admin only) */}
                {canModify(selectedCase) && (
                  <div className="border-t border-slate-700 pt-4 flex gap-3 justify-end">
                    <button
                      onClick={() => handleStartEdit(selectedCase)}
                      className="px-4 py-2 border border-blue-200 text-blue-700 hover:bg-blue-50 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <Edit className="w-3.5 h-3.5" /> Edit Record
                    </button>
                    <button
                      onClick={() => handleDeleteCase(selectedCase.id)}
                      className="px-4 py-2 border border-rose-250 text-rose-700 hover:bg-rose-50 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete Record
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Modal Footer block */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end shrink-0">
              <button
                onClick={() => { setSelectedCase(null); setIsEditing(false); }}
                className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Close View
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* PARENT COMPLAINT ACTION MODAL */}
      {isMounted && selectedParentComplaint && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 sm:p-6 animate-fade-in" onClick={() => setSelectedParentComplaint(null)}>
          <div className="w-full max-w-2xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Parent Grievance Ticket</span>
                <h3 className="text-lg font-black leading-tight mt-0.5">{selectedParentComplaint.title}</h3>
              </div>
              <button
                onClick={() => setSelectedParentComplaint(null)}
                className="text-slate-400 hover:text-white p-1.5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5 flex-1 overflow-y-auto overscroll-contain">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-150">
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Submitted By</span>
                  <p className="font-extrabold text-slate-800 mt-0.5">{selectedParentComplaint.submittedBy?.name || 'Parent'}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Category</span>
                  <p className="font-extrabold text-blue-600 mt-0.5">{selectedParentComplaint.category}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Date Filed</span>
                  <p className="font-bold text-slate-700 mt-0.5">{new Date(selectedParentComplaint.createdAt).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block mb-1">Elaborated Concern</span>
                <p className="text-xs text-slate-700 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 leading-relaxed whitespace-pre-wrap">
                  {selectedParentComplaint.description}
                </p>
              </div>

              {/* Status & Reply Form */}
              <div className="border-t border-slate-200 pt-4 space-y-4">
                <h4 className="font-extrabold text-sm text-slate-900">Update Complaint Status &amp; Admin Reply</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Status *</label>
                    <select
                      value={parentNewStatus}
                      onChange={(e) => setParentNewStatus(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                    >
                      <option value="OPEN">OPEN (Registered)</option>
                      <option value="IN_PROGRESS">IN_PROGRESS (Investigating)</option>
                      <option value="RESOLVED">RESOLVED (Solution Provided)</option>
                      <option value="CLOSED">CLOSED (Archived)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Internal Resolution Notes</label>
                    <input
                      type="text"
                      placeholder="Internal remarks for staff..."
                      value={parentResolutionNotes}
                      onChange={(e) => setParentResolutionNotes(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Admin Reply / Message to Parent
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter official reply to the parent..."
                    value={parentReplyText}
                    onChange={(e) => setParentReplyText(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                  />
                </div>

                {selectedParentComplaint.history && selectedParentComplaint.history.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Timeline History</span>
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {selectedParentComplaint.history.map((h: any, idx: number) => (
                        <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1">
                          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                            <span>Status: <strong className="text-slate-800">{h.status}</strong></span>
                            <span>{h.changedBy?.name || 'System'}</span>
                          </div>
                          {h.adminReply && <p className="text-blue-700 text-xs italic">&ldquo;{h.adminReply}&rdquo;</p>}
                          {h.resolutionNotes && <p className="text-slate-500 text-[11px]">Note: {h.resolutionNotes}</p>}
                          <div className="text-right">
                            <span className="text-[9px] text-slate-400 font-mono block mt-0.5">{new Date(h.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 justify-end pt-2 border-t border-slate-150">
                  <button
                    type="button"
                    onClick={() => setSelectedParentComplaint(null)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSavingParentComplaint}
                    onClick={async () => {
                      setIsSavingParentComplaint(true);
                      try {
                        await api.patch(`/complaint-box/parent-complaints/${selectedParentComplaint.id}/status`, {
                          status: parentNewStatus,
                          adminReply: parentReplyText,
                          resolutionNotes: parentResolutionNotes,
                        });
                        setSelectedParentComplaint(null);
                        await fetchParentComplaints();
                        showAlert('Complaint ticket updated & parent notified successfully!', 'success');
                      } catch (err) {
                        console.error('Failed to update parent complaint:', err);
                        showAlert('Failed to update complaint ticket.', 'error');
                      } finally {
                        setIsSavingParentComplaint(false);
                      }
                    }}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isSavingParentComplaint ? 'Saving...' : 'Save & Notify Parent'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );

  if (isEmbedded) {
    return contentBody;
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-800 p-4 sm:p-8 font-sans selection:bg-blue-500 selection:text-white">
      {/* Main Container */}
      <div className="w-full sm:max-w-[1400px] mx-auto space-y-6">
        
        {/* Nav Header Link */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm cursor-pointer">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <span className="text-[11px] font-bold text-slate-400 font-mono uppercase tracking-wider select-none">
            CS EduTrack Portal
          </span>
        </div>

        {contentBody}
      </div>
    </main>
  );
}
