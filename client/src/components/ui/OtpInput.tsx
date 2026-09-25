import { useEffect, useRef } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import { EASE_IN_OUT_CSS, EASE_OUT_CSS } from '../../utils/motion';
import { t } from '../../i18n';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  error?: boolean;
  disabled?: boolean;
}

function pop(el: HTMLInputElement | null | undefined) {
  if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  el.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }],
    { duration: 160, easing: EASE_OUT_CSS },
  );
}

export function OtpInput({ value, onChange, onComplete, length = 6, error = false, disabled = false }: OtpInputProps) {
  const boxRefs = useRef<(HTMLInputElement | null)[]>([]);
  const groupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!error || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    groupRef.current?.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-6px)' },
        { transform: 'translateX(6px)' },
        { transform: 'translateX(-4px)' },
        { transform: 'translateX(4px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 300, easing: EASE_IN_OUT_CSS },
    );
  }, [error]);

  function commit(nextValue: string) {
    onChange(nextValue);
    if (nextValue.length === length) {
      onComplete?.(nextValue);
    }
  }

  function handleBoxChange(index: number, rawInput: string) {
    const digit = rawInput.replace(/\D/g, '').slice(-1);
    const next = value.split('');
    next[index] = digit;
    const nextValue = next.join('').slice(0, length);
    commit(nextValue);

    if (digit) {
      pop(boxRefs.current[index]);
      if (index < length - 1) boxRefs.current[index + 1]?.focus();
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
    boxRefs.current[Math.min(digits.length, length - 1)]?.focus();
    for (let i = 0; i < digits.length; i += 1) {
      window.setTimeout(() => pop(boxRefs.current[i]), i * 40);
    }
  }

  return (
    <div ref={groupRef} className="flex justify-between gap-2" role="group" aria-label={t('Verification code')}>
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
          aria-label={t('Digit {0} of {1}', index + 1, length)}
          className={`h-14 w-11 rounded-xl border text-center text-xl font-semibold text-ink-900 tabular-nums
                      transition-colors duration-150 ease-cholo-out
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                      disabled:cursor-not-allowed disabled:bg-surface-alt disabled:opacity-70
                      ${error ? 'border-danger-600 focus-visible:ring-danger-600' : 'border-border focus-visible:ring-cholo-700'}`}
        />
      ))}
    </div>
  );
}
