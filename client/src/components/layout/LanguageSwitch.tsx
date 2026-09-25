import { language, setLanguage } from '../../i18n';

/** English ⇄ বাংলা. Signed-in users change it in Account; this is for the welcome and sign-in screens. */
export function LanguageSwitch({ className = '' }: { className?: string }) {
  const next = language === 'bn' ? 'en' : 'bn';
  return (
    <button
      type="button"
      lang={next}
      onClick={() => setLanguage(next)}
      className={`rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-ink-900 hover:border-cholo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700 ${className}`}
    >
      {next === 'bn' ? 'বাংলা' : 'English'}
    </button>
  );
}
