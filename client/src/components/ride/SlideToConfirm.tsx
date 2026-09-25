import { animate } from 'motion';
import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { AnimationPlaybackControls } from 'motion';
import { t } from '../../i18n';

interface SlideToConfirmProps {
  label: string;
  loading?: boolean;
  /** Locks the slider and shows this text instead of the label (e.g. "450 m to the pickup"). */
  lockedReason?: string | null;
  onConfirm: () => void;
}

const THUMB_SIZE_PX = 48;
const THUMB_MARGIN_PX = 4;

export function SlideToConfirm({ label, loading = false, lockedReason = null, onConfirm }: SlideToConfirmProps) {
  const [value, setValue] = useState(0);
  const reduceMotion = useReducedMotion();
  const springRef = useRef<AnimationPlaybackControls | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => () => springRef.current?.stop(), []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => setTrackWidth(entries[0].contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function stopSpring() {
    springRef.current?.stop();
    springRef.current = null;
  }

  function finish() {
    if (value >= 92 && !loading) {
      onConfirm();
      setValue(0);
      return;
    }
    if (reduceMotion) {
      setValue(0);
      return;
    }
    springRef.current = animate(value, 0, {
      type: 'spring',
      stiffness: 500,
      damping: 32,
      onUpdate: setValue,
    });
  }

  const thumbTravelPx = Math.max(0, trackWidth - THUMB_SIZE_PX - THUMB_MARGIN_PX * 2);

  return (
    <div ref={trackRef} className={`relative h-14 overflow-hidden rounded-2xl shadow-lg ${lockedReason ? 'bg-ink-500' : 'bg-cholo-700'}`}>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-16 text-center font-bold text-white">
        {loading ? t('Working…') : lockedReason ?? t('Slide to {0}', label)}
      </div>
      <div
        className="pointer-events-none absolute inset-0 origin-left bg-cholo-800"
        style={{ transform: `scaleX(${Math.max(14, value) / 100})` }}
      />
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        disabled={loading || Boolean(lockedReason)}
        onChange={(event) => {
          stopSpring();
          setValue(Number(event.target.value));
        }}
        onPointerUp={finish}
        onKeyDown={(event) => {
          // The slide guards against accidental taps; a deliberate Enter/Space from a keyboard confirms directly.
          if ((event.key === 'Enter' || event.key === ' ') && !loading && !lockedReason) {
            event.preventDefault();
            stopSpring();
            onConfirm();
            setValue(0);
          }
        }}
        aria-label={t('Slide to {0}', label)}
        className="absolute inset-0 z-10 h-full w-full cursor-ew-resize opacity-0 disabled:cursor-not-allowed"
      />
      <div
        className="pointer-events-none absolute left-1 top-1 flex h-12 w-12 items-center justify-center rounded-xl bg-surface text-xl font-bold text-cholo-700"
        style={{ transform: `translateX(${(value / 100) * thumbTravelPx}px)` }}
        aria-hidden="true"
      >
        →
      </div>
    </div>
  );
}
