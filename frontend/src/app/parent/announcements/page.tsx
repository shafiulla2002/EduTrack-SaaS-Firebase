'use client';

import React, { useState, useEffect } from 'react';
import { useParent } from '../ParentContext';
import { api } from '@/lib/api';
import { Bell, Info, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';

function sanitizeAnnouncementContent(content: string): string {
  if (!content) return '';
  return content
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(?:examScheduleId|debugId|internalId):\s*[0-9a-fA-F-]{36}/gi, '')
    .trim();
}

export default function AnnouncementsPage() {
  const { selectedChild } = useParent();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());
  const [successMsg, setSuccessMsg] = useState('');

  const fetchAnnouncements = async (childId: string) => {
    try {
      setLoading(true);
      const res = await api.get(`/parent-portal/children/${childId}/announcements`);
      setAnnouncements(res.data || []);
    } catch (err) {
      console.error('Failed to fetch announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedChild) {
      fetchAnnouncements(selectedChild.id);
    }
  }, [selectedChild]);

  // Listen to switcher events
  useEffect(() => {
    const handleChildChange = (e: any) => {
      fetchAnnouncements(e.detail);
    };
    window.addEventListener('parentChildChanged', handleChildChange);
    return () => window.removeEventListener('parentChildChanged', handleChildChange);
  }, []);

  const handleAcknowledge = (id: string, title: string) => {
    setAcknowledgedIds(prev => {
      const copy = new Set(prev);
      copy.add(id);
      return copy;
    });
    setSuccessMsg(`Acknowledged announcement: "${title}"`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  if (!selectedChild) {
    return (
      <div className="text-slate-500 text-sm text-center py-12">
        Please select a child to view announcements.
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
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in relative">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          Notice Board: <span className="text-[#2E5BFF] font-extrabold">{selectedChild.name}</span>
        </h2>
        <p className="text-slate-500 text-xs mt-1 font-light">Read general and class-specific announcements issued by the principal or teachers.</p>
      </div>

      {successMsg && (
        <div className="fixed top-4 right-4 z-50 p-4 rounded-xl bg-emerald-600 text-white font-semibold text-xs shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4.5 h-4.5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="space-y-4">
        {announcements.length === 0 ? (
          <div className="bg-white border border-slate-200 p-12 rounded-3xl text-center text-slate-500 shadow-sm">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold">No announcements issued.</p>
            <p className="text-xs font-light mt-1">Check back later for circulars or alerts.</p>
          </div>
        ) : (
          announcements.map((ann: any) => {
            const isHigh = ann.priority === 'High' || ann.priority === 'HIGH';
            const isRead = acknowledgedIds.has(ann.id);
            return (
              <div
                key={ann.id}
                className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex flex-col justify-between hover:border-slate-350 transition-all space-y-4 relative overflow-hidden"
              >
                {isHigh && (
                  <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-rose-500" />
                )}

                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider ${
                        isHigh 
                          ? 'bg-rose-50 border border-rose-100 text-rose-700' 
                          : 'bg-indigo-50 border border-indigo-100 text-indigo-700'
                      }`}>
                        {ann.priority} Priority
                      </span>
                      <span className="text-[10px] text-slate-400 font-light">
                        {new Date(ann.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>

                    {isRead ? (
                      <span className="flex items-center gap-1 text-emerald-600 text-[10px] font-bold uppercase tracking-wider">
                        <ShieldCheck className="w-4 h-4" /> Acknowledged
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAcknowledge(ann.id, ann.title)}
                        className="px-3 py-1 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-700 transition-all font-bold text-[10px] cursor-pointer"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-bold text-slate-800 text-sm leading-snug flex items-center gap-2">
                      {isHigh ? <AlertTriangle className="w-4.5 h-4.5 text-rose-500 shrink-0" /> : <Info className="w-4.5 h-4.5 text-indigo-500 shrink-0" />}
                      {ann.title}
                    </h3>
                    <p className="text-slate-500 text-xs font-normal leading-relaxed whitespace-pre-line">{sanitizeAnnouncementContent(ann.content)}</p>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-[10px] text-slate-400">
                  <span>From: <strong className="text-slate-700 font-bold">{ann.teacher?.user?.name || 'Principal Office'}</strong></span>
                  {ann.audienceType && (
                    <span>Audience: <strong className="text-indigo-600 font-bold uppercase tracking-wider">{ann.audienceType}</strong></span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
