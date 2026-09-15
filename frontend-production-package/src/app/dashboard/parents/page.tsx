'use client';

import React, { useState, useEffect } from 'react';
import { Users, Mail, Phone, Search, Bell, Send, CheckCircle2 } from 'lucide-react';
import { api, fastGet } from '@/lib/api';

interface Parent {
  id: string;
  name: string;
  email: string;
  phone: string;
  children: string[];
}

export default function ParentsDirectory() {
  const [search, setSearch] = useState('');
  const [alertSuccess, setAlertSuccess] = useState(false);
  const [notifiedParentName, setNotifiedParentName] = useState('');
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadParents = async () => {
    try {
      setLoading(true);
      const res = await fastGet('/students/parents/all', undefined, { ttlMs: 30000 });
      setParents(res.data.map((p: any) => ({
        id: p.id,
        name: p.user?.name || 'Unknown Parent',
        email: p.user?.email || 'N/A',
        phone: p.user?.phone || 'N/A',
        children: p.students?.map((s: any) => s.user?.name).filter(Boolean) || []
      })));
    } catch (err) {
      console.error('Failed to load parents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadParents();
  }, []);

  // Filter parents
  const filteredParents = parents.filter(
    (parent) =>
      parent.name.toLowerCase().includes(search.toLowerCase()) ||
      parent.email.toLowerCase().includes(search.toLowerCase()) ||
      parent.phone.includes(search)
  );

  const handleSendNotification = (parent: Parent) => {
    setNotifiedParentName(parent.name);
    setAlertSuccess(true);
    setTimeout(() => {
      setAlertSuccess(false);
      setNotifiedParentName('');
    }, 3000);
  };

  return (
    <div className="space-y-8 relative">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Parent Accounts & Linkage
          </h1>
          <p className="text-slate-400 text-sm font-light mt-1">
            Track parent portals, monitor emergency contact channels, and view active child registrations.
          </p>
        </div>
        <div className="text-slate-400 text-xs font-semibold bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
          Active Guardians: <span className="text-brand-400 font-bold">{parents.length}</span>
        </div>
      </div>

      {/* Toast Alert */}
      {alertSuccess && (
        <div className="fixed top-4 right-4 z-50 p-4 rounded-xl bg-emerald-500 text-white font-semibold text-xs shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          Alert notification dispatched to {notifiedParentName}!
        </div>
      )}

      {/* Filter */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
        <input
          type="text"
          placeholder="Search by parent name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-900 border border-slate-900 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500/50"
        />
      </div>

      {/* Grid of parent cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredParents.map((parent) => (
          <div
            key={parent.id}
            className="glass-panel p-6 rounded-2xl flex flex-col justify-between hover:border-brand-500/20 transition-all shadow-xl space-y-6"
          >
            {/* Header / Name */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-slate-200 text-base">{parent.name}</h3>
                <span className="text-[10px] text-slate-500 font-light block mt-0.5">Primary Guardian Account</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-850 flex items-center justify-center text-slate-400">
                <Users className="w-5 h-5" />
              </div>
            </div>

            {/* Sub-Roster Details */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                <span>{parent.email}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                <span>{parent.phone}</span>
              </div>
            </div>

            {/* Linked Children */}
            <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-900 space-y-2">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Linked Student Accounts</span>
              <div className="flex flex-wrap gap-2">
                {parent.children.map((child, index) => (
                  <span
                    key={index}
                    className="px-2.5 py-1 rounded-lg bg-brand-500/5 border border-brand-500/20 text-brand-300 text-xs font-medium"
                  >
                    {child}
                  </span>
                ))}
                {parent.children.length === 0 && (
                  <span className="text-slate-500 text-xs italic font-light">No active child profiles linked.</span>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="border-t border-slate-900 pt-4 flex justify-between items-center text-xs">
              <span className="text-[10px] text-slate-500 italic">ID: {parent.id}</span>
              <button
                onClick={() => handleSendNotification(parent)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-800 bg-slate-950 text-brand-300 hover:text-white hover:border-brand-500/30 transition-all font-semibold flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Send Alert Code
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
