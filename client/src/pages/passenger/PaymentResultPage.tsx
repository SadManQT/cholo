import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import * as paymentsApi from '../../api/payments.api';
import type { PaymentSummary } from '../../api/payments.api';
import { Skeleton } from '../../components/ui';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatBDT } from '../../utils/format';
import { TOPUP_RETURN_KEY } from '../../utils/topup';
import { t } from '../../i18n';

const POLL_MS = 2_000;

const MAX_POLLS = 15;

export function PaymentResultPage() {
  const { publicId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const gatewayResult = searchParams.get('result');
  const [payment, setPayment] = useState<PaymentSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polls, setPolls] = useState(0);

  useEffect(() => {
    let cancelled = false;
    paymentsApi.getPayment(publicId)
      .then((next) => { if (!cancelled) setPayment(next); })
      .catch((thrown) => { if (!cancelled) setError(getApiErrorMessage(thrown, t('Could not check this payment.'))); });
    return () => { cancelled = true; };
  }, [publicId, polls]);

  const settling = payment && ['initiated', 'pending'].includes(payment.status) && gatewayResult === 'success';
  useEffect(() => {
    if (!settling || polls >= MAX_POLLS) return;
    const timer = window.setTimeout(() => setPolls((count) => count + 1), POLL_MS);
    return () => window.clearTimeout(timer);
  }, [settling, polls]);

  let returnTo: string | null = null;
  try {
    returnTo = sessionStorage.getItem(TOPUP_RETURN_KEY);
  } catch {
  }
  const backTo = payment?.purpose === 'trip' && payment.tripCode
    ? { to: `/trips/${payment.tripCode}`, label: t('Back to your trip') }
    : payment?.status === 'succeeded' && returnTo?.startsWith('/trips/')
      ? { to: returnTo, label: t('Continue to pay your trip') }
      : { to: '/wallet', label: t('Back to wallet') };

  let tone = 'bg-surface-alt text-ink-500';
  let icon = '…';
  let title = t('Checking your payment…');
  let body = t('This usually takes a few seconds.');
  if (error) {
    icon = '!';
    title = t('We couldn’t check this payment');
    body = error;
  } else if (payment?.status === 'succeeded') {
    tone = 'bg-cholo-50 text-cholo-700';
    icon = '✓';
    title = payment.purpose === 'trip' ? t('Trip paid') : t('Money added');
    body = payment.purpose === 'trip'
      ? t('{0} paid. Your receipt is ready.', formatBDT(payment.amount))
      : t('{0} is now in your wallet.', formatBDT(payment.amount));
  } else if (payment && (payment.status === 'failed' || gatewayResult !== 'success')) {
    tone = 'bg-danger-600/10 text-danger-600';
    icon = '!';
    title = gatewayResult === 'cancel' ? t('Payment cancelled') : t('Payment didn’t go through');
    body = t('You weren’t charged. You can try again with the same or a different method.');
  } else if (payment && polls >= MAX_POLLS) {
    title = t('Still confirming with your bank');
    body = t('We’ll update your trip or wallet as soon as the gateway confirms. You can safely leave this page.');
  }

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-var(--app-chrome))] max-w-md flex-col items-center justify-center gap-5 px-4 text-center">
      {!payment && !error ? <Skeleton variant="card" className="h-40 w-full" /> : (
        <>
          <span className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold ${tone}`} aria-hidden="true">
            {icon}
          </span>
          <div role="status" aria-live="polite">
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="mt-1 text-ink-500">{body}</p>
          </div>
          <Link to={backTo.to} onClick={() => { try { sessionStorage.removeItem(TOPUP_RETURN_KEY); } catch { } }} className="inline-flex h-11 items-center rounded-xl bg-cholo-700 px-5 font-semibold text-white hover:bg-cholo-800">{backTo.label}</Link>
        </>
      )}
    </main>
  );
}
