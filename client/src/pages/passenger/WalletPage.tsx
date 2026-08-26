import { useCallback, useEffect, useRef, useState } from 'react';
import * as walletApi from '../../api/wallet.api';
import { WalletTxnRow } from '../../components/wallet/WalletTxnRow';
import { EmptyState, Skeleton } from '../../components/ui';
import type { Wallet, WalletTransaction } from '../../types/wallet.types';
import { formatBDT } from '../../utils/format';
import { getApiErrorMessage } from '../../utils/apiError';
import { staggerStyle } from '../../utils/stagger';

export function WalletPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadPage = useCallback(async (nextPage: number, replace = false) => {
    if (replace) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      // Balance only needs fetching on the initial (replace) load — a
      // "load more" page of the ledger doesn't change it, so there's
      // nothing to refetch or overwrite existing wallet state with.
      const [nextWallet, result] = await Promise.all([
        replace ? walletApi.getWallet() : null,
        walletApi.listTransactions({ page: nextPage, limit: 20 }),
      ]);
      if (replace) setWallet(nextWallet);
      setTransactions((current) => replace ? result.data : [...current, ...result.data]);
      setPage(nextPage);
      setTotal(result.meta?.total ?? result.data.length);
    } catch (thrown) {
      setError(getApiErrorMessage(thrown, 'Could not load your wallet.'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(1, true);
  }, [loadPage]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || loading || loadingMore || transactions.length >= total) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadPage(page + 1);
    }, { rootMargin: '160px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadPage, loading, loadingMore, page, total, transactions.length]);

  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-3xl px-4 py-5 md:px-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Wallet</h1>
        <p className="text-sm text-ink-500">Your balance and every transaction that moved it.</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton variant="card" className="h-24" />
          <Skeleton variant="card" /><Skeleton variant="card" /><Skeleton variant="card" />
        </div>
      ) : error && transactions.length === 0 && !wallet ? (
        <EmptyState title="Wallet did not load" hint={error} action={{ label: 'Retry', onClick: () => loadPage(1, true) }} />
      ) : (
        <>
          {/* Not <Card>: its own shared classes (bg-surface, p-4) sit at
              equal CSS specificity with an override className and can win
              depending on Tailwind's generated stylesheet order rather
              than className string order — a plain div sidesteps that
              entirely for this one colored-hero case. */}
          <div className="mb-5 rounded-xl bg-cholo-700 p-5 text-white">
            <p className="text-sm text-white/80">Available balance</p>
            <p className="mt-1 text-4xl font-bold tabular-nums">{formatBDT(wallet?.balance)}</p>
            <p className="mt-2 text-xs text-white/70">{wallet?.currency}{wallet?.status === 'frozen' ? ' · Frozen' : ''}</p>
          </div>

          <h2 className="mb-3 font-semibold">Transactions</h2>
          {transactions.length === 0 ? (
            <EmptyState title="No transactions yet" hint="Trip payments, top-ups, and earnings will show up here." />
          ) : (
            <div className="space-y-3">
              {transactions.map((txn, index) => (
                <div key={txn.id} className="animate-stagger-in" style={staggerStyle(index)}>
                  <WalletTxnRow txn={txn} />
                </div>
              ))}
              {error && (
                <EmptyState title="More transactions did not load" hint={error} action={{ label: 'Retry', onClick: () => loadPage(page + 1) }} className="py-6" />
              )}
              {loadingMore && <><Skeleton variant="card" /><Skeleton variant="card" /></>}
              <div ref={sentinelRef} className="h-1" aria-hidden="true" />
            </div>
          )}
        </>
      )}
    </main>
  );
}
