import { useSyncExternalStore } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'cholo.theme';
const THEME_COLORS: Record<Theme, string> = { light: '#0E7A5F', dark: '#0A131B' };

const media = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: dark)') : undefined;
const listeners = new Set<() => void>();

const DEFAULT_PREFERENCE: ThemePreference = 'light';

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
  }
  return DEFAULT_PREFERENCE;
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
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
  }
  apply();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useTheme() {
  const current = useSyncExternalStore(subscribe, () => theme);
  const saved = useSyncExternalStore(subscribe, () => preference);
  return { theme: current, preference: saved, setPreference: setThemePreference };
}
