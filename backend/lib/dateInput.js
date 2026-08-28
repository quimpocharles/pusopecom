/**
 * Normalizes an admin-form date value — typically a bare 'YYYY-MM-DD'
 * string from an <input type="date">, but also accepts a full ISO
 * datetime string, a Date, null, or '' — into a real Date object.
 *
 * Passing a bare 'YYYY-MM-DD' string straight through to Prisma's DateTime
 * scalar fails outright ("Invalid value ... premature end of input.
 * Expected ISO-8601 DateTime"), not silently — but every scheduling admin
 * form (Campaign, PromoMessage) was doing exactly that, which meant
 * scheduling a start/end date never actually worked once a real date was
 * entered through the browser's date picker. Repositories that accept
 * admin-supplied date-range fields should route them through this first.
 */
// A bare 'YYYY-MM-DDTHH:mm[:ss]' — exactly what <input type="datetime-local">
// produces — carries no timezone of its own. Per spec, a datetime string
// with no offset parses in the *executing process's* local timezone: fine
// on an admin's own PHT-set laptop, silently wrong by a fixed 8 hours on a
// UTC-default production server (Railway). PusoStore serves Philippine
// sports exclusively (see CLAUDE.md) — there is no second timezone an
// admin-entered event time could mean — so every such value is parsed as
// Philippine time explicitly, regardless of where this process happens to
// run. A bare 'YYYY-MM-DD' (no time-of-day, from <input type="date">) is
// left untouched: those already parse as UTC midnight per spec, which for a
// UTC+8 zone never shifts the calendar day, so nothing was broken there.
const NAIVE_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
const PH_OFFSET = '+08:00';

export function toDateOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' && NAIVE_DATETIME.test(value)) {
    return new Date(`${value}${PH_OFFSET}`);
  }
  return new Date(value);
}

/** Applies toDateOrNull to the named keys of `data`, leaving keys not present untouched. */
export function normalizeDateFields(data, keys) {
  const result = { ...data };
  for (const key of keys) {
    if (key in result) result[key] = toDateOrNull(result[key]);
  }
  return result;
}
