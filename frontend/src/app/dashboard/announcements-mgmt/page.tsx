'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Megaphone, Plus, Trash2, X, AlertTriangle, Pin, Calendar, Users, Eye, Check, BookOpen, Clock } from 'lucide-react';
import { useTenant } from '@/app/providers/TenantContext';
import Drawer from '@/components/Drawer';

function parseExamScheduleContent(content: string) {
  const mainText = content.split('<!--')[0].trim();
  const lines = mainText.split('\n');
  const details: Record<string, string> = {};
  
  let currentKey = '';
  for (const line of lines) {
    if (line.includes(':')) {
      const parts = line.split(':');
      const key = parts[0].trim();
      const value = parts.slice(1).join(':').trim();
      
      if (['Class', 'Subject', 'Date', 'Time'].includes(key)) {
        details[key] = value;
        currentKey = '';
      } else if (key === 'Instructions') {
        details[key] = value;
        currentKey = 'Instructions';
      } else {
        if (currentKey) {
          details[currentKey] += '\n' + line.trim();
        }
      }
    } else {
      if (currentKey && line.trim()) {
        details[currentKey] += '\n' + line.trim();
      }
    }
  }
  
  return {
    classSection: details['Class'] || '',
    subject: details['Subject'] || '',
    date: details['Date'] || '',
    time: details['Time'] || '',
    instructions: details['Instructions'] || ''
  };
}

