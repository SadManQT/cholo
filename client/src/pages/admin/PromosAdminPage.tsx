import { useCallback, useEffect, useState } from 'react';
import * as adminApi from '../../api/admin.api';
import type { AdminPromo, PromoInput } from '../../api/admin.api';
import * as referenceApi from '../../api/reference.api';
import { Button, Card, EmptyState, Input, Skeleton, StatePill, toast } from '../../components/ui';
import type { City, VehicleCategory } from '../../types/ride.types';
import { getApiErrorMessage, getApiFieldErrors } from '../../utils/apiError';
import { formatBDT, formatDateTime } from '../../utils/format';

function localNow() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

const EMPTY_FORM = {
  code: '', description: '', promoType: 'percentage' as PromoInput['promoType'], value: '', maxDiscount: '', minFare: '',
  usageLimitTotal: '', usageLimitPerUser: '1', firstRideOnly: false, cityId: '', categoryId: '',
  validFrom: localNow(), validUntil: '', notifyRiders: false,
};

const optionalNumber = (value: string) => (value.trim() === '' ? null : Number(value));

function describe(promo: AdminPromo) {
  const amount = promo.promoType === 'percentage' ? `${promo.value}% off` : `${formatBDT(promo.value)} off`;
  const cap = promo.maxDiscount != null && promo.promoType === 'percentage' ? `, up to ${formatBDT(promo.maxDiscount)}` : '';
  const minimum = promo.minFare != null ? ` · rides over ${formatBDT(promo.minFare)}` : '';
  return `${amount}${cap}${minimum}${promo.firstRideOnly ? ' · first ride only' : ''}`;
}

