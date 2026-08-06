'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Search, Key, ChevronRight, Users, User, ShieldCheck, Mail, Phone, Calendar } from 'lucide-react';
import { getApiUrl } from '@/lib/api';

export default function SchoolsManagementPage() {
  const router = useRouter();
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const fetchSchools = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const baseUrl = getApiUrl();
      const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const endpoint = `${cleanUrl}/super-admin/schools`;
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch school tenants');
      const data = await res.json();
      setSchools(data);
    } catch (err) {
      console.error('Error fetching schools:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchools();
  }, []);

  const handleImpersonate = async (e: React.MouseEvent, schoolId: string, schoolName: string) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem('token');
      const baseUrl = getApiUrl();
      const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const res = await fetch(`${cleanUrl}/super-admin/impersonate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ schoolId }),
      });
      const result = await res.json();
      if (res.ok && result.access_token) {
        localStorage.setItem('admin_token', result.access_token);
        localStorage.setItem('admin_tenantId', result.user.tenantId);
        sessionStorage.setItem('impersonating_from_platform', 'true');
        sessionStorage.setItem('impersonated_school_name', schoolName);
        window.location.href = 'http://localhost:3000/dashboard';
      } else {
        alert(result.message || 'Impersonation failed');
      }
    } catch (err: any) {
      alert(`Impersonation error: ${err.message}`);
    }
  };

  const filteredSchools = schools.filter((s) => {
    const matchesSearch =
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.code?.toLowerCase().includes(search.toLowerCase()) ||
      s.subDomain?.toLowerCase().includes(search.toLowerCase()) ||
      s.adminEmail?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-500" />
            Global School Tenant Console
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Master directory of all registered school tenants in the PostgreSQL database ({schools.length} total schools).
          </p>
        </div>
      </div>

      {/* Controls: Search & Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search school name, subdomain, or admin email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto text-xs font-semibold">
          {['ALL', 'ACTIVE', 'TRIAL', 'EXPIRED', 'SUSPENDED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-2 rounded-xl transition-all ${
                statusFilter === st
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Schools Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs animate-pulse">Loading database school tenants...</div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <th className="p-4">School Name</th>
                <th className="p-4">Subdomain / Code</th>
                <th className="p-4">School Admin</th>
                <th className="p-4">Plan & Status</th>
                <th className="p-4">Students</th>
                <th className="p-4">Teachers</th>
                <th className="p-4">Created Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {filteredSchools.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No school tenants matching query.
                  </td>
                </tr>
              ) : (
                filteredSchools.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => router.push(`/dashboard/schools/${s.id}`)}
                    className="hover:bg-slate-800/60 transition-colors cursor-pointer group"
                  >
                    <td className="p-4">
                      <div className="font-bold text-white group-hover:text-blue-400 transition-colors flex items-center gap-2">
                        <span>{s.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{s.address}</div>
                    </td>

                    <td className="p-4 font-mono text-blue-400">
                      {s.subDomain || s.code}.edutrack.com
                    </td>

                    <td className="p-4">
                      <div className="font-semibold text-slate-200">{s.adminName}</div>
                      <div className="text-[11px] text-slate-400">{s.adminEmail}</div>
                    </td>

                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                          {s.plan || 'BASIC'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          s.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {s.status || 'ACTIVE'}
                        </span>
                      </div>
                    </td>

                    <td className="p-4 font-bold text-white">{s.totalStudents || 0}</td>
                    <td className="p-4 font-bold text-slate-300">{s.totalTeachers || 0}</td>
                    <td className="p-4 text-slate-400">{new Date(s.createdAt || Date.now()).toLocaleDateString()}</td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => handleImpersonate(e, s.id, s.name)}
                          className="px-2.5 py-1.5 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/60 rounded-lg font-semibold flex items-center gap-1 transition-all"
                          title="Impersonate Admin"
                        >
                          <Key className="w-3.5 h-3.5" />
                          <span>Impersonate</span>
                        </button>
                        <div className="p-1 text-slate-400 group-hover:text-white transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
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
