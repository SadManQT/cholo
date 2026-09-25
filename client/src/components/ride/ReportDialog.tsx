import { useState } from 'react';
import * as tripsApi from '../../api/trips.api';
import type { ReportCategory } from '../../types/ride.types';
import { getApiErrorMessage } from '../../utils/apiError';
import { Button, Dialog, toast } from '../ui';
import { t } from '../../i18n';

const CATEGORIES: Array<{ value: ReportCategory; label: string }> = [
  { value: 'safety', label: t('I felt unsafe') },
  { value: 'harassment', label: t('Harassment') },
  { value: 'behavior', label: t('Rude or unprofessional') },
  { value: 'fraud', label: t('Fraud or overcharging') },
  { value: 'other', label: t('Something else') },
];

export function ReportDialog({ open, tripCode, personName, onClose, onReported }: {
  open: boolean;
  tripCode: string;
  personName: string;
  onClose: () => void;
  onReported: () => void;
}) {
  const [category, setCategory] = useState<ReportCategory>('behavior');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await tripsApi.reportTrip(tripCode, category, description.trim() || undefined);
      toast.success(t('Report sent. Our safety team will review it.'));
      onReported();
      onClose();
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, t('Could not send the report.')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      title={t('Report {0}', personName)}
      description={t('Reports are private. The person you report is not told who sent it.')}
      onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button>
        <Button variant="danger" loading={busy} onClick={() => void submit()}>{t('Send report')}</Button>
      </>}
    >
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">{t('What happened?')}</legend>
        {CATEGORIES.map((option) => (
          <label key={option.value} className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 text-sm has-[:checked]:border-cholo-700 has-[:checked]:bg-cholo-50">
            <input type="radio" name="report-category" value={option.value} checked={category === option.value} onChange={() => setCategory(option.value)} className="h-4 w-4 accent-cholo-700" />
            {option.label}
          </label>
        ))}
      </fieldset>
      <label className="block text-sm font-medium">
        {t('Details (optional)')}
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={1000}
          rows={4}
          className="mt-1.5 w-full rounded-xl border border-border bg-surface p-3 text-sm focus:border-cholo-700 focus:outline-none focus:ring-2 focus:ring-cholo-700/20"
        />
      </label>
      <p className="text-xs text-ink-500">{t('In danger right now? Call 999.')}</p>
    </Dialog>
  );
}
