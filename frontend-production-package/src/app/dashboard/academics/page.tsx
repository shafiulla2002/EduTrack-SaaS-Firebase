'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, Calendar, Plus, BookOpen, Clock, AlertTriangle, 
  CheckCircle, ChevronRight, X, Search, Info, Grid, MapPin, RefreshCw, Trash2
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { dispatchSchoolSetupUpdated } from '@/lib/events';

interface Teacher {
  id: string;
  employeeId: string | null;
  designation: string | null;
  qualification: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface ClassSection {
  id: string;
  strength: number;
  class: {
    id: string;
    name: string;
    academicYearId: string;
  };
  section: {
    id: string;
    name: string;
  };
  teacher?: {
    id: string;
    user: {
      name: string;
    };
  } | null;
}

interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

interface Subject {
  id: string;
  name: string;
}

export default function AcademicsManagement() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'workload' | 'wizard' | 'timetable' | 'config'>('workload');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classSections, setClassSections] = useState<ClassSection[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  // Search States
  const [teacherSearch, setTeacherSearch] = useState('');
  const [classSearch, setClassSearch] = useState('');

  // Selected details
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  // Wizard States
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardData, setWizardData] = useState({
    academicYearId: '',
    className: '',
    sectionName: '',
    strength: 40,
    teacherId: '',
  });

  // Config tab form states
  const [newYearName, setNewYearName] = useState('');
  const [newYearStart, setNewYearStart] = useState('');
  const [newYearEnd, setNewYearEnd] = useState('');

  const [newSubjectName, setNewSubjectName] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [teachersRes, classSectionsRes, yearsRes, subjectsRes] = await Promise.all([
        api.get('/teachers'),
        api.get('/academics/class-sections'),
        api.get('/academics/academic-years'),
        api.get('/academics/subjects'),
      ]);

      setTeachers(teachersRes.data);
      setClassSections(classSectionsRes.data);
      setAcademicYears(yearsRes.data);
      setSubjects(subjectsRes.data);

      if (yearsRes.data.length > 0) {
        setWizardData(prev => ({ ...prev, academicYearId: yearsRes.data[0].id }));
      }
      if (teachersRes.data.length > 0) {
        setWizardData(prev => ({ ...prev, teacherId: teachersRes.data[0].id }));
      }
    } catch (err) {
      console.error('Failed to load academics data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFinishWizard = async () => {
    if (!wizardData.className || !wizardData.sectionName || !wizardData.academicYearId) {
      showToast('Please fill in all mandatory fields.', 'warning');
      return;
    }

    try {
      setLoading(true);

      // 1. Resolve Class Level
      let classId = '';
      const existingClassesRes = await api.get('/academics/classes');
      const matchClass = existingClassesRes.data.find(
        (c: any) => c.name.toLowerCase() === wizardData.className.toLowerCase().trim() && c.academicYearId === wizardData.academicYearId
      );

      if (matchClass) {
        classId = matchClass.id;
      } else {
        const createClassRes = await api.post('/academics/classes', {
          name: wizardData.className.trim(),
          academicYearId: wizardData.academicYearId,
        });
        classId = createClassRes.data.id;
      }

      // 2. Resolve Section Letter
      let sectionId = '';
      const existingSectionsRes = await api.get('/academics/sections');
      const matchSection = existingSectionsRes.data.find(
        (s: any) => s.name.toLowerCase() === wizardData.sectionName.toLowerCase().trim()
      );

      if (matchSection) {
        sectionId = matchSection.id;
      } else {
        const createSecRes = await api.post('/academics/sections', {
          name: wizardData.sectionName.trim(),
        });
        sectionId = createSecRes.data.id;
      }

      // 3. Create ClassSection junction
      await api.post('/academics/class-sections', {
        classId,
        sectionId,
        teacherId: wizardData.teacherId || undefined,
      });

      alert('Success: New Class Section registered with staffing parameters.');
      setWizardStep(1);
      setWizardData({
        academicYearId: academicYears[0]?.id || '',
        className: '',
        sectionName: '',
        strength: 40,
        teacherId: teachers[0]?.id || '',
      });
      setActiveTab('workload');
      await loadData();
      showToast('Class Section created successfully.', 'success');
      dispatchSchoolSetupUpdated();
    } catch (err: any) {
      console.error('Failed to create class section:', err);
      showToast(err.response?.data?.message || 'Failed to create class section.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newYearName || !newYearStart || !newYearEnd) return;
    try {
      setLoading(true);
      await api.post('/academics/academic-years', {
        name: newYearName,
        startDate: new Date(newYearStart),
        endDate: new Date(newYearEnd),
        isActive: academicYears.length === 0, // active if it's the first one
      });
      setNewYearName('');
      setNewYearStart('');
      setNewYearEnd('');
      await loadData();
      showToast('Academic Year created successfully.', 'success');
    } catch (err: any) {
      console.error('Failed to create academic year:', err);
      showToast(err.response?.data?.message || 'Failed to create academic year.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName) return;
    try {
      setLoading(true);
      await api.post('/academics/subjects', {
        name: newSubjectName.trim(),
      });
      setNewSubjectName('');
      await loadData();
      showToast('Subject added successfully.', 'success');
    } catch (err: any) {
      console.error('Failed to create subject:', err);
      showToast(err.response?.data?.message || 'Failed to create subject.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filter lists
  const filteredTeachers = teachers.filter(t => t.user.name.toLowerCase().includes(teacherSearch.toLowerCase()));
  const filteredClasses = classSections.filter(c => 
    `${c.class.name} - ${c.section.name}`.toLowerCase().includes(classSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-900 pb-5">
        <div>
          <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
            Teacher & Class Management
          </h2>
          <p className="text-slate-400 text-xs font-light mt-1">
            Assign classroom advisory, resolve unstaffed courses, and design school schedule calendars.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => loadData()}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              setWizardStep(1);
              setActiveTab('wizard');
            }}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-brand-500/10 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Class Section
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-900 gap-6 text-sm">
        <button
          onClick={() => setActiveTab('workload')}
          className={`pb-4 font-bold transition-all border-b-2 ${
            activeTab === 'workload' ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-350'
          }`}
        >
          Workload Dashboard
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`pb-4 font-bold transition-all border-b-2 ${
            activeTab === 'config' ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-355'
          }`}
        >
          Academic Settings
        </button>
      </div>

      {loading && classSections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <RefreshCw className="w-10 h-10 text-brand-500 animate-spin" />
          <p className="text-slate-400 text-sm">Querying AWS PostgreSQL Database...</p>
        </div>
      ) : (
        <>
          {/* WORKLOAD OVERVIEW */}
          {activeTab === 'workload' && (
            <div className="space-y-6">
              {/* KPI Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="glass-panel p-6 shadow-xl">
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Faculty</span>
                  <div className="text-3xl font-extrabold text-white leading-none mt-2">{teachers.length}</div>
                  <span className="text-[10px] text-slate-500 font-semibold block mt-2">Active roster faculty</span>
                </div>
                <div className="glass-panel p-6 shadow-xl">
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Class Sections</span>
                  <div className="text-3xl font-extrabold text-white leading-none mt-2">{classSections.length}</div>
                  <span className="text-[10px] text-slate-500 font-semibold block mt-2">Operational classrooms</span>
                </div>
                <div className="glass-panel p-6 shadow-xl">
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Subjects Catalog</span>
                  <div className="text-3xl font-extrabold text-white leading-none mt-2">{subjects.length}</div>
                  <span className="text-[10px] text-slate-500 font-semibold block mt-2">Mapped courses</span>
                </div>
              </div>

              {/* Dual Panel */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* LEFT PANEL: Teacher Workloads */}
                <div className="glass-panel p-6 shadow-xl space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-900 pb-3">
                    <h3 className="font-bold text-slate-200 text-sm">Faculty Directories</h3>
                    <div className="relative flex items-center bg-slate-900 border border-slate-850 rounded-lg px-2 py-1 w-44">
                      <Search className="w-3.5 h-3.5 text-slate-500 mr-1" />
                      <input
                        type="text" placeholder="Search faculty..." value={teacherSearch}
                        onChange={(e) => setTeacherSearch(e.target.value)}
                        className="bg-transparent border-none text-[11px] text-slate-200 outline-none w-full placeholder-slate-500 font-semibold"
                      />
                    </div>
                  </div>

                  {filteredTeachers.length === 0 ? (
                    <p className="text-xs text-slate-550 py-4 text-center">No faculty registered.</p>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                      {filteredTeachers.map((t) => {
                        const isSelected = selectedTeacherId === t.id;
                        return (
                          <div key={t.id} className="border border-slate-850 rounded-xl p-3 hover:border-brand-500/30 transition-all bg-slate-900/10">
                            <div className="flex justify-between items-center cursor-pointer" onClick={() => setSelectedTeacherId(isSelected ? null : t.id)}>
                              <div>
                                <div className="font-bold text-xs text-slate-200">{t.user.name}</div>
                                <div className="text-[10px] text-slate-500 font-medium mt-0.5">{t.designation || 'Teacher'} · {t.employeeId || 'No ID'}</div>
                              </div>
                              <span className="text-[9px] font-bold text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                                View Profile
                              </span>
                            </div>
                            
                            {/* Expand details for teachers */}
                            {isSelected && (
                              <div className="mt-4 pt-3 border-t border-slate-900 space-y-2 text-xs animate-fade-in">
                                <div className="text-slate-500 font-bold text-[9px] uppercase tracking-wider">Profile Details:</div>
                                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-850 space-y-1 text-slate-350">
                                  <p><span className="text-slate-550">Email:</span> {t.user.email}</p>
                                  <p><span className="text-slate-550">Qualifications:</span> {t.qualification || 'Not provided'}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* RIGHT PANEL: Class sections workloads */}
                <div className="glass-panel p-6 shadow-xl space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-900 pb-3">
                    <h3 className="font-bold text-slate-200 text-sm">Classroom Staffing Coverage</h3>
                    <div className="relative flex items-center bg-slate-900 border border-slate-850 rounded-lg px-2 py-1 w-44">
                      <Search className="w-3.5 h-3.5 text-slate-500 mr-1" />
                      <input
                        type="text" placeholder="Search classrooms..." value={classSearch}
                        onChange={(e) => setClassSearch(e.target.value)}
                        className="bg-transparent border-none text-[11px] text-slate-200 outline-none w-full placeholder-slate-500 font-semibold"
                      />
                    </div>
                  </div>

                  {filteredClasses.length === 0 ? (
                    <p className="text-xs text-slate-550 py-4 text-center">No class sections registered.</p>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                      {filteredClasses.map((c) => {
                        const isSelected = selectedClassId === c.id;
                        return (
                          <div key={c.id} className="border border-slate-850 rounded-xl p-3 hover:border-brand-500/30 transition-all bg-slate-900/10">
                            <div className="flex justify-between items-center cursor-pointer" onClick={() => setSelectedClassId(isSelected ? null : c.id)}>
                              <div>
                                <div className="font-bold text-xs text-slate-200">{c.class.name} — {c.section.name}</div>
                                <div className="text-[10px] text-slate-500 font-medium mt-0.5">Strength: {c.strength || 0} enrolled</div>
                              </div>
                              <span className="text-[9px] font-bold text-emerald-450 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">
                                {c.teacher ? 'Advisor Assigned' : 'No Advisor'}
                              </span>
                            </div>

                            {/* Expand details for class */}
                            {isSelected && (
                              <div className="mt-4 pt-3 border-t border-slate-900 space-y-3 text-xs animate-fade-in">
                                <div className="text-slate-500 font-bold text-[9px] uppercase tracking-wider">Advisor Details:</div>
                                <div className="p-2.5 bg-slate-900 border border-slate-850 rounded-lg text-slate-350">
                                  {c.teacher ? (
                                    <p>Advisor Teacher: <strong className="text-slate-200">{c.teacher.user.name}</strong></p>
                                  ) : (
                                    <p className="italic text-slate-550">No advisor currently assigned to this classroom section.</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* CREATE CLASS SECTION WIZARD */}
          {activeTab === 'wizard' && (
            <div className="max-w-xl mx-auto glass-panel p-6 shadow-xl space-y-6 animate-fade-in">
              <div className="flex justify-between items-center border-b border-slate-900 pb-3">
                <h3 className="font-bold text-slate-200 text-base">Setup New Classroom Section</h3>
                <span className="text-xs text-slate-400 font-bold bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
                  Step {wizardStep} of 2
                </span>
              </div>

              {/* Stepper Wizard Indicator */}
              <div className="flex items-center gap-4 text-xs font-bold">
                <div className={`px-3 py-1.5 rounded-lg border ${wizardStep >= 1 ? 'bg-brand-500/10 text-brand-450 border-brand-500/20' : 'bg-slate-900 text-slate-500 border-slate-850'}`}>
                  1. Class Credentials
                </div>
                <div className="text-slate-700">→</div>
                <div className={`px-3 py-1.5 rounded-lg border ${wizardStep >= 2 ? 'bg-brand-500/10 text-brand-450 border-brand-500/20' : 'bg-slate-900 text-slate-500 border-slate-850'}`}>
                  2. Advisor & Setup
                </div>
              </div>

              <div className="space-y-4 text-xs font-semibold">
                {wizardStep === 1 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Select Academic Year *</label>
                      <select
                        value={wizardData.academicYearId}
                        onChange={(e) => setWizardData({ ...wizardData, academicYearId: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-850 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none"
                      >
                        {academicYears.map(y => (
                          <option key={y.id} value={y.id}>{y.name} {y.isActive ? '(Active)' : ''}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-400 font-bold mb-1">Grade Class Level *</label>
                        <input
                          type="text" placeholder="e.g. Grade 10" required
                          value={wizardData.className}
                          onChange={(e) => setWizardData({ ...wizardData, className: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-850 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-brand-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-bold mb-1">Section Letter *</label>
                        <input
                          type="text" placeholder="e.g. Section A" required
                          value={wizardData.sectionName}
                          onChange={(e) => setWizardData({ ...wizardData, sectionName: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-850 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-brand-500"
                        />
                      </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                      <button
                        onClick={() => {
                          if (!wizardData.className || !wizardData.sectionName) {
                            showToast('Required fields must be completed.', 'warning');
                            return;
                          }
                          setWizardStep(2);
                        }}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-brand-500/10 transition-all"
                      >
                        Next Setup Steps →
                      </button>
                    </div>
                  </div>
                )}

                {wizardStep === 2 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Map Class Advisor</label>
                      <select
                        value={wizardData.teacherId}
                        onChange={(e) => setWizardData({ ...wizardData, teacherId: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-850 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none"
                      >
                        <option value="">No Advisor Assigned</option>
                        {teachers.map(t => (
                          <option key={t.id} value={t.id}>{t.user.name} ({t.designation || 'Teacher'})</option>
                        ))}
                      </select>
                    </div>

                    <div className="pt-4 flex justify-between">
                      <button
                        onClick={() => setWizardStep(1)}
                        className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold transition-all"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleFinishWizard}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-brand-500/10 transition-all animate-pulse"
                      >
                        Confirm & Create Class Section
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ACADEMIC SETTINGS */}
          {activeTab === 'config' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
              {/* Term boundaries */}
              <div className="glass-panel p-6 shadow-xl space-y-4">
                <h3 className="text-base font-bold text-slate-200 flex items-center gap-2 border-b border-slate-900 pb-3">
                  <Calendar className="w-5 h-5 text-brand-400" />
                  Academic Term Boundaries
                </h3>
                <div className="space-y-3">
                  {academicYears.map(ay => (
                    <div key={ay.id} className="border border-slate-850 rounded-xl p-4 bg-slate-900/10 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-slate-200 text-sm">{ay.name}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                          ay.isActive ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' : 'bg-slate-900 text-slate-500 border border-slate-800'
                        }`}>
                          {ay.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-slate-500 font-semibold mt-2">
                        <div>Start: <strong className="text-slate-350 font-bold block">{new Date(ay.startDate).toLocaleDateString()}</strong></div>
                        <div>End: <strong className="text-slate-350 font-bold block">{new Date(ay.endDate).toLocaleDateString()}</strong></div>
                      </div>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleCreateYear} className="space-y-3 pt-4 border-t border-slate-900 text-xs">
                  <h4 className="font-bold text-slate-300">Create New Academic Year</h4>
                  <div>
                    <input
                      type="text" placeholder="e.g. 2026-2027" required
                      value={newYearName} onChange={e => setNewYearName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-850 rounded-xl px-4 py-2 text-slate-200 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="date" required
                      value={newYearStart} onChange={e => setNewYearStart(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-850 rounded-xl px-4 py-2 text-slate-200 focus:outline-none"
                    />
                    <input
                      type="date" required
                      value={newYearEnd} onChange={e => setNewYearEnd(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-850 rounded-xl px-4 py-2 text-slate-200 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold transition-all shadow-md"
                  >
                    Save Academic Year
                  </button>
                </form>
              </div>

              {/* Subject Codes */}
              <div className="glass-panel p-6 shadow-xl space-y-4">
                <h3 className="text-base font-bold text-slate-200 flex items-center gap-2 border-b border-slate-900 pb-3">
                  <BookOpen className="w-5 h-5 text-brand-400" />
                  Subject Catalog Courses
                </h3>
                <div className="overflow-x-auto border border-slate-850 rounded-xl max-h-[250px] overflow-y-auto pr-1">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-850 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        <th className="px-4 py-3">Subject Name</th>
                        <th className="px-4 py-3 text-right">Identifier ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-xs text-slate-350 font-semibold">
                      {subjects.map((sub) => (
                        <tr key={sub.id} className="hover:bg-slate-900/10">
                          <td className="px-4 py-3 text-slate-200">{sub.name}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-500 text-[10px]">{sub.id.substring(0, 8).toUpperCase()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <form onSubmit={handleCreateSubject} className="space-y-3 pt-4 border-t border-slate-900 text-xs">
                  <h4 className="font-bold text-slate-300">Add New Subject Course</h4>
                  <div>
                    <input
                      type="text" placeholder="e.g. Physics" required
                      value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-850 rounded-xl px-4 py-2 text-slate-200 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold transition-all shadow-md"
                  >
                    Save Subject
                  </button>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
