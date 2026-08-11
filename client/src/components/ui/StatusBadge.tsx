// doc 11-12 §2.1's semantic status table — the ONE place these seven
// statuses (ride_request_status + trip_status, schema.sql) get a color, so
// every screen that shows a trip/request/document/withdrawal agrees.
export type StatusBadgeStatus =
  | 'searching'
  | 'assigned'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired';

interface StatusConfig {
  label: string;
  classes: string;
  pulse?: boolean;
  check?: boolean;
}

const STATUS_CONFIG: Record<StatusBadgeStatus, StatusConfig> = {
  searching: { label: 'Searching', classes: 'bg-marigold-500/15 text-marigold-500', pulse: true },
  assigned: { label: 'Assigned', classes: 'bg-info-600/10 text-info-600' },
  arrived: { label: 'Arrived', classes: 'bg-info-600/10 text-info-600' },
  in_progress: { label: 'In progress', classes: 'bg-cholo-50 text-cholo-700' },
  completed: { label: 'Completed', classes: 'bg-cholo-50 text-cholo-700', check: true },
  cancelled: { label: 'Cancelled', classes: 'bg-danger-600/10 text-danger-600' },
  // no dedicated "gray" token in doc 12 — ink-500 is the palette's own
  // muted/secondary color, reused here rather than inventing a new hex.
  expired: { label: 'Expired', classes: 'bg-ink-500/10 text-ink-500' },
};

function CheckIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface StatusBadgeProps {
  status: StatusBadgeStatus;
  className?: string;
}

// doc 12 §10: "status conveyed by badge text + color, never color alone" —
// the label always renders, color is reinforcement, not the only signal.
export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium ${config.classes} ${className}`}
    >
      {config.check ? (
        <CheckIcon />
      ) : (
        <span className={`h-1.5 w-1.5 rounded-full bg-current ${config.pulse ? 'animate-pulse' : ''}`} aria-hidden="true" />
      )}
      {config.label}
    </span>
  );
}
