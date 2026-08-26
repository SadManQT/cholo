import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';

// doc 11-12 §2.4: "Button | primary / secondary / ghost / danger · loading
// (spinner) / disabled | everywhere — the only button." One component, no
// per-page one-off <button className="..."> — that's the whole point of a
// design system enforced by config, not convention.
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // cholo-800 is literally doc 12's "button hover/pressed" token for primary.
  primary: 'bg-cholo-700 text-white hover:bg-cholo-800 active:bg-cholo-800',
  secondary: 'bg-surface text-ink-900 border border-border hover:bg-surface-alt',
  ghost: 'bg-transparent text-cholo-700 hover:bg-cholo-50',
  // no separate "danger hover" token in doc 12 — brightness darkens the
  // given danger-600 itself rather than inventing an undocumented shade.
  danger: 'bg-danger-600 text-white hover:brightness-95 active:brightness-90',
};

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

// doc 12 §10: touch targets >= 44px — h-11 (44px) is the floor, not a default
// that shrinks on a smaller viewport.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', loading = false, disabled, className = '', children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-4
                  text-base font-semibold
                  transition-[color,background-color,border-color,transform] duration-150 ease-cholo-out
                  active:scale-[0.97]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700 focus-visible:ring-offset-2
                  disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100
                  ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
});
