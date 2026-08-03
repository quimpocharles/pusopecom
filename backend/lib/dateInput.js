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
export function toDateOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value;
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
