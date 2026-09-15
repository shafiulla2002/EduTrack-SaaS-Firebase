'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Clock, Calendar, Plus, Filter, BookOpen, 
  Trash2, Edit3, CheckCircle, AlertTriangle, 
  ArrowLeftRight, UserCheck, RefreshCw, Upload,
  Users, BarChart3, Layers, Settings, X
} from 'lucide-react';
import { api, fastGet } from '@/lib/api';
import { dispatchSchoolSetupUpdated } from '@/lib/events';

type ClassSection = {
  Id: string;
  Name: string;
  className: string;
  sectionName: string;
  classId: string;
};

type Teacher = {
  Id: string;
  Name: string;
};

type Subject = {
  id: string;
  name: string;
};

type Timing = {
  id?: string;
  num: number;
  label: string;
  startTime: string;
  endTime: string;
  timeLabel?: string;
  isBreak?: boolean;
};

type TeacherWorkload = {
  teacherId: string;
  teacherName: string;
  subjectCount: number;
  classCount: number;
  totalPeriods: number;
  loadPercent: number;
};

type ClassWorkload = {
  classSectionId: string;
  name: string;
  academicYear: string;
  subjectCount: number;
  staffedCount: number;
  loadPercent: number;
};

export default function TimetablePage() {
  const [activeTab, setActiveTab] = useState<'grid' | 'sections' | 'teachers' | 'subjects'>('grid');
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [classSections, setClassSections] = useState<ClassSection[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [timings, setTimings] = useState<Timing[]>([]);

  // Selected filters for grid
  const [selectedClassSectionId, setSelectedClassSectionId] = useState('');
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState('');
  const [timetableData, setTimetableData] = useState<Record<string, any>>({});
  const [classSectionSubjects, setClassSectionSubjects] = useState<Subject[]>([]);

  // Load subjects for selected class section
  useEffect(() => {
    if (selectedClassSectionId) {
      const loadSubjects = async () => {
        try {
          const res = await api.get(`/timetable/class-sections/${selectedClassSectionId}/subjects`);
          const mapped = (res.data || []).map((s: any) => ({
            id: s.subjectId,
            name: s.subjectName,
          }));
          setClassSectionSubjects(mapped);
        } catch (err) {
          console.error('Error loading class section subjects', err);
        }
      };
      loadSubjects();
    } else {
      setClassSectionSubjects([]);
    }
  }, [selectedClassSectionId]);

  
  // Workload and summary data
  const [workloadSummary, setWorkloadSummary] = useState<any>(null);
  const [teacherWorkloads, setTeacherWorkloads] = useState<TeacherWorkload[]>([]);
  const [classWorkloads, setClassWorkloads] = useState<ClassWorkload[]>([]);

  // Modals and form states
  const [editingCell, setEditingCell] = useState<{ day: string; num: number } | null>(null);
  const [substituteCell, setSubstituteCell] = useState<{ day: string; num: number; periodId: string } | null>(null);
  const [cellSubjectId, setCellSubjectId] = useState('');
  const [cellTeacherId, setCellTeacherId] = useState('');
  const [cellSubTeacherId, setCellSubTeacherId] = useState('');
  const [cellTeachersOptions, setCellTeachersOptions] = useState<any[]>([]);

  // Class Section Setup Form
  const [setupClassId, setSetupClassId] = useState('');
  const [setupSectionId, setSetupSectionId] = useState('');
  const [setupStrength, setSetupStrength] = useState(40);
  const [setupSubjects, setSetupSubjects] = useState<{ subjectId: string; teacherId: string; periods: number }[]>([
    { subjectId: '', teacherId: '', periods: 5 }
  ]);

  // Timing inputs
  const [timingInputs, setTimingInputs] = useState<Timing[]>([]);

  // Subject inputs
  const [newSubName, setNewSubName] = useState('');
  const [bulkSubText, setBulkSubText] = useState('');

  // Teacher inputs
  const [newTeacher, setNewTeacher] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    qualification: '',
    designation: '',
    basicSalary: 0,
    allowances: 0,
    deductions: 0,
    pfDeduction: 0,
    employeeId: '',
    staffStatus: 'Active',
    skills: [{ subjectId: '', skillLevel: 'Expert', yearsOfExperience: 2 }]
  });
  const [bulkTeacherText, setBulkTeacherText] = useState('');

  // Notifications
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showAlert = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message });
    if (type === 'success') {
      dispatchSchoolSetupUpdated();
    }
    setTimeout(() => setAlert(null), 5000);
  };

  // Fetch initial configuration data
  useEffect(() => {
    fetchMetadata();
  }, []);

  const fetchMetadata = async () => {
    try {
      // Fetch all reference data in parallel with caching
      const [ayRes, cRes, sRes, csRes, tRes, subRes, ptRes] = await Promise.all([
        fastGet('/timetable/academic-years', undefined, { ttlMs: 60000 }),
        fastGet('/timetable/classes', undefined, { ttlMs: 60000 }),
        fastGet('/timetable/sections', undefined, { ttlMs: 60000 }),
        fastGet('/timetable/class-sections', undefined, { ttlMs: 60000 }),
        fastGet('/timetable/teachers', undefined, { ttlMs: 60000 }),
        fastGet('/timetable/subjects', undefined, { ttlMs: 60000 }),
        fastGet('/timetable/period-timings', undefined, { ttlMs: 60000 }),
      ]);

      // Academic Years
      setAcademicYears(ayRes.data);
      if (ayRes.data.length > 0) setSelectedAcademicYearId(ayRes.data[0].id);

      // Classes
      setClasses(cRes.data);

      // Sections
      setSections(sRes.data);

      // Class Sections
      const mappedClassSections = (csRes.data || []).map((cs: any) => ({
        Id: cs.id,
        Name: cs.class && cs.section ? `${cs.class.name} - ${cs.section.name}` : cs.id,
        className: cs.class?.name || '',
        sectionName: cs.section?.name || '',
        classId: cs.classId
      }));
      setClassSections(mappedClassSections);
      if (mappedClassSections.length > 0) setSelectedClassSectionId(mappedClassSections[0].Id);

      // Teachers
      const mappedTeachers = (tRes.data || []).map((t: any) => ({
        Id: t.id,
        Name: `${t.firstName || ''} ${t.lastName || ''}`.trim()
      }));
      setTeachers(mappedTeachers);

      // Subjects
      setSubjects(subRes.data);

      // Period Timings
      const rawTimings = ptRes.data || [];
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
          id: pt.id,
          num: pt.periodNumber ?? pt.num,
          label: displayLabel,
          displayPeriodNumber: displayNum,
          startTime: pt.startTime,
          endTime: pt.endTime,
          timeLabel: `${pt.startTime} - ${pt.endTime}`,
          isBreak
        };
      });

      setTimings(mappedTimings);
      setTimingInputs(mappedTimings.length > 0 ? mappedTimings : [
        { num: 1, label: 'Period 1', startTime: '08:30 AM', endTime: '09:30 AM', isBreak: false },
        { num: 2, label: 'Period 2', startTime: '09:30 AM', endTime: '10:30 AM', isBreak: false },
        { num: 3, label: 'Period 3', startTime: '10:45 AM', endTime: '11:45 AM', isBreak: false },
        { num: 4, label: 'Period 4', startTime: '11:45 AM', endTime: '12:45 PM', isBreak: false },
        { num: 5, label: 'Period 5', startTime: '01:30 PM', endTime: '02:30 PM', isBreak: false },
        { num: 6, label: 'Period 6', startTime: '02:30 PM', endTime: '03:30 PM', isBreak: false }
      ]);

      // Workloads
      fetchWorkloads();
    } catch (err) {
      console.error('Error fetching metadata:', err);
    }
  };

  const fetchWorkloads = async () => {
    try {
      const [summaryRes, tWorkRes, cWorkRes] = await Promise.all([
        fastGet('/timetable/workload/summary', undefined, { ttlMs: 30000 }),
        fastGet('/timetable/workload/teachers', undefined, { ttlMs: 30000 }),
        fastGet('/timetable/workload/classes', undefined, { ttlMs: 30000 }),
      ]);
      setWorkloadSummary(summaryRes.data);
      setTeacherWorkloads(tWorkRes.data);
      setClassWorkloads(cWorkRes.data);
    } catch (err) {
      console.error('Error fetching workloads:', err);
    }
  };

  // Load Timetable Grid when filter changes
  useEffect(() => {
    if (selectedClassSectionId && selectedAcademicYearId) {
      fetchTimetableGrid();
    }
  }, [selectedClassSectionId, selectedAcademicYearId]);

  const fetchTimetableGrid = async () => {
    try {
      const res = await api.get(`/timetable/class/${selectedClassSectionId}/periods?academicYearId=${selectedAcademicYearId}`);
      setTimetableData(res.data);
    } catch (err) {
      console.error('Error loading timetable grid:', err);
    }
  };

  // Timetable saving
  const handleSaveTimetable = async () => {
    try {
      const cells = [];
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      for (const day of days) {
        for (const t of timings) {
          const key = `${day}_${t.id}`;
          const cell = timetableData[key];
          if (cell && cell.subjectId && cell.teacherId) {
            cells.push({
              day,
              periodNumber: t.num,
              subjectId: cell.subjectId,
              teacherId: cell.teacherId,
              startTime: t.startTime,
              endTime: t.endTime
            });
          }
        }
      }

      await api.post('/timetable/periods/save', {
        classSectionId: selectedClassSectionId,
        academicYearId: selectedAcademicYearId,
        periods: cells
      });

      showAlert('success', 'Timetable grid saved successfully!');
      fetchTimetableGrid();
      fetchWorkloads();
    } catch (err: any) {
      showAlert('error', err.response?.data?.message || 'Failed to save timetable grid.');
    }
  };

  // Edit cell modal opening
  const handleOpenEditCell = async (day: string, num: number, timingId: string) => {
    setEditingCell({ day, num });
    const key = `${day}_${timingId}`;
    const cell = timetableData[key];
    setCellSubjectId(cell?.subjectId || '');
    setCellTeacherId(cell?.teacherId || '');
    setCellTeachersOptions([]);

    if (cell?.subjectId) {
      fetchTeachersForSubject(cell.subjectId);
    }
  };

  const fetchTeachersForSubject = async (subId: string) => {
    try {
      const endpoint = `/timetable/teachers/subject-in-class?subjectId=${subId}&classSectionId=${selectedClassSectionId}`;
      const res = await api.get(endpoint);
      const mapped = (res.data || []).map((t: any) => ({
        Id: t.teacherId,
        Name: t.teacherName,
        Teacher_Skill__c: ''
      }));
      setCellTeachersOptions(mapped);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCellSubjectChange = (subId: string) => {
    setCellSubjectId(subId);
    setCellTeacherId('');
    setCellTeachersOptions([]);
    if (subId) {
      fetchTeachersForSubject(subId);
    }
  };

  const handleSaveCell = (timingId: string) => {
    if (!editingCell) return;
    const key = `${editingCell.day}_${timingId}`;
    
    const newGrid = { ...timetableData };
    if (!cellSubjectId || !cellTeacherId) {
      delete newGrid[key];
    } else {
      newGrid[key] = {
        subjectId: cellSubjectId,
        teacherId: cellTeacherId,
        subjectName: subjects.find(s => s.id === cellSubjectId)?.name || '',
        teacherName: teachers.find(t => t.Id === cellTeacherId)?.Name || ''
      };
    }
    setTimetableData(newGrid);
    setEditingCell(null);
  };

  // Leave substitution management
  const handleOpenSubstitute = (day: string, num: number, timingId: string) => {
    const key = `${day}_${timingId}`;
    const cell = timetableData[key];
    if (!cell || !cell.periodId) {
      showAlert('error', 'Please save the timetable grid before assigning substitutes.');
      return;
    }
    setSubstituteCell({ day, num, periodId: cell.periodId });
    setCellSubTeacherId(cell.substituteTeacherId || '');
  };

  const handleSaveSubstitute = async () => {
    if (!substituteCell) return;
    try {
      await api.post('/timetable/periods/substitute', {
        periodId: substituteCell.periodId,
        substituteTeacherId: cellSubTeacherId
      });

      showAlert('success', 'Substitute teacher updated successfully!');
      setSubstituteCell(null);
      fetchTimetableGrid();
    } catch (err) {
      showAlert('error', 'Failed to update substitute.');
    }
  };

  // Add timing slot helper
  const handleAddTimingInput = () => {
    const nextNum = timingInputs.length + 1;
    setTimingInputs([...timingInputs, {
      num: nextNum,
      label: `Period ${nextNum}`,
      startTime: '',
      endTime: ''
    }]);
  };

  const handleSavePeriodTimings = async () => {
    try {
      const payload = timingInputs.map(t => ({
        id: t.id,
        periodNumber: t.num,
        name: t.isBreak ? (t.label === `Period ${t.num}` ? 'Break' : t.label) : (t.label || `P${t.num}`),
        startTime: t.startTime,
        endTime: t.endTime,
        isBreak: t.isBreak ?? false
      }));
      await api.post('/timetable/period-timings', payload);
      showAlert('success', 'Period timings configured successfully!');
      fetchMetadata();
    } catch (err) {
      showAlert('error', 'Failed to save period timings.');
    }
  };

  // Single Class creation
  const handleCreateClass = async (name: string) => {
    if (!name) return;
    try {
      await api.post('/timetable/classes', { name });
      showAlert('success', 'Class created!');
      fetchMetadata();
    } catch (err) {
      showAlert('error', 'Duplicate class name or execution error.');
    }
  };

  // Single Section creation
  const handleCreateSection = async (name: string) => {
    if (!name) return;
    try {
      await api.post('/timetable/sections', { name });
      showAlert('success', 'Section created!');
      fetchMetadata();
    } catch (err) {
      showAlert('error', 'Duplicate section name.');
    }
  };

  // Create Class Section Setup
  const handleClassSectionSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupClassId || !setupSectionId) {
      showAlert('error', 'Please select a Class and Section.');
      return;
    }

    const subTeacherMap: Record<string, string[]> = {};
    const subPeriodsMap: Record<string, number[]> = {};

    for (const item of setupSubjects) {
      if (item.subjectId && item.teacherId) {
        if (!subTeacherMap[item.subjectId]) {
          subTeacherMap[item.subjectId] = [];
          subPeriodsMap[item.subjectId] = [];
        }
        subTeacherMap[item.subjectId].push(item.teacherId);
        subPeriodsMap[item.subjectId].push(item.periods);
      }
    }

    try {
      await api.post('/timetable/class-sections', {
        academicYearId: selectedAcademicYearId,
        classId: setupClassId,
        sectionId: setupSectionId,
        classStrength: setupStrength,
        subjectTeacherMap: subTeacherMap,
        subjectPeriodsMap: subPeriodsMap
      });

      showAlert('success', 'Class section set up successfully!');
      setSetupClassId('');
      setSetupSectionId('');
      setSetupStrength(40);
      setSetupSubjects([{ subjectId: '', teacherId: '', periods: 5 }]);
      fetchMetadata();
    } catch (err: any) {
      showAlert('error', err.response?.data?.message || 'Failed to save setup.');
    }
  };

  // Add Subject row in setup
  const handleAddSetupSubjectRow = () => {
    setSetupSubjects([...setupSubjects, { subjectId: '', teacherId: '', periods: 5 }]);
  };

  // Create single subject
  const handleCreateSubject = async () => {
    if (!newSubName) return;
    try {
      await api.post('/timetable/subjects', { name: newSubName });
      showAlert('success', 'Subject created!');
      setNewSubName('');
      fetchMetadata();
    } catch (err) {
      showAlert('error', 'Subject already exists.');
    }
  };

  // Bulk subjects create
  const handleBulkSubjects = async () => {
    if (!bulkSubText) return;
    const items = bulkSubText.split('\n').map(l => l.trim()).filter(Boolean).map(name => ({ name }));
    try {
      const res = await api.post('/timetable/subjects/bulk', { subjects: items });
      showAlert('success', `Bulk process: Created ${res.data.created}, Skipped ${res.data.skipped}.`);
      setBulkSubText('');
      fetchMetadata();
    } catch (err) {
      showAlert('error', 'Failed to process bulk list.');
    }
  };

  // Create single teacher
  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/timetable/teachers', newTeacher);
      showAlert('success', 'Teacher created successfully!');
      setNewTeacher({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        qualification: '',
        designation: '',
        basicSalary: 0,
        allowances: 0,
        deductions: 0,
        pfDeduction: 0,
        employeeId: '',
        staffStatus: 'Active',
        skills: [{ subjectId: '', skillLevel: 'Expert', yearsOfExperience: 2 }]
      });
      fetchMetadata();
    } catch (err: any) {
      showAlert('error', err.response?.data?.message || 'Failed to create teacher.');
    }
  };

  // Bulk teachers import
  const handleBulkTeachers = async () => {
    if (!bulkTeacherText) return;
    try {
      const lines = bulkTeacherText.split('\n').map(l => l.trim()).filter(Boolean);
      const headers = lines[0].split(',').map(h => h.trim());
      const dataRows = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const rowObj: any = {};
        headers.forEach((h, idx) => {
          rowObj[h] = values[idx] || '';
        });
        if (rowObj.basicSalary) rowObj.basicSalary = Number(rowObj.basicSalary);
        if (rowObj.da) rowObj.da = Number(rowObj.da);
        if (rowObj.hra) rowObj.hra = Number(rowObj.hra);
        if (rowObj.pf) rowObj.pf = Number(rowObj.pf);
        dataRows.push(rowObj);
      }

      const res = await api.post('/timetable/teachers/bulk', { teachers: dataRows });
      showAlert('success', `Bulk imported: Created ${res.data.created}, Skipped ${res.data.skipped}, Skills added ${res.data.skillsCreated}.`);
      setBulkTeacherText('');
      fetchMetadata();
    } catch (err) {
      showAlert('error', 'Bulk teachers format error.');
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Alert Component */}
      {alert && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-2xl transition-all duration-300 ${
          alert.type === 'success' ? 'bg-emerald-950/80 border border-emerald-500 text-emerald-200' : 'bg-rose-950/80 border border-rose-500 text-rose-200'
        } backdrop-blur-md`}>
          <div className="flex items-center gap-2">
            <span className="font-bold">{alert.type === 'success' ? '✓' : '⚠'}</span>
            <p>{alert.message}</p>
          </div>
        </div>
      )}

      {/* Hero Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Timetable & Scheduler
          </h1>
          <p className="text-slate-400 text-sm font-light mt-1 max-w-xl">
            Configure periods, assign teaching assignments, plan substitutions, and monitor workload balances dynamically.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="px-4 py-2 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-all">
            Back to Dashboard
          </Link>
          <button onClick={fetchMetadata} className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-brand-500/10 transition-all flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Setup
          </button>
        </div>
      </header>

      {/* Workload Widgets */}
      {workloadSummary && (
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/10 flex flex-col justify-between">
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-blue-500" /> Active Class Sections</span>
            <span className="text-3xl font-bold mt-2 text-white">{workloadSummary.totalClassSections}</span>
          </div>
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/10 flex flex-col justify-between">
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-emerald-500" /> Teachers Engaged</span>
            <span className="text-3xl font-bold mt-2 text-white">{workloadSummary.totalTeachers}</span>
          </div>
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/10 flex flex-col justify-between">
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5 text-purple-500" /> Total Subject Staffings</span>
            <span className="text-3xl font-bold mt-2 text-white">{workloadSummary.totalAssignments}</span>
          </div>
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/10 flex flex-col justify-between">
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5 text-amber-500" /> Average Teacher Load</span>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-3xl font-bold text-white">{workloadSummary.avgLoadPercent}%</span>
              <div className="w-full bg-slate-800 rounded-full h-2">
                <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${workloadSummary.avgLoadPercent}%` }}></div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Tabs */}
      <nav className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('grid')}
          className={`py-3 px-6 font-semibold border-b-2 text-sm transition-all ${
            activeTab === 'grid' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Timetable Grid
        </button>
        <button
          onClick={() => setActiveTab('sections')}
          className={`py-3 px-6 font-semibold border-b-2 text-sm transition-all ${
            activeTab === 'sections' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Class Section Setup
        </button>
        <button
          onClick={() => setActiveTab('teachers')}
          className={`py-3 px-6 font-semibold border-b-2 text-sm transition-all ${
            activeTab === 'teachers' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Teacher Management
        </button>
        <button
          onClick={() => setActiveTab('subjects')}
          className={`py-3 px-6 font-semibold border-b-2 text-sm transition-all ${
            activeTab === 'subjects' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Subjects & Timings
        </button>
      </nav>

      {/* Main Tab Contents */}
      <main className="mb-12">
        {activeTab === 'grid' && (
          <div className="flex flex-col gap-6 animate-in">
            {/* Filters panel */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-950/20 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
                <div className="flex flex-col w-full sm:w-auto">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Class Section</label>
                  <select
                    value={selectedClassSectionId}
                    onChange={(e) => setSelectedClassSectionId(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 w-full sm:min-w-[200px] outline-none focus:border-brand-500"
                  >
                    <option value="">Select Class Section</option>
                    {classSections.map((cs) => (
                      <option key={cs.Id} value={cs.Id}>{cs.Name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col w-full sm:w-auto">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Academic Year</label>
                  <select
                    value={selectedAcademicYearId}
                    onChange={(e) => setSelectedAcademicYearId(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 w-full sm:min-w-[150px] outline-none focus:border-brand-500"
                  >
                    {academicYears.map((ay) => (
                      <option key={ay.id} value={ay.id}>{ay.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="w-full sm:w-auto">
                <button
                  onClick={handleSaveTimetable}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg transition-transform hover:scale-[1.02] min-h-[44px]"
                >
                  Save Timetable
                </button>
              </div>
            </div>

            {/* Grid display */}
            <div className="glass-panel rounded-2xl border border-slate-800 bg-slate-950/20 overflow-x-auto p-4">
              <table className="w-full border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-slate-850 text-left bg-slate-900/20">
                    <th className="p-3 text-[10px] uppercase text-slate-400 font-bold w-[120px]">Day</th>
                    {timings.map((t) => (
                      <th key={t.id} className="p-3 text-[10px] uppercase text-slate-400 font-bold min-w-[150px] text-center border-l border-slate-900">
                        <div>{t.label}</div>
                        <div className="text-[9px] text-slate-500 font-normal mt-0.5">{t.timeLabel}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
                    <tr key={day} className="border-b border-slate-900/60 hover:bg-slate-900/10 bg-slate-950/5">
                      <td className="p-3 font-semibold text-slate-300 text-xs bg-slate-950/20">{day}</td>
                      {timings.map((t) => {
                        const key = `${day}_${t.id}`;
                        const cell = timetableData[key];
                        return (
                          <td key={t.id} className="p-2 border-l border-slate-900">
                            {t.isBreak ? (
                              <div className="w-full p-4 rounded-xl border border-dashed border-slate-850 bg-slate-900/5 text-[10px] text-slate-500 italic font-semibold text-center flex flex-col justify-center min-h-[90px]">
                                {t.label}
                              </div>
                            ) : cell ? (
                              <div className={`p-3 rounded-xl border text-xs flex flex-col justify-between min-h-[90px] relative transition-all group ${
                                cell.isOnLeave 
                                  ? 'bg-rose-950/30 border-rose-500/20 text-rose-200' 
                                  : 'bg-indigo-950/20 border-indigo-500/10 text-indigo-200 hover:border-indigo-500/30'
                              }`}>
                                <div className="font-extrabold text-xs mb-1 truncate flex items-center gap-1.5">
                                  <BookOpen className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                                  {cell.subjectName}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                                  <UserCheck className="w-3 h-3 flex-shrink-0" />
                                  {cell.teacherName}
                                </div>
                                {cell.isOnLeave && (
                                  <div className="text-[9px] font-bold text-rose-400 flex items-center gap-1 mt-1">
                                    <AlertTriangle className="w-3 h-3 text-rose-500" /> Substitute
                                  </div>
                                )}
                                <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                                  <button
                                    onClick={() => handleOpenEditCell(day, t.num, t.id || '')}
                                    title="Edit assignment"
                                    className="p-1 rounded bg-indigo-900/80 text-indigo-200 hover:bg-indigo-800 text-[10px] border border-indigo-700/35"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenSubstitute(day, t.num, t.id || '')}
                                    title="Assign substitute"
                                    className="p-1 rounded bg-rose-900/80 text-rose-200 hover:bg-rose-800 text-[10px] border border-rose-700/35"
                                  >
                                    <ArrowLeftRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleOpenEditCell(day, t.num, t.id || '')}
                                className="w-full p-4 rounded-xl border border-dashed border-slate-800 hover:border-slate-600 text-[10px] text-slate-500 hover:text-slate-300 min-h-[90px] transition-colors flex flex-col justify-center items-center gap-1 bg-slate-950/10 hover:bg-slate-900/10"
                              >
                                <span>+</span> Add Period
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'sections' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in">
            {/* Setup Form */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-950/20">
              <h2 className="text-lg font-bold mb-4 text-white">Class Section Setup Wizard</h2>
              <form onSubmit={handleClassSectionSetup} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 font-semibold mb-1 block">Class Name</label>
                    <select
                      value={setupClassId}
                      onChange={(e) => setSetupClassId(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 outline-none"
                    >
                      <option value="">Select Class</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 font-semibold mb-1 block">Section Name</label>
                    <select
                      value={setupSectionId}
                      onChange={(e) => setSetupSectionId(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 outline-none"
                    >
                      <option value="">Select Section</option>
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-semibold mb-1 block">Class Strength Capacity</label>
                  <input
                    type="number"
                    value={setupStrength}
                    onChange={(e) => setSetupStrength(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 outline-none"
                  />
                </div>

                <div className="border-t border-slate-800/80 pt-4 mt-2">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-300">Staff Assignments</h3>
                    <button
                      type="button"
                      onClick={handleAddSetupSubjectRow}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-bold"
                    >
                      + Add Subject
                    </button>
                  </div>

                  <div className="flex flex-col gap-3">
                    {setupSubjects.map((row, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <select
                          value={row.subjectId}
                          onChange={(e) => {
                            const copy = [...setupSubjects];
                            copy[idx].subjectId = e.target.value;
                            setSetupSubjects(copy);
                          }}
                          required
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 outline-none"
                        >
                          <option value="">Choose Subject</option>
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        <select
                          value={row.teacherId}
                          onChange={(e) => {
                            const copy = [...setupSubjects];
                            copy[idx].teacherId = e.target.value;
                            setSetupSubjects(copy);
                          }}
                          required
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 outline-none"
                        >
                          <option value="">Assign Teacher</option>
                          {teachers.map((t) => (
                            <option key={t.Id} value={t.Id}>{t.Name}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          placeholder="Periods"
                          value={row.periods}
                          onChange={(e) => {
                            const copy = [...setupSubjects];
                            copy[idx].periods = Number(e.target.value);
                            setSetupSubjects(copy);
                          }}
                          required
                          className="w-20 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 outline-none"
                        />
                        {setupSubjects.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setSetupSubjects(setupSubjects.filter((_, i) => i !== idx))}
                            className="text-rose-500 hover:text-rose-400 p-2.5 bg-rose-500/5 hover:bg-rose-500/10 rounded-xl border border-rose-500/10"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <button type="submit" className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-xs mt-4 transition-all">
                  Create Class Section & Staff Assignments
                </button>
              </form>
            </div>

            {/* Class Section list & Workload */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-950/20 flex flex-col gap-6">
              <h2 className="text-lg font-bold text-white">Class Section Workload Tracking</h2>
              <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto pr-1">
                {classWorkloads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500 bg-slate-950/10 rounded-xl border border-slate-900">
                    <Layers className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-sm font-semibold">No class sections monitored</p>
                  </div>
                ) : (
                  classWorkloads.map((cs) => (
                    <div key={cs.classSectionId} className="p-4 rounded-xl border border-slate-900 bg-slate-950/10">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-200 text-xs">{cs.name}</span>
                        <span className="text-[10px] text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md">{cs.academicYear}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-2 font-semibold">
                        <span>Staffed: {cs.staffedCount} / {cs.subjectCount} subjects</span>
                        <span>{cs.loadPercent}% Staffed</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5">
                        <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${cs.loadPercent}%` }}></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'teachers' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in">
            {/* Create Teacher */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-950/20">
              <h2 className="text-lg font-bold mb-4 text-white">Register New Staff Profile</h2>
              <form onSubmit={handleCreateTeacher} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">First Name</label>
                    <input
                      type="text"
                      required
                      value={newTeacher.firstName}
                      onChange={(e) => setNewTeacher({ ...newTeacher, firstName: e.target.value })}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 w-full outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Last Name</label>
                    <input
                      type="text"
                      required
                      value={newTeacher.lastName}
                      onChange={(e) => setNewTeacher({ ...newTeacher, lastName: e.target.value })}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 w-full outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Email</label>
                    <input
                      type="email"
                      required
                      value={newTeacher.email}
                      onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 w-full outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Phone</label>
                    <input
                      type="text"
                      value={newTeacher.phone}
                      onChange={(e) => setNewTeacher({ ...newTeacher, phone: e.target.value })}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 w-full outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Qualification</label>
                    <input
                      type="text"
                      value={newTeacher.qualification}
                      onChange={(e) => setNewTeacher({ ...newTeacher, qualification: e.target.value })}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 w-full outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Designation</label>
                    <input
                      type="text"
                      value={newTeacher.designation}
                      onChange={(e) => setNewTeacher({ ...newTeacher, designation: e.target.value })}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 w-full outline-none"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-800/80 pt-4 mt-2">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-300">Skills & Qualifications</h3>
                    <button
                      type="button"
                      onClick={() => setNewTeacher({
                        ...newTeacher,
                        skills: [...newTeacher.skills, { subjectId: '', skillLevel: 'Expert', yearsOfExperience: 2 }]
                      })}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-bold"
                    >
                      + Add Skill
                    </button>
                  </div>

                  <div className="flex flex-col gap-3">
                    {newTeacher.skills.map((skill, idx) => (
                      <div key={idx} className="flex gap-2">
                        <select
                          value={skill.subjectId}
                          onChange={(e) => {
                            const copy = [...newTeacher.skills];
                            copy[idx].subjectId = e.target.value;
                            setNewTeacher({ ...newTeacher, skills: copy });
                          }}
                          required
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 outline-none"
                        >
                          <option value="">Subject</option>
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        <select
                          value={skill.skillLevel}
                          onChange={(e) => {
                            const copy = [...newTeacher.skills];
                            copy[idx].skillLevel = e.target.value;
                            setNewTeacher({ ...newTeacher, skills: copy });
                          }}
                          required
                          className="w-32 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 outline-none"
                        >
                          <option value="Beginner">Beginner</option>
                          <option value="Intermediate">Intermediate</option>
                          <option value="Advanced">Advanced</option>
                          <option value="Expert">Expert</option>
                        </select>
                        {newTeacher.skills.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setNewTeacher({
                              ...newTeacher,
                              skills: newTeacher.skills.filter((_, i) => i !== idx)
                            })}
                            className="text-rose-500 hover:text-rose-400 p-2.5 bg-rose-500/5 hover:bg-rose-500/10 rounded-xl border border-rose-500/10"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <button type="submit" className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-xs mt-4 transition-all">
                  Create Teacher Profile
                </button>
              </form>
            </div>

            {/* Bulk Import & Workload */}
            <div className="flex flex-col gap-8">
              {/* Bulk import */}
              <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-950/20">
                <h2 className="text-lg font-bold mb-4 text-white">Bulk CSV Teacher Import</h2>
                <textarea
                  value={bulkTeacherText}
                  onChange={(e) => setBulkTeacherText(e.target.value)}
                  placeholder="firstName,lastName,email,phone,designation,subject1,skillLevel1&#10;John,Doe,john@school.com,123456,Mathematics Lecturer,Mathematics,Expert"
                  className="bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs w-full h-[150px] font-mono text-slate-300 placeholder:text-slate-600 mb-3 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleBulkTeachers}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg transition-all"
                >
                  Import Teachers CSV
                </button>
              </div>

              {/* Workloads list */}
              <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-950/20 flex flex-col gap-4 max-h-[350px] overflow-y-auto">
                <h2 className="text-lg font-bold text-white mb-2">Teacher Workload Balancing</h2>
                {teacherWorkloads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-500 bg-slate-950/10 rounded-xl border border-slate-900">
                    <Users className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-sm font-semibold">No workloads tracked</p>
                  </div>
                ) : (
                  teacherWorkloads.map((tw) => (
                    <div key={tw.teacherId} className="flex justify-between items-center text-xs p-3 rounded-xl border border-slate-900 bg-slate-950/10">
                      <div>
                        <div className="font-extrabold text-slate-200 text-xs">{tw.teacherName}</div>
                        <div className="text-[10px] text-slate-500 mt-1 font-semibold">
                          {tw.subjectCount} subjects • {tw.classCount} class sections • {tw.totalPeriods} periods/week
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold ${
                          tw.loadPercent > 80 ? 'text-rose-400' : tw.loadPercent > 50 ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          {tw.loadPercent}%
                        </span>
                        <div className="w-16 bg-slate-800 rounded-full h-1">
                          <div className={`h-1 rounded-full ${
                            tw.loadPercent > 80 ? 'bg-rose-500' : tw.loadPercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`} style={{ width: `${tw.loadPercent}%` }}></div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'subjects' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in">
            {/* Timings Setup */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-950/20">
              <h2 className="text-lg font-bold mb-4 text-white font-extrabold">Period Timings Settings</h2>
              <div className="flex flex-col gap-4">
                {timingInputs.map((t, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <span className="text-xs text-slate-400 font-bold w-12 text-center bg-slate-900 border border-slate-800 p-2 rounded-lg">P{t.num}</span>
                    <input
                      type="text"
                      placeholder="Start (e.g. 08:30 AM)"
                      value={t.startTime}
                      onChange={(e) => {
                        const copy = [...timingInputs];
                        copy[idx].startTime = e.target.value;
                        setTimingInputs(copy);
                      }}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="End (e.g. 09:30 AM)"
                      value={t.endTime}
                      onChange={(e) => {
                        const copy = [...timingInputs];
                        copy[idx].endTime = e.target.value;
                        setTimingInputs(copy);
                      }}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 outline-none"
                    />
                    {timingInputs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setTimingInputs(timingInputs.filter((_, i) => i !== idx))}
                        className="text-rose-500 hover:text-rose-400 p-2.5 bg-rose-500/5 hover:bg-rose-500/10 rounded-xl border border-rose-500/10"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex justify-between items-center mt-2 gap-4">
                  <button
                    onClick={handleAddTimingInput}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-bold"
                  >
                    + Add Timing Slot
                  </button>
                  <button
                    onClick={handleSavePeriodTimings}
                    className="px-4 py-2.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg rounded-xl transition-all"
                  >
                    Save Timings Settings
                  </button>
                </div>
              </div>
            </div>

            {/* Subject creation */}
            <div className="flex flex-col gap-8">
              {/* Single create */}
              <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-950/20">
                <h2 className="text-lg font-bold mb-4 text-white font-extrabold">Register Single Subject</h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Subject Name (e.g. Chemistry)"
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={handleCreateSubject}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg transition-all"
                  >
                    Create
                  </button>
                </div>
              </div>

              {/* Bulk import */}
              <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-950/20">
                <h2 className="text-lg font-bold mb-4 text-white font-extrabold">Bulk Subject Import</h2>
                <textarea
                  value={bulkSubText}
                  onChange={(e) => setBulkSubText(e.target.value)}
                  placeholder="Biology&#10;Chemistry&#10;Social Science"
                  className="bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs w-full h-[120px] font-mono text-slate-300 placeholder:text-slate-655 mb-3 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleBulkSubjects}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg transition-all"
                >
                  Import Subjects List
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Editing Grid Cell Modal Dialog */}
      {editingCell && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-950 w-full max-w-md shadow-2xl flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-slate-850 pb-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-indigo-500" />
                Schedule Slot: {editingCell.day} - {timings.find(t => t.num === editingCell.num)?.label || `Period ${editingCell.num}`}
              </h3>
              <button onClick={() => setEditingCell(null)} className="text-slate-500 hover:text-slate-300"><X className="w-4.5 h-4.5" /></button>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider mb-1">Subject</label>
              <select
                value={cellSubjectId}
                onChange={(e) => handleCellSubjectChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 outline-none"
              >
                <option value="">Select Subject</option>
                {classSectionSubjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider mb-1">Assigned Teacher</label>
              <select
                value={cellTeacherId}
                onChange={(e) => setCellTeacherId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 outline-none"
              >
                <option value="">Select Qualified Teacher</option>
                {cellTeachersOptions.length > 0 ? (
                  cellTeachersOptions.map((t) => (
                    <option key={t.Id} value={t.Id}>{t.Name} ({t.Teacher_Skill__c})</option>
                  ))
                ) : (
                  teachers.map((t) => (
                    <option key={t.Id} value={t.Id}>{t.Name}</option>
                  ))
                )}
              </select>
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-850">
              <button
                onClick={() => setEditingCell(null)}
                className="py-2 px-4 rounded-xl text-xs border border-slate-800 bg-slate-950/40 text-slate-400 hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const targetTiming = timings.find(t => t.num === editingCell.num);
                  if (targetTiming) handleSaveCell(targetTiming.id || '');
                }}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-md"
              >
                Set Slot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Substitute Period Modal Dialog */}
      {substituteCell && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-950 w-full max-w-md shadow-2xl flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-slate-850 pb-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <ArrowLeftRight className="w-4 h-4 text-rose-500" />
                Assign Leave Substitute: {substituteCell.day} - {timings.find(t => t.num === substituteCell.num)?.label || `Period ${substituteCell.num}`}
              </h3>
              <button onClick={() => setSubstituteCell(null)} className="text-slate-500 hover:text-slate-300"><X className="w-4.5 h-4.5" /></button>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider mb-1">Substitute Teacher</label>
              <select
                value={cellSubTeacherId}
                onChange={(e) => setCellSubTeacherId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 outline-none"
              >
                <option value="">Mark Teacher Present (No Substitute)</option>
                {teachers.map((t) => (
                  <option key={t.Id} value={t.Id}>{t.Name}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-850">
              <button
                onClick={() => setSubstituteCell(null)}
                className="py-2 px-4 rounded-xl text-xs border border-slate-800 bg-slate-950/40 text-slate-400 hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSubstitute}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-xs transition-all shadow-md"
              >
                Assign Substitute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
