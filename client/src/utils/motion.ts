// The project's three motion curves — see tailwind.config.js's
// `ease-cholo-*` classes and index.css's `--ease-*` custom properties for
// the CSS-side copies. This is the one place they're typed in JS; every
// `motion/react` or WAAPI call site imports from here instead of
// retyping the same four numbers (animate skill §7: "curves should live
// as shared tokens").
export const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
export const EASE_IN_OUT: [number, number, number, number] = [0.77, 0, 0.175, 1];
export const EASE_DRAWER: [number, number, number, number] = [0.32, 0.72, 0, 1];

function toCssCubicBezier(curve: [number, number, number, number]): string {
  return `cubic-bezier(${curve.join(', ')})`;
}

// String form for WAAPI's `element.animate()`, which takes an easing
// string rather than a numeric tuple.
export const EASE_OUT_CSS = toCssCubicBezier(EASE_OUT);
export const EASE_IN_OUT_CSS = toCssCubicBezier(EASE_IN_OUT);
export const EASE_DRAWER_CSS = toCssCubicBezier(EASE_DRAWER);
