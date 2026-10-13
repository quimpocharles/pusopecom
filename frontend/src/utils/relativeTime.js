// Small, focused date-formatting utility — mirrors the shape of the other
// per-feature utils in this folder (returnStatus.js, shipmentStatus.js).
// AdminPassCheckin.jsx has its own inline formatRelativeTime, but it only
// covers minutes/hours (fine for an event-day sync timestamp); this one
// needs day-scale output ("yesterday", "N days ago") too, so it's its own
// small function rather than a shared one stretched to fit both call sites.

/**
 * Formats an ISO 8601 timestamp as a short relative-time phrase
 * ("just now", "5 minutes ago", "2 hours ago", "yesterday", "5 days ago").
 * Returns null for a missing/invalid timestamp — the caller's job to
 * render nothing in that case, not to crash or show "Invalid Date."
 */
export function formatRelativeTime(isoString) {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return null;

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now'; // also covers a future/clock-skew timestamp

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return 'yesterday';
  return `${diffDay} days ago`;
}
