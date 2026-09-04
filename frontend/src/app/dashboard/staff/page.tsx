'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, Plus, X, Search, Phone, Mail, Calendar,
  ChevronRight, ChevronDown, Edit2, Trash2, Clock, BookOpen, Check
} from 'lucide-react';
import { formatDateDDMMYYYY } from '@/lib/date';

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#667eea,#764ba2)',
  'linear-gradient(135deg,#f093fb,#f5576c)',
  'linear-gradient(135deg,#4facfe,#00f2fe)',
  'linear-gradient(135deg,#43e97b,#38f9d7)',
  'linear-gradient(135deg,#fa709a,#fee140)',
  'linear-gradient(135deg,#a18cd1,#fbc2eb)',
  'linear-gradient(135deg,#fd7043,#ff8a65)',
  'linear-gradient(135deg,#26c6da,#00acc1)',
  'linear-gradient(135deg,#2E5BFF,#1E3FCC)',
  'linear-gradient(135deg,#00c48c,#00a070)',
];

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  employeeId: string;
  designation: string;
  department: string;
  staffType: 'Teaching' | 'Non-Teaching';
  subject: string;
  basicSalary: number;
  hra: number;
  da: number;
  pf: number;
  joiningDate: string;
  qualification: string;
  gender: string;
  dob: string;
  address: string;
  status: 'Active' | 'On Leave' | 'Inactive';
  accountNumber: string;
  ifsc: string;
  skills: { subject: string; level: string; exp: number }[];
  salaryStatus: 'Paid' | 'Pending';
  gradient: string;
  avatarUrl?: string;
}

import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { dispatchSchoolSetupUpdated } from '@/lib/events';
import { resizeAndCompressImage } from '@/lib/image';

