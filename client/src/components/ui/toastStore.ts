export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
}

const AUTO_DISMISS_MS = 4000;

let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) listener();
}

export function subscribeToToasts(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToastSnapshot() {
  return toasts;
}

export function dismissToast(id: number) {
  toasts = toasts.filter((item) => item.id !== id);
  emitChange();
}

function push(variant: ToastVariant, message: string) {
  const id = nextId++;
  toasts = [...toasts, { id, variant, message }];
  emitChange();
  setTimeout(() => dismissToast(id), AUTO_DISMISS_MS);
}

export const toast = {
  success: (message: string) => push('success', message),
  error: (message: string) => push('error', message),
  info: (message: string) => push('info', message),
};
