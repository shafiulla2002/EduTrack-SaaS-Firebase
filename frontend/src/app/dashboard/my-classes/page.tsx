'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Users, Search, BookOpen, GraduationCap, X, ChevronRight } from 'lucide-react';

export default function MyClassesPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<any | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const res = await api.get('/teacher-portal/classes');
        setClasses(res.data);
      } catch (err) {
        console.error('Failed to load classes:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Lock body scroll when drawer/modal is open to prevent background scrolling
  useEffect(() => {
    if (selectedClass) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedClass]);

  const handleClassClick = async (cls: any) => {
    setSelectedClass(cls);
    setLoadingStudents(true);
    setSearchTerm('');
    try {
      const res = await api.get(`/teacher-portal/classes/${cls.classSectionId}/students`);
      setStudents(res.data);
    } catch (err) {
      console.error('Failed to load class students:', err);
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  const filteredStudents = students.filter(s =>
    s.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.rollNo && s.rollNo.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  return (
    <div className="space-y-6 max-w-md mx-auto sm:max-w-none">
      <div className="flex justify-between items-center pb-4 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-[#2E5BFF]" />
          My Assigned Classes
        </h2>
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2.5 py-1 rounded-lg">
          {loading ? 'Loading...' : `${classes.length} Total`}
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex justify-between items-center animate-pulse">
              <div className="space-y-3 w-full">
                <div className="bg-slate-200 w-10 h-10 rounded-xl"></div>
                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                <div className="h-3 bg-slate-200 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : classes.length === 0 ? (
        <div className="bg-white p-8 text-center rounded-3xl border border-slate-200 shadow-sm text-slate-500 italic text-sm">
          No classes are currently assigned to your profile.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls, idx) => (
            <button
              key={idx}
              onClick={() => handleClassClick(cls)}
              className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs hover:border-[#2E5BFF] transition-all text-left flex justify-between items-center group cursor-pointer"
            >
              <div className="space-y-3">
                <div className="bg-blue-50 text-[#2E5BFF] w-10 h-10 rounded-xl flex items-center justify-center font-bold">
                  {cls.className.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-[15px]">{cls.className}</h3>
                  <p className="text-xs font-semibold text-[#2E5BFF] flex items-center gap-1.5 mt-1">
                    <BookOpen className="w-3.5 h-3.5" />
                    {cls.subjectName}
                  </p>
                </div>
                <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {cls.strength || 0} Students enrolled
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#2E5BFF] transition-colors" />
            </button>
          ))}
        </div>
      )}

      {/* Roster slide-over drawer / modal */}
      {selectedClass && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-end z-[100] transition-opacity animate-in">
          <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl relative overflow-hidden animate-slide-in">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-black text-slate-900 text-lg leading-none">{selectedClass.className}</h3>
                <p className="text-xs font-semibold text-[#2E5BFF] mt-1.5">{selectedClass.subjectName} Student Roster</p>
              </div>
              <button
                onClick={() => setSelectedClass(null)}
                className="p-2 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-slate-100 bg-white">
              <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:border-[#2E5BFF] transition-all">
                <Search className="w-4 h-4 text-slate-400 mr-2" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent border-none text-[13px] font-medium text-slate-800 outline-none w-full placeholder-slate-400"
                />
              </div>
            </div>

            {/* Student List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
              {loadingStudents ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-8 h-8 border-3 border-t-[#2E5BFF] border-slate-200 rounded-full animate-spin"></div>
                  <p className="text-xs text-slate-400 font-semibold">Loading student list...</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs italic">No students match your query.</div>
              ) : (
                filteredStudents.map((s, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                    {s.user.avatarUrl ? (
                      <img src={s.user.avatarUrl} alt={s.user.name} className="w-10 h-10 rounded-xl object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-500 text-white flex items-center justify-center font-bold text-sm">
                        {s.user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{s.user.name}</h4>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Roll No: {s.rollNo || 'N/A'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
