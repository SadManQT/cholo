import { useState } from 'react';
import { Link } from 'react-router-dom';
import { t } from '../../i18n';

const VEHICLES = [
  { key: 'bike', icon: '🏍️', name: t('Bike'), eta: '3 min away', fare: '৳120' },
  { key: 'cng', icon: '🛺', name: t('CNG'), eta: '5 min away', fare: '৳250' },
  { key: 'car', icon: '🚗', name: t('Car'), eta: '8 min away', fare: '৳450' },
] as const;

const CTA_PRIMARY = 'inline-flex h-12 w-full items-center justify-center rounded-xl bg-cholo-700 px-6 text-base font-semibold text-white transition-[background-color,transform] duration-150 ease-cholo-out hover:bg-cholo-800 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700 focus-visible:ring-offset-2';

export function BookingPreviewCard() {
  const [selected, setSelected] = useState<(typeof VEHICLES)[number]['key']>('bike');

  return (
    <div className="w-full rounded-2xl border border-border bg-surface p-5 shadow-xl sm:p-6">
      <h3 className="font-bold text-ink-900">{t('Book your ride')}</h3>
      <p className="mt-0.5 text-xs text-ink-500">{t('A preview of the real thing — sign up to actually book.')}</p>

      <div className="relative mt-4 space-y-2">
        <div className="pointer-events-none absolute left-[19px] top-6 bottom-6 w-px bg-border" aria-hidden="true" />
        <div className="relative flex items-center gap-3 rounded-xl bg-surface-alt px-3.5 py-2.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-cholo-700" aria-hidden="true" />
          <span className="truncate text-sm text-ink-900">{t('Gulshan 2 Circle')}</span>
        </div>
        <div className="relative flex items-center gap-3 rounded-xl bg-surface-alt px-3.5 py-2.5">
          <span className="h-2 w-2 shrink-0 rounded-sm bg-marigold-500" aria-hidden="true" />
          <span className="truncate text-sm text-ink-500">{t('Where to?')}</span>
        </div>
      </div>

      <div className="mt-4 space-y-2" role="radiogroup" aria-label={t('Vehicle preview')}>
        {VEHICLES.map((vehicle) => (
          <button
            key={vehicle.key}
            type="button"
            role="radio"
            aria-checked={selected === vehicle.key}
            onClick={() => setSelected(vehicle.key)}
            className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-[color,background-color,border-color,transform] duration-150 ease-cholo-out active:scale-[0.98] ${
              selected === vehicle.key ? 'border-cholo-700 bg-cholo-50' : 'border-border hover:border-cholo-700/40'
            }`}
          >
            <span className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden="true">{vehicle.icon}</span>
              <span>
                <span className="block text-sm font-semibold text-ink-900">{vehicle.name}</span>
                <span className="block text-xs text-ink-500">{vehicle.eta}</span>
              </span>
            </span>
            <span className="font-bold tabular-nums text-ink-900">{vehicle.fare}</span>
          </button>
        ))}
      </div>

      <Link to="/register" className={`${CTA_PRIMARY} mt-4`}>
        {t('Confirm {0}', VEHICLES.find((v) => v.key === selected)?.name)}
      </Link>
    </div>
  );
}
