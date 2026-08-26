import { animate } from 'motion';
import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { AnimationPlaybackControls } from 'motion';
import type { PointerEvent, ReactNode } from 'react';

// doc 11-12 §2.4: "BottomSheet | snap points: peek / half / full · drag
// handle | booking flow, trip actions, confirmations." §1: "the map is the
// canvas; the sheet is the conversation" — never bury the map under chrome,
// which is why only the fullest snap point gets a backdrop.
export type SnapPoint = 'peek' | 'half' | 'full';

const SNAP_FRACTIONS: Record<SnapPoint, number> = {
  peek: 0.22,
  half: 0.55,
  full: 0.9,
};
const SNAP_ORDER: SnapPoint[] = ['peek', 'half', 'full'];
const DISMISS_DRAG_PX = 80; // dragging this far below "peek" closes the sheet
const FLICK_VELOCITY_PX_S = 500; // above this, honor the flick's direction over nearest-distance
// animate skill §5 drawer curve, as cubic-bezier control points for Motion's
// spring-less tween. 350ms rather than the recipe's 500ms — sheets like the
// driver Offer Sheet are a 15-second decision; a slower entrance eats into it.
const DRAWER_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];
const ENTRANCE_DURATION_S = 0.35;

// iOS-style rubber band: resistance rises the further a drag pushes past a
// natural edge (animate skill "drag to dismiss" recipe — friction, not a
// wall past the sheet's fully-open or fully-closed height).
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
    return SNAP_FRACTIONS[point] * window.innerHeight;
  }

  // Entrance: slide up from 0 on every mount (a fresh dialog-like sheet —
  // OfferSheet, ConfirmSheet, ChatSheet — mounts each time it opens; the
  // always-open sheets on BookRidePage/DriverActiveTripPage play this once
  // on page load). animate skill "drawer" recipe: a fixed ease, not a spring
  // — this isn't a gesture, so there's no velocity to carry through.
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
      ease: DRAWER_EASE,
      onUpdate: setHeightPx,
    });
    return () => controls.current?.stop();
    // Intentionally [open] only — this is the mount transition, not a
    // reaction to snapPoint changes (handled below) or dragging.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // A snapPoint change from *outside* a drag (e.g. BookRidePage moving the
  // sheet to 'half' once fares load) — spring to the new height so it reads
  // as the same continuous motion as a manual drag would.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const delta = dragStart.current.y - event.clientY; // dragging up = positive
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
        style={{ height: `${heightPx}px` }}
        className={`fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-surface shadow-lg ${className}`}
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
