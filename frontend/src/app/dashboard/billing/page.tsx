'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api, fastGet } from '@/lib/api';
import { dispatchSchoolSetupUpdated } from '@/lib/events';
import { useTenant } from '@/app/providers/TenantContext';
import { formatDateDDMMYYYY } from '@/lib/date';
import { 
  Receipt, Search, CreditCard, Sparkles, X, CheckCircle2, 
  QrCode, User, ArrowRight, CornerDownRight, RotateCcw,
  BookOpen, Calendar, Printer, ShieldCheck, AlertCircle, MessageCircle
} from 'lucide-react';
import {
  PencilSpinner,
  TableSkeleton,
  EmptyState,
  ErrorState,
  LoadingButton,
} from '@/components/loading';

interface StagedInvoice {
  id: string;
  name: string;
  rollNo: string;
  dateStr: string;
  totalAmount: number;
  paymentMethod: string;
  status: string;
}

interface InvoicePDFData {
  schoolName: string;
  schoolAddress: string;
  schoolPhone: string;
  schoolLogo: string;
  schoolSubtitle: string;
  invoiceNo: string;
  receiptNumber?: string;
  transactionId?: string;
  paymentMethod?: string;
  invoiceDate: string;
  academicYear: string;
  admissionRef: string;
  studentName: string;
  rollNo?: string;
  fatherName: string;
  motherName: string;
  className: string;
  sectionName: string;
  studentDob: string;
  addressVillage: string;
  totalAmount: number;
  paidAmount?: number;
  parentPhone?: string;
  remainingBalance?: number;
  items: { particulars: string; amount: number }[];
}

interface PaymentSuccessRecord {
  invoiceId: string;
  receiptNumber: string;
  transactionId: string;
  studentId: string;
  studentName: string;
  rollNo?: string;
  className?: string;
  sectionName?: string;
  fatherName?: string;
  motherName?: string;
  parentPhone?: string;
  fatherPhone?: string;
  motherPhone?: string;
  guardianPhone?: string;
  amountPaid: number;
  totalInvoiceAmount?: number;
  remainingBalance: number;
  paymentMethod: string;
  paymentMethodLabel: string;
  paymentDate: string;
  schoolName?: string;
  schoolLogo?: string;
  items: Array<{ particulars: string; amount: number }>;
}

/**
 * Normalizes phone numbers strictly according to E.164 without '+' for WhatsApp deep-links.
 * For Indian numbers: converts 10 digits, +91, 0-prefixed, formatted (+91 98765-43210) into 91XXXXXXXXXX.
 */
function normalizeWhatsAppNumber(rawNumber?: string | null): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  if (!rawNumber || !rawNumber.trim()) {
    return {
      valid: false,
      normalized: '',
      error: 'Parent WhatsApp number is not available for this student.',
    };
  }

  // Strip all non-digit characters
  const digits = rawNumber.replace(/\D/g, '');

  if (!digits || digits.length === 0) {
    return {
      valid: false,
      normalized: '',
      error: 'Parent WhatsApp number is not available for this student.',
    };
  }

  // 10 digits (e.g. 9876543210) -> 919876543210
  if (digits.length === 10) {
    return { valid: true, normalized: `91${digits}` };
  }

  // 11 digits with leading 0 (e.g. 09876543210) -> 919876543210
  if (digits.length === 11 && digits.startsWith('0')) {
    return { valid: true, normalized: `91${digits.slice(1)}` };
  }

  // 12 digits with 91 country code (e.g. 919876543210) -> 919876543210
  if (digits.length === 12 && digits.startsWith('91')) {
    return { valid: true, normalized: digits };
  }

  // 13 digits with 910 (e.g. 9109876543210 -> strip 0 after 91)
  if (digits.length === 13 && digits.startsWith('910')) {
    return { valid: true, normalized: `91${digits.slice(3)}` };
  }

  // Other standard international numbers (10-15 digits)
  if (digits.length >= 10 && digits.length <= 15) {
    return { valid: true, normalized: digits };
  }

  return {
    valid: false,
    normalized: '',
    error: "Invalid parent WhatsApp number. Please update the parent's contact number.",
  };
}

/**
 * Formats the prefilled WhatsApp receipt message according to Section 2 specifications.
 */
function formatWhatsAppReceiptMessage(params: {
  studentName: string;
  receiptNumber: string;
  transactionId: string;
  amountPaid: number;
  remainingBalance: number;
  paymentMethod: string;
  paymentDate: string;
  schoolName?: string;
  receiptUrl?: string;
}): string {
  const formattedPaid = params.amountPaid.toLocaleString('en-IN');
  const formattedBalance = params.remainingBalance.toLocaleString('en-IN');
  const school = params.schoolName || 'CS EduTrack';

  return `Dear Parent,\n\n`
    + `Fee payment receipt for *${params.studentName}*\n\n`
    + `*Receipt Number:* ${params.receiptNumber}\n`
    + `*Transaction ID:* ${params.transactionId}\n\n`
    + `*Amount Paid:* ₹${formattedPaid}\n`
    + `*Remaining Balance:* ₹${formattedBalance}\n\n`
    + `*Payment Method:* ${params.paymentMethod}\n`
    + `*Payment Date:* ${params.paymentDate}\n\n`
    + (params.receiptUrl ? `*Receipt Link:* ${params.receiptUrl}\n\n` : '')
    + `Please find the payment receipt for your reference.\n\n`
    + `Thank you,\n`
    + `${school}`;
}

