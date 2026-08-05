'use client';

import React, { useState, useEffect } from 'react';
import { useParent } from '../ParentContext';
import { api } from '@/lib/api';
import { User, Shield, Info, Heart, Briefcase, Mail, Phone } from 'lucide-react';

export default function StudentProfilePage() {
  const { selectedChild } = useParent();
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (childId: string) => {
    try {
      setLoading(true);
      const res = await api.get(`/parent-portal/children/${childId}/dashboard`);
      setProfileData(res.data);
    } catch (err) {
      console.error('Failed to fetch student profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedChild) {
      fetchProfile(selectedChild.id);
    }
  }, [selectedChild]);

  // Listen to switcher events
  useEffect(() => {
    const handleChildChange = (e: any) => {
      fetchProfile(e.detail);
    };
    window.addEventListener('parentChildChanged', handleChildChange);
    return () => window.removeEventListener('parentChildChanged', handleChildChange);
  }, []);

  if (!selectedChild) {
    return (
      <div className="text-slate-500 text-sm text-center py-12">
        Please select a child to view their profile.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-t-[#2E5BFF] border-r-[#2E5BFF] border-b-transparent border-l-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-fade-in">
      {/* Profile Card */}
      <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex flex-col items-center text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-r from-blue-50 to-indigo-50" />
        
        <div className="relative mt-8">
          {selectedChild.avatarUrl ? (
            <img
              src={selectedChild.avatarUrl}
              alt={selectedChild.name}
              className="w-24 h-24 rounded-3xl object-cover border-4 border-white shadow-md"
            />
          ) : (
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center font-black text-3xl border-4 border-white shadow-md">
              {selectedChild.name[0]}
            </div>
          )}
        </div>

        <h2 className="text-2xl font-black text-slate-800 mt-4">{selectedChild.name}</h2>
        <p className="text-xs text-slate-500 font-light mt-1">
          Class {selectedChild.class} • Section {selectedChild.section}
        </p>
        <span className="mt-3 px-3 py-1.5 rounded-full bg-blue-550/10 bg-blue-50 border border-blue-100 text-[#2E5BFF] text-[10px] font-bold uppercase tracking-wider">
          Student ID: {selectedChild.id.substring(0, 8).toUpperCase()}
        </span>
      </div>

      {/* Grid of details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Personal Details */}
        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-800 border-b border-slate-105 border-slate-100 pb-2 flex items-center gap-2">
            <Info className="w-4 h-4 text-[#2E5BFF]" />
            Academic Details
          </h3>
          <div className="space-y-3.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-400">Roll Number</span>
              <strong className="text-slate-700">{selectedChild.rollNo}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Class Section</span>
              <strong className="text-slate-700">{selectedChild.class} - {selectedChild.section}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Blood Group</span>
              <strong className="text-slate-700">O+ (Positive)</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Date of Birth</span>
              <strong className="text-slate-700">12th August 2016</strong>
            </div>
          </div>
        </div>

        {/* Parent Details */}
        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-500" />
            Guardian Details
          </h3>
          <div className="space-y-3.5 text-xs text-slate-600">
            {profileData?.student?.fatherName && profileData.student.fatherName !== 'N/A' && (
              <div className="flex justify-between">
                <span className="text-slate-400">Father's Name</span>
                <strong className="text-slate-700">{profileData.student.fatherName}</strong>
              </div>
            )}
            {profileData?.student?.fatherPhone && profileData.student.fatherPhone !== 'N/A' && (
              <div className="flex justify-between">
                <span className="text-slate-400">Father's Phone</span>
                <strong className="text-slate-700">{profileData.student.fatherPhone}</strong>
              </div>
            )}
            {profileData?.student?.motherName && profileData.student.motherName !== 'N/A' && (
              <div className="flex justify-between">
                <span className="text-slate-400">Mother's Name</span>
                <strong className="text-slate-700">{profileData.student.motherName}</strong>
              </div>
            )}
            {profileData?.student?.motherPhone && profileData.student.motherPhone !== 'N/A' && (
              <div className="flex justify-between">
                <span className="text-slate-400">Mother's Phone</span>
                <strong className="text-slate-700">{profileData.student.motherPhone}</strong>
              </div>
            )}
            {profileData?.student?.guardianName && profileData.student.guardianName !== 'N/A' && (
              <div className="flex justify-between">
                <span className="text-slate-400">Guardian Name</span>
                <strong className="text-slate-700">{profileData.student.guardianName}</strong>
              </div>
            )}
            {profileData?.student?.guardianPhone && profileData.student.guardianPhone !== 'N/A' && (
              <div className="flex justify-between">
                <span className="text-slate-400">Guardian's Phone</span>
                <strong className="text-slate-700">{profileData.student.guardianPhone}</strong>
              </div>
            )}
            {profileData?.student?.primaryContactRole && (
              <div className="flex justify-between">
                <span className="text-slate-400">Primary Contact Role</span>
                <strong className="text-indigo-600 uppercase tracking-wider text-[10px] font-bold">
                  {profileData.student.primaryContactRole}
                </strong>
              </div>
            )}
            {profileData?.student?.primaryContactPhone && profileData.student.primaryContactPhone !== 'N/A' && (
              <div className="flex justify-between">
                <span className="text-slate-400">Primary Contact Number</span>
                <strong className="text-slate-700">{profileData.student.primaryContactPhone}</strong>
              </div>
            )}
            {profileData?.student?.emergencyPhone && profileData.student.emergencyPhone !== 'N/A' && (
              <div className="flex justify-between">
                <span className="text-slate-400">Emergency Phone</span>
                <strong className="text-slate-700">{profileData.student.emergencyPhone}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Class Advisor & Subject Teachers */}
        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-6 md:col-span-2">
          <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-indigo-500" />
            Class Advisor & Subject Teachers
          </h3>

          {/* Section: Class Advisor */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Class Advisor</h4>
            {profileData?.classAdvisor ? (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {profileData.classAdvisor.avatarUrl ? (
                    <img
                      src={profileData.classAdvisor.avatarUrl}
                      alt={profileData.classAdvisor.name}
                      className="w-14 h-14 rounded-2xl object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-black text-xl">
                      {profileData.classAdvisor.name[0]}
                    </div>
                  )}
                  <div>
                    <h5 className="text-sm font-bold text-slate-800">{profileData.classAdvisor.name}</h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {profileData.classAdvisor.designation || 'Class Advisor'} • {profileData.classAdvisor.department}
                    </p>
                    {profileData.classAdvisor.employeeId && profileData.classAdvisor.employeeId !== 'N/A' && (
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">Emp ID: {profileData.classAdvisor.employeeId}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {profileData.classAdvisor.email && (
                    <a
                      href={`mailto:${profileData.classAdvisor.email}`}
                      className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-[#2E5BFF] hover:border-[#2E5BFF]/30 transition-all cursor-pointer"
                      title="Send Email"
                    >
                      <Mail className="w-4 h-4" />
                    </a>
                  )}
                  {profileData.classAdvisor.phone && (
                    <a
                      href={`tel:${profileData.classAdvisor.phone}`}
                      className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                      title="Call"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-50/50 rounded-2xl p-6 border border-dashed border-slate-200 text-center text-xs text-slate-400 font-medium italic">
                No Class Advisor Assigned
              </div>
            )}
          </div>

          {/* Section: Subject Teachers */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Subject Teachers</h4>
            {profileData?.subjectTeachers && profileData.subjectTeachers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {profileData.subjectTeachers.map((teacher: any, idx: number) => (
                  <div key={idx} className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex flex-col justify-between h-full gap-4">
                    <div className="flex items-start gap-4">
                      {teacher.avatarUrl ? (
                        <img
                          src={teacher.avatarUrl}
                          alt={teacher.name}
                          className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center font-black text-lg shrink-0">
                          {teacher.name[0]}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h5 className="text-sm font-bold text-slate-800 truncate">{teacher.name}</h5>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {teacher.designation || 'Teacher'} • {teacher.department}
                        </p>
                        {teacher.employeeId && teacher.employeeId !== 'N/A' && (
                          <p className="text-[10px] text-slate-400 font-mono">Emp ID: {teacher.employeeId}</p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {teacher.subjects?.map((sub: string, subIdx: number) => (
                            <span key={subIdx} className="bg-emerald-50 text-emerald-700 border border-emerald-150 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
                              {sub}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end border-t border-slate-200/50 pt-3">
                      {teacher.email && (
                        <a
                          href={`mailto:${teacher.email}`}
                          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-[#2E5BFF] hover:border-[#2E5BFF]/30 transition-all cursor-pointer"
                          title="Send Email"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {teacher.phone && (
                        <a
                          href={`tel:${teacher.phone}`}
                          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                          title="Call"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-50/50 rounded-2xl p-6 border border-dashed border-slate-200 text-center text-xs text-slate-400 font-medium italic">
                No Subject Teachers Assigned
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
