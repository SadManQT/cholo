import L, { divIcon, latLngBounds } from 'leaflet';
import type { LatLngExpression } from 'leaflet';
import '@maplibre/maplibre-gl-leaflet';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { useEffect, useState } from 'react';
import { MapContainer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import * as geoApi from '../../api/geo.api';
import type { LatLng, RouteResult } from '../../types/geo.types';

const DHAKA_CENTER: LatLng = { lat: 23.8103, lng: 90.4125 };

const VECTOR_STYLE_URL = 'https://tiles.openfreemap.org/styles/bright';

const LATIN_ONLY_NAME = ['coalesce', ['get', 'name:latin'], ['get', 'name_en'], ['get', 'name']];

const POI_LABEL_LAYERS = ['poi_r1', 'poi_r7', 'poi_r20', 'poi_transit'];

function restyleLabels(glMap: MaplibreMap) {
  for (const layer of glMap.getStyle().layers) {
    if (layer.type !== 'symbol') continue;
    const textField = glMap.getLayoutProperty(layer.id, 'text-field');
    if (Array.isArray(textField) && textField[0] === 'case') {
      glMap.setLayoutProperty(layer.id, 'text-field', LATIN_ONLY_NAME);
    }
  }
  for (const id of POI_LABEL_LAYERS) {
    if (!glMap.getLayer(id)) continue;
    glMap.setLayoutProperty(id, 'text-font', ['Noto Sans Bold']);
    glMap.setLayoutProperty(id, 'text-size', 13);
  }
}

export function VectorTileLayer() {
  const map = useMap();

  useEffect(() => {
    const layer = L.maplibreGL({ style: VECTOR_STYLE_URL }).addTo(map);
    const glMap = layer.getMaplibreMap();

    if (glMap.isStyleLoaded()) restyleLabels(glMap);
    else glMap.once('load', () => restyleLabels(glMap));

    return () => {
      layer.remove();
    };
  }, [map]);

  return null;
}

const CURRENT_LOCATION_SIZE = 26;
const PIN_WIDTH = 32;
const PIN_HEIGHT = 44;

type PinKind = 'pickup' | 'dropoff' | 'driver' | 'sos';

const PIN_GLYPHS: Record<PinKind, string> = { pickup: 'A', dropoff: 'B', driver: '', sos: '!' };

const PIN_CLASS_NAMES: Record<PinKind, string> = {
  pickup: 'cholo-map-marker cholo-map-marker--pickup',
  dropoff: 'cholo-map-marker cholo-map-marker--dropoff',
  driver: 'cholo-map-marker cholo-map-marker--driver',
  sos: 'cholo-map-marker cholo-map-marker--sos',
};

const markerIcon = (kind: PinKind | 'user') => {
  if (kind === 'user') {
    return divIcon({
      className: 'cholo-current-location-marker',
      html: '<span class="cholo-current-location-marker__pulse" aria-hidden="true"></span>'
        + '<span class="cholo-current-location-marker__dot" aria-hidden="true"></span>',
      iconSize: [CURRENT_LOCATION_SIZE, CURRENT_LOCATION_SIZE],
      iconAnchor: [CURRENT_LOCATION_SIZE / 2, CURRENT_LOCATION_SIZE / 2],
    });
  }

  const glyph = PIN_GLYPHS[kind] && `<text x="12" y="15.5" text-anchor="middle" font-size="9" font-weight="700" fill="currentColor">${PIN_GLYPHS[kind]}</text>`;
  return divIcon({
    className: PIN_CLASS_NAMES[kind],
    html: `<svg viewBox="-1 -1 26 36" width="${PIN_WIDTH}" height="${PIN_HEIGHT}" aria-hidden="true">`
      + '<path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 22 12 22s12-13 12-22C24 5.4 18.6 0 12 0z" fill="currentColor" stroke="#fff" stroke-width="1.5"/>'
      + `<circle cx="12" cy="12" r="${kind === 'driver' ? 4.5 : 6.5}" fill="#fff"/>${glyph}</svg>`,
    iconSize: [PIN_WIDTH, PIN_HEIGHT],
    // Anchor at the pin's tip so it points at the exact coordinate.
    iconAnchor: [PIN_WIDTH / 2, PIN_HEIGHT],
  });
};

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
  sos?: LatLng | null;
  onMapClick?: (point: LatLng) => void;
  className?: string;
}

