import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import * as paymentsApi from '../../api/payments.api';
import type { PaymentSummary } from '../../api/payments.api';
import { Skeleton } from '../../components/ui';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatBDT } from '../../utils/format';

const POLL_MS = 2_000;
const MAX_POLLS = 15;

// Where the gateway sends the rider back. The server settles the payment (verified with SSLCommerz) before
// redirecting here; if its confirmation lags, poll briefly for the IPN to land.
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
      .catch((thrown) => { if (!cancelled) setError(getApiErrorMessage(thrown, 'Could not check this payment.')); });
    return () => { cancelled = true; };
  }, [publicId, polls]);

  const settling = payment && ['initiated', 'pending'].includes(payment.status) && gatewayResult === 'success';
  useEffect(() => {
    if (!settling || polls >= MAX_POLLS) return;
    const timer = window.setTimeout(() => setPolls((count) => count + 1), POLL_MS);
    return () => window.clearTimeout(timer);
  }, [settling, polls]);

  const backTo = payment?.purpose === 'trip' && payment.tripCode
    ? { to: `/trips/${payment.tripCode}`, label: 'Back to your trip' }
    : { to: '/wallet', label: 'Back to wallet' };

  let tone = 'bg-surface-alt text-ink-500';
  let title = 'Checking your payment…';
  let body = 'This usually takes a few seconds.';
  if (error) {
    title = 'We couldn’t check this payment';
    body = error;
  } else if (payment?.status === 'succeeded') {
    tone = 'bg-cholo-50 text-cholo-700';
    title = payment.purpose === 'trip' ? 'Trip paid' : 'Money added';
    body = `${formatBDT(payment.amount)} ${payment.purpose === 'trip' ? 'paid. Your receipt is ready.' : 'is now in your wallet.'}`;
  } else if (payment && (payment.status === 'failed' || gatewayResult !== 'success')) {
    tone = 'bg-danger-600/10 text-danger-600';
    title = gatewayResult === 'cancel' ? 'Payment cancelled' : 'Payment didn’t go through';
    body = 'You weren’t charged. You can try again with the same or a different method.';
  } else if (payment && polls >= MAX_POLLS) {
    title = 'Still confirming with your bank';
    body = 'We’ll update your trip or wallet as soon as the gateway confirms. You can safely leave this page.';
  }

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md flex-col items-center justify-center gap-5 px-4 text-center">
      {!payment && !error ? <Skeleton variant="card" className="h-40 w-full" /> : (
        <>
          <span className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold ${tone}`} aria-hidden="true">
            {payment?.status === 'succeeded' ? '✓' : title.startsWith('Payment') || error ? '!' : '…'}
          </span>
          <div role="status" aria-live="polite">
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="mt-1 text-ink-500">{body}</p>
          </div>
          <Link to={backTo.to} className="inline-flex h-11 items-center rounded-xl bg-cholo-700 px-5 font-semibold text-white hover:bg-cholo-800">{backTo.label}</Link>
        </>
      )}
    </main>
  );
}
