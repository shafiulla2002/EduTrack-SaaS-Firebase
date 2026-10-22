'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Printer, ArrowLeft, Download, MessageCircle } from 'lucide-react';
import { api, fastGet, getCachedData } from '@/lib/api';
import { PDFService } from '@/lib/pdf';
import { PDFLayout } from '@/components/PDFLayout';
import { PDFTable } from '@/components/PDFTable';
import { PencilSpinner } from '@/components/loading';

interface InvoicePDFData {
  schoolName: string;
  schoolAddress: string;
  schoolPhone: string;
  schoolLogo: string;
  schoolSubtitle: string;
  invoiceNo: string;
  invoiceDate: string;
  academicYear: string;
  admissionRef: string;
  studentName: string;
  fatherName: string;
  motherName: string;
  className: string;
  sectionName: string;
  studentDob: string;
  addressVillage: string;
  totalAmount: number;
  paidAmount?: number;
  remainingBalance?: number;
  parentPhone?: string;
  items: { particulars: string; amount: number }[];
}

export default function InvoicePrintPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  // Synchronously initialize from SWR cache for 0ms instant display
  const initialData = useMemo(() => {
    if (typeof window === 'undefined' || !id) return null;
    return getCachedData<InvoicePDFData>(`/billing/invoices/${id}/pdf`);
  }, [id]);

  const [invoiceData, setInvoiceData] = useState<InvoicePDFData | null>(initialData);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    const fetchInvoicePDF = async () => {
      try {
        if (!invoiceData) {
          setIsLoading(true);
        }
        const res = await fastGet(`/billing/invoices/${id}/pdf`, undefined, {
          ttlMs: 60000,
          onRevalidate: (fresh) => {
            if (fresh && isMounted) {
              setInvoiceData(fresh);
            }
          }
        });
        if (res.data && isMounted) {
          setInvoiceData(res.data);
        }
      } catch (err: any) {
        console.error('Failed to load invoice details for PDF rendering', err);
        if (isMounted && !invoiceData) {
          setError(err.response?.data?.message || err.message || 'Failed to fetch invoice details.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    fetchInvoicePDF();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const handlePrint = () => {
    PDFService.print();
  };

  const handleExportPDF = async () => {
    const element = document.getElementById('invoice-pdf-element');
    if (!element || !invoiceData) return;

    setIsGeneratingPDF(true);
    try {
      const safeInvoiceNo = invoiceData.invoiceNo.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Invoice_${safeInvoiceNo}`;

      await PDFService.export({
        element,
        filename,
        documentType: 'receipt',
        metadata: {
          title: `Fee Receipt - ${invoiceData.invoiceNo}`,
          author: invoiceData.schoolName,
          subject: 'Student Fee Payment Invoice Receipt',
          keywords: 'Invoice, Fee Receipt, Student, Billing',
        },
      });
    } catch (err) {
      console.error('Failed to export invoice PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const [isSharingWhatsApp, setIsSharingWhatsApp] = useState(false);

  const handleShareWhatsApp = async () => {
    if (!invoiceData) return;
    setIsSharingWhatsApp(true);
    try {
      const element = document.getElementById('invoice-pdf-element');
      const safeInvoiceNo = invoiceData.invoiceNo.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `fee_receipt_${safeInvoiceNo}.pdf`;

      const rawPhone = (invoiceData.parentPhone || '').replace(/\D/g, '');
      const phoneClean = rawPhone ? (rawPhone.length === 10 ? `91${rawPhone}` : rawPhone) : '';

      const receiptUrl = typeof window !== 'undefined' 
        ? window.location.href 
        : `/dashboard/billing/invoices/${id}`;

      const text = `*OFFICIAL STUDENT FEE RECEIPT*\n` +
        `🏫 *School:* ${invoiceData.schoolName}\n` +
        `📄 *Receipt No:* ${invoiceData.invoiceNo}\n` +
        `📅 *Date:* ${invoiceData.invoiceDate}\n` +
        `👤 *Student:* ${invoiceData.studentName} (${invoiceData.className} - ${invoiceData.sectionName})\n\n` +
        `----------------------------------------\n` +
        `💳 *Amount Paid:* ₹${invoiceData.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
        `⏳ *Remaining Balance:* ₹${(invoiceData.remainingBalance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
        `----------------------------------------\n\n` +
        `📎 *View & Download Official PDF Receipt:* \n${receiptUrl}\n\n` +
        `Thank you for your payment!`;

      if (element) {
        const pdf = await PDFService.generatePDF({
          element,
          filename,
          documentType: 'receipt',
          metadata: {
            title: `Fee Receipt - ${invoiceData.invoiceNo}`,
            author: invoiceData.schoolName,
            subject: 'Student Fee Payment Invoice Receipt',
            keywords: 'Invoice, Fee Receipt, Student, Billing',
          },
        });

        const pdfBlob = pdf.output('blob');
        const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

        // 1. If Web Share API with files is supported (Mobile / Tablet / Safari / Chrome Mobile)
        if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
          try {
            await navigator.share({
              files: [pdfFile],
              title: `Fee Receipt - ${invoiceData.invoiceNo}`,
              text
            });
            return;
          } catch (shareErr: any) {
            if (shareErr.name === 'AbortError') return;
            console.warn('Native share failed or dismissed, falling back to download + WhatsApp Web:', shareErr);
          }
        }

        // 2. On desktop browsers / fallback: Auto-download the high-res PDF
        pdf.save(filename);
      }

      // 3. Open WhatsApp with full breakdown + direct receipt link
      const whatsappUrl = phoneClean 
        ? `https://wa.me/${phoneClean}?text=${encodeURIComponent(text)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

      window.open(whatsappUrl, '_blank');
    } catch (err: any) {
      console.error('Failed to share PDF via WhatsApp:', err);
    } finally {
      setIsSharingWhatsApp(false);
    }
  };

  if (isLoading && !invoiceData) {
    return (
      <div className="-mt-4 sm:-mt-8 -mx-4 sm:-mx-8 p-3 sm:p-6 pt-0 sm:pt-0 bg-slate-100 min-h-screen flex flex-col items-center justify-start">
        {/* Skeleton Top Bar */}
        <div className="w-full max-w-[800px] mb-3 sm:mb-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm animate-pulse flex justify-between items-center">
          <div className="h-9 w-32 bg-slate-200 rounded-xl" />
          <div className="flex gap-2">
            <div className="h-9 w-28 bg-slate-200 rounded-xl" />
            <div className="h-9 w-28 bg-slate-200 rounded-xl" />
          </div>
        </div>

        {/* Skeleton A4 Receipt Card */}
        <div className="w-full max-w-[800px] bg-white border border-slate-200 rounded-2xl shadow-lg p-6 sm:p-10 space-y-6 relative overflow-hidden min-h-[500px]">
          {/* Glassmorphic spinner indicator overlay */}
          <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex flex-col items-center justify-center z-10 gap-3">
            <PencilSpinner size="md" />
            <span className="text-xs font-bold text-slate-700">Loading printable invoice receipt data...</span>
          </div>

          {/* Skeleton Header */}
          <div className="flex items-center gap-4 border-b border-slate-100 pb-6 animate-pulse">
            <div className="w-16 h-16 rounded-full bg-slate-200 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-56 bg-slate-200 rounded" />
              <div className="h-3 w-40 bg-slate-200 rounded" />
            </div>
          </div>

          {/* Skeleton Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 py-4 border-b border-slate-100 animate-pulse">
            <div className="space-y-2">
              <div className="h-3 w-24 bg-slate-200 rounded" />
              <div className="h-4 w-36 bg-slate-200 rounded" />
            </div>
            <div className="space-y-2 text-right">
              <div className="h-3 w-24 bg-slate-200 rounded ml-auto" />
              <div className="h-4 w-36 bg-slate-200 rounded ml-auto" />
            </div>
          </div>

          {/* Skeleton Table Rows */}
          <div className="space-y-3 pt-2 animate-pulse">
            <div className="h-8 bg-slate-100 rounded-xl" />
            <div className="h-10 bg-slate-50 rounded-xl" />
            <div className="h-10 bg-slate-50 rounded-xl" />
          </div>

          {/* Skeleton Footer Bar */}
          <div className="flex justify-end gap-3 pt-4 animate-pulse">
            <div className="h-12 w-48 bg-slate-200 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !invoiceData) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-4">
        <div className="text-rose-600 font-bold text-sm">Error: {error || 'Invoice not found.'}</div>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="-mt-4 sm:-mt-8 -mx-4 sm:-mx-8 p-3 sm:p-6 pt-0 sm:pt-0 bg-slate-100 min-h-screen print:bg-white print:p-0 print:m-0 flex flex-col items-center">

      {/* ── Top Action Bar (hidden during print) ── */}
      <div className="w-full max-w-[800px] mb-3 sm:mb-4 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 sm:gap-0 bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm print:hidden">
        <button
          onClick={() => router.back()}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-[13px] flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Billing
        </button>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleShareWhatsApp}
            disabled={isSharingWhatsApp}
            className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-white font-semibold text-[13px] flex items-center justify-center gap-2 transition-all shadow-sm border-none ${
              isSharingWhatsApp 
                ? 'bg-emerald-400 cursor-not-allowed' 
                : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            {isSharingWhatsApp ? 'Preparing PDF...' : 'Share WhatsApp'}
          </button>
          <button
            onClick={handlePrint}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-[13px] flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            Print (Browser)
          </button>
          <button
            onClick={handleExportPDF}
            disabled={isGeneratingPDF}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-[13px] flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {isGeneratingPDF ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* ── Invoice Sheet (A4-styled) ── */}
      <div id="invoice-pdf-element" className="fee-receipt-sheet w-full max-w-[800px] border print:border-none shadow-lg print:shadow-none print:min-h-0 relative font-sans print:m-0 flex flex-col print:block" style={{ backgroundColor: '#ffffff', color: '#2d3748', borderColor: '#e2e8f0', colorScheme: 'light' }}>
        <PDFLayout
          schoolLogo={invoiceData.schoolLogo}
          schoolName={invoiceData.schoolName}
          schoolSubtitle={invoiceData.schoolSubtitle}
          reportTitle="Official Student Fee Receipt"
          documentType="receipt"
          metadata={[
            { label: 'Receipt No', value: invoiceData.invoiceNo },
            { label: 'Academic Year', value: invoiceData.academicYear },
            { label: 'Receipt Date', value: invoiceData.invoiceDate },
            { label: 'Admission Ref', value: invoiceData.admissionRef },
            { label: 'Student Name', value: invoiceData.studentName },
            { label: 'Class & Section', value: `${invoiceData.className} - ${invoiceData.sectionName}` },
            { label: 'Date of Birth', value: invoiceData.studentDob || '15 May 2012' },
            { label: 'Father Name', value: invoiceData.fatherName }
          ]}
          footerText="This is a computer generated fee receipt. No physical signature is required. For verification query, contact the accounting department."
        >
          {/* Main Content Area */}
          <div className="mt-4">

          {/* ── Fee Particulars Table ── */}
          <PDFTable
            items={invoiceData.items}
            columns={[
              {
                header: 'Sl. No',
                width: '12%',
                align: 'left',
                render: (_, idx) => <span>{idx + 1}</span>,
              },
              {
                header: 'Particulars Description',
                width: '58%',
                align: 'left',
                render: (item) => <span className="font-semibold">{item.particulars}</span>,
              },
              {
                header: 'Amount Paid',
                width: '30%',
                align: 'right',
                render: (item) => (
                  <span style={{ fontWeight: 700, color: item.amount < 0 ? '#16a34a' : '#0f172a' }}>
                    {item.amount < 0 ? '-' : ''}₹{Math.abs(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                ),
              },
            ]}
          />
        </div>

          {/* ── Grand Total & Remaining Balance Bar ── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem', breakInside: 'avoid', flexWrap: 'wrap' }}>
            <div style={{ backgroundColor: '#1a365d', color: '#ffffff', borderRadius: '0.5rem', padding: '0.85rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem', minWidth: '240px' }}>
              <span style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#cbd5e1' }}>Paid Amount</span>
              <span style={{ fontSize: '18px', fontWeight: 900, fontFamily: 'monospace', color: '#ffffff' }}>
                ₹{(invoiceData.paidAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div style={{ backgroundColor: (invoiceData.remainingBalance ?? 0) > 0 ? '#fff1f2' : '#f0fdf4', color: (invoiceData.remainingBalance ?? 0) > 0 ? '#9f1239' : '#166534', border: `1px solid ${(invoiceData.remainingBalance ?? 0) > 0 ? '#fecdd3' : '#bbf7d0'}`, borderRadius: '0.5rem', padding: '0.85rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem', minWidth: '240px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Remaining Balance</span>
              <span style={{ fontSize: '18px', fontWeight: 900, fontFamily: 'monospace' }}>
                ₹{(invoiceData.remainingBalance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </PDFLayout>
      </div>
    </div>
  );
}
