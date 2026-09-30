'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  X,
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Clock,
  Building,
  UserCheck,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';

interface TeacherQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAttendanceSuccess?: (data: any) => void;
}

export default function TeacherQrScannerModal({
  isOpen,
  onClose,
  onAttendanceSuccess,
}: TeacherQrScannerModalProps) {
  const [scannerState, setScannerState] = useState<'IDLE' | 'SCANNING' | 'VALIDATING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [errorMessage, setErrorMessage] = useState('');
  const [successData, setSuccessData] = useState<any>(null);
  const [locationStatus, setLocationStatus] = useState<string>('Requesting location...');
  const [coords, setCoords] = useState<{ lat?: number; lng?: number }>({});
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);

  // Request Geolocation early when modal opens
  useEffect(() => {
    if (!isOpen) {
      cleanupScanner();
      setScannerState('IDLE');
      setErrorMessage('');
      setSuccessData(null);
      return;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setLocationStatus('Location verified');
        },
        (err) => {
          console.warn('Geolocation capture:', err.message);
          setLocationStatus('Location optional/denied');
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 },
      );
    } else {
      setLocationStatus('Geolocation unsupported');
    }

    startScanner();

    return () => {
      cleanupScanner();
    };
  }, [isOpen]);

  const cleanupScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (isScanningRef.current) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (e) {
        // ignore cleanup error
      } finally {
        html5QrCodeRef.current = null;
        isScanningRef.current = false;
      }
    }
  };

  const startScanner = async () => {
    setScannerState('SCANNING');
    setErrorMessage('');

    // Wait for DOM node to be present
    await new Promise((resolve) => setTimeout(resolve, 300));
    const container = document.getElementById('qr-reader-container');
    if (!container) return;

    try {
      await cleanupScanner();

      const html5QrCode = new Html5Qrcode('qr-reader-container');
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        async (decodedText) => {
          if (!isScanningRef.current) return;
          isScanningRef.current = false;

          // Stop camera stream immediately upon detection
          try {
            await html5QrCode.stop();
          } catch {}

          handleQrScanned(decodedText);
        },
        (errorMessage) => {
          // Frame decode pass (silent)
        },
      );

      isScanningRef.current = true;
    } catch (err: any) {
      console.error('Camera start error:', err);
      setScannerState('ERROR');
      if (err.name === 'NotAllowedError' || String(err).includes('Permission')) {
        setErrorMessage('Camera permission is required to scan the attendance QR code.');
      } else {
        setErrorMessage('Unable to start camera. Please check your camera settings or try on mobile.');
      }
    }
  };

  const handleQrScanned = async (scannedText: string) => {
    setScannerState('VALIDATING');
    setErrorMessage('');

    try {
      const payload: any = {
        token: scannedText,
        scanSource: 'IN_APP_SCANNER',
      };

      if (coords.lat != null && coords.lng != null) {
        payload.latitude = coords.lat;
        payload.longitude = coords.lng;
      }

      const response = await api.post('/teacher-attendance/scan', payload);
      const resData = response.data;

      if (resData.success) {
        setSuccessData(resData);
        setScannerState('SUCCESS');
        if (onAttendanceSuccess) {
          onAttendanceSuccess(resData);
        }
      } else {
        setScannerState('ERROR');
        setErrorMessage(resData.message || 'Attendance verification failed.');
      }
    } catch (err: any) {
      console.error('Scan API error:', err);
      setScannerState('ERROR');
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Unable to connect to the server. Please try again.';
      setErrorMessage(msg);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#2E5BFF] flex items-center justify-center font-bold">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-800">Scan Attendance QR</h3>
              <p className="text-[11px] text-slate-400 font-medium">CS EduTrack Teacher Portal</p>
            </div>
          </div>
          <button
            onClick={() => {
              cleanupScanner();
              onClose();
            }}
            className="w-8 h-8 rounded-xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex flex-col items-center justify-center overflow-y-auto">
          {scannerState === 'SCANNING' && (
            <div className="w-full flex flex-col items-center">
              {/* Scanner Viewfinder Box */}
              <div className="relative w-full max-w-[280px] aspect-square rounded-2xl overflow-hidden bg-black shadow-inner border-2 border-dashed border-blue-400">
                <div id="qr-reader-container" className="w-full h-full object-cover"></div>
                {/* Visual Target Reticle */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  <div className="w-48 h-48 border-2 border-[#2E5BFF] rounded-xl relative shadow-[0_0_15px_rgba(46,91,255,0.4)] animate-pulse">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-[#2E5BFF] -mt-1 -ml-1"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-[#2E5BFF] -mt-1 -mr-1"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-[#2E5BFF] -mb-1 -ml-1"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-[#2E5BFF] -mb-1 -mr-1"></div>
                  </div>
                </div>
              </div>

              <div className="mt-4 text-center">
                <p className="text-xs font-semibold text-slate-700">
                  Position the school attendance QR inside the frame
                </p>
                <div className="flex items-center justify-center gap-1.5 mt-2 text-[11px] text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-blue-500" />
                  <span>{locationStatus}</span>
                </div>
              </div>
            </div>
          )}

          {scannerState === 'VALIDATING' && (
            <div className="py-12 flex flex-col items-center text-center gap-4 animate-in fade-in zoom-in-95">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2E5BFF]">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-800">Verifying QR Code...</h4>
                <p className="text-xs text-slate-400 mt-1 font-medium">
                  Validating school tenant security & recording check-in...
                </p>
              </div>
            </div>
          )}

          {scannerState === 'SUCCESS' && successData && (
            <div className="py-4 w-full flex flex-col items-center text-center gap-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shadow-lg shadow-emerald-500/15">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 ${
                    successData.attendance?.status === 'LATE'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {successData.attendance?.status || 'PRESENT'}
                </span>
                <h4 className="text-lg font-black text-slate-800">
                  {successData.alreadyMarked ? 'Attendance Already Marked' : 'Attendance Marked Successfully!'}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">{successData.message}</p>
              </div>

              {/* Attendance Receipt Box */}
              <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left space-y-2.5 text-xs text-slate-600">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                  <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-blue-500" /> Teacher
                  </span>
                  <span className="font-bold text-slate-800">{successData.attendance?.teacherName || 'Teacher'}</span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                  <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-blue-500" /> School
                  </span>
                  <span className="font-bold text-slate-800 truncate max-w-[200px]">
                    {successData.attendance?.schoolName || 'CS EduTrack'}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                  <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-500" /> Time & Date
                  </span>
                  <span className="font-mono font-bold text-slate-800">
                    {successData.attendance?.checkInTime
                      ? new Date(successData.attendance.checkInTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        }) +
                        ' • ' +
                        new Date(successData.attendance.checkInTime).toLocaleDateString()
                      : successData.attendance?.date || 'Today'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Validation
                  </span>
                  <span className="font-bold text-emerald-600">Verified via Secure QR</span>
                </div>
              </div>

              <button
                onClick={() => {
                  cleanupScanner();
                  onClose();
                }}
                className="w-full py-3 bg-[#2E5BFF] hover:bg-blue-600 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-blue-500/20 cursor-pointer"
              >
                Go to Dashboard
              </button>
            </div>
          )}

          {scannerState === 'ERROR' && (
            <div className="py-6 w-full flex flex-col items-center text-center gap-4 animate-in fade-in zoom-in-95">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
                <AlertCircle className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-base font-bold text-slate-800">Scan Failed</h4>
                <p className="text-xs text-rose-600 mt-1 max-w-xs leading-relaxed font-medium">
                  {errorMessage || 'Unable to verify attendance QR.'}
                </p>
              </div>

              <div className="flex gap-2 w-full mt-2">
                <button
                  onClick={startScanner}
                  className="flex-1 py-2.5 bg-[#2E5BFF] hover:bg-blue-600 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Try Again
                </button>
                <button
                  onClick={() => {
                    cleanupScanner();
                    onClose();
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
