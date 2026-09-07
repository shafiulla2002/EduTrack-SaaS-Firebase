'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { api, fastGet } from '@/lib/api';

const LiveBusMap = dynamic(() => import('@/components/LiveBusMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[450px] w-full bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 font-medium text-xs animate-pulse">
      Loading Live Multi-Bus Fleet Map...
    </div>
  ),
});

export default function SchoolAdminTransportPage() {
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'buses' | 'drivers' | 'routes' | 'stops' | 'students' | 'history' | 'reports'
  >('dashboard');

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [buses, setBuses] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [studentAssignments, setStudentAssignments] = useState<any[]>([]);
  const [tripHistory, setTripHistory] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  // Modals & Forms
  const [showBusModal, setShowBusModal] = useState(false);
  const [busForm, setBusForm] = useState({
    busNumber: '',
    registrationNo: '',
    vehicleModel: '',
    capacity: 40,
    pickupTime: '07:30 AM',
    dropTime: '02:30 PM',
    driverId: '',
    routeId: '',
    status: 'ACTIVE',
  });

  const [showEditBusModal, setShowEditBusModal] = useState(false);
  const [editingBusId, setEditingBusId] = useState<string | null>(null);
  const [editBusForm, setEditBusForm] = useState({
    busNumber: '',
    registrationNo: '',
    vehicleModel: '',
    capacity: 40,
    driverId: '',
    routeId: '',
    status: 'ACTIVE',
  });

  const [showDriverModal, setShowDriverModal] = useState(false);
  const [driverForm, setDriverForm] = useState({
    name: '',
    email: '',
    phone: '',
    employeeId: '',
    licenseNumber: '',
    licenseExpiry: '',
    aadhaarNo: '',
    address: '',
    emergencyContact: '',
  });

  const [showEditDriverModal, setShowEditDriverModal] = useState(false);
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [editDriverForm, setEditDriverForm] = useState({
    name: '',
    phone: '',
    licenseNumber: '',
    emergencyContact: '',
  });

  const [showRouteModal, setShowRouteModal] = useState(false);
  const [routeForm, setRouteForm] = useState({
    routeName: '',
    startPoint: '',
    endPoint: '',
    description: '',
  });

  const [showStopModal, setShowStopModal] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [stopForm, setStopForm] = useState({
    stopName: '',
    sequenceOrder: 1,
    pickupTime: '07:45 AM',
    dropTime: '02:45 PM',
    lat: 18.5204,
    lng: 73.8567,
  });

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [dashRes, busesRes, driversRes, routesRes, studentsRes, historyRes] = await Promise.all([
        fastGet('/transport/admin/dashboard', undefined, { ttlMs: 30000 }).catch(() => ({ data: null })),
        fastGet('/transport/buses', undefined, { ttlMs: 30000 }).catch(() => ({ data: [] })),
        fastGet('/transport/drivers', undefined, { ttlMs: 30000 }).catch(() => ({ data: [] })),
        fastGet('/transport/routes', undefined, { ttlMs: 30000 }).catch(() => ({ data: [] })),
        fastGet('/transport/students/assignments', undefined, { ttlMs: 30000 }).catch(() => ({ data: [] })),
        fastGet('/transport/trip-history', undefined, { ttlMs: 30000 }).catch(() => ({ data: [] })),
      ]);

      setDashboardData(dashRes.data);
      setBuses(busesRes.data || []);
      setDrivers(driversRes.data || []);
      setRoutes(routesRes.data || []);
      setStudentAssignments(studentsRes.data || []);
      setTripHistory(historyRes.data || []);
    } catch (err) {
      console.error('Failed to load transport admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(() => {
      fastGet('/transport/admin/dashboard', undefined, { ttlMs: 15000 }).then((res) => setDashboardData(res.data)).catch(() => {});
    }, 30000); // 30s auto refresh for admin
    return () => clearInterval(interval);
  }, []);

  const handleCreateBus = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/transport/buses', busForm);
      setShowBusModal(false);
      setBusForm({ busNumber: '', registrationNo: '', vehicleModel: '', capacity: 40, pickupTime: '07:30 AM', dropTime: '02:30 PM', driverId: '', routeId: '', status: 'ACTIVE' });
      await fetchAllData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create bus');
    }
  };

  const openEditBusModal = (bus: any) => {
    setEditingBusId(bus.id);
    setEditBusForm({
      busNumber: bus.busNumber || '',
      registrationNo: bus.registrationNo || '',
      vehicleModel: bus.vehicleModel || '',
      capacity: bus.capacity || 40,
      driverId: bus.driverId || '',
      routeId: bus.routeId || '',
      status: bus.status || 'ACTIVE',
    });
    setShowEditBusModal(true);
  };

  const handleUpdateBus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBusId) return;
    try {
      await api.patch(`/transport/buses/${editingBusId}`, editBusForm);
      setShowEditBusModal(false);
      setEditingBusId(null);
      await fetchAllData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update bus');
    }
  };

  const handleDeleteBus = async (busId: string, busNumber: string) => {
    if (!confirm(`Are you sure you want to delete bus ${busNumber}?`)) return;
    try {
      await api.delete(`/transport/buses/${busId}`);
      await fetchAllData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete bus');
    }
  };

  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/transport/drivers', driverForm);
      setShowDriverModal(false);
      setDriverForm({ name: '', email: '', phone: '', employeeId: '', licenseNumber: '', licenseExpiry: '', aadhaarNo: '', address: '', emergencyContact: '' });
      await fetchAllData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create driver');
    }
  };

  const openEditDriverModal = (driver: any) => {
    setEditingDriverId(driver.id);
    setEditDriverForm({
      name: driver.user?.name || '',
      phone: driver.user?.phone || driver.whatsappNumber || '',
      licenseNumber: driver.licenseNumber || '',
      emergencyContact: driver.emergencyContact || '',
    });
    setShowEditDriverModal(true);
  };

  const handleUpdateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriverId) return;
    try {
      await api.patch(`/transport/drivers/${editingDriverId}`, editDriverForm);
      setShowEditDriverModal(false);
      setEditingDriverId(null);
      await fetchAllData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update driver details');
    }
  };

  const handleDeleteDriver = async (driverId: string, driverName: string) => {
    if (!confirm(`Are you sure you want to delete driver ${driverName}?`)) return;
    try {
      await api.delete(`/transport/drivers/${driverId}`);
      await fetchAllData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete driver');
    }
  };

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/transport/routes', routeForm);
      setShowRouteModal(false);
      setRouteForm({ routeName: '', startPoint: '', endPoint: '', description: '' });
      await fetchAllData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create route');
    }
  };

  const handleCreateStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRouteId) return;
    try {
      await api.post(`/transport/routes/${selectedRouteId}/stops`, stopForm);
      setShowStopModal(false);
      setStopForm({ stopName: '', sequenceOrder: 1, pickupTime: '07:45 AM', dropTime: '02:45 PM', lat: 18.5204, lng: 73.8567 });
      await fetchAllData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add stop');
    }
  };

  const handleAssignStudent = async (studentId: string, busId: string | null, busStopId: string | null) => {
    try {
      await api.post('/transport/students/assign', { studentId, busId, busStopId });
      await fetchAllData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to assign student');
    }
  };

  const kpis = dashboardData?.kpis || {
    totalBuses: buses.length,
    activeBuses: buses.filter((b) => b.status === 'ACTIVE').length,
    busesRunning: buses.filter((b) => b.dutyStatus !== 'OFF_DUTY').length,
    driversOnDuty: buses.filter((b) => b.dutyStatus !== 'OFF_DUTY').length,
    offlineDrivers: buses.length - buses.filter((b) => b.dutyStatus !== 'OFF_DUTY').length,
    gpsNotUpdating: 0,
    studentsAssigned: studentAssignments.filter((s) => s.busId).length,
    routesRunning: routes.length,
    delayedBuses: 0,
  };

  const [selectedRouteFilter, setSelectedRouteFilter] = useState('');
  const [selectedDriverFilter, setSelectedDriverFilter] = useState('');

  const filteredBuses = buses.filter((b) => {
    if (selectedRouteFilter && b.routeId !== selectedRouteFilter) return false;
    if (selectedDriverFilter && b.driverId !== selectedDriverFilter) return false;
    return true;
  });

  const busLocations = filteredBuses
    .filter((b) => b.currentLat && b.currentLng)
    .map((b) => ({
      id: b.id,
      busNumber: b.busNumber,
      registrationNo: b.registrationNo,
      driverName: b.driver?.user?.name,
      status: b.status,
      dutyStatus: b.dutyStatus,
      lat: b.currentLat,
      lng: b.currentLng,
      speed: b.currentSpeed || 0,
      isOnline: b.dutyStatus !== 'OFF_DUTY' && b.dutyStatus !== 'OFFLINE',
    }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>🚌</span> Transport &amp; Fleet Management
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Real-Time Mobile GPS Tracking, Bus Roster, Drivers, Routes, and Student Assignments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBusModal(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold text-xs shadow-md cursor-pointer transition-all flex items-center gap-1.5"
          >
            <span>+ Add Bus</span>
          </button>
          <button
            onClick={() => setShowDriverModal(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs shadow-md cursor-pointer transition-all flex items-center gap-1.5"
          >
            <span>+ Add Driver</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-200">
        {[
          { id: 'dashboard', label: '📊 Live Dashboard' },
          { id: 'buses', label: `🚌 Bus Management (${buses.length})` },
          { id: 'drivers', label: `👨‍✈️ Driver Management (${drivers.length})` },
          { id: 'routes', label: `🗺️ Routes (${routes.length})` },
          { id: 'stops', label: '🚏 Bus Stops' },
          { id: 'students', label: '🎓 Student Assignments' },
          { id: 'history', label: '📜 Trip History' },
          { id: 'reports', label: '📈 Reports' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: LIVE DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6 animate-in fade-in">
          {/* 8 Analytics KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: 'Total Buses', val: kpis.totalBuses, color: 'text-slate-900', bg: 'bg-slate-50' },
              { label: 'Active Buses', val: kpis.activeBuses, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Buses Running', val: kpis.busesRunning, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Drivers On Duty', val: kpis.driversOnDuty, color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'Offline Drivers', val: kpis.offlineDrivers, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'GPS Stale (>30s)', val: kpis.gpsNotUpdating, color: 'text-rose-600', bg: 'bg-rose-50' },
              { label: 'Students Assigned', val: kpis.studentsAssigned, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Routes Running', val: kpis.routesRunning, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            ].map((k, i) => (
              <div key={i} className={`p-4 rounded-2xl border border-slate-200 ${k.bg} shadow-xs text-center space-y-1`}>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block leading-tight">{k.label}</span>
                <strong className={`text-xl font-black ${k.color} block`}>{k.val}</strong>
              </div>
            ))}
          </div>

          {/* Filter Controls & Multi-Bus Leaflet Map */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <span>🗺️</span> Multi-Bus Live GPS Fleet Overview
              </h2>

              {/* Fleet Map Filters */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={selectedRouteFilter}
                  onChange={(e) => setSelectedRouteFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none text-slate-700"
                >
                  <option value="">All Routes</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>{r.routeName}</option>
                  ))}
                </select>

                <select
                  value={selectedDriverFilter}
                  onChange={(e) => setSelectedDriverFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none text-slate-700"
                >
                  <option value="">All Drivers</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.user?.name}</option>
                  ))}
                </select>

                {(selectedRouteFilter || selectedDriverFilter) && (
                  <button
                    onClick={() => { setSelectedRouteFilter(''); setSelectedDriverFilter(''); }}
                    className="text-xs text-blue-600 font-bold hover:underline"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>

            <LiveBusMap buses={busLocations} height="480px" zoom={12} />
          </div>
        </div>
      )}

      {/* TAB 2: BUS MANAGEMENT */}
      {activeTab === 'buses' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs space-y-4 p-6">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Bus Fleet Roster</h2>
            <button
              onClick={() => setShowBusModal(true)}
              className="px-3.5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
            >
              + Add Bus
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-extrabold uppercase tracking-wider border-b border-slate-150">
                  <th className="p-3">Bus Number</th>
                  <th className="p-3">Registration</th>
                  <th className="p-3">Model &amp; Capacity</th>
                  <th className="p-3">Assigned Driver</th>
                  <th className="p-3">Assigned Route</th>
                  <th className="p-3">Duty Status</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {buses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      No buses created yet. Click "+ Add Bus" above.
                    </td>
                  </tr>
                ) : (
                  buses.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">{b.busNumber}</td>
                      <td className="p-3 font-mono">{b.registrationNo}</td>
                      <td className="p-3">{b.vehicleModel} ({b.capacity} Seats)</td>
                      <td className="p-3 font-bold text-blue-700">{b.driver?.user?.name || 'Unassigned'}</td>
                      <td className="p-3 font-bold text-emerald-700">{b.route?.routeName || 'Unassigned'}</td>
                      <td className="p-3 font-extrabold text-xs">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${b.dutyStatus !== 'OFF_DUTY' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                          {b.dutyStatus}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${b.status === 'ACTIVE' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'}`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => openEditBusModal(b)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold rounded-lg text-[11px] transition-colors cursor-pointer"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDeleteBus(b.id, b.busNumber)}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold rounded-lg text-[11px] transition-colors cursor-pointer"
                        >
                          🗑️ Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DRIVER MANAGEMENT */}
      {activeTab === 'drivers' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs space-y-4 p-6">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Driver Roster (Non-Teaching Staff)</h2>
            <button
              onClick={() => setShowDriverModal(true)}
              className="px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
            >
              + Add Driver
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-extrabold uppercase tracking-wider border-b border-slate-150">
                  <th className="p-3">Driver Name</th>
                  <th className="p-3">Employee ID</th>
                  <th className="p-3">License Number</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Emergency Contact</th>
                  <th className="p-3">Assigned Bus</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {drivers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No drivers created yet. Click "+ Add Driver" above.
                    </td>
                  </tr>
                ) : (
                  drivers.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">{d.user?.name}</td>
                      <td className="p-3 font-mono">{d.employeeId}</td>
                      <td className="p-3 font-bold">{d.licenseNumber || 'Verified'}</td>
                      <td className="p-3">{d.user?.phone || 'N/A'}</td>
                      <td className="p-3">{d.emergencyContact || 'N/A'}</td>
                      <td className="p-3 font-bold text-blue-600">{d.assignedBus?.busNumber || 'None'}</td>
                      <td className="p-3 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => openEditDriverModal(d)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold rounded-lg text-[11px] transition-colors cursor-pointer"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDeleteDriver(d.id, d.user?.name || 'Driver')}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold rounded-lg text-[11px] transition-colors cursor-pointer"
                        >
                          🗑️ Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4 & 5: ROUTES & STOPS */}
      {(activeTab === 'routes' || activeTab === 'stops') && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Configured Routes &amp; Bus Stops</h2>
              <button
                onClick={() => setShowRouteModal(true)}
                className="px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                + Add Route
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {routes.map((r) => (
                <div key={r.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900">{r.routeName}</h3>
                      <p className="text-xs text-slate-500">{r.startPoint} ➔ {r.endPoint}</p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedRouteId(r.id);
                        setShowStopModal(true);
                      }}
                      className="px-2.5 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg text-[11px] font-bold cursor-pointer"
                    >
                      + Add Stop
                    </button>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-200">
                    <strong className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                      Stops Sequence ({r.stops?.length || 0})
                    </strong>
                    {r.stops && r.stops.length > 0 ? (
                      r.stops.map((s: any, idx: number) => (
                        <div key={s.id} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-150 text-xs font-medium">
                          <span>
                            <strong className="text-blue-600 mr-2">{idx + 1}.</strong> {s.stopName}
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">{s.pickupTime}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400">No stops configured for this route.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: STUDENT BUS ASSIGNMENT */}
      {activeTab === 'students' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Student Bus &amp; Stop Allocation</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-extrabold uppercase tracking-wider border-b border-slate-150">
                  <th className="p-3">Student Name</th>
                  <th className="p-3">Class &amp; Section</th>
                  <th className="p-3">Assigned Bus</th>
                  <th className="p-3">Assigned Pickup Stop</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {studentAssignments.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{s.user?.name}</td>
                    <td className="p-3">{s.classSection?.class?.name} - {s.classSection?.section?.name}</td>
                    <td className="p-3 font-bold text-blue-700">{s.bus?.busNumber || 'None'}</td>
                    <td className="p-3 font-bold text-emerald-700">{s.busStop?.stopName || 'None'}</td>
                    <td className="p-3">
                      <select
                        value={s.busId || ''}
                        onChange={(e) => handleAssignStudent(s.id, e.target.value || null, null)}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none font-semibold"
                      >
                        <option value="">No Transport</option>
                        {buses.map((b) => (
                          <option key={b.id} value={b.id}>
                            Bus {b.busNumber} ({b.registrationNo})
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: TRIP HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Transport Trip Audit Logs</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-extrabold uppercase tracking-wider border-b border-slate-150">
                  <th className="p-3">Start Time</th>
                  <th className="p-3">Bus Number</th>
                  <th className="p-3">Driver</th>
                  <th className="p-3">Route</th>
                  <th className="p-3">Arrival Timestamp</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {tripHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No trip logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  tripHistory.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono">{new Date(t.startTime).toLocaleString()}</td>
                      <td className="p-3 font-bold text-slate-900">{t.bus?.busNumber}</td>
                      <td className="p-3 font-bold text-blue-700">{t.driver?.user?.name || 'Driver'}</td>
                      <td className="p-3">{t.route?.routeName || 'Route'}</td>
                      <td className="p-3 font-mono">{t.arrivalTimestamp ? new Date(t.arrivalTimestamp).toLocaleTimeString() : 'En Route'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD BUS */}
      {showBusModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h2 className="text-lg font-black text-slate-900">Create New Bus</h2>
            <form onSubmit={handleCreateBus} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Bus Number (e.g. BUS-01)</label>
                <input
                  type="text"
                  required
                  value={busForm.busNumber}
                  onChange={(e) => setBusForm({ ...busForm, busNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold outline-none"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Registration Number (e.g. MH-12-FE-4321)</label>
                <input
                  type="text"
                  required
                  value={busForm.registrationNo}
                  onChange={(e) => setBusForm({ ...busForm, registrationNo: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold outline-none"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Assign Driver</label>
                <select
                  value={busForm.driverId}
                  onChange={(e) => setBusForm({ ...busForm, driverId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold outline-none"
                >
                  <option value="">Unassigned</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.user?.name} ({d.employeeId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1">Assign Route</label>
                <select
                  value={busForm.routeId}
                  onChange={(e) => setBusForm({ ...busForm, routeId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold outline-none"
                >
                  <option value="">Unassigned</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.routeName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBusModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md"
                >
                  Create Bus
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD DRIVER */}
      {showDriverModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h2 className="text-lg font-black text-slate-900">Add Non-Teaching Driver</h2>
            <form onSubmit={handleCreateDriver} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={driverForm.name}
                  onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold outline-none"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Phone Number</label>
                <input
                  type="text"
                  required
                  value={driverForm.phone}
                  onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold outline-none"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Driving License Number</label>
                <input
                  type="text"
                  required
                  value={driverForm.licenseNumber}
                  onChange={(e) => setDriverForm({ ...driverForm, licenseNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDriverModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md"
                >
                  Create Driver
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD ROUTE */}
      {showRouteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h2 className="text-lg font-black text-slate-900">Create Bus Route</h2>
            <form onSubmit={handleCreateRoute} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Route Name (e.g. Route A - Kharadi to Viman Nagar)</label>
                <input
                  type="text"
                  required
                  value={routeForm.routeName}
                  onChange={(e) => setRouteForm({ ...routeForm, routeName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRouteModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md"
                >
                  Create Route
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD STOP */}
      {showStopModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h2 className="text-lg font-black text-slate-900">Add Bus Stop</h2>
            <form onSubmit={handleCreateStop} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Stop Name (e.g. Kharadi Bypass)</label>
                <input
                  type="text"
                  required
                  value={stopForm.stopName}
                  onChange={(e) => setStopForm({ ...stopForm, stopName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={stopForm.lat}
                    onChange={(e) => setStopForm({ ...stopForm, lat: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={stopForm.lng}
                    onChange={(e) => setStopForm({ ...stopForm, lng: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStopModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md"
                >
                  Add Stop
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT DRIVER */}
      {showEditDriverModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-900">✏️ Edit Driver Details</h2>
              <button
                onClick={() => setShowEditDriverModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdateDriver} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1 text-slate-700">Driver Full Name</label>
                <input
                  type="text"
                  required
                  value={editDriverForm.name}
                  onChange={(e) => setEditDriverForm({ ...editDriverForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-700">Phone Number (Staff Portal Login)</label>
                <input
                  type="text"
                  required
                  value={editDriverForm.phone}
                  onChange={(e) => setEditDriverForm({ ...editDriverForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-700">Driving License Number</label>
                <input
                  type="text"
                  required
                  value={editDriverForm.licenseNumber}
                  onChange={(e) => setEditDriverForm({ ...editDriverForm, licenseNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-700">Emergency Contact Phone</label>
                <input
                  type="text"
                  value={editDriverForm.emergencyContact}
                  onChange={(e) => setEditDriverForm({ ...editDriverForm, emergencyContact: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold outline-none focus:border-blue-500"
                  placeholder="Optional emergency contact"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditDriverModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT BUS */}
      {showEditBusModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-900">✏️ Edit Bus Details</h2>
              <button
                onClick={() => setShowEditBusModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdateBus} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1 text-slate-700">Bus Number (e.g. BUS-01)</label>
                <input
                  type="text"
                  required
                  value={editBusForm.busNumber}
                  onChange={(e) => setEditBusForm({ ...editBusForm, busNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-700">Registration Number (e.g. MH-12-FE-4321)</label>
                <input
                  type="text"
                  required
                  value={editBusForm.registrationNo}
                  onChange={(e) => setEditBusForm({ ...editBusForm, registrationNo: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-700">Vehicle Model</label>
                <input
                  type="text"
                  value={editBusForm.vehicleModel}
                  onChange={(e) => setEditBusForm({ ...editBusForm, vehicleModel: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold outline-none focus:border-blue-500"
                  placeholder="e.g. Standard School Bus"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1 text-slate-700">Seating Capacity</label>
                  <input
                    type="number"
                    required
                    value={editBusForm.capacity}
                    onChange={(e) => setEditBusForm({ ...editBusForm, capacity: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-slate-700">Bus Status</label>
                  <select
                    value={editBusForm.status}
                    onChange={(e) => setEditBusForm({ ...editBusForm, status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold outline-none focus:border-blue-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-700">Assigned Driver</label>
                <select
                  value={editBusForm.driverId}
                  onChange={(e) => setEditBusForm({ ...editBusForm, driverId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold outline-none focus:border-blue-500"
                >
                  <option value="">Unassigned</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.user?.name} ({d.employeeId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-700">Assigned Route</label>
                <select
                  value={editBusForm.routeId}
                  onChange={(e) => setEditBusForm({ ...editBusForm, routeId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold outline-none focus:border-blue-500"
                >
                  <option value="">Unassigned</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.routeName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditBusModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
