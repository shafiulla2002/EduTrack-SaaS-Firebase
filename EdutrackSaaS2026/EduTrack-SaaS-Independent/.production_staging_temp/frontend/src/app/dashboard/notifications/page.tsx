'use client';

import React, { useState } from 'react';
import { Bell, Send, CheckCircle2, MessageSquare, ShieldAlert } from 'lucide-react';

export default function NotificationsPage() {
  const [channels, setChannels] = useState({
    email: true,
    sms: false,
    inApp: true
  });
  
  const [recipientGroup, setRecipientGroup] = useState('ALL_PARENTS');
  const [messageText, setMessageText] = useState('');
  const [successToast, setSuccessToast] = useState(false);

  // Sent logs history
  const [notificationLogs, setNotificationLogs] = useState([
    { id: 'notif-1', date: '2026-06-12', recipients: 'All Parents', text: 'Reminder: First Term fee payment deadline is June 20th.', channels: 'Email, In-App' },
    { id: 'notif-2', date: '2026-06-15', recipients: 'Grade 10 Teachers', text: 'Faculty Meeting scheduled for today at 3:00 PM in Seminar Hall.', channels: 'Email, SMS' },
  ]);

  const handleDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText) return;

    const selectedChannels = Object.entries(channels)
      .filter(([_, active]) => active)
      .map(([name]) => name.toUpperCase())
      .join(', ');

    const newLog = {
      id: `notif-${notificationLogs.length + 1}`,
      date: new Date().toISOString().split('T')[0],
      recipients: recipientGroup.replace('_', ' '),
      text: messageText,
      channels: selectedChannels || 'In-App'
    };

    setNotificationLogs([newLog, ...notificationLogs]);
    setSuccessToast(true);
    setMessageText('');
    setTimeout(() => {
      setSuccessToast(false);
    }, 3500);
  };

  return (
    <div className="space-y-8 relative">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Broadcast Communication Hub
          </h1>
          <p className="text-slate-400 text-sm font-light mt-1">
            Dispatch announcements, emergency alerts, fee reminders and schedules across mobile SMS and email channels.
          </p>
        </div>
      </div>

      {successToast && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center gap-3 text-sm animate-pulse">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>Broadcast dispatched. 120 API payloads queued in communication queue.</span>
        </div>
      )}

      {/* Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Compose Panel */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl shadow-xl h-fit space-y-6">
          <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-brand-400" />
            Compose Announcement Broadcast
          </h3>

          <form onSubmit={handleDispatch} className="space-y-4">
            {/* Recipient scope */}
            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1">Target Audience Group</label>
              <select
                value={recipientGroup}
                onChange={(e) => setRecipientGroup(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none"
              >
                <option value="ALL_PARENTS">All Registered Parents</option>
                <option value="ALL_TEACHERS">All Faculty Staff</option>
                <option value="GRADE_10_PARENTS">Grade 10 Guardian list</option>
                <option value="SYSTEM_ADMINS">System Managers</option>
              </select>
            </div>

            {/* Channels selectors */}
            <div className="space-y-2">
              <label className="block text-xs text-slate-400 font-semibold">Active Dispatch Channels</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={channels.email}
                    onChange={(e) => setChannels({ ...channels, email: e.target.checked })}
                    className="rounded bg-slate-900 border-slate-800 text-brand-500 focus:ring-0 focus:ring-offset-0"
                  />
                  <span>SMTP Email Alerts</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={channels.sms}
                    onChange={(e) => setChannels({ ...channels, sms: e.target.checked })}
                    className="rounded bg-slate-900 border-slate-800 text-brand-500 focus:ring-0 focus:ring-offset-0"
                  />
                  <span>Twilio SMS Gateway</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={channels.inApp}
                    onChange={(e) => setChannels({ ...channels, inApp: e.target.checked })}
                    className="rounded bg-slate-900 border-slate-800 text-brand-500 focus:ring-0 focus:ring-offset-0"
                  />
                  <span>In-App Dashboard Banner</span>
                </label>
              </div>
            </div>

            {/* Message Area */}
            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1">Message Body Text</label>
              <textarea
                required
                rows={4}
                placeholder="Write announcement body message here..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-brand-500/10 flex items-center gap-1.5"
            >
              <Send className="w-4 h-4 text-brand-200" />
              Dispatch Queue Broadcast
            </button>
          </form>
        </div>

        {/* History Log */}
        <div className="glass-panel p-6 rounded-2xl shadow-xl h-fit space-y-4">
          <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
            <Bell className="w-4 h-4 text-slate-400" />
            Sent Message History
          </h3>
          <div className="divide-y divide-slate-900/60 text-xs">
            {notificationLogs.map((log) => (
              <div key={log.id} className="py-3.5 space-y-2">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-bold text-brand-300 uppercase">{log.recipients}</span>
                  <span className="text-slate-500 italic">{log.date}</span>
                </div>
                <p className="text-slate-300 font-light leading-relaxed">{log.text}</p>
                <div className="text-[10px] text-slate-500 font-mono">Channels: {log.channels}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
