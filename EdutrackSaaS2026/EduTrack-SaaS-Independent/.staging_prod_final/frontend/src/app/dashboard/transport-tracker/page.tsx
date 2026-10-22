'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { socketService } from '@/lib/socket';
import { AlertTriangle, CheckCircle, MapPin, Play, Square, RefreshCw, ShieldAlert, PhoneCall, Radio, Battery, Gauge } from 'lucide-react';

export default function DriverTransportTrackerPage() {
  const [loading, setLoading] = useState(true);
  const [driverData, setDriverData] = useState<any>(null);
  const [dutyStatus, setDutyStatus] = useState<string>('NOT_STARTED');
  
  // GPS State & Telemetry
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsErrorCode, setGpsErrorCode] = useState<number | null>(null);
  const [lastPingTime, setLastPingTime] = useState<string | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{
    lat: number;
    lng: number;
    speed: number;
    heading: number;
    accuracy: number;
  } | null>(null);
  const [accuracyNotice, setAccuracyNotice] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);
  const gpsQueueRef = useRef<any[]>([]);

  const fetchAssignedBus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/transport/driver/assigned-bus');
      setDriverData(res.data);
      if (res.data?.bus?.dutyStatus) {
        setDutyStatus(res.data.bus.dutyStatus);
      }
    } catch (err: any) {
      console.error('Failed to fetch assigned bus data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignedBus();
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      socketService.disconnect();
    };
  }, [fetchAssignedBus]);

  // Request Screen Wake Lock API to prevent phone screen from dimming/sleeping
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (err) {
      console.warn('Wake Lock request failed:', err);
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().then(() => {
        wakeLockRef.current = null;
      }).catch(() => {});
    }
  };

  const flushQueue = useCallback(() => {
    const socket = socketService.getSocket();
    if (socket && socket.connected && gpsQueueRef.current.length > 0) {
      console.log(`[Driver Device GPS] Flushing ${gpsQueueRef.current.length} queued points`);
      while (gpsQueueRef.current.length > 0) {
        const queuedPayload = gpsQueueRef.current.shift();
        socket.emit('driverGpsUpdate', queuedPayload);
      }
    }
  }, []);

  const stopGpsTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    releaseWakeLock();
    socketService.disconnect();
    setSocketConnected(false);
    setGpsActive(false);
    console.log('[Driver Device GPS] Stopped tracking & cleared watch.');
  }, []);

  const sendGpsPing = async (pos: GeolocationPosition) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const speed = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0; // m/s to km/h
    const heading = pos.coords.heading || 0;
    const accuracy = Math.round(pos.coords.accuracy || 0);
    const timestamp = new Date(pos.timestamp || Date.now()).toISOString();

    setCurrentCoords({ lat, lng, speed, heading, accuracy });
    const pingTime = new Date(pos.timestamp || Date.now()).toLocaleTimeString();
    setLastPingTime(pingTime);

    if (accuracy > 500) {
      setAccuracyNotice(`Low GPS Precision (Accuracy: ${accuracy}m). Transmitting fallback coordinates...`);
    } else {
      setAccuracyNotice(null);
    }

    const payload = {
      busId: driverData?.bus?.id,
      tripId: null,
      latitude: lat,
      longitude: lng,
      speed,
      heading,
      accuracy,
      timestamp,
      dutyStatus: dutyStatus || 'ON_ROUTE',
    };

    console.log('[Driver Device GPS Ping] Processing ping:', payload, 'Timestamp:', pingTime);

    const socket = socketService.getSocket();
    if (socket && socket.connected) {
      console.log('[Driver Device GPS] Emitting via WebSocket');
      socket.emit('driverGpsUpdate', payload);
      setLastPingTime(pingTime + ' (WS)');
    } else {
      console.warn('[Driver Device GPS] Socket offline, queuing location update');
      gpsQueueRef.current.push(payload);
      if (gpsQueueRef.current.length > 50) {
        gpsQueueRef.current.shift();
      }

      // Rest client HTTP post fallback
      const restPayload = {
        lat,
        lng,
        speed,
        heading,
        accuracy,
        dutyStatus: dutyStatus || 'ON_ROUTE',
      };
      try {
        await api.post('/transport/driver/gps', restPayload);
        setLastPingTime(pingTime + ' (HTTP Fallback)');
      } catch (err) {
        console.error('[Driver Device GPS Fallback Error] HTTP post failed:', err);
      }
    }
  };

  const startGpsTracking = async () => {
    setGpsError(null);
    setGpsErrorCode(null);
    setAccuracyNotice(null);

    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsError('Geolocation is not supported by your mobile browser. Please use a modern browser like Chrome, Safari, or Edge.');
      return;
    }

    await requestWakeLock();
    setGpsActive(true);
    console.log('[Driver Device GPS] Starting tracking & requesting position...');

    // Connect to Socket.IO and register reconnect flushing
    const token = localStorage.getItem('token');
    if (token) {
      const socket = socketService.connect(token);
      if (socket) {
        socket.on('connect', () => {
          setSocketConnected(true);
          flushQueue();
        });
        socket.on('disconnect', () => {
          setSocketConnected(false);
        });
        socket.on('connect_error', () => {
          setSocketConnected(false);
        });
        if (socket.connected) {
          setSocketConnected(true);
        }
      }
    }

    // Immediately capture position
    navigator.geolocation.getCurrentPosition(
      (pos) => sendGpsPing(pos),
      (err) => console.warn('[Driver Device Initial GPS Error]:', err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    // Watch position changes
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => sendGpsPing(pos),
      (err) => {
        console.error('[Driver Device GPS Error]:', err);
        setGpsErrorCode(err.code);
        if (err.code === 1) {
          setGpsError('Location permission was denied. Please allow location access in your browser settings to track live bus movement.');
        } else if (err.code === 2) {
          setGpsError('GPS location is unavailable. Please check that Device Location Services are turned ON on your phone.');
        } else if (err.code === 3) {
          setGpsError('Location request timed out. Retrying GPS connection...');
        } else {
          setGpsError('An unknown error occurred while retrieving GPS location.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleDutyChange = async (newStatus: string) => {
    setDutyStatus(newStatus);
    try {
      await api.post('/transport/driver/duty', { dutyStatus: newStatus });
    } catch (err) {
      console.error('Failed to update duty status:', err);
    }

    if (newStatus === 'ON_ROUTE' || newStatus === 'STARTING_ROUTE') {
      if (!gpsActive) {
        startGpsTracking();
      }
    } else if (newStatus === 'TRIP_COMPLETED' || newStatus === 'OFFLINE' || newStatus === 'OFF_DUTY') {
      stopGpsTracking();
    }
  };

  const handleStartTrip = () => {
    handleDutyChange('ON_ROUTE');
  };

  const handleEndTrip = () => {
    handleDutyChange('TRIP_COMPLETED');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-4 border-t-blue-600 border-slate-200 rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500">Loading Transport Tracker...</p>
      </div>
    );
  }

  const bus = driverData?.bus;
  const driver = driverData?.driver;
  const validations = driverData?.validations;
  const canStartTrip = validations?.canStartTrip;

  // Format Driver Duty Status Label & Badges
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ON_ROUTE':
      case 'STARTING_ROUTE':
      case 'EN_ROUTE':
        return { label: 'ON ROUTE', color: 'bg-emerald-500 text-white animate-pulse' };
      case 'NEAR_SCHOOL':
      case 'SCHOOL_REACHED':
      case 'REACHED_STOP':
        return { label: 'NEAR SCHOOL', color: 'bg-blue-600 text-white' };
      case 'TRIP_COMPLETED':
      case 'ROUTE_COMPLETED':
        return { label: 'TRIP COMPLETED', color: 'bg-indigo-600 text-white' };
      case 'WAITING':
        return { label: 'WAITING', color: 'bg-amber-500 text-white' };
      default:
        return { label: 'OFFLINE', color: 'bg-slate-500 text-white' };
    }
  };

  const currentStatusBadge = getStatusBadge(dutyStatus);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-6 rounded-3xl text-white shadow-lg flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-2xl font-black shadow-md shadow-blue-500/30">
            🚌
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Driver Transport Tracker</h1>
            <p className="text-xs text-slate-300 font-mono mt-0.5">
              Driver: {driver?.user?.name || 'Staff Member'} • Bus: {bus?.busNumber || 'Unassigned'}
            </p>
          </div>
        </div>
        <button
          onClick={fetchAssignedBus}
          className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer border border-slate-700"
          title="Refresh assignment & route data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Assignment Validation Error Banner */}
      {validations && !canStartTrip && (
        <div className="bg-rose-50 border-2 border-rose-200 rounded-3xl p-6 space-y-3 shadow-sm">
          <div className="flex items-center gap-3 text-rose-700">
            <ShieldAlert className="w-6 h-6 shrink-0" />
            <h2 className="text-sm font-extrabold uppercase tracking-wide">
              Trip Pre-Start Validation Failed
            </h2>
          </div>
          <p className="text-xs text-rose-800 font-semibold leading-relaxed">
            {validations.validationError || 'You cannot start a trip until all driver assignment requirements are met.'}
          </p>

          <div className="grid grid-cols-2 gap-2 pt-2 text-xs font-semibold">
            <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${validations.hasAssignedBus ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-800 border-rose-300'}`}>
              {validations.hasAssignedBus ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
              <span>Assigned Bus</span>
            </div>
            <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${validations.hasAssignedRoute ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-800 border-rose-300'}`}>
              {validations.hasAssignedRoute ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
              <span>Assigned Route</span>
            </div>
            <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${validations.isBusActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-800 border-rose-300'}`}>
              {validations.isBusActive ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
              <span>Bus Active Status</span>
            </div>
            <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${!validations.isTripCompletedToday ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-800 border-rose-300'}`}>
              {!validations.isTripCompletedToday ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
              <span>Trip Not Completed Today</span>
            </div>
          </div>
        </div>
      )}

      {/* GPS Permission Error Banner */}
      {gpsError && (
        <div className="bg-amber-50 border border-amber-300 rounded-3xl p-5 space-y-3">
          <div className="flex items-center gap-3 text-amber-800">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
            <h3 className="text-xs font-black uppercase tracking-wider">GPS Permission / Service Notice</h3>
          </div>
          <p className="text-xs text-amber-900 font-medium leading-relaxed">{gpsError}</p>
          <div className="flex gap-3 pt-1">
            <button
              onClick={startGpsTracking}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Location Permission
            </button>
          </div>
        </div>
      )}

      {/* GPS Accuracy Uncertainty Warning */}
      {accuracyNotice && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs font-semibold text-blue-800 flex items-center gap-3">
          <Radio className="w-4 h-4 text-blue-600 animate-pulse shrink-0" />
          <span>{accuracyNotice}</span>
        </div>
      )}

      {/* Live GPS Telemetry Status Card */}
      <div className={`p-6 rounded-3xl border ${gpsActive ? 'bg-emerald-600 text-white border-emerald-700 shadow-xl' : 'bg-white text-slate-800 border-slate-200 shadow-sm'} transition-all`}>
        <div className="flex justify-between items-center mb-3">
          <span className="font-extrabold text-xs uppercase tracking-wider flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${gpsActive ? 'bg-white animate-ping' : 'bg-slate-400'}`} />
            {gpsActive ? '🔴 LIVE GPS BROADCASTING' : '⚪ GPS TRACKING STANDBY'}
          </span>
          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${currentStatusBadge.color}`}>
            {currentStatusBadge.label}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 my-2">
          <div>
            <span className="text-[10px] uppercase font-bold opacity-80 block">Current Speed</span>
            <div className="text-3xl font-black">{gpsActive ? `${currentCoords?.speed || 0}` : '0'} <span className="text-sm font-bold">km/h</span></div>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold opacity-80 block">GPS Accuracy</span>
            <div className="text-xl font-bold mt-1">
              {currentCoords?.accuracy !== undefined ? `±${currentCoords.accuracy}m` : 'N/A'}
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase font-bold opacity-80 block">Last GPS Ping</span>
            <div className="text-xs font-mono font-bold mt-2">
              {lastPingTime || 'No pings sent yet'}
            </div>
          </div>
        </div>

        <div className="text-xs font-medium opacity-90 border-t border-white/20 pt-3 mt-3 flex justify-between items-center">
          <span>
            {gpsActive
              ? `Coords: (${currentCoords?.lat.toFixed(4)}, ${currentCoords?.lng.toFixed(4)})`
              : 'Click Start Trip below to initiate live location updates.'}
          </span>
          {gpsActive && <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded">Screen Kept Awake 💡</span>}
        </div>
      </div>

      {/* Main Trip Control Buttons */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h2 className="font-extrabold text-xs text-slate-500 uppercase tracking-wide flex items-center justify-between">
          <span>Trip Controls</span>
          <span className="text-[11px] font-bold text-slate-400">Mobile Browser Sync</span>
        </h2>

        {!gpsActive ? (
          <button
            onClick={handleStartTrip}
            disabled={!canStartTrip}
            className={`w-full py-4 rounded-2xl font-black text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${
              canStartTrip
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
            }`}
          >
            <Play className="w-5 h-5 fill-current" />
            Start Trip &amp; Enable GPS Tracking
          </button>
        ) : (
          <button
            onClick={handleEndTrip}
            className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-sm shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Square className="w-5 h-5 fill-current" />
            End Trip &amp; Stop GPS Updates
          </button>
        )}

        {/* Stage duty quick switchers */}
        <div className="pt-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase block mb-2">Stage Status Override</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => handleDutyChange('WAITING')}
              className={`p-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${dutyStatus === 'WAITING' ? 'bg-amber-500 text-white border-amber-600' : 'bg-slate-50 text-slate-700 border-slate-200'}`}
            >
              Waiting
            </button>
            <button
              onClick={() => handleDutyChange('ON_ROUTE')}
              className={`p-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${dutyStatus === 'ON_ROUTE' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-slate-50 text-slate-700 border-slate-200'}`}
            >
              On Route
            </button>
            <button
              onClick={() => handleDutyChange('NEAR_SCHOOL')}
              className={`p-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${dutyStatus === 'NEAR_SCHOOL' ? 'bg-blue-600 text-white border-blue-700' : 'bg-slate-50 text-slate-700 border-slate-200'}`}
            >
              Near School
            </button>
            <button
              onClick={() => handleDutyChange('OFFLINE')}
              className={`p-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${dutyStatus === 'OFFLINE' ? 'bg-slate-700 text-white border-slate-800' : 'bg-slate-50 text-slate-700 border-slate-200'}`}
            >
              Offline
            </button>
          </div>
        </div>
      </div>

      {/* Vehicle & Route Details */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h2 className="font-extrabold text-xs text-slate-500 uppercase tracking-wide flex items-center justify-between">
          <span>Assigned Vehicle &amp; Route Info</span>
          <MapPin className="w-4 h-4 text-blue-600" />
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-150">
            <span className="text-slate-400 font-bold uppercase text-[10px] block">Bus Number</span>
            <strong className="text-slate-900 font-extrabold text-sm">{bus?.busNumber || 'N/A'}</strong>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-150">
            <span className="text-slate-400 font-bold uppercase text-[10px] block">Registration No</span>
            <strong className="text-slate-900 font-extrabold text-sm">{bus?.registrationNo || 'N/A'}</strong>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-150 sm:col-span-2">
            <span className="text-slate-400 font-bold uppercase text-[10px] block">Assigned Route</span>
            <strong className="text-blue-600 font-extrabold text-sm">{bus?.route?.routeName || 'Unassigned Route'}</strong>
          </div>
        </div>
      </div>

      {/* Route Stops Checklist */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h2 className="font-extrabold text-xs text-slate-500 uppercase tracking-wide">
          Route Stops Sequence
        </h2>
        <div className="space-y-2">
          {bus?.route?.stops && bus.route.stops.length > 0 ? (
            bus.route.stops.map((stop: any, idx: number) => (
              <div key={stop.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-150 flex justify-between items-center text-xs">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-xl bg-blue-100 text-blue-700 font-black flex items-center justify-center text-xs">
                    {idx + 1}
                  </span>
                  <strong className="text-slate-800 font-bold">{stop.stopName}</strong>
                </div>
                <span className="text-slate-500 font-mono text-[11px] font-semibold">{stop.pickupTime || 'Scheduled'}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 font-medium">No stops configured for this route.</p>
          )}
        </div>
      </div>

      {/* Background Browser Tracking Notice Banner */}
      <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200 text-slate-600 text-xs font-medium leading-relaxed">
        <strong>💡 Note on Background Tracking:</strong> Keep this browser tab open while driving. Screen wake lock keeps your phone screen active. For full background tracking when phone is locked, an Android Driver app can be used with the same backend APIs.
      </div>

      {/* Emergency Call Button */}
      <a
        href="tel:+919876543210"
        className="w-full text-center py-4 bg-slate-900 hover:bg-black text-white rounded-2xl text-xs font-extrabold shadow-md cursor-pointer transition-all flex items-center justify-center gap-2"
      >
        <PhoneCall className="w-4 h-4 text-rose-400" />
        Emergency Call Transport Department
      </a>
    </div>
  );
}
