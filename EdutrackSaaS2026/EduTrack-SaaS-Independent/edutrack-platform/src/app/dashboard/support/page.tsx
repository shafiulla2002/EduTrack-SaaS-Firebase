'use client';

import { useState } from 'react';
import { HelpCircle, Mail, Phone, Clock, CheckCircle } from 'lucide-react';

export default function SupportAndRequestsPage() {
  const trialRequests = [
    {
      id: '1',
      schoolName: 'St. Xavier High School',
      contactName: 'Principal Robert',
      email: 'principal@stxavier.edu',
      phone: '+91 9812345678',
      requestedDate: '2026-08-05',
      status: 'PENDING',
    },
    {
      id: '2',
      schoolName: 'Delhi Public International',
      contactName: 'Director Sharma',
      email: 'contact@dpi-school.in',
      phone: '+91 9823456789',
      requestedDate: '2026-08-04',
      status: 'APPROVED',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Support Tickets & Trial Requests</h1>
          <p className="text-xs text-slate-400 mt-1">Review incoming school demo requests and platform support inquiries</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="p-4 bg-slate-950 border-b border-slate-800 font-bold text-sm text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <span>School Onboarding Demo & Trial Requests</span>
        </div>
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-950 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th className="px-6 py-4">School Name</th>
              <th className="px-6 py-4">Contact Person</th>
              <th className="px-6 py-4">Email / Phone</th>
              <th className="px-6 py-4">Request Date</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {trialRequests.map((req) => (
              <tr key={req.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="px-6 py-4 font-semibold text-white">{req.schoolName}</td>
                <td className="px-6 py-4">{req.contactName}</td>
                <td className="px-6 py-4 text-xs font-mono text-slate-400">
                  <div>{req.email}</div>
                  <div>{req.phone}</div>
                </td>
                <td className="px-6 py-4 text-xs text-slate-400">{req.requestedDate}</td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      req.status === 'APPROVED'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}
                  >
                    {req.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
