import { animate } from 'motion';
import { useReducedMotion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AnimationPlaybackControls } from 'motion';
import type { KeyboardEvent, PointerEvent } from 'react';
import { t } from '../../i18n';

interface SlideToConfirmProps {
  label: string;
  loading?: boolean;
  lockedReason?: string | null;
  onConfirm: () => void;
}

const THUMB_SIZE_PX = 48;
const THUMB_MARGIN_PX = 4;
const CONFIRM_AT = 0.85;

/**
 * Drag to the end to confirm. The drag can start anywhere on the track and moves the thumb by how far the
 * finger travels (it never jumps to the finger), so a tap can't confirm. Releasing early, or the browser
 * taking the touch over (pointercancel), springs back. Keyboard users focus the thumb and press Enter/Space.
 *
 * The thumb, fill and label are moved by writing transforms straight to the DOM once per frame, not through
 * React state, so dragging stays smooth even while the trip page re-renders for GPS and socket updates.
 */
export function SlideToConfirm({ label, loading = false, lockedReason = null, onConfirm }: SlideToConfirmProps) {
  const reduceMotion = useReducedMotion();
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLButtonElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const springRef = useRef<AnimationPlaybackControls | null>(null);
  const frameRef = useRef(0);
  const drag = useRef<{ pointerId: number; startX: number; startOffset: number } | null>(null);
  const offsetRef = useRef(0);
  const pendingRef = useRef(0);
  const widthRef = useRef(0);
  const disabled = loading || Boolean(lockedReason);

  const travel = () => Math.max(0, widthRef.current - THUMB_SIZE_PX - THUMB_MARGIN_PX * 2);

  function paint(offset: number) {
    offsetRef.current = offset;
    const span = travel();
    if (thumbRef.current) thumbRef.current.style.transform = `translate3d(${offset}px, 0, 0)`;
    if (fillRef.current) {
      fillRef.current.style.transform = `translate3d(${offset + THUMB_SIZE_PX + THUMB_MARGIN_PX * 2 - widthRef.current}px, 0, 0)`;
    }
    if (labelRef.current) labelRef.current.style.opacity = String(span > 0 ? Math.max(0, 1 - (offset / span) * 1.4) : 1);
  }

  function stopSpring() {
    springRef.current?.stop();
    springRef.current = null;
  }

  function springBack() {
    stopSpring();
    cancelAnimationFrame(frameRef.current);
    if (reduceMotion || offsetRef.current === 0) {
      paint(0);
      return;
    }
    springRef.current = animate(offsetRef.current, 0, { type: 'spring', stiffness: 520, damping: 34, onUpdate: paint });
  }

  useEffect(() => () => {
    springRef.current?.stop();
    cancelAnimationFrame(frameRef.current);
  }, []);

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = (width: number) => {
      widthRef.current = width;
      paint(Math.min(offsetRef.current, travel()));
    };
    measure(el.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => measure(entries[0].contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!disabled) return;
    drag.current = null;
    setDragging(false);
    springBack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled || drag.current || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    stopSpring();
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startOffset: offsetRef.current };
    setDragging(true);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    pendingRef.current = Math.min(travel(), Math.max(0, active.startOffset + event.clientX - active.startX));
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      if (drag.current) paint(pendingRef.current);
    });
  }

  function release(event: PointerEvent<HTMLDivElement>, commit: boolean) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    const offset = Math.min(travel(), Math.max(0, active.startOffset + event.clientX - active.startX));
    paint(commit ? offset : offsetRef.current);
    if (commit && !disabled && travel() > 0 && offset >= travel() * CONFIRM_AT) {
      paint(travel());
      onConfirm();
    }
    springBack();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (!disabled && !event.repeat) onConfirm();
  }

  const text = loading ? t('Working…') : lockedReason ?? t('Slide to {0}', label);

  return (
    <div
      ref={trackRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => release(event, true)}
      onPointerCancel={(event) => release(event, false)}
      onLostPointerCapture={(event) => release(event, false)}
      className={`relative h-14 touch-none select-none overflow-hidden rounded-2xl ${lockedReason ? 'bg-ink-500/20' : 'bg-cholo-700 shadow-lg'} ${disabled ? 'cursor-not-allowed' : dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
    >
      {!lockedReason && (
        <div
          ref={fillRef}
          className="pointer-events-none absolute inset-0 bg-cholo-800 will-change-transform"
          style={{ transform: `translate3d(${THUMB_SIZE_PX + THUMB_MARGIN_PX * 2}px, 0, 0) translateX(-100%)` }}
        />
      )}
      <div
        ref={labelRef}
        className={`pointer-events-none absolute inset-0 flex items-center justify-center pl-16 pr-4 text-center font-bold ${lockedReason ? 'text-ink-900' : 'text-white'}`}
        aria-hidden="true"
      >
        {text}
      </div>
      <button
        ref={thumbRef}
        type="button"
        disabled={disabled}
        aria-label={text}
        onKeyDown={onKeyDown}
        className={`pointer-events-none absolute left-1 top-1 flex h-12 w-12 items-center justify-center rounded-xl bg-surface text-xl font-bold will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-cholo-700 ${dragging ? 'shadow-md' : ''} ${disabled ? 'text-ink-500' : 'text-cholo-700'}`}
      >
        <span aria-hidden="true">{loading ? '…' : '→'}</span>
      </button>
    </div>
  );
}