export function PromosAdminPage() {
  const [promos, setPromos] = useState<AdminPromo[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [result, nextCities, nextCategories] = await Promise.all([
        adminApi.listPromos(), referenceApi.listCities(), referenceApi.listVehicleCategories(),
      ]);
      setPromos(result.data);
      setCities(nextCities);
      setCategories(nextCategories);
    } catch (thrown) {
      setError(getApiErrorMessage(thrown, 'Could not load promo codes.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function create() {
    setFieldErrors({});
    if (!form.code.trim() || !(Number(form.value) > 0)) {
      setFieldErrors({ code: form.code.trim() ? '' : 'Enter a code', value: Number(form.value) > 0 ? '' : 'Enter an amount above 0' });
      return;
    }
    setBusy('create');
    try {
      await adminApi.createPromo({
        code: form.code.trim(),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        promoType: form.promoType,
        value: Number(form.value),
        maxDiscount: optionalNumber(form.maxDiscount),
        minFare: optionalNumber(form.minFare),
        usageLimitTotal: optionalNumber(form.usageLimitTotal),
        usageLimitPerUser: optionalNumber(form.usageLimitPerUser),
        firstRideOnly: form.firstRideOnly,
        cityId: optionalNumber(form.cityId),
        categoryId: optionalNumber(form.categoryId),
        validFrom: new Date(form.validFrom).toISOString(),
        validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : null,
        isActive: true,
        notifyRiders: form.notifyRiders,
      });
      toast.success(form.notifyRiders ? 'Promo created and riders were notified.' : 'Promo created.');
      setForm({ ...EMPTY_FORM, validFrom: localNow() });
      setShowForm(false);
      await load();
    } catch (thrown) {
      const fields = getApiFieldErrors(thrown);
      if (Object.keys(fields).length) setFieldErrors(fields);
      else toast.error(getApiErrorMessage(thrown, 'Could not create this promo.'));
    } finally {
      setBusy(null);
    }
  }

  async function toggle(promo: AdminPromo) {
    setBusy(promo.id);
    try {
      const updated = await adminApi.updatePromo(promo.id, { isActive: !promo.isActive });
      setPromos((current) => current.map((item) => (item.id === promo.id ? updated : item)));
      toast.success(updated.isActive ? `${promo.code} is live again.` : `${promo.code} is paused.`);
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not update this promo.'));
    } finally {
      setBusy(null);
    }
  }

  const select = 'mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3';

  return (
    <main className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Promo codes</h1>
          <p className="text-sm text-ink-500">Create codes riders enter at booking. Every change is recorded in the audit log.</p>
        </div>
        <Button onClick={() => setShowForm((value) => !value)}>{showForm ? 'Close form' : 'New promo code'}</Button>
      </div>

      {showForm && (
        <Card>
          <h2 className="font-semibold">New promo code</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Input label="Code" value={form.code} error={fieldErrors.code || undefined} onChange={(event) => update('code', event.target.value.toUpperCase())} placeholder="RAIN20" />
            <label className="text-sm font-medium">Type
              <select value={form.promoType} onChange={(event) => update('promoType', event.target.value as PromoInput['promoType'])} className={select}>
                <option value="percentage">Percent off</option>
                <option value="fixed_amount">Fixed taka off</option>
              </select>
            </label>
            <Input label={form.promoType === 'percentage' ? 'Percent (1–100)' : 'Taka off'} inputMode="decimal" value={form.value} error={fieldErrors.value || undefined} onChange={(event) => update('value', event.target.value)} />
            {form.promoType === 'percentage' && <Input label="Maximum discount ৳ (optional)" inputMode="decimal" value={form.maxDiscount} onChange={(event) => update('maxDiscount', event.target.value)} />}
            <Input label="Minimum fare ৳ (optional)" inputMode="decimal" value={form.minFare} onChange={(event) => update('minFare', event.target.value)} />
            <Input label="Total uses (optional)" inputMode="numeric" value={form.usageLimitTotal} onChange={(event) => update('usageLimitTotal', event.target.value)} />
            <Input label="Uses per rider" inputMode="numeric" value={form.usageLimitPerUser} onChange={(event) => update('usageLimitPerUser', event.target.value)} />
            <label className="text-sm font-medium">City
              <select value={form.cityId} onChange={(event) => update('cityId', event.target.value)} className={select}>
                <option value="">All cities</option>
                {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">Category
              <select value={form.categoryId} onChange={(event) => update('categoryId', event.target.value)} className={select}>
                <option value="">All categories</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">Starts
              <input type="datetime-local" value={form.validFrom} onChange={(event) => update('validFrom', event.target.value)} className={select} />
            </label>
            <label className="text-sm font-medium">Ends (optional)
              <input type="datetime-local" value={form.validUntil} onChange={(event) => update('validUntil', event.target.value)} className={select} />
              {fieldErrors.validUntil && <span className="mt-1 block text-xs text-danger-600">{fieldErrors.validUntil}</span>}
            </label>
            <Input label="Description (shown to riders)" value={form.description} onChange={(event) => update('description', event.target.value)} containerClassName="md:col-span-2" />
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-cholo-700" checked={form.firstRideOnly} onChange={(event) => update('firstRideOnly', event.target.checked)} /> First ride only</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-cholo-700" checked={form.notifyRiders} onChange={(event) => update('notifyRiders', event.target.checked)} /> Tell every rider in their inbox</label>
          </div>
          <Button className="mt-4" loading={busy === 'create'} onClick={() => void create()}>Create promo</Button>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3"><Skeleton variant="card" /><Skeleton variant="card" /></div>
      ) : error && promos.length === 0 ? (
        <EmptyState title="Promo codes did not load" hint={error} action={{ label: 'Retry', onClick: load }} />
      ) : promos.length === 0 ? (
        <EmptyState title="No promo codes yet" hint="Create the first one for your next campaign." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface-alt text-ink-500">
              <tr><th className="p-3">Code</th><th className="p-3">Offer</th><th className="p-3">Window</th><th className="p-3">Used</th><th className="p-3">Status</th><th className="p-3"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {promos.map((promo) => (
                <tr key={promo.id}>
                  <td className="p-3 font-mono font-semibold">{promo.code}</td>
                  <td className="p-3">{describe(promo)}</td>
                  <td className="p-3 text-xs">{formatDateTime(promo.validFrom)} → {promo.validUntil ? formatDateTime(promo.validUntil) : 'no end'}</td>
                  <td className="p-3 tabular-nums">{promo.redemptions}{promo.usageLimitTotal ? ` / ${promo.usageLimitTotal}` : ''}<span className="block text-xs text-ink-500">{formatBDT(promo.totalDiscount)} given</span></td>
                  <td className="p-3"><StatePill state={promo.isActive ? 'active' : 'paused'} /></td>
                  <td className="p-3 text-right"><Button variant="secondary" loading={busy === promo.id} onClick={() => void toggle(promo)}>{promo.isActive ? 'Pause' : 'Resume'}</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
