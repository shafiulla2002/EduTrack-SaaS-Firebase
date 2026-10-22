'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { socketService } from '@/lib/socket';
import { 
  Bus, MapPin, Play, Square, Pause, AlertCircle, Navigation2, CheckCircle2 
} from 'lucide-react';

export default function DriverPortalPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [bus, setBus] = useState<any>(null);
  const [validations, setValidations] = useState<any>(null);
  const [status, setStatus] = useState<string>('OFF_DUTY'); // OFF_DUTY, ON_ROUTE, NEAR_SCHOOL, TRIP_COMPLETED, OFFLINE

  const [gpsActive, setGpsActive] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number, speed: number, heading: number} | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    fetchDutyStatus();
    
    // Connect socket for driver using token
    const token = localStorage.getItem('token');
    if (token) {
      socketService.connect(token);
    }
    
    return () => {
      stopGpsTracking();
      socketService.disconnect();
    };
  }, []);

  const fetchDutyStatus = async () => {
    try {
      setLoading(true);
      const res = await api.get('/transport/driver/assigned-bus');
      setDriverInfo(res.data.driver);
      setBus(res.data.bus);
      setValidations(res.data.validations);
      
      if (res.data.bus) {
        setStatus(res.data.bus.dutyStatus);
        if (res.data.bus.dutyStatus === 'ON_ROUTE' || res.data.bus.dutyStatus === 'NEAR_SCHOOL') {
          startGpsTracking(res.data.bus.id);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load driver duty status');
    } finally {
      setLoading(false);
    }
  };

  const updateDuty = async (newStatus: string) => {
    try {
      await api.post('/transport/driver/duty', { dutyStatus: newStatus });
      setStatus(newStatus);
      
      if (newStatus === 'ON_ROUTE' && bus) {
        startGpsTracking(bus.id);
      } else if (newStatus === 'TRIP_COMPLETED' || newStatus === 'OFF_DUTY' || newStatus === 'OFFLINE') {
        stopGpsTracking();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update duty');
    }
  };

  const startGpsTracking = (busId: string) => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    
    setGpsActive(true);

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, speed, heading, accuracy } = position.coords;
        const speedKmh = speed ? (speed * 3.6) : 0;
        
        const loc = { lat: latitude, lng: longitude, speed: speedKmh, heading: heading || 0 };
        setCurrentLocation(loc);

        // Emit over socket
        const socket = socketService.getSocket();
        if (socket && socket.connected) {
          socket.emit('driverGpsUpdate', {
            busId,
            tripId: 'current',
            latitude,
            longitude,
            speed: speedKmh,
            heading: heading || 0,
            accuracy,
            dutyStatus: status
          });
        }
      },
      (error) => {
        console.error("GPS Error:", error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
      }
    );
  };

  const stopGpsTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setGpsActive(false);
  };

  if (loading) {
    return <div className="p-8 text-center"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div></div>;
  }

  if (error) {
    return <div className="p-8 text-red-500 font-bold">{error}</div>;
  }

  if (!validations?.hasAssignedBus || !validations?.hasAssignedRoute) {
    return (
      <div className="max-w-xl mx-auto mt-10 p-8 bg-white border border-slate-200 rounded-3xl text-center">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-800">No Active Route</h2>
        <p className="text-sm text-slate-500 mt-2">{validations?.validationError}</p>
      </div>
    );
  }

  const isDriving = status === 'ON_ROUTE' || status === 'NEAR_SCHOOL';

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div className="bg-[#2E5BFF] text-white p-6 rounded-3xl shadow-lg">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">{bus.route.routeName}</h1>
            <p className="text-blue-100 mt-1 font-medium">{bus.busNumber} • {bus.registrationNo}</p>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
            gpsActive ? 'bg-emerald-500 text-white animate-pulse' : 'bg-white/20 text-blue-100'
          }`}>
            {gpsActive ? 'GPS ACTIVE' : 'GPS STANDBY'}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4">
          <div className="bg-white/10 rounded-2xl p-4">
            <p className="text-blue-200 text-xs font-bold uppercase tracking-wider mb-1">Speed</p>
            <p className="text-2xl font-bold">{currentLocation ? Math.round(currentLocation.speed) : '--'} <span className="text-sm font-medium">km/h</span></p>
          </div>
          <div className="bg-white/10 rounded-2xl p-4">
            <p className="text-blue-200 text-xs font-bold uppercase tracking-wider mb-1">Stops</p>
            <p className="text-2xl font-bold">{bus.route.stops.length}</p>
          </div>
        </div>
      </div>

      {/* Duty Controls */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4">Trip Controls</h3>
        
        <div className="grid grid-cols-2 gap-4">
          {!isDriving && status !== 'TRIP_COMPLETED' && (
            <button
              onClick={() => updateDuty('ON_ROUTE')}
              className="col-span-2 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-colors shadow-lg shadow-emerald-500/20"
            >
              <Play className="w-6 h-6 fill-current" /> Start Trip
            </button>
          )}

          {isDriving && (
            <>
              <button
                onClick={() => updateDuty('NEAR_SCHOOL')}
                className={`py-4 rounded-2xl font-bold text-sm flex flex-col items-center justify-center gap-2 transition-colors ${
                  status === 'NEAR_SCHOOL' ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-500' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <MapPin className="w-6 h-6" /> Reached School
              </button>
              
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to end this trip?')) {
                    updateDuty('TRIP_COMPLETED');
                  }
                }}
                className="py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-bold text-sm flex flex-col items-center justify-center gap-2 transition-colors shadow-lg shadow-rose-500/20"
              >
                <Square className="w-6 h-6 fill-current" /> End Trip
              </button>
            </>
          )}
          
          {status === 'TRIP_COMPLETED' && (
            <div className="col-span-2 py-4 bg-emerald-50 text-emerald-700 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 border border-emerald-200">
              <CheckCircle2 className="w-6 h-6" /> Trip Completed
            </div>
          )}
        </div>
      </div>
      
      {/* Route Info */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-800">Route Overview</h3>
        <div className="relative pl-6 space-y-6">
          <div className="absolute top-2 bottom-2 left-[11px] w-0.5 bg-slate-200"></div>
          {bus.route.stops.map((stop: any, idx: number) => (
            <div key={stop.id} className="relative">
              <div className="absolute -left-6 w-3 h-3 bg-white border-2 border-[#2E5BFF] rounded-full top-1.5 z-10"></div>
              <h4 className="font-bold text-slate-800 text-sm">{stop.stopName}</h4>
              <p className="text-xs text-slate-500 font-medium">{stop.pickupTime} - {stop.dropTime}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
