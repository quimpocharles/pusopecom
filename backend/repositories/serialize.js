/**
 * Prisma always returns records with an `id` field in JS, regardless of any
 * @map on the schema — @map only renames the underlying Postgres column,
 * not what Prisma Client hands back. Every existing route/frontend call
 * site reads `_id`, the way Mongoose always serialized ObjectId. This is
 * the single most pervasive compatibility gap in this migration (see the
 * migration plan) — every repository routes its results through this
 * before returning them.
 *
 * Recurses into nested objects and arrays (populated relations), renaming
 * `id` -> `_id` at every level, so a populated relation ends up shaped
 * exactly like a Mongoose `.populate()` result.
 *
 * Dates are passed through unchanged — a naive recursive walk would treat
 * a Date as a plain object with no enumerable own properties and silently
 * corrupt every createdAt/updatedAt/timestamp field into `{}`.
 */
const isPlainObject = (value) =>
  typeof value === 'object' &&
  value !== null &&
  !(value instanceof Date) &&
  !Array.isArray(value);

export function serialize(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(serialize);

  if (isPlainObject(value)) {
    const result = {};
    for (const [key, val] of Object.entries(value)) {
      if (key === 'id') {
        result._id = val;
      } else {
        result[key] = serialize(val);
      }
    }
    return result;
  }

  return value;
}

/**
 * Mongoose's `ref` fields are the same JSON key whether populated or not:
 * `order.user` is either an ObjectId string, or — after `.populate('user')`
 * — the full sub-document. Prisma splits this into two separate fields: the
 * FK scalar (`userId`, always present) and the relation object (`user`,
 * only present when `include`d). This closes that gap: pass the relation
 * key name and its matching FK scalar key name, and this collapses them
 * back into the single Mongoose-shaped field, preferring the populated
 * object when present and falling back to the bare id when not.
 *
 * Deliberately explicit per call site (which relations exist varies by
 * entity) rather than one generic auto-detecting transform — the fields
 * that need this are enumerable and few; a clever universal version would
 * cost more to verify than it saves.
 */
export function withRelationFallback(record, relationMap) {
  if (!record) return record;
  const result = { ...record };
  for (const [relationKey, fkKey] of Object.entries(relationMap)) {
    if (result[relationKey] === undefined && result[fkKey] !== undefined) {
      result[relationKey] = result[fkKey];
    }
    if (Object.prototype.hasOwnProperty.call(result, fkKey)) {
      delete result[fkKey];
    }
  }
  return result;
}
