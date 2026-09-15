'use client';

import React, { useState } from 'react';
import { ShieldAlert, Search, UserCheck, Key, Lock, Unlock } from 'lucide-react';

export default function UserManagementPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [successToast, setSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Initial user list
  const [users, setUsers] = useState([
    { id: 'usr-1', name: 'Sarah Jenkins', email: 'admin@demoschool.com', role: 'SCHOOL_ADMIN', status: 'ACTIVE' },
    { id: 'usr-2', name: 'James Smith', email: 'teacher.james@school.com', role: 'TEACHER', status: 'ACTIVE' },
    { id: 'usr-3', name: 'Mary Garcia', email: 'parent.mary@example.com', role: 'PARENT', status: 'ACTIVE' },
    { id: 'usr-4', name: 'John Doe', email: 'john.doe@school.com', role: 'STUDENT', status: 'ACTIVE' },
    { id: 'usr-5', name: 'Marie Curie', email: 'teacher.marie@school.com', role: 'TEACHER', status: 'LOCKED' },
  ]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setSuccessToast(true);
    setTimeout(() => {
      setSuccessToast(false);
      setToastMessage('');
    }, 3000);
  };

  const handleToggleStatus = (userId: string) => {
    setUsers(
      users.map((u) => {
        if (u.id === userId) {
          const newStatus = u.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
          triggerToast(`User account status updated to ${newStatus}`);
          return { ...u, status: newStatus };
        }
        return u;
      })
    );
  };

  const handleResetPassword = (name: string) => {
    triggerToast(`Password reset link dispatched to ${name}'s verified mailbox.`);
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'All' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-8 relative">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            User Security Control
          </h1>
          <p className="text-slate-400 text-sm font-light mt-1">
            Manage multi-tenant login profiles, assign RBAC auth roles, and execute credentials reset operations.
          </p>
        </div>
      </div>

      {successToast && (
        <div className="fixed top-4 right-4 z-50 p-4 rounded-xl bg-emerald-500 text-white font-semibold text-xs shadow-2xl flex items-center gap-2 animate-bounce">
          <UserCheck className="w-4 h-4" />
          {toastMessage}
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search accounts by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-900 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-slate-900 border border-slate-900 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none"
        >
          <option value="All">All Roles</option>
          <option value="SCHOOL_ADMIN">School Admin</option>
          <option value="TEACHER">Teacher</option>
          <option value="PARENT">Parent</option>
          <option value="STUDENT">Student</option>
        </select>
      </div>

      {/* Ledger Table */}
      <div className="glass-panel rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-900/60 bg-slate-900/10 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="px-6 py-4">Account Profile</th>
                <th className="px-6 py-4">Security Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/60 text-slate-300 text-sm">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-900/10 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-200">
                    <div>{u.name}</div>
                    <div className="text-xs text-slate-500 font-light">{u.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] text-brand-300 bg-brand-500/10 border border-brand-500/20 px-2.5 py-0.5 rounded-full font-bold">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      u.status === 'ACTIVE' 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right flex justify-end gap-2 text-xs">
                    <button
                      onClick={() => handleResetPassword(u.name)}
                      className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-brand-300 border border-slate-850"
                      title="Reset Password Mail"
                    >
                      <Key className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(u.id)}
                      className={`p-1.5 rounded border border-slate-850 ${
                        u.status === 'ACTIVE'
                          ? 'bg-slate-900 hover:bg-slate-800 text-red-400 hover:text-red-300'
                          : 'bg-slate-900 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300'
                      }`}
                      title={u.status === 'ACTIVE' ? 'Lock Account' : 'Unlock Account'}
                    >
                      {u.status === 'ACTIVE' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
