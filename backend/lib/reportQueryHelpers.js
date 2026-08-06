/**
 * Shared by every admin report's computeXReport(query) — extracted out of
 * routes/reports.js so the new backend/services/reportQueries/*.js modules
 * (Executive, and Fit Check Analytics/Organizations/Finance in later
 * phases) can reuse them without importing the router file itself (which
 * would create a circular import: routes/reports.js already imports these
 * new modules to wire up their routes).
 *
 * Every report fetches the relevant rows once via a repository call, then
 * groups/sums them in plain JS — replacing Mongo aggregation pipelines
 * rather than hand-translating each one into raw SQL. See routes/reports.js's
 * own header comment for the full reasoning; unchanged by this extraction.
 */

// Parse date range from query params into a Prisma-shaped filter
export function getDateFilter(query) {
  const range = {};
  if (query.startDate) range.gte = new Date(query.startDate);
  if (query.endDate) {
    const end = new Date(query.endDate);
    end.setHours(23, 59, 59, 999);
    range.lte = end;
  }
  return Object.keys(range).length > 0 ? { createdAt: range } : {};
}

// Choose time granularity based on date range
export function getGranularity(startDate, endDate) {
  if (!startDate && !endDate) return 'month';
  const start = startDate ? new Date(startDate) : new Date('2020-01-01');
  const end = endDate ? new Date(endDate) : new Date();
  const days = (end - start) / (1000 * 60 * 60 * 24);
  if (days <= 31) return 'day';
  if (days <= 180) return 'week';
  return 'month';
}

/**
 * Buckets a date into the same key shape Mongo's $dateToString produced
 * ('%Y-%m-%d', '%Y-W%V', '%Y-%m'), so every report's date-bucketed output
 * is unchanged for API consumers. The week case needs real ISO-8601 week
 * math (weeks start Monday, week 1 contains the year's first Thursday,
 * matching Mongo's %V) — not just a naive days-since-epoch divide.
 */
export function dateKey(date, granularity) {
  const d = new Date(date);
  if (granularity === 'day') return d.toISOString().slice(0, 10);
  if (granularity === 'month') return d.toISOString().slice(0, 7);

  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = utc.getUTCDay() || 7; // Mon=1..Sun=7
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum); // shift to this week's Thursday
  const isoYear = utc.getUTCFullYear();
  const yearStart = Date.UTC(isoYear, 0, 1);
  const weekNum = Math.ceil(((utc.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${isoYear}-W${String(weekNum).padStart(2, '0')}`;
}

export function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

export const sortByDateKey = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

export function exportFormat(query) {
  if (query.format === 'xlsx') return 'xlsx';
  if (query.format === 'pdf') return 'pdf';
  return 'csv';
}
