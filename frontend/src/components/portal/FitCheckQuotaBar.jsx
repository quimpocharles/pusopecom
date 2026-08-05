import { useEffect, useState } from 'react';
import fitCheckQuotaService from '../../services/fitCheckQuotaService';

// "Today's Fit Checks / ■■■□□ / 3 / 5 Remaining / Resets in 14h 12m" —
// shown throughout the experience (the try-on flow itself and the Fit
// Check gallery) so a fan always knows where they stand. Filled pips are
// what's left, not what's used — reads directly under "X / Y Remaining."
const formatResetTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
};

const FitCheckQuotaBar = ({ className = '', refreshKey }) => {
  const [quota, setQuota] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fitCheckQuotaService
      .getQuota()
      .then((res) => {
        if (!cancelled) setQuota(res.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (!quota) return null;

  const { limit, remaining, resetsInSeconds, bonusRemaining } = quota;

  return (
    <div className={`text-center ${className}`.trim()}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Today's Fit Checks</p>
      <div className="flex justify-center gap-1 mb-1.5">
        {Array.from({ length: limit }).map((_, i) => (
          <span key={i} className={`w-2.5 h-2.5 rounded-sm ${i < remaining ? 'bg-primary-600' : 'bg-gray-200'}`} />
        ))}
      </div>
      <p className="text-sm font-medium text-gray-900">
        {remaining} / {limit} Remaining
      </p>
      <p className="text-xs text-gray-400">Resets in {formatResetTime(resetsInSeconds)}</p>
      {/* Bonus balance is a separate, durable ledger (Phase 2) — only shown
          once a fan actually has one, distinct from the resetting daily pips
          above so the two mechanics never look like the same number. */}
      {bonusRemaining > 0 && (
        <p className="text-xs font-medium text-amber-600 mt-1">+{bonusRemaining} bonus Fit Check{bonusRemaining === 1 ? '' : 's'}</p>
      )}
    </div>
  );
};

export default FitCheckQuotaBar;