export default function FeesBillingPage() {
  const { setupStats, currentUser, schoolName } = useTenant();
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [selectedYear, setSelectedYear] = useState('');
  const [academicYears, setAcademicYears] = useState<{ label: string; value: string }[]>([]);

  // Fee particulars checklist states
  const [feeItems, setFeeItems] = useState<any[]>([]);

  // Payment Channels
  const paymentChannels = [
    { value: 'GPAY_UPI', label: 'GPay UPI', icon: '⚡' },
    { value: 'PHONEPE_UPI', label: 'PhonePe UPI', icon: '📱' },
    { value: 'CASH', label: 'Physical Cash', icon: '💵' },
    { value: 'NET_BANKING', label: 'Net Banking', icon: '🏦' }
  ];
  const [selectedChannel, setSelectedChannel] = useState('GPAY_UPI');

  // Net Banking Form
  const [bankName, setBankName] = useState('HDFC Bank');
  const [ifscCode, setIfscCode] = useState('HDFC0000120');
  const [accountNo, setAccountNo] = useState('50100239485729');

  // History logs
  const [transactions, setTransactions] = useState<StagedInvoice[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [matchingStudents, setMatchingStudents] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isStudentLoading, setIsStudentLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successInvoiceId, setSuccessInvoiceId] = useState<string | null>(null);
  const [lastPaymentSuccess, setLastPaymentSuccess] = useState<PaymentSuccessRecord | null>(null);
  const [lastPaidStudentName, setLastPaidStudentName] = useState('');
  const [lastPaidAmount, setLastPaidAmount] = useState(0);

  // Payment Confirmation states
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isSharingWhatsApp, setIsSharingWhatsApp] = useState(false);
  const [successRemainingBalance, setSuccessRemainingBalance] = useState(0);
  const [successPaymentDate, setSuccessPaymentDate] = useState('');

  // Load initial options & recent invoices
  useEffect(() => {
    const fetchInit = async () => {
      setTransactionsLoading(true);
      try {
        const [yRes, txRes] = await Promise.all([
          fastGet('/billing/options/years', undefined, { ttlMs: 60000 }),
          fastGet('/billing/invoices/recent', undefined, {
            ttlMs: 15000,
            onRevalidate: (fresh) => {
              if (fresh && Array.isArray(fresh)) {
                setTransactions(fresh);
              }
            }
          })
        ]);
        if (yRes?.data) {
          setAcademicYears(yRes.data);
          if (yRes.data.length > 0) {
            setSelectedYear(yRes.data[0].value);
          }
        }
        if (txRes?.data) {
          setTransactions(txRes.data);
        }
      } catch (err) {
        console.error('Failed to fetch initial billing data', err);
      } finally {
        setTransactionsLoading(false);
      }
    };
    fetchInit();
  }, []);

  // Search students
  useEffect(() => {
    if (search.trim().length >= 2) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
      setMatchingStudents([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fastGet(`/billing/students/search`, {
          params: { searchTerm: search.trim() }
        }, { ttlMs: 30000 });
        setMatchingStudents(res.data || []);
      } catch (err) {
        console.error('Error searching students', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [search]);

  const prefetchStudentBilling = (s: any) => {
    if (!s?.account?.id) return;
    fastGet(`/billing/students/${s.account.id}`, undefined, { ttlMs: 60000 }).catch(() => {});
    const oppId = s.account.opportunities?.[0]?.id;
    if (oppId) {
      fastGet(`/billing/unpaid-fees/${oppId}`, undefined, { ttlMs: 60000 }).catch(() => {});
    }
  };

  const prefetchInvoicePDF = (invoiceId: string) => {
    if (!invoiceId) return;
    fastGet(`/billing/invoices/${invoiceId}/pdf`, undefined, { ttlMs: 60000 }).catch(() => {});
  };

  const loadUnpaidFees = async (oppId: string) => {
    try {
      setIsLoading(true);
      const res = await fastGet(`/billing/unpaid-fees/${oppId}`, undefined, { ttlMs: 60000 });
      setFeeItems((res.data || []).map((item: any) => ({
        id: item.oliId,
        name: item.productName,
        total: item.totalAmount,
        discount: item.discountAmount,
        paid: item.paidAmount,
        balance: item.balanceDue,
        input: item.balanceDue,
        isSelected: item.balanceDue > 0,
        productId: item.productId,
        discountPercent: item.discountPercent
      })));
    } catch (err) {
      console.error('Failed to load unpaid fees', err);
    } finally {
      setIsLoading(false);
    }
  };

  const [loadedBillingKey, setLoadedBillingKey] = useState('');

  const handleSelectStudent = async (student: any) => {
    try {
      setIsStudentLoading(true);
      setIsLoading(true);
      const studentId = student.account.id;
      const initialOppId = student.account.opportunities?.[0]?.id;

      // Parallelize student billing details and unpaid fees lookup
      const [studentRes, unpaidRes] = await Promise.all([
        fastGet(`/billing/students/${studentId}`, undefined, { ttlMs: 60000 }),
        initialOppId
          ? fastGet(`/billing/unpaid-fees/${initialOppId}`, undefined, { ttlMs: 60000 }).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
      ]);

      const studentData = studentRes.data;
      const openOpp = studentData.account.opportunities?.[0];
      const key = `${studentId}-${openOpp?.academicYearId || ''}`;
      setLoadedBillingKey(key);

      setSelectedStudent(studentData);
      setSearch('');
      setMatchingStudents([]);

      if (openOpp) {
        setSelectedYear(openOpp.academicYearId);
        const unpaidData = (unpaidRes.data && unpaidRes.data.length > 0)
          ? unpaidRes.data
          : (openOpp.id !== initialOppId
              ? (await fastGet(`/billing/unpaid-fees/${openOpp.id}`, undefined, { ttlMs: 60000 }).catch(() => ({ data: [] }))).data || []
              : []);
        setFeeItems(unpaidData.map((item: any) => ({
          id: item.oliId,
          name: item.productName,
          total: item.totalAmount,
          discount: item.discountAmount,
          paid: item.paidAmount,
          balance: item.balanceDue,
          input: item.balanceDue,
          isSelected: item.balanceDue > 0,
          productId: item.productId,
          discountPercent: item.discountPercent
        })));
      } else {
        setSelectedYear('');
        setFeeItems([]);
      }
    } catch (err) {
      console.error('Failed to load student details', err);
    } finally {
      setIsLoading(false);
      setIsStudentLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStudent && selectedYear) {
      const key = `${selectedStudent.account.id}-${selectedYear}`;
      if (loadedBillingKey === key) return;

      const reloadBillingData = async () => {
        try {
          setIsLoading(true);
          const res = await api.get(`/billing/students/${selectedStudent.account.id}`, {
            params: { academicYearId: selectedYear }
          });
          setSelectedStudent(res.data);
          setLoadedBillingKey(key);
          
          const openOpp = res.data.account.opportunities?.[0];
          if (openOpp) {
            await loadUnpaidFees(openOpp.id);
          } else {
            setFeeItems([]);
          }
        } catch (err) {
          console.error('Failed to reload billing data', err);
        } finally {
          setIsLoading(false);
        }
      };
      reloadBillingData();
    }
  }, [selectedYear, selectedStudent]);

  const handleCheckboxChange = (id: string) => {
    setFeeItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, isSelected: !item.isSelected };
      }
      return item;
    }));
  };

  const handleSelectAllToggle = () => {
    const allUnpaidSelected = feeItems.filter(f => f.balance > 0).every(f => f.isSelected);
    setFeeItems(prev => prev.map(item => {
      if (item.balance <= 0) return item;
      return { ...item, isSelected: !allUnpaidSelected };
    }));
  };

  const unpaidItems = feeItems.filter(f => f.balance > 0);
  const isAllSelected = unpaidItems.length > 0 && unpaidItems.every(f => f.isSelected);

  const handleInputChange = (id: string, val: number) => {
    setFeeItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, input: Math.min(val, item.balance) };
      }
      return item;
    }));
  };

  // Calculation total
  const billingTotal = feeItems.reduce((sum, item) => {
    return sum + (item.isSelected ? item.input : 0);
  }, 0);

  const handleOpenConfirmModal = () => {
    if (!selectedStudent) return;

    // 1. Ensure at least one fee product is selected
    const selectedItemsCount = feeItems.filter(item => item.isSelected).length;
    if (selectedItemsCount === 0) {
      alert('Error: Please select at least one fee product before processing payment.');
      return;
    }

    // 2. Ensure the payment amount is greater than zero
    if (billingTotal <= 0) {
      alert('Error: Payment amount must be greater than zero.');
      return;
    }

    // 3. Ensure payment amount does not exceed the outstanding balance
    if (billingTotal > (selectedStudent.totalPendingBalance || 0)) {
      alert(`Error: Payment amount (₹${billingTotal.toLocaleString()}) cannot exceed the outstanding balance (₹${selectedStudent.totalPendingBalance.toLocaleString()}).`);
      return;
    }

    // 4. Validate payment method selection
    const isValidMethod = paymentChannels.some(c => c.value === selectedChannel);
    if (!isValidMethod) {
      alert('Error: Please select a valid payment method.');
      return;
    }

    setConfirmModalOpen(true);
  };

  const handleFinalizePayment = async () => {
    if (!selectedStudent || billingTotal <= 0 || isSubmittingPayment) return;

    const openOpp = selectedStudent.account.opportunities?.[0];
    if (!openOpp) {
      setErrorMessage('Student opportunity record not found.');
      setErrorModalOpen(true);
      return;
    }

    const itemsToPay = feeItems
      .filter(item => item.isSelected && item.input > 0)
      .map(item => ({
        oliId: item.id,
        productId: item.productId,
        amount: item.input
      }));

    try {
      setIsSubmittingPayment(true);
      setIsLoading(true);
      const res = await api.post('/billing/invoices', {
        opportunityId: openOpp.id,
        studentId: selectedStudent.account.id,
        items: itemsToPay,
        paymentMethod: selectedChannel,
        bankDetails: selectedChannel === 'NET_BANKING' ? {
          bankName,
          bankIfsc: ifscCode,
          bankAccountNumber: accountNo,
          bankBranch: 'Main Branch'
        } : null
      });

      const createdInvoiceId = res.data;
      const nextBalance = Math.max(0, (selectedStudent.totalPendingBalance || 0) - billingTotal);
      const paymentDateFormatted = new Date().toLocaleString('en-IN');
      const channelObj = paymentChannels.find(c => c.value === selectedChannel);
      const methodLabel = channelObj?.label || selectedChannel;
      
      const parentPhoneResolved = selectedStudent.account.parentPhone 
        || selectedStudent.fatherPhone 
        || selectedStudent.motherPhone 
        || selectedStudent.guardianPhone 
        || selectedStudent.account.phone 
        || selectedStudent.phone 
        || '';

      const paymentRecord: PaymentSuccessRecord = {
        invoiceId: createdInvoiceId,
        receiptNumber: createdInvoiceId,
        transactionId: createdInvoiceId,
        studentId: selectedStudent.account.id,
        studentName: selectedStudent.account.name,
        rollNo: selectedStudent.account.rollNo || '',
        className: selectedStudent.account.class || '',
        sectionName: selectedStudent.account.section || '',
        fatherName: selectedStudent.account.fatherName || '',
        motherName: selectedStudent.account.motherName || '',
        parentPhone: parentPhoneResolved,
        fatherPhone: selectedStudent.fatherPhone || '',
        motherPhone: selectedStudent.motherPhone || '',
        guardianPhone: selectedStudent.guardianPhone || '',
        amountPaid: billingTotal,
        totalInvoiceAmount: billingTotal,
        remainingBalance: nextBalance,
        paymentMethod: selectedChannel,
        paymentMethodLabel: methodLabel,
        paymentDate: paymentDateFormatted,
        schoolName: schoolName || 'CS EduTrack',
        items: itemsToPay.map(item => {
          const matchedFee = feeItems.find(f => f.id === item.oliId);
          return {
            particulars: matchedFee?.name || 'Fee Component',
            amount: item.amount,
          };
        }),
      };

      setLastPaymentSuccess(paymentRecord);
      setLastPaidStudentName(selectedStudent.account.name);
      setLastPaidAmount(billingTotal);
      setSuccessInvoiceId(createdInvoiceId);
      setSuccessRemainingBalance(nextBalance);
      setSuccessPaymentDate(paymentDateFormatted);
      
      setConfirmModalOpen(false);
      setSuccessModalOpen(true);

      setToastMessage(`Success: Payment of ₹${billingTotal.toLocaleString()} logged for ${selectedStudent.account.name}.`);
      
      // Dispatch event to refresh dashboard in real-time
      dispatchSchoolSetupUpdated();

      // Clear select & reload history
      setSelectedStudent(null);
      setFeeItems([]);
      setNotes('');
      
      const txRes = await api.get('/billing/invoices/recent');
      setTransactions(txRes.data);

      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      console.error('Payment failed', err);
      const reason = err.response?.data?.message || err.message || 'Unknown network error occurred.';
      setErrorMessage(reason);
      setConfirmModalOpen(false);
      setErrorModalOpen(true);
    } finally {
      setIsSubmittingPayment(false);
      setIsLoading(false);
    }
  };

  const generateInvoicePDFInstance = async (invoiceId: string, overrideData?: Partial<PaymentSuccessRecord> | null) => {
    let data: InvoicePDFData;
    try {
      const res = await api.get(`/billing/invoices/${invoiceId}/pdf`);
      data = res.data;
    } catch (fetchErr) {
      console.warn('Could not fetch invoice PDF data from server, using local payment record:', fetchErr);
      data = {
        schoolName: overrideData?.schoolName || schoolName || 'CS EduTrack',
        schoolAddress: 'School Campus Address',
        schoolPhone: '+91 999 999 9999',
        schoolLogo: '',
        schoolSubtitle: 'Inspiring Excellence, Nurturing Values',
        invoiceNo: overrideData?.receiptNumber || invoiceId,
        receiptNumber: overrideData?.receiptNumber || invoiceId,
        transactionId: overrideData?.transactionId || invoiceId,
        invoiceDate: overrideData?.paymentDate || new Date().toISOString().split('T')[0],
        academicYear: selectedYear || '2026-2027',
        admissionRef: overrideData?.rollNo ? `Roll No: ${overrideData.rollNo}` : invoiceId,
        studentName: overrideData?.studentName || lastPaidStudentName || 'Student',
        rollNo: overrideData?.rollNo || '',
        fatherName: overrideData?.fatherName || '',
        motherName: overrideData?.motherName || '',
        className: overrideData?.className || '',
        sectionName: overrideData?.sectionName || '',
        studentDob: '',
        addressVillage: '',
        totalAmount: overrideData?.amountPaid ?? lastPaidAmount ?? 0,
        paidAmount: overrideData?.amountPaid ?? lastPaidAmount ?? 0,
        remainingBalance: overrideData?.remainingBalance ?? successRemainingBalance ?? 0,
        parentPhone: overrideData?.parentPhone || '',
        paymentMethod: overrideData?.paymentMethodLabel || 'Physical Cash',
        items: overrideData?.items || [{ particulars: 'Fee Payment', amount: overrideData?.amountPaid || lastPaidAmount || 0 }],
      };
    }

    // Ensure authoritative payment data matches exactly across modal, PDF, and WhatsApp
    if (overrideData) {
      if (overrideData.amountPaid !== undefined) {
        data.paidAmount = overrideData.amountPaid;
        data.totalAmount = overrideData.amountPaid;
      }
      if (overrideData.remainingBalance !== undefined) {
        data.remainingBalance = overrideData.remainingBalance;
      }
      if (overrideData.paymentMethodLabel) {
        data.paymentMethod = overrideData.paymentMethodLabel;
      }
      if (overrideData.studentName) {
        data.studentName = overrideData.studentName;
      }
      if (overrideData.parentPhone) {
        data.parentPhone = overrideData.parentPhone;
      }
      if (overrideData.rollNo) {
        data.rollNo = overrideData.rollNo;
      }
      if (overrideData.receiptNumber) {
        data.receiptNumber = overrideData.receiptNumber;
      }
      if (overrideData.transactionId) {
        data.transactionId = overrideData.transactionId;
      }
    }

    const paidDisplay = (data.paidAmount ?? data.totalAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const balanceDisplay = (data.remainingBalance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const isBalancePositive = (data.remainingBalance ?? 0) > 0;

    // 1. Preload logo image (if exists) to ensure html2canvas can capture it successfully
    if (data.schoolLogo) {
      await new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = resolve;
        img.onerror = resolve;
        img.src = data.schoolLogo;
      });
    }

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '800px';
    container.style.backgroundColor = '#ffffff';
    container.style.color = '#2d3748';
    container.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    container.style.padding = '40px';
    
    container.innerHTML = `
      <div style="border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); background-color: #ffffff;">
        <!-- Header -->
        <div style="background-color: #1a365d; color: #ffffff; padding: 30px; border-bottom: 6px solid #ed8936; display: flex; align-items: center; gap: 20px;">
          <div style="width: 75px; height: 75px; background-color: #ffffff; border-radius: 50%; padding: 6px; display: flex; align-items: center; justify-content: center; overflow: hidden; shrink: 0;">
            ${data.schoolLogo ? `<img src="${data.schoolLogo}" style="width: 100%; height: 100%; object-fit: contain;" />` : `
              <svg style="width: 45px; height: 45px; stroke: #1a365d; stroke-width: 2; fill: none;" viewBox="0 0 24 24">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
              </svg>
            `}
          </div>
          <div>
            <h1 style="margin: 0; font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px;">${data.schoolName}</h1>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #cbd5e1; font-style: italic; font-weight: 600;">${data.schoolSubtitle}</p>
          </div>
        </div>

        <!-- Body -->
        <div style="padding: 35px; min-height: 400px;">
          <div style="text-align: center; margin-bottom: 25px;">
            <h2 style="margin: 0; font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #1a365d;">Official Student Fee Receipt</h2>
          </div>

          <!-- Metadata Table -->
          <table style="width: 100%; font-size: 13px; margin-bottom: 20px; border-collapse: collapse; border-bottom: 1px solid #e2e8f0; padding-bottom: 15px;">
            <tbody>
              <tr>
                <td style="padding: 6px 0;"><strong>Receipt No:</strong> <span style="font-family: monospace; font-weight: bold; color: #1e293b;">${data.receiptNumber || data.invoiceNo}</span></td>
                <td style="padding: 6px 0; text-align: right;"><strong>Academic Year:</strong> <span style="font-weight: bold; color: #1e293b;">${data.academicYear}</span></td>
              </tr>
              <tr>
                <td style="padding: 6px 0;"><strong>Transaction ID:</strong> <span style="font-family: monospace; color: #475569;">${data.transactionId || invoiceId}</span></td>
                <td style="padding: 6px 0; text-align: right;"><strong>Payment Method:</strong> <span style="font-weight: bold; color: #1e293b;">${data.paymentMethod || 'Physical Cash'}</span></td>
              </tr>
              <tr>
                <td style="padding: 6px 0;"><strong>Payment Date & Time:</strong> <span style="color: #1e293b;">${data.invoiceDate}</span></td>
                <td style="padding: 6px 0; text-align: right;"><strong>${data.rollNo ? `Roll No: ${data.rollNo}` : 'Admission Ref'}:</strong> <span style="font-family: monospace; color: #1e293b;">${data.admissionRef}</span></td>
              </tr>
            </tbody>
          </table>

          <!-- Student Card -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 5px solid #1a365d; padding: 18px; border-radius: 8px; margin-bottom: 25px;">
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tbody>
                <tr>
                  <td style="width: 35%; vertical-align: top;">
                    <div style="font-size: 10px; color: #94a3b8; font-weight: bold; text-transform: uppercase;">Student Name</div>
                    <div style="font-size: 15px; color: #1a365d; font-weight: bold; margin-top: 2px;">${data.studentName}</div>
                    
                    <div style="font-size: 10px; color: #94a3b8; font-weight: bold; text-transform: uppercase; margin-top: 12px;">Parent Details</div>
                    <div style="color: #4b5563; margin-top: 3px; line-height: 1.5; font-size: 12px;">
                      ${data.fatherName ? `Father: <span style="font-weight: 600; color: #1f2937;">${data.fatherName}</span><br/>` : ''}
                      ${data.motherName ? `Mother: <span style="font-weight: 600; color: #1f2937;">${data.motherName}</span><br/>` : ''}
                      ${data.parentPhone ? `Contact: <span style="font-family: monospace; font-weight: 600; color: #1f2937;">${data.parentPhone}</span>` : ''}
                    </div>
                  </td>
                  <td style="width: 30%; vertical-align: top; padding: 0 15px;">
                    <div style="font-size: 10px; color: #94a3b8; font-weight: bold; text-transform: uppercase;">Class & Section</div>
                    <div style="font-size: 14px; color: #1a365d; font-weight: bold; margin-top: 2px;">${data.className}${data.sectionName ? ` - ${data.sectionName}` : ''}</div>
                    
                    <div style="font-size: 10px; color: #94a3b8; font-weight: bold; text-transform: uppercase; margin-top: 12px;">Status</div>
                    <div style="font-size: 13px; color: #166534; font-weight: bold; margin-top: 2px;">PAID / CONFIRMED</div>
                  </td>
                  <td style="width: 35%; vertical-align: top;">
                    <div style="font-size: 10px; color: #94a3b8; font-weight: bold; text-transform: uppercase;">School Address</div>
                    <div style="font-weight: 500; line-height: 1.5; margin-top: 4px; font-size: 12px; color: #4b5563;">
                      ${data.schoolAddress || 'School Campus Address'}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Particulars Table -->
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <thead>
              <tr style="background-color: #ebf8ff; color: #1a365d; font-size: 11px; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #cbd5e1;">
                <th style="padding: 10px 14px; text-align: left; width: 12%;">Sl. No</th>
                <th style="padding: 10px 14px; text-align: left; width: 58%;">Particulars Description</th>
                <th style="padding: 10px 14px; text-align: right; width: 30%;">Amount Paid</th>
              </tr>
            </thead>
            <tbody style="font-size: 13px;">
              ${data.items.map((item, index) => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 12px 14px; color: #64748b; font-weight: 500;">${index + 1}</td>
                  <td style="padding: 12px 14px; font-weight: 600; color: #1e293b;">${item.particulars}</td>
                  <td style="padding: 12px 14px; text-align: right; font-weight: bold; color: ${item.amount < 0 ? '#059669' : '#1e293b'};">
                    ${item.amount < 0 ? '-' : ''}₹${Math.abs(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Footer Dual Amount Summary -->
        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 25px 35px; display: flex; justify-content: space-between; align-items: center; gap: 20px;">
          <div style="font-size: 11px; color: #94a3b8; font-weight: 500; line-height: 1.5; max-width: 320px;">
            This is a computer generated fee receipt. No physical signature is required. For any billing queries, contact the administration.
          </div>
          <div style="display: flex; gap: 12px; align-items: center; shrink: 0;">
            <div style="background-color: #1a365d; color: #ffffff; border-radius: 8px; padding: 12px 20px; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; min-width: 150px;">
              <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: #93c5fd; letter-spacing: 0.5px;">Amount Paid</span>
              <span style="font-size: 17px; font-weight: 900; font-family: monospace; color: #ffffff;">₹${paidDisplay}</span>
            </div>
            <div style="background-color: ${isBalancePositive ? '#fff1f2' : '#f0fdf4'}; color: ${isBalancePositive ? '#9f1239' : '#166534'}; border: 1px solid ${isBalancePositive ? '#fecdd3' : '#bbf7d0'}; border-radius: 8px; padding: 12px 20px; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; min-width: 150px;">
              <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Remaining Balance</span>
              <span style="font-size: 17px; font-weight: 900; font-family: monospace;">₹${balanceDisplay}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);
    await new Promise(resolve => setTimeout(resolve, 300));

    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff'
    });

    document.body.removeChild(container);

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const safeInvoiceNo = (data.receiptNumber || data.invoiceNo || invoiceId).replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `fee_receipt_${safeInvoiceNo}.pdf`;

    return { pdf, data, filename };
  };

  const downloadInvoicePDF = async (invoiceId: string, recordOverride?: PaymentSuccessRecord | null) => {
    try {
      setIsLoading(true);
      const { pdf, filename } = await generateInvoicePDFInstance(invoiceId, recordOverride || lastPaymentSuccess);
      pdf.save(filename);
    } catch (err: any) {
      console.error('Failed to generate PDF download:', err);
      alert('Failed to generate PDF. Opening print page instead.');
      window.open(`/dashboard/billing/invoices/${invoiceId}`, '_blank');
    } finally {
      setIsLoading(false);
    }
  };

  const shareInvoiceWhatsApp = async (invoiceId: string, recordOverride?: PaymentSuccessRecord | null) => {
    if (isSharingWhatsApp) return;

    const record = recordOverride || lastPaymentSuccess;

    // 1. Resolve parent phone number strictly from student/payment records
    const rawPhone = record?.parentPhone 
      || record?.fatherPhone 
      || record?.motherPhone 
      || record?.guardianPhone 
      || selectedStudent?.account?.parentPhone 
      || selectedStudent?.fatherPhone 
      || selectedStudent?.motherPhone 
      || selectedStudent?.guardianPhone 
      || selectedStudent?.account?.phone 
      || '';

    const phoneValidation = normalizeWhatsAppNumber(rawPhone);

    // Requirement 6: Handle missing or invalid parent phone number
    if (!phoneValidation.valid) {
      const errorMsg = phoneValidation.error || 'Parent WhatsApp number is not available for this student.';
      alert(errorMsg);
      setToastMessage(errorMsg);
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }

    const phoneClean = phoneValidation.normalized;

    // Build receipt URL for parent
    const receiptUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/dashboard/billing/invoices/${invoiceId}`
      : `/dashboard/billing/invoices/${invoiceId}`;

    // Compose prefilled share message matching Requirement 2
    const studentName = record?.studentName || lastPaidStudentName || 'Student';
    const amountPaidVal = record?.amountPaid ?? lastPaidAmount ?? 0;
    const remainingBalanceVal = record?.remainingBalance ?? successRemainingBalance ?? 0;
    const paymentMethodVal = record?.paymentMethodLabel || paymentChannels.find(c => c.value === selectedChannel)?.label || 'Physical Cash';
    const paymentDateVal = record?.paymentDate || successPaymentDate || new Date().toLocaleString('en-IN');
    const schoolTitle = record?.schoolName || schoolName || 'CS EduTrack';

    const shareText = formatWhatsAppReceiptMessage({
      studentName,
      receiptNumber: record?.receiptNumber || invoiceId,
      transactionId: record?.transactionId || invoiceId,
      amountPaid: amountPaidVal,
      remainingBalance: remainingBalanceVal,
      paymentMethod: paymentMethodVal,
      paymentDate: paymentDateVal,
      schoolName: schoolTitle,
      receiptUrl,
    });

    const whatsappUrl = `https://wa.me/${phoneClean}?text=${encodeURIComponent(shareText)}`;

    // Desktop Chrome Popup-Blocker Prevention:
    // Synchronously open blank window reference on user click gesture
    let popupWindow: Window | null = null;
    try {
      popupWindow = window.open('about:blank', '_blank');
      if (popupWindow) {
        popupWindow.document.write(`
          <html>
            <head><title>Opening WhatsApp...</title></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc; color: #1e293b;">
              <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; text-align: center; max-width: 400px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);">
                <div style="width: 48px; height: 48px; background: #ecfdf5; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                  <span style="font-size: 24px;">💬</span>
                </div>
                <h3 style="margin: 0 0 8px; font-size: 16px; font-weight: 700;">Opening WhatsApp Chat</h3>
                <p style="margin: 0; font-size: 13px; color: #64748b;">Preparing receipt PDF and redirecting to WhatsApp...</p>
              </div>
            </body>
          </html>
        `);
      }
    } catch (popupErr) {
      console.warn('Could not pre-open popup window:', popupErr);
    }

    setIsSharingWhatsApp(true);

    try {
      // 1. Generate and download the official high-resolution PDF
      const { pdf, filename } = await generateInvoicePDFInstance(invoiceId, record);
      pdf.save(filename);

      // 2. Redirect popup window to WhatsApp deep-link
      if (popupWindow && !popupWindow.closed) {
        popupWindow.location.href = whatsappUrl;
      } else {
        window.open(whatsappUrl, '_blank');
      }

      setToastMessage('WhatsApp chat opened. Please attach the downloaded receipt PDF to the chat if needed.');
      setTimeout(() => setToastMessage(null), 6000);
    } catch (err: any) {
      console.error('Failed to generate PDF during WhatsApp share:', err);
      // Fallback: still redirect to WhatsApp with prefilled details even if PDF generation throws
      if (popupWindow && !popupWindow.closed) {
        popupWindow.location.href = whatsappUrl;
      } else {
        window.open(whatsappUrl, '_blank');
      }
      setToastMessage('WhatsApp chat opened with receipt details.');
      setTimeout(() => setToastMessage(null), 6000);
    } finally {
      setIsSharingWhatsApp(false);
    }
  };

  const handleRollback = async (id: string) => {
    if (!confirm('Are you sure you want to void this invoice payment?')) return;
    try {
      setIsLoading(true);
      await api.post(`/billing/invoices/${id}/void`);
      // Dispatch event to refresh dashboard in real-time
      dispatchSchoolSetupUpdated();
      alert(`Rollback: Transaction invoice voided successfully.`);
      
      const txRes = await api.get('/billing/invoices/recent');
      setTransactions(txRes.data);
    } catch (err: any) {
      console.error('Voiding failed', err);
      alert(`Failed to void invoice: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const showCommandCenter = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'SCHOOL_ADMIN';

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-[28px] font-bold text-slate-900 leading-none">
            Fee Management & Invoicing
          </h2>
          <p className="text-slate-500 text-[13px] font-medium mt-2">
            Collect school tuition fees, issue transaction logs, and generate invoice bills.
          </p>
        </div>
        {showCommandCenter && (
          <Link
            href="/dashboard/billing/financial-command-center"
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-750 text-white rounded-xl shadow-md shadow-blue-500/10 text-xs font-bold transition-all shrink-0 select-none hover:scale-[1.02] active:scale-[0.98]"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            Financial Command Center
          </Link>
        )}
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-3 text-sm animate-pulse">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="font-semibold">{toastMessage} Ledger balances updated.</div>
        </div>
      )}

      {/* QUICK STUDENT SEARCH */}
      <div className="space-y-2 relative max-w-lg">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Quick Student Search</label>
        <div className="relative flex items-center bg-white border border-slate-200 rounded-xl px-4 py-2.5 focus-within:border-[#2E5BFF] transition-all">
          {isSearching ? (
            <div className="mr-2 shrink-0">
              <PencilSpinner size="xs" />
            </div>
          ) : (
            <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          )}
          <input
            type="text"
            placeholder="Type student name, roll number, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-none text-[13px] font-semibold text-slate-800 outline-none w-full placeholder-slate-400"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setMatchingStudents([]); }}
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Autocomplete Dropdown list */}
        {matchingStudents.length > 0 && (
          <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto">
            {matchingStudents.map((s) => (
              <div
                key={s.account.id}
                onMouseEnter={() => prefetchStudentBilling(s)}
                onTouchStart={() => prefetchStudentBilling(s)}
                onClick={() => handleSelectStudent(s)}
                className="p-3 hover:bg-blue-50/50 cursor-pointer flex justify-between items-center text-xs font-medium transition-colors"
              >
                <div>
                  <span className="font-bold text-slate-800 block">{s.account.name}</span>
                  <span className="text-slate-400 text-[10px]">{s.account.class} {s.account.section} · Roll: {s.account.rollNo || 'N/A'}</span>
                </div>
                <div className="text-right">
                  <span className="text-amber-600 font-bold font-mono block">Due: ₹{s.totalPendingBalance.toLocaleString()}</span>
                  {s.totalPaidAmount > 0 && (
                    <span className="text-emerald-600 text-[10px] font-semibold">Paid: ₹{s.totalPaidAmount.toLocaleString()}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ACTIVE BILLING SUITE PANEL */}
      {isStudentLoading && !selectedStudent ? (
        <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl space-y-3 max-w-lg shadow-sm animate-pulse">
          <div className="flex items-center justify-center">
            <PencilSpinner size="md" />
          </div>
          <h4 className="text-sm font-bold text-slate-700">Loading student billing ledger...</h4>
          <p className="text-xs text-slate-400 font-light">
            Retrieving fee products, invoices, and payment particulars.
          </p>
        </div>
      ) : selectedStudent ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-extrabold text-slate-850 text-base flex items-center gap-1.5">
                <User className="w-5 h-5 text-blue-500 shrink-0" />
                Ledger: <span className="text-blue-600 font-black">{selectedStudent.account.name}</span>
              </h3>
              <p className="text-[11px] text-slate-450 mt-1 font-semibold">
                Roll: {selectedStudent.account.rollNo || 'N/A'} · {selectedStudent.account.class} {selectedStudent.account.section}
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="border border-slate-200 rounded-lg p-1.5 text-xs text-slate-700 font-bold bg-white"
              >
                {academicYears.map(ay => (
                  <option key={ay.value} value={ay.value}>{ay.label}</option>
                ))}
              </select>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100 text-xs font-bold font-mono">
                PENDING: ₹{selectedStudent.totalPendingBalance.toLocaleString()}
              </span>
            </div>
          </div>

          {selectedStudent.feeSummary && (
            <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Current Year */}
              <div className="bg-white p-3.5 border border-slate-150 rounded-xl space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Current Academic Year</span>
                <div className="divide-y divide-slate-100 text-xs text-slate-600 space-y-1">
                  <div className="flex justify-between py-1">
                    <span>Fee Products:</span>
                    <strong className="text-slate-800 font-mono">₹{selectedStudent.feeSummary.currentYear.feeProductsAmount.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Paid Amount:</span>
                    <strong className="text-emerald-600 font-mono">₹{selectedStudent.feeSummary.currentYear.paidAmount.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between py-1 pt-1.5">
                    <span className="font-bold">Pending Amount:</span>
                    <strong className="text-rose-600 font-bold font-mono">₹{selectedStudent.feeSummary.currentYear.pendingAmount.toLocaleString()}</strong>
                  </div>
                </div>
              </div>

              {/* Card 2: Previous Year Outstanding */}
              <div className="bg-white p-3.5 border border-slate-150 rounded-xl space-y-2 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Previous Year Outstanding</span>
                  <div className="max-h-20 overflow-y-auto divide-y divide-slate-100 text-xs text-slate-650 mt-1 font-semibold space-y-1">
                    {selectedStudent.feeSummary.previousYears.length > 0 ? (
                      selectedStudent.feeSummary.previousYears.map((py: any, idx: number) => (
                        <div key={idx} className="flex justify-between py-1">
                          <span className="text-slate-500 font-medium">Session {py.academicYearName}:</span>
                          <strong className="text-rose-600 font-mono">₹{py.outstandingBalance.toLocaleString()}</strong>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-400 py-3 text-center italic text-[11px] font-medium">
                        No previous year outstanding dues
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 3: Overall Outstanding */}
              <div className="bg-gradient-to-tr from-slate-900 to-slate-800 text-white p-4 rounded-xl space-y-2 flex flex-col justify-between shadow-md">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Overall Outstanding</span>
                <div className="text-xs text-slate-300 space-y-1.5">
                  <div className="flex justify-between">
                    <span>Current Year Due:</span>
                    <strong className="text-slate-200 font-mono">₹{selectedStudent.feeSummary.overall.totalCurrentYearDue.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Previous Year Due:</span>
                    <strong className="text-amber-400 font-mono">₹{selectedStudent.feeSummary.overall.totalPreviousYearDue.toLocaleString()}</strong>
                  </div>
                  <div className="border-t border-slate-700/50 my-1 pt-1.5 flex justify-between">
                    <span className="font-bold text-slate-100">Grand Total Due:</span>
                    <strong className="text-rose-400 text-sm font-black font-mono">₹{selectedStudent.feeSummary.overall.grandTotalBalanceDue.toLocaleString()}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="py-4">
              <TableSkeleton
                columns={7}
                rows={3}
                loadingMessage="Calculating fee breakdown & balance due..."
                className="border-none shadow-none"
              />
            </div>
          ) : feeItems.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No outstanding fees found"
                description="No open fee structures or balance dues were found for this student in the selected session."
              />
            </div>
          ) : (
            <>
              {/* ── Fee Table: Desktop (sm and above) ── */}
              <div className="hidden sm:block overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      <th className="px-4 py-3" style={{ width: '40px' }}>
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          disabled={unpaidItems.length === 0}
                          onChange={handleSelectAllToggle}
                          className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                      </th>
                      <th className="px-4 py-3">Fee Particulars</th>
                      <th className="px-4 py-3 text-right">Total Amt</th>
                      <th className="px-4 py-3 text-right">Discount</th>
                      <th className="px-4 py-3 text-right">Paid</th>
                      <th className="px-4 py-3 text-right">Balance</th>
                      <th className="px-4 py-3 text-right" style={{ width: '130px' }}>Payment Input</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-650 font-semibold">
                    {feeItems.map((fee) => {
                      const isPaid = fee.balance <= 0;
                      return (
                        <tr key={fee.id} className={`${fee.isSelected ? 'bg-blue-50/10' : ''}`}>
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={fee.isSelected}
                              disabled={isPaid}
                              onChange={() => handleCheckboxChange(fee.id)}
                              className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-800">{fee.name}</td>
                          <td className="px-4 py-3 text-right font-mono">₹{fee.total.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-400">₹{fee.discount.toLocaleString()} ({fee.discountPercent}%)</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-500">₹{fee.paid.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-mono text-rose-600 font-bold">₹{fee.balance.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              value={fee.isSelected ? fee.input : 0}
                              disabled={!fee.isSelected || isPaid}
                              onChange={(e) => handleInputChange(fee.id, Number(e.target.value))}
                              className="w-24 bg-white border border-slate-200 rounded px-2 py-1 text-right font-mono text-slate-800 font-bold outline-none"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Fee Cards: Mobile only (below sm) ── */}
              <div className="sm:hidden space-y-2.5">
                {feeItems.map((fee) => {
                  const isPaid = fee.balance <= 0;
                  return (
                    <div
                      key={fee.id}
                      className={`border rounded-xl p-3 space-y-2.5 transition-all ${
                        fee.isSelected
                          ? 'bg-blue-50/40 border-blue-200'
                          : 'bg-white border-slate-200'
                      } ${isPaid ? 'opacity-60' : ''}`}
                    >
                      {/* Primary row: Checkbox + Name + Total */}
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={fee.isSelected}
                          disabled={isPaid}
                          onChange={() => handleCheckboxChange(fee.id)}
                          className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="font-bold text-slate-800 text-[13px] block leading-tight">{fee.name}</span>
                          {isPaid && (
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100 mt-0.5 inline-block">
                              ✓ Fully Paid
                            </span>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[13px] font-bold text-slate-700 font-mono">₹{fee.total.toLocaleString()}</span>
                          <span className="text-[9px] text-slate-400 font-medium block">Total</span>
                        </div>
                      </div>

                      {/* Secondary row: Balance + Payment input */}
                      <div className="flex items-end justify-between gap-3 pl-8">
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide block">Balance Due</span>
                          <span className={`text-sm font-bold font-mono ${fee.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            ₹{fee.balance.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Pay Now</span>
                          <input
                            type="number"
                            value={fee.isSelected ? fee.input : 0}
                            disabled={!fee.isSelected || isPaid}
                            onChange={(e) => handleInputChange(fee.id, Number(e.target.value))}
                            className="w-28 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-right font-mono text-slate-800 font-bold text-sm outline-none focus:border-blue-400 disabled:opacity-50 disabled:bg-slate-50"
                          />
                        </div>
                      </div>

                      {/* Tertiary row: Discount + Paid (collapsed info) */}
                      <div className="flex gap-4 pl-8 text-[10px] text-slate-400 font-medium border-t border-slate-100 pt-2">
                        <span>Disc: <span className="text-slate-600 font-semibold">₹{fee.discount.toLocaleString()} ({fee.discountPercent}%)</span></span>
                        <span>Paid: <span className="text-slate-600 font-semibold">₹{fee.paid.toLocaleString()}</span></span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Total Summary Banner ── */}
              <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl px-4 py-3.5 shadow-md shadow-blue-500/20">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 block">Total Settlement</span>
                  <span className="text-2xl font-black font-mono">₹{billingTotal.toLocaleString()}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-semibold text-blue-200 block">{feeItems.filter(f => f.isSelected).length} fee(s) selected</span>
                  <span className="text-xs font-bold text-blue-100">Ready to collect</span>
                </div>
              </div>

              {/* Payment Method selector */}
              <div className="space-y-3 pt-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Choose Collection Channel</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {paymentChannels.map((c) => {
                    const isSelected = selectedChannel === c.value;
                    return (
                      <div
                        key={c.value}
                        onClick={() => setSelectedChannel(c.value)}
                        className={`p-3 sm:p-4 border rounded-xl cursor-pointer flex flex-col items-center justify-center gap-1 transition-all ${
                          isSelected 
                            ? 'bg-blue-50 border-[#2E5BFF] text-[#2E5BFF] font-bold shadow-xs'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold'
                        }`}
                      >
                        <span className="text-xl">{c.icon}</span>
                        <span className="text-xs text-center leading-tight">{c.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic details for UPI and Bank */}
              {selectedChannel.includes('UPI') && (() => {
                const tenant = setupStats?.setup?.tenant;
                const merchantName = setupStats?.setup?.schoolName || tenant?.name || 'School Merchant';
                let activeUpiId = '';
                if (selectedChannel === 'GPAY_UPI') {
                  activeUpiId = tenant?.googlePayId || '';
                } else if (selectedChannel === 'PHONEPE_UPI') {
                  activeUpiId = tenant?.phonePeId || '';
                }
                if (!activeUpiId) {
                  activeUpiId = tenant?.upiQrId || '';
                }
                const isMockUpi = !activeUpiId;
                const displayUpiId = activeUpiId || 'gpay-vikas-edu@okaxis';

                // UPI standard transaction payload format
                const upiLink = `upi://pay?pa=${encodeURIComponent(displayUpiId)}&pn=${encodeURIComponent(merchantName)}&am=${billingTotal}&cu=INR`;
                const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiLink)}`;

                return (
                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl max-w-sm mx-auto flex flex-col items-center text-center space-y-3">
                    <span className="text-xs font-bold text-slate-650 uppercase tracking-wider">Scan Standee QR</span>
                    <div className="w-36 h-36 bg-white p-2 border border-slate-200 rounded-xl shadow-sm flex items-center justify-center overflow-hidden">
                      <img 
                        src={qrCodeUrl} 
                        alt="UPI Payment QR Code" 
                        className="w-32 h-32 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] text-slate-500 font-mono block">
                        UPI ID: <span className="font-bold text-slate-800">{displayUpiId}</span>
                      </span>
                      {isMockUpi && (
                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 block">
                          ⚠️ Configure your merchant UPI ID in Settings
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-blue-600 font-bold bg-blue-50/50 px-3 py-1 rounded-full border border-blue-100">
                      Scan to complete physical ₹{billingTotal.toLocaleString()} collection
                    </p>
                  </div>
                );
              })()}

              {selectedChannel === 'NET_BANKING' && (
                <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl space-y-3 text-xs">
                  <h4 className="font-bold text-slate-700">Net Banking Settlement details:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-semibold">
                    <div>
                      <span className="text-slate-400 block mb-0.5">Bank Name</span>
                      <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} className="w-full bg-white border border-slate-200 rounded p-1.5" />
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">IFSC Code</span>
                      <input type="text" value={ifscCode} onChange={(e) => setIfscCode(e.target.value)} className="w-full bg-white border border-slate-200 rounded p-1.5" />
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-slate-400 block mb-0.5">Account Number</span>
                      <input type="text" value={accountNo} onChange={(e) => setAccountNo(e.target.value)} className="w-full bg-white border border-slate-200 rounded p-1.5" />
                    </div>
                  </div>
                </div>
              )}

              {/* Footer action buttons */}
              <div className="border-t border-slate-100 pt-4 flex gap-2">
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm bg-white hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleOpenConfirmModal}
                  className="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md shadow-blue-500/10 cursor-pointer"
                >
                  ✓ Finalize Payment
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="p-8 text-center bg-white border border-slate-200 border-dashed rounded-2xl space-y-2 max-w-lg">
          <span className="text-2xl block">🔎</span>
          <h4 className="text-sm font-bold text-slate-700">Find a Student to begin</h4>
          <p className="text-xs text-slate-450 font-light">
            Type at least 2 characters in the quick search input to find outstanding records.
          </p>
        </div>
      )}

      {/* RECENT TRANSACTION HISTORY */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <h3 className="font-extrabold text-slate-850 text-base">Recent Transaction History</h3>
        
        {transactionsLoading ? (
          <TableSkeleton
            columns={7}
            rows={5}
            loadingMessage="Fetching recent payment transactions..."
          />
        ) : transactions.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            description="No recent payment transactions have been recorded. Collect a fee to see records here."
          />
        ) : (
          <>
            {/* ── Transactions Table: Desktop ── */}
            <div className="hidden sm:block overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <th className="px-4 py-3">Invoice ID</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Management Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-650 font-semibold">
                  {transactions.map((t) => {
                    const isCancelled = t.status === 'Cancelled';
                    const isPartiallyPaid = t.status === 'Partially Paid';
                    return (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-800">{t.id.slice(0, 8)}...</td>
                        <td className="px-4 py-3">
                          <div>{t.name}</div>
                          <div className="text-[10px] text-slate-400">Roll: {t.rollNo || 'N/A'}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-450">{t.dateStr}</td>
                        <td className="px-4 py-3 font-bold text-slate-800 font-mono">₹{t.totalAmount.toLocaleString()}</td>
                        <td className="px-4 py-3 text-slate-500">{t.paymentMethod}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                            isCancelled 
                              ? 'bg-rose-50 text-rose-600 border-rose-100'
                              : isPartiallyPaid
                                ? 'bg-amber-50 text-amber-600 border-amber-150'
                                : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/dashboard/billing/invoices/${t.id}`}
                              onMouseEnter={() => prefetchInvoicePDF(t.id)}
                              onTouchStart={() => prefetchInvoicePDF(t.id)}
                              className="px-2.5 py-1 rounded bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-[10px] font-bold border border-slate-200 inline-flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Printer className="w-3 h-3" /> Print
                            </Link>
                            {!isCancelled && (
                              <button
                                onClick={() => handleRollback(t.id)}
                                className="px-2.5 py-1 rounded bg-rose-50 text-rose-600 hover:bg-rose-100/30 text-[10px] font-bold border border-rose-100 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" /> Rollback
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Transaction Cards: Mobile ── */}
            <div className="sm:hidden space-y-2.5">
              {transactions.map((t) => {
                const isCancelled = t.status === 'Cancelled';
                const isPartiallyPaid = t.status === 'Partially Paid';
                return (
                  <div key={t.id} className="border border-slate-200 rounded-xl p-3 space-y-2 bg-white">
                    {/* Row 1: Student + Amount */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-bold text-slate-800 text-[13px] block truncate">{t.name}</span>
                        <span className="text-[10px] text-slate-400">Roll: {t.rollNo || 'N/A'}</span>
                      </div>
                      <span className="font-bold text-slate-800 font-mono text-sm shrink-0">₹{t.totalAmount.toLocaleString()}</span>
                    </div>

                    {/* Row 2: Invoice ID, Date, Channel, Status */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                        #{t.id.slice(0, 8)}
                      </span>
                      <span className="text-[10px] text-slate-400">{t.dateStr}</span>
                      <span className="text-[10px] text-slate-500 font-medium">{t.paymentMethod}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                        isCancelled 
                          ? 'bg-rose-50 text-rose-600 border-rose-100'
                          : isPartiallyPaid
                            ? 'bg-amber-50 text-amber-600 border-amber-150'
                            : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      }`}>
                        {t.status}
                      </span>
                    </div>

                    {/* Row 3: Full-width action buttons */}
                    <div className="flex gap-2 pt-0.5">
                      <Link
                        href={`/dashboard/billing/invoices/${t.id}`}
                        onMouseEnter={() => prefetchInvoicePDF(t.id)}
                        onTouchStart={() => prefetchInvoicePDF(t.id)}
                        className="flex-1 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 inline-flex items-center justify-center gap-1.5"
                      >
                        <Printer className="w-3.5 h-3.5" /> Print Invoice
                      </Link>
                      {!isCancelled && (
                        <button
                          onClick={() => handleRollback(t.id)}
                          className="flex-1 py-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100/50 text-xs font-bold border border-rose-100 inline-flex items-center justify-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Rollback
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      {/* Success Modal Popup */}
      {successModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Payment Successful!
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                Transaction processed successfully and registered in student ledger.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 text-xs text-slate-650 space-y-1.5 text-left border border-slate-100">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-400">Student:</span>
                <span className="font-bold text-slate-800">{lastPaymentSuccess?.studentName || lastPaidStudentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-400">Receipt Number:</span>
                <span className="font-mono text-slate-800 font-bold">{lastPaymentSuccess?.receiptNumber || successInvoiceId}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-400">Transaction ID:</span>
                <span className="font-mono text-slate-800">{lastPaymentSuccess?.transactionId || successInvoiceId}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-400">Amount Paid:</span>
                <span className="font-extrabold text-slate-900">₹{(lastPaymentSuccess?.amountPaid ?? lastPaidAmount).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-400">Payment Method:</span>
                <span className="font-semibold text-slate-800">
                  {lastPaymentSuccess?.paymentMethodLabel || paymentChannels.find(c => c.value === selectedChannel)?.label || selectedChannel}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-400">Payment Date &amp; Time:</span>
                <span className="font-mono text-slate-700 font-semibold">{lastPaymentSuccess?.paymentDate || successPaymentDate}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200/60 pt-1.5">
                <span className="font-bold text-slate-500">Remaining Balance:</span>
                <span className="font-black text-rose-600 font-mono">₹{(lastPaymentSuccess?.remainingBalance ?? successRemainingBalance).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (successInvoiceId) {
                    downloadInvoicePDF(successInvoiceId, lastPaymentSuccess);
                  }
                }}
                className="w-full sm:w-auto flex-1 px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer border-none"
              >
                <Printer className="w-4 h-4" /> Save / Print PDF
              </button>
              <button
                type="button"
                disabled={isSharingWhatsApp}
                onClick={() => {
                  if (successInvoiceId) {
                    shareInvoiceWhatsApp(successInvoiceId, lastPaymentSuccess);
                  }
                }}
                className={`w-full sm:w-auto px-3.5 py-2.5 rounded-xl text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm border-none ${
                  isSharingWhatsApp 
                    ? 'bg-emerald-400 cursor-not-allowed' 
                    : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                {isSharingWhatsApp ? 'Preparing PDF...' : 'Share WhatsApp'}
              </button>
              <button
                type="button"
                onClick={() => setSuccessModalOpen(false)}
                className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all cursor-pointer bg-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Confirmation Modal */}
      {confirmModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 text-left">
            <div>
              <h3 className="text-lg font-black text-slate-900">
                Confirm Payment Details
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                Please review the transaction summary carefully before confirming.
              </p>
            </div>

            {/* Student details */}
            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 grid grid-cols-2 gap-4 text-xs font-semibold text-slate-650">
              <div>
                <span className="text-slate-400 block mb-0.5">Student Name</span>
                <span className="text-slate-800 font-bold block">{selectedStudent.account.name}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Roll/Admission Number</span>
                <span className="text-slate-800 font-bold block">{selectedStudent.account.rollNo || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Class &amp; Section</span>
                <span className="text-slate-800 font-bold block">
                  {selectedStudent.account.class} {selectedStudent.account.section}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Academic Session</span>
                <span className="text-slate-800 font-bold block">
                  {academicYears.find(y => y.value === selectedYear)?.label || selectedYear}
                </span>
              </div>
            </div>

            {/* Selected items list */}
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Selected Fee Products</span>
              <div className="max-h-36 overflow-y-auto border border-slate-150 rounded-2xl p-3 divide-y divide-slate-100 bg-white">
                {feeItems.filter(item => item.isSelected && item.input > 0).map((item) => (
                  <div key={item.id} className="flex justify-between py-2 text-xs font-semibold text-slate-600">
                    <div>
                      <span className="font-bold text-slate-800">{item.name}</span>
                      {item.discount > 0 && (
                        <span className="text-[10px] text-slate-400 ml-2">Discount: ₹{item.discount.toLocaleString()}</span>
                      )}
                    </div>
                    <span className="font-mono text-slate-800 font-bold">₹{item.input.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Summary */}
            <div className="border-t border-slate-100 pt-3 text-xs font-semibold text-slate-655 space-y-2">
              <div className="flex justify-between items-center">
                <span>Total Amount Being Paid:</span>
                <span className="font-mono text-blue-600 font-black text-base">₹{billingTotal.toLocaleString()}</span>
              </div>
            </div>

            {/* Payment Collection Info */}
            <div className="border-t border-slate-100 pt-3 grid grid-cols-2 gap-4 text-xs font-semibold text-slate-650">
              <div>
                <span className="text-slate-400 block mb-0.5">Payment Method</span>
                <span className="text-slate-800 font-bold block">
                  {paymentChannels.find(c => c.value === selectedChannel)?.label || selectedChannel}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Payment Date</span>
                <span className="text-slate-850 font-bold block">{formatDateDDMMYYYY(new Date())}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                disabled={isSubmittingPayment}
                className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors bg-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFinalizePayment}
                disabled={isSubmittingPayment}
                className="flex-1 py-3 bg-[#00875A] hover:bg-green-750 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isSubmittingPayment ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-t-white border-white/20 rounded-full animate-spin"></div>
                    Processing Payment...
                  </>
                ) : (
                  'Confirm Payment'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Failed Modal */}
      {errorModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center text-rose-600 mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Payment Failed
              </h3>
              <p className="text-xs text-rose-600 font-semibold mt-1">
                {errorMessage}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setErrorModalOpen(false);
                  setConfirmModalOpen(true);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all cursor-pointer border-none"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => setErrorModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all cursor-pointer bg-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
