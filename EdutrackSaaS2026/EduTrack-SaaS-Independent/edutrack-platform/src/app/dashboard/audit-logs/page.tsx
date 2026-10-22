'use client';

import { useState, useEffect } from 'react';
import { FileText, Shield, User, Calendar, Activity } from 'lucide-react';
import { getApiUrl } from '@/lib/api';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const baseUrl = getApiUrl();
      const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const res = await fetch(`${cleanUrl}/activity-logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setLogs(Array.isArray(data) ? data : data.logs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Platform Audit Logs</h1>
          <p className="text-xs text-slate-400 mt-1">Audit trail tracking administrative actions across platform and tenants</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Details</th>
                <th className="px-6 py-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                    No activity audit logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log: any, idx: number) => (
                  <tr key={log.id || idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-semibold text-white flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-400" />
                      <span>{log.action || log.event || 'ADMIN_ACTION'}</span>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-300">
                      {log.performedBy || log.userEmail || log.userName || 'Super Admin'}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">
                      {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {new Date(log.createdAt || log.timestamp || Date.now()).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
