'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  ShieldCheck, Smartphone, CheckCircle2, Copy, Check, 
  ExternalLink, ArrowRight, Building2, User, BookOpen, 
  AlertCircle, RefreshCw, QrCode, MessageCircle
} from 'lucide-react';

function PaymentPageContent() {
  const searchParams = useSearchParams();

  // Query parameters passed from WhatsApp link
  const pa = searchParams.get('pa') || 'gpay-vikas-edu@okaxis'; // UPI ID
  const pn = searchParams.get('pn') || 'CS EduTrack Academy'; // Payee name
  const am = searchParams.get('am') || '0'; // Amount
  const student = searchParams.get('student') || 'Student'; // Student name
  const roll = searchParams.get('roll') || ''; // Roll number
  const className = searchParams.get('class') || ''; // Class & section
  const particulars = searchParams.get('particulars') || 'School Tuition Fees';
  const appParam = searchParams.get('app') || 'phonepe';
  const customTn = searchParams.get('tn');

  const parsedAmount = parseFloat(am) || 0;
  const formattedAmount = parsedAmount.toLocaleString('en-IN');
  const transactionNote = customTn || `Fee: ${student}${className ? ` (${className})` : ''}`;

  // UPI Deep Links
  const phonepeUrl = `phonepe://pay?pa=${encodeURIComponent(pa)}&pn=${encodeURIComponent(pn)}&am=${am}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;
  const gpayUrl = `gpay://upi/pay?pa=${encodeURIComponent(pa)}&pn=${encodeURIComponent(pn)}&am=${am}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;
  const upiUrl = `upi://pay?pa=${encodeURIComponent(pa)}&pn=${encodeURIComponent(pn)}&am=${am}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;
  const paytmUrl = `paytmmp://pay?pa=${encodeURIComponent(pa)}&pn=${encodeURIComponent(pn)}&am=${am}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;

  // QR Code URL
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(upiUrl)}`;

  const [copiedUpi, setCopiedUpi] = useState(false);
  const [autoRedirectAttempted, setAutoRedirectAttempted] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(2);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [utrNumber, setUtrNumber] = useState('');
  const [confirmedSuccess, setConfirmedSuccess] = useState(false);

  // Trigger auto-redirection to PhonePe on mobile devices on page load
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile || parsedAmount <= 0) {
      setAutoRedirectAttempted(true);
      return;
    }

    const timer = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setAutoRedirectAttempted(true);
          // Navigate to PhonePe
          try {
            if (appParam === 'gpay') {
              window.location.href = gpayUrl;
            } else {
              window.location.href = phonepeUrl;
            }
          } catch (e) {
            console.warn('Auto navigation to UPI app failed:', e);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [appParam, phonepeUrl, gpayUrl, parsedAmount]);

  const handlePayWithPhonePe = () => {
    try {
      window.location.href = phonepeUrl;
      // Fallback to standard UPI intent if PhonePe does not catch
      setTimeout(() => {
        window.location.href = upiUrl;
      }, 1500);
    } catch {
      window.location.href = upiUrl;
    }
  };

  const handlePayWithGPay = () => {
    try {
      window.location.href = gpayUrl;
      setTimeout(() => {
        window.location.href = upiUrl;
      }, 1500);
    } catch {
      window.location.href = upiUrl;
    }
  };

  const handlePayWithAnyUpi = () => {
    window.location.href = upiUrl;
  };

  const handleCopyUpi = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(pa);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2500);
    }
  };

  const handleNotifySchool = () => {
    const confirmationText = 
      `*Fee Payment Confirmation*\n\n` +
      `Dear Admin,\n` +
      `I have completed the fee payment for *${student}* (${className ? `Class: ${className}` : ''}).\n\n` +
      `💰 *Amount Paid:* ₹${formattedAmount}\n` +
      (utrNumber ? `🔢 *UTR / Transaction Ref:* ${utrNumber}\n` : '') +
      `📝 *Particulars:* ${particulars}\n\n` +
      `Please acknowledge receipt.\nThank you!`;

    const waUrl = `https://wa.me/?text=${encodeURIComponent(confirmationText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    setConfirmedSuccess(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-850 to-slate-950 text-slate-100 flex flex-col justify-between py-6 px-4 sm:px-6">
      <div className="max-w-md w-full mx-auto space-y-5">
        
        {/* Top Header & Trust Badge */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>256-Bit Encrypted Secure School Payment</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            <Building2 className="w-6 h-6 text-blue-400" />
            <span>{pn}</span>
          </h1>
          <p className="text-xs text-slate-400">
            Official Online Tuition Fee Collection Portal
          </p>
        </div>

        {/* Auto Redirect Banner (on mobile countdown) */}
        {!autoRedirectAttempted && redirectCountdown > 0 && parsedAmount > 0 && (
          <div className="p-3.5 rounded-xl bg-purple-950/60 border border-purple-500/30 text-purple-200 text-xs flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
              <span>Opening PhonePe app in <strong>{redirectCountdown}s</strong>...</span>
            </div>
            <button
              onClick={handlePayWithPhonePe}
              className="text-xs font-bold text-white bg-purple-600 px-2.5 py-1 rounded-lg"
            >
              Open Now
            </button>
          </div>
        )}

        {/* Main Fee Card */}
        <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/80 rounded-2xl p-5 shadow-2xl shadow-black/40 space-y-5">
          
          {/* Student Info Bar */}
          <div className="flex items-center gap-3.5 pb-4 border-b border-slate-700/60">
            <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <User className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Student Fee Record</span>
              </div>
              <h2 className="text-base font-bold text-white truncate">{student}</h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                {roll && <span>Roll: <strong className="text-slate-200">{roll}</strong></span>}
                {roll && className && <span>•</span>}
                {className && <span>Class: <strong className="text-slate-200">{className}</strong></span>}
              </div>
            </div>
          </div>

          {/* Amount Due Card */}
          <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl p-4 text-center space-y-1">
            <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wider">
              Allotted Payment Amount
            </span>
            <div className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
              ₹{formattedAmount}
            </div>
            <div className="text-[11px] text-slate-400 font-medium pt-1 line-clamp-2">
              Particulars: <span className="text-slate-300">{particulars}</span>
            </div>
          </div>

          {/* Action Buttons: PhonePe is Primary */}
          <div className="space-y-3 pt-1">
            
            {/* Primary PhonePe Button */}
            <button
              type="button"
              onClick={handlePayWithPhonePe}
              className="w-full py-3.5 px-4 rounded-xl bg-[#5f259f] hover:bg-[#501c87] active:scale-[0.99] text-white font-extrabold text-sm shadow-lg shadow-purple-900/40 flex items-center justify-center gap-2.5 transition-all cursor-pointer border border-purple-400/30"
            >
              <Smartphone className="w-5 h-5" />
              <span>Pay ₹{formattedAmount} with PhonePe</span>
              <ArrowRight className="w-4 h-4 ml-auto opacity-70" />
            </button>

            {/* Google Pay Button */}
            <button
              type="button"
              onClick={handlePayWithGPay}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-750 active:scale-[0.99] text-white font-bold text-xs border border-slate-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span className="text-base">⚡</span>
              <span>Pay via Google Pay</span>
            </button>

            {/* Any UPI App Button */}
            <button
              type="button"
              onClick={handlePayWithAnyUpi}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-750 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700/60 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span className="text-sm">💳</span>
              <span>Pay with Paytm, BHIM, or Other UPI Apps</span>
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 text-slate-500 text-xs py-1">
            <div className="flex-1 h-px bg-slate-700/60"></div>
            <span className="uppercase text-[10px] tracking-wider font-bold">Or Scan Standee QR</span>
            <div className="flex-1 h-px bg-slate-700/60"></div>
          </div>

          {/* QR Code Section for Desktop / Secondary device */}
          <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-4 flex flex-col items-center text-center space-y-3">
            <div className="w-44 h-44 bg-white p-2 rounded-xl shadow-md flex items-center justify-center overflow-hidden">
              <img 
                src={qrCodeUrl} 
                alt="PhonePe UPI QR Code" 
                className="w-40 h-40 object-contain"
              />
            </div>
            
            <div className="space-y-1 w-full">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">
                Merchant UPI ID
              </span>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-slate-200">
                <span className="truncate max-w-[220px]">{pa}</span>
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  className="text-blue-400 hover:text-blue-300 p-1 cursor-pointer"
                  title="Copy UPI ID"
                >
                  {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Open PhonePe or any camera UPI scanner to pay directly from your bank.
            </p>
          </div>

          {/* Instructions Box */}
          <div className="bg-slate-900/50 border border-slate-750 rounded-xl p-3.5 space-y-2 text-[11px] text-slate-400">
            <h4 className="font-bold text-slate-300 flex items-center gap-1.5 text-xs">
              <AlertCircle className="w-3.5 h-3.5 text-blue-400" />
              <span>How it works:</span>
            </h4>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Tap <strong>Pay with PhonePe</strong> to launch your installed UPI app.</li>
              <li>Confirm the allotted amount <strong>₹{formattedAmount}</strong> and school payee details.</li>
              <li>Enter your secure UPI PIN to finalize payment.</li>
              <li>Save a screenshot or reference number once completed.</li>
            </ol>
          </div>

          {/* Post Payment Confirmation Action */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 underline underline-offset-4 cursor-pointer"
            >
              Already paid? Submit UTR or Notify School
            </button>
          </div>

        </div>

        {/* Modal: Confirm Payment Submission */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-850 border border-slate-700 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-sm">Payment Confirmation</h3>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="text-slate-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              {confirmedSuccess ? (
                <div className="text-center py-4 space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                  <h4 className="font-bold text-white text-sm">Confirmation Shared!</h4>
                  <p className="text-xs text-slate-400">
                    The school administration has been notified. They will verify the transaction and generate your official fee receipt.
                  </p>
                  <button
                    onClick={() => {
                      setShowConfirmModal(false);
                      setConfirmedSuccess(false);
                    }}
                    className="w-full py-2 bg-slate-700 text-white rounded-xl text-xs font-bold"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-300">
                    If you completed the payment on PhonePe, enter your 12-digit UPI Reference / UTR Number to confirm:
                  </p>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      UPI Ref / UTR Number (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 429381749281"
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-blue-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleNotifySchool}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-900/30"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Send Confirmation to School via WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(false)}
                    className="w-full py-2 text-slate-400 hover:text-slate-200 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="text-center text-[10px] text-slate-500 space-y-1 py-2">
          <p>© {new Date().getFullYear()} CS EduTrack SaaS • All Rights Reserved</p>
          <p>Direct Bank Settlement via NPCI Unified Payments Interface (UPI)</p>
        </div>

      </div>
    </div>
  );
}

export default function PublicPaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-xs">
        <RefreshCw className="w-5 h-5 animate-spin text-blue-400 mr-2" />
        <span>Loading secure payment gateway...</span>
      </div>
    }>
      <PaymentPageContent />
    </Suspense>
  );
}
