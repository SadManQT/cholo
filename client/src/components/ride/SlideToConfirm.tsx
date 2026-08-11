import { useState } from 'react';

interface SlideToConfirmProps {
  label: string;
  loading?: boolean;
  onConfirm: () => void;
}

export function SlideToConfirm({ label, loading = false, onConfirm }: SlideToConfirmProps) {
  const [value, setValue] = useState(0);

  function finish() {
    if (value >= 92 && !loading) onConfirm();
    setValue(0);
  }

  return (
    <div className="relative h-14 overflow-hidden rounded-2xl bg-cholo-700 shadow-lg">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-16 text-center font-bold text-white">
        {loading ? 'Working…' : `Slide to ${label}`}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 bg-cholo-800" style={{ width: `${Math.max(14, value)}%` }} />
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        disabled={loading}
        onChange={(event) => setValue(Number(event.target.value))}
        onPointerUp={finish}
        onKeyUp={(event) => {
          if (event.key === 'Enter' || event.key === ' ') finish();
        }}
        aria-label={`Slide to ${label}`}
        className="absolute inset-0 z-10 h-full w-full cursor-ew-resize opacity-0 disabled:cursor-not-allowed"
      />
      <div
        className="pointer-events-none absolute left-1 top-1 flex h-12 w-12 items-center justify-center rounded-xl bg-surface text-xl font-bold text-cholo-700 transition-transform"
        style={{ left: `calc(${value}% - ${value * 0.56}px + 4px)` }}
        aria-hidden="true"
      >
        →
      </div>
    </div>
  );
}
