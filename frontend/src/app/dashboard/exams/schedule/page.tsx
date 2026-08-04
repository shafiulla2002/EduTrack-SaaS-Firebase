'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar as CalendarIcon, List, Search, Filter, Plus, 
  Trash2, Edit, Copy, CheckCircle, XCircle, AlertCircle, 
  Printer, Download, ChevronLeft, ChevronRight, Eye, X, PlusCircle, MinusCircle, RefreshCw
} from 'lucide-react';
import { api } from '@/lib/api';
import { useTenant } from '@/app/providers/TenantContext';
import { useToast } from '@/components/Toast';
import Drawer from '@/components/Drawer';
import { PDFService } from '@/lib/pdf';

interface ClassSectionOption {
  value: string; // classSectionId
  label: string; // name
}

interface SubjectOption {
  id: string;
  name: string;
}

interface AcademicYear {
  id: string;
  name: string;
  isActive: boolean;
}

interface ExamSchedule {
  id: string;
  examName: string;
  classSectionId: string;
  classSection: {
    id: string;
    class: { name: string };
    section: { name: string };
  };
  subjectId: string;
  subject: {
    id: string;
    name: string;
  };
  academicYearId: string;
  academicYear: {
    id: string;
    name: string;
  };
  examDate: string;
  startTime: string;
  endTime: string;
  duration: number;
  examHall?: string;
  instructions?: string;
  status: 'Draft' | 'Published' | 'Completed' | 'Cancelled';
  createdBy: string;
  createdAt: string;
}

