import { useCallback, useEffect, useState } from 'react';

// doc 11 §7 names this exact hook ("useCountdown(deadline) — the driver's
// 15-second offer timer"); OtpVerifyPage's 30s resend timer is the same
// pattern reused. `remaining` drives its own next tick via the effect's
// dependency on itself — a functional setState update (doc 11 §14 rule 7:
// avoid stale closures in timers) rather than reading `remaining` from a
// closure captured when the interval was created.
export function useCountdown() {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  // useCallback (stable identity, empty deps: it only ever calls
  // setRemaining, never reads `remaining` itself) — a caller that puts
  // `start` in its own effect's dependency array (e.g. "start the countdown
  // once on mount") needs that array to stay [start], not change every
  // render, or the effect fires every render instead of exactly once.
  const start = useCallback((durationSeconds: number) => {
    setRemaining(durationSeconds);
  }, []);

  return { remaining, start, isActive: remaining > 0 };
}
