import { useCallback, useEffect, useState } from 'react';

export function useCountdown() {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  const start = useCallback((durationSeconds: number) => {
    setRemaining(durationSeconds);
  }, []);

  return { remaining, start, isActive: remaining > 0 };
}
