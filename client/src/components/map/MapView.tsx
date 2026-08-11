import { divIcon, latLngBounds } from 'leaflet';
import type { LatLngExpression } from 'leaflet';
import { useEffect } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { LatLng } from '../../types/geo.types';

const DHAKA_CENTER: LatLng = { lat: 23.8103, lng: 90.4125 };

const markerIcon = (kind: 'pickup' | 'dropoff' | 'driver' | 'user') => divIcon({
  className: `cholo-map-marker cholo-map-marker--${kind}`,
  html: `<span aria-hidden="true">${kind === 'driver' ? '●' : kind === 'pickup' ? 'A' : kind === 'dropoff' ? 'B' : '◉'}</span>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

interface ViewportControllerProps {
  points: LatLng[];
}

function ViewportController({ points }: ViewportControllerProps) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0] as LatLngExpression, Math.max(map.getZoom(), 15), { animate: true });
      return;
    }
    map.fitBounds(latLngBounds(points.map((point) => [point.lat, point.lng])), {
      padding: [48, 48],
      maxZoom: 15,
      animate: true,
    });
  }, [map, points]);

  return null;
}

function ClickHandler({ onMapClick }: { onMapClick?: (point: LatLng) => void }) {
  useMapEvents({
    click(event) {
      onMapClick?.({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

interface MapViewProps {
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  driver?: LatLng | null;
  user?: LatLng | null;
  onMapClick?: (point: LatLng) => void;
  className?: string;
}

export function MapView({ pickup, dropoff, driver, user, onMapClick, className = '' }: MapViewProps) {
  const points = [pickup, dropoff, driver, user].filter((point): point is LatLng => Boolean(point));
  const center = points[0] ?? DHAKA_CENTER;
  const route = [pickup, dropoff].filter((point): point is LatLng => Boolean(point));

  return (
    <div className={`relative isolate overflow-hidden bg-surface-alt ${className}`} aria-label="Ride map">
      <MapContainer center={center} zoom={13} className="h-full w-full" zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onMapClick={onMapClick} />
        <ViewportController points={points} />
        {route.length === 2 && (
          <Polyline
            positions={route.map((point) => [point.lat, point.lng])}
            pathOptions={{ color: 'var(--color-cholo-700)', weight: 5, opacity: 0.8, dashArray: '8 8' }}
          />
        )}
        {pickup && <Marker position={pickup} icon={markerIcon('pickup')} />}
        {dropoff && <Marker position={dropoff} icon={markerIcon('dropoff')} />}
        {driver && <Marker position={driver} icon={markerIcon('driver')} />}
        {user && !pickup && <Marker position={user} icon={markerIcon('user')} />}
      </MapContainer>
    </div>
  );
}
