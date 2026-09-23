import { formatDateTime } from '../../utils/format';

interface TimelineDispute {
  status: string;
  createdAt: string;
  reviewStartedAt?: string | null;
  resolvedAt: string | null;
}

const RESOLVED_LABEL: Record<string, string> = {
  resolved_refunded: 'Resolved · refunded',
  resolved_no_action: 'Resolved',
  rejected: 'Closed · claim rejected',
};

export function DisputeTimeline({ dispute, className = '' }: { dispute: TimelineDispute; className?: string }) {
  const steps = [
    { label: 'Opened', at: dispute.createdAt },
    { label: 'Under review', at: dispute.reviewStartedAt ?? (dispute.resolvedAt ? dispute.resolvedAt : null) },
    { label: RESOLVED_LABEL[dispute.status] ?? 'Resolved', at: dispute.resolvedAt },
  ];
  const reached = steps.filter((step) => step.at).length;

  return (
    <ol className={`flex items-start ${className}`} aria-label="Dispute progress">
      {steps.map((step, index) => {
        const done = index < reached;
        return (
          <li key={step.label} className="relative flex-1">
            {index > 0 && <span className={`absolute right-1/2 top-[7px] h-0.5 w-full ${done ? 'bg-cholo-700' : 'bg-border'}`} aria-hidden="true" />}
            <div className="relative z-10 flex flex-col items-center text-center">
              <span className={`h-4 w-4 rounded-full border-2 ${done ? 'border-cholo-700 bg-cholo-700' : 'border-border bg-surface'}`} aria-hidden="true" />
              <span className={`mt-1 text-xs font-medium ${done ? 'text-ink-900' : 'text-ink-500'}`}>{step.label}</span>
              {step.at && done && <span className="text-[11px] text-ink-500">{formatDateTime(step.at)}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
