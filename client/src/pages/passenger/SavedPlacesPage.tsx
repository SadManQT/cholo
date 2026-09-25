import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as geoApi from '../../api/geo.api';
import * as meApi from '../../api/me.api';
import { ClockIcon, GraduationIcon, HomeIcon, PinIcon } from '../../components/layout/icons';
import { Button, Card, EmptyState, Input, Skeleton, toast } from '../../components/ui';
import { usePlaceSuggestions } from '../../hooks/usePlaceSuggestions';
import type { Place } from '../../types/geo.types';
import type { RecentPlace, SavedPlace } from '../../types/place.types';
import { getApiErrorMessage, getApiFieldErrors } from '../../utils/apiError';
import { t } from '../../i18n';

const PRESETS = ['Home', 'University', 'Work'];

function PlaceIcon({ label }: { label: string }) {
  const key = label.toLowerCase();
  const Icon = key === 'home' ? HomeIcon : key === 'university' ? GraduationIcon : PinIcon;
  return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cholo-50 text-cholo-700"><Icon /></span>;
}

function PlaceForm({ initialLabel, initialPlace, taken, onSaved, onCancel, placeId }: {
  initialLabel: string;
  initialPlace: Place | null;
  taken: string[];
  onSaved: (place: SavedPlace) => void;
  onCancel: () => void;
  placeId?: string;
}) {
  const [label, setLabel] = useState(initialLabel);
  const [query, setQuery] = useState(initialPlace?.address ?? '');
  const [place, setPlace] = useState<Place | null>(initialPlace);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const suggestions = usePlaceSuggestions(query, place?.address !== query);

  async function save() {
    const next: Record<string, string> = {};
    if (!label.trim()) next.label = t('Give the place a name');
    if (!place) next.address = t('Search for the address and pick it from the list');
    setErrors(next);
    if (Object.keys(next).length || !place) return;

    setBusy(true);
    try {
      const input = { label: label.trim(), address: place.address, lat: place.lat, lng: place.lng };
      onSaved(placeId ? await meApi.updatePlace(placeId, input) : await meApi.addPlace(input));
    } catch (thrown) {
      const fields = getApiFieldErrors(thrown);
      if (Object.keys(fields).length) setErrors(fields);
      else setErrors({ label: getApiErrorMessage(thrown, t('Could not save this place.')) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium text-ink-900">{t('Name')}</p>
        <div className="mb-2 flex flex-wrap gap-2">
          {PRESETS.filter((preset) => preset === initialLabel || !taken.includes(preset.toLowerCase())).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setLabel(preset)}
              className={`rounded-full border px-3 py-1 text-sm font-medium ${label === preset ? 'border-cholo-700 bg-cholo-50 text-cholo-800' : 'border-border text-ink-500 hover:text-ink-900'}`}
            >
              {preset}
            </button>
          ))}
        </div>
        <Input aria-label={t('Place name')} value={label} error={errors.label} maxLength={40} placeholder={t('e.g. Gym, Nani\'s house')} onChange={(event) => setLabel(event.target.value)} />
      </div>
      <div className="relative">
        <Input
          label={t('Address')}
          value={query}
          error={errors.address}
          placeholder={t('Search an address in Bangladesh')}
          autoComplete="off"
          onChange={(event) => { setQuery(event.target.value); setPlace(null); }}
        />
        {suggestions.suggestions.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-surface shadow-lg">
            {suggestions.suggestions.map((suggestion) => (
              <li key={`${suggestion.lat},${suggestion.lng}`}>
                <button type="button" className="block w-full px-3.5 py-2.5 text-left text-sm hover:bg-surface-alt" onClick={() => { setPlace(suggestion); setQuery(suggestion.address); suggestions.clear(); }}>
                  {suggestion.address}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button loading={busy} onClick={() => void save()}>{placeId ? t('Save changes') : t('Save place')}</Button>
        <Button variant="secondary" onClick={onCancel}>{t('Cancel')}</Button>
      </div>
    </Card>
  );
}

export function SavedPlacesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [saved, setSaved] = useState<SavedPlace[]>([]);
  const [recent, setRecent] = useState<RecentPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id?: string; label: string; place: Place | null } | null>(
    searchParams.get('add') ? { label: searchParams.get('add')!, place: null } : null,
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await meApi.listPlaces();
      setSaved(result.saved);
      setRecent(result.recent);
    } catch (thrown) {
      setError(getApiErrorMessage(thrown, t('Could not load your places.')));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function closeForm() {
    setEditing(null);
    if (searchParams.has('add')) setSearchParams({}, { replace: true });
  }

  function onSaved(place: SavedPlace) {
    setSaved((current) => {
      const exists = current.some((item) => item.id === place.id);
      return exists ? current.map((item) => (item.id === place.id ? place : item)) : [...current, place];
    });
    toast.success(t('{0} saved.', place.label));
    closeForm();
  }

  async function remove(place: SavedPlace) {
    try {
      await meApi.removePlace(place.id);
      setSaved((current) => current.filter((item) => item.id !== place.id));
      toast.info(t('{0} removed.', place.label));
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, t('Could not remove this place.')));
    }
  }

  async function fillFromCurrentLocation(label: string) {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const place = await geoApi.reverseGeocode(coords.latitude, coords.longitude);
        setEditing({ label, place });
      } catch (thrown) {
        toast.error(getApiErrorMessage(thrown, t('Could not find your current address.')));
      }
    }, () => toast.error(t('Location permission is off. Search the address instead.')));
  }

  const taken = saved.map((place) => place.label.toLowerCase());

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 md:p-6">
      <div>
        <Link to="/account" className="text-sm font-medium text-cholo-700 hover:underline">{t('← Account')}</Link>
        <h1 className="mt-1 text-2xl font-bold">{t('Saved places')}</h1>
        <p className="text-sm text-ink-500">{t('They appear as one-tap shortcuts when you book a ride.')}</p>
      </div>

      {editing && (
        <PlaceForm
          key={editing.id ?? editing.label}
          placeId={editing.id}
          initialLabel={editing.label}
          initialPlace={editing.place}
          taken={taken}
          onSaved={onSaved}
          onCancel={closeForm}
        />
      )}

      {loading ? (
        <div className="space-y-3"><Skeleton variant="card" /><Skeleton variant="card" /></div>
      ) : error ? (
        <EmptyState title={t('Places did not load')} hint={error} action={{ label: t('Retry'), onClick: () => void load() }} />
      ) : (
        <>
          <section className="overflow-hidden rounded-2xl border border-border bg-surface">
            {saved.map((place) => (
              <div key={place.id} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
                <PlaceIcon label={place.label} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{place.label}</p>
                  <p className="truncate text-sm text-ink-500">{place.address}</p>
                </div>
                <button type="button" className="text-sm font-medium text-cholo-700 hover:underline" onClick={() => setEditing({ id: place.id, label: place.label, place })}>{t('Edit')}</button>
                <button type="button" className="text-sm font-medium text-danger-600 hover:underline" onClick={() => void remove(place)}>{t('Remove')}</button>
              </div>
            ))}
            {PRESETS.slice(0, 2).filter((preset) => !taken.includes(preset.toLowerCase())).map((preset) => (
              <div key={preset} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
                <PlaceIcon label={preset} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{preset}</p>
                  <p className="text-sm text-ink-500">{t('Not set')}</p>
                </div>
                <button type="button" className="text-sm font-medium text-ink-500 hover:text-ink-900" onClick={() => void fillFromCurrentLocation(preset)}>{t('Use current location')}</button>
                <button type="button" className="text-sm font-medium text-cholo-700 hover:underline" onClick={() => setEditing({ label: preset, place: null })}>{t('Set')}</button>
              </div>
            ))}
          </section>

          {!editing && saved.length < 10 && (
            <Button variant="secondary" onClick={() => setEditing({ label: '', place: null })}>{t('Add another place')}</Button>
          )}

          {recent.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-ink-500">{t('Recent places')}</h2>
              <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
                {recent.map((place) => (
                  <li key={`${place.lat},${place.lng},${place.address}`} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-alt text-ink-500"><ClockIcon /></span>
                    <p className="min-w-0 flex-1 truncate text-sm">{place.address}</p>
                    <button type="button" className="text-sm font-medium text-cholo-700 hover:underline" onClick={() => setEditing({ label: '', place })}>{t('Save')}</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}
