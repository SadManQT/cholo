import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { EASE_OUT } from '../../utils/motion';

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  /** Seconds — stagger siblings entering the same viewport (animate skill: 30-80ms). */
  delay?: number;
}

// animate skill RECIPES.md "scroll reveal": marketing surfaces only, fires
// once (`viewport={{ once: true }}`) — never on functional UI a user visits
// daily, and never re-triggered on every scroll pass past the same section.
export function ScrollReveal({ children, className = '', delay = 0 }: ScrollRevealProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, transform: reduceMotion ? 'none' : 'translateY(24px)' }}
      whileInView={{ opacity: 1, transform: 'translateY(0px)' }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.5, ease: EASE_OUT, delay }}
    >
      {children}
    </motion.div>
  );
}
