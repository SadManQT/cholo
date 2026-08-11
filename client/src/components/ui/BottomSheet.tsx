import { useRef, useState } from 'react';
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

interface BottomSheetProps {
  open: boolean;
  snapPoint: SnapPoint;
  onSnapPointChange: (point: SnapPoint) => void;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
}

export function BottomSheet({ open, snapPoint, onSnapPointChange, onClose, children, className = '' }: BottomSheetProps) {
  const [dragHeightPx, setDragHeightPx] = useState<number | null>(null);
  const dragStart = useRef<{ y: number; heightPx: number } | null>(null);

  if (!open) return null;

  function heightPxFor(point: SnapPoint) {
    return SNAP_FRACTIONS[point] * window.innerHeight;
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { y: event.clientY, heightPx: heightPxFor(snapPoint) };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return;
    const delta = dragStart.current.y - event.clientY; // dragging up = positive
    setDragHeightPx(Math.max(0, dragStart.current.heightPx + delta));
  }

  function handlePointerUp() {
    if (dragHeightPx === null) {
      dragStart.current = null;
      return;
    }

    const peekPx = heightPxFor('peek');
    if (dragHeightPx < peekPx - DISMISS_DRAG_PX && onClose) {
      onClose();
    } else {
      // Snap to whichever point's height is closest to where the drag ended.
      const nearest = SNAP_ORDER.reduce((best, point) =>
        Math.abs(heightPxFor(point) - dragHeightPx) < Math.abs(heightPxFor(best) - dragHeightPx) ? point : best,
      );
      onSnapPointChange(nearest);
    }

    dragStart.current = null;
    setDragHeightPx(null);
  }

  const isDragging = dragHeightPx !== null;

  return (
    <>
      {snapPoint === 'full' && (
        <div
          className="fixed inset-0 z-40 bg-ink-900/40"
          onClick={() => onClose?.()}
          aria-hidden="true"
        />
      )}
      <div
        role="dialog"
        aria-modal={snapPoint === 'full'}
        style={{
          height: isDragging ? `${dragHeightPx}px` : `${SNAP_FRACTIONS[snapPoint] * 100}vh`,
          transition: isDragging ? 'none' : 'height 250ms ease',
        }}
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
