import { animate } from 'motion';
import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { AnimationPlaybackControls } from 'motion';

interface SlideToConfirmProps {
  label: string;
  loading?: boolean;
  onConfirm: () => void;
}

const THUMB_SIZE_PX = 48; // h-12/w-12
const THUMB_MARGIN_PX = 4; // left-1/top-1, and the matching gap on the right

// animate skill "drag to dismiss" recipe: settle an interrupted gesture with
// a spring, not an instant snap — releasing below the threshold used to
// teleport the thumb back to 0. A confirmed slide (>=92%) still resets
// instantly on purpose: `mutating` disables the input right away and the
// parent remounts this component (key={trip.status}) once the real status
// change lands, so there's nothing to spring toward.
export function SlideToConfirm({ label, loading = false, onConfirm }: SlideToConfirmProps) {
  const [value, setValue] = useState(0);
  const reduceMotion = useReducedMotion();
  const springRef = useRef<AnimationPlaybackControls | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => () => springRef.current?.stop(), []);

  // The thumb's travel distance is a fraction of the *track's* pixel width,
  // not the thumb's own — a translateX(%) resolves against the element's
  // own box (animate skill: "percentages in translate() are relative to the
  // element's own size"), so unlike the fill bar below, this needs a real
  // measurement rather than a plain percentage.
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
    <div ref={trackRef} className="relative h-14 overflow-hidden rounded-2xl bg-cholo-700 shadow-lg">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-16 text-center font-bold text-white">
        {loading ? 'Working…' : `Slide to ${label}`}
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
        disabled={loading}
        onChange={(event) => {
          stopSpring();
          setValue(Number(event.target.value));
        }}
        onPointerUp={finish}
        onKeyUp={(event) => {
          if (event.key === 'Enter' || event.key === ' ') finish();
        }}
        aria-label={`Slide to ${label}`}
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
