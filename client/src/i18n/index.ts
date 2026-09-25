import { bn } from './bn';

export type Language = 'en' | 'bn';

const STORAGE_KEY = 'cholo.lang';

// Read once at startup. Changing language reloads the page, so module-level labels (filter lists,
// menus) are built in the right language and nothing needs to re-render mid-session.
/** The language this browser explicitly chose, if any (null until someone picks one). */
export function storedLanguage(): Language | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'bn' || stored === 'en') return stored;
  } catch {
    // Storage blocked (private mode).
  }
  return null;
}

export const language: Language = storedLanguage() ?? 'en';

/** Locale for Intl number/date formatting: Bangla digits and month names when Bangla is on. */
export const locale = language === 'bn' ? 'bn-BD' : 'en-BD';

if (typeof document !== 'undefined') document.documentElement.lang = language;

/**
 * Translates an English interface string. The English text is the key, so a missing Bangla entry
 * falls back to English instead of showing a key. `{0}`, `{1}`… are filled from `values`.
 */
export function t(text: string, ...values: Array<string | number | null | undefined>): string {
  const template = language === 'bn' ? (bn[text] ?? text) : text;
  return values.length === 0 ? template : template.replace(/\{(\d+)\}/g, (_, index: string) => String(values[Number(index)] ?? ''));
}

export function setLanguage(next: Language) {
  if (next === language) return;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    return;
  }
  window.location.reload();
}
