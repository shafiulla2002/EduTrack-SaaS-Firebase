'use client';

import { useState, useEffect } from 'react';
import { Building2, Search, Plus, ExternalLink, ShieldCheck, Mail, Phone } from 'lucide-react';
import { getApiUrl } from '@/lib/api';

export default function SchoolsManagementPage() {
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchSchools = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const baseUrl = getApiUrl();
      const endpoint = `${baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl}/super-admin/tenants`;
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch tenants');
      const data = await res.json();
      setSchools(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchools();
  }, []);

  const filteredSchools = schools.filter(
    (s) =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.subDomain?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">School Tenant Management</h1>
          <p className="text-xs text-slate-400 mt-1">Manage onboarded schools, domains, and subscriptions</p>
        </div>
      </div>

      <div className="relative">
        <Search className="w-5 h-5 absolute left-3 top-3 text-slate-500" />
        <input
          type="text"
          placeholder="Search school name or subdomain..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
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
                <th className="px-6 py-4">School Name</th>
                <th className="px-6 py-4">Subdomain</th>
                <th className="px-6 py-4">Subscription Plan</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Created Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredSchools.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No school tenants found matching query.
                  </td>
                </tr>
              ) : (
                filteredSchools.map((school) => (
                  <tr key={school.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-semibold text-white flex items-center gap-3">
                      <div className="p-2 bg-slate-800 rounded-lg text-blue-400">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div>{school.name}</div>
                        <div className="text-xs text-slate-500 font-normal">{school.address || 'Location N/A'}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-blue-400">
                      {school.subDomain}.edutrack.com
                    </td>
                    <td className="px-6 py-4 font-medium">
                      <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs">
                        {school.subscription?.plan?.name || 'TRIAL'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        school.subscription?.status === 'ACTIVE'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}>
                        {school.subscription?.status || 'TRIAL'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {new Date(school.createdAt).toLocaleDateString()}
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
