import type { CSSProperties } from 'react';

// Pairs with the .animate-stagger-in keyframe in index.css (animate skill
// RECIPES.md "stagger a group entrance"). Capped so a long paginated list
// doesn't give row 50 an absurd artificial delay — only the first page's
// worth of rows actually stagger; the rest just fade in together.
const STAGGER_STEP_MS = 40;
const STAGGER_MAX_INDEX = 6;

export function staggerStyle(index: number): CSSProperties {
  return { animationDelay: `${Math.min(index, STAGGER_MAX_INDEX) * STAGGER_STEP_MS}ms` };
}
