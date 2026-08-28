// PusoStore operates in exactly one timezone (Philippine sports, Philippine
// fans) — every admin-entered event date/time means Philippine time, and
// every displayed date/time should read as Philippine time regardless of
// the viewer's own device (this matters most for the diaspora/OFW audience
// the platform is built for). `Intl`'s locale (e.g. 'en-PH') only controls
// formatting conventions, not the zone actually used — callers must pass
// this explicitly.
export const PH_TIME_ZONE = 'Asia/Manila';

// Converts a stored UTC ISO timestamp into the "YYYY-MM-DDTHH:mm" wall-clock
// string a <input type="datetime-local"> expects, computed explicitly in
// Asia/Manila — never the admin's own browser timezone. Mirrors the
// backend's rule that a naive datetime-local value round-tripped back
// through the form means Philippine time (backend/lib/dateInput.js).
export function toManilaDateTimeLocal(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PH_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
