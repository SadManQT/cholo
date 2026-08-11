import type { ReactNode } from 'react';
import { Button } from './Button';

// doc 11-12 §2.4 lists "EmptyState / ErrorState" as ONE row — same shape
// (icon + title + hint + optional action), used for both "nothing here
// yet" and "that failed, try again" (doc §8's Empty and Error states share
// this exact component, just different copy/icon/action label).
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

function DefaultIcon() {
  return (
    <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M3 9.5 12 3l9 6.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 21v-6h6v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EmptyState({ icon, title, hint, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center gap-2 px-6 py-12 text-center ${className}`}>
      <div className="text-ink-500/60">{icon ?? <DefaultIcon />}</div>
      <p className="text-base font-semibold text-ink-900">{title}</p>
      {hint && <p className="max-w-xs text-sm text-ink-500">{hint}</p>}
      {action && (
        <Button variant="secondary" onClick={action.onClick} className="mt-2">
          {action.label}
        </Button>
      )}
    </div>
  );
}
