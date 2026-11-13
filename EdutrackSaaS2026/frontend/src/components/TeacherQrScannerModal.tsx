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
  Scan,
  User,
  Sparkles,
  Smartphone,
  KeyRound,
} from 'lucide-react';
import { api } from '@/lib/api';

interface TeacherQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAttendanceSuccess?: (data: any) => void;
  initialTab?: 'QR' | 'FACE';
}

export default function TeacherQrScannerModal({
  isOpen,
  onClose,
  onAttendanceSuccess,
  initialTab = 'QR',
}: TeacherQrScannerModalProps) {
  const [activeTab, setActiveTab] = useState<'QR' | 'FACE'>(initialTab);
  const [scannerState, setScannerState] = useState<
    'STARTING' | 'SCANNING' | 'VALIDATING' | 'SUCCESS' | 'ERROR' | 'PERMISSION_REQUIRED'
  >('STARTING');
  const [errorMessage, setErrorMessage] = useState('');
  const [successData, setSuccessData] = useState<any>(null);
  const [locationStatus, setLocationStatus] = useState<string>('Detecting location...');
  const [coords, setCoords] = useState<{ lat?: number; lng?: number }>({});
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [manualToken, setManualToken] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isScanningRef = useRef(false);

  // Sync initialTab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Request Geolocation early
  useEffect(() => {
    if (!isOpen) return;

    if (navigator?.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setLocationStatus('GPS Verified');
        },
        (err) => {
          console.warn('Geolocation capture:', err.message);
          setLocationStatus('GPS Optional/Unavailable');
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
      );
    } else {
      setLocationStatus('GPS Unsupported');
    }
  }, [isOpen]);

  // Main Camera Lifecycle Manager
  useEffect(() => {
    if (!isOpen) {
      stopAllCameraResources();
      setScannerState('STARTING');
      setErrorMessage('');
      setSuccessData(null);
      return;
    }

    if (activeTab === 'FACE') {
      // Face Recognition is on hold - release camera resources
      stopAllCameraResources();
      return;
    }

    // When in QR mode, activate rear camera for QR scanning
    const targetFacing = 'environment';
    setCameraFacing(targetFacing);
    initCamera(targetFacing);

    return () => {
      stopAllCameraResources();
    };
  }, [isOpen, activeTab]);

  const stopAllCameraResources = async () => {
    isScanningRef.current = false;

    // 1. Stop Html5Qrcode instance
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (e) {}
      try {
        await html5QrCodeRef.current.clear();
      } catch (e) {}
      html5QrCodeRef.current = null;
    }

    // 2. Stop raw HTML5 video stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const initCamera = async (facing: 'environment' | 'user') => {
    await stopAllCameraResources();
    setScannerState('STARTING');
    setErrorMessage('');

    // Wait a tick for the DOM container to be fully visible
    await new Promise((resolve) => setTimeout(resolve, 200));

    // QR Code Scanner using Html5Qrcode
    const container = document.getElementById('qr-reader-container');
    if (!container) {
      setScannerState('ERROR');
      setErrorMessage('Scanner container could not be found in DOM.');
      return;
    }

    try {
      const html5QrCode = new Html5Qrcode('qr-reader-container');
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: { width: 240, height: 240 },
        aspectRatio: 1.0,
      };

      const onScanSuccess = async (decodedText: string) => {
        if (!isScanningRef.current) return;
        isScanningRef.current = false;
        try {
          await html5QrCode.stop();
        } catch {}
        handleQrScanned(decodedText);
      };

      // Try preferred facing mode first
      try {
        await html5QrCode.start(
          { facingMode: facing },
          config,
          onScanSuccess,
          () => {}
        );
      } catch (initialErr) {
        console.warn('Initial facingMode failed, checking available cameras:', initialErr);
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          const chosenCam =
            facing === 'user'
              ? cameras.find((c) => c.label.toLowerCase().includes('front') || c.label.toLowerCase().includes('user')) || cameras[0]
              : cameras.find((c) => c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('rear') || c.label.toLowerCase().includes('environment')) || cameras[cameras.length - 1];

          await html5QrCode.start(chosenCam.id, config, onScanSuccess, () => {});
        } else {
          throw initialErr;
        }
      }

      isScanningRef.current = true;
      setScannerState('SCANNING');
    } catch (err: any) {
      console.error('QR camera start error:', err);
      handleCameraError(err);
    }
  };

  const handleCameraError = (err: any) => {
    const errorStr = String(err?.name || err?.message || err).toLowerCase();
    if (
      errorStr.includes('notallowed') ||
      errorStr.includes('permission') ||
      errorStr.includes('denied')
    ) {
      setScannerState('PERMISSION_REQUIRED');
    } else {
      setScannerState('ERROR');
      setErrorMessage(
        err?.message ||
          'Unable to open camera. Please check your browser camera permissions or try switching cameras.'
      );
    }
  };

  const toggleCameraFacing = async () => {
    const newFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(newFacing);
    await initCamera(newFacing);
  };

  // QR Code Verification
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
        if (onAttendanceSuccess) onAttendanceSuccess(resData);
      } else {
        setScannerState('ERROR');
        setErrorMessage(resData.message || 'Attendance verification failed.');
      }
    } catch (err: any) {
      console.error('Scan API error:', err);
      setScannerState('ERROR');
      setErrorMessage(
        err.response?.data?.message ||
          err.message ||
          'Unable to verify attendance QR. Please try again.'
      );
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    handleQrScanned(manualToken.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">
        {/* Header with Mode Tabs */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                {activeTab === 'QR' ? <Scan className="w-4 h-4" /> : <Sparkles className="w-4 h-4 text-emerald-600" />}
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800">Teacher Daily Attendance</h3>
                <p className="text-[11px] text-slate-400 font-medium">CS EduTrack Smart Verification</p>
              </div>
            </div>

            <button
              onClick={() => {
                stopAllCameraResources();
                onClose();
              }}
              className="w-8 h-8 rounded-xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/60 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setShowManualInput(false);
                setActiveTab('QR');
              }}
              className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'QR'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <Scan className="w-3.5 h-3.5" />
              <span>Scan QR Code</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowManualInput(false);
                setActiveTab('FACE');
              }}
              className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'FACE'
                  ? 'bg-white text-amber-800 shadow-xs ring-1 ring-amber-300'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Face Recognition</span>
              <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full font-bold ml-0.5">Soon</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex flex-col items-center justify-center overflow-y-auto min-h-[360px]">
          {/* 1. FACE RECOGNITION (ON HOLD / COMING SOON VIEW) */}
          {activeTab === 'FACE' && (
            <div className="py-6 w-full flex flex-col items-center text-center gap-3 animate-in fade-in duration-200">
              <div className="relative">
                <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/10">
                  <UserCheck className="w-8 h-8" />
                </div>
                <span className="absolute -top-1 -right-2 px-2 py-0.5 bg-amber-500 text-white text-[9px] font-black rounded-full uppercase tracking-wider shadow-xs">
                  On Hold
                </span>
              </div>

              <div>
                <h4 className="text-base font-black text-slate-900">
                  Face Recognition Attendance
                </h4>
                <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                  Biometric Facial Verification
                </p>
              </div>

              {/* Exact user requirement alert banner */}
              <div className="w-full max-w-sm bg-amber-50/90 border border-amber-200 rounded-2xl p-4 text-left shadow-xs">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-950 leading-relaxed">
                      This feature is currently unavailable. It will be available as soon as new updates arrive.
                    </p>
                    <p className="text-[11px] text-amber-700 mt-1.5 leading-relaxed">
                      Please use the <strong>Scan QR Code</strong> option below to record your check-in for today.
                    </p>
                  </div>
                </div>
              </div>

              <div className="w-full max-w-sm pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('QR');
                  }}
                  className="w-full py-3 bg-[#2E5BFF] hover:bg-blue-600 text-white rounded-2xl font-black text-xs shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                >
                  <Scan className="w-4 h-4" />
                  <span>Switch to Scan QR Code</span>
                </button>
              </div>
            </div>
          )}

          {/* 2. QR CAMERA VIEWPORT BOX (ACTIVE WHEN IN QR MODE) */}
          {activeTab === 'QR' && (scannerState === 'STARTING' || scannerState === 'SCANNING') && (
            <div className="w-full flex flex-col items-center">
              <div className="relative w-full max-w-[290px] aspect-square rounded-3xl overflow-hidden bg-slate-950 shadow-inner border-2 border-slate-200">
                <div
                  id="qr-reader-container"
                  className="w-full h-full object-cover"
                />

                {/* Starting / Loading Overlay */}
                {scannerState === 'STARTING' && (
                  <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center text-white gap-2.5 z-10 p-4 text-center">
                    <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                    <span className="text-xs font-bold text-slate-200">Starting Camera Feed...</span>
                    <span className="text-[10px] text-slate-400">Please allow camera access when prompted</span>
                  </div>
                )}

                {/* QR Target Reticle */}
                {scannerState === 'SCANNING' && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    <div className="w-48 h-48 border-2 border-blue-500 rounded-2xl relative shadow-[0_0_20px_rgba(59,130,246,0.35)]">
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-blue-500 -mt-1 -ml-1 rounded-tl" />
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-blue-500 -mt-1 -mr-1 rounded-tr" />
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-blue-500 -mb-1 -ml-1 rounded-bl" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-blue-500 -mb-1 -mr-1 rounded-br" />
                    </div>
                  </div>
                )}
              </div>

              {/* Status and Controls under Viewport */}
              <div className="mt-4 text-center space-y-2 w-full max-w-[290px]">
                <p className="text-xs font-bold text-slate-700">
                  Align the school attendance QR code within the square frame
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-500" />
                    <span>{locationStatus}</span>
                  </div>

                  <button
                    type="button"
                    onClick={toggleCameraFacing}
                    className="flex items-center gap-1 text-blue-600 font-bold hover:underline cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Flip Camera</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PERMISSION REQUIRED SCREEN */}
          {scannerState === 'PERMISSION_REQUIRED' && (
            <div className="py-4 w-full flex flex-col items-center text-center gap-3 animate-in fade-in">
              <div className="w-16 h-16 rounded-3xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/10">
                <Camera className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-base font-black text-slate-900">Camera Permission Required</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                  EduTrack requires camera access to scan attendance. Please tap below and allow camera permissions in your browser.
                </p>
              </div>

              <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-left text-xs text-slate-600 space-y-1.5">
                <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <ShieldCheck className="w-4 h-4 text-blue-600" /> How to allow:
                </div>
                <p className="text-[11px]">1. Tap <strong>Allow Camera Access</strong> below.</p>
                <p className="text-[11px]">2. Select <strong>Allow</strong> or <strong>While using the app</strong>.</p>
                <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-200">
                  If blocked: tap the lock or camera icon in your browser URL bar and set Camera to Allow.
                </p>
              </div>

              <button
                type="button"
                onClick={() => initCamera(cameraFacing)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs shadow-md transition-all cursor-pointer"
              >
                Allow Camera Access &amp; Retry
              </button>
            </div>
          )}

          {/* VALIDATING SCREEN */}
          {scannerState === 'VALIDATING' && (
            <div className="py-12 flex flex-col items-center text-center gap-3 animate-in fade-in">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
              <h4 className="text-base font-black text-slate-900">
                {activeTab === 'FACE' ? 'Verifying Facial Biometrics...' : 'Verifying Attendance QR...'}
              </h4>
              <p className="text-xs text-slate-400">Recording attendance with secure timestamp &amp; GPS verification</p>
            </div>
          )}

          {/* SUCCESS RECEIPT SCREEN */}
          {scannerState === 'SUCCESS' && successData && (
            <div className="py-4 w-full flex flex-col items-center text-center gap-3 animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${
                  successData.attendance?.status === 'LATE'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {successData.attendance?.status || 'PRESENT'}
                </span>
                <h4 className="text-lg font-black text-slate-900 mt-2">
                  {successData.alreadyMarked ? 'Attendance Already Marked' : 'Attendance Verified Successfully!'}
                </h4>
              </div>

              {/* Receipt Details Box */}
              <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2 text-left">
                <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                  <span className="text-slate-400">Teacher:</span>
                  <span className="font-black text-slate-800">{successData.attendance?.teacherName || 'Teacher'}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                  <span className="text-slate-400">School:</span>
                  <span className="font-bold text-slate-700">{successData.attendance?.schoolName || 'CS EduTrack'}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                  <span className="text-slate-400">Check-in Time:</span>
                  <span className="font-bold text-blue-600 font-mono">
                    {successData.attendance?.checkInTime
                      ? new Date(successData.attendance.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      : new Date().toLocaleTimeString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Method:</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    {activeTab === 'FACE' ? '👤 Verified via AI Face Biometrics' : '📷 Verified via Secure QR'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  stopAllCameraResources();
                  onClose();
                }}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs shadow-md transition-all cursor-pointer mt-2"
              >
                Done
              </button>
            </div>
          )}

          {/* ERROR SCREEN */}
          {scannerState === 'ERROR' && (
            <div className="py-4 w-full flex flex-col items-center text-center gap-3 animate-in fade-in">
              <div className="w-16 h-16 rounded-3xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
                <AlertCircle className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-base font-black text-slate-900">Attendance Verification Failed</h4>
                <p className="text-xs text-rose-600 mt-1 max-w-xs">{errorMessage || 'Unable to start camera or verify attendance.'}</p>
              </div>

              {/* Manual Token Option if QR code camera has issues */}
              {activeTab === 'QR' && (
                <div className="w-full mt-2">
                  {!showManualInput ? (
                    <button
                      type="button"
                      onClick={() => setShowManualInput(true)}
                      className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                    >
                      Or enter attendance code manually
                    </button>
                  ) : (
                    <form onSubmit={handleManualSubmit} className="space-y-2 w-full text-left">
                      <label className="text-[11px] font-bold text-slate-700">Enter QR Token Code:</label>
                      <input
                        type="text"
                        value={manualToken}
                        onChange={(e) => setManualToken(e.target.value)}
                        placeholder="Paste or type QR token code"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:border-blue-500"
                      />
                      <button
                        type="submit"
                        className="w-full py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                      >
                        Verify Code &amp; Submit
                      </button>
                    </form>
                  )}
                </div>
              )}

              <div className="flex gap-2 w-full mt-2">
                <button
                  type="button"
                  onClick={() => initCamera(cameraFacing)}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs shadow-md transition-all cursor-pointer"
                >
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopAllCameraResources();
                    onClose();
                  }}
                  className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
