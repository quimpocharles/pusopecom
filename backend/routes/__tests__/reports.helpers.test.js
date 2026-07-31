import { describe, it, expect, vi } from 'vitest';

vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => next(),
  isAdmin: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
}));

const { getDateFilter, getGranularity, dateKey } = await import('../reports.js');

describe('getDateFilter', () => {
  it('returns an empty object when no range is given', () => {
    expect(getDateFilter({})).toEqual({});
  });

  it('builds a gte/lte createdAt range, with endDate inclusive through end of day', () => {
    const filter = getDateFilter({ startDate: '2026-01-01', endDate: '2026-01-31' });
    expect(filter.createdAt.gte.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(filter.createdAt.lte.getHours()).toBe(23);
    expect(filter.createdAt.lte.getMinutes()).toBe(59);
  });
});

describe('getGranularity', () => {
  it('defaults to month when no range is given', () => {
    expect(getGranularity(undefined, undefined)).toBe('month');
  });

  it('picks day for a range under 31 days', () => {
    expect(getGranularity('2026-01-01', '2026-01-15')).toBe('day');
  });

  it('picks week for a range under 180 days', () => {
    expect(getGranularity('2026-01-01', '2026-04-01')).toBe('week');
  });

  it('picks month for a long range', () => {
    expect(getGranularity('2020-01-01', '2026-01-01')).toBe('month');
  });
});

describe('dateKey', () => {
  it('formats a day key as YYYY-MM-DD in UTC', () => {
    expect(dateKey('2026-03-15T10:00:00Z', 'day')).toBe('2026-03-15');
  });

  it('formats a month key as YYYY-MM', () => {
    expect(dateKey('2026-03-15T10:00:00Z', 'month')).toBe('2026-03');
  });

  it('formats an ISO week key matching the ISO-8601 definition', () => {
    // 2026-01-01 is a Thursday, so it's ISO week 1 of 2026.
    expect(dateKey('2026-01-01T12:00:00Z', 'week')).toBe('2026-W01');
    // 2026-01-05 (Monday) is still in ISO week 2 of 2026.
    expect(dateKey('2026-01-05T12:00:00Z', 'week')).toBe('2026-W02');
  });

  it('assigns early-January dates to the previous ISO year\'s last week when appropriate', () => {
    // 2027-01-01 is a Friday — ISO week 1 of 2027 starts Monday 2027-01-04,
    // so Jan 1-3 belong to ISO week 53 of 2026, not week 1 of 2027.
    expect(dateKey('2027-01-01T12:00:00Z', 'week')).toBe('2026-W53');
  });

  it('assigns late-December dates to the next ISO year\'s first week when appropriate', () => {
    // 2025-12-29 is a Monday, starting ISO week 1 of 2026.
    expect(dateKey('2025-12-29T12:00:00Z', 'week')).toBe('2026-W01');
  });
});