export default function ExamSchedulePage() {
  const { currentUser } = useTenant();
  const isAdmin = currentUser?.role === 'SCHOOL_ADMIN' || currentUser?.role === 'SUPER_ADMIN';

  if (currentUser && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center max-w-md mx-auto">
        <AlertCircle className="w-12 h-12 text-rose-600" />
        <h2 className="text-xl font-bold text-slate-800">Access Denied</h2>
        <p className="text-xs text-slate-550 leading-relaxed">
          Only School Administrators are authorized to view or manage exam schedules directly. 
          Teachers can access published schedules via the Announcements module.
        </p>
      </div>
    );
  }

  // Component states
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [classes, setClasses] = useState<ClassSectionOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  
  // Filters
  const [activeTab, setActiveTab] = useState<'list' | 'calendar'>('list');
  const [filterClass, setFilterClass] = useState<string>('All');
  const [filterSubject, setFilterSubject] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterYear, setFilterYear] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Table selection (bulk actions)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals & drawers
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<ExamSchedule | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Form input rows (supporting bulk scheduling)
  const [formExamName, setFormExamName] = useState('');
  const [formClassSectionId, setFormClassSectionId] = useState('');
  const [formAcademicYearId, setFormAcademicYearId] = useState('');
  const [formRows, setFormRows] = useState<Array<{
    subjectId: string;
    examDate: string;
    startTime: string;
    endTime: string;
    examHall: string;
    instructions: string;
  }>>([
    { subjectId: '', examDate: '', startTime: '10:00', endTime: '13:00', examHall: '', instructions: '' }
  ]);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);

  // Calendar state
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Feedback notifications
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [filterClass, filterSubject, filterStatus, filterYear, searchQuery]);

  const fetchMetadata = async () => {
    try {
      setIsLoading(true);
      const [classRes, subRes, yearsRes] = await Promise.all([
        api.get('/exams/classes'),
        api.get('/exams/subjects'),
        api.get('/complaint-box/academic-years')
      ]);
      setClasses(classRes.data || []);
      setSubjects(subRes.data || []);
      setAcademicYears(yearsRes.data || []);

      if (yearsRes.data && yearsRes.data.length > 0) {
        const activeYear = yearsRes.data.find((y: any) => y.isActive) || yearsRes.data[0];
        setFormAcademicYearId(activeYear.id);
      }
      if (classRes.data && classRes.data.length > 0) {
        setFormClassSectionId(classRes.data[0].value);
      }
    } catch (err) {
      console.error('Failed to load metadata:', err);
      showToastMessage('Failed to fetch class and subject mappings.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSchedules = async () => {
    try {
      setIsLoading(true);
      const params: any = {};
      if (filterClass !== 'All') params.classSectionId = filterClass;
      if (filterSubject !== 'All') params.subjectId = filterSubject;
      if (filterStatus !== 'All') params.status = filterStatus;
      if (filterYear !== 'All') params.academicYearId = filterYear;
      if (searchQuery.trim()) params.search = searchQuery;

      const res = await api.get('/exam-schedule', { params });
      setSchedules(res.data || []);
    } catch (err) {
      console.error('Failed to load exam schedules:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const showToastMessage = (message: string, type: 'success' | 'error') => {
    showToast(message, type);
  };

  // Bulk input row modifiers
  const handleAddFormRow = () => {
    setFormRows([
      ...formRows,
      { subjectId: '', examDate: '', startTime: '10:00', endTime: '13:00', examHall: '', instructions: '' }
    ]);
  };

  const handleRemoveFormRow = (index: number) => {
    if (formRows.length === 1) return;
    setFormRows(formRows.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, field: string, value: string) => {
    setFormRows(
      formRows.map((row, i) => i === index ? { ...row, [field]: value } : row)
    );
  };

  // CRUD API Calls
  const handleOpenCreateForm = () => {
    setEditingId(null);
    setFormExamName('');
    setFormRows([{ subjectId: '', examDate: '', startTime: '10:00', endTime: '13:00', examHall: '', instructions: '' }]);
    setIsFormOpen(true);
  };

  const handleDuplicate = (item: ExamSchedule) => {
    setEditingId(null);
    setFormExamName(item.examName);
    setFormClassSectionId(item.classSectionId);
    setFormAcademicYearId(item.academicYearId);
    setFormRows([{
      subjectId: item.subjectId,
      examDate: '', // Clear date for duplication to require new scheduling
      startTime: item.startTime,
      endTime: item.endTime,
      examHall: item.examHall || '',
      instructions: item.instructions || ''
    }]);
    setIsFormOpen(true);
    showToastMessage('Copied schedule details to form.', 'success');
  };

  const handleEdit = (item: ExamSchedule) => {
    setEditingId(item.id);
    setFormExamName(item.examName);
    setFormClassSectionId(item.classSectionId);
    setFormAcademicYearId(item.academicYearId);
    setFormRows([{
      subjectId: item.subjectId,
      examDate: item.examDate.split('T')[0],
      startTime: item.startTime,
      endTime: item.endTime,
      examHall: item.examHall || '',
      instructions: item.instructions || ''
    }]);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this exam schedule record?')) return;
    try {
      setIsLoading(true);
      await api.delete(`/exam-schedule/${id}`);
      showToastMessage('Exam schedule deleted successfully.', 'success');
      setSelectedIds(prev => prev.filter(x => x !== id));
      await fetchSchedules();
    } catch (err: any) {
      showToastMessage(err.response?.data?.message || 'Failed to delete record.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formExamName.trim() || !formClassSectionId || !formAcademicYearId) {
      showToastMessage('Please fill out all general schedule fields.', 'error');
      return;
    }

    // Validate rows
    for (const row of formRows) {
      if (!row.subjectId || !row.examDate || !row.startTime || !row.endTime) {
        showToastMessage('Please fill all required exam details rows.', 'error');
        return;
      }
    }

    try {
      setIsLoading(true);
      if (editingId) {
        // Single update
        const row = formRows[0];
        await api.patch(`/exam-schedule/${editingId}`, {
          examName: formExamName,
          classSectionId: formClassSectionId,
          academicYearId: formAcademicYearId,
          subjectId: row.subjectId,
          examDate: row.examDate,
          startTime: row.startTime,
          endTime: row.endTime,
          examHall: row.examHall || undefined,
          instructions: row.instructions || undefined
        });
        showToastMessage('Exam schedule updated successfully.', 'success');
      } else {
        // Bulk creation
        const payload = formRows.map(row => ({
          examName: formExamName,
          classSectionId: formClassSectionId,
          academicYearId: formAcademicYearId,
          subjectId: row.subjectId,
          examDate: row.examDate,
          startTime: row.startTime,
          endTime: row.endTime,
          examHall: row.examHall || undefined,
          instructions: row.instructions || undefined,
          status: 'Draft' // Defaults to Draft
        }));
        await api.post('/exam-schedule/bulk', { schedules: payload });
        showToastMessage(`Successfully created ${payload.length} exam schedule(s).`, 'success');
      }
      setIsFormOpen(false);
      await fetchSchedules();
    } catch (err: any) {
      showToastMessage(err.response?.data?.message || 'Validation error. Please verify timing conflicts.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Bulk operations
  const handleBulkStatusUpdate = async (status: 'Published' | 'Draft' | 'Cancelled') => {
    if (selectedIds.length === 0) return;
    try {
      setIsLoading(true);
      await api.patch('/exam-schedule/bulk', { ids: selectedIds, status });
      showToastMessage(`Successfully updated ${selectedIds.length} exam(s) to ${status}.`, 'success');
      setSelectedIds([]);
      await fetchSchedules();
    } catch (err: any) {
      showToastMessage('Failed to update status.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete the ${selectedIds.length} selected exam schedules?`)) return;
    try {
      setIsLoading(true);
      await api.post('/exam-schedule/bulk-delete', { ids: selectedIds });
      showToastMessage(`Successfully deleted ${selectedIds.length} exam(s).`, 'success');
      setSelectedIds([]);
      await fetchSchedules();
    } catch (err: any) {
      showToastMessage('Failed to delete selected items.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(schedules.map(s => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(x => x !== id));
    }
  };

  // Export & Print utilities
  const handleExportCSV = () => {
    if (schedules.length === 0) {
      showToastMessage('No records available to export.', 'error');
      return;
    }
    const headers = ['Exam Name', 'Class Section', 'Subject', 'Date', 'Start Time', 'End Time', 'Duration (Min)', 'Exam Hall', 'Instructions', 'Status'];
    const rows = schedules.map(s => [
      s.examName,
      `${s.classSection?.class.name}-${s.classSection?.section.name}`,
      s.subject?.name,
      new Date(s.examDate).toLocaleDateString(),
      s.startTime,
      s.endTime,
      s.duration,
      s.examHall || '',
      s.instructions || '',
      s.status
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Exam_Schedule_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    PDFService.print();
  };

  // Calendar calculation functions
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const startDay = new Date(year, month, 1).getDay();
    const daysCount = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    // Pad previous month days
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    // Current month days
    for (let i = 1; i <= daysCount; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const calendarDays = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 print:p-0 font-sans text-slate-800">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-5 print:hidden">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Exam Schedule Registry
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm font-medium mt-1">
            {isAdmin ? 'Manage, publish, duplicate and orchestrate bulk exam timetables.' : 'View exam schedules for your assigned classes and subjects.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer"
            title="Print Schedule"
          >
            <Printer className="w-4 h-4 text-slate-400" /> Print
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer"
            title="Export to Excel CSV"
          >
            <Download className="w-4 h-4 text-slate-400" /> Export CSV
          </button>

          {isAdmin && (
            <button
              onClick={handleOpenCreateForm}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-blue-500/15 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" /> Schedule Exam
            </button>
          )}
        </div>
      </div>

      {/* Filter and View toggler box */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Tabs */}
          <div className="flex bg-slate-100 rounded-xl p-1 w-fit shrink-0">
            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-xs tracking-wide uppercase transition-all cursor-pointer ${
                activeTab === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <List className="w-4 h-4" /> List View
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-xs tracking-wide uppercase transition-all cursor-pointer ${
                activeTab === 'calendar' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <CalendarIcon className="w-4 h-4" /> Calendar View
            </button>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search exam name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold outline-none focus:bg-white focus:border-blue-500"
            />
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-slate-100 pt-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Class/Section</label>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="All">All Classes</option>
              {classes.map(cls => (
                <option key={cls.value} value={cls.value}>{cls.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Subject</label>
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="All">All Subjects</option>
              {subjects.map(sub => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Academic Year</label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="All">All Years</option>
              {academicYears.map(yr => (
                <option key={yr.id} value={yr.id}>{yr.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="All">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Published">Published</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Action Controls */}
      {isAdmin && selectedIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-1.5 duration-200 print:hidden">
          <div className="text-xs font-bold text-blue-800">
            {selectedIds.length} item(s) selected for bulk actions
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleBulkStatusUpdate('Published')}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
            >
              Publish Selected
            </button>
            <button
              onClick={() => handleBulkStatusUpdate('Draft')}
              className="px-3.5 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-750 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
            >
              Unpublish (Draft)
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT BLOCK */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white border border-slate-200 rounded-2xl shadow-sm text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-xs text-slate-500 font-semibold mt-3">Fetching exam timetables...</p>
        </div>
      ) : activeTab === 'list' ? (
        
        /* 1. LIST VIEW LEDGER */
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            {schedules.length === 0 ? (
              <div className="p-16 text-center text-slate-400">
                <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
                <h3 className="text-base font-bold text-slate-700">No Exam Schedules</h3>
                <p className="text-xs text-slate-400 mt-1">No exam records match the search filter parameters.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider print:bg-white">
                    {isAdmin && (
                      <th className="px-6 py-4 w-12 print:hidden">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === schedules.length && schedules.length > 0}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                        />
                      </th>
                    )}
                    <th className="px-6 py-4">Exam Name</th>
                    <th className="px-6 py-4">Class Section</th>
                    <th className="px-6 py-4">Subject</th>
                    <th className="px-6 py-4">Date & Time</th>
                    <th className="px-6 py-4">Hall</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right print:hidden">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {schedules.map(item => {
                    const isSelected = selectedIds.includes(item.id);
                    return (
                      <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors ${isSelected ? 'bg-blue-50/30' : ''}`}>
                        {isAdmin && (
                          <td className="px-6 py-4 print:hidden">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleSelectRow(item.id, e.target.checked)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="px-6 py-4 font-bold text-slate-900 text-sm leading-tight">
                          {item.examName}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-800">
                          {item.classSection?.class.name} - {item.classSection?.section.name}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-700">
                          {item.subject?.name}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800">
                            {new Date(item.examDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                            {item.startTime} - {item.endTime} ({item.duration} Min)
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-500 font-mono">
                          {item.examHall || '—'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wide ${
                            item.status === 'Draft' ? 'bg-slate-100 border-slate-200 text-slate-500' :
                            item.status === 'Published' ? 'bg-blue-50 border-blue-100 text-blue-700' :
                            item.status === 'Completed' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                            'bg-rose-50 border-rose-100 text-rose-700'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right print:hidden">
                          <div className="flex justify-end gap-1.5 items-center">
                            <button
                              onClick={() => { setSelectedExam(item); setIsDetailsOpen(true); }}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-450 hover:text-slate-700 cursor-pointer"
                              title="View Instructions"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => handleDuplicate(item)}
                                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-450 hover:text-blue-600 cursor-pointer"
                                  title="Duplicate"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleEdit(item)}
                                  className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 hover:text-blue-700 cursor-pointer"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 hover:text-rose-700 cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        
        /* 2. CALENDAR MONTH GRID VIEW */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between print:hidden">
            <h3 className="font-extrabold text-base text-slate-900 leading-none">{monthName}</h3>
            <div className="flex gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-650 cursor-pointer"
              >
                <ChevronLeft className="w-4.5 h-4.5" />
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-650 cursor-pointer"
              >
                <ChevronRight className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-xl overflow-hidden text-xs">
            {/* Days Headings */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="bg-slate-55/70 py-3 text-center font-bold text-slate-550 uppercase tracking-wide">
                {d}
              </div>
            ))}

            {/* Calendar Numbers Grid */}
            {calendarDays.map((day, idx) => {
              if (!day) return <div key={idx} className="bg-slate-50 min-h-[100px] border-b border-r border-slate-200/50" />;

              const dayExams = schedules.filter(s => {
                const sDate = new Date(s.examDate);
                return sDate.getDate() === day.getDate() &&
                       sDate.getMonth() === day.getMonth() &&
                       sDate.getFullYear() === day.getFullYear();
              });

              const isToday = new Date().toDateString() === day.toDateString();

              return (
                <div key={idx} className={`bg-white p-2 min-h-[100px] border-b border-r border-slate-200/50 flex flex-col justify-between ${
                  isToday ? 'bg-blue-50/15' : ''
                }`}>
                  <span className={`font-black text-xs h-6 w-6 rounded-full flex items-center justify-center ${
                    isToday ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-450'
                  }`}>
                    {day.getDate()}
                  </span>

                  <div className="space-y-1 mt-1.5 flex-1 overflow-y-auto max-h-[100px] scrollbar-none">
                    {dayExams.map(ex => (
                      <div
                        key={ex.id}
                        onClick={() => { setSelectedExam(ex); setIsDetailsOpen(true); }}
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border truncate cursor-pointer transition-colors ${
                          ex.status === 'Cancelled' ? 'bg-rose-50 border-rose-100 text-rose-700 line-through' :
                          ex.status === 'Completed' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                          'bg-blue-50 border-blue-100 text-blue-700'
                        }`}
                        title={`${ex.examName}: ${ex.subject?.name}`}
                      >
                        {ex.startTime} {ex.subject?.name}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}      {/* CREATE & EDIT FORM MODAL (Admin Drawer style) */}
      <Drawer
        open={isFormOpen && isAdmin}
        onClose={() => setIsFormOpen(false)}
        size="2xl"
      >
        <div className="h-full w-full bg-white dark:bg-slate-800 flex flex-col justify-between p-0">
          {/* Drawer Header */}
          <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex justify-between items-center shrink-0">
            <div>
              <h3 className="text-lg font-black">{editingId ? 'Edit Exam Schedule' : 'Schedule New Exams'}</h3>
              <p className="text-[11px] text-white/80 font-medium">Orchestrates validation conflicts and timing overlaps.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body Form */}
          <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* General details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-1 sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Exam Name / Term *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Unit Test 1, Annual Examinations"
                  value={formExamName}
                  onChange={(e) => setFormExamName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-200 font-semibold outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Class & Section *</label>
                <select
                  value={formClassSectionId}
                  onChange={(e) => setFormClassSectionId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 focus:bg-white"
                >
                  {classes.map(cls => (
                    <option key={cls.value} value={cls.value} className="dark:bg-slate-800">{cls.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Academic Year *</label>
                <select
                  value={formAcademicYearId}
                  onChange={(e) => setFormAcademicYearId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 focus:bg-white"
                >
                  {academicYears.map(yr => (
                    <option key={yr.id} value={yr.id} className="dark:bg-slate-800">{yr.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Schedules subrows (Bulk support) */}
            <div className="border-t border-slate-100 dark:border-slate-750 pt-5 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Exam Details / Subjects</h4>
                {!editingId && (
                  <button
                    type="button"
                    onClick={handleAddFormRow}
                    className="text-blue-650 hover:text-blue-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" /> Add Subject
                  </button>
                )}
              </div>

              {formRows.map((row, idx) => (
                <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 relative animate-in fade-in duration-150">
                  
                  {/* Delete row trigger */}
                  {!editingId && formRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFormRow(idx)}
                      className="absolute top-2 right-2 text-slate-400 hover:text-rose-600 p-1 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* Subject Selection */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Subject *</label>
                      <select
                        value={row.subjectId}
                        required
                        onChange={(e) => handleRowChange(idx, 'subjectId', e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500"
                      >
                        <option value="" className="dark:bg-slate-800">-- Select Subject --</option>
                        {subjects.map(sub => (
                          <option key={sub.id} value={sub.id} className="dark:bg-slate-800">{sub.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Exam Date */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Exam Date *</label>
                      <input
                        type="date"
                        required
                        value={row.examDate}
                        onChange={(e) => handleRowChange(idx, 'examDate', e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    
                    {/* Start Time */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Start Time *</label>
                      <input
                        type="text"
                        placeholder="e.g. 10:00"
                        required
                        value={row.startTime}
                        onChange={(e) => handleRowChange(idx, 'startTime', e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                      />
                    </div>

                    {/* End Time */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">End Time *</label>
                      <input
                        type="text"
                        placeholder="e.g. 13:00"
                        required
                        value={row.endTime}
                        onChange={(e) => handleRowChange(idx, 'endTime', e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                      />
                    </div>

                    {/* Exam Hall */}
                    <div className="space-y-1.5 col-span-2 sm:col-span-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Hall / Room</label>
                      <input
                        type="text"
                        placeholder="e.g. Hall A-2"
                        value={row.examHall}
                        onChange={(e) => handleRowChange(idx, 'examHall', e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Special Instructions</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Bring own calculator, reach 15 mins early..."
                      value={row.instructions}
                      onChange={(e) => handleRowChange(idx, 'instructions', e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 resize-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </form>

          {/* Drawer Footer */}
          <div className="p-6 bg-slate-55 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-750 text-slate-650 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleFormSubmit}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer shadow-md shadow-blue-500/15 transition-all"
            >
              {editingId ? 'Save Changes' : 'Schedule Exam(s)'}
            </button>
          </div>
        </div>
      </Drawer>

      {/* VIEW DETAILS DRAWER */}
      {isDetailsOpen && selectedExam && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0 text-slate-850 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white flex justify-between items-start">
              <div className="space-y-0.5">
                <span className="text-[9px] font-bold uppercase tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full">
                  Exam Schedule Info
                </span>
                <h3 className="text-lg font-black leading-tight mt-1">{selectedExam.examName}</h3>
              </div>
              <button
                onClick={() => { setSelectedExam(null); setIsDetailsOpen(false); }}
                className="text-white hover:bg-white/10 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider">Class / Section</span>
                  <span className="text-slate-850 font-bold block mt-0.5">
                    {selectedExam.classSection?.class.name} - {selectedExam.classSection?.section.name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider">Subject</span>
                  <span className="text-slate-850 font-bold block mt-0.5">{selectedExam.subject?.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider">Exam Date</span>
                  <span className="text-slate-850 font-bold block mt-0.5">
                    {new Date(selectedExam.examDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider">Timing & Duration</span>
                  <span className="text-slate-850 font-bold block mt-0.5">
                    {selectedExam.startTime} - {selectedExam.endTime} ({selectedExam.duration} Mins)
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider">Exam Hall / Room</span>
                  <span className="text-slate-800 font-bold block mt-0.5 font-mono">{selectedExam.examHall || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider">Status</span>
                  <span className={`inline-block mt-0.5 px-2.5 py-0.5 text-[9px] font-extrabold rounded-full border uppercase ${
                    selectedExam.status === 'Draft' ? 'bg-slate-100 border-slate-200 text-slate-500' :
                    selectedExam.status === 'Published' ? 'bg-blue-50 border-blue-100 text-blue-700' :
                    selectedExam.status === 'Completed' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                    'bg-rose-50 border-rose-100 text-rose-700'
                  }`}>
                    {selectedExam.status}
                  </span>
                </div>
              </div>

              {/* Instructions */}
              <div className="border-t border-slate-100 pt-4">
                <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider mb-2">Instructions</span>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs leading-relaxed max-h-48 overflow-y-auto">
                  {selectedExam.instructions || 'No special instructions provided.'}
                </div>
              </div>

              {/* Quick Status controls (Admin only) */}
              {isAdmin && selectedExam.status !== 'Completed' && (
                <div className="border-t border-slate-100 pt-4 flex gap-2 justify-end">
                  {selectedExam.status !== 'Published' && (
                    <button
                      onClick={async () => {
                        await api.patch(`/exam-schedule/${selectedExam.id}`, { status: 'Published' });
                        showToastMessage('Exam published successfully.', 'success');
                        setIsDetailsOpen(false);
                        await fetchSchedules();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-all"
                    >
                      Publish Exam
                    </button>
                  )}
                  {selectedExam.status === 'Published' && (
                    <button
                      onClick={async () => {
                        await api.patch(`/exam-schedule/${selectedExam.id}`, { status: 'Cancelled' });
                        showToastMessage('Exam cancelled.', 'success');
                        setIsDetailsOpen(false);
                        await fetchSchedules();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-all"
                    >
                      Cancel Exam
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      await api.patch(`/exam-schedule/${selectedExam.id}`, { status: 'Completed' });
                      showToastMessage('Exam marked as completed.', 'success');
                      setIsDetailsOpen(false);
                      await fetchSchedules();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-all"
                  >
                    Complete Exam
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-150 flex justify-end">
              <button
                onClick={() => { setSelectedExam(null); setIsDetailsOpen(false); }}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
