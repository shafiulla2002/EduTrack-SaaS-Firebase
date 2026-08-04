'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Printer, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { PDFService } from '@/lib/pdf';
import { PDFLayout } from '@/components/PDFLayout';
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
      <div id="invoice-pdf-element" className="fee-receipt-sheet w-full max-w-[800px] bg-white border border-slate-200 print:border-none shadow-lg print:shadow-none print:min-h-0 relative font-sans text-[#2d3748] print:m-0 flex flex-col print:block">
        <PDFLayout
          schoolLogo={invoiceData.schoolLogo}
          schoolName={invoiceData.schoolName}
          schoolSubtitle={invoiceData.schoolSubtitle}
          reportTitle="Official Student Fee Receipt"
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
          {/* Mobile: card list */}
          <div className="sm:hidden space-y-1.5">
            <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 bg-[#ebf8ff] text-[#1a365d] text-[10px] font-bold uppercase tracking-wider border-b-2 border-slate-300 px-3 py-2">
              <span>#</span>
              <span>Particulars</span>
              <span className="text-right">Amount</span>
            </div>
            {invoiceData.items.map((item, index) => (
              <div key={index} className="grid grid-cols-[auto_1fr_auto] gap-x-3 items-baseline px-3 py-2.5 border-b border-slate-100 text-[12px]">
                <span className="text-slate-400 font-medium w-5">{index + 1}</span>
                <span className="font-semibold text-slate-800">{item.particulars}</span>
                <span className={`font-bold text-right whitespace-nowrap ${item.amount < 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                  {item.amount < 0 ? '-' : ''}₹{Math.abs(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>

          {/* Desktop: original table */}
          <table className="hidden sm:table w-full border-collapse">
            <thead>
              <tr className="bg-[#ebf8ff] text-[#1a365d] text-[11px] font-bold uppercase tracking-wider border-b-2 border-slate-350">
                <th className="px-5 py-3 text-left w-[12%]">Sl. No</th>
                <th className="px-5 py-3 text-left w-[58%]">Particulars Description</th>
                <th className="px-5 py-3 text-right w-[30%]">Amount Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[13px]">
              {invoiceData.items.map((item, index) => (
                <tr key={index} className="hover:bg-slate-50/50">
                  <td className="px-5 py-4 text-slate-500 font-medium">{index + 1}</td>
                  <td className="px-5 py-4 font-semibold text-slate-800">{item.particulars}</td>
                  <td className={`px-5 py-4 text-right font-bold ${item.amount < 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {item.amount < 0 ? '-' : ''}₹{Math.abs(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

          {/* ── Grand Total ── */}
          <div className="flex justify-end mt-4 break-inside-avoid">
            <div className="total-badge bg-[#1a365d] text-white rounded-lg px-8 py-4 flex items-center justify-between gap-8 min-w-[280px]">
              <span className="text-[12px] font-medium uppercase tracking-wider text-slate-300">Grand Total Paid</span>
              <span className="text-[18px] sm:text-[20px] font-black font-mono text-white">
                ₹{invoiceData.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </PDFLayout>
      </div>
    </div>
  );
}
