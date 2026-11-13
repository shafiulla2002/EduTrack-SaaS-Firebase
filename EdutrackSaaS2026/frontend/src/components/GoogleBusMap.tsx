'use client';

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import dynamic from 'next/dynamic';

const StandardBusMap = dynamic(() => import('./StandardBusMap'), {
  ssr: false,
  loading: () => (
    <div
      className="w-full bg-slate-100 rounded-3xl flex items-center justify-center text-slate-400 font-bold animate-pulse border border-slate-200"
      style={{ height: '520px' }}
    >
      Loading Fallback Fleet Map...
    </div>
  ),
});

export interface Stop {
  name: string;
  lat: number;
  lng: number;
}

export interface BusLocation {
  id: string;
  busNumber: string;
  registrationNo?: string;
  driverName?: string;
  driverPhone?: string;
  routeName?: string;
  status?: string;
  dutyStatus?: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  isOnline?: boolean;
  lastUpdate?: string;
}

function getHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface GoogleBusMapProps {
  buses: BusLocation[];
  stops?: Stop[];
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: string;
  etaDestination?: { lat: number; lng: number } | null;
  onEtaUpdate?: (eta: string) => void;
  selectedBusId?: string | null;
  onSelectBus?: (bus: BusLocation | null) => void;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '1.5rem',
};

