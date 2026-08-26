import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useSyncExternalStore } from 'react';
import { dismissToast, getToastSnapshot, subscribeToToasts } from './toastStore';
import type { ToastItem, ToastVariant } from './toastStore';

// doc 11-12 §2.4: "Toast | success / error / info, auto-dismiss | after
// every mutation." doc 11 §11 is explicit that Cholo needs "exactly these
// two" contexts (AuthContext, SocketContext) — so this is deliberately NOT
// a third React Context. It's a tiny external store (the same shape
// `toast()` libraries like Sonner use internally): a module-level queue any
// file can push to via plain function calls, subscribed to by one
// `<Toaster />` mounted once near the app root.
const VARIANT_CONFIG: Record<ToastVariant, { classes: string; icon: string }> = {
  success: { classes: 'border-cholo-700/30 text-cholo-700', icon: '✓' },
  error: { classes: 'border-danger-600/30 text-danger-600', icon: '!' },
  info: { classes: 'border-info-600/30 text-info-600', icon: 'i' },
};

// Enter/exit only (feedback + state-indication, doc 12 §2.4) — a toast is
// dismissed both by the auto-timeout and the ✕ button, and both go through
// the same dismissToast() call, so AnimatePresence's exit fires either way.
// Slide+fade, symmetric (exits the way it entered), reduced-motion keeps the
// fade and drops the slide only — animate skill §7.
function ToastRow({ item }: { item: ToastItem }) {
  const config = VARIANT_CONFIG[item.variant];
  const reduceMotion = useReducedMotion();
  const offscreen = { opacity: 0, transform: reduceMotion ? 'none' : 'translateY(16px)' };

  return (
    <motion.div
      layout
      initial={offscreen}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      exit={offscreen}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      role="status"
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-surface p-3.5 shadow-lg ${config.classes}`}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-current/10 text-xs font-bold" aria-hidden="true">
        {config.icon}
      </span>
      <p className="flex-1 text-sm text-ink-900">{item.message}</p>
      <button
        type="button"
        onClick={() => dismissToast(item.id)}
        aria-label="Dismiss"
        className="text-ink-500 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700 rounded"
      >
        ✕
      </button>
    </motion.div>
  );
}

// Mount once near the app root (App.tsx) — every `toast.success(...)` call
// anywhere in the app renders through this single queue.
export function Toaster() {
  const items = useSyncExternalStore(subscribeToToasts, getToastSnapshot);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:left-auto sm:right-4 sm:items-end">
      <AnimatePresence>
        {items.map((item) => (
          <ToastRow key={item.id} item={item} />
        ))}
      </AnimatePresence>
    </div>
  );
}
