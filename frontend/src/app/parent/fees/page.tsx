'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParent } from '../ParentContext';
import { api } from '@/lib/api';
import { dispatchSchoolSetupUpdated } from '@/lib/events';
import { formatDateDDMMYYYY } from '@/lib/date';
import {
  CreditCard,
  CheckCircle,
  ShieldCheck,
  HelpCircle,
  X,
  ArrowRight,
  Printer,
  Download,
  Eye,
  History,
  CheckSquare,
  Square,
  Building2,
  AlertCircle,
  IndianRupee,
} from 'lucide-react';

// ─── Helper ────────────────────────────────────────────────────────────────────
function inr(n: number) {
  return n.toLocaleString('en-IN');
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function FeesPage() {
  const { selectedChild } = useParent();
  const [feesData, setFeesData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  /**
   * itemPayAmounts: Map<itemId, customAmount>
   * An item is "selected" if and only if it has an entry in this map.
   * The value is the amount the parent wants to pay for that item.
   */
  const [itemPayAmounts, setItemPayAmounts] = useState<Map<string, number>>(new Map());

  /** Per-item validation error messages */
  const [itemErrors, setItemErrors] = useState<Map<string, string>>(new Map());

  // Pay modal
  const [activeInvoice, setActiveInvoice] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'GPAY' | 'PHONEPE' | 'BANK'>('GPAY');
  const [payLoading, setPayLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Receipt viewer
  const [viewingReceipt, setViewingReceipt] = useState<any>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string>('');

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchFees = useCallback(async (childId: string) => {
    try {
      setLoading(true);
      const res = await api.get(`/parent-portal/children/${childId}/fees`);
      setFeesData(res.data);
      setItemPayAmounts(new Map());
      setItemErrors(new Map());
    } catch (err) {
      console.error('Failed to fetch fees details:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedChild) fetchFees(selectedChild.id);
  }, [selectedChild, fetchFees]);

  useEffect(() => {
    const handleChildChange = (e: any) => fetchFees(e.detail);
    window.addEventListener('parentChildChanged', handleChildChange);
    return () => window.removeEventListener('parentChildChanged', handleChildChange);
  }, [fetchFees]);

  // ── Item selection helpers ────────────────────────────────────────────────
  const toggleItem = (item: any) => {
    if (!item.isSelectable) return;

    const next = new Map(itemPayAmounts);
    const errNext = new Map(itemErrors);

    if (next.has(item.id)) {
      next.delete(item.id);
      errNext.delete(item.id);
    } else {
      // Seed with remaining balance
      next.set(item.id, item.balance ?? item.amount);
    }
    setItemPayAmounts(next);
    setItemErrors(errNext);
  };

  const handleSelectAll = (items: any[]) => {
    const next = new Map(itemPayAmounts);
    const errNext = new Map(itemErrors);
    for (const item of items) {
      if (item.isSelectable && !next.has(item.id)) {
        next.set(item.id, item.balance ?? item.amount);
        errNext.delete(item.id);
      }
    }
    setItemPayAmounts(next);
    setItemErrors(errNext);
  };

  const handleDeselectAll = () => {
    setItemPayAmounts(new Map());
    setItemErrors(new Map());
  };

  /** Update the editable amount for a specific item with inline validation */
  const handleAmountChange = (item: any, raw: string) => {
    const next = new Map(itemPayAmounts);
    const errNext = new Map(itemErrors);
    const balance = item.balance ?? item.amount;

    const parsed = parseFloat(raw);

    if (raw === '' || isNaN(parsed)) {
      errNext.set(item.id, 'Please enter a valid amount.');
      next.set(item.id, 0);
    } else if (parsed <= 0) {
      errNext.set(item.id, 'Amount must be greater than ₹0.');
      next.set(item.id, parsed);
    } else if (parsed > balance) {
      errNext.set(item.id, `Amount cannot exceed the balance of ₹${inr(balance)}.`);
      next.set(item.id, parsed);
    } else {
      errNext.delete(item.id);
      next.set(item.id, parsed);
    }

    setItemPayAmounts(next);
    setItemErrors(errNext);
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const invoices = feesData?.invoices || [];
  const paymentDetails = feesData?.paymentDetails;

  const unpaidInvoices = invoices.filter((inv: any) => inv.remainingBalance > 0);
  const paidInvoices = invoices.filter((inv: any) => inv.remainingBalance === 0);

  const activeUnpaidInv = unpaidInvoices[0];
  const allItems: any[] = activeUnpaidInv?.items || [];
  const selectableItems = allItems.filter((i: any) => i.isSelectable);

  const hasValidationErrors = Array.from(itemErrors.values()).some(e => !!e);

  // Running total from custom amounts (only for valid selected items)
  const selectedTotal = Array.from(itemPayAmounts.entries()).reduce((sum, [id, amt]) => {
    if (!itemErrors.has(id) && amt > 0) return sum + amt;
    return sum;
  }, 0);

  const selectedItemIds = new Set(itemPayAmounts.keys());

  // Build the list to display in modal
  const selectedItemsList = allItems.filter(
    (item: any) => itemPayAmounts.has(item.id) && !itemErrors.get(item.id),
  );

  const hasBankDetails = paymentDetails && (
    paymentDetails.bankName ||
    paymentDetails.bankAccountNo ||
    paymentDetails.bankIFSC ||
    paymentDetails.googlePayId ||
    paymentDetails.phonePeId ||
    paymentDetails.upiQrId
  );

  // ── Payment submit ────────────────────────────────────────────────────────
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChild || !activeInvoice || payLoading) return;

    if (selectedItemIds.size === 0) {
      setMessage('Please select at least one fee item to pay.');
      return;
    }

    if (hasValidationErrors) {
      setMessage('Please fix the amount errors before proceeding.');
      return;
    }

    // Build itemAmounts payload
    const itemAmounts = Array.from(itemPayAmounts.entries())
      .filter(([, amt]) => amt > 0)
      .map(([id, amount]) => ({ id, amount }));

    setPayLoading(true);
    setMessage('');
    try {
      const res = await api.post(
        `/parent-portal/children/${selectedChild.id}/invoices/${activeInvoice.id}/pay`,
        { paymentMethod, itemAmounts },
      );

      setMessage(res.data?.message || 'Payment processed successfully!');
      dispatchSchoolSetupUpdated();
      await fetchFees(selectedChild.id);

      setTimeout(() => {
        setActiveInvoice(null);
        setMessage('');
      }, 1800);
    } catch (err: any) {
      console.error('Payment processing failed:', err);
      setMessage(err.response?.data?.message || 'Payment failed. Please try again.');
    } finally {
      setPayLoading(false);
    }
  };

  const handleOpenPrintReceipt = async (inv: any) => {
    if (!selectedChild) return;
    try {
      setActionLoadingId(`${inv.id}-print`);
      const res = await api.get(`/parent-portal/children/${selectedChild.id}/invoices/${inv.id}/pdf/download`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);

      let iframe = document.getElementById('print-receipt-iframe') as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'print-receipt-iframe';
        iframe.style.position = 'fixed';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);
      }
      iframe.src = url;
      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      };
    } catch (err) {
      console.error('Failed to print receipt:', err);
      alert('Failed to open print dialog. Please try again.');
    } finally {
      setActionLoadingId('');
    }
  };

  const handleDownloadReceipt = async (inv: any) => {
    if (!selectedChild) return;
    try {
      setActionLoadingId(`${inv.id}-download`);
      const res = await api.get(`/parent-portal/children/${selectedChild.id}/invoices/${inv.id}/pdf/download`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;

      const studentName = selectedChild.name.replace(/\s+/g, '_');
      const invoiceNo = inv.invoiceNo || `INV-${inv.id.substring(0, 8).toUpperCase()}`;
      link.setAttribute('download', `SchoolFeeReceipt_${studentName}_${invoiceNo}.pdf`);

      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download receipt PDF:', err);
      alert('Failed to download receipt PDF. Please try again.');
    } finally {
      setActionLoadingId('');
    }
  };

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!selectedChild) {
    return (
      <div className="text-slate-500 text-sm text-center py-12">
        Please select a child to view fees and invoices.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-t-[#2E5BFF] border-r-[#2E5BFF] border-b-transparent border-l-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in relative">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          Billing Ledger: <span className="text-[#2E5BFF] font-extrabold">{selectedChild.name}</span>
        </h2>
        <p className="text-slate-500 text-xs mt-1 font-light">
          Select individual fee components to make partial or full online payments, view detailed statements, and access past receipts.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Main section ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Outstanding Fee Statements */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#2E5BFF]" />
                Outstanding Fee Statements
              </h3>

              {selectableItems.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => handleSelectAll(allItems)}
                    className="text-[#2E5BFF] hover:underline font-semibold text-[11px]"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    onClick={handleDeselectAll}
                    className="text-slate-400 hover:underline font-medium text-[11px]"
                  >
                    Deselect All
                  </button>
                </div>
              )}
            </div>

            {unpaidInvoices.length === 0 || allItems.length === 0 ? (
              <div className="bg-white border border-[#2E5BFF]/20 p-8 rounded-3xl text-center shadow-sm space-y-2">
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-xl font-bold">
                  🎉
                </div>
                <h4 className="text-base font-extrabold text-slate-800">All fee products have been paid successfully!</h4>
                <p className="text-xs text-slate-500 font-light max-w-md mx-auto">
                  There are no outstanding fee items remaining. All past payment receipts are stored securely in your Invoice History below.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {unpaidInvoices.map((inv: any) => (
                  <div
                    key={inv.id}
                    className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all space-y-4"
                  >
                    {/* Invoice header */}
                    <div className="flex justify-between items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <span className="px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border bg-rose-50 border-rose-100 text-rose-700">
                          {inv.status}
                        </span>
                        <h4 className="text-sm font-bold text-slate-700 mt-2 truncate">{inv.description}</h4>
                        <p className="text-[10px] text-slate-400 font-light mt-0.5">
                          Due date: {formatDateDDMMYYYY(inv.dueDate)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-slate-800">₹{inr(inv.remainingBalance)}</span>
                        <span className="text-[9px] text-slate-400 block font-medium mt-0.5">Outstanding Dues</span>
                      </div>
                    </div>

                    {/* Fee items with editable amount inputs */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-3">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                        Select Fee Components to Pay (Unpaid components only):
                      </span>

                      {inv.items.map((item: any) => {
                        const isPaid = !item.isSelectable || item.status === 'PAID';
                        const isPartial = item.status === 'PARTIALLY_PAID';
                        const isChecked = itemPayAmounts.has(item.id);
                        const balance = item.balance ?? item.amount;
                        const paidAmt = item.paidAmount ?? 0;
                        const customAmt = itemPayAmounts.get(item.id);
                        const errMsg = itemErrors.get(item.id);

                        return (
                          <div key={item.id} className="space-y-1.5">
                            {/* Row: checkbox + name + status badge + (for paid items) amount */}
                            <div
                              onClick={() => toggleItem(item)}
                              className={`flex items-start justify-between p-3 rounded-xl border transition-all ${
                                isPaid
                                  ? 'bg-slate-50 border-slate-100 cursor-not-allowed opacity-60'
                                  : isChecked
                                    ? 'bg-blue-50/70 border-blue-200 cursor-pointer'
                                    : 'bg-white border-slate-200/60 hover:border-slate-300 cursor-pointer'
                              }`}
                            >
                              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                {/* Checkbox icon */}
                                {isPaid ? (
                                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                ) : isChecked ? (
                                  <CheckSquare className="w-4 h-4 text-[#2E5BFF] shrink-0 mt-0.5" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                                )}

                                <div className="flex-1 min-w-0">
                                  <span className={`text-xs font-semibold block ${isPaid ? 'text-slate-400' : 'text-slate-700'}`}>
                                    {item.name}
                                  </span>

                                  {/* Amount breakdown for all items */}
                                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                                    <span className="text-[10px] text-slate-400">
                                      Original: <strong className="text-slate-600">₹{inr(item.amount)}</strong>
                                    </span>
                                    {(paidAmt > 0 || isPaid) && (
                                      <span className="text-[10px] text-emerald-600">
                                        Paid: <strong>₹{inr(paidAmt)}</strong>
                                      </span>
                                    )}
                                    {!isPaid && (
                                      <span className="text-[10px] text-amber-600">
                                        Balance: <strong>₹{inr(balance)}</strong>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Status badge */}
                              <div className="shrink-0 ml-2">
                                {isPaid ? (
                                  <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-emerald-50 border border-emerald-100 text-emerald-700 whitespace-nowrap">
                                    ✅ PAID
                                  </span>
                                ) : isPartial ? (
                                  <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-amber-50 border border-amber-100 text-amber-700 whitespace-nowrap">
                                    ◑ PARTIAL
                                  </span>
                                ) : (
                                  <span className="text-xs font-bold text-slate-600">
                                    ₹{inr(balance)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Editable amount input – shown only when item is checked and unpaid */}
                            {isChecked && !isPaid && (
                              <div
                                className="ml-6 space-y-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  Payment Amount
                                </label>
                                <div className={`flex items-center gap-1.5 border rounded-xl px-3 py-2 bg-white transition-all ${
                                  errMsg
                                    ? 'border-rose-300 ring-1 ring-rose-200'
                                    : 'border-[#2E5BFF]/40 ring-1 ring-[#2E5BFF]/20'
                                }`}>
                                  <IndianRupee className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <input
                                    type="number"
                                    min={1}
                                    max={balance}
                                    step={1}
                                    value={customAmt !== undefined ? customAmt : balance}
                                    onChange={(e) => handleAmountChange(item, e.target.value)}
                                    className="flex-1 text-sm font-bold text-slate-800 outline-none bg-transparent min-w-0"
                                    placeholder={`Max ₹${inr(balance)}`}
                                  />
                                  <span className="text-[10px] text-slate-400 shrink-0">
                                    / ₹{inr(balance)}
                                  </span>
                                </div>
                                {errMsg && (
                                  <p className="text-[10px] text-rose-600 font-medium flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3 shrink-0" />
                                    {errMsg}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Running total + Pay button */}
                    <div className="border-t border-slate-100 pt-3.5 flex items-center justify-between">
                      <div className="text-xs">
                        <span className="text-slate-400 font-medium">
                          Selected ({selectedItemIds.size}/{selectableItems.length}):{' '}
                        </span>
                        <strong className="text-slate-800 font-bold">₹{inr(selectedTotal)}</strong>
                      </div>

                      <button
                        onClick={() => setActiveInvoice(inv)}
                        disabled={selectedItemIds.size === 0 || hasValidationErrors || selectedTotal === 0}
                        className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm flex items-center gap-1.5 ${
                          selectedItemIds.size > 0 && !hasValidationErrors && selectedTotal > 0
                            ? 'bg-[#2E5BFF] hover:bg-blue-600 text-white cursor-pointer'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <span>Pay Selected Fees (₹{inr(selectedTotal)})</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Invoice History */}
          <div className="space-y-4 pt-2">
            <h3 className="font-bold text-sm text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-600" />
              Invoice History &amp; Paid Receipts
            </h3>

            {paidInvoices.length === 0 ? (
              <div className="bg-white border border-slate-200 p-8 rounded-3xl text-center text-slate-400 shadow-sm text-xs">
                No past payment history or paid invoices found.
              </div>
            ) : (
              <div className="space-y-3.5">
                {paidInvoices.map((inv: any) => (
                  <div
                    key={inv.id}
                    className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm space-y-3 hover:border-slate-300 transition-all"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-emerald-50 border border-emerald-100 text-emerald-700">
                            PAID RECEIPT
                          </span>
                          <span className="text-xs font-bold text-slate-800 font-mono">{inv.invoiceNo}</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-700 mt-2">{inv.description}</h4>
                        <p className="text-[10px] text-slate-400 font-light mt-0.5">
                          Paid on {formatDateDDMMYYYY(inv.invoiceDate)} • Txn:{' '}
                          <code className="font-mono text-slate-600">{inv.transactionId}</code>
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-emerald-700">₹{inr(inv.totalAmount)}</span>
                        <span className="text-[10px] text-slate-400 block font-semibold mt-0.5">{inv.paymentMethod}</span>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setViewingReceipt(inv)}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                        <span>View Details</span>
                      </button>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenPrintReceipt(inv)}
                          disabled={!!actionLoadingId}
                          className="px-3 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {actionLoadingId === `${inv.id}-print` ? (
                            <div className="w-3.5 h-3.5 border-2 border-[#1a365d] border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <Printer className="w-3.5 h-3.5 text-slate-600" />
                          )}
                          <span>Print</span>
                        </button>
                        <button
                          onClick={() => handleDownloadReceipt(inv)}
                          disabled={!!actionLoadingId}
                          className="px-3 py-1.5 bg-[#1a365d] text-white hover:bg-[#2a4365] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                        >
                          {actionLoadingId === `${inv.id}-download` ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          <span>Download PDF</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── School Bank & UPI panel ───────────────────────────────────── */}
        <div className="space-y-4">
          <h3 className="font-bold text-sm text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            School Bank &amp; UPI
          </h3>

          <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-5">
            {!hasBankDetails ? (
              <div className="text-center py-6 space-y-2 text-slate-400">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                <p className="text-xs font-medium text-slate-600">School payment details are not configured.</p>
                <p className="text-[11px] font-light text-slate-400">Please contact the school administrator for direct bank details.</p>
              </div>
            ) : (
              <>
                {(paymentDetails.bankName || paymentDetails.bankAccountNo) && (
                  <div className="space-y-3.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Direct Bank Transfer</span>
                    <div className="space-y-2.5 text-xs text-slate-600">
                      {paymentDetails.name && (
                        <div>
                          <span className="text-slate-400 block text-[10px]">Beneficiary Name</span>
                          <strong className="text-slate-700">{paymentDetails.name}</strong>
                        </div>
                      )}
                      {paymentDetails.bankName && (
                        <div>
                          <span className="text-slate-400 block text-[10px]">Bank Name</span>
                          <strong className="text-slate-700">{paymentDetails.bankName}</strong>
                        </div>
                      )}
                      {paymentDetails.bankIFSC && (
                        <div>
                          <span className="text-slate-400 block text-[10px]">IFSC Code</span>
                          <strong className="text-slate-700 font-mono">{paymentDetails.bankIFSC}</strong>
                        </div>
                      )}
                      {paymentDetails.bankAccountNo && (
                        <div>
                          <span className="text-slate-400 block text-[10px]">Account Number</span>
                          <strong className="text-slate-700 font-mono">{paymentDetails.bankAccountNo}</strong>
                        </div>
                      )}
                      {paymentDetails.bankBranch && (
                        <div>
                          <span className="text-slate-400 block text-[10px]">Branch Name</span>
                          <strong className="text-slate-700">{paymentDetails.bankBranch}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(paymentDetails.googlePayId || paymentDetails.phonePeId || paymentDetails.upiQrId) && (
                  <div className="border-t border-slate-100 pt-5 space-y-3.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">UPI Merchant Handles</span>
                    <div className="space-y-2.5 text-xs text-slate-600">
                      {paymentDetails.googlePayId && (
                        <div>
                          <span className="text-slate-400 block text-[10px]">Google Pay ID</span>
                          <strong className="text-slate-700 font-mono">{paymentDetails.googlePayId}</strong>
                        </div>
                      )}
                      {paymentDetails.phonePeId && (
                        <div>
                          <span className="text-slate-400 block text-[10px]">PhonePe ID</span>
                          <strong className="text-slate-700 font-mono">{paymentDetails.phonePeId}</strong>
                        </div>
                      )}
                      {paymentDetails.upiQrId && (
                        <div>
                          <span className="text-slate-400 block text-[10px]">UPI QR Handle</span>
                          <strong className="text-slate-700 font-mono">{paymentDetails.upiQrId}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Pay Checkout Modal ────────────────────────────────────────────── */}
      {activeInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-xl p-6 relative animate-scale-up space-y-5">
            <button
              onClick={() => { if (!payLoading) { setActiveInvoice(null); setMessage(''); } }}
              className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-base font-bold text-slate-800">Checkout Fee Payment</h3>
              <p className="text-xs text-slate-400 font-light mt-0.5">{activeInvoice.description}</p>
            </div>

            {message && (
              <div className={`p-3.5 border rounded-2xl text-xs font-semibold leading-relaxed flex items-center gap-2 ${
                message.toLowerCase().includes('success')
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                  : 'bg-rose-50 border-rose-100 text-rose-700'
              }`}>
                {message.toLowerCase().includes('success')
                  ? <ShieldCheck className="w-4 h-4 shrink-0" />
                  : <HelpCircle className="w-4 h-4 shrink-0" />}
                <span>{message}</span>
              </div>
            )}

            {/* Selected items summary with custom amounts */}
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Selected Components ({selectedItemsList.length})</span>
                <strong className="text-base font-black text-[#2E5BFF]">₹{inr(selectedTotal)}</strong>
              </div>
              <div className="text-[11px] text-slate-500 space-y-1 pt-1 border-t border-slate-200/60">
                {selectedItemsList.map((item: any) => {
                  const amt = itemPayAmounts.get(item.id) ?? 0;
                  const balance = item.balance ?? item.amount;
                  const isPartial = amt < balance;
                  return (
                    <div key={item.id} className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <span>• {item.name}</span>
                        {isPartial && (
                          <span className="ml-2 text-[9px] bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded-md font-bold">
                            PARTIAL
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-semibold">₹{inr(amt)}</span>
                        {isPartial && (
                          <span className="block text-[9px] text-slate-400">of ₹{inr(balance)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Select Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'GPAY', label: 'Google Pay', icon: '💳' },
                  { id: 'PHONEPE', label: 'PhonePe UPI', icon: '📱' },
                  { id: 'UPI', label: 'Any UPI App', icon: '⚡' },
                  { id: 'BANK', label: 'Net Banking', icon: '🏦' },
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      paymentMethod === m.id
                        ? 'border-[#2E5BFF] bg-blue-50/60 text-[#2E5BFF]'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <span>{m.icon}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handlePaymentSubmit} className="pt-2">
              <button
                type="submit"
                disabled={payLoading || selectedItemIds.size === 0 || hasValidationErrors || selectedTotal === 0}
                className="w-full py-3.5 rounded-2xl bg-[#2E5BFF] hover:bg-blue-600 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {payLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Processing Payment Gateway...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm &amp; Pay ₹{inr(selectedTotal)}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── View Receipt Modal ───────────────────────────────────────────── */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-xl p-6 relative animate-scale-up space-y-5">
            <button
              onClick={() => setViewingReceipt(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-1">
              <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100 inline-block">
                OFFICIAL PAYMENT RECEIPT
              </span>
              <h3 className="text-lg font-black text-slate-800">{feesData?.paymentDetails?.name || 'Cambridge International School'}</h3>
              <p className="text-xs text-slate-400 font-mono">Receipt No: {viewingReceipt.receiptNo}</p>
            </div>

            <div className="border-t border-b border-slate-100 py-3 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-400">Student Name:</span>
                <strong className="text-slate-800">{viewingReceipt.studentName}</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-400">Roll Number:</span>
                <strong className="text-slate-800">{viewingReceipt.rollNo}</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-400">Class &amp; Section:</span>
                <strong className="text-slate-800">{viewingReceipt.className} - {viewingReceipt.sectionName}</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-400">Transaction ID:</span>
                <strong className="text-slate-800 font-mono">{viewingReceipt.transactionId}</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="text-slate-400">Payment Date:</span>
                <strong className="text-slate-800">{formatDateDDMMYYYY(viewingReceipt.invoiceDate)}</strong>
              </div>
            </div>

            <div className="space-y-1.5 bg-slate-50 border border-slate-100 p-3 rounded-2xl text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Fee Particulars Paid</span>
              {viewingReceipt.items.map((item: any) => (
                <div key={item.id} className="flex justify-between text-slate-600 font-medium">
                  <span>{item.name}</span>
                  <span>₹{inr(item.amount)}</span>
                </div>
              ))}
              <div className="border-t border-slate-200 pt-2 flex justify-between font-black text-sm text-emerald-800">
                <span>Total Paid:</span>
                <span>₹{inr(viewingReceipt.totalAmount)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => handleOpenPrintReceipt(viewingReceipt)}
                disabled={!!actionLoadingId}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {actionLoadingId === `${viewingReceipt.id}-print` ? (
                  <div className="w-3.5 h-3.5 border-2 border-[#1a365d] border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Printer className="w-3.5 h-3.5" />
                )}
                <span>Print Receipt</span>
              </button>
              <button
                onClick={() => handleDownloadReceipt(viewingReceipt)}
                disabled={!!actionLoadingId}
                className="px-4 py-2 bg-[#1a365d] hover:bg-[#2a4365] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {actionLoadingId === `${viewingReceipt.id}-download` ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Download PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
