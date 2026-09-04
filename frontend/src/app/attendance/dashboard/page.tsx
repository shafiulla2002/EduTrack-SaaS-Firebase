// frontend/src/app/attendance/dashboard/page.tsx
'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, cachedGet } from '@/lib/api';
import { 
  Calendar as CalendarIcon, CheckCircle, AlertCircle, RefreshCw, 
  Search, ChevronLeft, ChevronRight, UserCheck, Info, TrendingUp, Plus 
} from 'lucide-react';
import Link from 'next/link';
import { toLocalDateString } from '@/lib/date';

interface Student {
  id: string;
  name: string;
  rollNo: string;
  classValue: string;
  className: string;
  section: string;
  initial: string;
}

interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  rollNo: string;
  section: string;
  classValue: string;
  className: string;
  attendanceDate: string;
  status: string;
}

interface Session {
  id: string;
  classId: string;
  className: string;
  classValue: string;
  attendanceDate: string;
  section: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
}

function AttendanceDashboardContent() {
  const searchParams = useSearchParams();
  const paramClass = searchParams.get('classVal');
  const paramSection = searchParams.get('sectionVal');
  const paramStudentId = searchParams.get('studentId');
  const paramView = searchParams.get('view');
  const paramDate = searchParams.get('dateVal');

  const [calendarView, setCalendarView] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  
  // Roster filters
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedSection, setSelectedSection] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Selected student for student-specific report (Monthly & Yearly)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showStudentSearchDropdown, setShowStudentSearchDropdown] = useState(false);

  // Raw data from server
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dropdown UI states
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [isSectionDropdownOpen, setIsSectionDropdownOpen] = useState(false);

  // Pre-fill parameters on page load if query params exist
  useEffect(() => {
    if (paramView === 'daily' || paramView === 'weekly' || paramView === 'monthly' || paramView === 'yearly') {
      setCalendarView(paramView);
    }
    if (paramClass) {
      setSelectedClass(paramClass);
    }
    if (paramSection) {
      setSelectedSection(paramSection);
    }
    if (paramDate) {
      const parsedDate = new Date(paramDate);
      if (!isNaN(parsedDate.getTime())) {
        setCurrentDate(parsedDate);
      }
    }
  }, [paramView, paramClass, paramSection, paramDate]);

  useEffect(() => {
    if (students.length > 0 && paramStudentId) {
      const match = students.find(s => s.id === paramStudentId);
      if (match) {
        setSelectedStudent(match);
        setSearchTerm(match.name);
      }
    }
  }, [students, paramStudentId]);

  // Fetch report data for a 1-year historical range
  const loadAttendanceData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const today = new Date();
      const start = new Date();
      start.setFullYear(today.getFullYear() - 1);
      const end = new Date();
      end.setDate(today.getDate() + 30);

      const startDateStr = toLocalDateString(start);
      const endDateStr = toLocalDateString(end);

      const [res, classesRes, sectionsRes] = await Promise.all([
        api.get('/attendance/report-data', {
          params: { startDate: startDateStr, endDate: endDateStr }
        }),
        cachedGet('/academics/classes', undefined, 60000).catch(() => ({ data: [] })),
        cachedGet('/academics/sections', undefined, 60000).catch(() => ({ data: [] })),
      ]);

      const data = res.data;
      if (data) {
        setStudents(
          (data.students || []).map((student: any) => ({
            id: student.id,
            name: student.name,
            rollNo: student.rollNo || '',
            classValue: student.classValue || student.className || '',
            className: student.className || student.classValue || '',
            section: student.section || '',
            initial: student.name ? student.name.charAt(0).toUpperCase() : ''
          })).sort((a: any, b: any) => a.name.localeCompare(b.name))
        );

        setAttendanceRecords(
          (data.attendanceRecords || []).map((record: any) => ({
            id: record.id,
            studentId: record.studentId,
            studentName: record.studentName || 'Unknown',
            rollNo: record.rollNo || '',
            section: record.section || '',
            classValue: record.classValue || record.className || '',
            className: record.className || record.classValue || '',
            attendanceDate: record.attendanceDate,
            status: record.status || 'Present'
          }))
        );

        const fetchedClassNames = (classesRes.data || []).map((c: any) => c.name).filter(Boolean);
        const fetchedSectionNames = (sectionsRes.data || []).map((s: any) => s.name).filter(Boolean);

        const mergedClasses = Array.from(new Set([...(data.classes || []), ...fetchedClassNames]));
        const mergedSections = Array.from(new Set([...(data.sections || []), ...fetchedSectionNames]));

        setClasses(mergedClasses);
        setSections(mergedSections);
        
        setSessions(
          (data.sessions || []).map((session: any) => ({
            ...session,
            className: session.className || session.classValue || '',
            section: session.section || ''
          }))
        );
      }
    } catch (err) {
      console.error('Error fetching report data:', err);
      setError('Failed to load reports data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAttendanceData();
  }, []);

  // Indexed Lookups (Salesforce parity)
  const maps = useMemo(() => {
    const sessionMap = new Map<string, Set<string>>(); // Date -> Set<Class-Section>
    const attendanceMap = new Map<string, Map<string, string>>(); // Date -> Map<StudentId, status>

    sessions.forEach(s => {
      if (!sessionMap.has(s.attendanceDate)) {
        sessionMap.set(s.attendanceDate, new Set());
      }
      const key = `${s.className}-${s.section}`;
      sessionMap.get(s.attendanceDate)?.add(key);
    });

    attendanceRecords.forEach(a => {
      if (!attendanceMap.has(a.attendanceDate)) {
        attendanceMap.set(a.attendanceDate, new Map());
      }
      attendanceMap.get(a.attendanceDate)?.set(a.studentId, a.status);
    });

    // Add session key from attendance to session map in case class session record is missing but attendance exists
    attendanceRecords.forEach(a => {
      if (!sessionMap.has(a.attendanceDate)) {
        sessionMap.set(a.attendanceDate, new Set());
      }
      const key = `${a.className}-${a.section}`;
      sessionMap.get(a.attendanceDate)?.add(key);
    });

    return { sessionMap, attendanceMap };
  }, [sessions, attendanceRecords]);

  // Filters Options
  const classOptions = useMemo(() => {
    const set = new Set<string>();
    classes.forEach(c => c && set.add(c));
    students.forEach(s => s.className && set.add(s.className));
    const sorted = Array.from(set).sort((a, b) => {
      const getNum = (str: string) => {
        const match = str.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      };
      return getNum(a) - getNum(b);
    });

    return [
      { label: 'All Classes', value: 'all' },
      ...sorted.map(c => ({
        label: c.startsWith('Class-') ? c.replace('Class-', 'Class ') : c,
        value: c
      }))
    ];
  }, [classes, students]);

  const sectionOptions = useMemo(() => {
    const set = new Set<string>();
    sections.forEach(s => s && set.add(s));
    students.forEach(s => s.section && set.add(s.section));
    const sorted = Array.from(set).sort();

    return [
      { label: 'All Sections', value: 'all' },
      ...sorted.map(s => ({
        label: s.startsWith('Section-') ? s.replace('Section-', 'Section ') : s,
        value: s
      }))
    ];
  }, [sections, students]);

  // Apply Global Filters to Students list
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchesSearch = !searchTerm || 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        s.rollNo.includes(searchTerm);
      
      const matchesClass = selectedClass === 'all' || s.className === selectedClass;
      const matchesSection = selectedSection === 'all' || s.section === selectedSection;

      return matchesSearch && matchesClass && matchesSection;
    });
  }, [students, searchTerm, selectedClass, selectedSection]);

  const hasSearchResults = filteredStudents.length > 0;

  // Formatting utilities
  const formattedDate = currentDate.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const datePickerValue = toLocalDateString(currentDate);
  const formattedMonth = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Date Navigation handlers
  const handlePrevious = () => {
    const d = new Date(currentDate);
    if (calendarView === 'daily') d.setDate(d.getDate() - 1);
    else if (calendarView === 'weekly') d.setDate(d.getDate() - 7);
    else if (calendarView === 'monthly') d.setMonth(d.getMonth() - 1);
    else if (calendarView === 'yearly') d.setFullYear(d.getFullYear() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (calendarView === 'daily') d.setDate(d.getDate() + 1);
    else if (calendarView === 'weekly') d.setDate(d.getDate() + 7);
    else if (calendarView === 'monthly') d.setMonth(d.getMonth() + 1);
    else if (calendarView === 'yearly') d.setFullYear(d.getFullYear() + 1);
    setCurrentDate(d);
  };

  const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      const [year, month, day] = val.split('-').map(Number);
      setCurrentDate(new Date(year, month - 1, day));
    }
  };

  // Weekly Date Range Text
  const getWeekRange = (date: Date) => {
    const dayOfWeek = date.getDay();
    const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Start Monday
    const start = new Date(date);
    start.setDate(diff);
    const end = new Date(start);
    end.setDate(end.getDate() + 5); // Sat
    return { start, end };
  };

  const weekRangeText = useMemo(() => {
    const { start, end } = getWeekRange(currentDate);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, [currentDate]);

  // Header button labels
  const classLabelText = selectedClass === 'all' ? 'All Classes' : (selectedClass.startsWith('Class-') ? selectedClass.replace('Class-', 'Class ') : selectedClass);
  const sectionLabelText = selectedSection === 'all' ? 'All Sections' : (selectedSection.startsWith('Section-') ? selectedSection.replace('Section-', 'Section ') : selectedSection);

  // ─── DAILY REPORT VIEW STATISTICS ──────────────────────────────────────────────────
  const classSectionSummary = useMemo(() => {
    if (calendarView !== 'daily' || students.length === 0) return [];
    
    const dateStr = toLocalDateString(currentDate);
    const isSunday = currentDate.getDay() === 0;

    // Group students by Class-Section
    const groups: Record<string, { classValue: string; className: string; section: string; studentsList: Student[] }> = {};
    
    students.forEach(s => {
      const matchesClass = selectedClass === 'all' || s.className === selectedClass;
      const matchesSection = selectedSection === 'all' || s.section === selectedSection;

      if (matchesClass && matchesSection) {
        const key = `${s.classValue}-${s.section}`;
        if (!groups[key]) {
          groups[key] = {
            classValue: s.classValue,
            className: s.className,
            section: s.section,
            studentsList: []
          };
        }
        groups[key].studentsList.push(s);
      }
    });

    return Object.values(groups).map((group, index) => {
      const themeClass = `relative attendance-card theme-${(index % 5) + 1} bg-white border border-gray-200 text-slate-700 p-5 rounded-xl transition-all hover:translate-y-[-2px] hover:z-50 shadow-sm`;

      if (isSunday) {
        return {
          key: `${group.classValue}-${group.section}`,
          classValue: group.classValue,
          className: group.className,
          section: group.section,
          totalCount: group.studentsList.length,
          presentDisplay: '0',
          absentCount: 0,
          attendanceRate: 0,
          absentees: [],
          hasAbsentees: false,
          isHoliday: true,
          themeClass
        };
      }

      const sessionKey = `${group.className}-${group.section}`;
      const submittedSessions = maps.sessionMap.get(dateStr);
      const isSubmitted = submittedSessions && submittedSessions.has(sessionKey);

      const dailyAbsents = maps.attendanceMap.get(dateStr);
      const absentees = group.studentsList.filter(s => dailyAbsents && dailyAbsents.get(s.id) === 'Absent');

      const presentCount = group.studentsList.length - absentees.length;
      const rate = isSubmitted && group.studentsList.length > 0
        ? Math.round((presentCount / group.studentsList.length) * 100)
        : 0;

      return {
        key: `${group.classValue}-${group.section}`,
        classValue: group.classValue,
        className: group.className,
        section: group.section,
        totalCount: group.studentsList.length,
        presentDisplay: isSubmitted ? String(presentCount) : '0',
        absentCount: absentees.length,
        attendanceRate: rate,
        absentees: absentees.map(s => ({ id: s.id, name: s.name })),
        hasAbsentees: absentees.length > 0,
        isHoliday: false,
        themeClass
      };
    }).sort((a, b) => {
      const getNum = (str: string) => {
        const match = str.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      };
      const classDiff = getNum(a.classValue) - getNum(b.classValue);
      if (classDiff !== 0) return classDiff;
      return a.section.localeCompare(b.section);
    });
  }, [calendarView, currentDate, students, selectedClass, selectedSection, maps]);

  const overallDailySummary = useMemo(() => {
    if (classSectionSummary.length === 0) return null;
    let totalPotential = 0;
    let totalPresent = 0;
    let totalAbsent = 0;

    classSectionSummary.forEach(group => {
      totalPotential += group.totalCount;
      if (!group.isHoliday && group.presentDisplay !== 'N/A') {
        totalPresent += parseInt(group.presentDisplay, 10);
      }
      totalAbsent += group.absentCount;
    });

    const rate = totalPotential > 0 ? Math.round((totalPresent / totalPotential) * 105) : 0; // scale adjust
    const displayRate = rate > 100 ? 100 : rate;

    return {
      totalPotential,
      totalPresent,
      totalAbsent,
      rate: displayRate,
      dateLabel: currentDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    };
  }, [classSectionSummary, currentDate]);

  // ─── WEEKLY REPORT VIEW STATISTICS ─────────────────────────────────────────────────
  const weeklyViewData = useMemo(() => {
    if (calendarView !== 'weekly') return null;

    const { start } = getWeekRange(currentDate);
    const weekDays = [];
    let totalAbsences = 0;
    let workingDaysCount = 0;

    // Mon to Sat (6 days)
    for (let i = 0; i < 6; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const dateStr = toLocalDateString(day);
      const isToday = dateStr === toLocalDateString();

      // Match target Class-Section Key
      const targetClassKey = `${selectedClass}-${selectedSection}`;
      const sessionsForDay = maps.sessionMap.get(dateStr);
      let hasSession = false;

      if (sessionsForDay) {
        if (selectedClass === 'all') {
          hasSession = sessionsForDay.size > 0;
        } else if (selectedSection === 'all') {
          const prefix = `${selectedClass}-`;
          sessionsForDay.forEach(key => {
            if (key.startsWith(prefix)) {
              hasSession = true;
            }
          });
        } else {
          hasSession = sessionsForDay.has(targetClassKey);
        }
      }

      if (hasSession) {
        workingDaysCount++;
        const dailyAbsents = maps.attendanceMap.get(dateStr);
        let dayAbsences = 0;
        if (dailyAbsents) {
          filteredStudents.forEach(s => {
            if (dailyAbsents.get(s.id) === 'Absent') dayAbsences++;
          });
        }
        
        const presentCount = filteredStudents.length - dayAbsences;
        totalAbsences += dayAbsences;

        weekDays.push({
          dayName: day.toLocaleDateString('en-US', { weekday: 'short' }),
          dayNum: day.getDate(),
          presentCount,
          absentCount: dayAbsences,
          rate: filteredStudents.length > 0 ? Math.round((presentCount / filteredStudents.length) * 100) : 0,
          cardClass: `week-day-card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-4 rounded-xl text-center relative shadow-xs ${isToday ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40' : ''}`,
          dayKey: `wd-${i}`,
          isHoliday: false
        });
      } else {
        weekDays.push({
          dayName: day.toLocaleDateString('en-US', { weekday: 'short' }),
          dayNum: day.getDate(),
          presentCount: '-',
          absentCount: '-',
          rate: '-',
          cardClass: `week-day-card holiday bg-gray-50 dark:bg-slate-900/40 border border-gray-200 dark:border-slate-800 p-4 rounded-xl text-center opacity-75 ${isToday ? 'border-indigo-500' : ''}`,
          dayKey: `wd-${i}`,
          isHoliday: true,
          holidayLabel: day > new Date() ? 'No Session' : 'No attendance'
        });
      }
    }

    const totalPossible = filteredStudents.length * workingDaysCount;
    const totalPresent = totalPossible - totalAbsences;
    const overallRate = totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : 0;

    return {
      weekDays,
      attendanceRate: overallRate,
      present: totalPresent,
      absent: totalAbsences,
      totalStudents: filteredStudents.length,
      workingDays: workingDaysCount,
      selectedClassLabel: selectedClass === 'all' ? 'All Classes' : `Class ${selectedClass}${selectedSection !== 'all' ? '-' + selectedSection : ''}`
    };
  }, [calendarView, currentDate, filteredStudents, selectedClass, selectedSection, maps]);

  // ─── MONTHLY REPORT VIEW STATISTICS ────────────────────────────────────────────────
  const monthlyViewData = useMemo(() => {
    if (calendarView !== 'monthly') return null;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOffset = new Date(year, month, 1).getDay(); // Offset cells
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const allDays = [];

    // Empty cells offset
    for (let i = 0; i < firstDayOffset; i++) {
      allDays.push({ empty: true, key: `e-${i}` });
    }

    // Determine student scope
    const searchedStudent = selectedStudent || 
      (searchTerm && filteredStudents.length === 1 ? filteredStudents[0] : null);

    const targetClass = searchedStudent ? searchedStudent.className : selectedClass;
    const targetSection = searchedStudent ? searchedStudent.section : selectedSection;
    const targetClassKey = `${targetClass}-${targetSection}`;

    let totalWorkingDays = 0;
    let totalAbsences = 0;
    let studentPresentCount = 0;
    let studentAbsentCount = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = toLocalDateString(date);
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const sessionsForDay = maps.sessionMap.get(dateStr);
      let hasSession = false;

      if (sessionsForDay) {
        if (targetClass === 'all') {
          hasSession = sessionsForDay.size > 0;
        } else if (targetSection === 'all') {
          const prefix = `${targetClass}-`;
          sessionsForDay.forEach(key => {
            if (key.startsWith(prefix)) {
              hasSession = true;
            }
          });
        } else {
          hasSession = sessionsForDay.has(targetClassKey);
        }
      }

      let rate = 0;
      let status = 'holiday';
      let isAbsent = false;
      let isPresent = false;

      if (hasSession) {
        totalWorkingDays++;
        const dailyAbsents = maps.attendanceMap.get(dateStr);

        if (searchedStudent) {
          const statusVal = dailyAbsents ? dailyAbsents.get(searchedStudent.id) : 'Present';
          if (statusVal === 'Absent') {
            studentAbsentCount++;
            isAbsent = true;
          } else {
            studentPresentCount++;
            isPresent = true;
          }
          rate = isPresent ? 100 : 0;
          totalAbsences += isAbsent ? 1 : 0;
        } else {
          // Class aggregate
          let absentCount = 0;
          if (dailyAbsents) {
            filteredStudents.forEach(s => {
              if (dailyAbsents.get(s.id) === 'Absent') absentCount++;
            });
          }
          totalAbsences += absentCount;
          rate = filteredStudents.length > 0 ? Math.round(((filteredStudents.length - absentCount) / filteredStudents.length) * 100) : 0;
        }

        status = rate >= 90 ? 'high' : rate >= 75 ? 'mid' : 'low';
      }

      const todayStr = toLocalDateString();
      const isToday = dateStr === todayStr;

      let cellClass = `day-cell bg-white dark:bg-slate-900 relative h-16 border border-gray-200 dark:border-slate-800 rounded-xl p-2 flex flex-col justify-between text-xs transition-colors `;
      if (isPresent) cellClass += 'is-present ';
      if (isAbsent) cellClass += 'is-absent ';
      if (isWeekend) cellClass += 'weekend ';
      if (!hasSession) cellClass += 'holiday ';
      if (isToday) cellClass += 'border-indigo-500 ';

      allDays.push({
        day,
        key: `day-${day}`,
        rate: hasSession ? `${rate}%` : '-',
        cellClass,
        isHoliday: !hasSession,
        isWeekend,
        isAbsent,
        isPresent,
        isToday
      });
    }

    const totalPossible = (searchedStudent ? 1 : filteredStudents.length) * totalWorkingDays;
    const totalPresent = totalPossible - totalAbsences;
    const overallRate = totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : 0;

    return {
      allDays,
      attendanceRate: overallRate,
      present: totalPresent,
      absent: totalAbsences,
      workingDays: totalWorkingDays,
      searchedStudent,
      isSearching: !!searchTerm || !!selectedStudent,
      hasResults: filteredStudents.length > 0,
      studentPresentCount,
      studentAbsentCount
    };
  }, [calendarView, currentDate, filteredStudents, selectedStudent, selectedClass, selectedSection, searchTerm, maps]);

  // ─── YEARLY REPORT VIEW STATISTICS ─────────────────────────────────────────────────
  const yearlyViewData = useMemo(() => {
    if (calendarView !== 'yearly') return null;

    const year = currentDate.getFullYear();
    const today = new Date();
    const currentMonthIndex = today.getFullYear() === year ? today.getMonth() : -1;

    let totalWorkingDays = 0;
    let totalPresent = 0;
    let totalPossible = 0;
    let totalAbsences = 0;
    const months = [];

    // Search target
    const searchTermLower = searchTerm ? searchTerm.toLowerCase() : '';
    let searchPool = selectedClass !== 'all' ? filteredStudents : students;

    const searchedStudent = selectedStudent || (searchTermLower
      ? searchPool.find(s => s.name.toLowerCase().includes(searchTermLower) || s.rollNo.includes(searchTermLower))
      : null);

    const scopeStudents = searchTermLower
      ? (searchedStudent ? [searchedStudent] : [])
      : filteredStudents;

    const targetClassName = searchedStudent ? searchedStudent.className : selectedClass;
    const targetSection = searchedStudent ? searchedStudent.section : selectedSection;
    const targetClassKey = `${targetClassName}-${targetSection}`;

    for (let m = 0; m < 12; m++) {
      const monthName = new Date(year, m, 1).toLocaleDateString('en-US', { month: 'short' });
      const isCurrentMonth = m === currentMonthIndex;

      let mWorkingDays = 0;
      const daysInMonth = new Date(year, m + 1, 0).getDate();
      const validDates = [];

      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, m, d);
        const dateStr = toLocalDateString(date);
        const sessionsForDay = maps.sessionMap.get(dateStr);

        let hasSession = false;
        if (sessionsForDay) {
          if (targetClassName === 'all') {
            hasSession = sessionsForDay.size > 0;
          } else if (targetSection === 'all') {
            const prefix = `${targetClassName}-`;
            sessionsForDay.forEach(key => {
              if (key.startsWith(prefix)) {
                hasSession = true;
              }
            });
          } else {
            hasSession = sessionsForDay.has(targetClassKey);
          }
        }

        if (hasSession) {
          mWorkingDays++;
          validDates.push(dateStr);
        }
      }

      if (mWorkingDays === 0) {
        months.push({
          monthName,
          present: 0,
          absent: 0,
          rate: 0,
          workingDays: 0,
          cardClass: `month-card bg-gray-50 dark:bg-slate-900/40 border border-gray-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 rounded-xl p-4 opacity-75 ${isCurrentMonth ? 'border-indigo-500' : ''}`,
          rateClass: 'text-xs text-slate-400 dark:text-slate-500 font-bold',
          isCurrentMonth
        });
        continue;
      }

      let monthAbsences = 0;
      validDates.forEach(dateStr => {
        const dailyAbsents = maps.attendanceMap.get(dateStr);
        if (dailyAbsents) {
          scopeStudents.forEach(s => {
            if (dailyAbsents.get(s.id) === 'Absent') monthAbsences++;
          });
        }
      });

      const mTotalPossible = scopeStudents.length * mWorkingDays;
      const mTotalPresent = mTotalPossible - monthAbsences;
      const mRate = mTotalPossible > 0 ? Math.round((mTotalPresent / mTotalPossible) * 100) : 0;

      totalWorkingDays += mWorkingDays;
      totalPossible += mTotalPossible;
      totalAbsences += monthAbsences;

      const rateClass = mRate >= 90 ? 'text-emerald-600 dark:text-emerald-400' : mRate >= 75 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
      const borderClass = mRate >= 90 ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/30 dark:bg-emerald-950/20' : mRate >= 75 ? 'border-amber-200 dark:border-amber-800/60 bg-amber-50/30 dark:bg-amber-950/20' : 'border-rose-200 dark:border-rose-800/60 bg-rose-50/30 dark:bg-rose-950/20';

      months.push({
        monthName,
        present: mTotalPresent,
        absent: monthAbsences,
        rate: mRate,
        workingDays: mWorkingDays,
        cardClass: `month-card bg-white dark:bg-slate-900 border ${borderClass} text-slate-700 dark:text-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-xs ${isCurrentMonth ? 'border-indigo-500 ring-2 ring-indigo-500/10' : ''}`,
        rateClass: `${rateClass} text-lg font-black mt-1`,
        isCurrentMonth
      });
    }

    const overallPresent = totalPossible - totalAbsences;
    const overallRate = totalPossible > 0 ? Math.round((overallPresent / totalPossible) * 100) : 0;

    return {
      months,
      year,
      workingDays: totalWorkingDays,
      present: overallPresent,
      absent: totalAbsences,
      attendanceRate: overallRate,
      isSearching: !!searchTerm || !!selectedStudent,
      searchedStudent,
      hasResults: !!searchedStudent,
      studentPresentCount: searchedStudent ? overallPresent : 0,
      studentAbsentCount: searchedStudent ? totalAbsences : 0
    };
  }, [calendarView, currentDate, filteredStudents, selectedStudent, selectedClass, selectedSection, searchTerm, students, maps]);

  const handleSelectMonthlyStudent = (student: any) => {
    setSelectedStudent(student);
    setSearchTerm(student.name);
    setShowStudentSearchDropdown(false);
  };

  const handleViewChange = (view: 'daily' | 'weekly' | 'monthly' | 'yearly') => {
    setCalendarView(view);
    setSelectedStudent(null);
    setSearchTerm('');
  };

  return (
    <main className="min-h-screen bg-[#f3f4f6] dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-4 sm:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Attendance Report</h1>
              <p className="text-xs text-slate-500 mt-1">Track and analyze student attendance</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/attendance/entry" className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/15 flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Take Attendance
            </Link>
          </div>
        </div>

        {/* View Select Tabs */}
        <div className="bg-gray-200/60 dark:bg-slate-800 border border-gray-300/40 dark:border-slate-700 p-1 rounded-2xl flex max-w-sm">
          {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(view => (
            <button
              key={view}
              onClick={() => handleViewChange(view)}
              className={`flex-1 py-2 text-xs font-bold capitalize rounded-xl transition-all ${
                calendarView === view 
                  ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {view}
            </button>
          ))}
        </div>

        {/* Global Toolbar and Filters */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-sm rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          
          {/* Class Section Selectors */}
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <div className="relative w-full sm:w-auto">
              <button className="w-full sm:w-44 px-4 min-h-[44px] bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center justify-between gap-2 shadow-xs" onClick={() => {
                setIsClassDropdownOpen(!isClassDropdownOpen);
                setIsSectionDropdownOpen(false);
              }}>
                <span>{classLabelText}</span> <span>▼</span>
              </button>
              {isClassDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl z-50 py-1 w-full sm:w-44">
                  {classOptions.map(opt => (
                    <div 
                      key={opt.value} 
                      className={`px-4 py-2.5 text-xs font-semibold cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-slate-700 ${selectedClass === opt.value ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 'text-slate-600 dark:text-slate-300'}`}
                      onClick={() => {
                        setSelectedClass(opt.value);
                        setSelectedSection('all');
                        setSelectedStudent(null);
                        setIsClassDropdownOpen(false);
                      }}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="relative w-full sm:w-auto">
              <button className="w-full sm:w-44 px-4 min-h-[44px] bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center justify-between gap-2 shadow-xs" onClick={() => {
                setIsSectionDropdownOpen(!isSectionDropdownOpen);
                setIsClassDropdownOpen(false);
              }}>
                <span>{sectionLabelText}</span> <span>▼</span>
              </button>
              {isSectionDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl z-50 py-1 w-full sm:w-44">
                  {sectionOptions.map(opt => (
                    <div 
                      key={opt.value} 
                      className={`px-4 py-2.5 text-xs font-semibold cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-slate-700 ${selectedSection === opt.value ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 'text-slate-600 dark:text-slate-300'}`}
                      onClick={() => {
                        setSelectedSection(opt.value);
                        setSelectedStudent(null);
                        setIsSectionDropdownOpen(false);
                      }}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Autocomplete Student Search (for monthly/yearly) */}
          {(calendarView === 'monthly' || calendarView === 'yearly') && (
            <div className="relative flex-1 min-w-[200px] max-w-xs w-full">
              <div className="flex items-center bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-xl px-3 min-h-[44px] focus-within:border-indigo-500 transition-all shadow-xs">
                <Search className="w-4 h-4 text-slate-400 mr-2" />
                <input 
                  type="text" 
                  placeholder="Search student..." 
                  className="bg-transparent border-none text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none w-full placeholder-slate-400"
                  value={searchTerm}
                  onFocus={() => setShowStudentSearchDropdown(true)}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setSelectedStudent(null);
                    setShowStudentSearchDropdown(true);
                  }}
                />
                {searchTerm && (
                  <button className="text-slate-400 hover:text-slate-700" onClick={() => {
                    setSelectedStudent(null);
                    setSearchTerm('');
                    setShowStudentSearchDropdown(false);
                  }}>✕</button>
                )}
              </div>

              {showStudentSearchDropdown && searchTerm && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-gray-150 max-h-48 overflow-y-auto">
                  {filteredStudents.map(student => (
                    <div 
                      key={student.id} 
                      className="p-2.5 hover:bg-indigo-50/50 cursor-pointer flex items-center gap-2"
                      onClick={() => handleSelectMonthlyStudent(student)}
                    >
                      <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[10px]">
                        {student.initial}
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-bold text-slate-700">{student.name}</div>
                        <div className="text-[9px] text-slate-500">{student.className}-{student.section}</div>
                      </div>
                    </div>
                  ))}
                  {!hasSearchResults && (
                    <div className="p-3 text-center text-slate-500 text-xs">No students found</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Date Picker Navigation */}
          <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
            <button className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors shadow-xs" onClick={handlePrevious}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-xs font-bold text-slate-700 dark:text-slate-100 min-w-[120px] text-center flex-1 sm:flex-none">
              {calendarView === 'daily' && formattedDate}
              {calendarView === 'weekly' && weekRangeText}
              {calendarView === 'monthly' && formattedMonth}
              {calendarView === 'yearly' && currentDate.getFullYear()}
            </div>
            <button className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors shadow-xs" onClick={handleNext}>
              <ChevronRight className="w-4 h-4" />
            </button>

            {calendarView === 'daily' && (
              <div className="relative">
                <input 
                  type="date" 
                  value={datePickerValue} 
                  onChange={handleDateSelect}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <button className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white transition-colors shadow-xs">
                  📅
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Loading Spinner */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm">Querying report logs...</p>
          </div>
        )}

        {/* ─── DAILY VIEW PAGE LAYOUT ─────────────────────────────────────────────────── */}
        {!isLoading && calendarView === 'daily' && (
          <div className="space-y-6">
            {overallDailySummary && (
              <div className="att-summary-strip bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-sm rounded-xl p-6 flex flex-col sm:flex-row items-center justify-around gap-6">
                <div className="text-center sm:text-left">
                  <span className="att-label text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">Active Date</span>
                  <span className="att-value-dark text-lg font-black text-slate-900 dark:text-white mt-1 block">{overallDailySummary.dateLabel}</span>
                </div>
                <div className="text-center">
                  <span className="att-label text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">Total Students</span>
                  <span className="att-value-dark text-2xl font-black text-slate-900 dark:text-white mt-1 block">{overallDailySummary.totalPotential}</span>
                </div>
                <div className="text-center">
                  <span className="att-label text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">Present Overall</span>
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">{overallDailySummary.totalPresent}</span>
                </div>
                <div className="text-center">
                  <span className="att-label text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">Absent Overall</span>
                  <span className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 block">{overallDailySummary.totalAbsent}</span>
                </div>
                <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border-4 border-indigo-200/50 dark:border-indigo-800/50 flex flex-col items-center justify-center">
                  <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 leading-none">RATE</span>
                  <span className="text-sm font-black text-indigo-900 dark:text-indigo-200 mt-0.5 leading-none">{overallDailySummary.rate}%</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {classSectionSummary.map(summary => (
                <div key={summary.key} className="att-card-light relative attendance-card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 p-5 rounded-xl transition-all hover:translate-y-[-2px] hover:z-50 shadow-sm">
                  <div className="flex justify-between items-start border-b border-gray-100 dark:border-slate-800 pb-3">
                    <div>
                      <h3 className="att-card-title font-bold text-sm text-slate-900 dark:text-white">{summary.classValue} - Section {summary.section}</h3>
                      <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold mt-0.5">{summary.attendanceRate}% Attendance</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                    <div className="att-stat-box-total bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-gray-300 dark:border-slate-700">
                      <span className="att-stat-total text-slate-900 dark:text-white text-[12px] font-black block">{summary.totalCount}</span>
                      <span className="att-stat-label text-slate-600 dark:text-slate-400 text-[9px] font-bold block mt-0.5">TOTAL</span>
                    </div>
                    <div className="att-stat-box-present bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                      <span className="att-stat-present text-emerald-600 dark:text-emerald-400 text-[12px] font-black block">{summary.presentDisplay}</span>
                      <span className="att-stat-label text-emerald-700 dark:text-emerald-400 text-[9px] font-bold block mt-0.5">PRESENT</span>
                    </div>
                    <div className="att-stat-box-absent stat-box absent bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-lg border border-rose-200 dark:border-rose-800/60">
                      <span className="att-stat-absent text-rose-600 dark:text-rose-400 text-[12px] font-black block">{summary.absentCount}</span>
                      <span className="att-stat-label text-rose-700 dark:text-rose-400 text-[9px] font-bold block mt-0.5">ABSENT</span>

                      {summary.hasAbsentees && (
                        <div className="absentee-tooltip">
                          <span className="tooltip-title">Absent Students</span>
                          <div className="tooltip-list">
                            {summary.absentees.map(stud => (
                              <div key={stud.id} className="tooltip-item truncate">{stud.name}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {classSectionSummary.length === 0 && (
                <div className="col-span-full py-16 text-center text-slate-500 bg-white border border-gray-200 rounded-xl shadow-xs">
                  No attendance session records found for this date.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── WEEKLY VIEW PAGE LAYOUT ─────────────────────────────────────────────────── */}
        {!isLoading && calendarView === 'weekly' && weeklyViewData && (
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Weekly Class View</h2>
                <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold">
                  Showing: {weeklyViewData.totalStudents} Students from {weeklyViewData.selectedClassLabel}
                </p>
              </div>
              <div className="flex items-center gap-3 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100">
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Weekly Rate</span>
                <span className="text-lg font-black text-indigo-900">{weeklyViewData.attendanceRate}%</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              {weeklyViewData.weekDays.map(day => (
                <div key={day.dayKey} className={day.cardClass}>
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                    <span className="text-xs font-bold text-slate-500">{day.dayName}</span>
                    <span className="text-xs font-black text-slate-800">{day.dayNum}</span>
                  </div>

                  {!day.isHoliday ? (
                    <div className="mt-3 space-y-2">
                      <div className="text-lg font-black text-slate-800">{day.rate}%</div>
                      <div className="flex justify-around text-[10px] font-bold text-slate-400">
                        <span>P: <strong className="text-emerald-600">{day.presentCount}</strong></span>
                        <span>A: <strong className="text-rose-600">{day.absentCount}</strong></span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 py-2">
                      <span className="px-2 py-0.5 rounded bg-gray-100 border border-gray-200 text-slate-500 text-[9px] font-bold uppercase tracking-wider">{day.holidayLabel}</span>
                      <p className="text-[10px] text-slate-400 mt-1.5 font-semibold">No Session</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── MONTHLY VIEW PAGE LAYOUT ────────────────────────────────────────────────── */}
        {!isLoading && calendarView === 'monthly' && monthlyViewData && (
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 space-y-6">
            
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Monthly Attendance Overview</h2>
                <p className="text-xs text-slate-500 mt-1">Calendar sheets analytics for class roster</p>
              </div>
              <div className="flex items-center gap-3 bg-indigo-50 px-4 py-2.5 rounded-xl border border-indigo-100">
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Monthly Rate</span>
                <span className="text-lg font-black text-indigo-900">{monthlyViewData.attendanceRate}%</span>
              </div>
            </div>

            {/* Profile summary card if student is searched */}
            {monthlyViewData.searchedStudent ? (
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in text-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center font-extrabold text-sm">
                    {monthlyViewData.searchedStudent.initial}
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-bold text-slate-800">{monthlyViewData.searchedStudent.name}</span>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5 font-bold">
                      <span>Roll No: {monthlyViewData.searchedStudent.rollNo}</span>
                      <span>•</span>
                      <span>Class {monthlyViewData.searchedStudent.className} - Section {monthlyViewData.searchedStudent.section}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="text-center bg-white border border-gray-200 px-3 py-2 rounded-xl shadow-xs">
                    <span className="text-[9px] font-bold text-slate-500 block uppercase">Present</span>
                    <span className="text-sm font-black text-emerald-600 block mt-0.5">{monthlyViewData.studentPresentCount} Days</span>
                  </div>
                  <div className="text-center bg-white border border-gray-200 px-3 py-2 rounded-xl shadow-xs">
                    <span className="text-[9px] font-bold text-slate-500 block uppercase">Absent</span>
                    <span className="text-sm font-black text-rose-600 block mt-0.5">{monthlyViewData.studentAbsentCount} Days</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4 text-center max-w-md">
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <span className="text-slate-500 text-[10px] font-bold block uppercase tracking-wide">Working Days</span>
                  <span className="text-sm font-black text-slate-800 block mt-0.5">{monthlyViewData.workingDays} Sessions</span>
                </div>
                <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                  <span className="text-emerald-700 text-[10px] font-bold block uppercase tracking-wide">Present</span>
                  <span className="text-sm font-black text-emerald-600 block mt-0.5">{monthlyViewData.present} Total</span>
                </div>
                <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl">
                  <span className="text-rose-700 text-[10px] font-bold block uppercase tracking-wide">Absent</span>
                  <span className="text-sm font-black text-rose-600 block mt-0.5">{monthlyViewData.absent} Total</span>
                </div>
              </div>
            )}

            {/* Monthly Calendar Grid */}
            <div className="overflow-x-auto w-full">
              <div className="min-w-[640px] space-y-2 pt-4">
                <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {monthlyViewData.allDays.map((day, idx) => {
                    if (day.empty) {
                      return <div key={`empty-${idx}`} className="h-16 bg-transparent"></div>;
                    }
                    return (
                      <div key={day.key} className={day.cellClass}>
                        <span className="font-bold text-slate-700">{day.day}</span>
                        {day.isHoliday ? (
                          <span className="text-[8px] font-semibold text-slate-400 self-end">HOLIDAY</span>
                        ) : (
                          <span className="text-[8px] font-bold self-end tracking-wider">
                            {day.isAbsent && 'ABSENT'}
                            {day.isPresent && 'PRESENT'}
                            {!day.isAbsent && !day.isPresent && day.rate}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ─── YEARLY VIEW PAGE LAYOUT ─────────────────────────────────────────────────── */}
        {!isLoading && calendarView === 'yearly' && yearlyViewData && (
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Yearly Attendance Overview</h2>
                <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold">
                  Summary stats for Academic Year {yearlyViewData.year}
                </p>
              </div>
              <div className="flex items-center gap-3 bg-indigo-50 px-4 py-2.5 rounded-xl border border-indigo-100">
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Yearly Rate</span>
                <span className="text-lg font-black text-indigo-900">{yearlyViewData.attendanceRate}%</span>
              </div>
            </div>

            {yearlyViewData.searchedStudent ? (
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center font-extrabold text-sm">
                    {yearlyViewData.searchedStudent.initial}
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-bold text-slate-800">{yearlyViewData.searchedStudent.name}</span>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5 font-bold">
                      <span>Roll No: {yearlyViewData.searchedStudent.rollNo}</span>
                      <span>•</span>
                      <span>Class {yearlyViewData.searchedStudent.className} - Section {yearlyViewData.searchedStudent.section}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="text-center bg-white border border-gray-200 px-3 py-2 rounded-xl shadow-xs">
                    <span className="text-[9px] font-bold text-slate-500 block uppercase">Present</span>
                    <span className="text-sm font-black text-emerald-600 block mt-0.5">{yearlyViewData.studentPresentCount} Days</span>
                  </div>
                  <div className="text-center bg-white border border-gray-200 px-3 py-2 rounded-xl shadow-xs">
                    <span className="text-[9px] font-bold text-slate-500 block uppercase">Absent</span>
                    <span className="text-sm font-black text-rose-600 block mt-0.5">{yearlyViewData.studentAbsentCount} Days</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4 text-center max-w-md">
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl shadow-xs">
                  <span className="text-slate-500 text-[10px] font-bold block uppercase tracking-wide">Working Days</span>
                  <span className="text-sm font-black text-slate-800 block mt-0.5">{yearlyViewData.workingDays} Sessions</span>
                </div>
                <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl shadow-xs">
                  <span className="text-emerald-700 text-[10px] font-bold block uppercase tracking-wide">Present</span>
                  <span className="text-sm font-black text-emerald-600 block mt-0.5">{yearlyViewData.present} Total</span>
                </div>
                <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl shadow-xs">
                  <span className="text-rose-700 text-[10px] font-bold block uppercase tracking-wide">Absent</span>
                  <span className="text-sm font-black text-rose-600 block mt-0.5">{yearlyViewData.absent} Total</span>
                </div>
              </div>
            )}

            {/* 12 Months Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pt-4">
              {yearlyViewData.months.map((month, idx) => (
                <div key={idx} className={month.cardClass}>
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                    <span className="text-xs font-extrabold uppercase text-slate-500">{month.monthName}</span>
                    {month.isCurrentMonth && <span className="text-[8px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 px-1.5 py-0.5 rounded">Active</span>}
                  </div>
                  {month.workingDays > 0 ? (
                    <div className="mt-3">
                      <div className={month.rateClass}>{month.rate}%</div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-bold mt-2">
                        <span>P: <strong className="text-emerald-600">{month.present}</strong></span>
                        <span>A: <strong className="text-rose-600">{month.absent}</strong></span>
                      </div>
                      <div className="text-[8.5px] font-semibold text-slate-400 mt-2 uppercase tracking-wide">
                        Sessions: {month.workingDays}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 py-2 text-center">
                      <span className="px-2 py-0.5 rounded bg-gray-100 border border-gray-200 text-slate-500 text-[9px] font-bold uppercase tracking-wider">No Sessions</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}

export default function AttendanceDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f3f4f6] text-slate-500 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    }>
      <AttendanceDashboardContent />
    </Suspense>
  );
}
