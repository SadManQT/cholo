import { useRef } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';

// doc 11-12 §2.4: "OtpInput | 6 boxes, auto-advance, paste support |
// registration, payout confirm." Controlled: the parent owns the full code
// as one string (matches doc 11 §4's controlled-input rule) — this just
// renders it as `length` boxes and handles the per-box focus choreography.
interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Fires once, exactly when the code reaches full length (doc 12 §4: "auto-submits on 6th digit"). */
  onComplete?: (value: string) => void;
  length?: number;
  error?: boolean;
  disabled?: boolean;
}

export function OtpInput({ value, onChange, onComplete, length = 6, error = false, disabled = false }: OtpInputProps) {
  const boxRefs = useRef<(HTMLInputElement | null)[]>([]);

  function commit(nextValue: string) {
    onChange(nextValue);
    if (nextValue.length === length) {
      onComplete?.(nextValue);
    }
  }

  function handleBoxChange(index: number, rawInput: string) {
    const digit = rawInput.replace(/\D/g, '').slice(-1); // last digit typed, in case of IME/overtype
    const next = value.split('');
    next[index] = digit;
    const nextValue = next.join('').slice(0, length);
    commit(nextValue);

    if (digit && index < length - 1) {
      boxRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !value[index] && index > 0) {
      boxRefs.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      boxRefs.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowRight' && index < length - 1) {
      boxRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!digits) return;
    event.preventDefault();
    commit(digits);
    // Focus the box right after the last pasted digit (or the last box if fully filled).
    boxRefs.current[Math.min(digits.length, length - 1)]?.focus();
  }

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="Verification code">
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(el) => {
            boxRefs.current[index] = el;
          }}
          value={value[index] ?? ''}
          onChange={(event) => handleBoxChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${index + 1} of ${length}`}
          className={`h-14 w-11 rounded-xl border text-center text-xl font-semibold text-ink-900 tabular-nums
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                      disabled:cursor-not-allowed disabled:bg-surface-alt disabled:opacity-70
                      ${error ? 'border-danger-600 focus-visible:ring-danger-600' : 'border-border focus-visible:ring-cholo-700'}`}
        />
      ))}
    </div>
  );
}
