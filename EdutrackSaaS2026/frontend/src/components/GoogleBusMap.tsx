'use client';

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import dynamic from 'next/dynamic';

const StandardBusMap = dynamic(() => import('./StandardBusMap'), {
  ssr: false,
  loading: () => (
    <div
      className="w-full bg-slate-100 rounded-3xl flex items-center justify-center text-slate-400 font-bold animate-pulse border border-slate-200"
      style={{ height: '450px' }}
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
  const R = 6371; // Earth radius in km
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

const mapOptions: any = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: true,
  streetViewControl: false,
  fullscreenControl: true,
  gestureHandling: 'cooperative',
};

const GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  'AIzaSyDdGFriMwQIm-DUMoyaUcH6BXhmhSGnTvU';

// Robust React ErrorBoundary to prevent any Google Maps script error from crashing Next.js
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
    console.warn('Caught Google Maps runtime exception:', error);
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
  zoom = 13,
  height = '500px',
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
  const [directions, setDirections] = useState<any>(null);
  const [activeBusInfo, setActiveBusInfo] = useState<BusLocation | null>(null);
  const [authError, setAuthError] = useState(false);
  const lastEtaCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastEtaTimeRef = useRef<number>(0);
  const polylineRef = useRef<any>(null);

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

  // Compute fallback center if not provided
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
            map.setZoom(15);
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

  // Fit bounds when multiple buses are present on initial load
  const hasFitBoundsRef = useRef(false);
  useEffect(() => {
    const gmaps = typeof window !== 'undefined' ? (window as any).google?.maps : null;
    if (map && buses.length > 1 && !hasFitBoundsRef.current && gmaps && !authError) {
      try {
        const bounds = new gmaps.LatLngBounds();
        let hasValidCoords = false;
        buses.forEach((b) => {
          if (b.lat && b.lng) {
            bounds.extend({ lat: b.lat, lng: b.lng });
            hasValidCoords = true;
          }
        });
        stops.forEach((s) => {
          if (s.lat && s.lng) {
            bounds.extend({ lat: s.lat, lng: s.lng });
            hasValidCoords = true;
          }
        });
        if (hasValidCoords) {
          map.fitBounds(bounds, 50);
          hasFitBoundsRef.current = true;
        }
      } catch (err) {
        console.warn('Bounds fitting error:', err);
      }
    }
  }, [map, buses, stops, authError]);

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

  // Safe Native Polyline Drawing to completely prevent the `setAt` / `setPath` unhandled crash
  useEffect(() => {
    const gmaps = typeof window !== 'undefined' ? (window as any).google?.maps : null;
    if (!map || !gmaps || authError) return;

    try {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }

      let pathCoords: any[] = [];
      if (directions?.routes?.[0]?.overview_path) {
        pathCoords = directions.routes[0].overview_path;
      } else if (stops && stops.length > 1) {
        pathCoords = stops.map((s) => ({ lat: s.lat, lng: s.lng }));
      }

      if (pathCoords.length > 1) {
        polylineRef.current = new gmaps.Polyline({
          path: pathCoords,
          geodesic: true,
          strokeColor: '#2563eb',
          strokeOpacity: 0.85,
          strokeWeight: 5,
        });
        polylineRef.current.setMap(map);
      }
    } catch (e) {
      console.warn('Native polyline error:', e);
    }

    return () => {
      if (polylineRef.current) {
        try {
          polylineRef.current.setMap(null);
        } catch {}
        polylineRef.current = null;
      }
    };
  }, [map, directions, stops, authError]);

  // If Google Maps fails to load or domain is restricted, gracefully fall back to Standard Leaflet Map
  if (loadError || authError) {
    return (
      <div className="relative w-full rounded-3xl overflow-hidden">
        {authError && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-start gap-2 shadow-xs">
            <span className="text-base">⚠️</span>
            <div>
              <strong className="block font-black">Google Maps API Domain Restriction</strong>
              <span>
                Your Google Cloud API key requires website authorization for <code>https://edutrack-live-app.vercel.app/*</code>. Running in Standard Leaflet mode with live bus tracking active.
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

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={computedCenter}
        zoom={zoom}
        options={mapOptions}
        onLoad={onLoad}
        onUnmount={onUnmount}
      >
        {/* Stop Markers */}
        {stops.map((stop, idx) => (
          <Marker
            key={`stop-${idx}`}
            position={{ lat: stop.lat, lng: stop.lng }}
            title={stop.name}
            icon={{
              url:
                'data:image/svg+xml;charset=UTF-8,' +
                encodeURIComponent(`
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="14" cy="14" r="11" fill="#10b981" stroke="#ffffff" stroke-width="2.5"/>
                    <circle cx="14" cy="14" r="5" fill="#ffffff"/>
                  </svg>
                `),
              anchor: gmaps ? new gmaps.Point(14, 14) : undefined,
            }}
          />
        ))}

        {/* Live Bus Markers */}
        {buses.map((bus) => {
          const isSelected = activeBusInfo?.id === bus.id;
          const isOnline = bus.isOnline !== false;
          const ringColor = isSelected ? '#ef4444' : isOnline ? '#10b981' : '#64748b';
          const size = isSelected ? 48 : 42;
          const radius = size / 2;

          const svgBusIcon = `
            <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
              <filter id="bussd" x="0" y="0" width="${size}" height="${size}" filterUnits="userSpaceOnUse">
                <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000000" flood-opacity="0.35"/>
              </filter>
              <g filter="url(#bussd)">
                <circle cx="${radius}" cy="${radius}" r="${radius - 3}" fill="${ringColor}" stroke="#ffffff" stroke-width="3"/>
                <circle cx="${radius}" cy="${radius}" r="${radius - 7}" fill="#f59e0b"/>
                <text x="${radius}" y="${radius + 4}" font-size="${isSelected ? 16 : 14}" text-anchor="middle" dominant-baseline="middle">🚌</text>
              </g>
            </svg>
          `;

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
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgBusIcon),
                anchor: gmaps ? new gmaps.Point(radius, radius) : undefined,
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
            <div style={{ minWidth: 220, padding: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
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

              <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.6 }}>
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
                  <span style={{ color: '#2563eb', fontWeight: 800 }}>
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
      zoom={props.zoom || 13}
      height={props.height || '500px'}
    />
  );

  return (
    <GoogleMapErrorBoundary fallback={fallback}>
      <InnerGoogleBusMap {...props} />
    </GoogleMapErrorBoundary>
  );
}
