import { describe, it, expect } from 'vitest';
import { toDateOrNull, normalizeDateFields } from '../dateInput.js';

describe('toDateOrNull', () => {
  it('converts a bare YYYY-MM-DD string (the exact shape an <input type="date"> sends) into a real Date', () => {
    const result = toDateOrNull('2026-08-10');
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe('2026-08-10T00:00:00.000Z');
  });

  it('passes a full ISO datetime string through unchanged in meaning', () => {
    const result = toDateOrNull('2026-08-10T14:30:00.000Z');
    expect(result.toISOString()).toBe('2026-08-10T14:30:00.000Z');
  });

  it('interprets a bare datetime-local string (no offset) as Philippine time, not the process\'s own local timezone', () => {
    // 8:30 PM Philippine time (UTC+8) is 12:30 PM UTC the same day.
    const result = toDateOrNull('2026-08-28T20:30');
    expect(result.toISOString()).toBe('2026-08-28T12:30:00.000Z');
  });

  it('also handles a bare datetime-local string with seconds', () => {
    const result = toDateOrNull('2026-08-28T20:30:15');
    expect(result.toISOString()).toBe('2026-08-28T12:30:15.000Z');
  });

  it('returns null for null, undefined, and empty string', () => {
    expect(toDateOrNull(null)).toBeNull();
    expect(toDateOrNull(undefined)).toBeNull();
    expect(toDateOrNull('')).toBeNull();
  });

  it('passes an existing Date instance through unchanged', () => {
    const d = new Date('2026-01-01');
    expect(toDateOrNull(d)).toBe(d);
  });
});

describe('normalizeDateFields', () => {
  it('normalizes only the named keys, leaving everything else untouched', () => {
    const result = normalizeDateFields(
      { name: 'Campaign', startDate: '2026-08-01', endDate: '2026-08-31', headline: 'x' },
      ['startDate', 'endDate']
    );
    expect(result.startDate).toBeInstanceOf(Date);
    expect(result.endDate).toBeInstanceOf(Date);
    expect(result.name).toBe('Campaign');
    expect(result.headline).toBe('x');
  });

  it('leaves a key absent from the input absent from the output (no forced null)', () => {
    const result = normalizeDateFields({ name: 'x' }, ['startDate', 'endDate']);
    expect('startDate' in result).toBe(false);
  });
});
