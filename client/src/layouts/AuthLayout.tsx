import { AnimatePresence, motion } from 'motion/react';
import { Link, useLocation, useOutlet } from 'react-router-dom';
import { EASE_OUT } from '../utils/motion';
import { t } from '../i18n';
import { LanguageSwitch } from '../components/layout/LanguageSwitch';

export function AuthLayout() {
  const location = useLocation();
  const element = useOutlet();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface-alt p-4">
      <Link to="/welcome" className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700" aria-label={t('Cholo home')}>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cholo-700 text-base font-black text-white">C</span>
        <span className="text-xl font-bold tracking-tight text-ink-900">Cholo</span>
      </Link>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-lg sm:p-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, transform: 'translateY(8px)' }}
            animate={{ opacity: 1, transform: 'translateY(0px)' }}
            exit={{ opacity: 0, transform: 'translateY(-8px)' }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            {element}
          </motion.div>
        </AnimatePresence>
      </div>
      <LanguageSwitch />
    </div>
  );
}
