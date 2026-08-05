import { useState, useEffect } from 'react';

// Payment Platform Redesign, Phase 3 — shared by CompletePaymentButton's
// own inline countdown and the Payment Information panel's "Time
// Remaining" field, so the two never drift out of sync or run separate
// timers against the same expiresAt.
function formatCountdown(ms) {
  if (ms <= 0) return null;
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function usePaymentCountdown(expiresAt) {
  const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (expiresAtMs === null) return undefined;
    // Minute-granularity display doesn't need a faster tick than that.
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, [expiresAtMs]);

  if (expiresAtMs === null) return { remainingMs: null, isExpired: false, formatted: null };

  const remainingMs = expiresAtMs - now;
  const isExpired = remainingMs <= 0;
  return { remainingMs, isExpired, formatted: isExpired ? null : formatCountdown(remainingMs) };
}

export default usePaymentCountdown;
