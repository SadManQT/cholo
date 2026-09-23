import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as promosApi from '../../api/promos.api';
import type { AvailablePromo } from '../../api/promos.api';
import * as referenceApi from '../../api/reference.api';
import { TagIcon } from '../../components/layout/icons';
import { Button, EmptyState, Skeleton, toast } from '../../components/ui';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatBDT, formatDate } from '../../utils/format';
import { staggerStyle } from '../../utils/stagger';

function headline(promo: AvailablePromo) {
  return promo.promoType === 'percentage' ? `${promo.value}% off` : `${formatBDT(promo.value)} off`;
}

function terms(promo: AvailablePromo) {
  return [
    promo.maxDiscount ? `Up to ${formatBDT(promo.maxDiscount)}` : null,
    promo.minFare ? `Rides over ${formatBDT(promo.minFare)}` : null,
    promo.validUntil ? `Ends ${formatDate(promo.validUntil)}` : 'No end date',
  ].filter(Boolean).join(' · ');
}

export function PromosPage() {
  const [promos, setPromos] = useState<AvailablePromo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [city] = await referenceApi.listCities();
      setPromos(city ? await promosApi.listAvailable(city.id) : []);
    } catch (thrown) {
      setError(getApiErrorMessage(thrown, 'Could not load promos.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`${code} copied. Paste it when you book.`);
    } catch {
      toast.info(`Your code is ${code}.`);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 md:p-6">
      <div>
        <Link to="/account" className="text-sm font-medium text-cholo-700 hover:underline">← Account</Link>
        <h1 className="mt-1 text-2xl font-bold">Promos</h1>
        <p className="text-sm text-ink-500">Enter a code under “Promo code” when you choose your ride.</p>
      </div>
      {loading ? (
        <div className="space-y-3"><Skeleton variant="card" /><Skeleton variant="card" /></div>
      ) : error ? (
        <EmptyState title="Promos did not load" hint={error} action={{ label: 'Retry', onClick: () => void load() }} />
      ) : promos.length === 0 ? (
        <EmptyState icon={<TagIcon className="h-10 w-10" />} title="No promos right now" hint="New offers appear here as soon as they go live." />
      ) : (
        <ul className="space-y-3">
          {promos.map((promo, index) => (
            <li key={promo.code} className="animate-stagger-in flex overflow-hidden rounded-2xl border border-border bg-surface" style={staggerStyle(index)}>
              <div className="flex w-28 shrink-0 flex-col items-center justify-center border-r border-dashed border-border bg-cholo-50 p-3 text-center">
                <p className="text-lg font-black leading-tight text-cholo-800">{headline(promo)}</p>
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-mono text-base font-bold tracking-wider">{promo.code}</p>
                  {promo.description && <p className="text-sm text-ink-900">{promo.description}</p>}
                  <p className="mt-0.5 text-xs text-ink-500">{terms(promo)}</p>
                </div>
                <Button variant="secondary" onClick={() => void copy(promo.code)}>Copy code</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
