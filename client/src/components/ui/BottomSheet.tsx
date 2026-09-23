import { animate } from 'motion';
import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { AnimationPlaybackControls } from 'motion';
import type { PointerEvent, ReactNode } from 'react';
import { EASE_DRAWER } from '../../utils/motion';

export type SnapPoint = 'peek' | 'half' | 'full';

const SNAP_FRACTIONS: Record<SnapPoint, number> = {
  peek: 0.22,
  half: 0.55,
  full: 0.9,
};
const SNAP_ORDER: SnapPoint[] = ['peek', 'half', 'full'];
const DISMISS_DRAG_PX = 80;
const FLICK_VELOCITY_PX_S = 500;
const ENTRANCE_DURATION_S = 0.35;
// Every sheet renders inside a layout with the fixed h-16 BottomTabs bar; the sheet sits above it.
const TAB_BAR_PX = 64;

function rubberBand(overshoot: number, dimension = 220, factor = 0.55) {
  return (overshoot * dimension * factor) / (dimension + factor * overshoot);
}

interface BottomSheetProps {
  open: boolean;
  snapPoint: SnapPoint;
  onSnapPointChange: (point: SnapPoint) => void;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
}

export function BottomSheet({ open, snapPoint, onSnapPointChange, onClose, children, className = '' }: BottomSheetProps) {
  const reduceMotion = useReducedMotion();
  const [heightPx, setHeightPx] = useState(0);
  const controls = useRef<AnimationPlaybackControls | null>(null);
  const dragStart = useRef<{ y: number; heightPx: number } | null>(null);
  const moveHistory = useRef<{ t: number; heightPx: number }[]>([]);
  const isDragging = useRef(false);
  const justDragReleased = useRef(false);
  const didMountSnap = useRef(false);

  function heightPxFor(point: SnapPoint) {
    return SNAP_FRACTIONS[point] * (window.innerHeight - TAB_BAR_PX);
  }

  useEffect(() => {
    if (!open) return;
    const target = heightPxFor(snapPoint);
    if (reduceMotion) {
      setHeightPx(target);
      return;
    }
    setHeightPx(0);
    controls.current?.stop();
    controls.current = animate(0, target, {
      duration: ENTRANCE_DURATION_S,
      ease: EASE_DRAWER,
      onUpdate: setHeightPx,
    });
    return () => controls.current?.stop();
  }, [open]);

  useEffect(() => {
    if (!didMountSnap.current) {
      didMountSnap.current = true;
      return;
    }
    if (justDragReleased.current) {
      justDragReleased.current = false;
      return;
    }
    if (!open || isDragging.current) return;
    const target = heightPxFor(snapPoint);
    if (reduceMotion) {
      setHeightPx(target);
      return;
    }
    controls.current?.stop();
    controls.current = animate(heightPx, target, {
      type: 'spring',
      duration: 0.5,
      bounce: 0.15,
      onUpdate: setHeightPx,
    });
    return () => controls.current?.stop();
  }, [snapPoint]);

  useEffect(() => () => controls.current?.stop(), []);

  if (!open) return null;

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    controls.current?.stop();
    isDragging.current = true;
    dragStart.current = { y: event.clientY, heightPx };
    moveHistory.current = [{ t: performance.now(), heightPx }];
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return;
    const delta = dragStart.current.y - event.clientY;
    const raw = dragStart.current.heightPx + delta;
    const maxPx = heightPxFor('full');
    const damped = raw < 0 ? -rubberBand(-raw) : raw > maxPx ? maxPx + rubberBand(raw - maxPx) : raw;
    setHeightPx(damped);

    const now = performance.now();
    moveHistory.current.push({ t: now, heightPx: raw });
    while (moveHistory.current.length > 2 && now - moveHistory.current[0].t > 100) moveHistory.current.shift();
  }

  function handlePointerUp() {
    if (!dragStart.current) return;
    const first = moveHistory.current[0];
    const last = moveHistory.current[moveHistory.current.length - 1] ?? first;
    const rawFinal = last.heightPx;
    const velocityPxPerSec = last.t !== first.t ? ((last.heightPx - first.heightPx) / (last.t - first.t)) * 1000 : 0;

    dragStart.current = null;
    isDragging.current = false;
    moveHistory.current = [];

    const peekPx = heightPxFor('peek');
    const flicked = Math.abs(velocityPxPerSec) > FLICK_VELOCITY_PX_S;
    const shouldDismiss = onClose && (rawFinal < peekPx - DISMISS_DRAG_PX || (flicked && velocityPxPerSec < 0 && rawFinal < peekPx));

    if (shouldDismiss) {
      if (reduceMotion) {
        onClose!();
        return;
      }
      controls.current = animate(heightPx, 0, {
        type: 'spring',
        velocity: velocityPxPerSec,
        duration: 0.4,
        bounce: 0.1,
        onUpdate: setHeightPx,
        onComplete: onClose,
      });
      return;
    }

    let target: SnapPoint;
    if (flicked) {
      const currentIndex = SNAP_ORDER.indexOf(snapPoint);
      target = velocityPxPerSec > 0
        ? SNAP_ORDER[Math.min(SNAP_ORDER.length - 1, currentIndex + 1)]
        : SNAP_ORDER[Math.max(0, currentIndex - 1)];
    } else {
      target = SNAP_ORDER.reduce((best, point) =>
        Math.abs(heightPxFor(point) - rawFinal) < Math.abs(heightPxFor(best) - rawFinal) ? point : best,
      );
    }

    const targetPx = heightPxFor(target);
    if (reduceMotion) {
      setHeightPx(targetPx);
    } else {
      controls.current = animate(heightPx, targetPx, {
        type: 'spring',
        velocity: velocityPxPerSec,
        duration: 0.5,
        bounce: 0.15,
        onUpdate: setHeightPx,
      });
    }
    justDragReleased.current = true;
    onSnapPointChange(target);
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-ink-900/40 transition-opacity duration-200 ease-cholo-out ${
          snapPoint === 'full' ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => onClose?.()}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal={snapPoint === 'full'}
        // Size the box itself (not a translate) so content below the fold is never pushed off-screen.
        style={{ height: `${Math.max(heightPx, 0)}px` }}
        className={`fixed inset-x-0 bottom-16 z-50 flex flex-col rounded-t-2xl bg-surface shadow-lg lg:!transform-none ${className}`}
      >
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="flex shrink-0 cursor-grab touch-none items-center justify-center py-2.5 active:cursor-grabbing"
        >
          <span className="h-1.5 w-10 rounded-full bg-ink-500/30" aria-hidden="true" />
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">{children}</div>
      </div>
    </>
  );
}
