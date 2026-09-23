export const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
export const EASE_IN_OUT: [number, number, number, number] = [0.77, 0, 0.175, 1];
export const EASE_DRAWER: [number, number, number, number] = [0.32, 0.72, 0, 1];

function toCssCubicBezier(curve: [number, number, number, number]): string {
  return `cubic-bezier(${curve.join(', ')})`;
}

export const EASE_OUT_CSS = toCssCubicBezier(EASE_OUT);
export const EASE_IN_OUT_CSS = toCssCubicBezier(EASE_IN_OUT);
export const EASE_DRAWER_CSS = toCssCubicBezier(EASE_DRAWER);
