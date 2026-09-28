import { useSyncExternalStore } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

// Keep in sync with the inline script in index.html, which applies the theme before first paint.
const STORAGE_KEY = 'cholo.theme';
const THEME_COLORS: Record<Theme, string> = { light: '#0E7A5F', dark: '#0A131B' };

const media = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: dark)') : undefined;
const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Storage blocked (private mode).
  }
  return 'system';
}

let preference = readPreference();
let theme = resolve();

function resolve(): Theme {
  if (preference !== 'system') return preference;
  return media?.matches ? 'dark' : 'light';
}

function apply() {
  theme = resolve();
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  listeners.forEach((listener) => listener());
}

apply();
media?.addEventListener('change', () => { if (preference === 'system') apply(); });

export function setThemePreference(next: ThemePreference) {
  preference = next;
  try {
    if (next === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage blocked: the choice still applies for this visit.
  }
  apply();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The saved preference (system, light or dark) and the theme actually showing. */
export function useTheme() {
  const current = useSyncExternalStore(subscribe, () => theme);
  const saved = useSyncExternalStore(subscribe, () => preference);
  return { theme: current, preference: saved, setPreference: setThemePreference };
}
