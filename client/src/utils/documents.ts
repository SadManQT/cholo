import { t } from '../i18n';
import { formatDate } from './format';

const EXPIRING_SOON_DAYS = 30;

export function expiryFlag(expiryDate: string | null) {
  if (!expiryDate) return null;
  const days = Math.ceil((new Date(`${expiryDate}T23:59:59`).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { tone: 'danger' as const, text: t('Expired {0}', formatDate(expiryDate)) };
  if (days <= EXPIRING_SOON_DAYS) return { tone: 'warn' as const, text: t(days === 1 ? 'Expires in {0} day' : 'Expires in {0} days', days) };
  return { tone: 'muted' as const, text: t('Valid until {0}', formatDate(expiryDate)) };
}
