import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

type CardVariant = 'flat' | 'interactive';

interface CardBaseProps {
  variant?: CardVariant;
  selected?: boolean;
  className?: string;
  children: ReactNode;
}

type CardProps =
  | (CardBaseProps & { variant?: 'flat' } & HTMLAttributes<HTMLDivElement>)
  | (CardBaseProps & { variant: 'interactive' } & ButtonHTMLAttributes<HTMLButtonElement>);

export function Card({ variant = 'flat', selected = false, className = '', children, ...props }: CardProps) {
  const shared = `rounded-xl border p-4 text-left
                   ${selected ? 'border-cholo-700 bg-cholo-50' : 'border-border bg-surface'}`;

  if (variant === 'interactive') {
    const { ...buttonProps } = props as ButtonHTMLAttributes<HTMLButtonElement>;
    return (
      <button
        type="button"
        className={`w-full cursor-pointer ${shared}
                    transition-[color,background-color,border-color,transform] duration-150 ease-cholo-out active:scale-[0.98]
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
    <div className={`${shared} transition-colors duration-150 ease-cholo-out ${className}`} {...divProps}>
      {children}
    </div>
  );
}
