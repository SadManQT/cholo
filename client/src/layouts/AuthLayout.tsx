import { AnimatePresence, motion } from 'motion/react';
import { useLocation, useOutlet } from 'react-router-dom';

// doc 12 §4: guest/auth screens — "full-screen, phone-first; desktop shows
// centered card", "single column, one screen, no scroll."
export function AuthLayout() {
  const location = useLocation();
  // useOutlet() (not <Outlet/>) matters here: AnimatePresence keeps the
  // *exiting* motion.div mounted a beat longer, but a literal <Outlet/>
  // inside it would re-resolve against the router's already-current route
  // and silently show the new page during what's supposed to be the old
  // page's exit. useOutlet() captures this render's matched element as a
  // fixed value instead, so the exiting copy stays the old page.
  const element = useOutlet();

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-alt p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-lg sm:p-8">
        {/* Register -> OTP -> Login is a step progression across routes, not
            state within one component — the crossfade lives here, once, so
            every step of the funnel gets it for free (animate skill:
            "preventing a jarring change"). */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, transform: 'translateY(8px)' }}
            animate={{ opacity: 1, transform: 'translateY(0px)' }}
            exit={{ opacity: 0, transform: 'translateY(-8px)' }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          >
            {element}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
