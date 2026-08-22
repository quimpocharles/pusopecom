import { describe, it, expect } from 'vitest';
import { normalizePagination, MAX_LIMIT } from '../pagination.js';

describe('normalizePagination — clamps unbounded/negative pagination', () => {
  it('keeps in-range values as-is', () => {
    expect(normalizePagination({ page: '2', limit: '24' }, 20)).toEqual({ page: 2, limit: 24, skip: 24 });
    expect(normalizePagination({}, 12)).toEqual({ page: 1, limit: 12, skip: 0 });
  });

  it('caps an unbounded limit at MAX_LIMIT', () => {
    const r = normalizePagination({ limit: '1000000' }, 20);
    expect(r.limit).toBe(MAX_LIMIT);
    expect(r.skip).toBe(0);
  });

  it('rejects a negative/zero page and falls back to page 1', () => {
    expect(normalizePagination({ page: '-5', limit: '20' }, 20).page).toBe(1);
    expect(normalizePagination({ page: '0', limit: '20' }, 20).page).toBe(1);
    expect(normalizePagination({ page: '0', limit: '0' }, 20)).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it('rejects non-numeric page/limit and uses defaults', () => {
    expect(normalizePagination({ page: 'abc', limit: 'xyz' }, 20)).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it('floors fractional page/limit inputs', () => {
    expect(normalizePagination({ page: '2.9', limit: '10.9' }, 20)).toEqual({ page: 2, limit: 10, skip: 10 });
  });
});