export default function AnnouncementsMgmtPage() {
  const { currentUser } = useTenant();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form modal visibility
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audienceType, setAudienceType] = useState('CLASS'); // INSTITUTION, CLASS
  const [classSectionId, setClassSectionId] = useState('');
  const [priority, setPriority] = useState('Medium'); // High, Medium, Low
  const [expiryDate, setExpiryDate] = useState('');
  const [pinned, setPinned] = useState(false);

  async function loadData() {
    try {
      const [annRes, clsRes] = await Promise.all([
        api.get('/teacher-portal/announcements'),
        api.get('/teacher-portal/classes'),
      ]);
      setAnnouncements(annRes.data);
      setClasses(clsRes.data);
    } catch (err) {
      console.error('Failed to load announcements:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setTitle('');
    setContent('');
    setAudienceType('CLASS');
    setClassSectionId('');
    setPriority('Medium');
    setExpiryDate('');
    setPinned(false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      title,
      content,
      audienceType,
      classSectionId: audienceType === 'CLASS' ? classSectionId : null,
      priority,
      expiryDate: expiryDate || null,
      pinned,
    };

    try {
      await api.post('/teacher-portal/announcements', payload);
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save announcement:', err);
      alert('Failed to publish announcement.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await api.delete(`/teacher-portal/announcements/${id}`);
      await loadData();
    } catch (err) {
      console.error('Failed to delete announcement:', err);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.post(`/teacher-portal/announcements/${id}/read`);
      setAnnouncements(prev => prev.map(ann => {
        if (ann.id === id) {
          const readStatus = Array.isArray(ann.readStatus) ? [...ann.readStatus] : [];
          if (currentUser?.id && !readStatus.includes(currentUser.id)) {
            readStatus.push(currentUser.id);
          }
          return { ...ann, readStatus };
        }
        return ann;
      }));
      window.dispatchEvent(new Event('announcementRead'));
    } catch (err) {
      console.error('Failed to mark announcement as read:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-4 border-t-[#2E5BFF] border-slate-200 rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500">Loading notices...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-md mx-auto sm:max-w-none pb-20">
      <div className="flex justify-between items-center pb-4 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-[#2E5BFF]" />
          Notices & Broadcasts
        </h2>
        <button
          onClick={openCreateModal}
          className="p-2.5 bg-[#2E5BFF] hover:bg-blue-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Notice
        </button>
      </div>

      {announcements.length === 0 ? (
        <div className="bg-white p-8 text-center rounded-3xl border border-slate-200 shadow-sm text-slate-500 italic text-sm">
          No notices published yet.
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((ann) => {
            const isExamSchedule = ann.content?.includes('<!-- examScheduleId:');
            const cleanContent = ann.content?.split('<!--')[0]?.trim() || '';

            return (
              <div key={ann.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-3 relative hover:border-slate-300 transition-colors duration-150">
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded border uppercase ${
                        ann.priority === 'High' ? 'bg-red-50 text-red-600 border-red-100' :
                        ann.priority === 'Low' ? 'bg-slate-50 text-slate-500 border-slate-200' :
                        'bg-amber-50 text-amber-600 border-amber-100'
                      }`}>
                        {ann.priority} Priority
                      </span>
                      {ann.pinned && (
                        <span className="text-[10px] text-blue-600 flex items-center gap-0.5 font-bold">
                          <Pin className="w-3.5 h-3.5 fill-blue-600/20" /> Pinned
                        </span>
                      )}
                      {(!Array.isArray(ann.readStatus) || !ann.readStatus.includes(currentUser?.id)) && (
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-650 animate-pulse" title="Unread Notice" />
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {(!Array.isArray(ann.readStatus) || !ann.readStatus.includes(currentUser?.id)) && (
                        <button
                          onClick={() => handleMarkAsRead(ann.id)}
                          className="flex items-center gap-0.5 px-2 py-0.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-[10px] font-bold cursor-pointer transition-colors mr-2"
                          title="Mark as Read"
                        >
                          <Check className="w-3 h-3 stroke-[3]" /> Read
                        </button>
                      )}
                      
                      {!isExamSchedule && (currentUser?.role === 'ADMIN' || ann.teacher?.user?.id === currentUser?.id) && (
                        <button onClick={() => handleDelete(ann.id)} className="text-slate-400 hover:text-red-600 transition-colors p-1 cursor-pointer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="font-bold text-slate-800 text-[14px] leading-tight">{ann.title}</h3>
                  
                  {isExamSchedule ? (
                    (() => {
                      const details = parseExamScheduleContent(ann.content);
                      return (
                        <div className="space-y-2 mt-1">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/80 p-3 rounded-lg border border-slate-100">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                              <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              <div className="truncate">
                                <span className="text-[9px] text-slate-400 block font-normal leading-none mb-0.5">Subject</span>
                                {details.subject || 'N/A'}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                              <Users className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <div className="truncate">
                                <span className="text-[9px] text-slate-400 block font-normal leading-none mb-0.5">Class / Section</span>
                                {details.classSection || 'N/A'}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                              <Calendar className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                              <div className="truncate">
                                <span className="text-[9px] text-slate-400 block font-normal leading-none mb-0.5">Exam Date</span>
                                {details.date || 'N/A'}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                              <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <div className="truncate">
                                <span className="text-[9px] text-slate-400 block font-normal leading-none mb-0.5">Timings</span>
                                {details.time || 'N/A'}
                              </div>
                            </div>
                          </div>
                          
                          {details.instructions && (
                            <div className="text-[10px] text-slate-655 bg-indigo-50/30 p-2.5 rounded-lg border border-indigo-100/20 leading-normal">
                              <span className="font-bold text-indigo-800">Special Instructions:</span>{' '}
                              {details.instructions}
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <p className="text-xs text-slate-500 font-light leading-relaxed whitespace-pre-wrap">{cleanContent}</p>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-2.5 flex flex-wrap gap-y-2 justify-between items-center text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3 text-slate-400" />
                    Target:{' '}
                    {ann.audienceType === 'INSTITUTION' ? 'Entire School' :
                     ann.audienceType === 'TEACHERS' ? 'Teaching Staff' :
                     ann.audienceType === 'STAFF' ? 'Non-Teaching Staff' :
                     ann.audienceType === 'PARENTS' ? 'Parents' :
                     ann.audienceType === 'STUDENTS' ? 'Students' :
                     ann.classSection ? `${ann.classSection.class.name} - ${ann.classSection.section.name}` : 'Class Section'}
                  </span>
                  {ann.expiryDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      Expires: {ann.expiryDate.split('T')[0]}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create notice modal */}
      <Drawer
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Draft Notice Announcement"
        size="md"
      >
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 bg-white dark:bg-slate-800">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Headline Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Science Fair registrations closed"
              className="block w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-202 focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Content Details</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write clear instructions for parents / students..."
              rows={6}
              className="block w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-202 focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Audience Scope</label>
              <select
                value={audienceType}
                onChange={(e) => setAudienceType(e.target.value)}
                className="block w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-202 focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-sm font-semibold"
              >
                <option value="CLASS" className="dark:bg-slate-800">Specific Class Section</option>
                <option value="INSTITUTION" className="dark:bg-slate-800">Entire School</option>
                <option value="TEACHERS" className="dark:bg-slate-800">Teaching Staff (Teachers)</option>
                <option value="STAFF" className="dark:bg-slate-800">Non-Teaching Staff (Staff)</option>
                <option value="PARENTS" className="dark:bg-slate-800">Parents</option>
                <option value="STUDENTS" className="dark:bg-slate-800">Students</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Notice Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="block w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-202 focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-sm font-semibold"
              >
                <option value="High" className="dark:bg-slate-800">🔴 High</option>
                <option value="Medium" className="dark:bg-slate-800">🟡 Medium</option>
                <option value="Low" className="dark:bg-slate-800">⚪ Low</option>
              </select>
            </div>
          </div>

          {audienceType === 'CLASS' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Target Class Section</label>
              <select
                value={classSectionId}
                onChange={(e) => setClassSectionId(e.target.value)}
                className="block w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-202 focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-sm font-semibold"
                required
              >
                <option value="" className="dark:bg-slate-800">Select Class Section...</option>
                {classes.map(c => <option key={c.classSectionId} value={c.classSectionId} className="dark:bg-slate-800">{c.className}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Expiry Date (Optional)</label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="block w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-202 focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-sm font-semibold"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="pinned"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="rounded border-slate-350 text-[#2E5BFF] focus:ring-[#2E5BFF] w-4.5 h-4.5"
            />
            <label htmlFor="pinned" className="text-xs font-bold text-slate-600 dark:text-slate-400">Pin to top of Notice Board</label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-[#2E5BFF] hover:bg-blue-600 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/10 cursor-pointer disabled:opacity-50 mt-4 transition-all"
          >
            {submitting ? 'Publishing...' : 'Broadcast Notice'}
          </button>
        </form>
      </Drawer>
    </div>
  );
}
