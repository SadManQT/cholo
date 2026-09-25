import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as driverApi from '../../api/driver.api';
import { DocumentSlot } from '../../components/driver/DocumentSlot';
import { EmptyState, Skeleton, StatePill } from '../../components/ui';
import type { DriverDocType, DriverStatus } from '../../types/ride.types';
import { getApiErrorMessage } from '../../utils/apiError';
import { t } from '../../i18n';

const DRIVER_DOCS: { type: DriverDocType; label: string; hint: string; askNumber?: boolean; askExpiry?: boolean }[] = [
  { type: 'license', label: t('Driving license'), hint: t('Both sides, all text readable.'), askNumber: true, askExpiry: true },
  { type: 'nid', label: t('National ID'), hint: t('Front of your NID card.'), askNumber: true },
  { type: 'photo', label: t('Profile photo'), hint: t('A clear, recent photo of your face.') },
  { type: 'police_clearance', label: t('Police clearance'), hint: t('Issued within the last 6 months.'), askExpiry: true },
];

const STATUS_COPY: Record<string, string> = {
  pending: 'We review each document, then your application as a whole.',
  approved: 'You are approved to drive. Keep your documents up to date.',
  rejected: 'Your application needs changes. Fix the items below and upload again; that reopens the review.',
  suspended: 'Your driver account is suspended. Contact support.',
};

export function DriverDocumentsPage() {
  const [status, setStatus] = useState<DriverStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setStatus(await driverApi.getStatus());
    } catch (thrown) {
      setError(getApiErrorMessage(thrown, t('Could not load your documents.')));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (error) return <EmptyState title={t('Documents did not load')} hint={error} action={{ label: t('Retry'), onClick: () => void load() }} />;
  if (!status) return <main className="mx-auto max-w-3xl space-y-3 p-4"><Skeleton variant="card" /><Skeleton variant="card" /></main>;

  // Newest upload per type wins; the API returns documents newest first.
  const latest = new Map<string, (typeof status.documents)[number]>();
  for (const document of status.documents) if (!latest.has(document.docType)) latest.set(document.docType, document);
  const approvedCount = DRIVER_DOCS.filter((doc) => latest.get(doc.type)?.status === 'approved').length;

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 md:p-6">
      <div>
        <Link to="/driver/account" className="text-sm font-medium text-cholo-700 hover:underline">{t('← Account')}</Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{t('Documents')}</h1>
          <StatePill state={status.verificationStatus} />
        </div>
        <p className="text-sm text-ink-500">{t(STATUS_COPY[status.verificationStatus] ?? '')}</p>
      </div>

      {status.verificationStatus === 'rejected' && status.rejectionReason && (
        <p role="alert" className="rounded-xl border border-danger-600/30 bg-danger-600/5 p-3 text-sm text-danger-600">{t('Reviewer note:')} {status.rejectionReason}</p>
      )}

      <div>
        <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{t('{0} of {1} approved', approvedCount, DRIVER_DOCS.length)}</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-cholo-700 transition-[width] duration-500" style={{ width: `${(approvedCount / DRIVER_DOCS.length) * 100}%` }} />
        </div>
      </div>

      <div className="space-y-3">
        {DRIVER_DOCS.map((doc) => (
          <DocumentSlot
            key={doc.type}
            label={doc.label}
            hint={doc.hint}
            askNumber={doc.askNumber}
            askExpiry={doc.askExpiry}
            latest={latest.get(doc.type)}
            onSubmit={async (input) => { await driverApi.addDocument(doc.type, input); await load(); }}
          />
        ))}
      </div>

      <Link to="/driver/vehicles" className="block rounded-xl border border-border bg-surface p-4 text-sm hover:bg-surface-alt">
        <span className="font-semibold text-ink-900">{t('Next: your vehicle →')}</span>
        <span className="block text-ink-500">{t('Add the vehicle you\'ll drive and upload its papers.')}</span>
      </Link>
    </main>
  );
}
