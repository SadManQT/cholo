import { useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Chrome fires beforeinstallprompt once, often before any account screen mounts, so capture it at startup
// (main.tsx imports this module) and let components subscribe.
let deferred: BeforeInstallPromptEvent | null = null;
let installed = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    notify();
  });
}

let snapshot = { canInstall: false, installed };
function getSnapshot() {
  if (snapshot.canInstall !== Boolean(deferred) || snapshot.installed !== installed) {
    snapshot = { canInstall: Boolean(deferred), installed };
  }
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInstallPrompt() {
  const state = useSyncExternalStore(subscribe, getSnapshot);
  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    notify();
  }
  return { ...state, install };
}
