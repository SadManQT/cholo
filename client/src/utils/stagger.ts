import type { CSSProperties } from 'react';

const STAGGER_STEP_MS = 40;
const STAGGER_MAX_INDEX = 6;

export function staggerStyle(index: number): CSSProperties {
  return { animationDelay: `${Math.min(index, STAGGER_MAX_INDEX) * STAGGER_STEP_MS}ms` };
}

export function staggerDelaySeconds(index: number): number {
  return (Math.min(index, STAGGER_MAX_INDEX) * STAGGER_STEP_MS) / 1000;
}
