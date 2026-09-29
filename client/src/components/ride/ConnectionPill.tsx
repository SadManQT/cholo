import { AnimatePresence, motion } from 'motion/react';
import type { SocketConnectionState } from '../../context/socket';
import { EASE_OUT } from '../../utils/motion';
import { t } from '../../i18n';

export function ConnectionPill({ state }: { state: SocketConnectionState }) {
  return (
    <AnimatePresence>
      {state !== 'connected' && (
        <motion.div
          initial={{ opacity: 0, transform: 'translateX(-50%) translateY(-8px)' }}
          animate={{ opacity: 1, transform: 'translateX(-50%) translateY(0px)' }}
          exit={{ opacity: 0, transform: 'translateX(-50%) translateY(-8px)' }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          className="fixed left-1/2 top-[calc(var(--app-header,0px)+0.75rem)] z-[1000] rounded-full bg-ink-900 px-3 py-1.5 text-xs font-medium text-surface shadow-lg"
        >
          {state === 'disconnected' ? t('Live updates offline') : t('Reconnecting live updates…')}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
