import { useCallback, useEffect, useState } from 'react';
import * as adminApi from '../../api/admin.api';
import type { SurgeRule } from '../../api/admin.api';
import * as referenceApi from '../../api/reference.api';
import { Button, Card, EmptyState, Skeleton, StatePill, toast } from '../../components/ui';
import type { Zone } from '../../types/admin.types';
import type { VehicleCategory } from '../../types/ride.types';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatDateTime } from '../../utils/format';

const REASONS: Array<{ value: SurgeRule['reason']; label: string }> = [
  { value: 'peak_hour', label: 'Rush hour' },
  { value: 'weather', label: 'Rain or bad weather' },
  { value: 'demand', label: 'High demand' },
  { value: 'event', label: 'Event' },
];

const DURATIONS = [
  { value: '60', label: '1 hour' },
  { value: '120', label: '2 hours' },
  { value: '240', label: '4 hours' },
  { value: '', label: 'Until I end it' },
];

function state(rule: SurgeRule) {
  if (rule.isLive) return 'live';
  if (rule.isActive && new Date(rule.startsAt) > new Date()) return 'scheduled';
  return 'ended';
}

export function SurgePage() {
  const [rules, setRules] = useState<SurgeRule[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [showEnded, setShowEnded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ zoneId: '', categoryId: '', multiplier: '1.3', reason: 'peak_hour' as SurgeRule['reason'], minutes: '120' });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [result, nextZones, nextCategories] = await Promise.all([
        adminApi.listSurge(showEnded), adminApi.listZones(), referenceApi.listVehicleCategories(),
      ]);
      setRules(result.data);
      setZones(nextZones.filter((zone) => zone.isActive && zone.zoneType !== 'restricted'));
      setCategories(nextCategories);
    } catch (thrown) {
      setError(getApiErrorMessage(thrown, 'Could not load surge rules.'));
    } finally {
      setLoading(false);
    }
  }, [showEnded]);
  useEffect(() => { void load(); }, [load]);

  async function start() {
    if (!form.zoneId) return toast.error('Choose a zone. Draw one on the Zones page first if the list is empty.');
    setBusy('create');
    try {
      await adminApi.createSurge({
        zoneId: form.zoneId,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        multiplier: Number(form.multiplier),
        reason: form.reason,
        endsAt: form.minutes ? new Date(Date.now() + Number(form.minutes) * 60_000).toISOString() : null,
      });
      toast.success('Surge is live. New quotes in that zone include it right away.');
      await load();
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not start surge.'));
    } finally {
      setBusy(null);
    }
  }

  async function end(rule: SurgeRule) {
    setBusy(rule.id);
    try {
      await adminApi.endSurge(rule.id);
      toast.success(`Surge in ${rule.zoneName} ended. Rides already booked keep the price they were quoted.`);
      await load();
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not end surge.'));
    } finally {
      setBusy(null);
    }
  }

  const select = 'mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3';

  return (
    <main className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Surge pricing</h1>
        <p className="text-sm text-ink-500">Raise fares in one zone for a set time when riders outnumber drivers. Riders see the multiplier before they confirm, and it is capped at 3×.</p>
      </div>

      <Card>
        <h2 className="font-semibold">Start surge</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm font-medium">Zone
            <select value={form.zoneId} onChange={(event) => setForm({ ...form, zoneId: event.target.value })} className={select}>
              <option value="">Choose a zone</option>
              {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Category
            <select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} className={select}>
              <option value="">All categories</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Multiplier
            <select value={form.multiplier} onChange={(event) => setForm({ ...form, multiplier: event.target.value })} className={select}>
              {['1.1', '1.2', '1.3', '1.5', '1.8', '2', '2.5', '3'].map((value) => <option key={value} value={value}>{value}×</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Reason
            <select value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value as SurgeRule['reason'] })} className={select}>
              {REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">For
            <select value={form.minutes} onChange={(event) => setForm({ ...form, minutes: event.target.value })} className={select}>
              {DURATIONS.map((duration) => <option key={duration.label} value={duration.value}>{duration.label}</option>)}
            </select>
          </label>
        </div>
        <Button className="mt-4" loading={busy === 'create'} onClick={() => void start()}>Start surge now</Button>
      </Card>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-cholo-700" checked={showEnded} onChange={(event) => setShowEnded(event.target.checked)} />
        Show ended surges
      </label>

      {loading ? (
        <div className="space-y-3"><Skeleton variant="card" /><Skeleton variant="card" /></div>
      ) : error && rules.length === 0 ? (
        <EmptyState title="Surge rules did not load" hint={error} action={{ label: 'Retry', onClick: load }} />
      ) : rules.length === 0 ? (
        <EmptyState title="No surge right now" hint="Every zone is at normal prices." />
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id} className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{rule.zoneName} · {rule.multiplier}× {rule.categoryName ? `· ${rule.categoryName}` : ''}</p>
                <p className="text-sm text-ink-500">
                  {REASONS.find((reason) => reason.value === rule.reason)?.label} · {formatDateTime(rule.startsAt)} → {rule.endsAt ? formatDateTime(rule.endsAt) : 'until ended'}
                </p>
              </div>
              <StatePill state={state(rule)} />
              {rule.isActive && state(rule) !== 'ended' && (
                <Button variant="secondary" loading={busy === rule.id} onClick={() => void end(rule)}>End now</Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
