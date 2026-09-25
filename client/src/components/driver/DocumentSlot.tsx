import { useRef, useState } from 'react';
import { ACCEPTED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, uploadFile } from '../../api/uploads.api';
import type { DocumentInput } from '../../api/driver.api';
import type { DriverDocument } from '../../types/ride.types';
import { getApiErrorMessage } from '../../utils/apiError';
import { expiryFlag } from '../../utils/documents';
import { dhakaDate } from '../../utils/format';
import { FileIcon } from '../layout/icons';
import { Button, Input, StatePill, toast } from '../ui';
import { t } from '../../i18n';

const TONE = { danger: 'text-danger-600', warn: 'text-marigold-500', muted: 'text-ink-500' };

interface DocumentSlotProps {
  label: string;
  hint: string;
  latest: DriverDocument | undefined;
  askNumber?: boolean;
  askExpiry?: boolean;
  onSubmit: (input: DocumentInput) => Promise<void>;
}

export function DocumentSlot({ label, hint, latest, askNumber = false, askExpiry = false, onSubmit }: DocumentSlotProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [docNumber, setDocNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const flag = latest ? expiryFlag(latest.expiryDate) : null;
  const canReplace = !latest || latest.status !== 'pending';

  function pick(next: File | undefined) {
    if (!next) return;
    if (!ACCEPTED_UPLOAD_TYPES.includes(next.type)) return setError(t('Upload a JPG, PNG, WebP or PDF file.'));
    if (next.size > MAX_UPLOAD_BYTES) return setError(t('That file is larger than 5 MB.'));
    setError(null);
    setFile(next);
  }

  async function submit() {
    if (!file) return setError(t('Choose a photo or PDF of the document.'));
    if (askExpiry && !expiryDate) return setError(t('Enter the expiry date printed on the document.'));
    setBusy(true);
    setError(null);
    try {
      const fileUrl = await uploadFile(file, { isPrivate: true });
      await onSubmit({
        fileUrl,
        ...(docNumber.trim() ? { docNumber: docNumber.trim() } : {}),
        ...(expiryDate ? { expiryDate } : {}),
      });
      setFile(null);
      setDocNumber('');
      setExpiryDate('');
      toast.success(t('{0} submitted for review.', label));
    } catch (thrown) {
      setError(getApiErrorMessage(thrown, t('Could not submit this document.')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-alt text-ink-500"><FileIcon /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{label}</p>
            <StatePill state={latest?.status ?? 'missing'} />
          </div>
          <p className="text-sm text-ink-500">{hint}</p>
          {latest && (
            <p className="mt-1 text-xs">
              <a href={latest.fileUrl} target="_blank" rel="noreferrer" className="font-medium text-cholo-700 hover:underline">{t('View uploaded file')}</a>
              {flag && <span className={`ml-2 ${TONE[flag.tone]}`}>{flag.text}</span>}
            </p>
          )}
          {latest?.status === 'rejected' && latest.rejectionReason && (
            <p className="mt-2 rounded-lg bg-danger-600/5 px-3 py-2 text-sm text-danger-600">{t('Rejected:')} {latest.rejectionReason}</p>
          )}
        </div>
      </div>

      {canReplace && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => fileInput.current?.click()}>{file ? t('Choose another file') : latest ? t('Upload a new copy') : t('Choose file')}</Button>
            {file && <span className="min-w-0 truncate text-sm text-ink-500">{file.name}</span>}
            <input ref={fileInput} type="file" accept={ACCEPTED_UPLOAD_TYPES.join(',')} className="hidden" onChange={(event) => { pick(event.target.files?.[0]); event.target.value = ''; }} />
          </div>
          {file && (askNumber || askExpiry) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {askNumber && <Input label={t('Document number')} value={docNumber} onChange={(event) => setDocNumber(event.target.value)} />}
              {askExpiry && (
                <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-900">{t('Expiry date')}
                  <input type="date" value={expiryDate} min={dhakaDate(1)} onChange={(event) => setExpiryDate(event.target.value)} className="h-11 rounded-xl border border-border bg-surface px-3.5 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700" />
                </label>
              )}
            </div>
          )}
          {error && <p className="text-sm text-danger-600">{error}</p>}
          {file && <Button loading={busy} onClick={() => void submit()}>{t('Submit for review')}</Button>}
        </div>
      )}
    </div>
  );
}
