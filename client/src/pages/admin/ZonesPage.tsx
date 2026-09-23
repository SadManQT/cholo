import { divIcon } from 'leaflet';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Polygon, Polyline, Tooltip, useMapEvents } from 'react-leaflet';
import * as adminApi from '../../api/admin.api';
import * as referenceApi from '../../api/reference.api';
import { VectorTileLayer } from '../../components/map/MapView';
import { Button, Card, Dialog, EmptyState, Input, Skeleton, StatePill, toast } from '../../components/ui';
import type { Zone, ZoneType } from '../../types/admin.types';
import type { LatLng } from '../../types/geo.types';
import type { City } from '../../types/ride.types';
import { getApiErrorMessage, getApiFieldErrors } from '../../utils/apiError';

const DHAKA: [number, number] = [23.7806, 90.4079];

const ZONE_STYLE: Record<ZoneType, { color: string; label: string; hint: string }> = {
  regular: { color: '#0E7A5F', label: 'Regular', hint: 'Normal service area.' },
  airport: { color: '#2563EB', label: 'Airport', hint: 'Airport pickup rules apply.' },
  station: { color: '#7C3AED', label: 'Station', hint: 'Bus or rail station.' },
  restricted: { color: '#DC2626', label: 'Restricted', hint: 'Rides cannot start or end here.' },
};

