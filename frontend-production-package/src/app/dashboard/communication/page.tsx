'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { MessageSquare, Send, CheckCircle2, AlertCircle, Users, Search } from 'lucide-react';

export default function CommunicationPage() {
  const [audience, setAudience] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Form states
  const [recipientType, setRecipientType] = useState('CLASS'); // CLASS, INDIVIDUAL_STUDENT, INDIVIDUAL_PARENT
  const [selectedClassSection, setSelectedClassSection] = useState('');
  const [selectedRecipientId, setSelectedRecipientId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');

  async function loadAudience() {
    try {
      const res = await api.get('/teacher-portal/communication/audience');
      setAudience(res.data);
    } catch (err) {
      console.error('Failed to load audience list:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAudience();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setSending(true);

    const payload = {
      recipientType,
      classSectionId: recipientType === 'CLASS' ? selectedClassSection : null,
      recipientUserId: recipientType !== 'CLASS' ? selectedRecipientId : null,
      subject,
      body,
    };

    try {
      await api.post('/teacher-portal/communication/send', payload);
      setMessage({ type: 'success', text: 'Message broadcast sent and queued successfully.' });
      setSubject('');
      setBody('');
      setSelectedClassSection('');
      setSelectedRecipientId('');
    } catch (err) {
      console.error('Send broadcast error:', err);
      setMessage({ type: 'error', text: 'Failed to dispatch messaging broadcast.' });
    } finally {
      setSending(false);
    }
  };

  const getFilteredIndividuals = () => {
    if (!audience?.students) return [];
    return audience.students.filter((s: any) =>
      s.name.toLowerCase().includes(studentSearchTerm.toLowerCase()),
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-4 border-t-[#2E5BFF] border-slate-200 rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500">Loading directory audience...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-md mx-auto sm:max-w-none pb-20">
      <div className="flex justify-between items-center pb-4 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-[#2E5BFF]" />
          Dispatch Communication Broadcast
        </h2>
      </div>

      {message.text && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
          'bg-rose-50 text-rose-700 border-rose-200'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Form */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <form onSubmit={handleSend} className="space-y-5">
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Recipient Scope</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => { setRecipientType('CLASS'); setSelectedRecipientId(''); }}
                className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all border ${
                  recipientType === 'CLASS'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Class Section
              </button>
              <button
                type="button"
                onClick={() => { setRecipientType('INDIVIDUAL_STUDENT'); setSelectedClassSection(''); }}
                className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all border ${
                  recipientType === 'INDIVIDUAL_STUDENT'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Student
              </button>
              <button
                type="button"
                onClick={() => { setRecipientType('INDIVIDUAL_PARENT'); setSelectedClassSection(''); }}
                className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all border ${
                  recipientType === 'INDIVIDUAL_PARENT'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Parent
              </button>
            </div>
          </div>

          {/* Conditional dropdown fields */}
          {recipientType === 'CLASS' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target Class Section</label>
              <select
                value={selectedClassSection}
                onChange={(e) => setSelectedClassSection(e.target.value)}
                className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-sm"
                required
              >
                <option value="">Select Class Section...</option>
                {audience?.classes?.map((c: any) => (
                  <option key={c.classSectionId} value={c.classSectionId}>{c.className}</option>
                ))}
              </select>
            </div>
          )}

          {recipientType !== 'CLASS' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Find Recipient Name</label>
                <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <Search className="w-4 h-4 text-slate-400 mr-2" />
                  <input
                    type="text"
                    placeholder="Search roster..."
                    value={studentSearchTerm}
                    onChange={(e) => setStudentSearchTerm(e.target.value)}
                    className="bg-transparent border-none text-[12px] font-semibold text-slate-700 outline-none w-full placeholder-slate-400"
                  />
                </div>
              </div>

              <div>
                <select
                  value={selectedRecipientId}
                  onChange={(e) => setSelectedRecipientId(e.target.value)}
                  className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-sm"
                  required
                >
                  <option value="">Select Recipient...</option>
                  {getFilteredIndividuals().map((ind: any) => (
                    <option key={ind.userId} value={ind.userId}>
                      {ind.name} {recipientType === 'INDIVIDUAL_PARENT' ? '(Parent)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Subject / Headline</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Science lab requirements for tomorrow"
              className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Message Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type message content here..."
              rows={6}
              className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-sm"
              required
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md hover:bg-slate-800 cursor-pointer disabled:opacity-50"
          >
            <Send className="w-4 h-4" /> {sending ? 'Broadcasting...' : 'Dispatch Broadcast'}
          </button>
        </form>
      </div>
    </div>
  );
}
