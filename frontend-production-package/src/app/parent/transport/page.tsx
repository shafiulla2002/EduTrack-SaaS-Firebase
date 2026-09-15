'use client';

import React, { useState, useEffect } from 'react';
import { useParent } from '../ParentContext';
import { api } from '@/lib/api';
import { socketService } from '@/lib/socket';
import GoogleBusMap from '@/components/GoogleBusMap';

export default function ParentTransportPage() {
  const { selectedChild } = useParent();
  const [transportData, setTransportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [googleEta, setGoogleEta] = useState<string>('');

  const fetchTransportData = async () => {
    if (!selectedChild?.id) return;
    try {
      const res = await api.get(`/transport/parent-portal/children/${selectedChild.id}`);
      setTransportData(res.data);
      setError('');
      
      // Connect to Socket.IO and join bus room
      if (res.data?.bus?.id) {
        const token = localStorage.getItem('token');
        if (token) {
          const socket = socketService.connect(token);
          if (socket) {
            socket.emit('joinBusRoom', { busId: res.data.bus.id });
            
            // Listen for live updates
            socket.off('busLocationUpdate'); // Remove existing listener to prevent duplicates
            socket.on('busLocationUpdate', (update: any) => {
              setTransportData((prev: any) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  bus: {
                    ...prev.bus,
                    currentLat: update.currentLat,
                    currentLng: update.currentLng,
                    currentSpeed: update.currentSpeed,
                    currentHeading: update.currentHeading,
                    dutyStatus: update.dutyStatus,
                    lastGpsUpdate: update.lastGpsUpdate || new Date().toISOString(),
                    isOnline: update.dutyStatus !== 'OFFLINE' && update.dutyStatus !== 'OFF_DUTY',
                  }
                };
              });
            });
          }
        }
      }
    } catch (err: any) {
      setError('Failed to load real-time transport data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransportData();
    
    // Optional: Keep 30s polling as a fallback
    const interval = setInterval(fetchTransportData, 30000); 
    
    return () => {
      clearInterval(interval);
      if (transportData?.bus?.id) {
        const socket = socketService.getSocket();
        if (socket) {
          socket.emit('leaveBusRoom', { busId: transportData.bus.id });
        }
      }
    };
  }, [selectedChild?.id]);

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded-lg w-1/3" />
        <div className="h-64 bg-slate-200 rounded-2xl w-full" />
      </div>
    );
  }

  if (!transportData?.hasBusAssigned) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-3xl mx-auto font-black">
            🚌
          </div>
          <h2 className="text-xl font-black text-slate-900">No Bus Allocated</h2>
          <p className="text-slate-500 text-xs max-w-md mx-auto leading-relaxed">
            {selectedChild?.name || 'Student'} is currently not assigned to any active school transport bus route. Please contact the school administration to assign a bus and pickup stop.
          </p>
        </div>
      </div>
    );
  }

  const { bus, driver, route, assignedStop, telemetry } = transportData;
  const isOnline = bus?.isOnline;

  const busLocations = [
    {
      id: bus.id,
      busNumber: bus.busNumber,
      registrationNo: bus.registrationNo,
      driverName: driver?.name,
      status: bus.status,
      dutyStatus: bus.dutyStatus,
      lat: bus.currentLat || 18.5204,
      lng: bus.currentLng || 73.8567,
      speed: bus.currentSpeed || 0,
      heading: bus.currentHeading || 0,
      isOnline,
    },
  ];

  const stops = route?.stops ? route.stops.map((s: any) => ({ name: s.stopName, lat: s.lat, lng: s.lng })) : [];

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      {/* Top Title Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>🚌</span> Live Transport GPS: {transportData.studentName}
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Real-time school bus location, speed telemetry, dynamic ETA, and driver details.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-150">
          <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            {isOnline ? 'GPS Live' : 'GPS Offline'}
          </span>
        </div>
      </div>

      {/* Main Grid: Bus Details + Live Telemetry & Map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Bus & Driver Details */}
        <div className="space-y-6 lg:col-span-1">
          {/* Bus Info Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <span>🚍</span> Bus Details
            </h2>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Bus Number</span>
                <strong className="text-slate-900 font-bold">{bus.busNumber}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Registration</span>
                <strong className="text-slate-900 font-bold">{bus.registrationNo}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Assigned Route</span>
                <strong className="text-blue-600 font-bold">{route?.routeName || 'Standard Route'}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Pickup Stop</span>
                <strong className="text-slate-900 font-bold">{assignedStop?.stopName || 'Default Stop'}</strong>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400 font-medium">Scheduled Pickup / Drop</span>
                <strong className="text-slate-900 font-mono">{bus.pickupTime} / {bus.dropTime}</strong>
              </div>
            </div>
          </div>

          {/* Driver Profile Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <span>👤</span> Driver Profile
            </h2>

            {driver ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 font-black flex items-center justify-center text-lg shadow-inner">
                    {driver.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">{driver.name}</h3>
                    <p className="text-[11px] text-slate-400 font-medium">License: {driver.licenseNumber}</p>
                  </div>
                </div>

                <a
                  href={`tel:${driver.phone}`}
                  className="w-full py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-2xl font-extrabold text-xs flex items-center justify-center gap-2 border border-blue-200 transition-colors cursor-pointer"
                >
                  📞 Call Driver ({driver.phone})
                </a>
              </div>
            ) : (
              <p className="text-xs text-slate-400">No driver assigned to this bus.</p>
            )}
          </div>
        </div>

        {/* Right Column: Dynamic Telemetry Cards & Live Leaflet Map */}
        <div className="lg:col-span-2 space-y-6">
          {/* Live Telemetry Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">LIVE STATUS</span>
              <strong className={`text-xs font-black mt-1 block uppercase ${
                bus.dutyStatus === 'ON_ROUTE' || bus.dutyStatus === 'STARTING_ROUTE' || bus.dutyStatus === 'EN_ROUTE'
                  ? 'text-emerald-600'
                  : bus.dutyStatus === 'NEAR_SCHOOL' || bus.dutyStatus === 'SCHOOL_REACHED'
                  ? 'text-blue-600'
                  : bus.dutyStatus === 'TRIP_COMPLETED'
                  ? 'text-indigo-600'
                  : 'text-slate-500'
              }`}>
                {bus.dutyStatus === 'ON_ROUTE' || bus.dutyStatus === 'EN_ROUTE' || bus.dutyStatus === 'STARTING_ROUTE'
                  ? 'On Route'
                  : bus.dutyStatus === 'NEAR_SCHOOL' || bus.dutyStatus === 'SCHOOL_REACHED'
                  ? 'Near School'
                  : bus.dutyStatus === 'TRIP_COMPLETED'
                  ? 'Trip Completed'
                  : bus.dutyStatus === 'WAITING'
                  ? 'Waiting'
                  : 'Offline'}
              </strong>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">ESTIMATED ETA</span>
              <strong className="text-sm font-black text-emerald-600 mt-1 block">
                {isOnline ? (googleEta ? googleEta : `${telemetry.etaMinutes} Mins Away`) : 'Standby'}
              </strong>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">SPEED</span>
              <strong className="text-sm font-black text-slate-900 mt-1 block">
                {bus.currentSpeed || 0} km/h
              </strong>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">NEXT STOP</span>
              <strong className="text-xs font-black text-slate-800 mt-1 block truncate">
                {telemetry.nextStop}
              </strong>
            </div>
          </div>

          {/* Leaflet Interactive Moving Map */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex justify-between items-center px-2">
              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <span>🗺️</span> Real-Time GPS Route Map
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Auto-updates every 5s • Last ping: {bus.lastGpsUpdate ? new Date(bus.lastGpsUpdate).toLocaleTimeString() : 'N/A'}
              </span>
            </div>

            <GoogleBusMap
              buses={busLocations}
              height="420px"
              zoom={14}
              center={{ lat: bus.currentLat || 18.5204, lng: bus.currentLng || 73.8567 }}
              stops={stops}
              etaDestination={assignedStop?.lat && assignedStop?.lng ? { lat: assignedStop.lat, lng: assignedStop.lng } : null}
              onEtaUpdate={(eta) => setGoogleEta(eta)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
