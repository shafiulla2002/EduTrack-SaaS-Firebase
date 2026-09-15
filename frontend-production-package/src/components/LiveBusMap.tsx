'use client';

import React, { useEffect, useRef } from 'react';

interface BusLocation {
  id: string;
  busNumber: string;
  registrationNo?: string;
  driverName?: string;
  status?: string;
  dutyStatus?: string;
  lat: number;
  lng: number;
  speed?: number;
  isOnline?: boolean;
}

interface LiveBusMapProps {
  buses: BusLocation[];
  height?: string;
  zoom?: number;
  center?: [number, number];
  stops?: { name: string; lat: number; lng: number }[];
}

export default function LiveBusMap({ buses, height = '450px', zoom = 13, center, stops }: LiveBusMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{ [id: string]: any }>({});
  const stopMarkersRef = useRef<any[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    // Load Leaflet dynamically on client side
    import('leaflet').then((L) => {
      // Fix leaflet default icon URLs
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // Include Leaflet CSS dynamically if not already present
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      const defaultCenter: [number, number] = center || (buses.length > 0 && buses[0].lat && buses[0].lng ? [buses[0].lat, buses[0].lng] : [18.5204, 73.8567]);

      if (mapContainerRef.current && !mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapContainerRef.current).setView(defaultCenter, zoom);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors | EduTrack Transport',
          maxZoom: 19,
        }).addTo(mapInstanceRef.current);
      } else {
        if (center) {
          mapInstanceRef.current.setView(center, zoom);
        }
      }

      const busIcon = L.divIcon({
        className: 'custom-bus-marker',
        html: `
          <div style="background-color: #2563eb; color: white; border: 2px solid white; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3); font-size: 18px;">
            🚌
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const stopIcon = L.divIcon({
        className: 'custom-stop-marker',
        html: `
          <div style="background-color: #10b981; color: white; border: 2px solid white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.2); font-size: 12px; font-weight: bold;">
            🚏
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      // Clear old bus markers that are no longer in buses prop
      Object.keys(markersRef.current).forEach((id) => {
        if (!buses.find((b) => b.id === id)) {
          mapInstanceRef.current.removeLayer(markersRef.current[id]);
          delete markersRef.current[id];
        }
      });

      // Update or add bus markers
      buses.forEach((b) => {
        if (!b.lat || !b.lng) return;

        const popupContent = `
          <div style="font-family: sans-serif; padding: 4px; color: #1e293b;">
            <div style="font-weight: 800; font-size: 13px; color: #2563eb;">Bus ${b.busNumber}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Reg: ${b.registrationNo || 'N/A'}</div>
            <div style="font-size: 11px; color: #475569; margin-top: 4px;"><strong>Driver:</strong> ${b.driverName || 'Primary Driver'}</div>
            <div style="font-size: 11px; color: #475569;"><strong>Status:</strong> ${b.dutyStatus || 'OFF_DUTY'}</div>
            <div style="font-size: 11px; color: #475569;"><strong>Speed:</strong> ${b.speed || 0} km/h</div>
          </div>
        `;

        if (markersRef.current[b.id]) {
          markersRef.current[b.id].setLatLng([b.lat, b.lng]);
          markersRef.current[b.id].getPopup().setContent(popupContent);
        } else {
          const marker = L.marker([b.lat, b.lng], { icon: busIcon })
            .addTo(mapInstanceRef.current)
            .bindPopup(popupContent);
          markersRef.current[b.id] = marker;
        }
      });

      // Clear old stop markers
      stopMarkersRef.current.forEach((m) => mapInstanceRef.current.removeLayer(m));
      stopMarkersRef.current = [];

      // Render stops if provided
      if (stops && stops.length > 0) {
        stops.forEach((s) => {
          if (s.lat && s.lng) {
            const m = L.marker([s.lat, s.lng], { icon: stopIcon })
              .addTo(mapInstanceRef.current)
              .bindPopup(`<strong style="color: #059669;">${s.name}</strong>`);
            stopMarkersRef.current.push(m);
          }
        });
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersRef.current = {};
        stopMarkersRef.current = [];
      }
    };
  }, [buses, center, stops, zoom]);

  return (
    <div
      ref={mapContainerRef}
      style={{ height, width: '100%', borderRadius: '1rem', overflow: 'hidden', border: '1px solid #e2e8f0' }}
    />
  );
}
