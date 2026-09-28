import { useEffect, useState } from 'react';
import { t } from '../../i18n';

const SLOW_AFTER_MS = 4_000;

// The API sleeps when nobody has used it for a while (free hosting) and takes up to a minute to wake. After a
// few seconds say so, so a first load doesn't look like a broken site.
export function FullScreenSpinner() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-alt px-6 text-center">
      <svg className="h-8 w-8 animate-spin text-cholo-700" viewBox="0 0 24 24" fill="none" aria-label={t('Loading')}>
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      {slow && (
        <div role="status" className="max-w-xs">
          <p className="font-semibold text-ink-900">{t('Starting Cholo…')}</p>
          <p className="mt-1 text-sm text-ink-500">{t('The server is waking up. This can take up to a minute the first time.')}</p>
        </div>
      )}
    </div>
  );
}
