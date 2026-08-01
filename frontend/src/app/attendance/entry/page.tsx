// frontend/src/app/attendance/entry/page.tsx
'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { 
  Calendar, CheckCircle, AlertCircle, RefreshCw, 
  Search, Lock, X, ChevronRight, BarChart3, Clock, ArrowLeft 
} from 'lucide-react';
import Link from 'next/link';
import { dispatchSchoolSetupUpdated } from '@/lib/events';
import { toLocalDateString, isBefore } from '@/lib/date';

interface Teacher {
  id: string;
  name: string;
  subject: string;
}

interface ClassOption {
  label: string;
  value: string;
}

interface SectionOption {
  label: string;
  value: string;
}

interface Submission {
  id: string;
  text: string;
}

interface Student {
  id: string;
  name: string;
  rollNo: string;
  isAbsent: boolean;
  status: 'Present' | 'Absent';
  cardClass: string;
}

function AttendanceEntryContent() {
  const searchParams = useSearchParams();
  const paramClass = searchParams.get('classVal');
  const paramSection = searchParams.get('sectionVal');
  const paramDate = searchParams.get('dateVal');
  const paramTeacherId = searchParams.get('teacherId');
  // Page routing and layout states
  const [showTeacherSelection, setShowTeacherSelection] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [sessionExists, setSessionExists] = useState(false);
  const [filter, setFilter] = useState<'All' | 'Present' | 'Absent'>('All');
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  // Selection state
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateString());
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);

  // Setup Options
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [sectionOptions, setSectionOptions] = useState<SectionOption[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);

  // Search State for Autocomplete Teacher Selection
  const [teacherSearchTerm, setTeacherSearchTerm] = useState('');
  const [isTeacherDropdownOpen, setIsTeacherDropdownOpen] = useState(false);
  const [justOpened, setJustOpened] = useState(false);

  // Roster Student Data
  const [students, setStudents] = useState<Student[]>([]);

  // Saved timestamps & Teacher info
  const [submittedTeacherName, setSubmittedTeacherName] = useState('');
  const [submittedTime, setSubmittedTime] = useState('');
  const [lastUpdatedTime, setLastUpdatedTime] = useState('');

  const todayDate = useMemo(() => toLocalDateString(), []);

  // Pre-fill query parameters if present
  useEffect(() => {
    if (paramClass) {
      setSelectedClass(paramClass);
    }
    if (paramSection) {
      setSelectedSection(paramSection);
    }
    if (paramDate) {
      setSelectedDate(paramDate);
    }
  }, [paramClass, paramSection, paramDate]);

  useEffect(() => {
    if (teachers.length > 0 && paramTeacherId) {
      const match = teachers.find(t => t.id === paramTeacherId);
      if (match) {
        setSelectedTeacher(match);
        setTeacherSearchTerm(match.name);
        setShowTeacherSelection(false);
      }
    }
  }, [teachers, paramTeacherId]);

  // Compute initials
  const getInitials = (name: string) => {
    return name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';
  };

  // Generate color class based on teacher name to ensure it's persistent
  const getRandomColorClass = (name: string) => {
    const classes = ['bg-indigo', 'bg-purple', 'bg-sky', 'bg-rose', 'bg-amber', 'bg-emerald', 'bg-pink', 'bg-teal', 'bg-orange', 'bg-violet'];
    let sum = 0;
    for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return classes[sum % classes.length];
  };

  // Load Setup options
  const loadOptions = async () => {
    try {
      setLoading(true);
      const [recentRes, teachersRes, classesRes] = await Promise.all([
        api.get('/attendance/recent'),
        api.get('/attendance/teachers'),
        api.get('/attendance/classes'),
      ]);

      if (recentRes.data) {
        setRecentSubmissions(recentRes.data);
      }
      if (teachersRes.data) {
        setTeachers(teachersRes.data);
      }
      if (classesRes.data) {
        setClassOptions(classesRes.data);
      }
    } catch (err) {
      console.error('Error loading options:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOptions();
  }, []);

  // Refresh recent submissions
  const fetchRecentSubmissions = async () => {
    try {
      const res = await api.get('/attendance/recent');
      if (res.data) setRecentSubmissions(res.data);
    } catch (err) {
      console.error('Error loading recent submissions:', err);
    }
  };

  // Click outside to close teacher dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (justOpened) {
        setJustOpened(false);
        return;
      }
      if (!isTeacherDropdownOpen) return;

      const dropdownContainer = document.querySelector('[data-id="teacher-search-container"]');
      if (dropdownContainer && !dropdownContainer.contains(e.target as Node)) {
        setIsTeacherDropdownOpen(false);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [isTeacherDropdownOpen, justOpened]);

  // Load Students and Session data when Class, Section, and Date are ready
  const loadStudentsIfReady = async () => {
    if (selectedDate && selectedClass && selectedSection) {
      setLoading(true);
      setIsSuccess(false);
      setStudents([]);
      setSubmittedTeacherName('');
      setSubmittedTime('');
      setLastUpdatedTime('');

      // Lock historical past dates using timezone-safe string comparison
      const todayStr = toLocalDateString();
      const readOnly = isBefore(selectedDate, todayStr);
      setIsReadOnly(readOnly);

      try {
        const [studentsData, sessionData] = await Promise.all([
          api.get('/attendance/students', { params: { classVal: selectedClass.trim(), sectionVal: selectedSection.trim() } }),
          api.get('/attendance/session-data', { params: { classVal: selectedClass.trim(), sectionVal: selectedSection.trim(), dateVal: selectedDate } })
        ]);

        const hasSession = sessionData.data.sessionExists;
        setSessionExists(hasSession);

        if (hasSession) {
          setSubmittedTeacherName(sessionData.data.teacherName || '');
          setSubmittedTime(sessionData.data.createdTime || '');
          setLastUpdatedTime(sessionData.data.lastUpdatedTime || '');
        }

        const absentIds = sessionData.data.absentIds || [];

        setStudents(
          (studentsData.data || []).map((student: any) => {
            const isAbsent = absentIds.includes(student.Id);
            return {
              id: student.Id,
              name: student.Name,
              rollNo: student.Roll_No__c || '',
              isAbsent: isAbsent,
              status: isAbsent ? 'Absent' : 'Present',
              cardClass: `student-card ${isAbsent ? 'absent' : 'present'}`
            };
          })
        );

        if (hasSession) {
          setIsSuccess(true);
        }
      } catch (err) {
        console.error('Load Error:', err);
      } finally {
        setLoading(false);
      }
    } else {
      setStudents([]);
      setSessionExists(false);
      setIsSuccess(false);
    }
  };

  // Dynamic section loader based on class selection
  useEffect(() => {
    const loadSectionsForClass = async () => {
      if (!selectedClass) {
        setSectionOptions([]);
        setSelectedSection('');
        return;
      }
      try {
        setLoading(true);
        const res = await api.get('/attendance/sections', { params: { classVal: selectedClass } });
        if (res.data) {
          setSectionOptions(res.data);
          // If current selection is not in the loaded sections, reset section selection
          const match = res.data.find((opt: any) => opt.value === selectedSection);
          if (!match) {
            setSelectedSection('');
          }
        }
      } catch (err) {
        console.error('Error loading sections for class:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSectionsForClass();
  }, [selectedClass]);

  useEffect(() => {
    if (!showTeacherSelection) {
      loadStudentsIfReady();
    }
  }, [selectedClass, selectedSection, selectedDate, showTeacherSelection]);

  const setStudentAbsentState = (studentId: string, isAbsent: boolean) => {
    if (isReadOnly) return;

    const studentIndex = students.findIndex(s => s.id === studentId);
    if (studentIndex !== -1) {
      const student = students[studentIndex];
      if (student.isAbsent === isAbsent) return;

      // Pin student temporarily in filter views
      if (filter !== 'All') {
        setPinnedIds(prev => [...prev, studentId]);
        setTimeout(() => {
          setPinnedIds(prev => prev.filter(id => id !== studentId));
        }, 500);
      }

      const pulseClass = isAbsent ? 'pulse-red' : 'pulse-green';
      const statusClass = isAbsent ? 'absent' : 'present';
      const leavingClass = filter !== 'All' ? 'leaving' : '';

      setStudents(prev => {
        const copy = [...prev];
        copy[studentIndex] = {
          ...student,
          isAbsent: isAbsent,
          status: isAbsent ? 'Absent' : 'Present',
          cardClass: `student-card ${statusClass} ${pulseClass} ${leavingClass}`
        };
        return copy;
      });

      // Clear pulse class after animation
      setTimeout(() => {
        setStudents(prev => {
          const refreshedIndex = prev.findIndex(s => s.id === studentId);
          if (refreshedIndex !== -1) {
            const copy = [...prev];
            const s = copy[refreshedIndex];
            const sStatusClass = s.isAbsent ? 'absent' : 'present';
            copy[refreshedIndex] = {
              ...s,
              cardClass: `student-card ${sStatusClass}`
            };
            return copy;
          }
          return prev;
        });
      }, 500);
    }
  };

  const handleStudentClick = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (student) {
      setStudentAbsentState(studentId, !student.isAbsent);
    }
  };

  const handleFilterClick = (newFilter: 'All' | 'Present' | 'Absent') => {
    setFilter(newFilter);
    setPinnedIds([]);
  };

  const handleSubmit = async () => {
    setSaveLoading(true);
    const absentStudentIds = students.filter(s => s.isAbsent).map(s => s.id);
    const total = students.length;
    const absent = absentStudentIds.length;
    const present = total - absent;

    try {
      const res = await api.post('/attendance/save', {
        classVal: selectedClass,
        sectionVal: selectedSection,
        dateStr: selectedDate,
        absentStudentIds,
        totalStudents: total,
        presentCount: present,
        absentCount: absent,
        teacherId: selectedTeacher ? selectedTeacher.id : ''
      });

      if (res.data) {
        setSubmittedTeacherName(res.data.teacherName || (selectedTeacher ? selectedTeacher.name : ''));
        setSubmittedTime(res.data.createdTime || '');
        setLastUpdatedTime(res.data.lastUpdatedTime || '');
        setSessionExists(res.data.sessionExists);
        setIsSuccess(true);
        fetchRecentSubmissions();
        dispatchSchoolSetupUpdated();
      }
    } catch (err: any) {
      console.error('Save Error:', err);
      alert(err.response?.data?.message || 'Error occurred while saving attendance.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleUpdateAttendance = () => {
    setIsSuccess(false);
    setFilter('All');
  };

  const handleCloseList = async () => {
    await loadStudentsIfReady();
    setIsSuccess(true);
    setFilter('All');
  };

  const stats = useMemo(() => {
    const total = students.length;
    const absent = students.filter(s => s.isAbsent).length;
    return {
      total,
      present: total - absent,
      absent
    };
  }, [students]);

  const displayedStudents = useMemo(() => {
    if (filter === 'Present') {
      return students.filter(s => !s.isAbsent || pinnedIds.includes(s.id));
    }
    if (filter === 'Absent') {
      return students.filter(s => s.isAbsent || pinnedIds.includes(s.id));
    }
    return students;
  }, [students, filter, pinnedIds]);

  const filteredTeachers = useMemo(() => {
    if (!teacherSearchTerm) return teachers;
    return teachers.filter(t => 
      t.name.toLowerCase().includes(teacherSearchTerm.toLowerCase()) || 
      t.subject.toLowerCase().includes(teacherSearchTerm.toLowerCase())
    );
  }, [teachers, teacherSearchTerm]);

  const carouselSubmissions = useMemo(() => {
    if (recentSubmissions.length === 0) return [];
    return [...recentSubmissions, ...recentSubmissions]; // duplicate for loop slide animation
  }, [recentSubmissions]);

  // Formatted headers
  const classLabel = selectedClass ? `Class ${selectedClass.replace(/^Class-?\s*/i, '')}` : '';
  const sectionLabel = selectedSection ? `Section ${selectedSection.replace(/^Section\s*/i, '')}` : '';

  // ─── SETUP SCREEN (TEACHER SELECTION LANDING PAGE) ───────────────────────────────────
  if (showTeacherSelection) {
    return (
      <main className="min-h-[85vh] flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans p-4">
        <div className="teacher-selection-card">
          <div className="card-fill"></div>
          <div className="card-content">
            <div className="header flex flex-col items-center relative">
              <Link 
                href="/attendance/dashboard" 
                className="absolute left-0 top-0 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all shadow-xs flex items-center justify-center min-w-[36px] min-h-[36px]"
                title="Back to Attendance Dashboard"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div className="teacher-header-icon text-white">📋</div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-white mt-2">Take Attendance</h1>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Select your name to get started</p>
            </div>

            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-1.5 border border-purple-200 text-purple-700 bg-purple-50/50 rounded-full px-4 py-1.5 text-xs font-bold shadow-xs">
                📅 <span>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              
              {/* Today's status pill */}
              <div className="flex flex-wrap justify-center gap-2 mt-3">
                {recentSubmissions.length === 0 || recentSubmissions.some(s => s.id === 'pending') ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-50 border border-amber-200 text-amber-700 shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    Today's attendance is currently pending
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Today's attendance is submitted
                  </span>
                )}
              </div>
            </div>

            {/* Submission Carousel */}
            {carouselSubmissions.length > 0 && (
              <div className="carousel-container">
                <div className="carousel-track">
                  {carouselSubmissions.map((sub, idx) => (
                    <div key={`${sub.id}-${idx}`} className="carousel-item">
                      <span className="carousel-bullet">●</span>
                      {sub.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="field-label">👤 Select Teacher</div>

            <div className="teacher-search-wrapper" data-id="teacher-search-container">
              <div className="search-wrap">
                <span className="si-left text-slate-400">🔍</span>
                <input 
                  type="text" 
                  className={`search-input ${teacherSearchTerm ? 'has-value' : ''}`}
                  value={teacherSearchTerm}
                  placeholder="Search your name…" 
                  onFocus={() => {
                    if (!selectedTeacher) {
                      setIsTeacherDropdownOpen(true);
                      setJustOpened(true);
                    }
                  }}
                  onChange={(e) => {
                    setTeacherSearchTerm(e.target.value);
                    setIsTeacherDropdownOpen(true);
                  }}
                />
                {teacherSearchTerm && (
                  <button className="si-clear" onClick={() => {
                    setSelectedTeacher(null);
                    setTeacherSearchTerm('');
                    setIsTeacherDropdownOpen(false);
                  }}>✕</button>
                )}
              </div>

              {/* Autocomplete dropdown */}
              <div className={`dropdown ${isTeacherDropdownOpen ? 'open' : ''}`}>
                <div className="dropdown-inner">
                  {filteredTeachers.map(t => {
                    const initials = getInitials(t.name);
                    const colorClass = getRandomColorClass(t.name);
                    return (
                      <div key={t.id} 
                           className="d-item" 
                           onClick={() => {
                             setSelectedTeacher(t);
                             setTeacherSearchTerm(t.name);
                             setIsTeacherDropdownOpen(false);
                           }}>
                        <div className={colorClass} title={initials}>{initials}</div>
                        <div className="d-info">
                          <div className="d-name text-slate-800">{t.name}</div>
                          <div className="d-sub text-slate-500">{t.subject}</div>
                        </div>
                      </div>
                    );
                  })}
                  {isTeacherDropdownOpen && filteredTeachers.length === 0 && (
                    <div className="p-4 text-center text-slate-400 text-xs">No teacher found</div>
                  )}
                </div>
              </div>
            </div>

            {/* Selected Teacher Preview */}
            {selectedTeacher && (
              <div className="selected-preview">
                <div className={getRandomColorClass(selectedTeacher.name)} style={{ width: '44px', height: '44px', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800' }}>
                  {getInitials(selectedTeacher.name)}
                </div>
                <div className="sel-info">
                  <div className="sel-name">{selectedTeacher.name}</div>
                  <div className="sel-sub">{selectedTeacher.subject}</div>
                </div>
                <button className="sel-change" onClick={() => {
                  setSelectedTeacher(null);
                  setTeacherSearchTerm('');
                  setIsTeacherDropdownOpen(true);
                  setJustOpened(true);
                }}>Change</button>
              </div>
            )}

            <button 
              className="btn-proceed mt-6" 
              disabled={!selectedTeacher} 
              onClick={() => setShowTeacherSelection(false)}
            >
              Proceed to Take Attendance
              <span className="btn-arrow">→</span>
            </button>

            <div className="text-center text-[10px] text-slate-400 mt-4">
              Only you can mark attendance for your class
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ─── ATTENDANCE TRACKER VIEW ────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#f3f4f6] dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-4 sm:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-gray-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Link 
              href={`/attendance/dashboard?classVal=${selectedClass}&sectionVal=${selectedSection}&dateVal=${selectedDate}`}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 shadow-xs text-xs font-bold flex items-center gap-2 transition-all min-h-[44px]"
              title="Back to Attendance Dashboard"
            >
              <ArrowLeft className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="hidden sm:inline">Back to Dashboard</span>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 dark:text-white">Attendance Tracker</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manage student attendance efficiently</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Link href={`/attendance/dashboard?classVal=${selectedClass}&sectionVal=${selectedSection}&dateVal=${selectedDate}`} className="flex-1 sm:flex-none justify-center px-4 min-h-[44px] rounded-xl bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 shadow-xs text-xs font-bold flex items-center gap-1.5 transition-all">
              <BarChart3 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Attendance Report
            </Link>
            <button className="flex-1 sm:flex-none justify-center px-4 min-h-[44px] rounded-xl bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 shadow-xs text-xs font-bold transition-all" onClick={() => setShowTeacherSelection(true)}>
              Change Teacher
            </button>
          </div>
        </div>

        {/* Controls Card */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 shadow-sm">
          <div className="control-group">
            <label className="text-xs font-bold text-slate-500 block mb-1">Date</label>
            <input 
              type="date" 
              className="w-full bg-white border border-gray-300 rounded-xl min-h-[44px] px-3.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition-all shadow-xs" 
              value={selectedDate} 
              max={todayDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          
          <div className="control-group">
            <label className="text-xs font-bold text-slate-500 block mb-1">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-xl min-h-[44px] px-3.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition-all shadow-xs"
            >
              <option value="">Select Class</option>
              {classOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label className="text-xs font-bold text-slate-500 block mb-1">Section</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-xl min-h-[44px] px-3.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition-all shadow-xs"
            >
              <option value="">Select Section</option>
              {sectionOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm">Loading attendance data...</p>
          </div>
        )}

        {/* Attendance Success Summary Card */}
        {!loading && isSuccess && (
          <div className="success-card">
            <div className="success-timestamps">
              <span className="flex items-center gap-1 font-bold text-[10px]">
                <Clock className="w-3 h-3 text-indigo-500" /> Submitted: {submittedTime}
              </span>
              {submittedTime !== lastUpdatedTime && lastUpdatedTime && (
                <>
                  <span className="timestamp-separator"></span>
                  <span className="font-bold text-[10px]">Updated: {lastUpdatedTime}</span>
                </>
              )}
            </div>

            <span className="success-icon">🎉</span>
            <h2 className="success-title">Attendance Submitted!</h2>
            <div className="teacher-success-badge">
              <span className="teacher-label font-medium">Teacher:</span>
              <span className="teacher-name font-bold">{submittedTeacherName}</span>
            </div>
            <p className="success-subtitle text-xs uppercase tracking-wider">{classLabel} • {sectionLabel} • {selectedDate}</p>
            
            <div className="summary-stats">
              <div className="summary-stat present">
                <span className="summary-value">{stats.present}</span>
                <span className="summary-label text-[10px]">Present</span>
              </div>
              <div className="summary-stat absent">
                <span className="summary-value">{stats.absent}</span>
                <span className="summary-label text-[10px]">Absent</span>
              </div>
            </div>

            <div className="flex justify-center gap-4">
              {isReadOnly ? (
                <div className="w-full">
                  <p className="text-amber-600 text-xs font-semibold block w-full text-center bg-amber-50 border border-amber-200 rounded-xl py-2">Attendance for past dates cannot be edited.</p>
                  <button className="px-6 py-2.5 rounded-xl bg-white hover:bg-gray-50 text-slate-700 border border-gray-200 text-xs font-bold transition-all mt-3 shadow-xs" onClick={() => setIsSuccess(false)}>
                    View Attendance
                  </button>
                </div>
              ) : (
                <button className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm" onClick={handleUpdateAttendance}>
                  Update Attendance
                </button>
              )}
            </div>
          </div>
        )}

        {/* Student List Grid (Edit / View Mode) */}
        {!loading && !isSuccess && (
          <>
            {students.length > 0 ? (
              <div className="space-y-4">
                {/* Stats filter cards */}
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  <div className={`stat-card ${filter === 'All' ? 'active-filter total' : ''}`} onClick={() => handleFilterClick('All')}>
                    <div className="stat-icon text-blue-600 bg-blue-50/50 w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0">👥</div>
                    <div className="stat-info min-w-0">
                      <span className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-wider block truncate">Total</span>
                      <span className="stat-value text-lg sm:text-xl font-extrabold text-slate-800 dark:text-slate-100 mt-0.5 block">{stats.total}</span>
                    </div>
                  </div>
                  <div className={`stat-card ${filter === 'Present' ? 'active-filter present' : ''}`} onClick={() => handleFilterClick('Present')}>
                    <div className="stat-icon text-emerald-600 bg-emerald-50/50 w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0">✅</div>
                    <div className="stat-info min-w-0">
                      <span className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-wider block truncate">Present</span>
                      <span className="stat-value text-lg sm:text-xl font-extrabold text-slate-800 dark:text-slate-100 mt-0.5 block">{stats.present}</span>
                    </div>
                  </div>
                  <div className={`stat-card ${filter === 'Absent' ? 'active-filter absent' : ''}`} onClick={() => handleFilterClick('Absent')}>
                    <div className="stat-icon text-rose-600 bg-rose-50/50 w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0">❌</div>
                    <div className="stat-info min-w-0">
                      <span className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-wider block truncate">Absent</span>
                      <span className="stat-value text-lg sm:text-xl font-extrabold text-slate-800 dark:text-slate-100 mt-0.5 block">{stats.absent}</span>
                    </div>
                  </div>
                </div>

                {/* Student list Roster */}
                <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm">
                  <div className="list-header border-b border-gray-200 dark:border-slate-800 pb-3 flex justify-between items-center">
                    <div>
                      <h2 className="text-lg font-bold text-slate-800 dark:text-white">Student List</h2>
                      <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
                        {isReadOnly ? 'Read-Only View (Historical Record)' : filter === 'Present' ? `Showing Present Students (${stats.present})` : filter === 'Absent' ? `Showing Absent Students (${stats.absent})` : 'Mark students who are absent'}
                      </span>
                    </div>
                    {sessionExists && (
                      <button className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center border border-gray-200 dark:border-slate-700 transition-colors" onClick={handleCloseList} title="Close & Return to Summary">
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="students-grid max-h-[550px] overflow-y-auto flex flex-col gap-3 pt-3 pr-1">
                    {displayedStudents.map(s => (
                      <div 
                        key={s.id} 
                        className={`${s.cardClass} flex items-center justify-between gap-4 p-4 w-full rounded-2xl transition-all select-none`}
                        onClick={() => handleStudentClick(s.id)}
                      >
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shadow-inner shrink-0 ${s.isAbsent ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-200 border border-rose-200 dark:border-rose-800' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'}`}>
                            {getInitials(s.name)}
                          </div>
                          <div className="student-info text-left min-w-0 flex-1">
                            <h3 className="student-name font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{s.name}</h3>
                            <p className="student-roll text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">Roll No: {s.rollNo || '—'}</p>
                          </div>
                        </div>

                        <div className="flex items-center shrink-0">
                          <div className={`status-badge text-[10px] font-bold px-3 py-1.5 rounded-full border transition-all ${s.isAbsent ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-200 border-rose-200 dark:border-rose-800' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'}`}>
                            {s.status}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Save button footer */}
                  <div className="action-footer mt-6 border-t border-gray-200 pt-4 flex justify-between items-center">
                    {isReadOnly ? (
                      <div className="flex items-center gap-1.5 text-amber-600 text-xs font-semibold">
                        <Lock className="w-3.5 h-3.5" /> Historical records are in Read-Only mode.
                      </div>
                    ) : (
                      <button 
                        className="px-6 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/10 transition-all ml-auto cursor-pointer flex items-center justify-center" 
                        disabled={saveLoading}
                        onClick={handleSubmit}
                      >
                        {saveLoading ? <RefreshCw className="w-4 h-4 animate-spin inline-block mr-2" /> : null}
                        {sessionExists ? 'Update Attendance' : 'Submit Attendance'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 bg-white border border-gray-200 rounded-2xl shadow-sm text-slate-500">
                <div className="text-5xl mb-3">📚</div>
                <h3 className="text-sm font-bold text-slate-700">No Students Found</h3>
                <p className="text-xs text-slate-400 mt-1">Select an active Class and Section to view students.</p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function AttendanceEntry() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 text-slate-400 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    }>
      <AttendanceEntryContent />
    </Suspense>
  );
}