const vertexIcon = divIcon({
  className: '',
  html: '<span style="display:block;width:14px;height:14px;border-radius:9999px;background:#fff;border:3px solid #0B1F2E;box-shadow:0 1px 3px rgb(0 0 0 / .4)"></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function toPoints(zone: Zone): LatLng[] {
  const ring = zone.boundary?.coordinates[0] ?? [];
  return ring.slice(0, -1).map(([lng, lat]) => ({ lat, lng }));
}

function DrawHandler({ onAdd }: { onAdd: (point: LatLng) => void }) {
  useMapEvents({ click: (event) => onAdd({ lat: event.latlng.lat, lng: event.latlng.lng }) });
  return null;
}

interface Draft {
  id?: string;
  name: string;
  zoneType: ZoneType;
  points: LatLng[];
  isActive: boolean;
}

export function ZonesPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [cityId, setCityId] = useState<number | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Zone | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const nextCities = cities.length ? cities : await referenceApi.listCities();
      setCities(nextCities);
      const selected = cityId ?? nextCities[0]?.id ?? null;
      setCityId(selected);
      setZones(selected ? await adminApi.listZones(selected) : []);
    } catch (thrown) {
      setError(getApiErrorMessage(thrown, 'Could not load zones.'));
    } finally {
      setLoading(false);
    }
  }, [cities, cityId]);

  useEffect(() => { void load(); }, [load]);

  const mapCenter = useMemo<[number, number]>(() => {
    const first = zones[0] ? toPoints(zones[0])[0] : null;
    return first ? [first.lat, first.lng] : DHAKA;
  }, [zones]);

  async function save() {
    if (!draft || !cityId) return;
    const next: Record<string, string> = {};
    if (draft.name.trim().length < 2) next.name = 'Name the zone';
    if (draft.points.length < 3) next.points = 'Click at least 3 points on the map to outline the zone';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const input = { name: draft.name.trim(), zoneType: draft.zoneType, points: draft.points, isActive: draft.isActive };
      if (draft.id) await adminApi.updateZone(draft.id, input);
      else await adminApi.createZone({ cityId, ...input });
      toast.success(draft.id ? 'Zone updated.' : 'Zone created.');
      setDraft(null);
      await load();
    } catch (thrown) {
      const fields = getApiFieldErrors(thrown);
      if (Object.keys(fields).length) setErrors(fields);
      else toast.error(getApiErrorMessage(thrown, 'Could not save this zone.'));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await adminApi.deleteZone(deleting.id);
      toast.success(`${deleting.name} deleted.`);
      setDeleting(null);
      if (draft?.id === deleting.id) setDraft(null);
      await load();
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not delete this zone.'));
    }
  }

  if (loading) return <main className="mx-auto max-w-6xl space-y-3"><Skeleton variant="card" /><Skeleton variant="map-placeholder" className="h-96" /></main>;
  if (error) return <EmptyState title="Zones did not load" hint={error} action={{ label: 'Retry', onClick: () => void load() }} />;

  return (
    <main className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Zones</h1>
          <p className="text-sm text-ink-500">Restricted zones block pickups and drop-offs. Drivers are tagged with the zone they are in.</p>
        </div>
        <div className="flex gap-2">
          {cities.length > 1 && (
            <select aria-label="City" value={cityId ?? ''} onChange={(event) => { setCityId(Number(event.target.value)); setDraft(null); }} className="h-11 rounded-xl border border-border bg-surface px-3">
              {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
            </select>
          )}
          {!draft && <Button onClick={() => { setDraft({ name: '', zoneType: 'regular', points: [], isActive: true }); setErrors({}); }}>New zone</Button>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="relative isolate h-[520px] overflow-hidden rounded-2xl border border-border">
          <MapContainer key={cityId ?? 'none'} center={mapCenter} zoom={12} className="h-full w-full" zoomControl>
            <VectorTileLayer />
            {zones.filter((zone) => zone.id !== draft?.id).map((zone) => (
              <Polygon
                key={zone.id}
                positions={toPoints(zone).map((point) => [point.lat, point.lng])}
                pathOptions={{ color: ZONE_STYLE[zone.zoneType].color, weight: 2, fillOpacity: zone.isActive ? 0.18 : 0.05, dashArray: zone.isActive ? undefined : '6 6' }}
                eventHandlers={{ click: () => { if (!draft) setDraft({ id: zone.id, name: zone.name, zoneType: zone.zoneType, points: toPoints(zone), isActive: zone.isActive }); } }}
              >
                <Tooltip sticky>{zone.name} · {ZONE_STYLE[zone.zoneType].label}</Tooltip>
              </Polygon>
            ))}
            {draft && (
              <>
                <DrawHandler onAdd={(point) => setDraft((current) => current ? { ...current, points: [...current.points, point] } : current)} />
                {draft.points.length >= 3
                  ? <Polygon positions={draft.points.map((point) => [point.lat, point.lng])} pathOptions={{ color: ZONE_STYLE[draft.zoneType].color, weight: 3, fillOpacity: 0.25 }} />
                  : <Polyline positions={draft.points.map((point) => [point.lat, point.lng])} pathOptions={{ color: ZONE_STYLE[draft.zoneType].color, weight: 3, dashArray: '4 6' }} />}
                {draft.points.map((point, index) => (
                  <Marker
                    key={`${point.lat},${point.lng},${index}`}
                    position={point}
                    icon={vertexIcon}
                    draggable
                    eventHandlers={{
                      dragend: (event) => {
                        const { lat, lng } = event.target.getLatLng();
                        setDraft((current) => current ? { ...current, points: current.points.map((existing, i) => (i === index ? { lat, lng } : existing)) } : current);
                      },
                    }}
                  />
                ))}
              </>
            )}
          </MapContainer>
          {draft && (
            <p className="pointer-events-none absolute left-3 top-3 z-[500] rounded-xl bg-surface/95 px-3 py-2 text-sm shadow-lg">
              Click the map to add corners · drag a corner to adjust
            </p>
          )}
        </div>

        <aside className="space-y-3">
          {draft ? (
            <Card className="space-y-4">
              <h2 className="font-semibold">{draft.id ? 'Edit zone' : 'New zone'}</h2>
              <Input label="Name" value={draft.name} error={errors.name} maxLength={80} placeholder="e.g. Hazrat Shahjalal Airport" onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Type</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(ZONE_STYLE) as ZoneType[]).map((type) => (
                    <label key={type} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${draft.zoneType === type ? 'border-cholo-700 bg-cholo-50' : 'border-border'}`}>
                      <input type="radio" name="zoneType" className="sr-only" checked={draft.zoneType === type} onChange={() => setDraft({ ...draft, zoneType: type })} />
                      <span className="h-3 w-3 rounded-full" style={{ background: ZONE_STYLE[type].color }} aria-hidden="true" />
                      {ZONE_STYLE[type].label}
                    </label>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-ink-500">{ZONE_STYLE[draft.zoneType].hint}</p>
              </fieldset>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} className="h-4 w-4 accent-cholo-700" />
                Active
              </label>
              <div className="flex items-center justify-between rounded-xl bg-surface-alt px-3 py-2 text-sm">
                <span>{draft.points.length} corner{draft.points.length === 1 ? '' : 's'}</span>
                <span className="flex gap-3">
                  <button type="button" className="font-medium text-ink-500 hover:text-ink-900 disabled:opacity-40" disabled={!draft.points.length} onClick={() => setDraft({ ...draft, points: draft.points.slice(0, -1) })}>Undo</button>
                  <button type="button" className="font-medium text-ink-500 hover:text-ink-900 disabled:opacity-40" disabled={!draft.points.length} onClick={() => setDraft({ ...draft, points: [] })}>Clear</button>
                </span>
              </div>
              {errors.points && <p className="text-sm text-danger-600">{errors.points}</p>}
              <div className="flex flex-wrap gap-2">
                <Button loading={busy} onClick={() => void save()}>{draft.id ? 'Save changes' : 'Create zone'}</Button>
                <Button variant="secondary" onClick={() => setDraft(null)}>Cancel</Button>
              </div>
            </Card>
          ) : null}

          <Card className="p-0">
            <p className="border-b border-border px-4 py-3 text-sm font-semibold">{zones.length} zone{zones.length === 1 ? '' : 's'}</p>
            {zones.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-500">No zones yet. Create one to restrict an area or tag airports and stations.</p>
            ) : (
              <ul className="max-h-[360px] divide-y divide-border overflow-y-auto">
                {zones.map((zone) => (
                  <li key={zone.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: ZONE_STYLE[zone.zoneType].color }} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{zone.name}</p>
                      <p className="text-xs text-ink-500">{ZONE_STYLE[zone.zoneType].label} · {zone.activeDrivers} driver{zone.activeDrivers === 1 ? '' : 's'} inside</p>
                    </div>
                    {!zone.isActive && <StatePill state="inactive" />}
                    <button type="button" className="text-xs font-medium text-cholo-700 hover:underline" onClick={() => setDraft({ id: zone.id, name: zone.name, zoneType: zone.zoneType, points: toPoints(zone), isActive: zone.isActive })}>Edit</button>
                    <button type="button" className="text-xs font-medium text-danger-600 hover:underline" onClick={() => setDeleting(zone)}>Delete</button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>

      {deleting && (
        <Dialog open onClose={() => setDeleting(null)} title={`Delete ${deleting.name}?`} description="Bookings are no longer checked against this zone and drivers inside it are untagged. This can't be undone."
          footer={<><Button variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" onClick={() => void confirmDelete()}>Delete zone</Button></>}
        />
      )}
    </main>
  );
}