export function MapView({ pickup, dropoff, driver, user, sos, onMapClick, className = '' }: MapViewProps) {
  const [roadRoute, setRoadRoute] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeUnavailable, setRouteUnavailable] = useState(false);

  useEffect(() => {
    if (!pickup || !dropoff) {
      setRoadRoute(null);
      setRouteLoading(false);
      setRouteUnavailable(false);
      return;
    }

    let cancelled = false;
    setRoadRoute(null);
    setRouteLoading(true);
    setRouteUnavailable(false);

    geoApi.getRoute(pickup, dropoff)
      .then((result) => {
        if (!cancelled) setRoadRoute(result);
      })
      .catch(() => {
        if (!cancelled) setRouteUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setRouteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dropoff, pickup]);

  const routePoints = roadRoute?.path.length ? roadRoute.path : [];
  const points = [...routePoints, pickup, dropoff, driver, user, sos]
    .filter((point): point is LatLng => Boolean(point));
  const center = points[0] ?? DHAKA_CENTER;

  return (
    <div className={`relative isolate overflow-hidden bg-surface-alt ${className}`} aria-label="Ride map">
      <MapContainer center={center} zoom={13} className="h-full w-full" zoomControl={false}>
        <VectorTileLayer />
        <ClickHandler onMapClick={onMapClick} />
        <ViewportController points={points} />
        {roadRoute?.alternatives.map((alternative, index) => alternative.path.length > 1 && (
          <Polyline
            key={`${alternative.distanceKm}-${alternative.durationMin}-${index}`}
            positions={alternative.path.map((point) => [point.lat, point.lng])}
            pathOptions={{ color: '#64748b', weight: 5, opacity: 0.5 }}
          />
        ))}
        {roadRoute && roadRoute.path.length > 1 && (
          <Polyline
            positions={roadRoute.path.map((point) => [point.lat, point.lng])}
            pathOptions={{ color: 'var(--color-cholo-700)', weight: 6, opacity: 0.9 }}
          />
        )}
        {pickup && <Marker position={pickup} icon={markerIcon('pickup')} />}
        {dropoff && <Marker position={dropoff} icon={markerIcon('dropoff')} />}
        {driver && <Marker position={driver} icon={markerIcon('driver')} />}
        {sos && <Marker position={sos} icon={markerIcon('sos')} />}
        {user && !pickup && <Marker position={user} icon={markerIcon('user')} />}
      </MapContainer>
      {routeLoading && (
        <div
          className="absolute inset-0 z-[650] flex items-center justify-center bg-ink-900/35 p-4 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
        >
          <div className="w-full max-w-xs rounded-2xl bg-surface p-5 text-center shadow-2xl">
            <span className="mx-auto block h-10 w-10 animate-spin rounded-full border-4 border-cholo-700/20 border-t-cholo-700" aria-hidden="true" />
            <p className="mt-4 font-bold text-ink-900">Finding the best route for you…</p>
            <p className="mt-1 text-sm text-ink-500">Checking the shortest road path that stays inside Bangladesh.</p>
          </div>
        </div>
      )}
      {(roadRoute || routeUnavailable) && (
        <div className="pointer-events-none absolute right-3 top-3 z-[450] rounded-xl bg-surface/95 px-3 py-2 text-xs font-semibold text-ink-900 shadow-lg">
          {roadRoute && `Shortest route · ${roadRoute.distanceKm} km · ${roadRoute.durationMin} min${roadRoute.alternatives.length ? ` · ${roadRoute.alternatives.length} alternative${roadRoute.alternatives.length > 1 ? 's' : ''}` : ''}`}
          {routeUnavailable && 'Road route is temporarily unavailable'}
        </div>
      )}
    </div>
  );
}
