import { bn } from './bn';

export type Language = 'en' | 'bn';

const STORAGE_KEY = 'cholo.lang';

export function storedLanguage(): Language | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'bn' || stored === 'en') return stored;
  } catch {
  }
  return null;
}

export const language: Language = storedLanguage() ?? 'en';

export const locale = language === 'bn' ? 'bn-BD' : 'en-BD';

if (typeof document !== 'undefined') document.documentElement.lang = language;

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
