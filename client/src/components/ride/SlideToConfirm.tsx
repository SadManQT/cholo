import { animate } from 'motion';
import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { AnimationPlaybackControls } from 'motion';
import type { KeyboardEvent, PointerEvent } from 'react';
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
/** How far along the track (0–1) the thumb must be released to confirm. */
const CONFIRM_AT = 0.9;

/**
 * Drag the thumb to the end to confirm. Only a drag that starts on the thumb counts, so a stray tap on the
 * track can't confirm; releasing early, or the browser taking the touch over (pointercancel), springs back.
 * Keyboard users focus the thumb and press Enter or Space.
 */
export function SlideToConfirm({ label, loading = false, lockedReason = null, onConfirm }: SlideToConfirmProps) {
  const [offset, setOffset] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const reduceMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const springRef = useRef<AnimationPlaybackControls | null>(null);
  const drag = useRef<{ pointerId: number; startX: number; startOffset: number } | null>(null);
  const offsetRef = useRef(0);
  const disabled = loading || Boolean(lockedReason);
  const travel = Math.max(0, trackWidth - THUMB_SIZE_PX - THUMB_MARGIN_PX * 2);

  function move(next: number) {
    offsetRef.current = next;
    setOffset(next);
  }

  function stopSpring() {
    springRef.current?.stop();
    springRef.current = null;
  }

  function springBack() {
    stopSpring();
    if (reduceMotion || offsetRef.current === 0) {
      move(0);
      return;
    }
    springRef.current = animate(offsetRef.current, 0, { type: 'spring', stiffness: 500, damping: 32, onUpdate: move });
  }

  useEffect(() => () => springRef.current?.stop(), []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => setTrackWidth(entries[0].contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Locked or busy mid-drag (the driver moved out of range, a request started): let go.
  useEffect(() => {
    if (!disabled) return;
    drag.current = null;
    springBack();
    // springBack only reads refs and stable values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (disabled || drag.current || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    stopSpring();
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startOffset: offsetRef.current };
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    move(Math.min(travel, Math.max(0, active.startOffset + event.clientX - active.startX)));
  }

  function release(event: PointerEvent<HTMLButtonElement>, commit: boolean) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    drag.current = null;
    if (commit && !disabled && travel > 0 && offsetRef.current >= travel * CONFIRM_AT) onConfirm();
    springBack();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    // Also stops the button's own click on Space, which must never confirm (a tap is not a slide).
    event.preventDefault();
    if (!disabled && !event.repeat) onConfirm();
  }

  const progress = travel > 0 ? offset / travel : 0;
  const text = loading ? t('Working…') : lockedReason ?? t('Slide to {0}', label);

  return (
    <div
      ref={trackRef}
      className={`relative h-14 select-none overflow-hidden rounded-2xl ${lockedReason ? 'bg-ink-500/20' : 'bg-cholo-700 shadow-lg'}`}
    >
      {!lockedReason && (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 bg-cholo-800"
          style={{ width: offset + THUMB_SIZE_PX + THUMB_MARGIN_PX * 2 }}
        />
      )}
      <div
        className={`pointer-events-none absolute inset-0 flex items-center justify-center pl-16 pr-4 text-center font-bold ${lockedReason ? 'text-ink-900' : 'text-white'}`}
        style={{ opacity: loading || lockedReason ? 1 : Math.max(0, 1 - progress * 1.4) }}
        aria-hidden="true"
      >
        {text}
      </div>
      <button
        type="button"
        disabled={disabled}
        aria-label={text}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => release(event, true)}
        onPointerCancel={(event) => release(event, false)}
        onLostPointerCapture={(event) => release(event, false)}
        onKeyDown={onKeyDown}
        className={`absolute left-1 top-1 flex h-12 w-12 touch-none items-center justify-center rounded-xl bg-surface text-xl font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-cholo-700 ${disabled ? 'cursor-not-allowed text-ink-500' : 'cursor-grab text-cholo-700 active:cursor-grabbing'}`}
        style={{ transform: `translateX(${offset}px)` }}
      >
        <span aria-hidden="true">{loading ? '…' : '→'}</span>
      </button>
    </div>
  );
}
