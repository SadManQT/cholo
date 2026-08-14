const TONES: Record<string, string> = {
  active: 'bg-danger-600/10 text-danger-600',
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
};

export function StatePill({ state }: { state: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[state] ?? 'bg-ink-500/10 text-ink-500'}`}>
      {state.replaceAll('_', ' ')}
    </span>
  );
}
