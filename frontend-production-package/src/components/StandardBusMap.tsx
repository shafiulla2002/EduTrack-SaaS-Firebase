'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Stop {
  name: string;
  lat: number;
  lng: number;
}

interface BusLocation {
  id: string;
  busNumber: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  isOnline: boolean;
}

interface StandardBusMapProps {
  buses: BusLocation[];
  stops: Stop[];
  center: { lat: number; lng: number };
  zoom?: number;
  height?: string;
}

// Fix default Leaflet icon paths
const stopIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" fill="#ffffff" stroke="#2563eb" stroke-width="4"/></svg>'),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const getBusIcon = (isOnline: boolean) => new L.Icon({
  iconUrl: isOnline 
    ? 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="16" fill="#10b981"/><circle cx="20" cy="20" r="8" fill="#ffffff"/></svg>')
    : 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="16" fill="#94a3b8"/><circle cx="20" cy="20" r="8" fill="#ffffff"/></svg>'),
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

function MapController({ center, buses }: { center: { lat: number, lng: number }, buses: BusLocation[] }) {
  const map = useMap();
  useEffect(() => {
    if (buses.length === 1 && buses[0].isOnline) {
      map.flyTo([buses[0].lat, buses[0].lng], map.getZoom());
    }
  }, [buses, map]);
  return null;
}

export default function StandardBusMap({ buses, stops, center, zoom = 14, height = '400px' }: StandardBusMapProps) {
  // Fix Next.js hydration issues with react-leaflet
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div style={{ height }} className="w-full bg-slate-100 rounded-3xl flex items-center justify-center text-slate-400 font-bold animate-pulse border border-slate-200">
        Loading Standard Map...
      </div>
    );
  }

  const polylinePositions = stops.map(s => [s.lat, s.lng] as [number, number]);

  return (
    <div style={{ height }} className="w-full relative shadow-inner rounded-3xl overflow-hidden bg-slate-50 border border-slate-200">
      <div className="absolute top-4 left-4 z-[400] bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        Standard Map Mode
      </div>
      <MapContainer 
        center={[center.lat, center.lng]} 
        zoom={zoom} 
        style={{ height: '100%', width: '100%', zIndex: 1 }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        
        <MapController center={center} buses={buses} />

        {/* Draw Route Polyline */}
        {polylinePositions.length > 0 && (
          <Polyline 
            positions={polylinePositions} 
            color="#3b82f6" 
            weight={4} 
            opacity={0.6} 
          />
        )}

        {/* Draw Stops */}
        {stops.map((stop, idx) => (
          <Marker 
            key={`stop-${idx}`} 
            position={[stop.lat, stop.lng]} 
            icon={stopIcon}
          >
            <Tooltip>{stop.name}</Tooltip>
          </Marker>
        ))}

        {/* Draw Buses */}
        {buses.map(bus => (
          <Marker 
            key={`bus-${bus.id}`} 
            position={[bus.lat, bus.lng]} 
            icon={getBusIcon(bus.isOnline)}
          >
            <Tooltip permanent direction="top" offset={[0, -10]} className="font-bold">
              Bus {bus.busNumber} ({Math.round(bus.speed)} km/h)
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
