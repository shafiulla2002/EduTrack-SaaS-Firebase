'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  DollarSign,
  Receipt,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Award,
  BookOpen,
  ShieldAlert,
  Trash2,
  Calendar as CalendarIcon,
  Phone,
  Mail,
} from 'lucide-react';
import { api, fastGet } from '@/lib/api';
import EditStudentModal from '@/components/EditStudentModal';
import { useToast } from '@/components/Toast';
import StudentAvatar from '@/components/StudentAvatar';
import { PencilSpinner, EmptyState, ErrorState } from '@/components/loading';

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

export default function StudentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const studentId = params?.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [studentDetails, setStudentDetails] = useState<any>(null);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('All');
  const [loading, setLoading] = useState<boolean>(true);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<boolean>(false);

  // Tab & Collapse States
  const [selectedExamTab, setSelectedExamTab] = useState<string>('Unit Test');
  const [expandedInvoices, setExpandedInvoices] = useState<Record<string, boolean>>({});
  const [expandedExams, setExpandedExams] = useState<Record<string, boolean>>({});
  const [tempDiscount, setTempDiscount] = useState<number>(0);
  const [appliedDiscountPercent, setAppliedDiscountPercent] = useState<number>(0);

  // Edit & Delete Modals
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Fetch full student profile data
  const fetchStudentData = useCallback(async (yearId?: string) => {
    if (!studentId) return;

    try {
      if (!student) {
        setLoading(true);
      } else {
        setDetailsLoading(true);
      }
      setError(null);
      setNotFound(false);

      const targetYear = yearId !== undefined ? yearId : selectedYear;

      const [detailsRes, casesRes, yearsRes] = await Promise.all([
        api.get(`/students/${studentId}`, {
          params: targetYear && targetYear !== 'All' ? { academicYearId: targetYear } : {},
        }),
        api.get(`/complaint-box/student-cases/${studentId}`).catch(() => ({ data: [] })),
        fastGet('/academic-years', undefined, { ttlMs: 60000 }).catch(() => ({ data: [] })),
      ]);

      const data = detailsRes.data;
      if (!data || !data.id) {
        setNotFound(true);
        setLoading(false);
        setDetailsLoading(false);
        return;
      }

      const casesData = casesRes.data || [];
      const yearsData = yearsRes.data || [];
      setAcademicYears(Array.isArray(yearsData) ? yearsData : []);

      const paid =
        data.paidAmount !== undefined
          ? Number(data.paidAmount)
          : data.invoices?.reduce((sum: number, inv: any) => sum + Number(inv.paidAmount), 0) || 0;
      const due =
        data.balanceDue !== undefined
          ? Number(data.balanceDue)
          : data.invoices?.reduce((sum: number, inv: any) => sum + Number(inv.remainingBalance), 0) || 0;

      const fullStudent: Student = {
        id: data.id,
        rollNo: data.rollNo || 'N/A',
        name: data.user?.name || 'Unknown Student',
        email: data.user?.email || 'N/A',
        phone: data.user?.phone
          ? data.user.phone.includes('-')
            ? data.user.phone.split('-').pop() || data.user.phone
            : data.user.phone
          : 'N/A',
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

      // Process Exams
      const examsMap: Record<string, any> = {};
      data.examMarks?.forEach((mark: any) => {
        const exId = mark.exam?.id || 'exam';
        if (!examsMap[exId]) {
          examsMap[exId] = {
            id: exId,
            name: mark.exam?.name || 'Exam',
            type: mark.exam?.type || 'Unit Test',
            subjects: [],
          };
        }
        examsMap[exId].subjects.push({
          name: mark.subject?.name || 'Subject',
          score: Number(mark.marksObtained || 0),
          max: 100,
        });
      });

      const exams = Object.values(examsMap).map((ex: any) => {
        const total = ex.subjects.reduce((sum: number, s: any) => sum + s.score, 0);
        const avg = ex.subjects.length > 0 ? (total / ex.subjects.length).toFixed(0) : '0';
        return {
          ...ex,
          score: `${avg}%`,
        };
      });

      setStudent(fullStudent);
      setStudentDetails({
        products:
          data.feeItems?.map((item: any) => ({
            id: item.oliId || item.id,
            name: item.productName || item.name,
            price: Number(item.totalAmount || item.unitPrice || 0),
            grossTotal: Number(item.totalAmount || 0),
            discountPercent: Number(item.discountPercent || 0),
            discountAmount: Number(item.discountAmount || 0),
            netTotal: Number(item.netAmount || 0),
            paid: Number(item.paidAmount || 0),
            balance: Number(item.balanceDue || 0),
          })) || [],
        feeSummary: data.feeSummary,
        invoices:
          data.invoices?.map((inv: any) => ({
            id: inv.id,
            date: inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().split('T')[0] : '—',
            number: `INV-${inv.id.substring(0, 8).toUpperCase()}`,
            mode: inv.paymentMethod || '—',
            amount: Number(inv.totalAmount || 0),
            paidAmount: Number(inv.paidAmount || 0),
            remainingBalance: Number(inv.remainingBalance || 0),
            status: inv.status === 'PAID' ? 'Paid' : 'Pending',
            academicYearId: inv.opportunity?.academicYearId || null,
            academicYearName: inv.opportunity?.academicYear?.name || null,
            items:
              inv.invoiceItems?.map((it: any) => ({
                name: it.name,
                amount: Number(it.amount || 0),
              })) || [],
          })) || [],
        exams,
        cases: casesData.map((c: any) => ({
          id: c.id,
          type: c.behaviorType === 'Praise' ? 'Positive' : 'Negative',
          typeIcon: c.behaviorType === 'Praise' ? '⭐' : '⚠️',
          subject: c.category || 'Discipline',
          priority: c.priority || 'Normal',
          status: c.status || 'Active',
          date: c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : '',
          description: c.description || '',
        })),
      });

      if (exams.length > 0 && selectedExamTab === 'Unit Test') {
        setSelectedExamTab(exams[0].type || 'Unit Test');
      }
    } catch (err: any) {
      console.error('Failed to load student profile:', err);
      if (err.response?.status === 404) {
        setNotFound(true);
      } else {
        setError(err.response?.data?.message || err.message || 'Unable to load student profile.');
      }
    } finally {
      setLoading(false);
      setDetailsLoading(false);
    }
  }, [studentId, selectedYear]);

  useEffect(() => {
    fetchStudentData();
  }, [fetchStudentData]);

  const handleYearChange = (newYear: string) => {
    setSelectedYear(newYear);
    fetchStudentData(newYear);
  };

  const handleApplyDiscount = () => {
    if (tempDiscount < 0 || tempDiscount > 100) {
      showToast('Please enter a valid percentage between 0 and 100.', 'warning');
      return;
    }
    setAppliedDiscountPercent(tempDiscount);
    showToast(`Success: Discount of ${tempDiscount}% applied to current academic session fee.`, 'success');
  };

  const toggleInvoice = (id: string) => {
    setExpandedInvoices((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleExam = (id: string) => {
    setExpandedExams((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDeleteStudent = async () => {
    if (!student) return;
    try {
      setIsDeleting(true);
      await api.delete(`/students/${student.id}`);
      showToast(`Student ${student.name} deleted successfully.`, 'success');
      setDeleteConfirm(false);
      router.push('/dashboard/students');
    } catch (err: any) {
      console.error('Failed to delete student:', err);
      showToast(err.response?.data?.message || 'Failed to delete student.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Exam tabs calculation
  const dynamicExamTabs = useMemo(() => {
    if (!studentDetails?.exams || studentDetails.exams.length === 0) {
      return ['Unit Test', 'Quarterly', 'Final'];
    }
    const typesSet = new Set<string>();
    studentDetails.exams.forEach((ex: any) => {
      if (ex.type) typesSet.add(ex.type);
    });
    const list = Array.from(typesSet);
    return list.length > 0 ? list : ['Unit Test', 'Quarterly', 'Final'];
  }, [studentDetails]);

  const isPaidClear = student ? student.balanceDue <= 0 : false;

  // Recalculated values based on discount
  const recFees = useMemo(() => {
    if (!student || !studentDetails) {
      return {
        list: [],
        subtotal: 0,
        discVal: 0,
        final: 0,
        previousYearsDues: [],
        totalPreviousYearDue: 0,
      };
    }

    const productsList = studentDetails.products || [];
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
        netTotal,
      };
    });

    const previousYearsDues =
      studentDetails.feeSummary?.previousYears?.map((py: any) => ({
        yearName: py.academicYearName,
        balance: py.outstandingBalance,
      })) || [];

    const totalPreviousYearDue = studentDetails.feeSummary?.overall?.totalPreviousYearDue || 0;

    return {
      list,
      subtotal,
      discVal,
      final: finalVal,
      previousYearsDues,
      totalPreviousYearDue,
    };
  }, [student, studentDetails, appliedDiscountPercent]);

  // Loading State
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center animate-in fade-in duration-200">
        <PencilSpinner size="lg" label="Loading student profile..." showLabel />
        <p className="text-slate-500 text-sm font-semibold mt-4">
          Fetching student records, fee accounts, and performance data...
        </p>
      </div>
    );
  }

  // Not Found State
  if (notFound) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center max-w-lg mx-auto my-12 shadow-sm animate-in fade-in">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-extrabold text-slate-800">Student Not Found</h3>
        <p className="text-slate-500 text-sm font-medium mt-2 mb-6 leading-relaxed">
          The student profile you requested does not exist or has been removed.
        </p>
        <button
          onClick={() => router.push('/dashboard/students')}
          className="px-5 py-2.5 rounded-xl bg-[#2E5BFF] hover:bg-blue-700 text-white font-bold text-sm transition-all shadow-sm flex items-center gap-2 mx-auto cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Student Directory</span>
        </button>
      </div>
    );
  }

  // Error State
  if (error || !student) {
    return (
      <div className="bg-white border border-rose-200 rounded-2xl p-10 text-center max-w-lg mx-auto my-12 shadow-sm animate-in fade-in">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-extrabold text-slate-800">Unable to Load Profile</h3>
        <p className="text-slate-500 text-sm font-medium mt-2 mb-6 leading-relaxed">
          {error || 'An unexpected error occurred while fetching student data. Please try again.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => fetchStudentData()}
            className="px-5 py-2.5 rounded-xl bg-[#2E5BFF] hover:bg-blue-700 text-white font-bold text-sm transition-all shadow-sm cursor-pointer"
          >
            Retry
          </button>
          <button
            onClick={() => router.push('/dashboard/students')}
            className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm transition-all shadow-sm cursor-pointer"
          >
            Back to Directory
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      {/* Header Back & Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/students')}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-all shadow-xs cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
            title="Back to Student Directory"
            aria-label="Back to Student Directory"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <StudentAvatar studentName={student.name} profilePhotoUrl={student.profilePhotoUrl} size="md" />
            <div>
              <h2 className="text-[24px] font-extrabold text-slate-900 leading-none">
                {student.name}
              </h2>
              <p className="text-slate-500 text-xs font-semibold mt-2">
                Class: {student.class} | Section: {student.section}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold border ${
              isPaidClear
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                : 'bg-amber-50 text-amber-600 border-amber-200'
            }`}
          >
            {isPaidClear ? 'Financial Clear' : 'Outstanding Balances'}
          </span>
          <button
            onClick={() => setEditingStudent(student)}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:text-green-600 hover:border-green-200 hover:bg-green-50/30 transition-all text-xs font-bold shadow-xs cursor-pointer min-h-[38px]"
          >
            Edit Profile
          </button>
          <button
            onClick={() => setDeleteConfirm(true)}
            className="p-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 transition-all shadow-xs cursor-pointer flex items-center justify-center min-h-[38px] min-w-[38px]"
            title="Delete Student"
            aria-label="Delete Student"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Personal Info & Contacts, Fees & Invoices */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bio & Address Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <User className="w-5 h-5 text-blue-500" />
              <h3 className="text-base font-bold text-slate-800">Address &amp; Demographic Information</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block font-semibold">Father Name</span>
                <span className="text-slate-700 text-sm font-bold block mt-1">{student.fatherName}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Mother Name</span>
                <span className="text-slate-700 text-sm font-bold block mt-1">{student.motherName}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Date of Birth</span>
                <span className="text-slate-700 text-sm font-bold block mt-1">2011-04-12</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">National Aadhar Card</span>
                <span className="text-slate-700 text-sm font-mono font-bold block mt-1">{student.aadharNo}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Mobile Number</span>
                <span className="text-slate-700 text-sm font-bold block mt-1">{student.phone}</span>
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
            const overallPaid = studentDetails?.feeSummary
              ? studentDetails.feeSummary.currentYear.paidAmount
              : student.paidAmount;
            const overallPending = studentDetails?.feeSummary
              ? studentDetails.feeSummary.currentYear.pendingAmount
              : student.balanceDue;
            const overallAllocated = studentDetails?.feeSummary
              ? studentDetails.feeSummary.currentYear.feeProductsAmount
              : overallPaid + overallPending;

            return (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <DollarSign className="w-5 h-5 text-blue-500" />
                  <h3 className="text-base font-bold text-slate-800">Fee Information Summary</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">Allocated Amt</span>
                    <span className="text-slate-850 text-lg font-extrabold block mt-1">
                      ₹{overallAllocated.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <span className="text-emerald-700 text-[10px] font-bold uppercase tracking-wider block">Total Paid</span>
                    <span className="text-emerald-800 text-lg font-extrabold block mt-1">
                      ₹{overallPaid.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <span className="text-amber-700 text-[10px] font-bold uppercase tracking-wider block">Pending Bal</span>
                    <span className="text-amber-800 text-lg font-extrabold block mt-1">
                      ₹{overallPending.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
                    <span className="text-purple-700 text-[10px] font-bold uppercase tracking-wider block">Discount Given</span>
                    <span className="text-purple-800 text-lg font-extrabold block mt-1">
                      ₹{recFees.discVal.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Current Academic Year Fees Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5 relative">
            {detailsLoading && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs rounded-2xl flex items-center justify-center z-10">
                <PencilSpinner size="sm" />
              </div>
            )}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-bold text-slate-800">Current Academic Year Fees</h3>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
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
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  Save
                </button>
                <select
                  value={selectedYear}
                  onChange={(e) => handleYearChange(e.target.value)}
                  className="border border-slate-200 rounded-lg p-1.5 text-xs text-slate-700 font-bold bg-white cursor-pointer shadow-xs"
                >
                  <option value="All">All Academic Years</option>
                  {academicYears.map((ay) => (
                    <option key={ay.id} value={ay.id}>
                      {ay.name}
                    </option>
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
                  {recFees.list.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-400 text-xs">
                        No fee structure items recorded for this academic session.
                      </td>
                    </tr>
                  ) : (
                    recFees.list.map((prod: any) => (
                      <tr key={prod.id}>
                        <td className="px-4 py-3 font-semibold text-slate-750">{prod.name}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          ₹{prod.price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          ₹{prod.grossTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-purple-600">
                          ₹{prod.discountAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                          ₹{prod.netTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))
                  )}
                  {recFees.list.length > 0 && (
                    <>
                      <tr className="bg-slate-50 font-bold text-slate-800">
                        <td className="px-4 py-3">Session Fee Subtotal (Before Disc)</td>
                        <td colSpan={3}></td>
                        <td className="px-4 py-3 text-right font-mono">₹{recFees.subtotal.toLocaleString('en-IN')}</td>
                      </tr>
                      {appliedDiscountPercent > 0 && (
                        <tr className="font-bold text-purple-600">
                          <td className="px-4 py-3">Applied Batch Discount (-)</td>
                          <td colSpan={3}></td>
                          <td className="px-4 py-3 text-right font-mono">-₹{recFees.discVal.toLocaleString('en-IN')}</td>
                        </tr>
                      )}
                      <tr className="bg-blue-50/20 font-extrabold text-[#2E5BFF] text-[14px]">
                        <td className="px-4 py-3">Final Payable Amount</td>
                        <td colSpan={3}></td>
                        <td className="px-4 py-3 text-right font-mono">₹{recFees.final.toLocaleString('en-IN')}</td>
                      </tr>
                    </>
                  )}
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
                    <div
                      key={idx}
                      className="bg-rose-50/50 border border-rose-100 rounded-xl p-3.5 flex justify-between items-center text-xs"
                    >
                      <div>
                        <span className="text-slate-500 font-medium block">Academic Year</span>
                        <strong className="text-slate-800 text-sm font-bold block mt-0.5">{item.yearName}</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 font-medium block">Outstanding Balance</span>
                        <strong className="text-rose-600 text-sm font-extrabold block mt-0.5">
                          ₹{Number(item.balance || 0).toLocaleString('en-IN')}
                        </strong>
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
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Grand Total Outstanding
                  </span>
                  <p className="text-[11px] text-slate-350 mt-0.5">(Current Year + Previous Years Outstanding)</p>
                </div>
                <strong className="text-rose-400 text-lg font-black font-mono">
                  ₹{(recFees.final + recFees.totalPreviousYearDue).toLocaleString('en-IN')}
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
              <span className="text-xs text-slate-500 font-bold bg-slate-50 border border-slate-100 px-2.5 py-0.5 rounded-lg">
                {studentDetails?.invoices?.length || 0} Invoices
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
                  {!studentDetails?.invoices || studentDetails.invoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-400 text-xs">
                        No invoice billing records on file.
                      </td>
                    </tr>
                  ) : (
                    studentDetails.invoices.map((inv: any) => {
                      const isExpanded = !!expandedInvoices[inv.id];
                      return (
                        <React.Fragment key={inv.id}>
                          <tr className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3">{inv.date}</td>
                            <td className="px-4 py-3 font-semibold text-blue-600">{inv.number}</td>
                            <td className="px-4 py-3">{inv.mode}</td>
                            <td className="px-4 py-3 font-bold text-slate-800 font-mono">
                              ₹{inv.amount.toLocaleString('en-IN')}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  inv.status === 'Paid'
                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                    : 'bg-amber-50 text-amber-600 border-amber-100'
                                }`}
                              >
                                {inv.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => toggleInvoice(inv.id)}
                                className="p-1 rounded-md hover:bg-slate-100 inline-flex items-center cursor-pointer"
                                aria-label="Toggle invoice line items"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-slate-500" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-slate-500" />
                                )}
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-50/50">
                              <td colSpan={6} className="px-6 py-3 border-t border-b border-slate-100">
                                <div className="space-y-2 max-w-md">
                                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                    Particulars Breakdown:
                                  </div>
                                  {inv.items.map((it: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center text-xs">
                                      <span className="text-slate-500 font-semibold">{it.name}</span>
                                      <span className="text-slate-800 font-bold font-mono">
                                        ₹{it.amount.toLocaleString('en-IN')}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
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
                  className={`pb-2.5 transition-all border-b-2 uppercase cursor-pointer ${
                    selectedExamTab === tab
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Exam Cards */}
            <div className="space-y-3 pt-2">
              {!studentDetails?.exams ||
              studentDetails.exams.filter((ex: any) => ex.type === selectedExamTab).length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No exam scores available for {selectedExamTab}.</p>
              ) : (
                studentDetails.exams
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
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-3 border-t border-slate-100 bg-white space-y-2 text-xs">
                            {ex.subjects.map((subj: any, idx: number) => (
                              <div
                                key={idx}
                                className="flex justify-between items-center py-1 border-b border-slate-50 last:border-none"
                              >
                                <span className="text-slate-500 font-semibold">{subj.name}</span>
                                <span className="text-slate-800 font-extrabold font-mono">
                                  {subj.score} / {subj.max}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          {/* Student Behaviour (incidents cases) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <ShieldAlert className="w-5 h-5 text-blue-500" />
              <h3 className="text-base font-bold text-slate-800">Student Behaviour</h3>
            </div>

            {studentDetails && studentDetails.cases && studentDetails.cases.length > 0 ? (
              <div className="space-y-3">
                {studentDetails.cases.map((c: any) => (
                  <div key={c.id} className="border border-slate-100 rounded-xl p-3 bg-slate-50/30 space-y-2 text-xs">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-bold text-slate-750 leading-snug">{c.subject}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                          c.type === 'Positive'
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            : 'bg-rose-50 text-rose-600 border border-rose-100'
                        }`}
                      >
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50 animate-fade-in"
            onClick={() => setDeleteConfirm(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl z-50 p-6 animate-scale-in">
            <div className="text-center py-2">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-xl mx-auto mb-3">
                ⚠️
              </div>
              <h3 className="font-extrabold text-slate-800 text-lg mb-2">Confirm Student Deletion</h3>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-left text-xs mb-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Student Name:</span>
                  <span className="text-slate-800 font-extrabold">{student.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Class / Section:</span>
                  <span className="text-slate-800 font-extrabold">
                    {student.class} - {student.section}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Roll No:</span>
                  <span className="text-slate-800 font-extrabold">{student.rollNo}</span>
                </div>
              </div>

              <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs font-semibold rounded-xl text-left leading-relaxed mb-5">
                <strong>CRITICAL WARNING:</strong> Deleting this student profile will cascade and remove all related
                invoices, payments, attendance records, exam marks, and discipline cases. This action cannot be undone.
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 transition-all cursor-pointer min-h-[38px] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteStudent}
                disabled={isDeleting}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer font-extrabold min-h-[38px] disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <PencilSpinner size="xs" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  'Yes, Delete'
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <EditStudentModal
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSave={async () => {
            setEditingStudent(null);
            await fetchStudentData();
          }}
        />
      )}
    </div>
  );
}