// High-Contrast HD Street Style - clear roads, bold labels, vivid landmarks
const highContrastStreetStyle = [
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#0f172a' }, { weight: 1.2 }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#1e3a8a' }, { weight: 2 }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f8fafc' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#f1f5f9' }] },
  { featureType: 'poi.school', elementType: 'geometry', stylers: [{ color: '#fef08a' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#dcfce7' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#cbd5e1' }, { weight: 1.8 }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#fbbf24' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#d97706' }, { weight: 2 }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: '#94a3b8' }, { weight: 1.5 }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#1e293b' }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#e2e8f0' }] },
  { featureType: 'transit.station', elementType: 'geometry', stylers: [{ color: '#f1f5f9' }] },
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#7dd3fc' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#0284c7' }] },
];

// Dark Mode Fleet Radar Style
const darkRadarStyle = [
  { featureType: 'all', elementType: 'geometry', stylers: [{ color: '#0b1329' }] },
  { featureType: 'all', elementType: 'labels.text.stroke', stylers: [{ lightness: -80 }] },
  { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2563eb' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0369a1' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
];

const GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  'AIzaSyDdGFriMwQIm-DUMoyaUcH6BXhmhSGnTvU';

// Vector SVG Icon Generator for Sharp Vehicle Display
function createBusSvg(bus: BusLocation, isSelected: boolean) {
  const isOnline = bus.isOnline !== false;
  const ringColor = isSelected ? '#ef4444' : isOnline ? '#10b981' : '#64748b';
  const size = isSelected ? 54 : 46;
  const half = size / 2;

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <filter id="bs" x="0" y="0" width="${size}" height="${size}" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000000" flood-opacity="0.45"/>
      </filter>
      <g filter="url(#bs)">
        <!-- Outer Status Ring -->
        <circle cx="${half}" cy="${half}" r="${half - 3}" fill="${ringColor}" stroke="#ffffff" stroke-width="2.5"/>
        <!-- Yellow Vehicle Shield -->
        <circle cx="${half}" cy="${half}" r="${half - 6.5}" fill="#f59e0b"/>
        <!-- Vector Bus Body -->
        <path d="M${half - 11} ${half - 9}C${half - 11} ${half - 11} ${half - 9} ${half - 12} ${half - 7} ${half - 12}H${half + 7}C${half + 9} ${half - 12} ${half + 11} ${half - 11} ${half + 11} ${half - 9}V${half + 7}C${half + 11} ${half + 8} ${half + 9} ${half + 9} ${half + 7} ${half + 9}V${half + 11}H${half + 5}V${half + 9}H${half - 5}V${half + 11}H${half - 7}V${half + 9}C${half - 9} ${half + 9} ${half - 11} ${half + 8} ${half - 11} ${half + 7}V${half - 9}Z" fill="#0f172a"/>
        <!-- Large Windshield Glass -->
        <path d="M${half - 9} ${half - 8.5}H${half + 9}V${half - 2.5}H${half - 9}V${half - 8.5}Z" fill="#bae6fd"/>
        <!-- Side Windows -->
        <circle cx="${half - 6}" cy="${half + 1.5}" r="1.5" fill="#e2e8f0"/>
        <circle cx="${half - 1}" cy="${half + 1.5}" r="1.5" fill="#e2e8f0"/>
        <circle cx="${half + 4}" cy="${half + 1.5}" r="1.5" fill="#e2e8f0"/>
        <!-- Bright Headlights -->
        <circle cx="${half - 7}" cy="${half + 6}" r="1.5" fill="#fef08a"/>
        <circle cx="${half + 7}" cy="${half + 6}" r="1.5" fill="#fef08a"/>
      </g>
    </svg>
  `;
}

// Vector SVG Teardrop Pin for Bus Stops
function createStopSvg(idx: number) {
  return `
    <svg width="34" height="42" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg">
      <filter id="ss" x="0" y="0" width="34" height="42" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.4"/>
      </filter>
      <g filter="url(#ss)">
        <path d="M17 2C9.268 2 3 8.268 3 16C3 24.5 17 38 17 38C17 38 31 24.5 31 16C31 8.268 24.732 2 17 2Z" fill="#10b981" stroke="#ffffff" stroke-width="2"/>
        <circle cx="17" cy="15" r="7.5" fill="#ffffff"/>
        <text x="17" y="19" font-size="10" font-weight="900" font-family="system-ui, -apple-system, sans-serif" text-anchor="middle" fill="#047857">${idx + 1}</text>
      </g>
    </svg>
  `;
}

class GoogleMapErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.warn('Google Maps runtime caught by ErrorBoundary:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function InnerGoogleBusMap({
  buses,
  stops = [],
  center,
  zoom = 15,
  height = '520px',
  etaDestination,
  onEtaUpdate,
  selectedBusId,
  onSelectBus,
}: GoogleBusMapProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const [map, setMap] = useState<any>(null);
  const [mapTheme, setMapTheme] = useState<'streets' | 'satellite' | 'dark' | 'terrain'>('satellite');
  const [directions, setDirections] = useState<any>(null);
  const [activeBusInfo, setActiveBusInfo] = useState<BusLocation | null>(null);
  const [authError, setAuthError] = useState(false);
  const lastEtaCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastEtaTimeRef = useRef<number>(0);
  const polylineOuterRef = useRef<any>(null);
  const polylineInnerRef = useRef<any>(null);

  // Catch Google's gm_authFailure (e.g. RefererNotAllowedMapError)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prevAuthFailure = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      console.warn('Google Maps RefererNotAllowedMapError detected. Falling back to Standard Map.');
      setAuthError(true);
      if (typeof prevAuthFailure === 'function') {
        try {
          prevAuthFailure();
        } catch {}
      }
    };
    return () => {
      (window as any).gm_authFailure = prevAuthFailure;
    };
  }, []);

  const onLoad = useCallback(function callback(mapInstance: any) {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(function callback() {
    setMap(null);
  }, []);

  // Compute fallback center if not provided (Banaganapalle Town Center)
  const computedCenter = React.useMemo(() => {
    if (center && center.lat && center.lng) return center;
    if (buses.length > 0 && buses[0].lat && buses[0].lng) {
      const avgLat = buses.reduce((acc, b) => acc + (b.lat || 0), 0) / buses.length;
      const avgLng = buses.reduce((acc, b) => acc + (b.lng || 0), 0) / buses.length;
      return { lat: avgLat, lng: avgLng };
    }
    return { lat: 15.3196, lng: 78.1348 };
  }, [center, buses]);

  // Handle external selection change
  useEffect(() => {
    if (selectedBusId) {
      const target = buses.find((b) => b.id === selectedBusId);
      if (target) {
        setActiveBusInfo(target);
        if (map && target.lat && target.lng) {
          try {
            map.panTo({ lat: target.lat, lng: target.lng });
            map.setZoom(16);
          } catch {}
        }
      }
    }
  }, [selectedBusId, buses, map]);

  // Keep active bus info updated if live GPS position shifts
  useEffect(() => {
    if (activeBusInfo) {
      const updated = buses.find((b) => b.id === activeBusInfo.id);
      if (updated) {
        setActiveBusInfo(updated);
      }
    }
  }, [buses, activeBusInfo]);

  // Dynamic ETA calculation
  useEffect(() => {
    const gmaps = typeof window !== 'undefined' ? (window as any).google?.maps : null;
    if (!isLoaded || buses.length !== 1 || !etaDestination || !onEtaUpdate || !gmaps || authError) return;

    const activeBus = buses[0];
    if (!activeBus.lat || !activeBus.lng) return;

    const now = Date.now();
    const timeElapsedMs = now - lastEtaTimeRef.current;

    let shouldRecalculate = false;
    if (!lastEtaCoordsRef.current) {
      shouldRecalculate = true;
    } else {
      const distanceMoved =
        getHaversineDistanceKm(
          activeBus.lat,
          activeBus.lng,
          lastEtaCoordsRef.current.lat,
          lastEtaCoordsRef.current.lng
        ) * 1000;

      if (distanceMoved > 100 || timeElapsedMs > 45000) {
        shouldRecalculate = true;
      }
    }

    if (shouldRecalculate) {
      try {
        const directionsService = new gmaps.DirectionsService();
        directionsService.route(
          {
            origin: { lat: activeBus.lat, lng: activeBus.lng },
            destination: { lat: etaDestination.lat, lng: etaDestination.lng },
            travelMode: gmaps.TravelMode.DRIVING,
          },
          (result: any, status: any) => {
            if (status === gmaps.DirectionsStatus.OK && result) {
              const leg = result.routes[0]?.legs[0];
              if (leg) {
                const etaText = leg.duration?.text || '';
                lastEtaCoordsRef.current = { lat: activeBus.lat, lng: activeBus.lng };
                lastEtaTimeRef.current = now;
                onEtaUpdate(etaText);
              }
            }
          }
        );
      } catch {}
    }
  }, [isLoaded, buses, etaDestination, onEtaUpdate, authError]);

  // Route Polyline via Google Directions API
  useEffect(() => {
    const gmaps = typeof window !== 'undefined' ? (window as any).google?.maps : null;
    if (isLoaded && stops.length >= 2 && !directions && gmaps && !authError) {
      try {
        const directionsService = new gmaps.DirectionsService();
        const origin = stops[0];
        const destination = stops[stops.length - 1];
        const waypoints = stops.slice(1, -1).map((stop) => ({
          location: { lat: stop.lat, lng: stop.lng },
          stopover: true,
        }));

        directionsService.route(
          {
            origin: { lat: origin.lat, lng: origin.lng },
            destination: { lat: destination.lat, lng: destination.lng },
            waypoints,
            travelMode: gmaps.TravelMode.DRIVING,
          },
          (result: any, status: any) => {
            if (status === gmaps.DirectionsStatus.OK && result) {
              setDirections(result);
            }
          }
        );
      } catch {}
    }
  }, [isLoaded, stops, directions, authError]);

  // Safe Multi-Layer Polyline Rendering (Vivid Blue Core + Dark Outline for Sharp Visibility)
  useEffect(() => {
    const gmaps = typeof window !== 'undefined' ? (window as any).google?.maps : null;
    if (!map || !gmaps || authError) return;

    try {
      if (polylineOuterRef.current) {
        polylineOuterRef.current.setMap(null);
        polylineOuterRef.current = null;
      }
      if (polylineInnerRef.current) {
        polylineInnerRef.current.setMap(null);
        polylineInnerRef.current = null;
      }

      let pathCoords: any[] = [];
      if (directions?.routes?.[0]?.overview_path) {
        pathCoords = directions.routes[0].overview_path;
      } else if (stops && stops.length > 1) {
        pathCoords = stops.map((s) => ({ lat: s.lat, lng: s.lng }));
      }

      if (pathCoords.length > 1) {
        // Outer dark casing
        polylineOuterRef.current = new gmaps.Polyline({
          path: pathCoords,
          geodesic: true,
          strokeColor: '#0f172a',
          strokeOpacity: 0.6,
          strokeWeight: 7,
          zIndex: 1,
        });
        polylineOuterRef.current.setMap(map);

        // Inner glowing blue core
        polylineInnerRef.current = new gmaps.Polyline({
          path: pathCoords,
          geodesic: true,
          strokeColor: '#38bdf8',
          strokeOpacity: 0.95,
          strokeWeight: 4,
          zIndex: 2,
        });
        polylineInnerRef.current.setMap(map);
      }
    } catch (e) {
      console.warn('Polyline render error:', e);
    }

    return () => {
      if (polylineOuterRef.current) {
        try {
          polylineOuterRef.current.setMap(null);
        } catch {}
        polylineOuterRef.current = null;
      }
      if (polylineInnerRef.current) {
        try {
          polylineInnerRef.current.setMap(null);
        } catch {}
        polylineInnerRef.current = null;
      }
    };
  }, [map, directions, stops, authError]);

  // Fallback to Standard Leaflet Map if domain restricted or load error
  if (loadError || authError) {
    return (
      <div className="relative w-full rounded-3xl overflow-hidden">
        {authError && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-start gap-2 shadow-xs">
            <span className="text-base">⚠️</span>
            <div>
              <strong className="block font-black">Google Maps API Domain Restriction Active</strong>
              <span>
                Add <code>https://edutrack-live-app.vercel.app/*</code> in Google Cloud Console Credentials. Running in Standard Leaflet mode.
              </span>
            </div>
          </div>
        )}
        <StandardBusMap
          buses={buses.map((b) => ({
            ...b,
            heading: b.heading || 0,
            speed: b.speed || 0,
            isOnline: b.isOnline ?? true,
          }))}
          stops={stops}
          center={computedCenter}
          zoom={zoom}
          height={height}
        />
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        style={{ height }}
        className="w-full bg-slate-100 rounded-3xl flex flex-col items-center justify-center text-slate-500 font-bold gap-2 animate-pulse border border-slate-200"
      >
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-bold tracking-wide">Connecting to Google Maps GPS Engine...</span>
      </div>
    );
  }

  const gmaps = typeof window !== 'undefined' ? (window as any).google?.maps : null;

  // Compute mapTypeId and styles
  const mapTypeId = mapTheme === 'satellite' ? 'hybrid' : mapTheme === 'terrain' ? 'terrain' : 'roadmap';
  const currentStyles =
    mapTheme === 'streets' ? highContrastStreetStyle : mapTheme === 'dark' ? darkRadarStyle : [];

  const dynamicMapOptions = {
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false, // We provide our own beautiful top-bar switcher
    streetViewControl: false,
    fullscreenControl: true,
    gestureHandling: 'cooperative',
    mapTypeId,
    styles: currentStyles,
  };

  return (
    <div style={{ height }} className="w-full relative shadow-inner rounded-3xl overflow-hidden bg-slate-100 border border-slate-200">
      {/* Live Status Overlay Badge */}
      <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-xl shadow-md border border-slate-200 flex items-center gap-2 text-xs font-bold text-slate-800">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>
        <span>Google Maps GPS Tracking ({buses.length} {buses.length === 1 ? 'Bus' : 'Buses'})</span>
      </div>

      {/* Interactive HD Map View Selector */}
      <div className="absolute top-3 right-3 z-10 bg-white/95 backdrop-blur-md p-1 rounded-2xl shadow-md border border-slate-200 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setMapTheme('satellite')}
          className={`px-3 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            mapTheme === 'satellite'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
          title="Ultra-Clear Google Satellite & Aerial Photography"
        >
          🛰️ Satellite (Clear)
        </button>

        <button
          type="button"
          onClick={() => setMapTheme('streets')}
          className={`px-3 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            mapTheme === 'streets'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
          title="High-Contrast Street & Road Network"
        >
          🗺️ HD Streets
        </button>

        <button
          type="button"
          onClick={() => setMapTheme('dark')}
          className={`px-3 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            mapTheme === 'dark'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
          title="Dark Radar Mode"
        >
          🌙 Dark Radar
        </button>

        <button
          type="button"
          onClick={() => setMapTheme('terrain')}
          className={`px-3 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            mapTheme === 'terrain'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
          title="Topographic Terrain"
        >
          🏔️ Terrain
        </button>
      </div>

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={computedCenter}
        zoom={zoom}
        options={dynamicMapOptions}
        onLoad={onLoad}
        onUnmount={onUnmount}
      >
        {/* Stop Markers with Sequence Number Teardrop Pins */}
        {stops.map((stop, idx) => (
          <Marker
            key={`stop-${idx}`}
            position={{ lat: stop.lat, lng: stop.lng }}
            title={`Stop ${idx + 1}: ${stop.name}`}
            icon={{
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(createStopSvg(idx)),
              anchor: gmaps ? new gmaps.Point(17, 38) : undefined,
            }}
          />
        ))}

        {/* Live Sharp Vector Bus Markers */}
        {buses.map((bus) => {
          const isSelected = activeBusInfo?.id === bus.id;
          const svgIcon = createBusSvg(bus, isSelected);
          const size = isSelected ? 54 : 46;
          const half = size / 2;

          return (
            <Marker
              key={bus.id}
              position={{ lat: bus.lat, lng: bus.lng }}
              title={`Bus ${bus.busNumber} • ${Math.round(bus.speed || 0)} km/h`}
              onClick={() => {
                setActiveBusInfo(bus);
                if (onSelectBus) onSelectBus(bus);
              }}
              icon={{
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgIcon),
                anchor: gmaps ? new gmaps.Point(half, half) : undefined,
              }}
            />
          );
        })}

        {/* Interactive InfoWindow on Marker Click */}
        {activeBusInfo && activeBusInfo.lat && activeBusInfo.lng && (
          <InfoWindow
            position={{ lat: activeBusInfo.lat, lng: activeBusInfo.lng }}
            onCloseClick={() => {
              setActiveBusInfo(null);
              if (onSelectBus) onSelectBus(null);
            }}
          >
            <div style={{ minWidth: 230, padding: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 6, marginBottom: 8 }}>
                <strong style={{ color: '#1e3a8a', fontSize: 14 }}>
                  🚌 {activeBusInfo.busNumber}
                </strong>
                <span
                  style={{
                    backgroundColor: activeBusInfo.isOnline !== false ? '#dcfce7' : '#f1f5f9',
                    color: activeBusInfo.isOnline !== false ? '#15803d' : '#475569',
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 9999,
                    textTransform: 'uppercase',
                  }}
                >
                  {activeBusInfo.isOnline !== false ? '● Live' : 'Offline'}
                </span>
              </div>

              <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.6 }}>
                {activeBusInfo.registrationNo && (
                  <div>
                    <strong style={{ color: '#0f172a' }}>Plate:</strong> {activeBusInfo.registrationNo}
                  </div>
                )}
                {activeBusInfo.driverName && (
                  <div>
                    <strong style={{ color: '#0f172a' }}>Driver:</strong> {activeBusInfo.driverName}
                  </div>
                )}
                {activeBusInfo.driverPhone && (
                  <div>
                    <strong style={{ color: '#0f172a' }}>Phone:</strong> {activeBusInfo.driverPhone}
                  </div>
                )}
                {activeBusInfo.routeName && (
                  <div>
                    <strong style={{ color: '#0f172a' }}>Route:</strong> {activeBusInfo.routeName}
                  </div>
                )}
                <div>
                  <strong style={{ color: '#0f172a' }}>Speed:</strong>{' '}
                  <span style={{ color: '#0284c7', fontWeight: 800 }}>
                    {Math.round(activeBusInfo.speed || 0)} km/h
                  </span>
                </div>
                {activeBusInfo.dutyStatus && (
                  <div>
                    <strong style={{ color: '#0f172a' }}>Duty:</strong>{' '}
                    <span style={{ fontWeight: 700, color: '#059669' }}>
                      {activeBusInfo.dutyStatus.replace(/_/g, ' ')}
                    </span>
                  </div>
                )}
                <div style={{ marginTop: 6, paddingTop: 4, borderTop: '1px dashed #e2e8f0', fontSize: 10, color: '#94a3b8' }}>
                  GPS: {activeBusInfo.lat.toFixed(5)}, {activeBusInfo.lng.toFixed(5)}
                </div>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}

export default function GoogleBusMap(props: GoogleBusMapProps) {
  const fallback = (
    <StandardBusMap
      buses={props.buses.map((b) => ({
        ...b,
        heading: b.heading || 0,
        speed: b.speed || 0,
        isOnline: b.isOnline ?? true,
      }))}
      stops={props.stops || []}
      center={props.center || { lat: 15.3196, lng: 78.1348 }}
      zoom={props.zoom || 15}
      height={props.height || '520px'}
    />
  );

  return (
    <GoogleMapErrorBoundary fallback={fallback}>
      <InnerGoogleBusMap {...props} />
    </GoogleMapErrorBoundary>
  );
}
