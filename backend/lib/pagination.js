// Clamps pagination from untrusted query params so a client can't force an
// unbounded or negative-skip read (e.g. `?limit=1000000` to pull the whole
// table, or `?page=-5` to mutate the skip math). Every list endpoint in the
// codebase read `req.query.limit`/`req.query.page` inline with varying rigor;
// this is the one place those semantics are standardized. `defaultLimit` is
// the per-route page size when the param is absent; `MAX_LIMIT` bounds the
// largest page any client may request. Behavior for in-range values is
// unchanged — only pathological values are clamped.
export const MAX_LIMIT = 100;

export function normalizePagination(query, defaultLimit = 20) {
  const rawPage = Number(query.page);
  const rawLimit = Number(query.limit);

  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 1
      ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
      : defaultLimit;

  return { page, limit, skip: (page - 1) * limit };
}

export default { normalizePagination, MAX_LIMIT };
