'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, ArrowLeft, Plus, X, Phone, Mail, Award, Receipt, 
  CheckCircle, AlertTriangle, ChevronDown, ChevronUp, User, 
  MapPin, Calendar as CalendarIcon, DollarSign, BookOpen, ShieldAlert,
  Percent, Trash2, FileText, Download
} from 'lucide-react';
import { api, fastGet } from '@/lib/api';
import EditStudentModal from '@/components/EditStudentModal';
import { useSchoolSetupUpdate } from '@/lib/events';
import { useToast } from '@/components/Toast';
import StudentAvatar from '@/components/StudentAvatar';
import axios from 'axios';
import { useFloatingBarPadding } from '@/hooks/useFloatingBarPadding';
import {
  LoadingSpinner,
  EmptyState,
} from '@/components/loading';

interface Student {
  id: string;
  rollNo: string;
  name: string;
  email: string;
  phone: string;
  fatherPhone?: string;
  motherPhone?: string;
  guardianPhone?: string;
  class: string;
  section: string;
  fatherName: string;
  motherName: string;
  aadharNo: string;
  paidAmount: number;
  balanceDue: number;
  totalFees: number;
  pendingPercentage: number;
  paidPercentage: number;
  financialStatus: string;
  academicYearId: string;
  profilePhotoUrl?: string | null;
}

