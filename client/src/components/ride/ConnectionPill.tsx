import { AnimatePresence, motion } from 'motion/react';
import type { SocketConnectionState } from '../../context/socket';
import { EASE_OUT } from '../../utils/motion';

export function ConnectionPill({ state }: { state: SocketConnectionState }) {
  return (
    <AnimatePresence>
      {state !== 'connected' && (
        <motion.div
          initial={{ opacity: 0, transform: 'translateX(-50%) translateY(-8px)' }}
          animate={{ opacity: 1, transform: 'translateX(-50%) translateY(0px)' }}
          exit={{ opacity: 0, transform: 'translateX(-50%) translateY(-8px)' }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          className="fixed left-1/2 top-3 z-[1000] rounded-full bg-ink-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg"
        >
          {state === 'disconnected' ? 'Live updates offline' : 'Reconnecting live updates…'}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
