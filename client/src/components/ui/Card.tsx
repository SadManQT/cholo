import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

// doc 11-12 §2.4: "Card | flat / interactive (pressable) | lists,
// dashboards." §2.3: "flat cards use borders" (shadows are reserved for
// floating things — sheets/modals/FABs, never a plain card).
type CardVariant = 'flat' | 'interactive';

interface CardBaseProps {
  variant?: CardVariant;
  /** doc 12 §2.1's cholo-50 "selected-card wash" — e.g. the chosen FareEstimateCard. */
  selected?: boolean;
  className?: string;
  children: ReactNode;
}

type CardProps =
  | (CardBaseProps & { variant?: 'flat' } & HTMLAttributes<HTMLDivElement>)
  | (CardBaseProps & { variant: 'interactive' } & ButtonHTMLAttributes<HTMLButtonElement>);

// Interactive renders as a real <button> (doc 12 §10: "real <button>"),
// never a <div onClick> — free keyboard/focus/role handling instead of
// reinventing it per card.
export function Card({ variant = 'flat', selected = false, className = '', children, ...props }: CardProps) {
  const shared = `rounded-xl border p-4 text-left transition-colors
                   ${selected ? 'border-cholo-700 bg-cholo-50' : 'border-border bg-surface'}`;

  if (variant === 'interactive') {
    const { ...buttonProps } = props as ButtonHTMLAttributes<HTMLButtonElement>;
    return (
      <button
        type="button"
        className={`w-full cursor-pointer ${shared}
                    hover:border-cholo-700/50
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700 focus-visible:ring-offset-2
                    ${className}`}
        {...buttonProps}
      >
        {children}
      </button>
    );
  }

  const { ...divProps } = props as HTMLAttributes<HTMLDivElement>;
  return (
    <div className={`${shared} ${className}`} {...divProps}>
      {children}
    </div>
  );
}