export default function StudentsDirectory() {
  const router = useRouter();
  const { showToast } = useToast();

  // Filter States
  const [searchVal, setSearchVal] = useState('');
  const [search, setSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedClass, setSelectedClass] = useState('All');
  const [selectedSection, setSelectedSection] = useState('All');
  const [selectedFinancialStatus, setSelectedFinancialStatus] = useState('All');

  // Metadata dropdown options
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);

  // Request-specific loading states (Requirement 13)
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // Student dataset
  const [students, setStudents] = useState<Student[]>([]);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Delete modal state
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

  // Race Condition & Abort Guards (Requirement 4 & 15)
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<number>(0);

  // ── Unified Student Data Mapper (Requirement 16) ──────────────────────────
  const mapStudentRecord = useCallback((s: any): Student => {
    const paid = s.paidAmount !== undefined ? Number(s.paidAmount) : (s.invoices?.reduce((sum: number, inv: any) => sum + Number(inv.paidAmount), 0) || 0);
    const due = s.balanceDue !== undefined ? Number(s.balanceDue) : (s.invoices?.reduce((sum: number, inv: any) => sum + Number(inv.remainingBalance), 0) || 0);
    const totalFees = s.totalFees !== undefined ? Number(s.totalFees) : (paid + due);
    const pendingPercentage = s.pendingPercentage !== undefined ? Number(s.pendingPercentage) : (totalFees > 0 ? Math.round((due / totalFees) * 100) : 0);
    const paidPercentage = s.paidPercentage !== undefined ? Number(s.paidPercentage) : (totalFees > 0 ? Math.round((paid / totalFees) * 100) : 100);

    const financialStatus = s.financialStatus || (due > 0 ? `Pending Due (${pendingPercentage}%)` : 'Fully Paid (100%)');

    const rawPhone = s.user?.phone || s.fatherPhone || s.guardianPhone || s.motherPhone || '';
    const cleanPhone = !rawPhone ? 'N/A' : (rawPhone.includes('-') ? rawPhone.split('-').pop() || rawPhone : rawPhone);

    return {
      id: s.id,
      rollNo: s.rollNo || 'N/A',
      name: s.user?.name || s.name || 'Unknown Student',
      email: s.user?.email || 'N/A',
      phone: cleanPhone,
      fatherPhone: s.fatherPhone || 'N/A',
      motherPhone: s.motherPhone || 'N/A',
      guardianPhone: s.guardianPhone || 'N/A',
      class: s.classSection?.class?.name || s.class || 'N/A',
      section: s.classSection?.section?.name || s.section || 'N/A',
      fatherName: s.fatherName || s.parentName || 'N/A',
      motherName: s.motherName || 'N/A',
      aadharNo: s.aadharNo || 'N/A',
      paidAmount: paid,
      balanceDue: due,
      totalFees,
      pendingPercentage,
      paidPercentage,
      financialStatus,
      academicYearId: s.classSection?.class?.academicYearId || '',
      profilePhotoUrl: s.profilePhotoUrl || null,
    };
  }, []);

  // ── Canonical Query Builder (Requirements 9, 10, 11) ──────────────────────
  const buildStudentQueryParams = useCallback((pageNumber?: number, customLimit?: number) => {
    const academicYearId = selectedYear === 'All' || !selectedYear ? undefined : selectedYear;

    // Requirement 10: Scope class resolution to the currently selected academicYearId
    let classId: string | undefined;
    let className: string | undefined;

    if (selectedClass !== 'All' && selectedClass.trim()) {
      className = selectedClass.trim();
      if (academicYearId) {
        const matchingClass = classes.find(c => c.name === selectedClass && c.academicYearId === academicYearId);
        if (matchingClass) {
          classId = matchingClass.id;
        }
      } else {
        const matchingClass = classes.find(c => c.name === selectedClass);
        if (matchingClass) {
          classId = matchingClass.id;
        }
      }
    }

    // Requirement 11: Canonical section filter
    let sectionId: string | undefined;
    let sectionName: string | undefined;

    if (selectedSection !== 'All' && selectedSection.trim()) {
      sectionName = selectedSection.trim();
      const cleanSecFilter = selectedSection.replace(/^section\s*[-_]?/i, '').trim().toLowerCase();
      const matchingSection = sections.find(s => {
        if (s.name === selectedSection) return true;
        const sClean = (s.name || '').replace(/^section\s*[-_]?/i, '').trim().toLowerCase();
        return sClean === cleanSecFilter;
      });
      if (matchingSection) {
        sectionId = matchingSection.id;
      }
    }

    const trimmedSearch = search.trim();

    return {
      ...(pageNumber !== undefined ? { page: pageNumber } : {}),
      ...(customLimit !== undefined ? { limit: customLimit } : {}),
      search: trimmedSearch || undefined,
      classId,
      className: !classId ? className : undefined,
      sectionId,
      sectionName: !sectionId ? sectionName : undefined,
      academicYearId,
      financialStatus: selectedFinancialStatus === 'All' ? undefined : selectedFinancialStatus,
    };
  }, [selectedYear, selectedClass, selectedSection, selectedFinancialStatus, search, classes, sections]);

  // ── Scoped Class & Section Dropdown Lists ─────────────────────────────────
  const filteredClassesForYear = useMemo(() => {
    if (selectedYear === 'All' || !selectedYear) return classes;
    return classes.filter(c => c.academicYearId === selectedYear);
  }, [classes, selectedYear]);

  const availableClassNames = useMemo(() => {
    const names = Array.from(new Set(filteredClassesForYear.map(c => c.name))).filter(Boolean);
    return names.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [filteredClassesForYear]);

  const availableSectionNames = useMemo(() => {
    const names = Array.from(new Set(sections.map(s => s.name))).filter(Boolean);
    return names.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [sections]);

  // ── Load Filter Options (Years, Classes, Sections) ────────────────────────
  const loadFilterOptions = async () => {
    try {
      const [ayRes, classRes, secRes] = await Promise.all([
        fastGet('/academics/academic-years', undefined, { ttlMs: 60000 }),
        fastGet('/academics/classes', undefined, { ttlMs: 60000 }),
        fastGet('/academics/sections', undefined, { ttlMs: 60000 }),
      ]);
      setAcademicYears(ayRes.data || []);
      setClasses(classRes.data || []);
      setSections(secRes.data || []);
    } catch (err) {
      console.error('Failed to load filter options:', err);
    }
  };

  // ── Load Students with Race-Condition & Abort Controller Guard ────────────
  const loadStudents = useCallback(async (pageNumber = 1) => {
    // 1. Immediately abort previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // 2. Increment monotonically tracking request ID (Requirement 4 & 15)
    requestIdRef.current += 1;
    const currentRequestId = requestIdRef.current;

    // 3. Mark loading immediately (Requirements 2, 3, 14, 15)
    setLoadingStudents(true);

    try {
      const queryParams = buildStudentQueryParams(pageNumber, limit);

      const res = await api.get('/students', {
        params: queryParams,
        signal: controller.signal,
      });

      // 4. Ignore superseded response if newer filter request was initiated
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      const rawData = res.data?.data || (Array.isArray(res.data) ? res.data : []);
      const serverTotal = res.data?.total !== undefined ? res.data.total : (Array.isArray(res.data) ? res.data.length : 0);
      const serverTotalPages = res.data?.totalPages !== undefined ? res.data.totalPages : (res.data?.total !== undefined ? Math.ceil(res.data.total / limit) : 1);
      const serverPage = res.data?.page !== undefined ? res.data.page : pageNumber;

      const mapped = rawData.map(mapStudentRecord);
      setStudents(mapped);
      setTotal(serverTotal);
      setTotalPages(serverTotalPages);
      setPage(serverPage);
    } catch (err: any) {
      if (axios.isCancel(err) || err?.name === 'CanceledError' || currentRequestId !== requestIdRef.current) {
        return; // Request was cancelled by a newer filter action; silently discard
      }
      console.error('Failed to load students:', err);
      showToast('Failed to load students directory records.', 'error');
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoadingStudents(false);
      }
    }
  }, [buildStudentQueryParams, limit, mapStudentRecord, showToast]);

  // Initial load
  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadStudents(1);
  }, [loadStudents]);

  useSchoolSetupUpdate(() => {
    loadFilterOptions();
    loadStudents(1);
  });

  // Debounced search (300ms) with immediate loading indication on input
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchVal);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchVal]);

  // Filter change handlers (immediate loading triggers)
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchVal(e.target.value);
  };

  const handleYearChange = (yearId: string) => {
    setLoadingStudents(true);
    setSelectedYear(yearId);
    setPage(1);
  };

  const handleClassChange = (className: string) => {
    setLoadingStudents(true);
    setSelectedClass(className);
    setPage(1);
  };

  const handleSectionChange = (sectionName: string) => {
    setLoadingStudents(true);
    setSelectedSection(sectionName);
    setPage(1);
  };

  const handleFinancialStatusChange = (status: string) => {
    setLoadingStudents(true);
    setSelectedFinancialStatus(status);
    setPage(1);
  };

  // Selection handlers
  const isAllSelected = students.length > 0 && students.every(s => selectedIds.includes(s.id));

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      const currentIds = students.map(s => s.id);
      setSelectedIds(prev => prev.filter(id => !currentIds.includes(id)));
    } else {
      const currentIds = students.map(s => s.id);
      setSelectedIds(prev => {
        const union = new Set([...prev, ...currentIds]);
        return Array.from(union);
      });
    }
  };

  // Profile navigation & prefetching
  const navigateToProfile = (st: Student) => {
    try {
      sessionStorage.setItem(`preseed_student_${st.id}`, JSON.stringify(st));
    } catch {}
    router.push(`/dashboard/students/${st.id}`);
  };

  const prefetchProfile = (st: Student) => {
    try {
      sessionStorage.setItem(`preseed_student_${st.id}`, JSON.stringify(st));
    } catch {}
    router.prefetch(`/dashboard/students/${st.id}`);
    fastGet(`/students/${st.id}`, undefined, { ttlMs: 60000 }).catch(() => {});
    fastGet(`/complaint-box/student-cases/${st.id}`, undefined, { ttlMs: 60000 }).catch(() => {});
  };

  // Delete handlers
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

      // Reset filters and checkboxes
      setSearch('');
      setSearchVal('');
      setSelectedClass('All');
      setSelectedSection('All');
      setSelectedYear('All');
      setSelectedFinancialStatus('All');

      loadStudents(1);
    } catch (err: any) {
      console.error('Error deleting student:', err);
      showToast(err.response?.data?.message || 'Failed to delete student.', 'error');
    }
  };

  // ── Floating bar padding: keep last row always visible ──────────────────
  const isBarVisible =
    (selectedIds.length > 0 ||
      selectedClass !== 'All' ||
      selectedSection !== 'All' ||
      selectedYear !== 'All' ||
      selectedFinancialStatus !== 'All' ||
      search !== '') &&
    students.length > 0;
  const { barRef, contentPaddingBottom } = useFloatingBarPadding({ visible: isBarVisible });

  // ── PDF Export Pipeline (Requirements 1, 5, 8, 9, 12, 13, 16, 17) ─────────
  const handleExportPDF = async () => {
    if (isExportingPDF || loadingStudents) return;

    try {
      setIsExportingPDF(true);

      // Build canonical query parameters for full dataset (Requirements 9 & 12)
      const exportParams = buildStudentQueryParams(1, 10000);

      // Requirement 17: Log debug filter parameters
      console.log('PDF FILTER PARAMETERS:', {
        academicYearId: exportParams.academicYearId || 'All',
        classId: exportParams.classId || 'All',
        className: exportParams.className || 'All',
        sectionId: exportParams.sectionId || 'All',
        sectionName: exportParams.sectionName || 'All',
        financialStatus: exportParams.financialStatus || 'All',
        searchTerm: exportParams.search || 'None',
      });

      const res = await api.get('/students', {
        params: exportParams,
      });

      const rawList = res.data?.data || (Array.isArray(res.data) ? res.data : []);
      const exportList: Student[] = rawList.map(mapStudentRecord);

      // Requirement 17: Log total matching students
      console.log('PDF RESULT:', {
        totalMatchingStudents: exportList.length,
      });

      // Requirement 17: Pre-generation validation
      if (exportList.length === 0 && total > 0) {
        console.error('PDF Export Safety Check Failed: Export query returned 0 students while directory has records.');
        showToast('Could not export PDF: Filtered student dataset mismatch. Please retry.', 'error');
        return;
      }

      if (exportList.length === 0) {
        showToast('No matching student records found to export.', 'info');
        return;
      }

      // Generate landscape vector PDF
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = 297;
      const pageHeight = 210;
      const margin = 12;
      const printableWidth = pageWidth - (margin * 2);

      const yearName = selectedYear !== 'All' 
        ? (academicYears.find(ay => ay.id === selectedYear)?.name || 'Selected Year') 
        : 'All Academic Years';
      const gradeName = selectedClass !== 'All' ? selectedClass : 'All Grades';
      const secName = selectedSection !== 'All' ? selectedSection : 'All Sections';
      const finStatusLabel = ({
        'All': 'All Financial Status',
        'FULLY_PAID': 'Fully Paid (100%)',
        'ABOVE_75': 'Above 75% Paid',
        'PAID_50_75': '50%–75% Paid',
        'BELOW_50': 'Below 50% Paid',
        'PENDING_BALANCE': 'Pending Balance'
      } as Record<string, string>)[selectedFinancialStatus] || 'All Financial Status';
      const searchLabel = search.trim() ? `"${search.trim()}"` : 'All / None';
      const dateStr = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

      // Header Banner
      doc.setFillColor(30, 41, 59); // slate-800
      doc.rect(margin, margin, printableWidth, 16, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('STUDENT FINANCIAL STATUS REPORT', margin + 6, margin + 10.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(203, 213, 225); // slate-300
      doc.text(`Generated: ${dateStr} | Total Students: ${exportList.length}`, printableWidth + margin - 6, margin + 10.5, { align: 'right' });

      // Filter summary card
      let y = margin + 20;
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.roundedRect(margin, y, printableWidth, 14, 2, 2, 'FD');

      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.setFont('helvetica', 'bold');
      doc.text('ACTIVE FILTERS:', margin + 4, y + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Academic Year: ${yearName}   |   Grade: ${gradeName}   |   Section: ${secName}`, margin + 35, y + 5.5);
      doc.text(`Financial Status: ${finStatusLabel}   |   Search Query: ${searchLabel}`, margin + 35, y + 10.5);

      y += 18;

      // Table Columns Configuration
      const cols = [
        { header: '#', width: 10, align: 'center' },
        { header: 'Roll No', width: 18, align: 'left' },
        { header: 'Student Name', width: 45, align: 'left' },
        { header: 'Class - Sec', width: 28, align: 'left' },
        { header: 'Parent / Guardian', width: 40, align: 'left' },
        { header: 'Phone', width: 26, align: 'left' },
        { header: 'Total Fee', width: 26, align: 'right' },
        { header: 'Paid', width: 26, align: 'right' },
        { header: 'Balance Due', width: 26, align: 'right' },
        { header: 'Financial Status', width: 28, align: 'center' },
      ];

      const drawTableHeader = (curY: number) => {
        doc.setFillColor(241, 245, 249); // slate-100
        doc.setDrawColor(203, 213, 225); // slate-300
        doc.rect(margin, curY, printableWidth, 7, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);

        let curX = margin;
        for (const c of cols) {
          const posX = c.align === 'right' ? curX + c.width - 2 : c.align === 'center' ? curX + (c.width / 2) : curX + 2;
          doc.text(c.header, posX, curY + 4.8, { align: c.align as any });
          curX += c.width;
        }
        return curY + 7;
      };

      y = drawTableHeader(y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);

      for (let i = 0; i < exportList.length; i++) {
        const item = exportList[i];
        const rowHeight = 6.5;

        if (y + rowHeight > pageHeight - margin - 8) {
          // Add page footer
          doc.setFontSize(7);
          doc.setTextColor(148, 163, 184);
          doc.text(`Page ${doc.getNumberOfPages()} | EduTrack Institute Platform`, pageWidth / 2, pageHeight - 6, { align: 'center' });

          doc.addPage();
          y = margin;
          y = drawTableHeader(y);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
        }

        // Row background
        if (i % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, printableWidth, rowHeight, 'F');
        }

        doc.setDrawColor(241, 245, 249);
        doc.line(margin, y + rowHeight, margin + printableWidth, y + rowHeight);

        let curX = margin;
        const hasDue = item.balanceDue > 0;

        // Col 1: #
        doc.setTextColor(100, 116, 139);
        doc.text(String(i + 1), curX + (cols[0].width / 2), y + 4.5, { align: 'center' });
        curX += cols[0].width;

        // Col 2: Roll No
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(37, 99, 235); // blue-600
        doc.text(item.rollNo, curX + 2, y + 4.5);
        curX += cols[1].width;

        // Col 3: Student Name
        doc.setTextColor(15, 23, 42); // slate-900
        const truncatedName = item.name.length > 25 ? item.name.substring(0, 23) + '...' : item.name;
        doc.text(truncatedName, curX + 2, y + 4.5);
        curX += cols[2].width;

        // Col 4: Class - Sec
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        const classSec = `${item.class} - ${item.section}`;
        doc.text(classSec, curX + 2, y + 4.5);
        curX += cols[3].width;

        // Col 5: Parent
        const truncatedParent = item.fatherName.length > 22 ? item.fatherName.substring(0, 20) + '...' : item.fatherName;
        doc.text(truncatedParent, curX + 2, y + 4.5);
        curX += cols[4].width;

        // Col 6: Phone
        doc.text(item.phone, curX + 2, y + 4.5);
        curX += cols[5].width;

        // Col 7: Total Fee
        doc.text(`Rs. ${item.totalFees.toLocaleString('en-IN')}`, curX + cols[6].width - 2, y + 4.5, { align: 'right' });
        curX += cols[6].width;

        // Col 8: Paid
        doc.setTextColor(5, 150, 105); // emerald-600
        doc.text(`Rs. ${item.paidAmount.toLocaleString('en-IN')}`, curX + cols[7].width - 2, y + 4.5, { align: 'right' });
        curX += cols[7].width;

        // Col 9: Balance Due
        doc.setTextColor(hasDue ? 217 : 71, hasDue ? 119 : 85, hasDue ? 6 : 105); // amber-600 or slate-600
        doc.setFont('helvetica', hasDue ? 'bold' : 'normal');
        doc.text(`Rs. ${item.balanceDue.toLocaleString('en-IN')}`, curX + cols[8].width - 2, y + 4.5, { align: 'right' });
        curX += cols[8].width;

        // Col 10: Financial Status
        doc.setFont('helvetica', 'bold');
        if (hasDue) {
          doc.setTextColor(180, 83, 9); // amber-700
          doc.text(`Pending Due`, curX + (cols[9].width / 2), y + 4.5, { align: 'center' });
        } else {
          doc.setTextColor(4, 120, 87); // emerald-700
          doc.text(`Fully Paid`, curX + (cols[9].width / 2), y + 4.5, { align: 'center' });
        }
        curX += cols[9].width;

        y += rowHeight;
      }

      // Page footer for final page
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${doc.getNumberOfPages()} | EduTrack Institute Platform`, pageWidth / 2, pageHeight - 6, { align: 'center' });

      const safeFilename = `Student_Directory_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(safeFilename);
      showToast(`Exported PDF successfully (${exportList.length} students).`, 'success');
    } catch (err: any) {
      console.error('Failed to export students PDF:', err);
      showToast('Failed to generate PDF report.', 'error');
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="space-y-6 animate-in pb-12">
      {/* ================= HEADER VIEW ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-[28px] font-bold text-slate-900 leading-none">
            Student Directory
          </h2>
          <p className="text-slate-500 text-[13px] font-medium mt-2">
            Browse through student files, view account ledgers, and check parent assignments.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Requirement 5 & 13: PDF Button Loading with Round Spinner */}
          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF || loadingStudents}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-750 hover:text-[#2E5BFF] hover:border-blue-200 text-[12px] font-bold shadow-xs transition-all cursor-pointer min-h-[36px] disabled:opacity-50 disabled:cursor-not-allowed"
            title="Download Filtered Students PDF Report"
          >
            {isExportingPDF ? (
              <>
                <LoadingSpinner size="xs" variant="brand" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 text-[#2E5BFF]" />
                <span>Download PDF</span>
              </>
            )}
          </button>
          <div className="text-slate-500 text-[12px] font-bold bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs">
            Total Records Staged: <span className="text-[#2E5BFF] font-extrabold">{total}</span>
          </div>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Name, roll number, or phone..."
            value={searchVal}
            onChange={handleSearchInputChange}
            className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-200 rounded-xl text-[13px] font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#2E5BFF] shadow-xs"
          />
        </div>

        <select
          value={selectedYear}
          onChange={(e) => handleYearChange(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-[13px] font-semibold text-slate-700 focus:outline-none focus:border-[#2E5BFF] shadow-xs"
        >
          <option value="All">All Academic Years</option>
          {academicYears.map(ay => (
            <option key={ay.id} value={ay.id}>{ay.name}</option>
          ))}
        </select>

        <select
          value={selectedClass}
          onChange={(e) => handleClassChange(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-[13px] font-semibold text-slate-700 focus:outline-none focus:border-[#2E5BFF] shadow-xs"
        >
          <option value="All">All Grades</option>
          {availableClassNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        <select
          value={selectedSection}
          onChange={(e) => handleSectionChange(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-[13px] font-semibold text-slate-700 focus:outline-none focus:border-[#2E5BFF] shadow-xs"
        >
          <option value="All">All Sections</option>
          {availableSectionNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        <select
          value={selectedFinancialStatus}
          onChange={(e) => handleFinancialStatusChange(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-[13px] font-semibold text-slate-700 focus:outline-none focus:border-[#2E5BFF] shadow-xs"
        >
          <option value="All">All Financial Status</option>
          <option value="FULLY_PAID">Fully Paid (100%)</option>
          <option value="ABOVE_75">Above 75% Paid</option>
          <option value="PAID_50_75">50%–75% Paid</option>
          <option value="BELOW_50">Below 50% Paid</option>
          <option value="PENDING_BALANCE">Pending Balance</option>
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
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                <th className="px-3.5 py-3.5 w-8">
                  <input 
                    type="checkbox" 
                    checked={isAllSelected} 
                    onChange={handleToggleSelectAll} 
                    disabled={loadingStudents || students.length === 0}
                    className="rounded border-slate-300 text-[#2E5BFF] focus:ring-blue-500 cursor-pointer w-4 h-4 disabled:opacity-40"
                  />
                </th>
                <th className="px-3 py-3.5 leading-tight">
                  ROLL<br/>NO
                </th>
                <th className="px-3.5 py-3.5">NAME</th>
                <th className="px-3.5 py-3.5">CLASS / SECTION</th>
                <th className="px-3.5 py-3.5 leading-tight">
                  PARENT<br/>GUARDIAN
                </th>
                <th className="px-3.5 py-3.5">FINANCIAL STATUS</th>
                <th className="px-3.5 py-3.5 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[13px] text-slate-600 font-medium">
              {/* Requirements 2 & 14: Strict 3-state rendering */}
              {loadingStudents ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <LoadingSpinner size="lg" variant="brand" />
                      <p className="text-xs font-semibold text-slate-500">Loading student directory records...</p>
                    </div>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center">
                    <EmptyState
                      title="No matching student records found"
                      description="Try adjusting your search query, grade, or section filter."
                    />
                  </td>
                </tr>
              ) : (
                students.map((student) => {
                  const hasDue = student.balanceDue > 0;
                  return (
                    <tr
                      key={student.id}
                      onMouseEnter={() => prefetchProfile(student)}
                      onTouchStart={() => prefetchProfile(student)}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-3.5 py-3">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.includes(student.id)} 
                          onChange={() => handleToggleSelect(student.id)} 
                          className="rounded border-slate-300 text-[#2E5BFF] focus:ring-blue-500 cursor-pointer w-4 h-4"
                        />
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-blue-600 font-bold">{student.rollNo}</td>
                      <td className="px-3.5 py-3">
                        <div className="flex items-center gap-2.5">
                          <StudentAvatar studentName={student.name} profilePhotoUrl={student.profilePhotoUrl} size="sm" />
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 text-[13px] truncate">{student.name}</div>
                            <div className="text-[11px] text-slate-400 font-medium truncate mt-0.5">{student.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3.5 py-3">
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
                      <td className="px-3.5 py-3">
                        <div className="text-slate-800 font-semibold text-[13px]">{student.fatherName}</div>
                        <div className="text-[11px] text-slate-400 font-medium mt-0.5">{student.phone}</div>
                      </td>
                      <td className="px-3.5 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap ${
                          hasDue 
                            ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasDue ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                          {hasDue ? (
                            <span>Pending <strong className="font-extrabold text-amber-800">₹{Number(student.balanceDue).toLocaleString('en-IN')}</strong> Due</span>
                          ) : (
                            <span>Fully Paid <strong className="font-extrabold text-emerald-800">₹0</strong> Balance</span>
                          )}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-right">
                        <div className="flex justify-end items-center gap-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onMouseEnter={() => prefetchProfile(student)}
                            onClick={() => navigateToProfile(student)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/40 transition-all text-xs font-bold whitespace-nowrap shadow-2xs cursor-pointer"
                          >
                            View Profile
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingStudent(student)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:text-green-600 hover:border-green-200 hover:bg-green-50/40 transition-all text-xs font-bold whitespace-nowrap shadow-2xs cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm({
                              show: true,
                              studentIds: [student.id],
                              count: 1,
                              singleName: student.name,
                              yearName: selectedYear !== 'All' ? academicYears.find(ay => ay.id === selectedYear)?.name : undefined,
                              className: student.class !== 'N/A' ? student.class : undefined,
                              sectionName: student.section !== 'N/A' ? student.section : undefined
                            })}
                            className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 hover:border-rose-300 text-rose-600 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
                            title="Delete Student"
                            aria-label="Delete Student"
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
          {loadingStudents ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <LoadingSpinner size="lg" variant="brand" />
              <p className="text-xs font-semibold text-slate-500">Loading student directory records...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="p-8 text-center">
              <EmptyState
                title="No matching student records found"
                description="Try adjusting your search query, grade, or section filter."
              />
            </div>
          ) : (
            students.map((student) => {
              const hasDue = student.balanceDue > 0;
              return (
                <div key={student.id} className="p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <StudentAvatar studentName={student.name} profilePhotoUrl={student.profilePhotoUrl} size="sm" />
                      <div className="min-w-0 flex-1">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-bold font-mono">
                          Roll: {student.rollNo}
                        </span>
                        <h4 className="text-sm font-bold text-slate-800 mt-1 truncate">{student.name}</h4>
                        <p className="text-xs text-slate-400 font-medium mt-0.5 truncate">{student.email}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                      hasDue 
                        ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasDue ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      {hasDue ? (
                        <span>Pending ₹{Number(student.balanceDue).toLocaleString('en-IN')} Due</span>
                      ) : (
                        <span>Fully Paid ₹0 Balance</span>
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-250/10">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Class & Section</span>
                      <span className="font-bold text-slate-700 block mt-0.5">
                        {student.class} - {student.section.replace(/^section\s*[-_]?/i, '')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Parent / Guardian</span>
                      <span className="font-bold text-slate-700 block mt-0.5">{student.fatherName}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <a href={`tel:${student.phone}`} className="flex items-center gap-1 text-slate-500 text-xs font-semibold hover:text-blue-600 min-h-[38px]">
                      <Phone className="w-3.5 h-3.5" />
                      {student.phone}
                    </a>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingStudent(student)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:text-green-600 hover:border-green-200 hover:bg-green-50/30 transition-all text-xs font-bold min-h-[36px]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onMouseEnter={() => prefetchProfile(student)}
                        onClick={() => navigateToProfile(student)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/30 transition-all text-xs font-bold min-h-[36px] cursor-pointer"
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
        {!loadingStudents && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 px-6 py-4 bg-slate-50/50">
            <div className="text-[12px] text-slate-550 font-medium text-center sm:text-left">
              Showing <span className="font-bold text-slate-800">{((page - 1) * limit) + 1}</span> to{' '}
              <span className="font-bold text-slate-800">{Math.min(page * limit, total)}</span> of{' '}
              <span className="font-bold text-slate-800">{total}</span> records (Page <span className="font-bold text-slate-800">{page}</span> of <span className="font-bold text-slate-800">{totalPages}</span>)
            </div>

            <div className="flex items-center gap-1.5 flex-wrap justify-center">
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

              {Array.from({ length: totalPages }).map((_, idx) => {
                const pNum = idx + 1;
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
      {(selectedIds.length > 0 || selectedClass !== 'All' || selectedSection !== 'All' || selectedYear !== 'All' || search !== '') && students.length > 0 && (
        <div 
          ref={barRef} 
          className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-md text-white px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-xl shadow-2xl flex flex-row items-center justify-between gap-2.5 sm:gap-4 z-40 border border-slate-800/80 animate-slide-up w-[92%] sm:w-auto max-w-lg"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
            <span className="text-[11px] sm:text-xs font-semibold text-slate-300 truncate">
              {selectedIds.length > 0 ? (
                <span>
                  <strong className="text-white font-bold">{selectedIds.length}</strong> selected
                </span>
              ) : (
                <span>
                  <strong className="text-white font-bold">{total || students.length}</strong> match filters
                </span>
              )}
            </span>
          </div>
          <div className="h-4 w-px bg-slate-800 hidden sm:block shrink-0" />
          <div className="flex items-center gap-2 shrink-0">
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
                className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] sm:text-xs shadow-xs transition-all cursor-pointer min-h-[32px] flex items-center gap-1 whitespace-nowrap"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete Selected ({selectedIds.length})</span>
              </button>
            )}
            <button
              onClick={() => {
                const studentIds = students.map(s => s.id);
                setDeleteConfirm({
                  show: true,
                  studentIds,
                  count: total || studentIds.length,
                  yearName: selectedYear !== 'All' ? academicYears.find(ay => ay.id === selectedYear)?.name : undefined,
                  className: selectedClass !== 'All' ? selectedClass : undefined,
                  sectionName: selectedSection !== 'All' ? selectedSection : undefined
                });
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:text-white font-medium text-[11px] sm:text-xs transition-all cursor-pointer min-h-[32px] flex items-center gap-1 whitespace-nowrap"
            >
              <Trash2 className="w-3 h-3 text-slate-400" />
              <span>Delete All Filtered ({total || students.length})</span>
            </button>
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
            setEditingStudent(null);
            await loadStudents(page);
          }}
        />
      )}
    </div>
  );
}
