// doc 11-12 §2.4 "Skeleton | line / card / map-placeholder" + §8's rule:
// loading skeletons must be "shaped like the real content" — never a lone
// spinner for a list. These are the three shapes every loading state
// composes from.
type SkeletonVariant = 'line' | 'card' | 'map-placeholder';

interface SkeletonProps {
  variant?: SkeletonVariant;
  /** Only meaningful for variant="line" — stacked bars for a paragraph/list row. */
  lines?: number;
  className?: string;
}

const PULSE = 'animate-pulse rounded-md bg-ink-500/15';

export function Skeleton({ variant = 'line', lines = 1, className = '' }: SkeletonProps) {
  if (variant === 'map-placeholder') {
    return <div className={`${PULSE} rounded-none ${className || 'h-64 w-full'}`} aria-hidden="true" />;
  }

  if (variant === 'card') {
    return (
      <div className={`flex items-center gap-3 rounded-xl border border-border bg-surface p-4 ${className}`} aria-hidden="true">
        <div className={`${PULSE} h-10 w-10 shrink-0 rounded-full`} />
        <div className="flex-1 space-y-2">
          <div className={`${PULSE} h-3.5 w-3/5`} />
          <div className={`${PULSE} h-3 w-2/5`} />
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <div key={index} className={`${PULSE} h-3.5 ${index === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}
