import { t } from '../../i18n';
import { useTheme } from '../../theme';
import type { ThemePreference } from '../../theme';
import { MoonIcon, SunIcon } from './icons';

export function ThemeSwitch({ className = '' }: { className?: string }) {
  const { theme, setPreference } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  const label = next === 'dark' ? t('Switch to dark mode') : t('Switch to light mode');
  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-ink-900 hover:border-cholo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700 ${className}`}
    >
      {next === 'dark' ? <MoonIcon className="h-4 w-4" /> : <SunIcon className="h-4 w-4" />}
    </button>
  );
}

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: t('Light') },
  { value: 'dark', label: t('Dark') },
  { value: 'system', label: t('System') },
];

export function ThemePicker() {
  const { preference, setPreference } = useTheme();
  return (
    <div role="radiogroup" aria-label={t('Appearance')} className="mt-3 inline-flex rounded-xl border border-border bg-surface-alt p-1">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={preference === option.value}
          onClick={() => setPreference(option.value)}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700 ${preference === option.value ? 'bg-surface text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
