'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Printer, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';

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

  const handlePrint = () => {
    window.print();
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
        <button
          onClick={handlePrint}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#1a365d] hover:bg-[#2a4365] text-white font-semibold text-[13px] flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          Print / Save PDF
        </button>
      </div>

      {/* ── Invoice Sheet (A4-styled) ── */}
      <div className="fee-receipt-sheet w-full max-w-[800px] bg-white border border-slate-200 print:border-none shadow-lg print:shadow-none print:min-h-0 relative font-sans text-[#2d3748] print:m-0 flex flex-col print:block">

        {/* ── Header Block (responsive) ── */}
        <div className="receipt-header bg-[#1a365d] text-white border-b-[6px] border-[#ed8936] relative">
          {/* Mobile header: stacked logo + text */}
          <div className="flex items-center gap-4 p-4 sm:hidden">
            <div className="w-[72px] h-[72px] shrink-0 bg-white rounded-full border-2 border-white shadow-md p-1 flex items-center justify-center overflow-hidden">
              {invoiceData.schoolLogo ? (
                <img src={invoiceData.schoolLogo} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <svg className="w-[40px] h-[40px] stroke-[#1a365d] stroke-[2] fill-none" viewBox="0 0 24 24">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                  <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
                </svg>
              )}
            </div>
            <div>
              <h1 className="text-[16px] font-black uppercase tracking-tight leading-tight">
                {invoiceData.schoolName}
              </h1>
              <p className="text-[11px] text-slate-300 font-semibold italic mt-0.5">
                {invoiceData.schoolSubtitle}
              </p>
            </div>
          </div>

          {/* Desktop header: original fixed layout */}
          <div className="hidden sm:flex items-center justify-between h-[140px] p-8 relative">
            <div className="pl-[120px] space-y-1">
              <h1 className="text-[24px] font-black uppercase tracking-tight leading-tight">
                {invoiceData.schoolName}
              </h1>
              <p className="text-[12px] text-slate-300 font-semibold italic">
                {invoiceData.schoolSubtitle}
              </p>
            </div>
            <div className="absolute top-[20px] left-[24px] w-[100px] h-[100px] bg-white rounded-full border-2 border-white shadow-md p-1.5 flex items-center justify-center overflow-hidden">
              {invoiceData.schoolLogo ? (
                <img src={invoiceData.schoolLogo} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <svg className="w-[60px] h-[60px] stroke-[#1a365d] stroke-[2] fill-none" viewBox="0 0 24 24">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                  <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* ── Receipt Body ── */}
        <div className="p-4 sm:p-10 space-y-5 sm:space-y-8 flex-1">

          {/* Title */}
          <div className="text-center">
            <h2 className="text-[16px] sm:text-[20px] font-black uppercase tracking-widest text-[#1a365d]">
              Fee Receipt
            </h2>
          </div>

          {/* ── Metadata: Responsive Grid ── */}
          <div className="border-b border-slate-200 pb-4">
            {/* Mobile: stacked grid 2-col */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:hidden text-[12px]">
              <div>
                <span className="font-bold text-slate-500 block text-[10px] uppercase tracking-wide">Receipt No</span>
                <span className="font-bold text-slate-800 font-mono">{invoiceData.invoiceNo}</span>
              </div>
              <div>
                <span className="font-bold text-slate-500 block text-[10px] uppercase tracking-wide">Academic Year</span>
                <span className="font-bold text-slate-800">{invoiceData.academicYear}</span>
              </div>
              <div>
                <span className="font-bold text-slate-500 block text-[10px] uppercase tracking-wide">Receipt Date</span>
                <span className="font-medium text-slate-800">{invoiceData.invoiceDate}</span>
              </div>
              <div>
                <span className="font-bold text-slate-500 block text-[10px] uppercase tracking-wide">Admission Ref</span>
                <span className="font-mono text-slate-800 text-[11px] break-words">{invoiceData.admissionRef}</span>
              </div>
            </div>

            {/* Desktop: original 2-column table */}
            <table className="hidden sm:table w-full text-[13px]">
              <tbody>
                <tr>
                  <td className="py-1">
                    <span className="font-bold text-slate-500">Receipt No:</span>
                    <span className="ml-2 font-bold text-slate-800 font-mono">{invoiceData.invoiceNo}</span>
                  </td>
                  <td className="py-1 text-right">
                    <span className="font-bold text-slate-500">Academic Year:</span>
                    <span className="ml-2 font-bold text-slate-800">{invoiceData.academicYear}</span>
                  </td>
                </tr>
                <tr>
                  <td className="py-1">
                    <span className="font-bold text-slate-500">Receipt Date:</span>
                    <span className="ml-2 font-medium text-slate-800">{invoiceData.invoiceDate}</span>
                  </td>
                  <td className="py-1 text-right">
                    <span className="font-bold text-slate-500">Admission Ref:</span>
                    <span className="ml-2 font-mono text-slate-800">{invoiceData.admissionRef}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── Student Details Card ── */}
          <div className="student-details-card bg-[#f7fafc] border border-[#e2e8f0] border-l-[5px] border-l-[#1a365d] p-3 sm:p-6 rounded-lg">
            {/* Mobile: vertical stacked layout */}
            <div className="sm:hidden space-y-3 text-[12px]">
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Student Name</div>
                <div className="text-[15px] text-[#1a365d] font-bold mt-0.5">{invoiceData.studentName}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Class & Section</div>
                  <div className="text-[13px] text-[#1a365d] font-bold mt-0.5">{invoiceData.className} - {invoiceData.sectionName}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Date of Birth</div>
                  <div className="text-[12px] text-slate-800 font-medium mt-0.5">{invoiceData.studentDob || '15 May 2012'}</div>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Parent Details</div>
                <div className="text-slate-700 mt-1 leading-relaxed">
                  Father: <span className="font-semibold text-slate-800">{invoiceData.fatherName}</span><br />
                  Mother: <span className="font-semibold text-slate-800">{invoiceData.motherName}</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mailing Address</div>
                <div className="text-slate-800 font-semibold leading-relaxed mt-1 text-[11px]">
                  {invoiceData.addressVillage || 'Plot No. 12, Vikas Nagar,'}<br />
                  New Delhi - 110009, Delhi, India.
                </div>
              </div>
            </div>

            {/* Desktop: original 3-column table */}
            <table className="hidden sm:table w-full text-[13px] border-collapse">
              <tbody>
                <tr>
                  <td className="w-[35%] valign-top space-y-4">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Student Name</div>
                      <div className="text-[15px] text-[#1a365d] font-bold mt-0.5">{invoiceData.studentName}</div>
                    </div>
                    <div className="pt-2">
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Parent Details</div>
                      <div className="text-slate-700 mt-1 leading-relaxed">
                        Father's Name: <span className="font-semibold text-slate-800">{invoiceData.fatherName}</span><br />
                        Mother's Name: <span className="font-semibold text-slate-800">{invoiceData.motherName}</span>
                      </div>
                    </div>
                  </td>
                  <td className="w-[30%] valign-top space-y-4 px-4">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Class &amp; Section</div>
                      <div className="text-[14px] text-[#1a365d] font-bold mt-0.5">{invoiceData.className} - {invoiceData.sectionName}</div>
                    </div>
                    <div className="pt-2">
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Date of Birth</div>
                      <div className="text-[13px] text-slate-800 font-medium mt-0.5">{invoiceData.studentDob || '15 May 2012'}</div>
                    </div>
                  </td>
                  <td className="w-[35%] valign-top space-y-2">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mailing Address</div>
                    <div className="text-slate-850 font-semibold leading-relaxed mt-1 text-[12px]">
                      {invoiceData.addressVillage || 'Plot No. 12, Vikas Nagar,'}<br />
                      New Delhi - 110009,<br />
                      Delhi, India.
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

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

        {/* ── Footer: Grand Total ── */}
        <div className="p-4 sm:p-10 border-t border-slate-100 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div className="text-[11px] text-slate-400 font-semibold leading-relaxed text-center sm:text-left max-w-sm">
            This is a computer generated fee receipt. No physical signature is required. For verification query, contact the accounting department.
          </div>

          <div className="total-badge bg-[#1a365d] text-white rounded-lg px-5 sm:px-8 py-4 flex items-center justify-between gap-4 sm:gap-8 sm:shrink-0 sm:min-w-[280px]">
            <span className="text-[12px] font-medium uppercase tracking-wider text-slate-300">Grand Total Paid</span>
            <span className="text-[18px] sm:text-[20px] font-black font-mono">
              ₹{invoiceData.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
