const TONES: Record<string, string> = {
  active: 'bg-cholo-50 text-cholo-700',
  expired: 'bg-danger-600/10 text-danger-600',
  missing: 'bg-ink-500/10 text-ink-500',
  acknowledged: 'bg-marigold-500/15 text-marigold-500',
  open: 'bg-info-600/10 text-info-600',
  pending: 'bg-marigold-500/15 text-marigold-500',
  requested: 'bg-marigold-500/15 text-marigold-500',
  in_progress: 'bg-info-600/10 text-info-600',
  under_review: 'bg-info-600/10 text-info-600',
  waiting_user: 'bg-marigold-500/15 text-marigold-500',
  approved: 'bg-cholo-50 text-cholo-700',
  resolved: 'bg-cholo-50 text-cholo-700',
  resolved_refunded: 'bg-cholo-50 text-cholo-700',
  resolved_no_action: 'bg-cholo-50 text-cholo-700',
  closed: 'bg-ink-500/10 text-ink-500',
  rejected: 'bg-danger-600/10 text-danger-600',
  suspended: 'bg-danger-600/10 text-danger-600',
  deleted: 'bg-ink-500/10 text-ink-500',
  false_alarm: 'bg-ink-500/10 text-ink-500',
  paused: 'bg-ink-500/10 text-ink-500',
  live: 'bg-marigold-500/15 text-marigold-500',
  scheduled: 'bg-info-600/10 text-info-600',
  ended: 'bg-ink-500/10 text-ink-500',
  investigating: 'bg-info-600/10 text-info-600',
  action_taken: 'bg-cholo-50 text-cholo-700',
  dismissed: 'bg-ink-500/10 text-ink-500',
};

const LABELS: Record<string, string> = { missing: 'not uploaded' };
const URGENT = 'bg-danger-600/10 text-danger-600';

export function StatePill({ state, urgent = false }: { state: string; urgent?: boolean }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${urgent ? URGENT : TONES[state] ?? 'bg-ink-500/10 text-ink-500'}`}>
      {LABELS[state] ?? state.replaceAll('_', ' ')}
    </span>
  );
}
