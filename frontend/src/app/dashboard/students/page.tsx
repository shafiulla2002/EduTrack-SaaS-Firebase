'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Search, ArrowLeft, Plus, X, Phone, Mail, Award, Receipt, 
  CheckCircle, AlertTriangle, ChevronDown, ChevronUp, User, 
  MapPin, Calendar as CalendarIcon, DollarSign, BookOpen, ShieldAlert,
  Percent, Trash2
} from 'lucide-react';
import { api } from '@/lib/api';
import EditStudentModal from '@/components/EditStudentModal';
import { useSchoolSetupUpdate } from '@/lib/events';
import { useToast } from '@/components/Toast';
import StudentAvatar from '@/components/StudentAvatar';
import axios from 'axios';
import { useFloatingBarPadding } from '@/hooks/useFloatingBarPadding';

interface Student {
  id: string;
  rollNo: string;
  name: string;
  email: string;
  phone: string;
  class: string;
  section: string;
  fatherName: string;
  motherName: string;
  aadharNo: string;
  paidAmount: number;
  balanceDue: number;
  totalFees?: number;
  pendingPercentage?: number;
  paidPercentage?: number;
  financialStatus?: string;
  academicYearId?: string;
  profilePhotoUrl?: string | null;
}

let cacheFilterOptions: { academicYears: any[]; classes: any[]; sections: any[] } | null = null;

