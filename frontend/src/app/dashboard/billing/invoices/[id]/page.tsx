'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Printer, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { PDFService } from '@/lib/pdf';
import { PDFLayout } from '@/components/PDFLayout';
import { PDFTable } from '@/components/PDFTable';
import { Download } from 'lucide-react';

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
  items: { particulars: string; amount: number }[];
}

export default function InvoicePrintPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [invoiceData, setInvoiceData] = useState<InvoicePDFData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvoicePDF = async () => {
      try {
        setIsLoading(true);
        const res = await api.get(`/billing/invoices/${id}/pdf`);
        setInvoiceData(res.data);
      } catch (err: any) {
        console.error('Failed to load invoice details for PDF rendering', err);
        setError(err.response?.data?.message || err.message || 'Failed to fetch invoice details.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchInvoicePDF();
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center font-medium text-xs text-slate-400">
        Loading printable invoice receipt data...
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
    <div className="min-h-screen bg-slate-100 print:bg-white print:p-0 p-3 sm:p-6 flex flex-col items-center">

      {/* ── Top Action Bar (hidden during print) ── */}
      <div className="w-full max-w-[800px] mb-4 sm:mb-6 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 sm:gap-0 bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm print:hidden">
        <button
          onClick={() => router.back()}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-[13px] flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Billing
        </button>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
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

          {/* ── Fee Parti          {/* ── Fee Particulars Table ── */}
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

          {/* ── Grand Total ── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', breakInside: 'avoid' }}>
            <div style={{ backgroundColor: '#1a365d', color: '#ffffff', borderRadius: '0.5rem', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2rem', minWidth: '280px' }}>
              <span style={{ fontSize: '12px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#cbd5e1' }}>Grand Total Paid</span>
              <span style={{ fontSize: '20px', fontWeight: 900, fontFamily: 'monospace', color: '#ffffff' }}>
                ₹{invoiceData.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </PDFLayout>
      </div>
    </div>
  );
}
