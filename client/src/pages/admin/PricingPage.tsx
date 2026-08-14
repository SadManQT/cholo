import { useCallback, useEffect, useState } from 'react';
import * as adminApi from '../../api/admin.api';
import * as referenceApi from '../../api/reference.api';
import { Button, Card, EmptyState, Input, Skeleton, toast } from '../../components/ui';
import type { PricingRule, PublishPricingRuleInput } from '../../types/admin.types';
import type { City, VehicleCategory } from '../../types/ride.types';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatBDT, formatDateTime } from '../../utils/format';

const numberFields: Array<[keyof PublishPricingRuleInput, string]> = [
  ['baseFare', 'Base fare'], ['perKmRate', 'Per km'], ['perMinRate', 'Per minute'],
  ['minimumFare', 'Minimum fare'], ['bookingFee', 'Booking fee'], ['waitingPerMin', 'Waiting/min'],
  ['freeWaitMinutes', 'Free wait minutes'], ['cancellationFee', 'Cancellation fee'],
];

function defaultEffectiveFrom() {
  const local = new Date(Date.now() + 300_000);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}

export function PricingPage() {
  const [rules, setRules] = useState<PricingRule[]>([]); const [cities, setCities] = useState<City[]>([]); const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [publishing, setPublishing] = useState(false); const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ cityId: '', categoryId: '', effectiveFrom: defaultEffectiveFrom(), baseFare: '', perKmRate: '', perMinRate: '', minimumFare: '', bookingFee: '0', waitingPerMin: '0', freeWaitMinutes: '0', cancellationFee: '0' });
  const load = useCallback(async () => { setError(null); try { const [ruleResult, nextCities, nextCategories] = await Promise.all([adminApi.listPricingRules({ limit: 100 }), referenceApi.listCities(), referenceApi.listVehicleCategories()]); setRules(ruleResult.data); setCities(nextCities); setCategories(nextCategories); } catch (thrown) { setError(getApiErrorMessage(thrown, 'Could not load pricing rules.')); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  function update(key: string, value: string) { setForm((current) => ({ ...current, [key]: value })); }
  async function publish() {
    if (!form.cityId || !form.categoryId || !form.effectiveFrom || numberFields.some(([key]) => form[key] === '')) { toast.error('Complete every tariff field.'); return; }
    setPublishing(true); try {
      const payload = Object.fromEntries(numberFields.map(([key]) => [key, Number(form[key])])) as unknown as PublishPricingRuleInput;
      await adminApi.publishPricingRule({ ...payload, cityId: Number(form.cityId), categoryId: Number(form.categoryId), effectiveFrom: new Date(form.effectiveFrom).toISOString() });
      toast.success('New tariff published. The previous card was closed at this start time.'); setShowForm(false); await load();
    } catch (thrown) { toast.error(getApiErrorMessage(thrown, 'Could not publish this tariff.')); } finally { setPublishing(false); }
  }
  return <main className="mx-auto max-w-6xl space-y-5"><div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-2xl font-bold">Pricing publisher</h1><p className="text-sm text-ink-500">Publish effective-dated rate cards; historical amounts are never overwritten.</p></div><Button onClick={() => setShowForm((value) => !value)}>{showForm ? 'Close form' : 'Publish tariff'}</Button></div>
    {showForm && <Card><h2 className="font-semibold">New rate card</h2><div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4"><label className="text-sm font-medium">City<select value={form.cityId} onChange={(e) => update('cityId', e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3"><option value="">Choose</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label><label className="text-sm font-medium">Category<select value={form.categoryId} onChange={(e) => update('categoryId', e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3"><option value="">Choose</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{numberFields.map(([key, label]) => <Input key={key} label={label} inputMode="decimal" value={form[key]} onChange={(e) => update(key, e.target.value)} />)}<label className="text-sm font-medium">Effective from<input type="datetime-local" value={form.effectiveFrom} onChange={(e) => update('effectiveFrom', e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3" /></label></div><Button className="mt-4" loading={publishing} onClick={() => void publish()}>Publish new tariff</Button></Card>}
    {loading ? <div className="space-y-3"><Skeleton variant="card" /><Skeleton variant="card" /></div> : error && rules.length === 0 ? <EmptyState title="Pricing did not load" hint={error} action={{ label: 'Retry', onClick: load }} /> : rules.length === 0 ? <EmptyState title="No tariffs" hint="Publish the first rate card." /> : <div className="overflow-x-auto rounded-xl border border-border bg-surface"><table className="min-w-full text-left text-sm"><thead className="bg-surface-alt text-ink-500"><tr><th className="p-3">Market</th><th className="p-3">Core rates</th><th className="p-3">Minimum</th><th className="p-3">Effective window</th></tr></thead><tbody className="divide-y divide-border">{rules.map((rule) => <tr key={rule.id}><td className="p-3 font-semibold">{rule.cityName} · {rule.categoryName}</td><td className="p-3">{formatBDT(rule.baseFare)} base · {formatBDT(rule.perKmRate)}/km · {formatBDT(rule.perMinRate)}/min</td><td className="p-3">{formatBDT(rule.minimumFare)}</td><td className="p-3 text-xs">{formatDateTime(rule.effectiveFrom)} → {rule.effectiveTo ? formatDateTime(rule.effectiveTo) : 'open-ended'}</td></tr>)}</tbody></table></div>}
  </main>;
}
