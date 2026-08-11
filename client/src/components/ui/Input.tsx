import { forwardRef, useId, useState } from 'react';
import type { ChangeEvent, InputHTMLAttributes } from 'react';

// doc 11-12 §2.4: "Input | text / phone (numeric, 01… mask) / password
// (visibility toggle) · error state with message | all forms."
type InputVariant = 'text' | 'phone' | 'password';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  variant?: InputVariant;
  label?: string;
  error?: string;
  containerClassName?: string;
}

function EyeIcon({ crossedOut }: { crossedOut: boolean }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
      {crossedOut && <path d="M3 3l18 18" strokeLinecap="round" />}
    </svg>
  );
}

// BD mobile numbers: 11 digits, always starting "01" — the mask just keeps
// stray letters/symbols out, it does not replace the backend's zod/regex
// validation (doc 09), which is the real gate.
function maskPhoneDigits(raw: string) {
  return raw.replace(/\D/g, '').slice(0, 11);
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { variant = 'text', label, error, id, className = '', containerClassName = '', onChange, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = variant === 'password';
  const type = variant === 'phone' ? 'tel' : isPassword ? (showPassword ? 'text' : 'password') : 'text';

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    if (variant === 'phone') {
      event.target.value = maskPhoneDigits(event.target.value);
    }
    onChange?.(event);
  }

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-ink-900">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={type}
          inputMode={variant === 'phone' ? 'numeric' : undefined}
          placeholder={variant === 'phone' ? '01XXXXXXXXX' : props.placeholder}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={handleChange}
          className={`h-11 w-full rounded-xl border bg-surface px-3.5 text-base text-ink-900
                      placeholder:text-ink-500/70
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                      disabled:cursor-not-allowed disabled:bg-surface-alt disabled:opacity-70
                      ${isPassword ? 'pr-11' : ''}
                      ${error
                        ? 'border-danger-600 focus-visible:ring-danger-600'
                        : 'border-border focus-visible:ring-cholo-700'}
                      ${className}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-500
                       hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700 rounded-r-xl"
          >
            <EyeIcon crossedOut={showPassword} />
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-sm text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
});
