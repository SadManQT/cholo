import type { TripStatus } from '../../types/ride.types';

const STEPS: Array<{ status: Exclude<TripStatus, 'cancelled'>; label: string }> = [
  { status: 'assigned', label: 'Assigned' },
  { status: 'arrived', label: 'Arrived' },
  { status: 'in_progress', label: 'Riding' },
  { status: 'completed', label: 'Done' },
];

export function TripStatusStepper({ status }: { status: TripStatus }) {
  if (status === 'cancelled') {
    return <p className="rounded-xl bg-danger-600/10 p-3 text-center font-semibold text-danger-600">Trip cancelled</p>;
  }

  const currentIndex = STEPS.findIndex((step) => step.status === status);

  return (
    <ol className="flex items-start" aria-label={`Trip status: ${status.replace('_', ' ')}`}>
      {STEPS.map((step, index) => {
        const complete = index <= currentIndex;
        return (
          <li key={step.status} className="relative flex flex-1 flex-col items-center gap-1 text-center">
            {index > 0 && (
              <span
                className={`absolute right-1/2 top-2.5 h-0.5 w-full transition-colors duration-300 ease-cholo-out ${index <= currentIndex ? 'bg-cholo-700' : 'bg-border'}`}
                aria-hidden="true"
              />
            )}
            <span
              className={`relative z-10 h-5 w-5 rounded-full border-2 transition-colors duration-300 ease-cholo-out ${complete ? 'border-cholo-700 bg-cholo-700' : 'border-border bg-surface'}`}
              aria-hidden="true"
            />
            <span className={`text-xs transition-colors duration-300 ease-cholo-out ${complete ? 'font-semibold text-cholo-700' : 'text-ink-500'}`}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
