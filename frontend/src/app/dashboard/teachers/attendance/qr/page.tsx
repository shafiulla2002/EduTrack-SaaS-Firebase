'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import {
  QrCode,
  Printer,
  Download,
  RefreshCw,
  PowerOff,
  MapPin,
  Clock,
  Building,
  ShieldCheck,
  AlertTriangle,
  Save,
  CheckCircle2,
  Copy,
  ExternalLink,
  ChevronLeft,
} from 'lucide-react';
import { api, fastGet } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { PencilSpinner } from '@/components/loading';
import { useTenant } from '@/app/providers/TenantContext';

export default function TeacherAttendanceQrPage() {
  const { schoolName, logoUrl } = useTenant();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Settings form state
  const [workStartTime, setWorkStartTime] = useState('09:00 AM');
  const [lateThresholdMinutes, setLateThresholdMinutes] = useState(15);
  const [schoolLatitude, setSchoolLatitude] = useState<string>('');
  const [schoolLongitude, setSchoolLongitude] = useState<string>('');
  const [allowedRadiusMeters, setAllowedRadiusMeters] = useState(200);
  const [enableGeofencing, setEnableGeofencing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/teacher-attendance/qr');
      setData(res.data);

      if (res.data?.qrCode?.qrPayload) {
        generateQrImage(res.data.qrCode.qrPayload);
      }

      if (res.data?.settings) {
        const s = res.data.settings;
        setWorkStartTime(s.workStartTime || '09:00 AM');
        setLateThresholdMinutes(s.lateThresholdMinutes ?? 15);
        setSchoolLatitude(s.schoolLatitude != null ? String(s.schoolLatitude) : '');
        setSchoolLongitude(s.schoolLongitude != null ? String(s.schoolLongitude) : '');
        setAllowedRadiusMeters(s.allowedRadiusMeters ?? 200);
        setEnableGeofencing(!!s.enableGeofencing);
      }
    } catch (err: any) {
      console.error('Failed to load QR info:', err);
      showToast('Failed to load attendance QR code', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const generateQrImage = async (payload: string) => {
    try {
      const url = await QRCode.toDataURL(payload, {
        width: 500,
        margin: 2,
        color: {
          dark: '#0F172A',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'H',
      });
      setQrDataUrl(url);
    } catch (err) {
      console.error('QR generation error:', err);
    }
  };

  const handleGenerate = async () => {
    setActionLoading(true);
    try {
      const res = await api.post('/teacher-attendance/qr/generate', {});
      setData(res.data);
      if (res.data?.qrCode?.qrPayload) {
        await generateQrImage(res.data.qrCode.qrPayload);
      }
      showToast('Teacher Attendance QR code generated successfully!', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to generate QR', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setActionLoading(true);
    try {
      const res = await api.post('/teacher-attendance/qr/regenerate', {});
      setData(res.data);
      if (res.data?.qrCode?.qrPayload) {
        await generateQrImage(res.data.qrCode.qrPayload);
      }
      setShowRegenModal(false);
      showToast('QR code regenerated! Previous QR codes have been invalidated.', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to regenerate QR', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm('Are you sure you want to deactivate the school attendance QR code? Teachers will not be able to mark attendance until reactivated.')) return;
    setActionLoading(true);
    try {
      await api.post('/teacher-attendance/qr/deactivate', {});
      await loadData();
      showToast('QR code deactivated successfully.', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to deactivate QR', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `${(schoolName || 'school').replace(/\s+/g, '_')}_Teacher_Attendance_QR.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('QR code image downloaded!', 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.put('/teacher-attendance/settings', {
        workStartTime,
        lateThresholdMinutes: Number(lateThresholdMinutes),
        schoolLatitude: schoolLatitude ? parseFloat(schoolLatitude) : null,
        schoolLongitude: schoolLongitude ? parseFloat(schoolLongitude) : null,
        allowedRadiusMeters: Number(allowedRadiusMeters),
        enableGeofencing,
      });
      showToast('School attendance timing & location rules saved!', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleFetchCurrentGps = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setSchoolLatitude(pos.coords.latitude.toFixed(6));
          setSchoolLongitude(pos.coords.longitude.toFixed(6));
          showToast('GPS coordinates captured from your current location!', 'success');
        },
        (err) => {
          showToast('Failed to acquire GPS: ' + err.message, 'error');
        },
        { enableHighAccuracy: true },
      );
    } else {
      showToast('Geolocation is not supported by your browser', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <PencilSpinner />
        <p className="text-sm font-semibold text-slate-500">Loading Attendance QR Manager...</p>
      </div>
    );
  }

  const activeQr = data?.qrCode;
  const isQrActive = activeQr && activeQr.status === 'ACTIVE';

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/teachers/attendance"
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-[#2E5BFF]" />
              Teacher Attendance QR Code
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Generate, print, and configure the school's official teacher attendance QR scan point.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/teachers/attendance"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
          >
            View Live Attendance
          </Link>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: QR Code Display Card */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col items-center text-center">
            {/* Active Status Badge */}
            <div className="w-full flex justify-between items-center mb-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Version {activeQr?.version || 1}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  isQrActive
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isQrActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                {isQrActive ? 'Active QR' : 'Inactive'}
              </span>
            </div>

            {/* Visual QR Code Box */}
            <div className="relative p-5 bg-gradient-to-tr from-slate-50 to-blue-50/40 border-2 border-slate-200 rounded-3xl shadow-md w-full max-w-[300px] aspect-square flex items-center justify-center overflow-hidden group">
              {isQrActive && qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Teacher Attendance QR Code"
                  className="w-full h-full object-contain rounded-xl shadow-xs"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-slate-400 gap-2">
                  <QrCode className="w-16 h-16 opacity-30" />
                  <p className="text-xs font-semibold">No active QR code generated</p>
                </div>
              )}
            </div>

            {/* School Branding underneath */}
            <div className="mt-4">
              <h3 className="font-bold text-slate-800 text-sm">{schoolName || 'CS EduTrack School'}</h3>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Scan using EduTrack Teacher Portal or Phone Camera
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 gap-2 w-full mt-6">
              {isQrActive ? (
                <>
                  <button
                    onClick={handleDownload}
                    className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#2E5BFF]" />
                    Download PNG
                  </button>

                  <button
                    onClick={handlePrint}
                    className="py-2.5 px-3 bg-[#2E5BFF] hover:bg-blue-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Poster
                  </button>

                  <button
                    onClick={() => setShowRegenModal(true)}
                    className="col-span-1 py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-amber-200 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Regenerate
                  </button>

                  <button
                    onClick={handleDeactivate}
                    className="col-span-1 py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-rose-200 cursor-pointer"
                  >
                    <PowerOff className="w-3.5 h-3.5" />
                    Deactivate
                  </button>
                </>
              ) : (
                <button
                  onClick={handleGenerate}
                  disabled={actionLoading}
                  className="col-span-2 py-3 bg-[#2E5BFF] hover:bg-blue-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  {actionLoading ? 'Generating...' : 'Generate Attendance QR'}
                </button>
              )}
            </div>
          </div>

          {/* Deep Link URL Card */}
          {activeQr && (
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-[#2E5BFF]" />
                  Universal Web Deep Link
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Camera Scan Target</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between text-[11px] font-mono text-slate-600 truncate">
                <span className="truncate mr-2">{activeQr.qrPayload}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(activeQr.qrPayload);
                    showToast('Deep link URL copied to clipboard!', 'success');
                  }}
                  className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-700 transition-colors shrink-0"
                  title="Copy link"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Attendance Rules & Geofence Configuration */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleSaveSettings} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#2E5BFF]" />
                School Attendance Timing & Policy Rules
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Set when check-ins are recorded as Present vs Late.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  School Work Start Time
                </label>
                <input
                  type="text"
                  value={workStartTime}
                  onChange={(e) => setWorkStartTime(e.target.value)}
                  placeholder="e.g. 09:00 AM"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#2E5BFF] focus:outline-none transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1">Official arrival time</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Late Grace Threshold (Minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={lateThresholdMinutes}
                  onChange={(e) => setLateThresholdMinutes(Number(e.target.value))}
                  placeholder="15"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#2E5BFF] focus:outline-none transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Scans after {workStartTime} + {lateThresholdMinutes}m will be marked as <b>LATE</b>
                </p>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#2E5BFF]" />
                    Anti-Proxy Geofencing Security
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Prevent teachers from scanning QR photos from outside school grounds.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableGeofencing}
                    onChange={(e) => setEnableGeofencing(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2E5BFF]"></div>
                </label>
              </div>

              {enableGeofencing && (
                <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/70 animate-in fade-in">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700">School Coordinates</span>
                    <button
                      type="button"
                      onClick={handleFetchCurrentGps}
                      className="px-2.5 py-1 bg-blue-50 text-[#2E5BFF] font-bold text-[11px] rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <MapPin className="w-3 h-3" />
                      Set From Current GPS
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Latitude
                      </label>
                      <input
                        type="text"
                        value={schoolLatitude}
                        onChange={(e) => setSchoolLatitude(e.target.value)}
                        placeholder="e.g. 18.520430"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:border-[#2E5BFF] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Longitude
                      </label>
                      <input
                        type="text"
                        value={schoolLongitude}
                        onChange={(e) => setSchoolLongitude(e.target.value)}
                        placeholder="e.g. 73.856743"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:border-[#2E5BFF] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Allowed Geofence Radius (Meters)
                    </label>
                    <input
                      type="number"
                      min="20"
                      max="2000"
                      value={allowedRadiusMeters}
                      onChange={(e) => setAllowedRadiusMeters(Number(e.target.value))}
                      placeholder="200"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:border-[#2E5BFF] focus:outline-none"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Recommended: 150m – 300m to accommodate typical campus boundaries.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-6 py-2.5 bg-[#2E5BFF] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {savingSettings ? 'Saving...' : 'Save Attendance Rules'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Confirmation Modal for Regeneration */}
      {showRegenModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Regenerate QR Code?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Regenerating will immediately revoke and deactivate any previously printed QR codes. Teachers will only be able to scan the new QR code.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowRegenModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRegenerate}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                {actionLoading ? 'Regenerating...' : 'Yes, Regenerate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Printable Poster Container (Printed via @media print) */}
      <div id="print-poster" className="hidden print:flex flex-col items-center justify-between p-12 text-center bg-white min-h-screen text-slate-900">
        <div className="space-y-3">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">{schoolName || 'CS EduTrack School'}</h1>
          <p className="text-lg font-bold text-blue-600 uppercase tracking-widest">
            Official Teacher Attendance Point
          </p>
        </div>

        <div className="my-8 p-6 border-4 border-slate-900 rounded-3xl inline-block bg-white shadow-lg">
          {qrDataUrl && (
            <img
              src={qrDataUrl}
              alt="School Teacher Attendance QR"
              className="w-[380px] h-[380px] object-contain"
            />
          )}
        </div>

        <div className="max-w-md space-y-4">
          <div className="p-4 bg-slate-50 border border-slate-300 rounded-2xl text-left space-y-1.5 text-sm">
            <h4 className="font-bold text-slate-800">How to mark your attendance:</h4>
            <ol className="list-decimal list-inside space-y-1 text-slate-600 text-xs font-medium">
              <li>Open <b>CS EduTrack Teacher Portal</b> $\rightarrow$ Tap <b>Mark Attendance</b>.</li>
              <li>Or scan this QR directly using your mobile phone camera.</li>
              <li>Your check-in time and attendance status will be verified instantly.</li>
            </ol>
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            Powered by CS EduTrack SaaS • Secure Multi-Tenant Attendance System
          </p>
        </div>
      </div>
    </div>
  );
}