export default function StudentsDirectory() {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [searchVal, setSearchVal] = useState('');
  const [selectedClass, setSelectedClass] = useState('All');
  const [selectedSection, setSelectedSection] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    studentIds: string[];
    count: number;
    yearName?: string;
    className?: string;
    sectionName?: string;
    singleName?: string;
  }>({
    show: false,
    studentIds: [],
    count: 0
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Pagination States
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleConfirmDelete = async () => {
    try {
      if (deleteConfirm.studentIds.length === 1) {
        await api.delete(`/students/${deleteConfirm.studentIds[0]}`);
        showToast('Student deleted successfully.', 'success');
      } else {
        await api.post('/students/bulk-delete', { studentIds: deleteConfirm.studentIds });
        showToast(`Successfully deleted ${deleteConfirm.count} students.`, 'success');
      }
      setDeleteConfirm({ show: false, studentIds: [], count: 0 });
      setSelectedIds([]);
      setActiveStudent(null);

      // Reset filters and checkboxes
      setSearch('');
      setSearchVal('');
      setSelectedClass('All');
      setSelectedSection('All');
      setSelectedYear('All');

      loadStudents(1);
    } catch (err: any) {
      console.error('Error deleting student:', err);
      showToast(err.response?.data?.message || 'Failed to delete student.', 'error');
    }
  };

  // Selected student for Profile details (Full Page swap)
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [activeStudentDetails, setActiveStudentDetails] = useState<any>(null);
  const [selectedExamTab, setSelectedExamTab] = useState<string>('Unit Test');
  const [expandedInvoices, setExpandedInvoices] = useState<Record<string, boolean>>({});
  const [expandedExams, setExpandedExams] = useState<Record<string, boolean>>({});
  const [tempDiscount, setTempDiscount] = useState<number>(0);
  const [appliedDiscountPercent, setAppliedDiscountPercent] = useState<number>(0);

  const loadFilterOptions = async () => {
    if (cacheFilterOptions) {
      setAcademicYears(cacheFilterOptions.academicYears);
      setClasses(cacheFilterOptions.classes);
      setSections(cacheFilterOptions.sections);
      return;
    }
    try {
      const [ayRes, classRes, secRes] = await Promise.all([
        api.get('/academics/academic-years'),
        api.get('/academics/classes'),
        api.get('/academics/sections')
      ]);
      cacheFilterOptions = {
        academicYears: ayRes.data,
        classes: classRes.data,
        sections: secRes.data
      };
      setAcademicYears(ayRes.data);
      setClasses(classRes.data);
      setSections(secRes.data);
    } catch (err) {
      console.error('Failed to load filter options:', err);
    }
  };

  const loadStudents = useCallback(async (pageNumber = 1) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);

      const classId = selectedClass === 'All' ? undefined : classes.find(c => c.name === selectedClass)?.id;
      const sectionId = selectedSection === 'All' ? undefined : sections.find(s => s.name === selectedSection)?.id;
      const academicYearId = selectedYear === 'All' || !selectedYear ? undefined : selectedYear;

      const res = await api.get('/students', {
        params: {
          page: pageNumber,
          limit,
          search: search || undefined,
          classId,
          sectionId,
          academicYearId
        },
        signal: controller.signal
      });

      const { data, total: serverTotal, totalPages: serverTotalPages } = res.data;

      setStudents(data.map((s: any) => {
        const paid = s.paidAmount !== undefined ? Number(s.paidAmount) : (s.invoices?.reduce((sum: number, inv: any) => sum + Number(inv.paidAmount), 0) || 0);
        const due = s.balanceDue !== undefined ? Number(s.balanceDue) : (s.invoices?.reduce((sum: number, inv: any) => sum + Number(inv.remainingBalance), 0) || 0);
        return {
          id: s.id,
          rollNo: s.rollNo || 'N/A',
          name: s.user?.name || 'Unknown Student',
          email: s.user?.email || 'N/A',
          phone: (() => {
            const rawPhone = s.user?.phone || s.fatherPhone || s.guardianPhone || s.motherPhone || '';
            if (!rawPhone) return 'N/A';
            return rawPhone.includes('-') ? rawPhone.split('-').pop() || rawPhone : rawPhone;
          })(),
          fatherPhone: s.fatherPhone || 'N/A',
          motherPhone: s.motherPhone || 'N/A',
          guardianPhone: s.guardianPhone || 'N/A',
          class: s.classSection?.class?.name || 'N/A',
          section: s.classSection?.section?.name || 'N/A',
          fatherName: s.fatherName || 'N/A',
          motherName: s.motherName || 'N/A',
          aadharNo: s.aadharNo || 'N/A',
          paidAmount: paid,
          balanceDue: due,
          totalFees: s.totalFees,
          pendingPercentage: s.pendingPercentage,
          paidPercentage: s.paidPercentage,
          financialStatus: s.financialStatus,
          academicYearId: s.classSection?.class?.academicYearId || '',
          profilePhotoUrl: s.profilePhotoUrl || null,
        };
      }));

      setTotal(serverTotal);
      setTotalPages(serverTotalPages);
      setPage(pageNumber);
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError' || axios.isCancel?.(err)) {
        return;
      }
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
    }
  }, [search, selectedClass, selectedSection, selectedYear, classes, sections, limit]);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  // 300ms Search Debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchVal);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchVal]);

  // Reset page to 1 when filters or search change
  useEffect(() => {
    setPage(1);
  }, [search, selectedClass, selectedSection, selectedYear]);

  // Load students when page or filters change
  useEffect(() => {
    loadStudents(page);
  }, [page, search, selectedClass, selectedSection, selectedYear, loadStudents]);

  useEffect(() => {
    setSelectedIds([]);
  }, [search, selectedClass, selectedSection, selectedYear]);

  useSchoolSetupUpdate(() => loadStudents(1));

  const filteredStudents = useMemo(() => {
    return students;
  }, [students]);

  const isAllSelected = useMemo(() => {
    return filteredStudents.length > 0 && filteredStudents.every(s => selectedIds.includes(s.id));
  }, [filteredStudents, selectedIds]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      const filteredIds = filteredStudents.map(s => s.id);
      setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      const filteredIds = filteredStudents.map(s => s.id);
      setSelectedIds(prev => {
        const union = new Set([...prev, ...filteredIds]);
        return Array.from(union);
      });
    }
  };



  const [loadedDetailsKey, setLoadedDetailsKey] = useState('');

  const loadStudentDetails = async (studentId: string, yearId: string) => {
    const key = `${studentId}-${yearId}`;
    if (loadedDetailsKey === key && activeStudent?.id === studentId) return;
    
    try {
      const [detailsRes, casesRes] = await Promise.all([
        api.get(`/students/${studentId}`, {
          params: yearId && yearId !== 'All' ? { academicYearId: yearId } : {}
        }),
        api.get(`/complaint-box/student-cases/${studentId}`)
      ]);
      
      const data = detailsRes.data;
      const casesData = casesRes.data;

      const paid = data.paidAmount !== undefined ? Number(data.paidAmount) : (data.invoices?.reduce((sum: number, inv: any) => sum + Number(inv.paidAmount), 0) || 0);
      const due = data.balanceDue !== undefined ? Number(data.balanceDue) : (data.invoices?.reduce((sum: number, inv: any) => sum + Number(inv.remainingBalance), 0) || 0);
      
      const fullStudent: Student = {
        id: data.id,
        rollNo: data.rollNo || 'N/A',
        name: data.user?.name || 'Unknown Student',
        email: data.user?.email || 'N/A',
        phone: data.user?.phone ? (data.user.phone.includes('-') ? data.user.phone.split('-').pop() || data.user.phone : data.user.phone) : 'N/A',
        class: data.classSection?.class?.name || 'N/A',
        section: data.classSection?.section?.name || 'N/A',
        fatherName: data.fatherName || 'N/A',
        motherName: data.motherName || 'N/A',
        aadharNo: data.aadharNo || 'N/A',
        paidAmount: paid,
        balanceDue: due,
        totalFees: data.totalFees,
        pendingPercentage: data.pendingPercentage,
        paidPercentage: data.paidPercentage,
        financialStatus: data.financialStatus,
        academicYearId: data.classSection?.class?.academicYearId || '',
        profilePhotoUrl: data.profilePhotoUrl || null,
      };

      // Group exams
      const examsMap: Record<string, any> = {};
      data.examMarks?.forEach((mark: any) => {
        const exId = mark.exam.id;
        if (!examsMap[exId]) {
          examsMap[exId] = {
            id: exId,
            name: mark.exam.name,
            type: mark.exam.type,
            subjects: []
          };
        }
        examsMap[exId].subjects.push({
          name: mark.subject.name,
          score: Number(mark.marksObtained),
          max: 100
        });
      });

      const exams = Object.values(examsMap).map((ex: any) => {
        const total = ex.subjects.reduce((sum: number, s: any) => sum + s.score, 0);
        const avg = ex.subjects.length > 0 ? (total / ex.subjects.length).toFixed(0) : '0';
        return {
          ...ex,
          score: `${avg}%`
        };
      });

      setActiveStudentDetails({
        products: data.feeItems?.map((item: any) => ({
          id: item.oliId,
          name: item.productName,
          price: Number(item.totalAmount),
          grossTotal: Number(item.totalAmount),
          discountPercent: Number(item.discountPercent),
          discountAmount: Number(item.discountAmount),
          netTotal: Number(item.netAmount),
          paid: Number(item.paidAmount),
          balance: Number(item.balanceDue)
        })) || [],
        feeSummary: data.feeSummary,
        invoices: data.invoices?.map((inv: any) => ({
          id: inv.id,
          date: new Date(inv.invoiceDate).toISOString().split('T')[0],
          number: `INV-${inv.id.substring(0, 8).toUpperCase()}`,
          mode: inv.paymentMethod || '—',
          amount: Number(inv.totalAmount),
          paidAmount: Number(inv.paidAmount),
          remainingBalance: Number(inv.remainingBalance),
          status: inv.status === 'PAID' ? 'Paid' : 'Pending',
          academicYearId: inv.opportunity?.academicYearId || null,
          academicYearName: inv.opportunity?.academicYear?.name || null,
          academicYearStart: inv.opportunity?.academicYear?.startDate || null,
          invoiceDateRaw: inv.invoiceDate,
          items: inv.invoiceItems?.map((it: any) => ({
            name: it.name,
            amount: Number(it.amount)
          })) || []
        })) || [],
        exams,
        cases: casesData.map((c: any) => ({
          id: c.id,
          type: c.behaviorType === 'Praise' ? 'Positive' : 'Negative',
          typeIcon: c.behaviorType === 'Praise' ? '⭐' : '⚠️',
          subject: c.category,
          priority: c.priority,
          status: c.status,
          date: new Date(c.createdAt).toISOString().split('T')[0],
          description: c.description || ''
        }))
      });

      if (exams.length > 0) {
        setSelectedExamTab(exams[0].type || 'Unit Test');
      } else {
        setSelectedExamTab('Unit Test');
      }

      setLoadedDetailsKey(key);
      setActiveStudent(fullStudent);
      setExpandedInvoices({});
      setExpandedExams({});
      setTempDiscount(0);
      setAppliedDiscountPercent(0);
    } catch (err) {
      console.error('Failed to load student details:', err);
      alert('Failed to load student details');
    }
  };

  // Switch to detail view and load details
  const handleViewDetails = async (student: Student) => {
    try {
      setLoading(true);
      setSelectedYear(student.academicYearId || 'All');
      await loadStudentDetails(student.id, student.academicYearId || 'All');
    } catch (err) {
      console.error('Failed to load student details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeStudent && selectedYear && selectedYear !== 'All') {
      loadStudentDetails(activeStudent.id, selectedYear);
    }
  }, [selectedYear, activeStudent]);

  const handleApplyDiscount = () => {
    if (tempDiscount < 0 || tempDiscount > 100) {
      alert('Please enter a valid percentage between 0 and 100.');
      return;
    }
    setAppliedDiscountPercent(tempDiscount);
    alert(`Success: Discount of ${tempDiscount}% applied to the current academic session fee.`);
  };

  const toggleInvoice = (id: string) => {
    setExpandedInvoices(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleExam = (id: string) => {
    setExpandedExams(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Detail rendering helpers
  const detailData = activeStudentDetails;

  const dynamicExamTabs = useMemo(() => {
    if (!detailData?.exams || detailData.exams.length === 0) {
      return ['Unit Test', 'Quarterly', 'Final'];
    }
    const typesSet = new Set<string>();
    detailData.exams.forEach((ex: any) => {
      if (ex.type) typesSet.add(ex.type);
    });
    const list = Array.from(typesSet);
    return list.length > 0 ? list : ['Unit Test', 'Quarterly', 'Final'];
  }, [detailData]);

  const isPaidClear = activeStudent ? activeStudent.balanceDue <= 0 : false;

  // Recalculated values based on discount
  const getRecalculatedFees = () => {
    if (!activeStudent || !detailData) {
      return { 
        list: [], 
        subtotal: 0, 
        discVal: 0, 
        final: 0, 
        previousYearsDues: [], 
        totalPreviousYearDue: 0 
      };
    }
    
    const productsList = detailData.products || [];

    const subtotal = productsList.reduce((sum: number, p: any) => sum + p.price, 0);
    const discVal = subtotal * (appliedDiscountPercent / 100);
    const finalVal = subtotal - discVal;

    const list = productsList.map((p: any) => {
      const price = p.price;
      const discountAmount = price * (appliedDiscountPercent / 100);
      const netTotal = price - discountAmount;
      return {
        ...p,
        discountAmount,
        netTotal
      };
    });

    const previousYearsDues = detailData.feeSummary?.previousYears?.map((py: any) => ({
      yearName: py.academicYearName,
      balance: py.outstandingBalance
    })) || [];

    const totalPreviousYearDue = detailData.feeSummary?.overall?.totalPreviousYearDue || 0;

    return {
      list,
      subtotal,
      discVal,
      final: finalVal,
      previousYearsDues,
      totalPreviousYearDue
    };
  };

  const recFees = getRecalculatedFees();

  // ── Floating bar padding: keep last row always visible ──────────────────
  const isBarVisible =
    (selectedIds.length > 0 ||
      selectedClass !== 'All' ||
      selectedSection !== 'All' ||
      selectedYear !== 'All' ||
      search !== '') &&
    students.length > 0;
  const { barRef, contentPaddingBottom } = useFloatingBarPadding({ visible: isBarVisible });
  // ────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-in">
      {!activeStudent ? (
        /* ================= LIST VIEW ================= */
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <h2 className="text-[28px] font-bold text-slate-900 leading-none">
                Student Directory
              </h2>
              <p className="text-slate-500 text-[13px] font-medium mt-2">
                Browse through student files, view account ledgers, and check parent assignments.
              </p>
            </div>
            <div className="text-slate-500 text-[12px] font-bold bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs">
              Total Records Staged: <span className="text-[#2E5BFF] font-extrabold">{total}</span>
            </div>
          </div>
 
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2 relative flex items-center bg-white border border-slate-200 rounded-xl px-4 py-2 focus-within:border-[#2E5BFF] focus-within:ring-2 focus-within:ring-blue-100 transition-all">
              <Search className="w-4 h-4 text-slate-400 mr-2" />
              <input
                type="text"
                placeholder="Search by Name, roll number, or phone..."
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                className="bg-transparent border-none text-[13px] font-medium text-slate-800 outline-none w-full placeholder-slate-400"
              />
            </div>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-[13px] font-semibold text-slate-700 focus:outline-none focus:border-[#2E5BFF] shadow-xs"
            >
              <option value="All">All Academic Years</option>
              {academicYears.map(ay => (
                <option key={ay.id} value={ay.id}>{ay.name}</option>
              ))}
            </select>

            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-[13px] font-semibold text-slate-700 focus:outline-none focus:border-[#2E5BFF] shadow-xs"
            >
              <option value="All">All Grades</option>
              {classes.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>

            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-[13px] font-semibold text-slate-700 focus:outline-none focus:border-[#2E5BFF] shadow-xs"
            >
              <option value="All">All Sections</option>
              {sections.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Directory Table / Cards Container */}
          <div
            className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
            style={{ paddingBottom: contentPaddingBottom }}
          >
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <th className="px-6 py-4 w-10">
                      <input 
                        type="checkbox" 
                        checked={isAllSelected} 
                        onChange={handleToggleSelectAll} 
                        className="rounded border-slate-300 text-[#2E5BFF] focus:ring-blue-500 cursor-pointer w-4 h-4"
                      />
                    </th>
                    <th className="px-6 py-4">Roll No</th>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Class / Section</th>
                    <th className="px-6 py-4">Parent Guardian</th>
                    <th className="px-6 py-4">Financial Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[13px] text-slate-600 font-medium">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={idx} className="animate-pulse">
                        <td className="px-6 py-4"><div className="h-4 w-4 bg-slate-200 rounded" /></td>
                        <td className="px-6 py-4"><div className="h-4 w-12 bg-slate-200 rounded" /></td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-200" />
                            <div className="space-y-2">
                              <div className="h-4 w-28 bg-slate-200 rounded" />
                              <div className="h-3 w-36 bg-slate-200 rounded" />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4"><div className="h-5 w-20 bg-slate-200 rounded-full" /></td>
                        <td className="px-6 py-4">
                          <div className="space-y-2">
                            <div className="h-4 w-20 bg-slate-200 rounded" />
                            <div className="h-3 w-24 bg-slate-200 rounded" />
                          </div>
                        </td>
                        <td className="px-6 py-4"><div className="h-5 w-28 bg-slate-200 rounded-full" /></td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <div className="h-8 w-20 bg-slate-200 rounded-lg animate-pulse" />
                            <div className="h-8 w-12 bg-slate-200 rounded-lg animate-pulse" />
                            <div className="h-8 w-10 bg-slate-200 rounded-lg animate-pulse" />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-light">
                        No matching student records found.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => {
                      const hasDue = student.balanceDue > 0;
                      const totalFees = student.totalFees ?? (student.paidAmount + student.balanceDue);
                      const pendingPercentage = student.pendingPercentage ?? (totalFees > 0 ? Math.round((student.balanceDue / totalFees) * 100) : 0);
                      const financialStatus = student.financialStatus || (hasDue ? `Pending Due (${pendingPercentage}%)` : 'Fully Paid (100%)');
                      return (
                        <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <input 
                              type="checkbox" 
                              checked={selectedIds.includes(student.id)} 
                              onChange={() => handleToggleSelect(student.id)} 
                              className="rounded border-slate-300 text-[#2E5BFF] focus:ring-blue-500 cursor-pointer w-4 h-4"
                            />
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-blue-600 font-bold">{student.rollNo}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <StudentAvatar studentName={student.name} profilePhotoUrl={student.profilePhotoUrl} size="sm" />
                              <div>
                                <div className="font-bold text-slate-800">{student.name}</div>
                                <div className="text-xs text-slate-400 font-medium mt-0.5">{student.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200 text-xs font-semibold whitespace-nowrap">
                              {student.class} - {(() => {
                                const sec = student.section || '';
                                if (sec.startsWith('Section-')) return sec;
                                if (sec.toLowerCase().startsWith('section')) {
                                  const rest = sec.substring(7).replace(/^[\s\-_]+/, '').trim();
                                  return `Section-${rest.toUpperCase() || 'A'}`;
                                }
                                return `Section-${sec.toUpperCase()}`;
                              })()}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-slate-800 font-semibold">{student.fatherName}</div>
                            <div className="text-xs text-slate-400 font-medium mt-0.5">{student.phone}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${
                              hasDue 
                                ? 'bg-amber-50 text-amber-600 border border-amber-200' 
                                : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${hasDue ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                              {financialStatus}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleViewDetails(student)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/30 transition-all text-xs font-bold min-h-[44px]"
                              >
                                View Profile
                              </button>
                              <button
                                onClick={() => setEditingStudent(student)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-green-600 hover:border-green-200 hover:bg-green-50/30 transition-all text-xs font-bold min-h-[44px]"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setDeleteConfirm({
                                  show: true,
                                  studentIds: [student.id],
                                  count: 1,
                                  singleName: student.name,
                                  yearName: selectedYear !== 'All' ? academicYears.find(ay => ay.id === selectedYear)?.name : undefined,
                                  className: student.class !== 'N/A' ? student.class : undefined,
                                  sectionName: student.section !== 'N/A' ? student.section : undefined
                                })}
                                className="p-2.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-150 hover:border-rose-300 text-rose-600 transition-all flex items-center justify-center cursor-pointer min-h-[44px]"
                                title="Delete Student"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
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
                Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="p-4 space-y-3 animate-pulse">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200" />
                        <div className="space-y-2">
                          <div className="h-3 w-16 bg-slate-200 rounded" />
                          <div className="h-4 w-24 bg-slate-200 rounded" />
                          <div className="h-3 w-32 bg-slate-200 rounded" />
                        </div>
                      </div>
                      <div className="h-5 w-24 bg-slate-200 rounded-full" />
                    </div>
                    <div className="h-10 bg-slate-100 rounded-xl" />
                    <div className="flex justify-between pt-2">
                      <div className="h-4 w-24 bg-slate-200 rounded" />
                      <div className="flex gap-2">
                        <div className="h-8 w-12 bg-slate-200 rounded" />
                        <div className="h-8 w-20 bg-slate-200 rounded" />
                      </div>
                    </div>
                  </div>
                ))
              ) : filteredStudents.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-light">
                  No matching student records found.
                </div>
              ) : (
                filteredStudents.map((student) => {
                  const hasDue = student.balanceDue > 0;
                  const totalFees = student.totalFees ?? (student.paidAmount + student.balanceDue);
                  const pendingPercentage = student.pendingPercentage ?? (totalFees > 0 ? Math.round((student.balanceDue / totalFees) * 100) : 0);
                  const financialStatus = student.financialStatus || (hasDue ? `Pending Due (${pendingPercentage}%)` : 'Fully Paid (100%)');
                  return (
                    <div key={student.id} className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <StudentAvatar studentName={student.name} profilePhotoUrl={student.profilePhotoUrl} size="sm" />
                          <div>
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-bold font-mono">
                              Roll: {student.rollNo}
                            </span>
                            <h4 className="text-sm font-bold text-slate-800 mt-1">{student.name}</h4>
                            <p className="text-xs text-slate-400 font-medium mt-0.5">{student.email}</p>
                          </div>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${
                          hasDue 
                            ? 'bg-amber-50 text-amber-600 border border-amber-200' 
                            : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${hasDue ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                          {financialStatus}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-250/10">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold uppercase">Class & Section</span>
                          <span className="font-bold text-slate-700 block mt-0.5">
                            {student.class} - {student.section.replace('Section ', '')}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold uppercase">Parent / Guardian</span>
                          <span className="font-bold text-slate-700 block mt-0.5">{student.fatherName}</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2">
                        <a href={`tel:${student.phone}`} className="flex items-center gap-1 text-slate-500 text-xs font-semibold hover:text-blue-600 min-h-[44px]">
                          <Phone className="w-3.5 h-3.5" />
                          {student.phone}
                        </a>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingStudent(student)}
                            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:text-green-600 hover:border-green-200 hover:bg-green-50/30 transition-all text-xs font-bold min-h-[44px]"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleViewDetails(student)}
                            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/30 transition-all text-xs font-bold min-h-[44px] cursor-pointer"
                          >
                            View Profile
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Controls */}
            {!loading && totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 px-6 py-4 bg-slate-50/50">
                <div className="text-[12px] text-slate-550 font-medium text-center sm:text-left">
                  Showing <span className="font-bold text-slate-800">{((page - 1) * limit) + 1}</span> to{' '}
                  <span className="font-bold text-slate-800">{Math.min(page * limit, total)}</span> of{' '}
                  <span className="font-bold text-slate-800">{total}</span> records (Page <span className="font-bold text-slate-800">{page}</span> of <span className="font-bold text-slate-800">{totalPages}</span>)
                </div>
                <div className="flex flex-wrap items-center gap-1.5 justify-center">
                  <button
                    disabled={page === 1}
                    onClick={() => loadStudents(1)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-all text-xs font-bold min-h-[38px] cursor-pointer"
                    title="First Page"
                  >
                    First
                  </button>
                  <button
                    disabled={page === 1}
                    onClick={() => loadStudents(page - 1)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-650 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-all text-xs font-bold min-h-[38px] cursor-pointer"
                  >
                    Previous
                  </button>
                  
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const pNum = i + 1;
                    if (totalPages > 5 && Math.abs(page - pNum) > 1 && pNum !== 1 && pNum !== totalPages) {
                      if (pNum === 2 || pNum === totalPages - 1) {
                        return <span key={pNum} className="text-slate-400 text-xs px-1 select-none">...</span>;
                      }
                      return null;
                    }
                    return (
                      <button
                        key={pNum}
                        onClick={() => loadStudents(pNum)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold min-h-[38px] transition-all cursor-pointer ${
                          page === pNum
                            ? 'bg-[#2E5BFF] border-[#2E5BFF] text-white'
                            : 'border-slate-200 bg-white text-slate-650 hover:bg-slate-50'
                        }`}
                      >
                        {pNum}
                      </button>
                    );
                  })}

                  <button
                    disabled={page === totalPages}
                    onClick={() => loadStudents(page + 1)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-650 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-all text-xs font-bold min-h-[38px] cursor-pointer"
                  >
                    Next
                  </button>
                  <button
                    disabled={page === totalPages}
                    onClick={() => loadStudents(totalPages)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-all text-xs font-bold min-h-[38px] cursor-pointer"
                    title="Last Page"
                  >
                    Last
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Floating Bulk Actions Bar */}
          {(selectedIds.length > 0 || selectedClass !== 'All' || selectedSection !== 'All' || selectedYear !== 'All' || search !== '') && filteredStudents.length > 0 && (
            <div ref={barRef} className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-3 sm:px-6 sm:py-4 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center gap-3 sm:gap-4 z-40 border border-slate-800 animate-slide-up max-w-[90%] sm:max-w-max">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-xs font-semibold text-slate-300">
                  {selectedIds.length > 0 ? (
                    <span>
                      <strong className="text-white font-bold">{selectedIds.length}</strong> student(s) selected
                    </span>
                  ) : (
                    <span>
                      <strong className="text-white font-bold">{filteredStudents.length}</strong> student(s) match filters
                    </span>
                  )}
                </span>
              </div>
              <div className="h-4 w-px bg-slate-800 hidden sm:block" />
              <div className="flex gap-3">
                {selectedIds.length > 0 && (
                  <button
                    onClick={() => setDeleteConfirm({
                      show: true,
                      studentIds: selectedIds,
                      count: selectedIds.length,
                      yearName: selectedYear !== 'All' ? academicYears.find(ay => ay.id === selectedYear)?.name : undefined,
                      className: selectedClass !== 'All' ? selectedClass : undefined,
                      sectionName: selectedSection !== 'All' ? selectedSection : undefined
                    })}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer min-h-[38px] flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Selected ({selectedIds.length})
                  </button>
                )}
                <button
                  onClick={() => {
                    const filteredIds = filteredStudents.map(s => s.id);
                    setDeleteConfirm({
                      show: true,
                      studentIds: filteredIds,
                      count: filteredIds.length,
                      yearName: selectedYear !== 'All' ? academicYears.find(ay => ay.id === selectedYear)?.name : undefined,
                      className: selectedClass !== 'All' ? selectedClass : undefined,
                      sectionName: selectedSection !== 'All' ? selectedSection : undefined
                    });
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:text-white font-semibold text-xs transition-all cursor-pointer min-h-[38px] flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                  Delete All Filtered ({filteredStudents.length})
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* ================= DETAIL VIEW ================= */
        <div className="space-y-6">
          {/* Header Back Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setActiveStudent(null)}
                className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-all shadow-xs"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3">
                <StudentAvatar studentName={activeStudent.name} profilePhotoUrl={activeStudent.profilePhotoUrl} size="md" />
                <div>
                  <h2 className="text-[24px] font-extrabold text-slate-900 leading-none">
                    {activeStudent.name}
                  </h2>
                  <p className="text-slate-500 text-xs font-semibold mt-2">
                    Class: {activeStudent.class} | Section: {activeStudent.section}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                isPaidClear 
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                  : 'bg-amber-50 text-amber-600 border-amber-200'
              }`}>
                {isPaidClear ? 'Financial Clear' : 'Outstanding Balances'}
              </span>
              <button
                onClick={() => setEditingStudent(activeStudent)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-650 hover:text-green-600 hover:border-green-200 hover:bg-green-50/30 transition-all text-xs font-bold min-h-[44px]"
              >
                Edit Profile
              </button>
              <button
                onClick={() => setDeleteConfirm({
                  show: true,
                  studentIds: [activeStudent.id],
                  count: 1,
                  singleName: activeStudent.name,
                  yearName: selectedYear !== 'All' ? academicYears.find(ay => ay.id === selectedYear)?.name : undefined,
                  className: activeStudent.class !== 'N/A' ? activeStudent.class : undefined,
                  sectionName: activeStudent.section !== 'N/A' ? activeStudent.section : undefined
                })}
                className="p-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 transition-all shadow-xs cursor-pointer flex items-center justify-center min-h-[44px]"
                title="Delete Student"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Personal Info & Contacts */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Bio & Address Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <User className="w-5 h-5 text-blue-500" />
                  <h3 className="text-base font-bold text-slate-800">Address & Demographic Information</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block font-semibold">Father Name</span>
                    <span className="text-slate-700 text-sm font-bold block mt-1">{activeStudent.fatherName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Mother Name</span>
                    <span className="text-slate-700 text-sm font-bold block mt-1">{activeStudent.motherName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Date of Birth</span>
                    <span className="text-slate-700 text-sm font-bold block mt-1">2011-04-12</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">National Aadhar Card</span>
                    <span className="text-slate-700 text-sm font-mono font-bold block mt-1">{activeStudent.aadharNo}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Mobile Number</span>
                    <span className="text-slate-700 text-sm font-bold block mt-1">{activeStudent.phone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Nationality</span>
                    <span className="text-slate-700 text-sm font-bold block mt-1">Indian</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400 block font-semibold">Permanent Address</span>
                    <span className="text-slate-700 text-sm font-bold block mt-1">
                      12, Shanti Nagar, Main Road, Bangalore, Karnataka - 560001
                    </span>
                  </div>
                </div>
              </div>

              {/* Fee Information Summary Card */}
              {(() => {
                const overallPaid = detailData?.feeSummary
                  ? detailData.feeSummary.currentYear.paidAmount
                  : activeStudent.paidAmount;
                const overallPending = detailData?.feeSummary
                  ? detailData.feeSummary.currentYear.pendingAmount
                  : activeStudent.balanceDue;
                const overallAllocated = detailData?.feeSummary
                  ? detailData.feeSummary.currentYear.feeProductsAmount
                  : (overallPaid + overallPending);

                return (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                      <DollarSign className="w-5 h-5 text-blue-500" />
                      <h3 className="text-base font-bold text-slate-800">Fee Information Summary</h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl">
                        <span className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Allocated Amt</span>
                        <span className="text-slate-850 dark:text-slate-100 text-lg font-extrabold block mt-1">₹{overallAllocated.toLocaleString()}</span>
                      </div>
                      <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl">
                        <span className="text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider block">Total Paid</span>
                        <span className="text-emerald-800 dark:text-emerald-300 text-lg font-extrabold block mt-1">₹{overallPaid.toLocaleString()}</span>
                      </div>
                      <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl">
                        <span className="text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider block">Pending Bal</span>
                        <span className="text-amber-800 dark:text-amber-300 text-lg font-extrabold block mt-1">₹{overallPending.toLocaleString()}</span>
                      </div>
                      <div className="p-4 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-xl">
                        <span className="text-purple-700 dark:text-purple-400 text-[10px] font-bold uppercase tracking-wider block">Discount Given</span>
                        <span className="text-purple-800 dark:text-purple-300 text-lg font-extrabold block mt-1">₹{recFees.discVal.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Current Academic Year Fees Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-blue-500" />
                    <h3 className="text-base font-bold text-slate-800">Current Academic Year Fees</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-slate-200 rounded-lg px-2 py-1 bg-slate-50 text-xs">
                      <span className="text-slate-500 mr-2">Disc %</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="0"
                        value={tempDiscount}
                        onChange={(e) => setTempDiscount(Number(e.target.value))}
                        className="w-12 bg-transparent text-slate-800 font-bold outline-none text-right"
                      />
                    </div>
                    <button
                      onClick={handleApplyDiscount}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
                    >
                      Save
                    </button>
                     <select
                       value={selectedYear}
                       onChange={(e) => setSelectedYear(e.target.value)}
                       className="border border-slate-200 rounded-lg p-1.5 text-xs text-slate-700 font-bold bg-white"
                     >
                       {academicYears.map(ay => (
                         <option key={ay.id} value={ay.id}>{ay.name}</option>
                       ))}
                     </select>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border border-slate-100 rounded-xl w-full">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        <th className="px-4 py-3">Product / Fee Item</th>
                        <th className="px-4 py-3 text-right">Unit Price</th>
                        <th className="px-4 py-3 text-right">Total Amount</th>
                        <th className="px-4 py-3 text-right">Discount Amt</th>
                        <th className="px-4 py-3 text-right">Net Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-600 font-medium">
                      {recFees.list.map((prod: any, idx: number) => (
                        <tr key={prod.id}>
                          <td className="px-4 py-3 font-semibold text-slate-750">{prod.name}</td>
                          <td className="px-4 py-3 text-right font-mono">₹{prod.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="px-4 py-3 text-right font-mono">₹{prod.grossTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="px-4 py-3 text-right font-mono text-purple-600">₹{prod.discountAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">₹{prod.netTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-bold text-slate-800">
                        <td className="px-4 py-3">Session Fee Subtotal (Before Disc)</td>
                        <td colSpan={3}></td>
                        <td className="px-4 py-3 text-right font-mono">₹{recFees.subtotal.toLocaleString()}</td>
                      </tr>
                      {appliedDiscountPercent > 0 && (
                        <tr className="font-bold text-purple-600">
                          <td className="px-4 py-3">Applied Batch Discount (-)</td>
                          <td colSpan={3}></td>
                          <td className="px-4 py-3 text-right font-mono">-₹{recFees.discVal.toLocaleString()}</td>
                        </tr>
                      )}
                      <tr className="bg-blue-50/20 font-extrabold text-[#2E5BFF] text-[14px]">
                        <td className="px-4 py-3">Final Payable Amount</td>
                        <td colSpan={3}></td>
                        <td className="px-4 py-3 text-right font-mono">₹{recFees.final.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Previous Year Balance Brought Forward Section */}
                {recFees.previousYearsDues && recFees.previousYearsDues.length > 0 && (
                  <div className="mt-6 border-t border-slate-100 pt-5 space-y-3">
                    <h4 className="text-xs font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      Previous Year Balance Brought Forward
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {recFees.previousYearsDues.map((item: any, idx: number) => (
                        <div key={idx} className="bg-rose-50/50 border border-rose-100 rounded-xl p-3.5 flex justify-between items-center text-xs">
                          <div>
                            <span className="text-slate-500 font-medium block">Academic Year</span>
                            <strong className="text-slate-800 text-sm font-bold block mt-0.5">{item.yearName}</strong>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-500 font-medium block">Outstanding Balance</span>
                            <strong className="text-rose-600 text-sm font-extrabold block mt-0.5">₹{item.balance.toLocaleString()}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Grand Total Outstanding Banner */}
                {recFees.previousYearsDues && recFees.previousYearsDues.length > 0 && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl flex justify-between items-center shadow-sm">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Grand Total Outstanding</span>
                      <p className="text-[11px] text-slate-350 mt-0.5">(Current Year + Previous Years Outstanding)</p>
                    </div>
                    <strong className="text-rose-400 text-lg font-black font-mono">
                      ₹{(recFees.final + recFees.totalPreviousYearDue).toLocaleString()}
                    </strong>
                  </div>
                )}
              </div>

              {/* Invoice Transactions Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-blue-500" />
                    <h3 className="text-base font-bold text-slate-800">Invoice Details</h3>
                  </div>
                  <span className="text-xs text-slate-500 font-bold bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg">
                    {detailData?.invoices.length} Invoices
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-100 rounded-xl w-full">
                  <table className="w-full text-left border-collapse min-w-[650px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Invoice #</th>
                        <th className="px-4 py-3">Payment Mode</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Line items</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-600 font-medium">
                      {detailData?.invoices.map((inv: any) => {
                        const isExpanded = !!expandedInvoices[inv.id];
                        return (
                          <React.Fragment key={inv.id}>
                            <tr className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3">{inv.date}</td>
                              <td className="px-4 py-3 font-semibold text-blue-600">{inv.number}</td>
                              <td className="px-4 py-3">{inv.mode}</td>
                              <td className="px-4 py-3 font-bold text-slate-800 font-mono">₹{inv.amount.toLocaleString()}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  inv.status === 'Paid'
                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                    : 'bg-amber-50 text-amber-600 border-amber-100'
                                }`}>
                                  {inv.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => toggleInvoice(inv.id)}
                                  className="p-1 rounded-md hover:bg-slate-100 inline-flex items-center"
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                                </button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-slate-50/50">
                                <td colSpan={6} className="px-6 py-3 border-t border-b border-slate-100">
                                  <div className="space-y-2 max-w-md">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Particulars Breakdown:</div>
                                    {inv.items.map((it: any, idx: number) => (
                                      <div key={idx} className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500 font-semibold">{it.name}</span>
                                        <span className="text-slate-800 font-bold font-mono">₹{it.amount.toLocaleString()}</span>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Column 2: Progress Card, Performance Report, Behaviour */}
            <div className="space-y-6">
              
              {/* Progress Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <CheckCircle className="w-5 h-5 text-blue-500" />
                  <h3 className="text-base font-bold text-slate-800">Progress Card</h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center font-extrabold text-[#2E5BFF] text-2xl shadow-sm">
                    A
                  </div>
                  <div>
                    <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Overall Average</div>
                    <div className="text-2xl font-extrabold text-slate-800">86%</div>
                  </div>
                </div>
                <div className="p-3.5 bg-blue-50/20 border border-blue-100/30 rounded-xl text-xs text-slate-600 leading-relaxed font-medium">
                  Excellent academic standing! Consistently matches exam requirements.
                </div>
                
                {/* Syllabus progression */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-xs font-semibold text-slate-600">
                    <span>Year Syllabus Progress</span>
                    <span>65%</span>
                  </div>
                  <div className="bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-[#2E5BFF] h-full rounded-full" style={{ width: '65%' }} />
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">65% of academic catalog syllabus completed.</p>
                </div>
              </div>

              {/* Performance Report */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Award className="w-5 h-5 text-blue-500" />
                  <h3 className="text-base font-bold text-slate-800">Performance Report</h3>
                </div>
                
                {/* Exam Category Tabs */}
                <div className="flex border-b border-slate-100 gap-4 text-xs font-bold overflow-x-auto whitespace-nowrap scrollbar-none pb-0.5">
                  {dynamicExamTabs.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setSelectedExamTab(tab)}
                      className={`pb-2.5 transition-all border-b-2 uppercase ${
                        selectedExamTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Exam Cards */}
                <div className="space-y-3 pt-2">
                  {detailData?.exams
                    .filter((ex: any) => ex.type === selectedExamTab)
                    .map((ex: any) => {
                      const isExpanded = !!expandedExams[ex.id];
                      return (
                        <div key={ex.id} className="border border-slate-100 rounded-xl overflow-hidden">
                          <div
                            onClick={() => toggleExam(ex.id)}
                            className="flex justify-between items-center p-3 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <BookOpen className="w-4 h-4 text-slate-500" />
                              <div className="text-xs font-bold text-slate-700">{ex.name}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-emerald-600">{ex.score}</span>
                              {isExpanded ? <ChevronUp className="w-4.5 h-4.5 text-slate-400" /> : <ChevronDown className="w-4.5 h-4.5 text-slate-400" />}
                            </div>
                          </div>
                          
                          {isExpanded && (
                            <div className="p-3 border-t border-slate-100 bg-white space-y-2 text-xs">
                              {ex.subjects.map((subj: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-50 last:border-none">
                                  <span className="text-slate-500 font-semibold">{subj.name}</span>
                                  <span className="text-slate-800 font-extrabold font-mono">{subj.score} / {subj.max}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Student Behaviour (incidents cases) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <ShieldAlert className="w-5 h-5 text-blue-500" />
                  <h3 className="text-base font-bold text-slate-800">Student Behaviour</h3>
                </div>

                {detailData && detailData.cases.length > 0 ? (
                  <div className="space-y-3">
                    {detailData.cases.map((c: any) => (
                      <div key={c.id} className="border border-slate-100 rounded-xl p-3 bg-slate-50/30 space-y-2 text-xs">
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-bold text-slate-750 leading-snug">{c.subject}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                            c.type === 'Positive' 
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                              : 'bg-rose-50 text-rose-600 border border-rose-100'
                          }`}>
                            {c.type}
                          </span>
                        </div>
                        <p className="text-slate-500 text-[11px] font-light leading-relaxed">{c.description}</p>
                        <div className="flex justify-between text-[10px] text-slate-400 font-semibold pt-1 border-t border-slate-100/50">
                          <span>Priority: {c.priority}</span>
                          <span>Date: {c.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center bg-slate-50/50 border border-dashed border-slate-200 rounded-xl space-y-2">
                    <span className="text-2xl block">😇</span>
                    <h4 className="text-xs font-bold text-slate-700">Perfect Record</h4>
                    <p className="text-[11px] text-slate-400 font-light leading-relaxed">
                      Student demonstrates exemplary behavior, punctuality, and group work dedication.
                    </p>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
      {/* ── CUSTOM DELETE CONFIRMATION MODAL ── */}
      {deleteConfirm.show && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50 animate-fade-in" onClick={() => setDeleteConfirm(prev => ({ ...prev, show: false }))} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl z-50 p-6 animate-scale-in">
            <div className="text-center py-2">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-xl mx-auto mb-3">
                ⚠️
              </div>
              <h3 className="font-extrabold text-slate-800 text-lg mb-2">Confirm Student Deletion</h3>
              
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-left text-xs mb-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Total Students:</span>
                  <span className="text-slate-800 font-extrabold">{deleteConfirm.count}</span>
                </div>
                {deleteConfirm.singleName && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Student Name:</span>
                    <span className="text-slate-800 font-extrabold">{deleteConfirm.singleName}</span>
                  </div>
                )}
                {deleteConfirm.yearName && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Academic Year:</span>
                    <span className="text-slate-800 font-extrabold">{deleteConfirm.yearName}</span>
                  </div>
                )}
                {deleteConfirm.className && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Class:</span>
                    <span className="text-slate-800 font-extrabold">{deleteConfirm.className}</span>
                  </div>
                )}
                {deleteConfirm.sectionName && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Section:</span>
                    <span className="text-slate-800 font-extrabold">{deleteConfirm.sectionName}</span>
                  </div>
                )}
              </div>

              <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs font-semibold rounded-xl text-left leading-relaxed mb-5">
                <strong>CRITICAL WARNING:</strong> Deleting student profile(s) will cascade and remove all related invoices, payments, attendance records, exam marks, and discipline cases. This action is permanent and cannot be undone.
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(prev => ({ ...prev, show: false }))}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 transition-all cursor-pointer min-h-[38px]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer font-extrabold min-h-[38px]"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </>
      )}
      {editingStudent && (
        <EditStudentModal
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSave={async () => {
            const updatedId = editingStudent.id;
            setEditingStudent(null);
            await loadStudents();
            if (activeStudent && activeStudent.id === updatedId) {
              await handleViewDetails({ id: updatedId } as Student);
            }
          }}
        />
      )}
    </div>
  );
}
