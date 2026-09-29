import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as driverApi from '../../api/driver.api';
import * as walletApi from '../../api/wallet.api';
import { Card, EmptyState, Skeleton } from '../../components/ui';
import type { DailyEarning, EarningTripRow } from '../../types/earnings.types';
import type { Wallet } from '../../types/wallet.types';
import { getApiErrorMessage } from '../../utils/apiError';
import { dhakaDate, formatBDT, formatDate, formatDateTime } from '../../utils/format';
import { staggerStyle } from '../../utils/stagger';
import { t } from '../../i18n';

const RANGE_OPTIONS = [
  { label: t('7 days'), days: 7 },
  { label: t('30 days'), days: 30 },
  { label: t('90 days'), days: 90 },
];

export function EarningsPage() {
  const [rangeDays, setRangeDays] = useState(30);
  const [daily, setDaily] = useState<DailyEarning[]>([]);
  const [trips, setTrips] = useState<EarningTripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const [wallet, setWallet] = useState<Wallet | null>(null);

  useEffect(() => {
    walletApi.getWallet().then(setWallet).catch(() => setWallet(null));
  }, []);

  const load = useCallback(async (days: number) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    setDaily([]);
    setTrips([]);
    try {
      const result = await driverApi.getEarnings({ from: dhakaDate(1 - days), to: dhakaDate() });
      if (requestId !== requestIdRef.current) return;
      setDaily(result.daily);
      setTrips(result.trips);
    } catch (thrown) {
      if (requestId !== requestIdRef.current) return;
      setError(getApiErrorMessage(thrown, t('Could not load your earnings.')));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(rangeDays);
  }, [load, rangeDays]);

  const totals = daily.reduce(
    (sum, row) => ({
      gross: sum.gross + Number(row.grossTotal),
      commission: sum.commission + Number(row.commissionTotal),
      net: sum.net + Number(row.netTotal),
      trips: sum.trips + row.tripsCount,
    }),
    { gross: 0, commission: 0, net: 0, trips: 0 },
  );

  const cash = trips.filter((row) => row.paymentMethod === 'cash');
  const app = trips.filter((row) => row.paymentMethod !== 'cash');
  const sum = (rows: EarningTripRow[], key: 'grossFare' | 'commissionAmount' | 'netEarning') => rows.reduce((total, row) => total + Number(row[key]), 0);
  const cashKept = sum(cash, 'grossFare');
  const cashCommission = sum(cash, 'commissionAmount');
  const appCredited = sum(app, 'netEarning');
  const balance = Number(wallet?.balance ?? 0);

  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-3xl px-4 py-5 md:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('Earnings')}</h1>
          <p className="text-sm text-ink-500">{t('What you\'ve made, by day and by trip.')}</p>
        </div>
        <Link to="/driver/statements" className="flex min-h-11 items-center rounded-xl border border-border px-3 text-sm font-semibold text-cholo-700 hover:border-cholo-700">
          {t('Monthly statements')}
        </Link>
      </div>

      <div className="mb-5 flex gap-2" role="group" aria-label={t('Date range')}>
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option.days}
            type="button"
            onClick={() => setRangeDays(option.days)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-[color,background-color,transform] duration-150 ease-cholo-out active:scale-[0.97] ${
              rangeDays === option.days ? 'bg-cholo-700 text-white' : 'bg-surface-alt text-ink-500 hover:text-ink-900'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Skeleton variant="card" className="h-20" />
            <Skeleton variant="card" className="h-20" />
            <Skeleton variant="card" className="h-20" />
          </div>
          <Skeleton variant="card" /><Skeleton variant="card" />
        </div>
      ) : error && trips.length === 0 && daily.length === 0 ? (
        <EmptyState title={t('Earnings did not load')} hint={error} action={{ label: t('Retry'), onClick: () => load(rangeDays) }} />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-3 gap-3">
            <Card className="p-4">
              <p className="text-xs text-ink-500">{t('Trip fares')}</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{formatBDT(totals.gross)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-ink-500">{t('Commission')}</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-danger-600">−{formatBDT(totals.commission)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-ink-500">{t('Your earnings')}</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-cholo-700">{formatBDT(totals.net)}</p>
            </Card>
          </div>

          {trips.length > 0 && (
            <Card className="mb-5 p-4">
              <h2 className="font-semibold">{t('Where your money is')}</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-ink-500">{t('Cash you collected from riders (yours to keep)')}</dt><dd className="tabular-nums">{formatBDT(cashKept)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-ink-500">{t('Commission on cash trips (taken from your wallet)')}</dt><dd className="tabular-nums text-danger-600">−{formatBDT(cashCommission)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-ink-500">{t('Paid to your wallet from in-app trips')}</dt><dd className="tabular-nums text-cholo-700">+{formatBDT(appCredited)}</dd></div>
                {wallet && (
                  <div className="flex justify-between gap-4 border-t border-border pt-2 font-semibold">
                    <dt>{balance < 0 ? t('You owe Cholo') : t('Available to withdraw')}</dt>
                    <dd className={`tabular-nums ${balance < 0 ? 'text-danger-600' : ''}`}>{formatBDT(Math.abs(balance))}</dd>
                  </div>
                )}
              </dl>
              <p className="mt-3 text-xs text-ink-500">
                {t('Your wallet only moves for commission on cash trips and earnings from in-app trips, so it is not the same as your total earnings.')}{' '}
                <Link to="/driver/withdrawals" className="font-semibold text-cholo-700 hover:underline">{t('Withdraw')}</Link>
              </p>
            </Card>
          )}

          <h2 className="mb-3 font-semibold">{t('By day')}</h2>
          {daily.length === 0 ? (
            <EmptyState title={t('No earnings in this range')} hint={t('Completed, paid trips will show up here.')} />
          ) : (
            <div className="mb-6 space-y-2">
              {daily.map((row, index) => (
                <Card key={row.earningDate} className="flex items-center justify-between p-3 animate-stagger-in" style={staggerStyle(index)}>
                  <div>
                    <p className="text-sm font-medium">{formatDate(row.earningDate)}</p>
                    <p className="text-xs text-ink-500">{t(row.tripsCount === 1 ? '{0} trip' : '{0} trips', row.tripsCount)}</p>
                  </div>
                  <p className="font-semibold tabular-nums">{formatBDT(row.netTotal)}</p>
                </Card>
              ))}
            </div>
          )}

          <h2 className="mb-3 font-semibold">{t('Per trip')}</h2>
          {trips.length === 0 ? (
            <EmptyState title={t('No trips in this range')} />
          ) : (
            <div className="space-y-2">
              {trips.map((row, index) => (
                <Card key={row.id} className="p-3 animate-stagger-in" style={staggerStyle(index)}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{row.tripCode}</p>
                    <p className="font-semibold tabular-nums">{formatBDT(row.netEarning)}</p>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    {t('{0} · gross {1} · commission {2}%', formatDateTime(row.earnedAt), formatBDT(row.grossFare), row.commissionPct)}
                    {' · '}{row.paymentMethod === 'cash' ? t('Cash') : t('In app')}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