export default function SchoolStaffPage() {
  const { showToast } = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    id: string;
    name: string;
  }>({
    show: false,
    id: '',
    name: ''
  });

  const handleConfirmDelete = async () => {
    try {
      await api.delete(`/teachers/${deleteConfirm.id}`);
      showToast('Staff member deleted successfully.', 'success');
      // Dispatch event to refresh dashboard in real-time
      dispatchSchoolSetupUpdated();
      setSelectedStaff(null);
      setDeleteConfirm({ show: false, id: '', name: '' });
      loadStaff();
    } catch (err: any) {
      console.error('Error deleting staff:', err);
      showToast(err.response?.data?.message || 'Failed to delete staff member.', 'error');
    }
  };
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'teaching' | 'non-teaching' | 'salary'>('all');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const payrollMonths = useMemo(() => {
    const list: string[] = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    for (let year = currentYear + 1; year >= currentYear - 2; year--) {
      for (let month = 11; month >= 0; month--) {
        const d = new Date(year, month, 1);
        list.push(d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
      }
    }
    return list;
  }, []);

  const [selectedPayrollMonth, setSelectedPayrollMonth] = useState(() => {
    const now = new Date();
    return now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  });

  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const monthDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target as Node)) {
        setIsMonthDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [staffSalaryInvoices, setStaffSalaryInvoices] = useState<any[]>([]);
  const [staffSchedule, setStaffSchedule] = useState<any[]>([]);
  const [staffCases, setStaffCases] = useState<any[]>([]);
  const [staffDetailLoading, setStaffDetailLoading] = useState(false);

  useEffect(() => {
    const isModalOpen = selectedStaff !== null || showAddModal || editingStaff !== null || deleteConfirm.show;
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedStaff, showAddModal, editingStaff, deleteConfirm.show]);

  const loadStaffDetail = async (staffId: string, isTeaching: boolean) => {
    setStaffDetailLoading(true);
    setStaffSalaryInvoices([]);
    setStaffSchedule([]);
    setStaffCases([]);
    try {
      const [invoicesRes, casesRes, scheduleRes] = await Promise.allSettled([
        api.get(`/teachers/${staffId}/salary-invoices`),
        api.get(`/teachers/${staffId}/cases`),
        isTeaching ? api.get(`/teachers/${staffId}/schedule`) : Promise.resolve({ data: [] }),
      ]);
      setStaffSalaryInvoices(invoicesRes.status === 'fulfilled' ? (invoicesRes.value.data || []) : []);
      setStaffCases(casesRes.status === 'fulfilled' ? (casesRes.value.data || []) : []);
      setStaffSchedule(scheduleRes.status === 'fulfilled' ? (scheduleRes.value.data || []) : []);
    } catch {
      // silently ignore — empty state shown
    } finally {
      setStaffDetailLoading(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const result = await resizeAndCompressImage(file);
        setPhotoPreview(result);
      } catch (err) {
        console.error('Error compressing photo:', err);
      }
    }
  };

  const [formType, setFormType] = useState<'Teaching' | 'Non-Teaching'>('Teaching');
  const [formSkills, setFormSkills] = useState<{ id: number; subject: string; level: string; exp: number }[]>([
    { id: 1, subject: '', level: 'Expert', exp: 3 }
  ]);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    designation: '',
    department: '',
    basicSalary: 30000,
    hra: 3600,
    da: 2400,
    pf: 1500,
    joiningDate: '',
    qualification: '',
    gender: '',
    dob: '',
    address: '',
    status: 'Active' as const,
    accountNumber: '',
    ifsc: ''
  });

  const loadStaff = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (deptFilter) params.append('department', deptFilter);
      if (statusFilter) params.append('status', statusFilter);

      const res = await api.get(`/teachers?${params.toString()}`);
      setStaff(res.data.map((t: any, idx: number) => {
        const nameParts = t.user?.name ? t.user.name.split(' ') : ['Teacher'];
        const firstName = nameParts[0] || 'Teacher';
        const lastName = nameParts.slice(1).join(' ') || '';
        return {
          id: t.id,
          firstName,
          lastName,
          name: t.user?.name || 'Unknown Teacher',
          initials: (firstName[0] || '') + (lastName[0] || ''),
          email: t.user?.email || '',
          phone: t.user?.phone || '',
          avatarUrl: t.user?.avatarUrl || null,
          employeeId: t.employeeId || `EMP-T-${t.id.substring(0, 4).toUpperCase()}`,
          designation: t.designation || 'Teacher',
          department: (t.subjectsTaught && t.subjectsTaught.length > 0) ? t.subjectsTaught[0] : (
                      t.designation?.toLowerCase().includes('teacher') ? 'Science' : 
                      t.designation?.toLowerCase().includes('driver') ? 'Transport' : 
                      t.designation?.toLowerCase().includes('librarian') ? 'Library' :
                      t.designation?.toLowerCase().includes('account') ? 'Finance' : 
                      t.designation?.toLowerCase().includes('security') ? 'Security' : 'Administration'
          ),
          staffType: (t.user?.role === 'STAFF' || t.user?.role === 'DRIVER') ? 'Non-Teaching' : 'Teaching',
          subject: t.subjectsTaught?.[0] || 'General',
          basicSalary: Number(t.basicSalary) || 25000,
          hra: Number(t.allowances) || 0,
          da: 0,
          pf: Number(t.pfDeduction) || 0,
          joiningDate: t.joiningDate ? new Date(t.joiningDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          qualification: t.qualification || '',
          gender: 'General',
          dob: '',
          address: '',
          status: t.status || 'Active',
          accountNumber: '',
          ifsc: '',
          skills: t.teacherSkills?.length > 0
            ? t.teacherSkills.map((sk: any) => ({
                subject: sk.subject?.name || sk.subjectId || 'Unknown',
                level: sk.skillLevel || 'Expert',
                exp: sk.yearsOfExperience ?? 0,
              }))
            : (t.subjectsTaught?.map((sub: string) => ({ subject: sub, level: 'Expert', exp: 5 })) || []),
          salaryStatus: 'Pending',
          gradient: AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]
        };
      }));
    } catch (err) {
      console.error('Failed to load staff list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, [search, deptFilter, statusFilter]);

  const handlePaySalary = async (id: string) => {
    try {
      await api.post(`/teachers/${id}/pay-salary`, { month: selectedPayrollMonth });
      showToast('Salary disbursed successfully.', 'success');
      // Dispatch event to refresh dashboard in real-time
      dispatchSchoolSetupUpdated();
      setStaff(prev => prev.map(m => m.id === id ? { ...m, salaryStatus: 'Paid' } : m));
      // If this staff member's profile modal is open, refresh the invoice list
      if (selectedStaff?.id === id) {
        loadStaffDetail(id, selectedStaff.staffType === 'Teaching');
      }
    } catch (err: any) {
      console.error('Error paying salary:', err);
      showToast(err.response?.data?.message || 'Failed to disburse salary.', 'error');
    }
  };

  const handleProcessAll = async () => {
    try {
      await api.post('/teachers/pay-all-salaries', { month: selectedPayrollMonth });
      showToast('All salaries processed successfully!', 'success');
      // Dispatch event to refresh dashboard in real-time
      dispatchSchoolSetupUpdated();
      setStaff(prev => prev.map(m => ({ ...m, salaryStatus: 'Paid' })));
    } catch (err: any) {
      console.error('Error processing all salaries:', err);
      showToast(err.response?.data?.message || 'Failed to process all salaries.', 'error');
    }
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/teachers', {
        name: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        phone: formData.phone,
        employeeId: formData.designation.toUpperCase().substring(0,3) + '-' + Math.floor(100 + Math.random() * 900),
        designation: formData.designation,
        basicSalary: Number(formData.basicSalary),
        allowances: Number(formData.hra),
        pfDeduction: Number(formData.pf),
        joiningDate: formData.joiningDate || new Date().toISOString().slice(0, 10),
        qualification: formData.qualification,
        subjectsTaught: formType === 'Teaching'
          ? formSkills.map(s => s.subject).filter(Boolean)
          : [formData.department].filter(Boolean),
        staffType: formType,
        status: 'Active',
        avatarUrl: photoPreview || null
      });

      setShowAddModal(false);
      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        designation: '',
        department: '',
        basicSalary: 30000,
        hra: 3600,
        da: 2400,
        pf: 1500,
        joiningDate: '',
        qualification: '',
        gender: '',
        dob: '',
        address: '',
        status: 'Active',
        accountNumber: '',
        ifsc: ''
      });
      setFormSkills([{ id: 1, subject: '', level: 'Expert', exp: 3 }]);
      setPhotoPreview(null);
      loadStaff();
      // Dispatch event to refresh dashboard in real-time
      dispatchSchoolSetupUpdated();
      showToast('Staff member registered successfully.', 'success');
    } catch (err: any) {
      console.error('Failed to save staff member:', err);
      showToast(err.response?.data?.message || 'Failed to save staff member', 'error');
    }
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    try {
      await api.put(`/teachers/${editingStaff.id}`, {
        name: editingStaff.name,
        email: editingStaff.email,
        phone: editingStaff.phone,
        employeeId: editingStaff.employeeId,
        designation: editingStaff.designation,
        basicSalary: Number(editingStaff.basicSalary),
        allowances: Number(editingStaff.hra),
        pfDeduction: Number(editingStaff.pf),
        joiningDate: editingStaff.joiningDate,
        qualification: editingStaff.qualification,
        status: editingStaff.status,
        avatarUrl: editingStaff.avatarUrl || null,
        subjectsTaught: editingStaff.staffType === 'Teaching'
          ? (editingStaff.skills ? editingStaff.skills.map((s: any) => s.subject).filter(Boolean) : [])
          : [editingStaff.department].filter(Boolean),
        skills: editingStaff.staffType === 'Teaching'
          ? (editingStaff.skills ? editingStaff.skills.map((s: any) => ({
              subject: s.subject,
              level: s.level,
              exp: s.exp
            })).filter((s: any) => s.subject) : [])
          : []
      });
      setEditingStaff(null);
      loadStaff();
      // Dispatch event to refresh dashboard in real-time
      dispatchSchoolSetupUpdated();
      showToast('Staff member updated successfully.', 'success');
    } catch (err: any) {
      console.error('Failed to update staff:', err);
      showToast(err.response?.data?.message || 'Failed to update staff member', 'error');
    }
  };

  const totalStaff = staff.length;
  const teachingCount = staff.filter(s => s.staffType === 'Teaching').length;
  const nonTeachingCount = staff.filter(s => s.staffType === 'Non-Teaching').length;
  const totalMonthlySalary = '₹' + staff.reduce((acc, m) => acc + (m.basicSalary + m.hra + m.da - m.pf), 0).toLocaleString('en-IN');

  const filteredStaff = staff.filter(m => {
    if (activeTab === 'teaching' && m.staffType !== 'Teaching') return false;
    if (activeTab === 'non-teaching' && m.staffType !== 'Non-Teaching') return false;

    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) || 
                          m.employeeId.toLowerCase().includes(search.toLowerCase()) ||
                          m.email.toLowerCase().includes(search.toLowerCase());

    const matchesDept = deptFilter 
      ? (m.department === deptFilter || (m.staffType === 'Teaching' && m.skills?.some((sk: any) => sk.subject === deptFilter)))
      : true;
    const matchesStatus = statusFilter ? m.status === statusFilter : true;

    return matchesSearch && matchesDept && matchesStatus;
  });

  const paidCount = staff.filter(m => m.salaryStatus === 'Paid').length;
  const pendingCount = staff.filter(m => m.salaryStatus === 'Pending').length;

  const tabs = [
    { key: 'all', label: 'All Staff' },
    { key: 'teaching', label: '👩‍🏫 Teaching' },
    { key: 'non-teaching', label: '🧹 Non-Teaching' },
    { key: 'salary', label: '💳 Payroll' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-[26px] font-bold text-slate-900 leading-none">School Staff</h2>
          <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-600 text-[10px] font-extrabold uppercase tracking-wider border border-orange-200">
            STAFF DIRECTORY
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleProcessAll}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm shadow-sm cursor-pointer"
          >
            ⚡ Process All Salaries
          </button>
          <button
            onClick={() => { setFormType('Teaching'); setShowAddModal(true); }}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Staff
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Staff', value: totalStaff, icon: '👥', sub: 'Real-time from Org' },
          { label: 'Teaching Staff', value: teachingCount, icon: '📚', sub: 'Real-time from Org' },
          { label: 'Non-Teaching Staff', value: nonTeachingCount, icon: '✏️', sub: 'Real-time from Org' },
          { label: 'Monthly Payroll', value: totalMonthlySalary, icon: '💰', sub: 'Real-time from Org', isPayroll: true },
        ].map((kpi, idx) => (
          <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[130px]">
            <div className="flex items-start justify-between">
              <span className="text-xl">{kpi.icon}</span>
              {loading ? (
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-blue-500 animate-spin" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-bold">
                  ✓
                </div>
              )}
            </div>
            <div>
              <div className={`text-[28px] font-extrabold leading-none ${kpi.isPayroll ? 'text-blue-600' : 'text-slate-800'}`}>
                {kpi.value}
              </div>
              <div className="text-xs text-slate-500 font-semibold mt-1">{kpi.label}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{kpi.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 border-b border-slate-200">
        <div className="flex gap-4 text-sm">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {activeTab !== 'salary' && (
          <div className="flex flex-wrap gap-2 pb-3 w-full sm:w-auto">
            <div className="relative flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-blue-500 transition-all flex-grow sm:flex-grow-0">
              <Search className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
              <input
                type="text"
                placeholder="Search staff..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent text-xs text-slate-800 outline-none w-32 placeholder-slate-400"
              />
            </div>
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 bg-white outline-none"
            >
              <option value="">All Departments</option>
              <option>Science</option><option>Mathematics</option><option>General Knowledge</option>
              <option>Transport</option><option>Finance</option><option>Library</option><option>Security</option><option>Administration</option><option>Maintenance / Support</option>
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 bg-white outline-none"
            >
              <option value="">All Status</option>
              <option>Active</option><option>On Leave</option><option>Inactive</option>
            </select>
          </div>
        )}
      </div>

      {/* Staff Cards / Payroll Table */}
      {activeTab !== 'salary' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading ? (
            <div className="col-span-full py-16 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
              <p className="font-semibold text-sm">Loading staff members...</p>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-400 bg-white border border-dashed border-slate-200 rounded-2xl">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">No staff members found</p>
            </div>
          ) : (
            filteredStaff.map(member => {
              const netSalary = member.basicSalary + member.hra + member.da - member.pf;
              return (
                <div
                  key={member.id}
                  onClick={() => { setSelectedStaff(member); loadStaffDetail(member.id, member.staffType === 'Teaching'); }}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 cursor-pointer transition-all group"
                >
                  {/* Color Band */}
                  <div className="h-1.5" style={{ background: member.gradient }} />
                  <div className="p-5">
                    {/* Card Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {member.avatarUrl ? (
                          <img src={member.avatarUrl} alt={member.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                        ) : (
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-extrabold flex-shrink-0"
                            style={{ background: member.gradient }}
                          >
                            {member.initials}
                          </div>
                        )}
                        <div>
                          <h3 className="font-bold text-slate-800 text-sm leading-tight">{member.name}</h3>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{member.employeeId}</p>
                        </div>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                        member.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          : member.status === 'On Leave'
                          ? 'bg-amber-50 text-amber-600 border-amber-100'
                          : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}>
                        {member.status}
                      </span>
                    </div>

                    {/* Skills / Subject row */}
                    {member.staffType === 'Teaching' && member.skills.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-1.5">
                        {member.skills.slice(0, 2).map((sk, i) => (
                          <span key={i} className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase tracking-wide">
                            {sk.subject}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Info Grid */}
                    <div className="space-y-1.5 text-xs mb-3">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{member.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500">
                        <Phone className="w-3 h-3 flex-shrink-0" />
                        <span>{member.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500">
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        <span>Joined {member.joiningDate}</span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                          member.staffType === 'Teaching'
                            ? 'bg-blue-50 text-blue-600 border-blue-100'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>
                          {member.staffType}
                        </span>
                        <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">
                          Active
                        </span>
                      </div>
                      <span className="text-xs font-bold text-slate-700">₹{netSalary.toLocaleString('en-IN')}/mo</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* ── PAYROLL LEDGER TABLE ── */
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap justify-between items-center gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-700">Salary Ledger</h4>
              <div className="flex gap-4 text-xs text-slate-500 mt-0.5">
                <span>Paid: <strong className="text-emerald-600">{paidCount}</strong></span>
                <span>Pending: <strong className="text-amber-600">{pendingCount}</strong></span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 font-semibold">Month:</label>
              <div className="relative" ref={monthDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsMonthDropdownOpen(prev => !prev)}
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white font-medium shadow-xs hover:border-slate-300 flex items-center justify-between gap-2 min-w-[110px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <span>{selectedPayrollMonth}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isMonthDropdownOpen ? 'rotate-180 text-blue-600' : ''}`} />
                </button>

                {isMonthDropdownOpen && (
                  <div className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                    <div className="max-h-36 overflow-y-auto py-1 divide-y divide-slate-50">
                      {payrollMonths.map(m => {
                        const isSelected = m === selectedPayrollMonth;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              setSelectedPayrollMonth(m);
                              setIsMonthDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between ${
                              isSelected
                                ? 'bg-blue-50 text-blue-600 font-semibold'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                          >
                            <span>{m}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <th className="px-5 py-3.5">Staff Member</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5 text-right">Basic</th>
                  <th className="px-5 py-3.5 text-right">Allowances</th>
                  <th className="px-5 py-3.5 text-right">Deductions</th>
                  <th className="px-5 py-3.5 text-right">Net Salary</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-600 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2" />
                      Loading payroll...
                    </td>
                  </tr>
                ) : staff.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                      No staff members found.
                    </td>
                  </tr>
                ) : (
                  staff.map(m => {
                    const net = m.basicSalary + m.hra + m.da - m.pf;
                    const isPaid = m.salaryStatus === 'Paid';
                    return (
                      <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            {m.avatarUrl ? (
                              <img src={m.avatarUrl} alt={m.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: m.gradient }}>
                                {m.initials}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-slate-800 text-sm">{m.name}</div>
                              <div className="text-xs text-slate-400">{m.designation}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                            m.staffType === 'Teaching'
                              ? 'bg-blue-50 text-blue-600 border-blue-100'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}>
                            {m.staffType}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono">₹{m.basicSalary.toLocaleString('en-IN')}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-emerald-600">+₹{(m.hra + m.da).toLocaleString('en-IN')}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-rose-600">-₹{m.pf.toLocaleString('en-IN')}</td>
                        <td className="px-5 py-3.5 text-right font-mono font-extrabold text-slate-800">₹{net.toLocaleString('en-IN')}</td>
                        <td className="px-5 py-3.5">
                          <span className={`flex items-center gap-1 w-fit px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                            isPaid ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            {m.salaryStatus}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => handlePaySalary(m.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                              isPaid
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                                : 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100'
                            }`}
                          >
                            {isPaid ? 'Salary Disbursed' : 'Pay Salary'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden divide-y divide-slate-100">
            {loading ? (
              <div className="p-8 text-center text-slate-400">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2" />
                Loading payroll...
              </div>
            ) : staff.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                No staff members found.
              </div>
            ) : (
              staff.map(m => {
                const net = m.basicSalary + m.hra + m.da - m.pf;
                const isPaid = m.salaryStatus === 'Paid';
                return (
                  <div key={m.id} className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5">
                        {m.avatarUrl ? (
                          <img src={m.avatarUrl} alt={m.name} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: m.gradient }}>
                            {m.initials}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-slate-800 text-sm">{m.name}</div>
                          <div className="text-xs text-slate-400">{m.designation} ({m.staffType})</div>
                        </div>
                      </div>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                        isPaid ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        {m.salaryStatus}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-250/10">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Basic & Allowances</span>
                        <span className="font-bold text-slate-700 block mt-0.5">
                          ₹{m.basicSalary.toLocaleString('en-IN')} + ₹{(m.hra + m.da).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">PF & Net Salary</span>
                        <span className="font-bold text-slate-700 block mt-0.5">
                          -₹{m.pf.toLocaleString('en-IN')} / <span className="text-blue-600 font-extrabold">₹{net.toLocaleString('en-IN')}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => handlePaySalary(m.id)}
                        className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all border cursor-pointer min-h-[44px] ${
                          isPaid
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                            : 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100'
                        }`}
                      >
                        {isPaid ? 'Salary Disbursed' : 'Pay Salary'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── STAFF PROFILE MODAL ── */}
      {selectedStaff && (
        <>
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50" onClick={() => setSelectedStaff(null)} />
          <div className="fixed top-4 sm:top-1/2 bottom-20 sm:bottom-auto left-1/2 -translate-x-1/2 translate-y-0 sm:-translate-y-1/2 w-[92%] sm:w-full max-w-2xl bg-white rounded-2xl shadow-2xl z-50 overflow-y-auto max-h-none sm:max-h-[90vh] flex flex-col">
            {/* Modal Header Banner */}
            <div className="p-5" style={{ background: selectedStaff.gradient }}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {selectedStaff.avatarUrl ? (
                    <img src={selectedStaff.avatarUrl} alt={selectedStaff.name} className="w-12 h-12 rounded-xl object-cover border border-white/20 flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white text-lg font-extrabold flex-shrink-0">
                      {selectedStaff.initials}
                    </div>
                  )}
                  <div>
                    <h3 className="font-extrabold text-white text-lg leading-tight">{selectedStaff.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">{selectedStaff.staffType}</span>
                      <span className="text-[10px] font-bold bg-emerald-500/30 text-emerald-100 px-2 py-0.5 rounded-full">{selectedStaff.status}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedStaff(null)} className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Info grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Personal Info */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
                  <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    👤 Personal Info
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-slate-400">GENDER</span><strong className="text-slate-800">{selectedStaff.gender || '—'}</strong></div>
                    <div className="flex justify-between"><span className="text-slate-400">DATE OF BIRTH</span><strong className="text-slate-800">{selectedStaff.dob || '—'}</strong></div>
                    <div className="flex justify-between"><span className="text-slate-400">JOINING DATE</span><strong className="text-slate-800">{selectedStaff.joiningDate || '—'}</strong></div>
                    <div className="flex justify-between"><span className="text-slate-400">QUALIFICATION</span><strong className="text-slate-800">{selectedStaff.qualification || '—'}</strong></div>
                  </div>
                </div>

                {/* Contact */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
                  <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    📞 Contact
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between gap-2"><span className="text-slate-400">EMAIL</span><strong className="text-slate-800 text-right truncate max-w-[120px]">{selectedStaff.email || '—'}</strong></div>
                    <div className="flex justify-between"><span className="text-slate-400">PHONE</span><strong className="text-slate-800">{selectedStaff.phone || '—'}</strong></div>
                    <div className="flex justify-between"><span className="text-slate-400">ADDRESS</span><strong className="text-slate-800 text-right text-[10px]">{selectedStaff.address || '—'}</strong></div>
                  </div>
                </div>

                {/* Salary */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
                  <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    💰 Salary
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-slate-400">BASIC</span><strong className="text-slate-800">₹{selectedStaff.basicSalary.toLocaleString('en-IN')}</strong></div>
                    <div className="flex justify-between text-emerald-600"><span>+ ALLOWANCES</span><strong>₹{(selectedStaff.hra + selectedStaff.da).toLocaleString('en-IN')}</strong></div>
                    <div className="flex justify-between text-rose-500"><span>- DEDUCTIONS</span><strong>₹{selectedStaff.pf.toLocaleString('en-IN')}</strong></div>
                    <div className="border-t border-slate-200 pt-2 flex justify-between items-center">
                      <span className="text-slate-500 font-bold text-[10px]">NET / MONTH</span>
                      <strong className="text-blue-600 text-base font-extrabold">₹{(selectedStaff.basicSalary + selectedStaff.hra + selectedStaff.da - selectedStaff.pf).toLocaleString('en-IN')}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Subject Skills */}
              {selectedStaff.staffType === 'Teaching' && (
                <div>
                  <h4 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-blue-500" /> Subject Skills
                  </h4>
                  {selectedStaff.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                      {selectedStaff.skills.map((sk, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                          <span className="text-sm font-bold text-slate-800">{sk.subject}</span>
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 uppercase">{sk.level}</span>
                          <span className="text-[10px] text-slate-400">{sk.exp} yrs</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No subject skills registered</p>
                  )}
                </div>
              )}

              {/* Salary Invoices */}
              <div>
                <h4 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  📄 Salary Invoices
                </h4>
                {staffDetailLoading ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mx-auto" />
                  </div>
                ) : staffSalaryInvoices.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-xs text-slate-400 italic">
                    No salary invoices found. Pay the salary to generate an invoice.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full min-w-[500px] text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          <th className="px-4 py-2.5">Month / Description</th>
                          <th className="px-4 py-2.5 text-right">Net Salary</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {staffSalaryInvoices.map((inv: any) => {
                          const desc = inv.description || '';
                          const monthMatch = desc.match(/for (.+)$/);
                          const monthLabel = monthMatch ? monthMatch[1] : new Date(inv.date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
                          return (
                            <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-2.5 font-semibold text-slate-700">{monthLabel}</td>
                              <td className="px-4 py-2.5 text-right font-bold text-emerald-600">₹{Number(inv.amount).toLocaleString('en-IN')}</td>
                              <td className="px-4 py-2.5">
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                                  {inv.status}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-slate-400">{formatDateDDMMYYYY(inv.date)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Schedule */}
              <div>
                <h4 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-500" /> Schedule
                </h4>
                {staffDetailLoading ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mx-auto" />
                  </div>
                ) : selectedStaff.staffType !== 'Teaching' ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-xs text-slate-400 italic">
                    Schedule not applicable for non-teaching staff.
                  </div>
                ) : staffSchedule.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-xs text-slate-400 italic">
                    No timetable periods assigned yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full min-w-[600px] text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          <th className="px-4 py-2.5">Day</th>
                          <th className="px-4 py-2.5">Period</th>
                          <th className="px-4 py-2.5">Subject</th>
                          <th className="px-4 py-2.5">Class</th>
                          <th className="px-4 py-2.5">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {staffSchedule.map((p: any) => (
                          <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-2.5 font-semibold text-slate-700">{p.dayOfWeek}</td>
                            <td className="px-4 py-2.5 text-slate-500">Period {p.periodTiming?.periodNumber}</td>
                            <td className="px-4 py-2.5 font-bold text-blue-700">{p.subject?.name || '—'}</td>
                            <td className="px-4 py-2.5 text-slate-600">{p.classSection?.class?.name} {p.classSection?.section?.name}</td>
                            <td className="px-4 py-2.5 text-slate-400">{p.periodTiming?.startTime} – {p.periodTiming?.endTime}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Student Cases */}
              <div>
                <h4 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  📝 Student Cases
                </h4>
                {staffDetailLoading ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mx-auto" />
                  </div>
                ) : staffCases.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-xs text-slate-400 italic">
                    No cases submitted by this staff member.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full min-w-[500px] text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          <th className="px-4 py-2.5">Type</th>
                          <th className="px-4 py-2.5">Category</th>
                          <th className="px-4 py-2.5">Student</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {staffCases.map((c: any) => (
                          <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-2.5">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                c.behaviorType === 'Complaint'
                                  ? 'bg-rose-50 text-rose-600 border-rose-100'
                                  : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                              }`}>
                                {c.behaviorType}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-600">{c.category}</td>
                            <td className="px-4 py-2.5 font-semibold text-slate-700">{c.student?.user?.name || '—'}</td>
                            <td className="px-4 py-2.5">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                c.status === 'Resolved'
                                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                  : c.status === 'New'
                                  ? 'bg-amber-50 text-amber-600 border-amber-100'
                                  : 'bg-slate-50 text-slate-500 border-slate-200'
                              }`}>
                                {c.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-400">{formatDateDDMMYYYY(c.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => {
                    setEditingStaff(selectedStaff);
                    setSelectedStaff(null);
                  }}
                  className="w-full sm:flex-1 py-2.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
                >
                  <Edit2 className="w-4 h-4" /> Edit Profile
                </button>
                <button
                  onClick={() => {
                    setDeleteConfirm({
                      show: true,
                      id: selectedStaff.id,
                      name: selectedStaff.name
                    });
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
                >
                  <Trash2 className="w-4 h-4" /> Remove
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── EDIT STAFF MODAL (Salesforce Design) ── */}
      {editingStaff && (
        <>
          <div className="fixed inset-0 bg-slate-900/60 z-50" onClick={() => setEditingStaff(null)} />
          <div className="fixed top-4 sm:top-1/2 bottom-20 sm:bottom-auto left-1/2 -translate-x-1/2 translate-y-0 sm:-translate-y-1/2 w-[92%] sm:w-full max-w-xl bg-white rounded-2xl shadow-2xl z-50 overflow-y-auto max-h-none sm:max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-lg">Edit Staff Member</h3>
              <button onClick={() => setEditingStaff(null)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleUpdateStaff} className="p-6 space-y-4 text-sm">
              {/* Photo Upload */}
              <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="w-14 h-14 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400 overflow-hidden flex-shrink-0">
                  {editingStaff.avatarUrl ? (
                    <img src={editingStaff.avatarUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-6 h-6" />
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Staff Photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const result = await resizeAndCompressImage(file);
                          setEditingStaff({ ...editingStaff, avatarUrl: result });
                        } catch (err) {
                          console.error('Error compressing staff photo:', err);
                        }
                      }
                    }}
                    className="block w-full text-xs text-slate-500 file:mr-3 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 font-bold mb-1">First Name *</label>
                  <input required value={editingStaff.firstName} onChange={e => setEditingStaff({...editingStaff, firstName: e.target.value, name: `${e.target.value} ${editingStaff.lastName}`})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 font-bold mb-1">Last Name *</label>
                  <input required value={editingStaff.lastName} onChange={e => setEditingStaff({...editingStaff, lastName: e.target.value, name: `${editingStaff.firstName} ${e.target.value}`})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 font-bold mb-1">Email *</label>
                  <input type="email" required value={editingStaff.email} onChange={e => setEditingStaff({...editingStaff, email: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 font-bold mb-1">Mobile Phone *</label>
                  <input type="tel" required value={editingStaff.phone} onChange={e => setEditingStaff({...editingStaff, phone: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 font-bold mb-1">Designation *</label>
                  <select value={editingStaff.designation} onChange={e => setEditingStaff({...editingStaff, designation: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none">
                    {editingStaff.staffType === 'Teaching'
                      ? ['Principal', 'Vice Principal', 'Senior Teacher', 'Teacher', 'Sports Coach'].map(d => <option key={d}>{d}</option>)
                      : ['Accountant', 'Librarian', 'Security Guard', 'Driver', 'Bus Attendant', 'Transport Manager', 'Administrative Staff', 'Clerk'].map(d => <option key={d}>{d}</option>)
                    }
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 font-bold mb-1">Department *</label>
                  <select value={editingStaff.department} onChange={e => setEditingStaff({...editingStaff, department: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none">
                    {editingStaff.staffType === 'Teaching'
                      ? ['Science', 'Mathematics', 'English', 'Social Studies', 'General Knowledge'].map(d => <option key={d}>{d}</option>)
                      : ['Transport', 'Finance', 'Library', 'Security', 'Administration', 'Operations', 'Maintenance / Support'].map(d => <option key={d}>{d}</option>)
                    }
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 font-bold mb-1">Basic Salary (₹)</label>
                  <input type="number" value={editingStaff.basicSalary} onChange={e => setEditingStaff({...editingStaff, basicSalary: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 font-bold mb-1">HRA (₹)</label>
                  <input type="number" value={editingStaff.hra} onChange={e => setEditingStaff({...editingStaff, hra: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 font-bold mb-1">PF Deduction (₹)</label>
                  <input type="number" value={editingStaff.pf} onChange={e => setEditingStaff({...editingStaff, pf: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 font-bold mb-1">Status *</label>
                  <select value={editingStaff.status} onChange={e => setEditingStaff({...editingStaff, status: e.target.value as any})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none">
                    <option>Active</option>
                    <option>On Leave</option>
                    <option>Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 font-bold mb-1">Qualification</label>
                  <input value={editingStaff.qualification} onChange={e => setEditingStaff({...editingStaff, qualification: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 font-bold mb-1">Bank Account</label>
                  <input value={editingStaff.accountNumber} onChange={e => setEditingStaff({...editingStaff, accountNumber: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none" placeholder="Account Number" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 font-bold mb-1">IFSC Code</label>
                  <input value={editingStaff.ifsc} onChange={e => setEditingStaff({...editingStaff, ifsc: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none" placeholder="IFSC Code" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-bold mb-1">Address</label>
                <textarea value={editingStaff.address} onChange={e => setEditingStaff({...editingStaff, address: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none h-16 resize-none" />
              </div>
              {/* Subject Skills */}
              {editingStaff.staffType === 'Teaching' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-slate-400 font-bold">Subject Skills</label>
                    <button 
                      type="button" 
                      onClick={() => {
                        const currentSkills = editingStaff.skills || [];
                        setEditingStaff({
                          ...editingStaff,
                          skills: [...currentSkills, { subject: '', level: 'Expert', exp: 3 }]
                        });
                      }} 
                      className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                    >
                      + Add Skill
                    </button>
                  </div>
                  {(editingStaff.skills || []).map((sk, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <input 
                        value={sk.subject} 
                        onChange={e => { 
                          const s = [...editingStaff.skills]; 
                          s[idx] = { ...s[idx], subject: e.target.value }; 
                          setEditingStaff({ ...editingStaff, skills: s }); 
                        }} 
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none" 
                        placeholder="Subject" 
                      />
                      <select 
                        value={sk.level} 
                        onChange={e => { 
                          const s = [...editingStaff.skills]; 
                          s[idx] = { ...s[idx], level: e.target.value }; 
                          setEditingStaff({ ...editingStaff, skills: s }); 
                        }} 
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none"
                      >
                        <option>Beginner</option>
                        <option>Intermediate</option>
                        <option>Advanced</option>
                        <option>Expert</option>
                      </select>
                      <input 
                        type="number" 
                        value={sk.exp} 
                        onChange={e => { 
                          const s = [...editingStaff.skills]; 
                          s[idx] = { ...s[idx], exp: Number(e.target.value) }; 
                          setEditingStaff({ ...editingStaff, skills: s }); 
                        }} 
                        className="w-14 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none" 
                        placeholder="Yrs" 
                      />
                      <button 
                        type="button" 
                        onClick={() => {
                          const s = editingStaff.skills.filter((_, i) => i !== idx);
                          setEditingStaff({ ...editingStaff, skills: s });
                        }} 
                        className="text-rose-450 hover:text-rose-600 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setEditingStaff(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm cursor-pointer min-h-[44px]">Cancel</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md cursor-pointer flex items-center gap-1.5 min-h-[44px]"><Check className="w-4 h-4" /> Save Changes</button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ── ADD STAFF MODAL ── */}
      {showAddModal && (
        <>
          <div className="fixed inset-0 bg-slate-900/60 z-50" onClick={() => setShowAddModal(false)} />
          <div className="fixed top-4 sm:top-1/2 bottom-20 sm:bottom-auto left-1/2 -translate-x-1/2 translate-y-0 sm:-translate-y-1/2 w-[92%] sm:w-full max-w-xl bg-white rounded-2xl shadow-2xl z-50 overflow-y-auto max-h-none sm:max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-lg">Add New Staff Member</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveStaff} className="p-6 space-y-4 text-sm">
              {/* Staff Type Toggle */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                {(['Teaching', 'Non-Teaching'] as const).map(t => (
                  <button
                    key={t} type="button" onClick={() => setFormType(t)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[40px] ${
                      formType === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {t === 'Teaching' ? '👩‍🏫 Teaching Faculty' : '🧹 Non-Teaching Staff'}
                  </button>
                ))}
              </div>

              {/* Photo Upload */}
              <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="w-14 h-14 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400 overflow-hidden flex-shrink-0">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-6 h-6" />
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Staff Photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="block w-full text-xs text-slate-500 file:mr-3 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1">First Name *</label>
                  <input required value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-blue-500" placeholder="First Name" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1">Last Name *</label>
                  <input required value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-blue-500" placeholder="Last Name" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1">Email *</label>
                  <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-blue-500" placeholder="email@school.com" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1">Mobile Phone *</label>
                  <input type="tel" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-blue-500" placeholder="+91 9XXXXXXXXX" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1">Designation *</label>
                  <select required value={formData.designation} onChange={e => setFormData({...formData, designation: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none">
                    <option value="">Select Designation</option>
                    {formType === 'Teaching'
                      ? ['Principal', 'Vice Principal', 'Senior Teacher', 'Teacher', 'Sports Coach'].map(d => <option key={d}>{d}</option>)
                      : ['Accountant', 'Librarian', 'Security Guard', 'Driver', 'Bus Attendant', 'Transport Manager', 'Administrative Staff', 'Clerk'].map(d => <option key={d}>{d}</option>)
                    }
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1">Department *</label>
                  <select required value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none">
                    <option value="">Select Department</option>
                    {formType === 'Teaching'
                      ? ['Science', 'Mathematics', 'English', 'Social Studies', 'General Knowledge'].map(d => <option key={d}>{d}</option>)
                      : ['Transport', 'Finance', 'Library', 'Security', 'Administration', 'Operations', 'Maintenance / Support'].map(d => <option key={d}>{d}</option>)
                    }
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1">Basic Salary (₹)</label>
                  <input type="number" value={formData.basicSalary} onChange={e => setFormData({...formData, basicSalary: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1">HRA (₹)</label>
                  <input type="number" value={formData.hra} onChange={e => setFormData({...formData, hra: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1">PF Deduction (₹)</label>
                  <input type="number" value={formData.pf} onChange={e => setFormData({...formData, pf: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none" />
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl flex justify-between items-center text-xs font-semibold">
                <span className="text-slate-500">Estimated Net Monthly:</span>
                <span className="text-blue-600 font-extrabold text-sm">₹{(formData.basicSalary + formData.hra + formData.da - formData.pf).toLocaleString('en-IN')}</span>
              </div>
              {/* Subject Skills */}
              {formType === 'Teaching' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-slate-400 font-bold">Subject Skills</label>
                    <button type="button" onClick={() => setFormSkills([...formSkills, {id:Date.now(),subject:'',level:'Expert',exp:0}])} className="text-xs text-blue-600 font-bold hover:underline cursor-pointer">+ Add Skill</button>
                  </div>
                  {formSkills.map((sk, idx) => (
                    <div key={sk.id} className="flex gap-2 mb-2">
                      <input value={sk.subject} onChange={e => { const s=[...formSkills]; s[idx]={...s[idx],subject:e.target.value}; setFormSkills(s); }} className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none" placeholder="Subject" />
                      <select value={sk.level} onChange={e => { const s=[...formSkills]; s[idx]={...s[idx],level:e.target.value}; setFormSkills(s); }} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none">
                        <option>Beginner</option><option>Intermediate</option><option>Advanced</option><option>Expert</option>
                      </select>
                      <input type="number" value={sk.exp} onChange={e => { const s=[...formSkills]; s[idx]={...s[idx],exp:Number(e.target.value)}; setFormSkills(s); }} className="w-14 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none" placeholder="Yrs" />
                      <button type="button" onClick={() => setFormSkills(formSkills.filter((_,i)=>i!==idx))} className="text-rose-400 hover:text-rose-600 cursor-pointer"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm cursor-pointer min-h-[44px]">Cancel</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md cursor-pointer min-h-[44px]">✅ Save Staff</button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ── CUSTOM DELETE CONFIRMATION MODAL ── */}
      {deleteConfirm.show && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50 animate-fade-in" onClick={() => setDeleteConfirm(prev => ({ ...prev, show: false }))} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-2xl shadow-2xl z-50 p-6 animate-scale-in">
            <div className="text-center py-2">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-xl mx-auto mb-3">
                ⚠️
              </div>
              <h3 className="font-extrabold text-slate-800 text-base mb-1">Confirm Deletion</h3>
              <p className="text-xs text-slate-500 mb-5">
                Are you sure you want to delete staff member{' '}
                <strong className="text-slate-700 font-bold">{deleteConfirm.name}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(prev => ({ ...prev, show: false }))}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer font-extrabold"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
