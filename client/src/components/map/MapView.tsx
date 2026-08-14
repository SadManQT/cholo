import L, { divIcon, latLngBounds } from 'leaflet';
import type { LatLngExpression } from 'leaflet';
import '@maplibre/maplibre-gl-leaflet';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { useEffect, useState } from 'react';
import { MapContainer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import * as geoApi from '../../api/geo.api';
import type { LatLng, RouteResult } from '../../types/geo.types';

const DHAKA_CENTER: LatLng = { lat: 23.8103, lng: 90.4125 };

// OpenFreeMap (openfreemap.org): free vector tiles on OSM data, no API key,
// no registration, no rate limit. Vector tiles render live via MapLibre
// GL/WebGL, so they stay crisp at any zoom and restyle cleanly — the same
// rendering approach Uber (Mapbox GL) and Pathao (their own OSM-based
// vector maps) use, unlike fixed-style raster PNG tiles. 'bright' has a
// more saturated palette than 'liberty', closer to Google Maps' look.
//
// No 3D building extrusion: Leaflet hosts this map as a strictly top-down
// 2D layer (that's what keeps every Marker/Polyline/click-handler below
// working unchanged) — a MapLibre fill-extrusion layer needs camera pitch
// to read as "3D," and tilting the camera here would desync Leaflet's own
// marker positions from the tilted tiles underneath. Real tilted 3D would
// mean dropping Leaflet for native MapLibre GL (its own Marker API is
// pitch-aware) — a much bigger rewrite than a style swap.
const VECTOR_STYLE_URL = 'https://tiles.openfreemap.org/styles/bright';

// OpenFreeMap's OpenMapTiles-schema labels default to
// ["case", ["has", "name:nonlatin"], concat(latin, "\n", nonlatin), ...] —
// every place/road/POI label stacks the Bangla script under the Latin one.
// Overriding every such layer to Latin-only keeps one name line instead.
const LATIN_ONLY_NAME = ['coalesce', ['get', 'name:latin'], ['get', 'name_en'], ['get', 'name']];

// The four POI label layers (shops, landmarks, transit stops — "nearby
// popular locations") ship in a light italic by default; bolding them
// makes them stand out from street/area labels, closer to how Google Maps
// weights points of interest.
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

function VectorTileLayer() {
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
  const points = [...routePoints, pickup, dropoff, driver, user]
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
        {user && !pickup && <Marker position={user} icon={markerIcon('user')} />}
      </MapContainer>
      {(routeLoading || roadRoute || routeUnavailable) && (
        <div className="pointer-events-none absolute right-3 top-3 z-[450] rounded-xl bg-surface/95 px-3 py-2 text-xs font-semibold text-ink-900 shadow-lg">
          {routeLoading && 'Finding shortest road route…'}
          {roadRoute && `Shortest route · ${roadRoute.distanceKm} km · ${roadRoute.durationMin} min${roadRoute.alternatives.length ? ` · ${roadRoute.alternatives.length} alternative${roadRoute.alternatives.length > 1 ? 's' : ''}` : ''}`}
          {routeUnavailable && 'Road route is temporarily unavailable'}
        </div>
      )}
    </div>
  );
}
