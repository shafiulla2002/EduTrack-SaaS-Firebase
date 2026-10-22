'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { socketService } from '@/lib/socket';
import GoogleBusMap from '@/components/GoogleBusMap';
import { Navigation2, Activity, Map, Users, AlertTriangle } from 'lucide-react';

export default function AdminLiveTransportPage() {
  const [buses, setBuses] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await api.get('/transport/admin/dashboard');
      setBuses(res.data.buses);
      setStats(res.data.kpis);

      // Connect to Socket
      const token = localStorage.getItem('token');
      if (token) {
        const socket = socketService.connect(token);
        if (socket) {
          socket.emit('joinAdminTracking');

          socket.off('adminBusLocationUpdate');
          socket.on('adminBusLocationUpdate', (update: any) => {
            setBuses((prevBuses) => {
              return prevBuses.map((bus) => {
                if (bus.id === update.id) {
                  return {
                    ...bus,
                    currentLat: update.currentLat,
                    currentLng: update.currentLng,
                    currentSpeed: update.currentSpeed,
                    currentHeading: update.currentHeading,
                    dutyStatus: update.dutyStatus,
                    lastGpsUpdate: update.lastGpsUpdate,
                  };
                }
                return bus;
              });
            });
          });
        }
      }
    } catch (err) {
      console.error('Failed to load live tracking data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // refresh full list every 60s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const mapBuses = buses.map(bus => {
    const isOnline = bus.lastGpsUpdate 
      ? (Date.now() - new Date(bus.lastGpsUpdate).getTime()) < 180000 && bus.dutyStatus !== 'OFFLINE' && bus.dutyStatus !== 'OFF_DUTY'
      : (bus.dutyStatus === 'ON_ROUTE' || bus.dutyStatus === 'NEAR_SCHOOL');

    return {
      id: bus.id,
      busNumber: bus.busNumber,
      lat: bus.currentLat || 18.5204,
      lng: bus.currentLng || 73.8567,
      speed: bus.currentSpeed || 0,
      heading: bus.currentHeading || 0,
      isOnline,
    };
  });

  // Calculate dynamic center based on active buses
  const centerLat = mapBuses.length > 0 ? (mapBuses.reduce((sum, b) => sum + b.lat, 0) / mapBuses.length) : 18.5204;
  const centerLng = mapBuses.length > 0 ? (mapBuses.reduce((sum, b) => sum + b.lng, 0) / mapBuses.length) : 73.8567;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 animate-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Navigation2 className="w-6 h-6 text-blue-600" /> Live Fleet Tracking
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Monitor all school buses in real-time</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <Map className="w-5 h-5 text-indigo-500" />
            <span className="text-xs font-bold uppercase tracking-wider">Active Routes</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{stats?.routesRunning || 0}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <Activity className="w-5 h-5 text-emerald-500" />
            <span className="text-xs font-bold uppercase tracking-wider">Buses En Route</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{stats?.busesRunning || 0}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <Users className="w-5 h-5 text-blue-500" />
            <span className="text-xs font-bold uppercase tracking-wider">Students Assigned</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{stats?.studentsAssigned || 0}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <span className="text-xs font-bold uppercase tracking-wider">GPS Offline</span>
          </div>
          <p className="text-2xl font-black text-rose-600">{stats?.gpsNotUpdating || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
            <GoogleBusMap
              buses={mapBuses}
              stops={[]}
              center={{ lat: centerLat, lng: centerLng }}
              zoom={12}
              height="600px"
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs">Active Buses</h3>
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {buses.filter(b => b.status === 'ACTIVE').map(bus => (
              <div key={bus.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 transition-colors cursor-pointer">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-900">{bus.busNumber}</h4>
                    <p className="text-xs text-slate-500">{bus.route?.routeName || 'No Route'}</p>
                  </div>
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    bus.dutyStatus === 'ON_ROUTE' ? 'bg-emerald-500 animate-pulse' :
                    bus.dutyStatus === 'NEAR_SCHOOL' ? 'bg-blue-500' : 'bg-slate-300'
                  }`} />
                </div>
                <div className="mt-3 flex justify-between items-end">
                  <p className="text-[10px] font-medium text-slate-400">Driver: {bus.driver?.user?.name || 'N/A'}</p>
                  <p className="text-xs font-bold text-slate-700">{bus.currentSpeed || 0} km/h</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
